# Area 51 CRM - Claude Code Guide

## Project Overview
A CRM (Customer Relationship Management) system for Area 51 Banquet Hall built with React + Vite, Firebase (Firestore, Functions, Hosting), and Tailwind CSS. Supports Urdu/English localization.

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Firestore
- **Hosting**: Firebase Hosting
- **Icons**: Lucide React

## Architecture & Deployment Flow

```
┌─────────────┐     git push     ┌─────────────┐     auto-build     ┌─────────────────────────┐
│  Local Dev  │ ───────────────► │   GitHub    │ ─────────────────► │  Vercel (Frontend)      │
│  (VS Code)  │                  │    Repo     │                    │  area51-crm.vercel.app  │
└─────────────┘                  └─────────────┘                    └─────────────────────────┘
                                                                              │
                                                                              ▼
                                                                    ┌─────────────────────────┐
                                                                    │  Firebase (Backend)     │
                                                                    │  - Firestore (DB)       │
                                                                    │  - Functions (Webhooks) │
                                                                    └─────────────────────────┘
```

**Primary frontend:** `npm run build && firebase deploy --only hosting` → https://area-51-crm.web.app
**Backend (Functions):** `firebase deploy --only functions` (manual)
**Alternative:** Push to GitHub → Vercel auto-deploys to area51-crm.vercel.app

## Key Commands

```bash
# Development
npm run dev          # Start local dev server

# Deploy Frontend (via Vercel - preferred)
git add . && git commit -m "message" && git push   # Vercel auto-deploys

# Deploy Backend (Firebase Functions)
firebase deploy --only functions  # Deploy cloud functions only

# Alternative Frontend Deploy (Firebase Hosting)
npm run build && firebase deploy --only hosting

# Deploy Everything to Firebase
firebase deploy      # Functions + Hosting + Firestore rules

# Firebase Emulators (local testing)
firebase emulators:start
```

## Project Structure

```
src/
├── components/
│   ├── modals/           # Modal dialogs
│   │   ├── LeadDetailModal.jsx    # Lead details with stage tabs & timeline
│   │   ├── IntegrationsPanel.jsx  # Meta, WhatsApp, AI, Invoicing config
│   │   ├── AdminPanel.jsx         # User management, assignment rules
│   │   └── NewLeadModal.jsx       # Create new lead form
│   └── views/            # Main views
│       ├── EmployeeView.jsx       # Employee interface (Urdu) with AI assistant
│       ├── LeadsView.jsx          # Lead pipeline/kanban
│       ├── OwnerDashboard.jsx     # Owner analytics
│       ├── SourcesView.jsx        # Lead sources management
│       ├── FinanceView.jsx        # Payment tracking
│       └── CallListView.jsx       # Call scheduling & tracking
├── contexts/
│   └── LanguageContext.jsx  # i18n (Urdu/English)
├── hooks/
│   └── useFirestoreData.js  # Firestore CRUD operations
├── lib/
│   ├── firebase.js          # Firebase config
│   └── constants.js         # STAGES, MANAGERS, STAGE_COLORS
├── locales/
│   ├── ur.json              # Urdu translations
│   └── en.json              # English translations
├── services/
│   └── ai.js                # Gemini AI integration
├── utils/
│   └── helpers.js           # Utility functions, activity types
└── App.jsx                  # Main app with routing

functions/
└── index.js                 # Firebase Cloud Functions
    - metaLeadsWebhook       # Facebook/Meta Lead Ads webhook
    - whatsappWebhook        # WhatsApp inbound webhook
    - onNewLead              # Trigger: auto-assign leads + SMS + auto greeting
    - checkStaleLeads        # Scheduled: hourly stale lead check
    - checkQuotedLeads       # Scheduled: daily 9am quote follow-up reminders
    - siteVisitReminders     # Scheduled: daily 8am site visit alerts
    - sendSmsNotification    # Helper: Twilio SMS sender
    - sendWhatsAppGreeting   # Helper: Auto greeting via WhatsApp
```

