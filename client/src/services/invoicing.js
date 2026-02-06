/**
 * Invoicing Software Integration Service
 * Handles pushing bookings and pulling payment status
 */

import { db, appId } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PAYMENT_MILESTONES } from '../lib/constants';

/**
 * Get invoicing config from Firestore
 */
export async function getInvoicingConfig() {
  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

/**
 * Push booking to invoicing software when lead reaches BOOKED stage
 * @param {Object} lead - Lead data
 */
export async function pushBookingToInvoicing(lead) {
  const config = await getInvoicingConfig();

  if (!config?.invoicingApiKey || !config?.invoicingApiEndpoint) {
    console.warn('Invoicing not configured');
    return { success: false, error: 'Invoicing not configured' };
  }

  try {
    const bookingData = {
      clientName: lead.clientName,
      phone: lead.phone,
      email: lead.email || '',
      eventDate: lead.eventDate,
      eventType: lead.eventType,
      guestCount: lead.guests,
      package: lead.package || 'Standard',
      agreedAmount: lead.amount,
      crmLeadId: lead.id,
      createdAt: new Date().toISOString()
    };

    const response = await fetch(`${config.invoicingApiEndpoint}/api/bookings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.invoicingApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });

    const data = await response.json();

    if (response.ok) {
      // Update lead with invoicing reference
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id),
        {
          invoicingId: data.id || data.bookingId,
          invoicingPushedAt: serverTimestamp()
        }
      );

      return { success: true, invoicingId: data.id };
    } else {
      throw new Error(data.message || 'Failed to push booking');
    }
  } catch (error) {
    console.error('Invoicing push error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Pull payment status from invoicing software
 * @param {string} invoicingId - Invoicing system booking ID
 */
export async function getPaymentStatus(invoicingId) {
  const config = await getInvoicingConfig();

  if (!config?.invoicingApiKey || !config?.invoicingApiEndpoint) {
    return { success: false, error: 'Invoicing not configured' };
  }

  try {
    const response = await fetch(
      `${config.invoicingApiEndpoint}/api/bookings/${invoicingId}/payments`,
      {
        headers: {
          'Authorization': `Bearer ${config.invoicingApiKey}`
        }
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        payments: data.payments || [],
        totalPaid: data.totalPaid || 0,
        totalDue: data.totalDue || 0,
        status: data.status // 'pending', 'partial', 'paid', 'overdue'
      };
    } else {
      throw new Error(data.message || 'Failed to fetch payments');
    }
  } catch (error) {
    console.error('Payment status error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync payment status for all booked leads
 */
export async function syncAllPaymentStatuses(leads) {
  const bookedLeads = leads.filter(
    (l) => l.stage === 'Booked' && l.invoicingId
  );

  const results = [];

  for (const lead of bookedLeads) {
    const status = await getPaymentStatus(lead.invoicingId);
    if (status.success) {
      // Update lead with payment info
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id),
        {
          paymentStatus: status.status,
          totalPaid: status.totalPaid,
          totalDue: status.totalDue,
          lastPaymentSync: serverTimestamp()
        }
      );

      results.push({ leadId: lead.id, ...status });
    }
  }

  return results;
}

/**
 * Get overdue payments
 */
export async function getOverduePayments(leads) {
  const overdueLeads = leads.filter(
    (l) =>
      l.stage === 'Booked' &&
      l.paymentStatus === 'overdue'
  );

  return overdueLeads.map((l) => ({
    id: l.id,
    clientName: l.clientName,
    eventDate: l.eventDate,
    totalDue: l.totalDue,
    totalPaid: l.totalPaid,
    manager: l.manager
  }));
}

/**
 * Calculate payment milestones for a booking
 */
export function calculatePaymentMilestones(totalAmount) {
  return {
    advance: {
      name: PAYMENT_MILESTONES[0],
      amount: Math.round(totalAmount * 0.3), // 30%
      dueDate: 'On booking'
    },
    midPayment: {
      name: PAYMENT_MILESTONES[1],
      amount: Math.round(totalAmount * 0.4), // 40%
      dueDate: '1 week before event'
    },
    finalPayment: {
      name: PAYMENT_MILESTONES[2],
      amount: Math.round(totalAmount * 0.3), // 30%
      dueDate: 'On event day'
    }
  };
}
