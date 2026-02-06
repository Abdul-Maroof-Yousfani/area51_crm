# Area 51 CRM - Technical Documentation

## Overview

Wedding venue CRM with WhatsApp integration, AI-assisted communication, and automated lead management.

**Live URL:** https://area51-crm.vercel.app
**GitHub:** https://github.com/NadirButt/Area51CRM

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│                    (Vercel - React/Vite)                    │
│                  area51-crm.vercel.app                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE (Google Cloud)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Firestore  │  │    Auth     │  │  Cloud Functions    │  │
│  │  (Database) │  │   (Login)   │  │  (Backend/Webhooks) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Twilio  │   │   Meta   │   │  Gemini  │
    │ WhatsApp │   │  Leads   │   │    AI    │
    └──────────┘   └──────────┘   └──────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Database | Cloud Firestore |
| Auth | Firebase Authentication |
| Hosting | Vercel (frontend), Firebase (functions) |
| Charts | Recharts |
| Icons | Lucide React |

---

## Project Structure

```
D:\Work\CRM\
├── src/
│   ├── components/
│   │   ├── modals/           # Modal dialogs
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── IntegrationsPanel.jsx
│   │   │   ├── LeadDetailModal.jsx
│   │   │   ├── NewLeadModal.jsx
│   │   │   └── ...
│   │   ├── ui/               # Reusable UI components
│   │   │   ├── AuthScreen.jsx
│   │   │   ├── RoleSidebar.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── ...
│   │   └── views/            # Main page views
│   │       ├── OwnerDashboard.jsx
│   │       ├── EmployeeView.jsx
│   │       ├── FinanceView.jsx
│   │       ├── LeadsView.jsx
│   │       └── ...
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useFirestoreData.js
│   │   └── ...
│   ├── services/             # External API integrations
│   │   ├── whatsapp.js
│   │   ├── ai.js
│   │   └── invoicing.js
│   ├── lib/
│   │   ├── firebase.js       # Firebase config
│   │   └── constants.js      # App constants
│   ├── utils/                # Helper functions
│   └── App.jsx               # Main app component
├── functions/                # Firebase Cloud Functions
│   ├── index.js              # All cloud functions
│   └── package.json
├── firebase.json             # Firebase config
├── vercel.json               # Vercel config
└── package.json
```

---

## Firebase Collections

All data stored under: `artifacts/{appId}/public/data/`

| Collection | Purpose |
|------------|---------|
| `leads` | Lead records with pipeline stages |
| `leads/{id}/messages` | WhatsApp conversation history |
| `contacts` | Contact directory |
| `lead_sources` | Lead source options |
| `allowed_users` | Authorized user emails + roles |
| `system_users` | User profiles (created on registration) |
| `app_settings` | App configuration |
| `notifications` | System notifications |

### Lead Document Schema

```javascript
{
  clientName: "Ahmed Khan",
  phone: "03001234567",
  email: "ahmed@example.com",
  source: "Meta Lead Gen",
  stage: "Contacted",           // Pipeline stage
  manager: "Zia un Nabi",       // Assigned employee
  eventType: "Wedding",
  eventDate: "2025-03-15",
  amount: 500000,               // Budget in PKR
  notes: "Interested in outdoor setup",
  createdAt: Timestamp,
  lastContactedAt: Timestamp,
  assignmentMethod: "round_robin"
}
```

### Lead Pipeline Stages

```
New → Contacted → Qualified → Site Visit Scheduled → Quoted → Negotiating → Booked → Lost
```

---

## Cloud Functions

Deployed to: `us-central1-area-51-crm.cloudfunctions.net`

| Function | Trigger | Description |
|----------|---------|-------------|
| `whatsappWebhook` | HTTP POST | Receives WhatsApp messages, saves to lead conversation |
| `metaLeadsWebhook` | HTTP POST | Receives Facebook/Instagram leads |
| `checkStaleLeads` | Scheduled (hourly) | Creates notifications for leads with no contact >24h |
| `siteVisitReminders` | Scheduled (daily 8am PKT) | Reminds employees of tomorrow's site visits |
| `onNewLead` | Firestore onCreate | Auto-assigns leads based on configured rules |

### Webhook URLs

```
WhatsApp: https://us-central1-area-51-crm.cloudfunctions.net/whatsappWebhook
Meta:     https://us-central1-area-51-crm.cloudfunctions.net/metaLeadsWebhook
```

