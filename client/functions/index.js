/**
 * Firebase Cloud Functions for Area 51 CRM
 * Handles: WhatsApp webhooks, Meta Lead webhooks, Scheduled tasks, SMS Notifications
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Your app ID from firebase.js
const APP_ID = 'crm_v1_production';
const getCollection = (name) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection(name);

/**
 * ============================================
 * SMS NOTIFICATION HELPER - Sends SMS via Twilio
 * ============================================
 */
async function sendSmsNotification(employeeName, message, notificationType) {
  try {
    // Get integration settings
    const settingsDoc = await getCollection('app_settings').doc('integrations').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    // Check if SMS is enabled
    if (!settings.smsEnabled) {
      console.log('SMS notifications disabled');
      return false;
    }

    // Check notification type settings
    if (notificationType === 'lead_assigned' && !settings.smsNotifyOnAssignment) return false;
    if (notificationType === 'stale_lead_escalation' && !settings.smsNotifyOnEscalation) return false;
    if (notificationType === 'site_visit_reminder' && !settings.smsNotifyOnSiteVisit) return false;
    if (notificationType === 'quote_follow_up' && !settings.smsNotifyOnQuoteFollowUp) return false;

    // Get Twilio credentials
    const { smsTwilioSid, smsTwilioToken, smsTwilioNumber } = settings;
    if (!smsTwilioSid || !smsTwilioToken || !smsTwilioNumber) {
      console.error('Twilio SMS not configured');
      return false;
    }

    // Get employee phone number
    const usersSnapshot = await getCollection('allowed_users')
      .where('name', '==', employeeName)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`No user found with name: ${employeeName}`);
      return false;
    }

    const userData = usersSnapshot.docs[0].data();
    let employeePhone = userData.phone;

    if (!employeePhone) {
      console.log(`No phone number for user: ${employeeName}`);
      return false;
    }

    // Normalize phone to international format
    employeePhone = employeePhone.replace(/\D/g, '');
    if (employeePhone.startsWith('0')) {
      employeePhone = '92' + employeePhone.substring(1); // Pakistan
    }
    if (!employeePhone.startsWith('+')) {
      employeePhone = '+' + employeePhone;
    }

    // Send SMS via Twilio
    const twilio = require('twilio')(smsTwilioSid, smsTwilioToken);

    const smsMessage = await twilio.messages.create({
      body: message,
      from: smsTwilioNumber,
      to: employeePhone
    });

    console.log(`SMS sent to ${employeeName} (${employeePhone}): ${smsMessage.sid}`);
    return true;

  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

/**
 * ============================================
 * WHATSAPP GREETING HELPER - Sends auto greeting to new leads
 * ============================================
 */
