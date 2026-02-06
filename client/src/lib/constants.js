export const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

// Lead Pipeline Stages per spec
export const STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Site Visit Scheduled',
  'Quoted',
  'Negotiating',
  'Booked',
  'Lost'
];

// Stage colors for visual distinction
export const STAGE_COLORS = {
  'New': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'Contacted': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  'Qualified': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  'Site Visit Scheduled': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'Quoted': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  'Negotiating': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  'Booked': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  'Lost': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
};

// Auto-triggers per stage
export const STAGE_TRIGGERS = {
  'New': 'AI sends greeting, assigns employee',
  'Contacted': 'Timer starts for follow-up',
  'Site Visit Scheduled': 'Reminder to employee day before',
  'Quoted': 'Follow-up reminder if no response in 3 days',
  'Booked': 'Push to invoicing software'
};

export const MANAGERS = ['Rafaqat Ali', 'Zia un Nabi', 'Hassan Rizvi', 'Khizar', 'Unassigned'];

export const ROLES = ['Admin', 'Owner', 'Sales', 'Finance'];

export const MASTER_EMAIL = "nadirbutt87@gmail.com";

// Stale lead thresholds (in hours)
export const STALE_THRESHOLDS = {
  REMINDER: 24,    // Remind employee after 24 hours
  ESCALATE: 48     // Escalate/reassign after 48 hours
};

// WhatsApp message templates
export const WA_TEMPLATES = {
  // English templates
  GREETING_ENGLISH: (venueName, employeeName) =>
    `Hello! Thank you for your interest in ${venueName}. Our representative ${employeeName} will contact you shortly.\n\n📋 Conversations are recorded for quality purposes.`,
  GREETING_ENGLISH_SHORT: (venueName, employeeName) =>
    `Hi! Thanks for contacting ${venueName}. ${employeeName} will reach out soon. 📋 Calls recorded for quality.`,
  // Urdu templates
  GREETING_URDU: (venueName, employeeName) =>
    `Assalam o Alaikum! ${venueName} mein inquiry ka shukriya. Hamara representative ${employeeName} aap se jaldi rabta karega. Shukriya!\n\n📋 Is number pe baat cheet service quality ke liye record ki jati hai.`,
  GREETING_URDU_SHORT: (venueName, employeeName) =>
    `Assalam o Alaikum! ${venueName} se. ${employeeName} jaldi aap se rabta karega. 📋 Baat cheet record ki jati hai.`,
  // Internal notifications
  LEAD_ASSIGNED_URDU: (clientName, eventDate, guestCount) =>
    `Naya lead assign hua: ${clientName}, ${eventDate || 'Date pending'}, ${guestCount || 'Guests TBD'}`,
  LEAD_ASSIGNED_ENGLISH: (clientName, eventDate, guestCount) =>
    `New lead assigned: ${clientName}, ${eventDate || 'Date pending'}, ${guestCount || 'Guests TBD'}`
};

// Venue info
export const VENUE = {
  name: 'Area 51 Banquet Hall',
  whatsappNumber: '' // Will be set from integrations
};

// Available venues
export const VENUES = [
  { id: 'marquee', name: 'Marquee', label: 'Area 51 Marquee' },
  { id: 'banquet', name: 'Banquet', label: 'Area 51 Banquet Hall' }
];

// Payment milestones
export const PAYMENT_MILESTONES = ['Advance', 'Mid-payment', 'Final payment'];

// Event types
export const EVENT_TYPES = [
  'Wedding',
  'Mehndi',
  'Engagement',
  'Birthday',
  'Corporate Event',
  'Other'
];