## Firestore Collections

All data under: `artifacts/{appId}/public/data/`

| Collection | Purpose |
|------------|---------|
| `leads` | Lead records with pipeline stages |
| `leads/{id}/messages` | WhatsApp conversation history |
| `contacts` | Contact directory |
| `lead_sources` | Lead source options (includes `isIntegration` flag) |
| `allowed_users` | Authorized user emails + roles |
| `system_users` | User profiles |
| `app_settings/integrations` | API keys for Meta, WhatsApp, Gemini, SMS |
| `app_settings/assignment_rules` | Lead assignment configuration |
| `notifications` | In-app notifications for users |

## Lead Stages (Pipeline)
```javascript
const STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Site Visit Scheduled',
  'Quoted',
  'Negotiating',
  'Booked',
  'Lost'
];
```

## Activity Types
```javascript
const ACTIVITY_TYPES = {
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
```

## Integration Sources (Hard-coded)
These source names MUST match between `IntegrationsPanel.jsx` and `functions/index.js`:
- `Meta Lead Gen` - Facebook/Instagram Lead Ads
- `WhatsApp Inbound` - WhatsApp Business API

When integrations are configured, these sources are auto-created with `isIntegration: true` flag, preventing deletion.

## Key Features

### Stage Change Confirmation
When changing lead stages via the tab buttons in LeadDetailModal:
1. Shows confirmation dialog
2. Auto-logs to timeline on confirm
3. Switches to Timeline tab to show the logged change

### Collapsible AI Panel (EmployeeView)
- Desktop: Full sidebar with X button to collapse
- Collapsed: Floating button at bottom-right to expand
- Mobile: Full-screen overlay via sparkle button

### Notification System
The CRM has a multi-channel notification system:

1. **In-App Notifications (NotificationBell)**
   - Bell icon in header with unread count badge
   - Real-time updates via Firestore listener
   - Click to mark read, click notification to open related lead
   - Mark all as read, delete individual notifications

2. **Browser Push Notifications**
   - Enabled via Integrations → Alerts tab
   - Requires user permission
   - Shows for new notifications within 30 seconds

3. **SMS Notifications (Twilio)**
   - Configure in Integrations → Alerts tab
   - Requires Twilio Account SID, Auth Token, Phone Number
   - Notification types (can enable/disable each):
     - New lead assignments
     - Lead escalations (48h+ no contact)
     - Site visit reminders
     - Quote follow-up reminders (3+ days)

**Notification Types:**
| Type | Trigger | Channel |
|------|---------|---------|
| `lead_assigned` | New lead auto-assigned | In-app, SMS, Browser |
| `stale_lead_reminder` | 24h+ no contact | In-app |
| `stale_lead_escalation` | 48h+ no contact | In-app, SMS |
| `site_visit_reminder` | Day before visit | In-app, SMS |
| `quote_follow_up` | 3+ days in Quoted stage | In-app, SMS |

### Auto WhatsApp Greeting
New leads automatically receive a WhatsApp greeting message when:
- Auto greeting is enabled in Integrations → WhatsApp
- WhatsApp Business API is configured
- Lead has a valid phone number

**Configuration:**
- Enable in Integrations → WhatsApp → Auto Greeting toggle
- Customize message with `{{name}}` placeholder for personalization
- Message is sent immediately after lead assignment
- Logged in lead's conversation history and activity timeline

### Call List Feature
A dedicated view for sales staff to manage their daily calling activities:

**Categories:**
- **Overdue** - Calls past their scheduled date (red highlight)
- **Today** - Calls scheduled for today (yellow highlight)
- **Upcoming** - Future scheduled calls (green highlight)
- **Never Called** - Leads with no `nextCallDate` set

**Call Logging:**
- Quick actions: Phone call or WhatsApp
- Log call outcomes:
  - Connected - Interested (رابطہ ہوا - دلچسپی ہے)
  - Connected - Not Interested (رابطہ ہوا - دلچسپی نہیں)
  - Callback Requested (بعد میں کال کریں)
  - No Answer (جواب نہیں آیا)
  - Busy/Wrong Number