async function sendWhatsAppGreeting(lead, leadId) {
  try {
    // Get integration settings
    const settingsDoc = await getCollection('app_settings').doc('integrations').get();
    const config = settingsDoc.exists ? settingsDoc.data() : {};

    // Check if auto greeting is enabled
    if (!config.autoGreetingEnabled) {
      console.log('Auto greeting disabled in settings');
      return false;
    }

    // Check if WhatsApp is configured
    if (!config.waProvider || !config.waApiKey) {
      console.log('WhatsApp not configured for auto greeting');
      return false;
    }

    // Check if lead has a phone number
    if (!lead.phone) {
      console.log(`Lead ${leadId} has no phone number for greeting`);
      return false;
    }

    // Normalize phone to international format (Pakistan)
    let phone = String(lead.phone).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    if (!phone.startsWith('92')) phone = '92' + phone;

    // Build greeting message (English)
    const clientName = lead.clientName || 'there';
    const firstName = clientName.split(' ')[0];
    const greetingMessage = config.autoGreetingMessage ||
      `Hello ${firstName}! 👋\n\nThank you for your interest in Area 51 Banquet Hall. We're excited to help you plan your special event!\n\nOne of our team members will contact you shortly. In the meantime, feel free to reply to this message if you have any questions.\n\nBest regards,\nArea 51 Team`;

    // Replace {{name}} placeholder if present
    const personalizedMessage = greetingMessage.replace(/\{\{name\}\}/gi, firstName);

    let result;

    // Send via configured provider
    switch (config.waProvider) {
      case 'twilio':
        result = await sendGreetingViaTwilio(config, phone, personalizedMessage);
        break;
      case 'wati':
        result = await sendGreetingViaWati(config, phone, personalizedMessage);
        break;
      case 'aisensy':
        result = await sendGreetingViaAisensy(config, phone, personalizedMessage);
        break;
      default:
        console.log(`Unknown WhatsApp provider: ${config.waProvider}`);
        return false;
    }

    if (result.success) {
      // Log the greeting to lead's conversation
      await getCollection('leads').doc(leadId).collection('messages').add({
        direction: 'outbound',
        to: phone,
        text: personalizedMessage,
        type: 'auto_greeting',
        provider: config.waProvider,
        messageId: result.messageId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update lead with greeting sent timestamp
      await getCollection('leads').doc(leadId).update({
        autoGreetingSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastContactedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Auto greeting sent to lead ${leadId} (${phone})`);
      return true;
    } else {
      console.error(`Failed to send greeting to ${leadId}:`, result.error);
      return false;
    }

  } catch (error) {
    console.error('Auto greeting error:', error);
    return false;
  }
}

// Twilio WhatsApp send helper
async function sendGreetingViaTwilio(config, phone, message) {
  try {
    const twilio = require('twilio')(config.waApiKey, config.waApiSecret);
    const result = await twilio.messages.create({
      from: `whatsapp:+${config.waBusinessNumber}`,
      to: `whatsapp:+${phone}`,
      body: message
    });
    return { success: true, messageId: result.sid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Wati WhatsApp send helper
async function sendGreetingViaWati(config, phone, message) {
  try {
    const response = await fetch(
      `${config.waApiEndpoint}/api/v1/sendSessionMessage/${phone}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.waApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messageText: message })
      }
    );
    const data = await response.json();
    if (data.result) {
      return { success: true, messageId: data.info?.id };
    }
    return { success: false, error: data.info || 'Wati error' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Aisensy WhatsApp send helper
async function sendGreetingViaAisensy(config, phone, message) {
  try {
    const response = await fetch(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.waApiKey,
          campaignName: 'auto_greeting',
          destination: phone,
          userName: 'Area 51 CRM',
          message: message
        })
      }
    );
    const data = await response.json();
    if (data.success) {
      return { success: true, messageId: data.messageId };
    }
    return { success: false, error: data.message || 'Aisensy error' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * ============================================
 * AUTOMATION RULES HELPER - Applies per-source automation
 * ============================================
 */
async function applyAutomationRules(leadRef, lead, leadId) {
  try {
    // Get automation rules from settings
    const automationDoc = await getCollection('app_settings').doc('automation_rules').get();
    const allRules = automationDoc.exists ? automationDoc.data() : {};

    // Get source-specific rules or default
    const sourceKey = (lead.source || '').replace(/\s+/g, '_').toLowerCase();
    const sourceRules = allRules[sourceKey] || allRules['_default'] || {
      addToCallList: true,
      sendNotification: true,
      emailResponse: false,
      textAutoResponse: false,
      aiBot: false
    };

    console.log(`Applying automation for source "${lead.source}" (key: ${sourceKey}):`, sourceRules);

    const updates = {};

    // Add to Call List - schedule call for today
    if (sourceRules.addToCallList) {
      const today = new Date().toISOString().split('T')[0];
      updates.nextCallDate = today;
      updates.nextCallTime = null; // No specific time
      console.log(`Lead ${leadId} added to call list for ${today}`);
    }

    // Send Notification is already handled in the main function
    // This flag is checked there for SMS/in-app notifications

    // Email Response (placeholder - would need email service integration)
    if (sourceRules.emailResponse && lead.email) {
      // TODO: Integrate with SendGrid/Mailgun when configured
      console.log(`Email auto-response would be sent to ${lead.email}`);
    }

    // Text Auto Response (placeholder - would need SMS outbound)
    if (sourceRules.textAutoResponse && lead.phone) {
      // TODO: Send welcome SMS via Twilio
      console.log(`SMS auto-response would be sent to ${lead.phone}`);
    }

    // AI Bot (placeholder - would need AI integration)
    if (sourceRules.aiBot) {
      updates.aiHandling = true;
      updates.aiStartedAt = admin.firestore.FieldValue.serverTimestamp();
      console.log(`Lead ${leadId} marked for AI bot handling`);
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await leadRef.update(updates);
    }

  } catch (error) {
    console.error('Automation rules error:', error);
  }
}

/**
 * ============================================
 * WHATSAPP WEBHOOK - Receives incoming/outgoing messages
 * ============================================
 * Set this URL in Wati webhook settings:
 * https://us-central1-area-51-crm.cloudfunctions.net/whatsappWebhook
 *
 * Enable these Wati webhook events:
 * - message.received (inbound from customer)
 * - message.sent (outbound from employee)
 * - message.delivered, message.read (optional status updates)
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  // Handle validation GET request
  if (req.method === 'GET') {
    return res.status(200).send('Webhook active');
  }

  try {
    const body = req.body;
    console.log('Webhook received:', JSON.stringify(body).substring(0, 500));

    let phone, message, direction, messageId, provider, senderName, messageType, mediaUrl;

    // ===== WATI FORMAT =====
    // Wati sends different event types
    if (body.eventType || body.waId || body.whatsappMessageId) {
      provider = 'wati';

      // Wati event-based format (newer API)
      if (body.eventType) {
        const eventType = body.eventType;

        if (eventType === 'message' || eventType === 'message.received') {
          // Inbound message from customer
          direction = 'inbound';
          phone = body.waId || body.from || body.senderPhone;
          message = body.text || body.message || body.messageText || '';
          messageId = body.whatsappMessageId || body.id || body.messageId;
          senderName = body.senderName || body.pushName || null;
          messageType = body.type || body.messageType || 'text';
          mediaUrl = body.mediaUrl || body.media?.url || null;
        } else if (eventType === 'message.sent' || eventType === 'sentMessage') {
          // Outbound message from employee
          direction = 'outbound';
          phone = body.waId || body.to || body.recipientPhone;
          message = body.text || body.message || body.messageText || '';
          messageId = body.whatsappMessageId || body.id || body.messageId;
          senderName = body.operatorName || body.sentBy || 'Employee';
          messageType = body.type || 'text';
          mediaUrl = body.mediaUrl || null;
        } else if (eventType === 'message.delivered' || eventType === 'message.read') {
          // Status update - just acknowledge
          console.log(`Message status update: ${eventType} for ${body.whatsappMessageId}`);
          return res.status(200).send('OK');
        } else {
          console.log(`Unhandled Wati event type: ${eventType}`);
          return res.status(200).send('OK');
        }
      } else {
        // Wati legacy format (direct fields)
        direction = body.direction || (body.owner ? 'outbound' : 'inbound');
        phone = body.waId || body.from || body.to;
        message = body.text || body.message || '';
        messageId = body.id || body.whatsappMessageId;
        senderName = body.senderName || body.operatorName || null;
        messageType = body.type || 'text';
      }
    }
    // ===== TWILIO FORMAT =====
    else if (body.From && body.From.includes('whatsapp')) {
      provider = 'twilio';
      direction = 'inbound';
      phone = body.From.replace('whatsapp:+', '');
      message = body.Body;
      messageId = body.MessageSid;
      senderName = body.ProfileName || null;
      messageType = body.MediaContentType0 ? 'media' : 'text';
      mediaUrl = body.MediaUrl0 || null;
    }
    // ===== AISENSY FORMAT =====
    else if (body.senderMobile) {
      provider = 'aisensy';
      direction = body.direction || 'inbound';
      phone = body.senderMobile || body.recipientMobile;
      message = body.message || body.text;
      messageId = body.messageId;
      messageType = 'text';
    }
    // ===== UNKNOWN FORMAT =====
    else {
      console.log('Unknown webhook format:', JSON.stringify(body));
      return res.status(200).send('Unknown format - logged');
    }

    // Skip if no phone or message
    if (!phone) {
      console.log('No phone number in webhook');
      return res.status(200).send('No phone');
    }

    // Normalize phone (Pakistan format: 923001234567 -> 03001234567)
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('92')) phone = '0' + phone.substring(2);
    if (phone.startsWith('+92')) phone = '0' + phone.substring(3);

    console.log(`WhatsApp ${direction} - ${phone}: ${message?.substring(0, 50)}`);

    // Find lead by phone number
    const leadsSnapshot = await getCollection('leads')
      .where('phone', '==', phone)
      .limit(1)
      .get();

    let leadId;
    let leadData;

    if (!leadsSnapshot.empty) {
      // Existing lead
      const leadDoc = leadsSnapshot.docs[0];
      leadId = leadDoc.id;
      leadData = leadDoc.data();
    } else if (direction === 'inbound') {
      // New lead from inbound message only
      const newLeadRef = await getCollection('leads').add({
        clientName: senderName || `WhatsApp ${phone}`,
        phone: phone,
        source: 'WhatsApp Inbound',
        stage: 'New',
        manager: 'Unassigned',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: `First message: ${message?.substring(0, 200) || 'Media message'}`
      });
      leadId = newLeadRef.id;
      leadData = { clientName: senderName || `WhatsApp ${phone}`, phone };
      console.log(`Created new lead ${leadId} from WhatsApp`);
    } else {
      // Outbound to unknown number - skip
      console.log(`Outbound to unknown number ${phone} - skipping`);
      return res.status(200).send('OK');
    }

    // Save message to lead's conversation
    const messageData = {
      direction: direction,
      phone: phone,
      text: message || '',
      type: messageType || 'text',
      provider: provider,
      messageId: messageId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: direction === 'outbound' // Outbound messages are already "read"
    };

    // Add sender info
    if (direction === 'inbound' && senderName) {
      messageData.senderName = senderName;
    }
    if (direction === 'outbound' && senderName) {
      messageData.sentBy = senderName;
    }
    if (mediaUrl) {
      messageData.mediaUrl = mediaUrl;
    }

    await getCollection('leads').doc(leadId).collection('messages').add(messageData);

    // Update lead document
    const leadUpdate = {
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessagePreview: message?.substring(0, 100) || `[${messageType}]`,
      lastMessageDirection: direction
    };

    if (direction === 'inbound') {
      leadUpdate.hasUnreadMessages = true;
    }
    if (direction === 'outbound') {
      // Track first response time
      if (!leadData.firstResponseAt) {
        leadUpdate.firstResponseAt = admin.firestore.FieldValue.serverTimestamp();
        leadUpdate.lastContactedAt = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    await getCollection('leads').doc(leadId).update(leadUpdate);

    console.log(`Message saved to lead ${leadId} (${direction})`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

/**
 * ============================================
 * META LEADS WEBHOOK - Receives Facebook/Instagram leads
 * ============================================
 * Set this URL in Meta Business settings:
 * https://us-central1-YOUR-PROJECT.cloudfunctions.net/metaLeadsWebhook
 */
exports.metaLeadsWebhook = functions.https.onRequest(async (req, res) => {
  // Facebook verification challenge
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Get verify token from settings
    const settings = await getCollection('app_settings').doc('integrations').get();
    const verifyToken = settings.data()?.metaVerifyToken || 'area51crm';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Meta webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // Handle incoming lead
  try {
    const body = req.body;

    if (body.object === 'page' && body.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id;
            const pageId = change.value.page_id;
            const formId = change.value.form_id;

            // Fetch full lead data from Meta API
            const leadData = await fetchMetaLeadData(leadgenId);

            if (leadData) {
              // Build lead document with meta campaign data
              const leadDoc = {
                clientName: leadData.name || 'Meta Lead',
                phone: leadData.phone || '',
                email: leadData.email || '',
                source: 'Meta Lead Gen',
                stage: 'New',
                manager: 'Unassigned',
                metaLeadId: leadgenId,
                metaFormId: formId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                notes: `Auto-imported from Meta.`
              };

              // Add meta campaign/ad data if available
              if (leadData.meta) {
                leadDoc.meta = leadData.meta;

                // Copy event-specific fields to top level for easy access
                if (leadData.meta.event_date) leadDoc.eventDate = leadData.meta.event_date;
                if (leadData.meta.guest_count) leadDoc.guests = parseInt(leadData.meta.guest_count) || null;
                if (leadData.meta.event_type) leadDoc.eventType = leadData.meta.event_type;
                if (leadData.meta.budget_range) leadDoc.budgetRange = leadData.meta.budget_range;
              }

              await getCollection('leads').add(leadDoc);

              console.log(`Meta lead created: ${leadData.name} (Campaign: ${leadData.meta?.campaign_name || 'Unknown'})`);
            }
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Meta webhook error:', error);
    res.status(500).send('Error');
  }
});

/**
 * Fetch lead details from Meta Graph API
 * Returns contact info + campaign/ad metadata for analytics
 */
async function fetchMetaLeadData(leadgenId) {
  try {
    const settings = await getCollection('app_settings').doc('integrations').get();
    const accessToken = settings.data()?.metaAccessToken;

    if (!accessToken) {
      console.error('Meta access token not configured');
      return null;
    }

    // Fetch lead data with campaign/ad fields
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${leadgenId}?fields=id,created_time,field_data,campaign_name,adset_name,ad_name,form_name,platform&access_token=${accessToken}`
    );
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return null;
    }

    // Parse form field data
    const fields = {};
    if (data.field_data) {
      data.field_data.forEach(f => {
        fields[f.name.toLowerCase().replace(/\s+/g, '_')] = f.values[0];
      });
    }

    // Build meta object with campaign/ad info
    const meta = {
      campaign_name: data.campaign_name || null,
      adset_name: data.adset_name || null,
      ad_name: data.ad_name || null,
      form_name: data.form_name || null,
      platform: data.platform || null,
      created_time: data.created_time || null,
      // Custom form fields (if configured in Meta lead form)
      budget_range: fields.budget_range || fields.budget || null,
      event_date: fields.event_date || fields.preferred_date || null,
      guest_count: fields.guest_count || fields.guests || fields.number_of_guests || null,
      event_type: fields.event_type || fields.function_type || null,
      city: fields.city || null,
      region: fields.state || fields.region || null
    };

    // Clean up null values
    Object.keys(meta).forEach(key => {
      if (meta[key] === null) delete meta[key];
    });

    return {
      name: fields.full_name || fields.name || '',
      phone: fields.phone_number || fields.phone || '',
      email: fields.email || '',
      meta: Object.keys(meta).length > 0 ? meta : null,
      rawFields: fields // Keep raw fields for debugging/notes
    };
  } catch (error) {
    console.error('Error fetching Meta lead:', error);
    return null;
  }
}

/**
 * ============================================
 * SCHEDULED: Stale Lead Reminders (runs every hour)
 * ============================================
 */
exports.checkStaleLeads = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const now = new Date();
  const hours24Ago = new Date(now - 24 * 60 * 60 * 1000);
  const hours48Ago = new Date(now - 48 * 60 * 60 * 1000);

  try {
    // Find stale leads (New or Contacted, no activity in 24h)
    const staleLeadsSnapshot = await getCollection('leads')
      .where('stage', 'in', ['New', 'Contacted'])
      .get();

    const reminders = [];
    const escalations = [];

    staleLeadsSnapshot.docs.forEach(doc => {
      const lead = doc.data();
      const lastContact = lead.lastContactedAt?.toDate() || lead.createdAt?.toDate();

      if (!lastContact) return;

      if (lastContact < hours48Ago && !lead.escalated) {
        escalations.push({ id: doc.id, ...lead });
      } else if (lastContact < hours24Ago && !lead.reminded) {
        reminders.push({ id: doc.id, ...lead });
      }
    });

    // Create reminder notifications
    for (const lead of reminders) {
      await getCollection('notifications').add({
        type: 'stale_lead_reminder',
        leadId: lead.id,
        leadName: lead.clientName,
        assignedTo: lead.manager,
        message: `Lead "${lead.clientName}" needs follow-up (24h+ no contact)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });

      // Mark as reminded
      await getCollection('leads').doc(lead.id).update({ reminded: true });
    }

    // Create escalation notifications (reassign or alert owner)
    for (const lead of escalations) {
      const escalationMessage = `ESCALATION: Lead "${lead.clientName}" has had no contact for 48+ hours`;
      await getCollection('notifications').add({
        type: 'stale_lead_escalation',
        leadId: lead.id,
        leadName: lead.clientName,
        assignedTo: lead.manager,
        message: escalationMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        priority: 'high'
      });

      // Send SMS for escalation
      const smsMessage = `[Area 51 CRM] URGENT!\nLead "${lead.clientName}" needs attention - 48h+ no contact.\nPlease follow up immediately.`;
      await sendSmsNotification(lead.manager, smsMessage, 'stale_lead_escalation');

      // Mark as escalated
      await getCollection('leads').doc(lead.id).update({ escalated: true });
    }

    console.log(`Stale check complete: ${reminders.length} reminders, ${escalations.length} escalations`);
    return null;
  } catch (error) {
    console.error('Stale leads check error:', error);
    return null;
  }
});

/**
 * ============================================
 * SCHEDULED: Site Visit Reminders (runs daily at 8am)
 * ============================================
 */
exports.siteVisitReminders = functions.pubsub.schedule('0 8 * * *')
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    try {
      // Find leads with site visits scheduled for tomorrow
      const visitsSnapshot = await getCollection('leads')
        .where('stage', '==', 'Site Visit Scheduled')
        .where('siteVisitDate', '==', tomorrowStr)
        .get();

      for (const doc of visitsSnapshot.docs) {
        const lead = doc.data();
        const visitMessage = `Site visit tomorrow: ${lead.clientName} at ${lead.siteVisitTime || 'TBD'}`;

        await getCollection('notifications').add({
          type: 'site_visit_reminder',
          leadId: doc.id,
          leadName: lead.clientName,
          assignedTo: lead.manager,
          message: visitMessage,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });

        // Send SMS reminder
        const smsMessage = `[Area 51 CRM] Site Visit Tomorrow!\nClient: ${lead.clientName}\nTime: ${lead.siteVisitTime || 'TBD'}\nPhone: ${lead.phone || 'N/A'}`;
        await sendSmsNotification(lead.manager, smsMessage, 'site_visit_reminder');
      }

      console.log(`Site visit reminders sent: ${visitsSnapshot.size}`);
      return null;
    } catch (error) {
      console.error('Site visit reminder error:', error);
      return null;
    }
  });

