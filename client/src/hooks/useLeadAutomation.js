import { useEffect, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { STALE_THRESHOLDS, STAGE_TRIGGERS } from '../lib/constants';
import { assignLeadToEmployee, generateFirstGreeting, checkStaleLeads } from '../services/ai';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { pushBookingToInvoicing } from '../services/invoicing';

/**
 * Hook to handle automatic lead processing
 * - Auto-greeting for new leads
 * - Lead assignment
 * - Stale lead detection
 * - Stage change triggers
 */
export function useLeadAutomation(leads, activeUser, setToast) {
  // Process new leads - send greeting and assign
  const processNewLead = useCallback(async (lead) => {
    if (lead.processed || lead.manager !== 'Unassigned') return;

    try {
      // Assign lead to employee
      const { employee, method } = await assignLeadToEmployee(lead);

      // Generate and send greeting
      const greeting = await generateFirstGreeting(lead, employee);

      // Send WhatsApp message (if configured)
      if (lead.phone) {
        await sendWhatsAppMessage(lead.phone, greeting, lead.id);
      }

      // Update lead with assignment and mark as processed
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id), {
        manager: employee,
        assignedAt: serverTimestamp(),
        assignmentMethod: method,
        processed: true,
        stage: 'Contacted', // Auto-move to Contacted after greeting
        greetingSentAt: serverTimestamp()
      });

      // Log the action
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id, 'activity'),
        {
          type: 'auto_assignment',
          employee,
          method,
          timestamp: serverTimestamp(),
          message: `Lead auto-assigned to ${employee} (${method})`
        }
      );

      console.log(`Lead ${lead.id} assigned to ${employee}`);
    } catch (error) {
      console.error('Error processing new lead:', error);
    }
  }, []);

  // Check for new unprocessed leads
  useEffect(() => {
    if (!leads || leads.length === 0) return;

    const newLeads = leads.filter(
      (l) => l.stage === 'New' && !l.processed && l.manager === 'Unassigned'
    );

    // Process new leads (with delay to avoid rapid-fire)
    newLeads.forEach((lead, index) => {
      setTimeout(() => processNewLead(lead), index * 2000);
    });
  }, [leads, processNewLead]);

  // Check for stale leads periodically
  useEffect(() => {
    const checkStale = async () => {
      const stale = await checkStaleLeads();

      // Send reminders for 24h+ stale leads
      for (const lead of stale.needsReminder) {
        if (!lead.reminderSent) {
          await addDoc(
            collection(db, 'artifacts', appId, 'public', 'data', 'notifications'),
            {
              type: 'stale_lead_reminder',
              leadId: lead.id,
              leadName: lead.clientName,
              assignedTo: lead.manager,
              message: `Lead "${lead.clientName}" has had no contact in 24+ hours`,
              timestamp: serverTimestamp(),
              read: false
            }
          );

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id), {
            reminderSent: true,
            reminderSentAt: serverTimestamp()
          });
        }
      }

      // Escalate 48h+ stale leads
      for (const lead of stale.needsEscalation) {
        if (!lead.escalated) {
          await addDoc(
            collection(db, 'artifacts', appId, 'public', 'data', 'notifications'),
            {
              type: 'stale_lead_escalation',
              leadId: lead.id,
              leadName: lead.clientName,
              assignedTo: lead.manager,
              message: `ESCALATION: Lead "${lead.clientName}" has had no contact in 48+ hours`,
              timestamp: serverTimestamp(),
              read: false,
              priority: 'high'
            }
          );

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id), {
            escalated: true,
            escalatedAt: serverTimestamp()
          });
        }
      }

      if (stale.needsReminder.length > 0 || stale.needsEscalation.length > 0) {
        setToast?.({
          message: `${stale.needsReminder.length} leads need follow-up, ${stale.needsEscalation.length} escalated`,
          type: 'warning'
        });
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkStale, 5 * 60 * 1000);
    // Also check on mount
    checkStale();

    return () => clearInterval(interval);
  }, [setToast]);

  return { processNewLead };
}

/**
 * Hook to handle stage change triggers
 */
export function useStageChangeTriggers(setToast) {
  const handleStageChange = useCallback(
    async (leadId, lead, oldStage, newStage) => {
      try {
        const updates = {
          stage: newStage,
          stageHistory: [
            ...(lead.stageHistory || []),
            {
              from: oldStage,
              to: newStage,
              timestamp: new Date().toISOString(),
              trigger: STAGE_TRIGGERS[newStage] || 'manual'
            }
          ]
        };

        // Stage-specific triggers
        switch (newStage) {
          case 'Contacted':
            // Start follow-up timer
            updates.followUpDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            break;

          case 'Site Visit Scheduled':
            // Set reminder for day before
            if (lead.eventDate) {
              const eventDate = new Date(lead.eventDate);
              const reminderDate = new Date(eventDate);
              reminderDate.setDate(reminderDate.getDate() - 1);
              updates.siteVisitReminder = reminderDate.toISOString();
            }
            break;

          case 'Quoted':
            // Set 3-day follow-up reminder
            updates.quoteFollowUpDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            break;

          case 'Booked':
            // Push to invoicing software
            const invoiceResult = await pushBookingToInvoicing({ id: leadId, ...lead });
            if (invoiceResult.success) {
              updates.invoicingId = invoiceResult.invoicingId;
              setToast?.({ message: 'Booking pushed to invoicing', type: 'success' });
            }
            break;

          case 'Lost':
            // Log loss reason
            updates.lostAt = serverTimestamp();
            break;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', leadId), updates);

        // Log activity
        await addDoc(
          collection(db, 'artifacts', appId, 'public', 'data', 'leads', leadId, 'activity'),
          {
            type: 'stage_change',
            from: oldStage,
            to: newStage,
            timestamp: serverTimestamp(),
            trigger: STAGE_TRIGGERS[newStage]
          }
        );
      } catch (error) {
        console.error('Stage change trigger error:', error);
      }
    },
    [setToast]
  );

  return { handleStageChange };
}

/**
 * Hook for site visit reminders
 */
export function useSiteVisitReminders(leads, setToast) {
  useEffect(() => {
    if (!leads) return;

    const checkReminders = () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const upcomingSiteVisits = leads.filter(
        (l) =>
          l.stage === 'Site Visit Scheduled' &&
          l.eventDate &&
          (l.eventDate === today || l.eventDate === tomorrow) &&
          !l.siteVisitReminderSent
      );

      upcomingSiteVisits.forEach(async (lead) => {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
          type: 'site_visit_reminder',
          leadId: lead.id,
          leadName: lead.clientName,
          assignedTo: lead.manager,
          eventDate: lead.eventDate,
          message: `Site visit for "${lead.clientName}" is ${lead.eventDate === today ? 'TODAY' : 'TOMORROW'}!`,
          timestamp: serverTimestamp(),
          read: false,
          priority: lead.eventDate === today ? 'urgent' : 'high'
        });

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id), {
          siteVisitReminderSent: true
        });
      });

      if (upcomingSiteVisits.length > 0) {
        setToast?.({
          message: `${upcomingSiteVisits.length} site visit(s) coming up!`,
          type: 'info'
        });
      }
    };

    // Check every hour
    const interval = setInterval(checkReminders, 60 * 60 * 1000);
    checkReminders();

    return () => clearInterval(interval);
  }, [leads, setToast]);
}
