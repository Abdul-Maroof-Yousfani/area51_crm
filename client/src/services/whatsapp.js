/**
 * WhatsApp Business API Integration Service
 * Supports multiple providers: Twilio, Wati, Aisensy
 */

import { db, appId } from '../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';

// Get WhatsApp config from Firestore
export async function getWhatsAppConfig() {
  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

/**
 * Send WhatsApp message via configured provider
 * @param {string} to - Recipient phone number (Pakistani format)
 * @param {string} message - Message text
 * @param {string} leadId - Associated lead ID for logging
 */
export async function sendWhatsAppMessage(to, message, leadId = null) {
  const config = await getWhatsAppConfig();

  if (!config?.waProvider || !config?.waApiKey) {
    console.warn('WhatsApp not configured');
    return { success: false, error: 'WhatsApp not configured' };
  }

  // Normalize phone to international format
  let phone = String(to).replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '92' + phone.substring(1);
  if (!phone.startsWith('92')) phone = '92' + phone;

  try {
    let result;

    switch (config.waProvider) {
      case 'twilio':
        result = await sendViaTwilio(config, phone, message);
        break;
      case 'wati':
        result = await sendViaWati(config, phone, message);
        break;
      case 'aisensy':
        result = await sendViaAisensy(config, phone, message);
        break;
      default:
        throw new Error(`Unknown provider: ${config.waProvider}`);
    }

    // Log message to conversation history
    if (leadId) {
      await logMessage(leadId, {
        direction: 'outbound',
        to: phone,
        message,
        status: result.success ? 'sent' : 'failed',
        provider: config.waProvider,
        messageId: result.messageId
      });
    }

    return result;
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send via Twilio WhatsApp API
 */
async function sendViaTwilio(config, phone, message) {
  const { waApiKey, waApiSecret, waBusinessNumber } = config;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${waApiKey}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${waApiKey}:${waApiSecret}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: `whatsapp:+${waBusinessNumber}`,
        To: `whatsapp:+${phone}`,
        Body: message
      })
    }
  );

  const data = await response.json();

  if (response.ok) {
    return { success: true, messageId: data.sid };
  } else {
    throw new Error(data.message || 'Twilio error');
  }
}

/**
 * Send via Wati API
 */
async function sendViaWati(config, phone, message) {
  const { waApiKey, waApiEndpoint } = config;

  const response = await fetch(
    `${waApiEndpoint}/api/v1/sendSessionMessage/${phone}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messageText: message })
    }
  );

  const data = await response.json();

  if (data.result) {
    return { success: true, messageId: data.info?.id };
  } else {
    throw new Error(data.info || 'Wati error');
  }
}

/**
 * Send via Aisensy API
 */
async function sendViaAisensy(config, phone, message) {
  const { waApiKey } = config;

  const response = await fetch(
    'https://backend.aisensy.com/campaign/t1/api/v2',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: waApiKey,
        campaignName: 'crm_message',
        destination: phone,
        userName: 'Area 51 CRM',
        templateParams: [],
        message: message
      })
    }
  );

  const data = await response.json();

  if (data.success) {
    return { success: true, messageId: data.messageId };
  } else {
    throw new Error(data.message || 'Aisensy error');
  }
}

/**
 * Log message to lead's conversation history
 */
async function logMessage(leadId, messageData) {
  try {
    await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', 'leads', leadId, 'messages'),
      {
        ...messageData,
        timestamp: serverTimestamp()
      }
    );

    // Update lead's lastContactedAt
    await updateDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'leads', leadId),
      { lastContactedAt: serverTimestamp() }
    );
  } catch (error) {
    console.error('Error logging message:', error);
  }
}

/**
 * Handle incoming WhatsApp webhook
 * This would be called by a Cloud Function receiving webhooks
 */
export async function handleIncomingMessage(webhookData, provider) {
  let from, message, timestamp;

  // Parse based on provider format
  switch (provider) {
    case 'twilio':
      from = webhookData.From?.replace('whatsapp:+', '');
      message = webhookData.Body;
      break;
    case 'wati':
      from = webhookData.waId;
      message = webhookData.text;
      break;
    case 'aisensy':
      from = webhookData.senderMobile;
      message = webhookData.message;
      break;
  }

  if (!from || !message) {
    console.warn('Invalid webhook data');
    return;
  }

  // Find lead by phone number
  // This would need to query Firestore for matching lead
  // For now, log to a general incoming messages collection
  await addDoc(
    collection(db, 'artifacts', appId, 'public', 'data', 'incoming_messages'),
    {
      from,
      message,
      provider,
      timestamp: serverTimestamp(),
      processed: false
    }
  );
}

/**
 * Generate WhatsApp web link (fallback for manual messaging)
 */
export function getWhatsAppLink(phone, message = '') {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '92' + clean.substring(1);
  else if (clean.length === 10 && clean.startsWith('3')) clean = '92' + clean;
  const baseUrl = `https://wa.me/${clean}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}