- Schedule next call date/time
- Add call notes

**Data Fields on Lead:**
- `nextCallDate` - Date of scheduled call
- `nextCallTime` - Optional time
- `lastCallDate` - When last called
- `lastCallOutcome` - Result of last call
- `lastCallNotes` - Notes from last call
- `lastCalledBy` - Who made the call

### Google Calendar Integration
Sync CRM dates with Google Calendar for better schedule management.

**Two Modes:**
1. **Quick Add Buttons** - No setup required, opens Google Calendar with pre-filled event
2. **Full API Sync** - Automatic sync when dates change (requires Google Cloud credentials)

**Configuration (Integrations → Calendar):**
- Enable Google Calendar integration toggle
- For auto-sync:
  - Add Google Cloud Client ID
  - Add Google Calendar API Key
  - Connect your Google account
  - Enable auto-sync toggle
  - Select which event types to sync

**Supported Event Types:**
| Event Type | Trigger | Calendar Title |
|------------|---------|----------------|
| Site Visits | `siteVisitDate` set/changed | 🏠 Site Visit: {clientName} |
| Scheduled Calls | `nextCallDate` set/changed | 📞 Call: {clientName} |
| Event Dates | `eventDate` set/changed | 🎉 Event: {clientName} |
| Bookings | Stage = "Booked" + `eventDate` | ✅ BOOKED: {clientName} |

**Quick Add Locations:**
- LeadDetailModal → Calendar section (shows all relevant dates)
- CallListView → Calendar icon next to each scheduled call
- Call Log Modal → "Add to Google Calendar" button

**Data Fields:**
- `calendarEventIdSiteVisit` - Google Calendar event ID for site visit
- `calendarEventIdCall` - Google Calendar event ID for call
- `calendarEventIdEvent` - Google Calendar event ID for event
- `calendarEventIdBooking` - Google Calendar event ID for booking

### Lead Automation Rules
Per-source automation settings in Admin Panel → Lead Automation Rules:

| Toggle | Description |
|--------|-------------|
| **Call List** | Auto-add new leads to today's call list (`nextCallDate`) |
| **Notify** | Send in-app + SMS notification to assigned employee |
| **Email** | Auto-send welcome email (requires email service setup) |
| **Text** | Auto-send SMS response to lead |
| **AI Bot** | Mark lead for AI bot handling |

- **DEFAULT** rules apply to all sources without specific rules
- Rules stored in `app_settings/automation_rules`
- Source key format: lowercase with underscores (e.g., `meta_lead_gen`)

### User Roles
- `admin` - Full access, can manage users
- `owner` - Dashboard + analytics access
- `employee` - Limited to assigned leads, Urdu interface

## Environment Notes
- `appId` is set in `src/lib/firebase.js`
- All sensitive keys stored in Firestore `app_settings/integrations`
- Firebase project: `area-51-crm`
- Hosting URL: https://area-51-crm.web.app

## Common Patterns

### Adding a new activity type
1. Add to `ACTIVITY_TYPES` in `utils/helpers.js`
2. Add meta (icon, color, label) in `getActivityMeta()`
3. Add formatting in `formatActivityMessage()`

### Adding a new integration source
1. Add to `INTEGRATION_SOURCES` in `IntegrationsPanel.jsx`
2. Add matching source name in `functions/index.js` webhook handler
3. Add UI fields in IntegrationsPanel for credentials

### Deploying changes

**Frontend changes:**
```bash
npm run build && firebase deploy --only hosting
```
Deploys to https://area-51-crm.web.app

**Backend/Functions changes:**
```bash
firebase deploy --only functions
```

**Deploy everything:**
```bash
npm run build && firebase deploy
```

**Don't forget to commit:**
```bash
git add . && git commit -m "description" && git push
```