/**
 * ============================================
 * SCHEDULED: 3-Day Quote Reminder (runs daily at 9am)
 * Reminds employees about leads in "Quoted" stage for 3+ days
 * ============================================
 */
exports.checkQuotedLeads = functions.pubsub.schedule('0 9 * * *')
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    const now = new Date();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

    try {
      // Find leads in "Quoted" stage
      const quotedLeadsSnapshot = await getCollection('leads')
        .where('stage', '==', 'Quoted')
        .get();

      const staleQuotes = [];

      quotedLeadsSnapshot.docs.forEach(doc => {
        const lead = doc.data();

        // Check when the quote was sent (stageUpdatedAt) or when lead was created
        const quotedDate = lead.stageUpdatedAt
          ? new Date(lead.stageUpdatedAt)
          : lead.createdAt?.toDate();

        if (!quotedDate) return;

        // Check if quote is 3+ days old and hasn't been reminded yet
        if (quotedDate < threeDaysAgo && !lead.quoteReminderSent) {
          staleQuotes.push({ id: doc.id, ...lead, quotedDate });
        }
      });

      console.log(`Found ${staleQuotes.length} stale quotes (3+ days)`);

      // Process each stale quote
      for (const lead of staleQuotes) {
        const daysSinceQuote = Math.floor((now - lead.quotedDate) / (24 * 60 * 60 * 1000));

        // Create in-app notification for assigned employee
        const reminderMessage = `Quote follow-up needed: "${lead.clientName}" has been in Quoted stage for ${daysSinceQuote} days`;

        await getCollection('notifications').add({
          type: 'quote_follow_up',
          leadId: lead.id,
          leadName: lead.clientName,
          assignedTo: lead.manager,
          message: reminderMessage,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          daysSinceQuote: daysSinceQuote
        });

        // Send SMS reminder to assigned employee
        const smsMessage = `[Area 51 CRM] Quote Follow-up!\n${lead.clientName} received a quote ${daysSinceQuote} days ago.\nPhone: ${lead.phone || 'N/A'}\nPlease follow up to close the deal!`;
        await sendSmsNotification(lead.manager, smsMessage, 'quote_follow_up');

        // Mark lead as reminded (to avoid duplicate reminders)
        await getCollection('leads').doc(lead.id).update({
          quoteReminderSent: true,
          quoteReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Quote reminder sent for lead ${lead.id} (${daysSinceQuote} days old)`);
      }

      console.log(`Quote reminders complete: ${staleQuotes.length} reminders sent`);
      return null;
    } catch (error) {
      console.error('Quote reminder error:', error);
      return null;
    }
  });

/**
 * ============================================
 * TRIGGER: Auto-assign new leads
 * Uses configurable rules from app_settings/assignment_rules
 * ============================================
 */
exports.onNewLead = functions.firestore
  .document('artifacts/{appId}/public/data/leads/{leadId}')
  .onCreate(async (snap, context) => {
    const lead = snap.data();
    const leadId = context.params.leadId;

    // Skip if already assigned
    if (lead.manager && lead.manager !== 'Unassigned') {
      return null;
    }

    try {
      // Get assignment rules from settings
      const rulesDoc = await getCollection('app_settings').doc('assignment_rules').get();
      const rules = rulesDoc.exists ? rulesDoc.data() : { mode: 'round_robin' };

      let assignedEmployee = null;
      let assignmentMethod = 'auto';

      // MODE: Manual - don't auto-assign
      if (rules.mode === 'manual') {
        console.log(`Lead ${leadId} left unassigned (manual mode)`);
        return null;
      }

      // MODE: Single Person - all leads to one person
      if (rules.mode === 'single_person' && rules.defaultAssignee) {
        assignedEmployee = rules.defaultAssignee;
        assignmentMethod = 'single_person';
      }

      // MODE: Source-Based - check source rules
      if (rules.mode === 'source_based' && rules.sourceRules && rules.sourceRules.length > 0) {
        const leadSource = (lead.source || '').toLowerCase().trim();
        const matchingRule = rules.sourceRules.find(
          r => r.source && r.source.toLowerCase().trim() === leadSource
        );

        if (matchingRule) {
          assignedEmployee = matchingRule.assignTo;
          assignmentMethod = 'source_based';
        }
      }

      // MODE: Round Robin (default) or fallback
      if (!assignedEmployee) {
        // Check fallback setting
        if (rules.fallbackAssignee === 'unassigned') {
          console.log(`Lead ${leadId} left unassigned (fallback setting)`);
          return null;
        }

        if (rules.fallbackAssignee && rules.fallbackAssignee !== 'round_robin') {
          // Specific person as fallback
          assignedEmployee = rules.fallbackAssignee;
          assignmentMethod = 'fallback_person';
        } else {
          // Round robin
          const usersSnapshot = await getCollection('allowed_users')
            .where('role', 'in', ['Sales', 'Admin', 'Owner'])
            .get();

          const employees = usersSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(e => e.name && e.name !== 'Unassigned');

          if (employees.length === 0) {
            console.log(`Lead ${leadId} left unassigned (no employees)`);
            return null;
          }

          // Count current new leads per employee
          const leadsSnapshot = await getCollection('leads')
            .where('stage', '==', 'New')
            .get();

          const leadCounts = {};
          employees.forEach(e => leadCounts[e.name] = 0);

          leadsSnapshot.docs.forEach(d => {
            const mgr = d.data().manager;
            if (leadCounts[mgr] !== undefined) {
              leadCounts[mgr]++;
            }
          });

          // Find employee with fewest leads
          let minLeads = Infinity;
          assignedEmployee = employees[0].name;

          for (const [name, count] of Object.entries(leadCounts)) {
            if (count < minLeads) {
              minLeads = count;
              assignedEmployee = name;
            }
          }
          assignmentMethod = 'round_robin';
        }
      }

      // Assign the lead
      await snap.ref.update({
        manager: assignedEmployee,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        assignmentMethod: assignmentMethod
      });

      // Notify the employee (in-app)
      const notificationMessage = `New lead assigned: ${lead.clientName} (${lead.source || 'Unknown source'})`;
      await getCollection('notifications').add({
        type: 'lead_assigned',
        leadId: leadId,
        leadName: lead.clientName,
        assignedTo: assignedEmployee,
        message: notificationMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });

      // Send SMS notification
      const smsMessage = `[Area 51 CRM] New lead assigned to you:\n${lead.clientName}\nSource: ${lead.source || 'Unknown'}\nPhone: ${lead.phone || 'N/A'}`;
      await sendSmsNotification(assignedEmployee, smsMessage, 'lead_assigned');

      // Apply automation rules based on source
      await applyAutomationRules(snap.ref, lead, leadId);

      // Send auto WhatsApp greeting (if enabled)
      await sendWhatsAppGreeting(lead, leadId);

      console.log(`Lead ${leadId} auto-assigned to ${assignedEmployee} via ${assignmentMethod}`);
      return null;
    } catch (error) {
      console.error('Auto-assign error:', error);
      return null;
    }
  });

/**
 * ============================================
 * TRIGGER: Auto-push to invoicing when lead reaches BOOKED
 * ============================================
 */
exports.onLeadStageChange = functions.firestore
  .document('artifacts/{appId}/public/data/leads/{leadId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const leadId = context.params.leadId;

    // Check if stage changed to Booked
    if (before.stage !== 'Booked' && after.stage === 'Booked') {
      console.log(`Lead ${leadId} moved to Booked - triggering invoicing push`);

      try {
        // Get invoicing settings
        const settingsDoc = await getCollection('app_settings').doc('integrations').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};

        if (!settings.invoicingApiKey || !settings.invoicingApiEndpoint) {
          console.log('Invoicing not configured - skipping push');
          return null;
        }

        // Prepare booking data
        const bookingData = {
          clientName: after.clientName,
          phone: after.phone,
          email: after.email || '',
          eventDate: after.eventDate,
          eventType: after.eventType || 'Wedding',
          guestCount: after.guests,
          package: after.package || 'Standard',
          agreedAmount: after.amount,
          crmLeadId: leadId,
          createdAt: new Date().toISOString()
        };

        // Push to invoicing system
        const response = await fetch(`${settings.invoicingApiEndpoint}/api/bookings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.invoicingApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (response.ok) {
          // Update lead with invoicing reference
          await change.after.ref.update({
            invoicingId: data.id || data.bookingId,
            invoicingPushedAt: admin.firestore.FieldValue.serverTimestamp(),
            invoicingStatus: 'synced'
          });
          console.log(`Lead ${leadId} pushed to invoicing: ${data.id || data.bookingId}`);
        } else {
          console.error('Invoicing push failed:', data);
          await change.after.ref.update({
            invoicingStatus: 'failed',
            invoicingError: data.message || 'Push failed'
          });
        }
      } catch (error) {
        console.error('Invoicing push error:', error);
        await change.after.ref.update({
          invoicingStatus: 'error',
          invoicingError: error.message
        });
      }
    }

    // Track response time on first contact
    if (!before.firstResponseAt && after.lastContactedAt) {
      const createdAt = after.createdAt?.toDate() || new Date();
      const respondedAt = after.lastContactedAt?.toDate() || new Date();
      const responseTimeMinutes = Math.round((respondedAt - createdAt) / (1000 * 60));

      await change.after.ref.update({
        firstResponseAt: after.lastContactedAt,
        responseTimeMinutes: responseTimeMinutes
      });
      console.log(`Lead ${leadId} response time: ${responseTimeMinutes} minutes`);
    }

    return null;
  });

