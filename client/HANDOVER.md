# Area 51 CRM - Project Handover Guide

## Quick Start (5 minutes)

```bash
# 1. Clone the repo
git clone <repo-url>
cd CRM

# 2. Install dependencies
npm install
cd functions && npm install && cd ..

# 3. Login to Firebase
firebase login

# 4. Start development
npm run dev
```

---

## Project Overview

**What is this?**
A CRM (Customer Relationship Management) system for Area 51 Banquet Hall. Built for managing wedding/event inquiries from Facebook Lead Ads and WhatsApp.

**Tech Stack:**
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Firebase Functions (Node.js 20)
- Database: Firestore
- Hosting: Firebase Hosting OR Vercel

---

## Deployment Options

### Option A: Use Existing Firebase Project (Recommended)
The project is already configured for `area-51-crm` Firebase project.

```bash
# Deploy frontend only
npm run build && firebase deploy --only hosting

# Deploy backend (Cloud Functions) only
firebase deploy --only functions

# Deploy everything
npm run build && firebase deploy
```

**Live URLs:**
- Firebase: https://area-51-crm.web.app
- Vercel: https://area51-crm.vercel.app (auto-deploys on git push)

### Option B: Set Up Your Own Firebase Project

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Firestore, Functions, Hosting

2. **Update Firebase Config**

   Edit `src/lib/firebase.js`:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   export const appId = 'your_app_id'; // Used for Firestore paths
   ```

3. **Update Functions Config**

   Edit `functions/index.js` line 13:
   ```javascript
   const APP_ID = 'your_app_id';
   ```

4. **Initialize Firebase in project folder**
   ```bash
   firebase init
   # Select: Firestore, Functions, Hosting
   # Use existing project or create new
   ```

5. **Deploy**
   ```bash
   npm run build && firebase deploy
   ```

---

## Configuration After Deployment

### 1. Create First Admin User

In Firebase Console → Firestore → Create document:

**Path:** `artifacts/{appId}/public/data/allowed_users/{auto-id}`

```json
{
  "email": "admin@yourcompany.com",
  "name": "Admin Name",
  "role": "Admin",
  "phone": "03001234567"
}
```

### 2. Configure Integrations (In-App)

Login to CRM → Settings (gear icon) → Integrations

| Tab | What to Configure |
|-----|-------------------|
| **Meta Leads** | Facebook Page ID, Access Token |
| **WhatsApp** | Provider (Twilio/Wati/Aisensy), API keys, Business number |
| **AI (Gemini)** | Google Gemini API key |
| **Alerts** | Twilio SMS credentials for notifications |

### 3. Set Up Webhooks

**Meta Lead Ads Webhook:**
```
https://us-central1-YOUR-PROJECT.cloudfunctions.net/metaLeadsWebhook
```
Configure in Meta Business Suite → Lead Ads → Webhook URL

**WhatsApp Webhook:**
```
https://us-central1-YOUR-PROJECT.cloudfunctions.net/whatsappWebhook
```
Configure in your WhatsApp provider (Twilio/Wati/Aisensy)

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app, routing, state management |
| `src/lib/firebase.js` | Firebase config (CHANGE THIS for new project) |
| `src/lib/constants.js` | Stages, managers, colors |
| `functions/index.js` | All Cloud Functions (webhooks, scheduled tasks) |
| `CLAUDE.md` | Full technical documentation |

---

## Environment & Secrets

**No .env file needed!** All secrets are stored in Firestore:

**Path:** `artifacts/{appId}/public/data/app_settings/integrations`

This includes:
- Facebook/Meta access tokens
- WhatsApp API keys
- Gemini API key
- Twilio credentials

Configured via the Integrations panel in the app.

---

## Common Tasks

### Add New Employee
1. Login as Admin
2. Settings → Admin Panel → Users
3. Add email, name, role, phone

### Change Lead Stages
Edit `src/lib/constants.js`:
```javascript
export const STAGES = [
  'New',
  'Contacted',
  'Qualified',
  // Add/modify stages here
];
```

### Modify Auto-Assignment Rules
Settings → Admin Panel → Lead Assignment Rules

### Enable/Disable Features
Settings → Integrations
- Auto Greeting: WhatsApp tab
- SMS Notifications: Alerts tab
- AI Features: AI tab

---

## Scheduled Tasks (Cloud Functions)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `checkStaleLeads` | Every hour | Remind about 24h+ inactive leads |
| `checkQuotedLeads` | Daily 9am | Remind about 3+ day old quotes |
| `siteVisitReminders` | Daily 8am | Remind about tomorrow's site visits |

All times in Asia/Karachi timezone.

---

## Troubleshooting

### Functions not working?
```bash
firebase functions:log
```

### Build errors?
```bash
npm run build 2>&1 | head -50
```

### Firestore permission errors?
Check `firestore.rules` and deploy:
```bash
firebase deploy --only firestore:rules
```

---

## Support

- **Technical Docs:** See `CLAUDE.md` in this repo
- **Firebase Console:** https://console.firebase.google.com
- **Original Spec:** Check `docs/` folder if available

---

## Checklist for New Team

- [ ] Clone repo and run `npm install`
- [ ] Run `firebase login` with your Google account
- [ ] Either get added to existing Firebase project OR create new one
- [ ] If new project: Update `firebase.js` and `functions/index.js`
- [ ] Run `npm run dev` to test locally
- [ ] Deploy with `firebase deploy`
- [ ] Add yourself as Admin user in Firestore
- [ ] Configure integrations in app (Meta, WhatsApp, etc.)
- [ ] Set up webhooks in Meta/WhatsApp providers
