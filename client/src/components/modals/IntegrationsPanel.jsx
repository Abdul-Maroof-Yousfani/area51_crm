import React, { useState, useEffect } from 'react';
import { X, Settings, Facebook, MessageCircle, Save, Loader, Sparkles, CreditCard, Check, Bell, Smartphone, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import {
  initGoogleCalendarApi,
  isSignedIn,
  requestAuthorization,
  signOut as googleSignOut,
  loadGoogleScripts,
  listCalendars,
  setSelectedCalendar,
  getSelectedCalendar
} from '../../utils/googleCalendar';
import { doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { useLanguage } from '../../contexts/LanguageContext';

// Hard-coded integration source names (must match functions/index.js)
const INTEGRATION_SOURCES = {
  meta: 'Meta Lead Gen',
  whatsapp: 'WhatsApp Inbound'
};

export default function IntegrationsPanel({ onClose }) {
  const { t } = useLanguage();
  const [config, setConfig] = useState({
    // Facebook/Meta Lead Gen
    fbAccessToken: '',
    fbPageId: '',
    // WhatsApp Business API
    waProvider: 'twilio', // twilio, wati, aisensy
    waApiKey: '',
    waApiSecret: '',
    waApiEndpoint: '',
    waBusinessNumber: '',
    waDefaultMessage: 'Assalam o Alaikum! Area 51 Banquet Hall mein inquiry ka shukriya.',
    // Auto WhatsApp Greeting
    autoGreetingEnabled: false,
    autoGreetingMessage: `Assalam o Alaikum {{name}}! 👋

Area 51 Banquet Hall mein inquiry ka shukriya! Hamari team jaldi aap se rabta karegi.

Agar koi sawal ho toh is message ka jawab dein.

📋 Is number pe baat cheet service quality ke liye record ki jati hai.

Shukriya,
Area 51 Team`,
    // Gemini AI
    geminiApiKey: '',
    // Invoicing
    invoicingApiKey: '',
    invoicingApiEndpoint: '',
    // SMS Notifications (Twilio)
    smsEnabled: false,
    smsTwilioSid: '',
    smsTwilioToken: '',
    smsTwilioNumber: '',
    smsNotifyOnAssignment: true,
    smsNotifyOnEscalation: true,
    smsNotifyOnSiteVisit: true,
    smsNotifyOnQuoteFollowUp: true,
    // Browser Notifications
    browserNotificationsEnabled: true,
    // Google Calendar
    googleCalendarEnabled: false,
    googleCalendarClientId: '',
    googleCalendarApiKey: '',
    googleCalendarAutoSync: false,
    googleCalendarSyncSiteVisits: true,
    googleCalendarSyncCalls: true,
    googleCalendarSyncEvents: true,
    googleCalendarSyncBookings: true,
    googleCalendarSelectedId: 'primary'
  });
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('meta');

  useEffect(() => {
    const loadConfig = async () => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setConfig((prev) => ({ ...prev, ...docSnap.data() }));
    };
    loadConfig();
  }, []);

  // Ensure integration source exists in lead_sources collection
  const ensureIntegrationSource = async (sourceName) => {
    const sourcesRef = collection(db, 'artifacts', appId, 'public', 'data', 'lead_sources');
    const snapshot = await getDocs(sourcesRef);
    const existingSources = snapshot.docs.map(d => d.data().name);

    if (!existingSources.includes(sourceName)) {
      await addDoc(sourcesRef, {
        name: sourceName,
        isIntegration: true, // Flag to prevent deletion
        createdAt: serverTimestamp()
      });
      return true; // Source was added
    }
    return false; // Source already existed
  };

  const handleSave = async () => {
    setSaving(true);

    const addedSources = [];

    // If Meta integration is configured, ensure source exists
    if (config.fbPageId && config.fbAccessToken) {
      const added = await ensureIntegrationSource(INTEGRATION_SOURCES.meta);
      if (added) addedSources.push(INTEGRATION_SOURCES.meta);
    }

    // If WhatsApp integration is configured, ensure source exists
    if (config.waApiKey && config.waBusinessNumber) {
      const added = await ensureIntegrationSource(INTEGRATION_SOURCES.whatsapp);
      if (added) addedSources.push(INTEGRATION_SOURCES.whatsapp);
    }

    // Save the integration config
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations'),
      config
    );

    setSaving(false);

    if (addedSources.length > 0) {
      alert(`Integration Settings Saved!\n\nAutomatically added lead sources:\n• ${addedSources.join('\n• ')}`);
    } else {
      alert('Integration Settings Saved!');
    }
  };

  // Check Google Calendar connection status on mount and load calendars
  useEffect(() => {
    const checkGoogleConnection = async () => {
      if (config.googleCalendarClientId && config.googleCalendarApiKey) {
        try {
          await loadGoogleScripts();
          const connected = isSignedIn();
          setGoogleCalendarConnected(connected);

          // If connected, load available calendars
          if (connected) {
            await loadAvailableCalendars();
            // Set the selected calendar from config
            if (config.googleCalendarSelectedId) {
              setSelectedCalendar(config.googleCalendarSelectedId);
            }
          }
        } catch (e) {
          console.log('Google Calendar not connected');
        }
      }
    };
    checkGoogleConnection();
  }, [config.googleCalendarClientId, config.googleCalendarApiKey]);

  // Load available calendars from Google
  const loadAvailableCalendars = async () => {
    setLoadingCalendars(true);
    try {
      const calendars = await listCalendars();
      setAvailableCalendars(calendars);
    } catch (error) {
      console.error('Failed to load calendars:', error);
      setAvailableCalendars([]);
    }
    setLoadingCalendars(false);
  };

  const handleGoogleConnect = async () => {
    if (!config.googleCalendarClientId || !config.googleCalendarApiKey) {
      alert('Please enter your Google Calendar Client ID and API Key first, then save.');
      return;
    }

    setConnectingGoogle(true);
    try {
      await initGoogleCalendarApi(config.googleCalendarClientId, config.googleCalendarApiKey);
      await requestAuthorization();
      setGoogleCalendarConnected(true);

      // Load calendars after successful connection
      await loadAvailableCalendars();

      alert('Successfully connected to Google Calendar!');
    } catch (error) {
      console.error('Google Calendar connection failed:', error);
      alert('Failed to connect to Google Calendar. Please check your credentials.');
    }
    setConnectingGoogle(false);
  };

  const handleGoogleDisconnect = () => {
    googleSignOut();
    setAvailableCalendars([]);
    setGoogleCalendarConnected(false);
    alert('Disconnected from Google Calendar');
  };

  const tabs = [
    { id: 'meta', label: 'Meta Leads', icon: Facebook },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'ai', label: 'AI (Gemini)', icon: Sparkles },
    { id: 'invoicing', label: 'Invoicing', icon: CreditCard },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'calendar', label: 'Calendar', icon: Calendar }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in h-[90vh]">
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold">Integrations Hub</h2>
              <p className="text-slate-400 text-xs">Connect External Platforms</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
          {/* Meta/Facebook Lead Gen */}
          {activeTab === 'meta' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Facebook className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Meta Lead Ads Integration</h3>
                    <p className="text-xs text-gray-500">Auto-pull leads from Facebook/Instagram</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Facebook Page ID
                    </label>
                    <input
                      className="w-full p-3 border rounded-lg text-sm outline-none focus:border-blue-400"
                      value={config.fbPageId}
                      onChange={(e) => setConfig({ ...config, fbPageId: e.target.value })}
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Page Access Token
                    </label>
                    <input
                      type="password"
                      className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-blue-400"
                      value={config.fbAccessToken}
                      onChange={(e) => setConfig({ ...config, fbAccessToken: e.target.value })}
                      placeholder="EAAxxxxxxx..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Get from Facebook Business Settings → System Users
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Business API */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">WhatsApp Business API</h3>
                    <p className="text-xs text-gray-500">Send/receive messages through CRM</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Provider
                    </label>
                    <select
                      className="w-full p-3 border rounded-lg text-sm outline-none focus:border-green-400"
                      value={config.waProvider}
                      onChange={(e) => setConfig({ ...config, waProvider: e.target.value })}
                    >
                      <option value="twilio">Twilio</option>
                      <option value="wati">Wati</option>
                      <option value="aisensy">Aisensy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      API Key / Account SID
                    </label>
                    <input
                      type="password"
                      className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-green-400"
                      value={config.waApiKey}
                      onChange={(e) => setConfig({ ...config, waApiKey: e.target.value })}
                    />
                  </div>
                  {config.waProvider === 'twilio' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Auth Token (Twilio)
                      </label>
                      <input
                        type="password"
                        className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-green-400"
                        value={config.waApiSecret}
                        onChange={(e) => setConfig({ ...config, waApiSecret: e.target.value })}
                      />
                    </div>
                  )}
                  {config.waProvider === 'wati' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        API Endpoint (Wati)
                      </label>
                      <input
                        className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-green-400"
                        value={config.waApiEndpoint}
                        onChange={(e) => setConfig({ ...config, waApiEndpoint: e.target.value })}
                        placeholder="https://live-server-xxxx.wati.io"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Business WhatsApp Number
                    </label>
                    <input
                      className="w-full p-3 border rounded-lg text-sm outline-none focus:border-green-400"
                      value={config.waBusinessNumber}
                      onChange={(e) => setConfig({ ...config, waBusinessNumber: e.target.value })}
                      placeholder="923001234567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Default Greeting Message (Manual)
                    </label>
                    <textarea
                      className="w-full p-3 border rounded-lg text-sm outline-none h-24 resize-none focus:border-green-400"
                      value={config.waDefaultMessage}
                      onChange={(e) => setConfig({ ...config, waDefaultMessage: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Auto Greeting Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{t('autoGreetingTitle')}</h3>
                    <p className="text-xs text-gray-500">Automatically send WhatsApp greeting to new leads</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.autoGreetingEnabled}
                      onChange={(e) =>
                        setConfig({ ...config, autoGreetingEnabled: e.target.checked })
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {config.autoGreetingEnabled && (
                  <div className="space-y-4">
                    {/* Quick Template Buttons */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        Quick Templates
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, autoGreetingMessage: `Hello {{name}}! 👋\n\nThank you for your interest in Area 51 Banquet Hall. We're excited to help you plan your special event!\n\nOne of our team members will contact you shortly.\n\n📋 Conversations are recorded for quality purposes.\n\nBest regards,\nArea 51 Team` })}
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          🇬🇧 English
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, autoGreetingMessage: `Assalam o Alaikum {{name}}! 👋\n\nArea 51 Banquet Hall mein inquiry ka shukriya! Hamari team jaldi aap se rabta karegi.\n\nAgar koi sawal ho toh is message ka jawab dein.\n\n📋 Is number pe baat cheet service quality ke liye record ki jati hai.\n\nShukriya,\nArea 51 Team` })}
                          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          🇵🇰 Urdu
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, autoGreetingMessage: `Assalam o Alaikum {{name}}! 👋\n\nThank you for contacting Area 51 Banquet Hall! Our team will reach out to you shortly.\n\nFeel free to reply if you have any questions.\n\n📋 Conversations recorded for quality.\n\nRegards,\nArea 51 Team` })}
                          className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          🌐 Mixed
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Auto Greeting Message
                      </label>
                      <textarea
                        className="w-full p-3 border rounded-lg text-sm outline-none h-32 resize-none focus:border-blue-400"
                        value={config.autoGreetingMessage}
                        onChange={(e) => setConfig({ ...config, autoGreetingMessage: e.target.value })}
                        placeholder="Enter the automatic greeting message..."
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Use <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> to insert the lead&apos;s first name
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700">
                        <strong>How it works:</strong> When a new lead is created (from Meta, WhatsApp, or manual entry),
                        this greeting will be automatically sent via WhatsApp within 1 minute.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemini AI */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Google Gemini AI</h3>
                    <p className="text-xs text-gray-500">AI-powered responses & assistant</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-purple-400"
                      value={config.geminiApiKey}
                      onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Get from Google AI Studio → API Keys
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="font-bold text-purple-800 mb-2">AI Features Enabled:</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>✓ Round-robin lead assignment to employees</li>
                  <li>✓ Employee Urdu assistant (query leads, availability)</li>
                  <li>✓ Owner dashboard AI queries</li>
                  <li>✓ Closing strategy & email generation</li>
                  <li>✓ Role-based data access control</li>
                </ul>
                <p className="text-xs text-purple-600 mt-3">
                  <strong>Note:</strong> Auto greeting is configured in the WhatsApp tab
                </p>
              </div>
            </div>
          )}

          {/* Invoicing */}
          {activeTab === 'invoicing' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Invoicing Software</h3>
                    <p className="text-xs text-gray-500">Push bookings & pull payment status</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Invoicing API Endpoint
                    </label>
                    <input
                      className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-amber-400"
                      value={config.invoicingApiEndpoint}
                      onChange={(e) =>
                        setConfig({ ...config, invoicingApiEndpoint: e.target.value })
                      }
                      placeholder="https://your-invoicing-software.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-amber-400"
                      value={config.invoicingApiKey}
                      onChange={(e) => setConfig({ ...config, invoicingApiKey: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 mb-2">Integration Behavior:</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>✓ Auto-push booking when lead reaches "Booked" stage</li>
                  <li>✓ Sync payment milestones (Advance, Mid, Final)</li>
                  <li>✓ Show payment status in Finance dashboard</li>
                  <li>✓ Alert on overdue payments</li>
                </ul>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Browser Notifications */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Browser Notifications</h3>
                    <p className="text-xs text-gray-500">Get instant alerts in your browser</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.browserNotificationsEnabled}
                      onChange={(e) =>
                        setConfig({ ...config, browserNotificationsEnabled: e.target.checked })
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs text-indigo-700">
                    <strong>Note:</strong> You'll need to allow notifications when prompted by your browser.
                    Works best on desktop browsers.
                  </p>
                </div>
              </div>

              {/* SMS Notifications */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">SMS Notifications (Twilio)</h3>
                    <p className="text-xs text-gray-500">Send SMS alerts to employees</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.smsEnabled}
                      onChange={(e) =>
                        setConfig({ ...config, smsEnabled: e.target.checked })
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {config.smsEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Twilio Account SID
                      </label>
                      <input
                        type="password"
                        className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-emerald-400"
                        value={config.smsTwilioSid}
                        onChange={(e) => setConfig({ ...config, smsTwilioSid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxx"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Twilio Auth Token
                      </label>
                      <input
                        type="password"
                        className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-emerald-400"
                        value={config.smsTwilioToken}
                        onChange={(e) => setConfig({ ...config, smsTwilioToken: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Twilio Phone Number (From)
                      </label>
                      <input
                        className="w-full p-3 border rounded-lg text-sm outline-none focus:border-emerald-400"
                        value={config.smsTwilioNumber}
                        onChange={(e) => setConfig({ ...config, smsTwilioNumber: e.target.value })}
                        placeholder="+1234567890"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Your Twilio phone number or Messaging Service SID
                      </p>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3">
                        Send SMS For:
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-emerald-600 rounded"
                            checked={config.smsNotifyOnAssignment}
                            onChange={(e) =>
                              setConfig({ ...config, smsNotifyOnAssignment: e.target.checked })
                            }
                          />
                          <span className="text-sm text-gray-700">New lead assignments</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-emerald-600 rounded"
                            checked={config.smsNotifyOnEscalation}
                            onChange={(e) =>
                              setConfig({ ...config, smsNotifyOnEscalation: e.target.checked })
                            }
                          />
                          <span className="text-sm text-gray-700">Lead escalations (48h+ no contact)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-emerald-600 rounded"
                            checked={config.smsNotifyOnSiteVisit}
                            onChange={(e) =>
                              setConfig({ ...config, smsNotifyOnSiteVisit: e.target.checked })
                            }
                          />
                          <span className="text-sm text-gray-700">Site visit reminders</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-emerald-600 rounded"
                            checked={config.smsNotifyOnQuoteFollowUp}
                            onChange={(e) =>
                              setConfig({ ...config, smsNotifyOnQuoteFollowUp: e.target.checked })
                            }
                          />
                          <span className="text-sm text-gray-700">Quote follow-up (3+ days in Quoted stage)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h4 className="font-bold text-emerald-800 mb-2">How SMS Notifications Work:</h4>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>✓ Employees receive SMS when leads are assigned</li>
                  <li>✓ Escalation alerts sent for stale leads (48h+)</li>
                  <li>✓ Site visit reminders sent day before</li>
                  <li>✓ Quote follow-up reminders after 3 days</li>
                  <li>✓ Uses employee phone from Admin Panel</li>
                </ul>
                <p className="text-xs text-emerald-600 mt-3">
                  <strong>Cost:</strong> ~PKR 3-5 per SMS via Twilio
                </p>
              </div>
            </div>
          )}

          {/* Google Calendar */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Google Calendar Integration</h3>
                    <p className="text-xs text-gray-500">Sync lead dates to Google Calendar</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.googleCalendarEnabled}
                      onChange={(e) =>
                        setConfig({ ...config, googleCalendarEnabled: e.target.checked })
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {config.googleCalendarEnabled && (
                  <div className="space-y-4">
                    {/* Quick Add Buttons Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700">
                        <strong>Quick Add:</strong> "Add to Calendar" buttons will appear on lead details, call list, and booking views - no API setup needed!
                      </p>
                    </div>

                    {/* Full API Sync Section */}
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                        <p className="text-xs font-bold text-gray-500 uppercase">
                          Auto-Sync (Optional - Requires Google Cloud Setup)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Google Cloud Client ID
                          </label>
                          <input
                            type="password"
                            className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-blue-400"
                            value={config.googleCalendarClientId}
                            onChange={(e) =>
                              setConfig({ ...config, googleCalendarClientId: e.target.value })
                            }
                            placeholder="xxxx.apps.googleusercontent.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Google Calendar API Key
                          </label>
                          <input
                            type="password"
                            className="w-full p-3 border rounded-lg text-sm outline-none font-mono focus:border-blue-400"
                            value={config.googleCalendarApiKey}
                            onChange={(e) =>
                              setConfig({ ...config, googleCalendarApiKey: e.target.value })
                            }
                            placeholder="AIzaSy..."
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Get from{' '}
                            <a
                              href="https://console.cloud.google.com/apis/credentials"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline inline-flex items-center gap-1"
                            >
                              Google Cloud Console <ExternalLink className="w-3 h-3" />
                            </a>
                          </p>
                        </div>

                        {/* Connect/Disconnect Button */}
                        <div className="flex items-center gap-3">
                          {googleCalendarConnected ? (
                            <>
                              <span className="flex items-center gap-2 text-sm text-green-600">
                                <Check className="w-4 h-4" /> Connected
                              </span>
                              <button
                                type="button"
                                onClick={handleGoogleDisconnect}
                                className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                Disconnect
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={handleGoogleConnect}
                              disabled={connectingGoogle || !config.googleCalendarClientId || !config.googleCalendarApiKey}
                              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {connectingGoogle ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" /> Connecting...
                                </>
                              ) : (
                                <>
                                  <Calendar className="w-4 h-4" /> Connect Google Calendar
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Calendar Selector - Only show when connected */}
                        {googleCalendarConnected && (
                          <div className="border-t border-gray-100 pt-4 mt-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                              Select Calendar
                            </label>
                            {loadingCalendars ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader className="w-4 h-4 animate-spin" /> Loading calendars...
                              </div>
                            ) : (
                              <>
                                <select
                                  className="w-full p-3 border rounded-lg text-sm outline-none focus:border-blue-400"
                                  value={config.googleCalendarSelectedId || 'primary'}
                                  onChange={(e) => {
                                    setConfig({ ...config, googleCalendarSelectedId: e.target.value });
                                    setSelectedCalendar(e.target.value);
                                  }}
                                >
                                  {availableCalendars.length === 0 ? (
                                    <option value="primary">Primary Calendar</option>
                                  ) : (
                                    availableCalendars.map((cal) => (
                                      <option key={cal.id} value={cal.id}>
                                        {cal.name} {cal.primary ? '(Primary)' : ''}
                                      </option>
                                    ))
                                  )}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                  All CRM events will be synced to this calendar
                                </p>
                                {availableCalendars.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={loadAvailableCalendars}
                                    className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Refresh calendar list
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Auto Sync Toggle */}
                        {googleCalendarConnected && (
                          <div className="border-t border-gray-100 pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">Auto-Sync Events</p>
                                <p className="text-xs text-gray-500">Automatically create/update calendar events</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={config.googleCalendarAutoSync}
                                  onChange={(e) =>
                                    setConfig({ ...config, googleCalendarAutoSync: e.target.checked })
                                  }
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>

                            {config.googleCalendarAutoSync && (
                              <div className="space-y-2 ml-1">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                  Sync These Events:
                                </p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={config.googleCalendarSyncSiteVisits}
                                    onChange={(e) =>
                                      setConfig({ ...config, googleCalendarSyncSiteVisits: e.target.checked })
                                    }
                                  />
                                  <span className="text-sm text-gray-700">Site Visits</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={config.googleCalendarSyncCalls}
                                    onChange={(e) =>
                                      setConfig({ ...config, googleCalendarSyncCalls: e.target.checked })
                                    }
                                  />
                                  <span className="text-sm text-gray-700">Scheduled Calls</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={config.googleCalendarSyncEvents}
                                    onChange={(e) =>
                                      setConfig({ ...config, googleCalendarSyncEvents: e.target.checked })
                                    }
                                  />
                                  <span className="text-sm text-gray-700">Event Dates</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={config.googleCalendarSyncBookings}
                                    onChange={(e) =>
                                      setConfig({ ...config, googleCalendarSyncBookings: e.target.checked })
                                    }
                                  />
                                  <span className="text-sm text-gray-700">Final Bookings</span>
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-bold text-blue-800 mb-2">How Google Calendar Works:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✓ <strong>Quick Add buttons</strong> - Add any date to calendar with one click</li>
                  <li>✓ <strong>Site Visits</strong> - Schedule venue visits with client details</li>
                  <li>✓ <strong>Scheduled Calls</strong> - Never miss a follow-up call</li>
                  <li>✓ <strong>Event Dates</strong> - Track client event dates</li>
                  <li>✓ <strong>Final Bookings</strong> - Confirmed booking dates</li>
                </ul>
                <p className="text-xs text-blue-600 mt-3">
                  <strong>Tip:</strong> Quick Add works without any API setup. Auto-sync requires Google Cloud credentials.
                </p>
              </div>
            </div>
          )}

        </div>

        <div className="p-4 bg-white border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-70"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}
            Save Configuration
          </button>
        </div>
      </div>
    </div >
  );
}