---

## User Roles & Permissions

| Role | Access |
|------|--------|
| **Owner** | Full access: Dashboard, All Leads, Finance, Admin, Integrations |
| **Admin** | Same as Owner |
| **Sales** | Employee View (Urdu), My Leads, Contacts |
| **Finance** | Finance View only |

---

## Lead Assignment Rules

Configured via Admin Panel → Lead Assignment Rules

| Mode | Behavior |
|------|----------|
| **Round Robin** | Evenly distributes to all sales staff |
| **Source-Based** | Maps sources to specific employees |
| **Single Person** | All leads to one person |
| **Manual Only** | No auto-assignment |

Settings stored in: `app_settings/assignment_rules`

```javascript
{
  mode: "source_based",
  sourceRules: [
    { source: "Meta Lead Gen", assignTo: "Zia un Nabi" },
    { source: "Walk-in", assignTo: "Hassan Rizvi" }
  ],
  fallbackAssignee: "round_robin"
}
```

---

## Integrations Configuration

Stored in: `app_settings/integrations`

### WhatsApp (Twilio/Wati/Aisensy)

```javascript
{
  waProvider: "twilio",           // twilio | wati | aisensy
  waApiKey: "ACCOUNT_SID",
  waApiSecret: "AUTH_TOKEN",
  waBusinessNumber: "923001234567"
}
```

### Meta Leads

```javascript
{
  metaAccessToken: "EAAxxxxxxx",
  metaVerifyToken: "area51crm",
  metaPageId: "123456789"
}
```

### AI (Gemini)

```javascript
{
  geminiApiKey: "AIzaxxxxxxx"
}
```

---

## Development

### Local Setup

```bash
# Clone
git clone https://github.com/NadirButt/Area51CRM.git
cd Area51CRM

# Install dependencies
npm install
cd functions && npm install && cd ..

# Run locally
npm run dev                    # Frontend on localhost:3000

# Deploy functions
firebase login
firebase use area-51-crm
firebase deploy --only functions
```

### Environment

- Node.js 20+ (local)
- Firebase CLI (`npm install -g firebase-tools`)

### Build

```bash
npm run build                  # Creates dist/ folder
```

---

## Deployment

### Frontend (Vercel)

Auto-deploys on push to `main` branch.

Manual: Push to GitHub → Vercel auto-builds

### Cloud Functions (Firebase)

```bash
cd D:\Work\CRM
firebase deploy --only functions
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/firebase.js` | Firebase initialization & config |
| `src/lib/constants.js` | Stages, managers, colors, templates |
| `src/hooks/useAuth.js` | Authentication logic |
| `src/hooks/useFirestoreData.js` | Data fetching & mutations |
| `src/components/modals/AdminPanel.jsx` | User management, assignment rules |
| `src/components/modals/IntegrationsPanel.jsx` | API configuration |
| `src/components/views/OwnerDashboard.jsx` | Main analytics dashboard |
| `src/components/views/EmployeeView.jsx` | Sales team interface (Urdu) |
| `functions/index.js` | All Cloud Functions |

---

## Common Tasks

### Add a New User

1. Admin Panel → Invite Team Member
2. Enter name, email, role
3. User registers at the site with that email
4. System creates their profile

### Change Assignment Rules

1. Admin Panel → Lead Assignment Rules
2. Select mode (Round Robin / Source-Based / etc)
3. Configure rules
4. Save

### Configure WhatsApp

1. Integrations → WhatsApp tab
2. Select provider (Twilio/Wati/Aisensy)
3. Enter API credentials
4. Set webhook URL in provider dashboard:
   `https://us-central1-area-51-crm.cloudfunctions.net/whatsappWebhook`

### View Logs

```bash
firebase functions:log
```

---

## Troubleshooting

### "Permission Denied" errors
- Check user is in `allowed_users` collection
- Verify role has access to that view

### WhatsApp messages not appearing
- Check webhook URL is set in Twilio/Wati dashboard
- Check `firebase functions:log` for errors
- Verify phone number format matches

### Auto-assignment not working
- Check `app_settings/assignment_rules` exists
- Verify employees are in `allowed_users` with Sales/Admin role
- Check function logs: `firebase functions:log --only onNewLead`

---

## Contact

Project Owner: Nadir Butt
GitHub: https://github.com/NadirButt/Area51CRM