/**
 * ============================================
 * SCHEDULED: Sync Payment Status (runs every 6 hours)
 * Pulls payment status from invoicing system
 * ============================================
 */
exports.syncPaymentStatus = functions.pubsub.schedule('0 */6 * * *')
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    try {
      // Get invoicing settings
      const settingsDoc = await getCollection('app_settings').doc('integrations').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};

      if (!settings.invoicingApiKey || !settings.invoicingApiEndpoint) {
        console.log('Invoicing not configured - skipping sync');
        return null;
      }

      // Find all booked leads with invoicing IDs
      const bookedSnapshot = await getCollection('leads')
        .where('stage', '==', 'Booked')
        .get();

      const leadsWithInvoicing = bookedSnapshot.docs.filter(d => d.data().invoicingId);

      console.log(`Syncing payment status for ${leadsWithInvoicing.length} leads`);

      for (const leadDoc of leadsWithInvoicing) {
        const lead = leadDoc.data();

        try {
          const response = await fetch(
            `${settings.invoicingApiEndpoint}/api/bookings/${lead.invoicingId}/payments`,
            {
              headers: {
                'Authorization': `Bearer ${settings.invoicingApiKey}`
              }
            }
          );

          const data = await response.json();

          if (response.ok) {
            await leadDoc.ref.update({
              paymentStatus: data.status || 'pending',
              totalPaid: data.totalPaid || 0,
              totalDue: data.totalDue || lead.amount,
              payments: data.payments || [],
              lastPaymentSync: admin.firestore.FieldValue.serverTimestamp()
            });

            // Create notification for overdue payments
            if (data.status === 'overdue' && !lead.overdueNotified) {
              await getCollection('notifications').add({
                type: 'payment_overdue',
                leadId: leadDoc.id,
                leadName: lead.clientName,
                assignedTo: lead.manager,
                message: `Payment overdue for ${lead.clientName} - PKR ${data.totalDue?.toLocaleString() || lead.amount?.toLocaleString()}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                priority: 'high'
              });

              await leadDoc.ref.update({ overdueNotified: true });
            }
          }
        } catch (error) {
          console.error(`Payment sync failed for lead ${leadDoc.id}:`, error);
        }
      }

      console.log(`Payment sync complete: ${leadsWithInvoicing.length} leads processed`);
      return null;
    } catch (error) {
      console.error('Payment sync error:', error);
      return null;
    }
  });

/**
 * ============================================
 * AI AUDIT LOG - Logs all AI interactions
 * ============================================
 */
exports.logAIInteraction = functions.https.onCall(async (data, context) => {
  try {
    await getCollection('ai_audit_logs').add({
      userId: data.userId || 'unknown',
      userName: data.userName || 'Unknown',
      userRole: data.userRole || 'unknown',
      query: data.query,
      response: data.response?.substring(0, 500), // Truncate long responses
      queryType: data.queryType || 'general', // 'owner', 'manager', 'employee'
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      leadId: data.leadId || null,
      metadata: data.metadata || {}
    });
    return { success: true };
  } catch (error) {
    console.error('AI audit log error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * ============================================
 * INVITE USER - Creates account and sends password reset email
 * ============================================
 */
exports.inviteUser = functions.https.onCall(async (data, context) => {
  try {
    const { email, name, role } = data;

    if (!email || !name || !role) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, name, and role are required');
    }

    // Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    let userRecord;
    let isNewUser = false;

    try {
      // Try to create the user
      userRecord = await admin.auth().createUser({
        email: email,
        password: tempPassword,
        displayName: name,
        emailVerified: false
      });
      isNewUser = true;
      console.log(`Created new user: ${email} (${userRecord.uid})`);
    } catch (createError) {
      // If user already exists, get their record
      if (createError.code === 'auth/email-already-exists') {
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`User already exists: ${email} (${userRecord.uid})`);
      } else {
        throw createError;
      }
    }

    // Add to allowed_users collection
    await getCollection('allowed_users').doc(email).set({
      email,
      name,
      role,
      uid: userRecord.uid,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      inviteSent: true
    }, { merge: true });

    // Create system_users record
    await getCollection('system_users').doc(userRecord.uid).set({
      email,
      name,
      role,
      uid: userRecord.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Generate password reset link
    // This link will be returned so the frontend can trigger Firebase's built-in email
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: 'https://area-51-crm.web.app',
      handleCodeInApp: false
    });

    console.log(`Password reset link generated for ${email}`);

    return {
      success: true,
      message: `User ${name} (${email}) has been added.`,
      resetLink: resetLink,
      isNewUser: isNewUser,
      uid: userRecord.uid
    };

  } catch (error) {
    console.error('Invite user error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
