/**
 * Checks if a lead stage indicates a won/booked deal
 */
export const isWonStage = (stage) => {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s === 'booked' || s === 'won' || s.includes('confirm') || s.includes('book');
};

/**
 * Safely converts a value to a number for amounts
 */
export const safeAmount = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

/**
 * Normalizes Pakistani phone numbers to 03XXXXXXXXX format
 */
export const normalizePakPhone = (input) => {
  if (!input) return null;
  let clean = String(input).replace(/\D/g, '');
  if (clean.startsWith('92') && clean.length === 12) clean = '0' + clean.substring(2);
  if (clean.startsWith('0092') && clean.length === 14) clean = '0' + clean.substring(4);
  if (clean.length === 10 && clean.startsWith('3')) clean = '0' + clean;
  if (clean.length === 11 && clean.startsWith('03')) return clean;
  return null;
};

/**
 * Formats a number as Pakistani Rupees
 */
export const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumSignificantDigits: 3
  }).format(safeAmount(val));
};

/**
 * Generates a WhatsApp link for a phone number
 */
export const getWhatsappLink = (phone, message = '') => {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '92' + clean.substring(1);
  else if (clean.length === 10 && clean.startsWith('3')) clean = '92' + clean;
  const baseUrl = `https://wa.me/${clean}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
};

/**
 * Determines lead stage based on status and notes
 */
export const determineStage = (status, notes, amount) => {
  const n = (notes || '').toLowerCase();
  const s = (status || '').toLowerCase();
  const combined = s + ' ' + n;

  if (combined.includes('lost') || combined.includes('booked other') || combined.includes('cancel')) return 'Lost';
  if (s.includes('won') || s.includes('book') || s.includes('confirm')) return 'Won';
  if (n.includes('advance') || n.includes('deposit') || n.includes('closed')) return 'Won';
  if (combined.includes('visit') || combined.includes('meeting')) return 'Negotiation';
  if (combined.includes('budget') || combined.includes('quote')) return 'Proposal';
  return 'New Lead';
};

/**
 * Determines manager name from partial match
 */
export const determineManager = (manager) => {
  if (!manager) return 'Unassigned';
  const m = String(manager).toLowerCase();
  if (m.includes('zia')) return 'Zia un Nabi';
  if (m.includes('rafaqat')) return 'Rafaqat Ali';
  if (m.includes('hassan')) return 'Hassan Rizvi';
  if (m.includes('khizar')) return 'Khizar';
  return manager;
};

/**
 * Activity Log Types
 */
export const ACTIVITY_TYPES = {
  STAGE_CHANGE: 'stage_change',
  NOTE_ADDED: 'note_added',
  WHATSAPP_OPENED: 'whatsapp_opened',
  CALL_MADE: 'call_made',
  CALL_LOGGED: 'call_logged',
  LEAD_ASSIGNED: 'lead_assigned',
  LEAD_REASSIGNED: 'lead_reassigned',
  FOLLOW_UP_SET: 'follow_up_set',
  SITE_VISIT_SCHEDULED: 'site_visit_scheduled',
  PAYMENT_RECEIVED: 'payment_received',
  LEAD_CREATED: 'lead_created',
  DETAILS_UPDATED: 'details_updated',
  AUTO_GREETING_SENT: 'auto_greeting_sent',
  QUOTE_REMINDER_SENT: 'quote_reminder_sent'
};

/**
 * Creates an activity log entry
 */
export const createActivityEntry = (type, data, userName) => {
  return {
    type,
    timestamp: new Date().toISOString(),
    user: userName,
    ...data
  };
};

/**
 * Gets icon and color for activity type
 */
export const getActivityMeta = (type) => {
  const meta = {
    [ACTIVITY_TYPES.STAGE_CHANGE]: { icon: '📊', color: 'blue', label: 'Stage Changed' },
    [ACTIVITY_TYPES.NOTE_ADDED]: { icon: '📝', color: 'gray', label: 'Note Added' },
    [ACTIVITY_TYPES.WHATSAPP_OPENED]: { icon: '💬', color: 'green', label: 'WhatsApp' },
    [ACTIVITY_TYPES.CALL_MADE]: { icon: '📞', color: 'purple', label: 'Call Made' },
    [ACTIVITY_TYPES.CALL_LOGGED]: { icon: '📱', color: 'cyan', label: 'Call Logged' },
    [ACTIVITY_TYPES.LEAD_ASSIGNED]: { icon: '👤', color: 'indigo', label: 'Assigned' },
    [ACTIVITY_TYPES.LEAD_REASSIGNED]: { icon: '🔄', color: 'orange', label: 'Reassigned' },
    [ACTIVITY_TYPES.FOLLOW_UP_SET]: { icon: '🗓️', color: 'amber', label: 'Follow-up Set' },
    [ACTIVITY_TYPES.SITE_VISIT_SCHEDULED]: { icon: '🏠', color: 'teal', label: 'Site Visit' },
    [ACTIVITY_TYPES.PAYMENT_RECEIVED]: { icon: '💰', color: 'emerald', label: 'Payment' },
    [ACTIVITY_TYPES.LEAD_CREATED]: { icon: '✨', color: 'blue', label: 'Lead Created' },
    [ACTIVITY_TYPES.DETAILS_UPDATED]: { icon: '✏️', color: 'slate', label: 'Updated' },
    [ACTIVITY_TYPES.AUTO_GREETING_SENT]: { icon: '🤖', color: 'green', label: 'Auto Greeting' },
    [ACTIVITY_TYPES.QUOTE_REMINDER_SENT]: { icon: '⏰', color: 'amber', label: 'Quote Reminder' }
  };
  return meta[type] || { icon: '📌', color: 'gray', label: 'Activity' };
};

/**
 * Formats activity for display
 */
export const formatActivityMessage = (activity) => {
  switch (activity.type) {
    case ACTIVITY_TYPES.STAGE_CHANGE:
      return `Stage changed: ${activity.from} → ${activity.to}`;
    case ACTIVITY_TYPES.NOTE_ADDED:
      return activity.note || 'Note added';
    case ACTIVITY_TYPES.WHATSAPP_OPENED:
      return 'WhatsApp conversation opened';
    case ACTIVITY_TYPES.CALL_MADE:
      return 'Phone call made';
    case ACTIVITY_TYPES.CALL_LOGGED:
      return activity.outcome ? `Call logged: ${activity.outcome}` : 'Call logged';
    case ACTIVITY_TYPES.LEAD_ASSIGNED:
      return `Lead assigned to ${activity.assignee}`;
    case ACTIVITY_TYPES.LEAD_REASSIGNED:
      return `Reassigned from ${activity.from} to ${activity.to}`;
    case ACTIVITY_TYPES.FOLLOW_UP_SET:
      return `Follow-up scheduled for ${activity.date}`;
    case ACTIVITY_TYPES.SITE_VISIT_SCHEDULED:
      return `Site visit scheduled for ${activity.date}`;
    case ACTIVITY_TYPES.PAYMENT_RECEIVED:
      return `Payment received: ${formatCurrency(activity.amount)}`;
    case ACTIVITY_TYPES.LEAD_CREATED:
      return 'Lead created';
    case ACTIVITY_TYPES.DETAILS_UPDATED:
      return `${activity.field} updated`;
    case ACTIVITY_TYPES.AUTO_GREETING_SENT:
      return 'Auto greeting sent via WhatsApp';
    case ACTIVITY_TYPES.QUOTE_REMINDER_SENT:
      return 'Quote follow-up reminder sent';
    default:
      return 'Activity logged';
  }
};
