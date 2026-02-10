import React, { useState } from 'react';
import { Loader, Menu, X } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, appId } from './lib/firebase';
import { createActivityEntry, ACTIVITY_TYPES } from './utils/helpers';

// Hooks
import { useAuth, useFirestoreData, useAutoMigrateContacts, useCsvUpload, useNotifications, useAppSettings, useContacts, useSources } from './hooks';

// UI Components
import { Toast, DebugPanel, AuthScreen, NotificationBell, LanguageToggle } from './components/ui';
import RoleSidebar from './components/ui/RoleSidebar';
import PWAUpdatePrompt from './components/ui/PWAUpdatePrompt';

// Modal Components
import {
  LeadDetailModal,
  RevenueDetailModal,
  AdminPanel,
  IntegrationsPanel,
  NewLeadModal,
  SourceDetailModal,
  UserSettingsPanel,
  ContactsMigrationPanel
} from './components/modals';

// View Components
import {
  DashboardView,
  LeadsView,
  ContactsView,
  SourcesView,
  EmployeeView,
  OwnerDashboard,
  FinanceView,
  CallListView,
  ConversationLogsView,
  AuditLogsView
} from './components/views';

// Constants (fallback, prefer useAppSettings)

export default function App() {
  // Auth state
  const { user, activeUser, setActiveUser, authLoading, authError, login, signup, logout } = useAuth();

  // Firestore data
  const {
    data,
    sources,
    contacts,
    stats,
    handleSaveLead,
    handleAddLead,
    handleAddSource,
    handleUpdateSource,
    handleDeleteSource,
    handleAddContact,
    handleUpdateContact,
    addActivityLog,
    handleTruncateLeads,
    handleDeleteAllContacts
  } = useFirestoreData(user);

  // CSV upload (pass sources for matching)
  const { uploading, handleFileUpload } = useCsvUpload(sources);

  // App settings (managers, event types from Firestore)
  const { managers, eventTypes } = useAppSettings();

  // Contacts from API
  const {
    contacts: apiContacts,
    loading: contactsLoading,
    addContact,
    updateContact,
    deleteContact,
    deleteAllContacts
  } = useContacts();

  // Sources from API
  const {
    sources: apiSources,
    addSource,
    updateSource,
    deleteSource
  } = useSources();

  // Notifications
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestBrowserPermission
  } = useNotifications(activeUser, { enableBrowserNotifications: true });

  // UI state
  const [activeTab, setActiveTab] = useState('owner-dashboard');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showRevenue, setShowRevenue] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showIntegrationsPanel, setShowIntegrationsPanel] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Debug state
  const [debugLogs, setDebugLogs] = useState([]);

  // Auto-migrate contacts
  useAutoMigrateContacts(activeUser, data, contacts, setToast);

  // Handle stage change from employee view with activity logging
  const handleStageChange = async (leadId, newStage, oldStage = null) => {
    try {
      // Create activity log entry for stage change
      const activityEntry = createActivityEntry(
        ACTIVITY_TYPES.STAGE_CHANGE,
        { from: oldStage || 'Unknown', to: newStage },
        activeUser?.name
      );

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', leadId), {
        stage: newStage,
        stageUpdatedAt: new Date().toISOString(),
        stageUpdatedBy: activeUser?.name,
        activityLog: arrayUnion(activityEntry)
      });
      setToast({ message: `Lead moved to ${newStage}`, type: 'success' });
    } catch (error) {
      console.error('Error updating stage:', error);
      setToast({ message: 'Failed to update stage', type: 'error' });
    }
  };

  // Log WhatsApp click activity
  const handleWhatsAppClick = async (leadId) => {
    try {
      const activityEntry = createActivityEntry(
        ACTIVITY_TYPES.WHATSAPP_OPENED,
        {},
        activeUser?.name
      );
      await addActivityLog(leadId, activityEntry);
    } catch (error) {
      console.error('Error logging WhatsApp activity:', error);
    }
  };

  // Handle call logging from CallListView
  const handleLogCall = async (leadId, callData) => {
    try {
      // Create activity log entry for the call
      const activityEntry = createActivityEntry(
        ACTIVITY_TYPES.CALL_LOGGED,
        {
          outcome: callData.outcome,
          notes: callData.notes,
          nextCallDate: callData.nextCallDate,
          nextCallTime: callData.nextCallTime
        },
        activeUser?.name
      );

      // Update lead with call data
      const updateData = {
        lastCallDate: new Date().toISOString(),
        lastCallOutcome: callData.outcome,
        lastCallNotes: callData.notes,
        lastCalledBy: activeUser?.name,
        activityLog: arrayUnion(activityEntry)
      };

      // Add next call info if scheduled
      if (callData.nextCallDate) {
        updateData.nextCallDate = callData.nextCallDate;
        updateData.nextCallTime = callData.nextCallTime || null;
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', leadId), updateData);
      setToast({ message: 'Call logged successfully', type: 'success' });
    } catch (error) {
      console.error('Error logging call:', error);
      setToast({ message: 'Failed to log call', type: 'error' });
    }
  };

  // Handle tab change (close mobile menu)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-4">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Authenticating...</p>
      </div>
    );
  }

  // Auth screen (show if not logged in, not authorized, or no active user)
  if (!user || !activeUser || authError) {
    return (
      <>
        <AuthScreen onLogin={setActiveUser} isLoading={authLoading} authError={authError} login={login} signup={signup} logout={logout} />
        <DebugPanel logs={debugLogs} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <PWAUpdatePrompt />
      {/* <DebugPanel logs={debugLogs} /> */}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Modals */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSave={handleSaveLead}
          currentUser={activeUser}
          sources={sources}
          managers={managers}
          eventTypes={eventTypes}
          onOpenAi={() => { }}
        />
      )}
      {showRevenue && <RevenueDetailModal data={data} onClose={() => setShowRevenue(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showIntegrationsPanel && (
        <IntegrationsPanel onClose={() => setShowIntegrationsPanel(false)} />
      )}
      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onSave={handleAddLead}
          managers={managers}
          contacts={contacts}
          onAddContact={handleAddContact}
          sources={sources}
          eventTypes={eventTypes}
        />
      )}
      {selectedSource && (
        <SourceDetailModal
          source={selectedSource}
          leads={data}
          onClose={() => setSelectedSource(null)}
          onSelectLead={(lead) => {
            setSelectedSource(null);
            setSelectedLead(lead);
          }}
        />
      )}
      {showUserSettings && (
        <UserSettingsPanel
          currentUser={activeUser}
          onClose={() => setShowUserSettings(false)}
          onLogout={logout}
        />
      )}
      {showMigrationPanel && <ContactsMigrationPanel onClose={() => setShowMigrationPanel(false)} />}

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <RoleSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={activeUser?.role || 'Admin'}
          onShowAdmin={() => setShowAdmin(true)}
          onShowIntegrations={() => setShowIntegrationsPanel(true)}
          onShowUserSettings={() => setShowUserSettings(true)}
          onShowMigration={() => setShowMigrationPanel(true)}
        />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">51</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">Area 51 CRM</h1>
              <p className="text-[10px] text-gray-500">{activeUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle compact />
            <NotificationBell
              notifications={notifications}
              onMarkRead={markAsRead}
              onMarkAllRead={markAllAsRead}
              onDelete={deleteNotification}
              onNotificationClick={(notif) => {
                // Navigate to the lead if clicking a lead-related notification
                if (notif.leadId) {
                  const lead = data.find(l => l.id === notif.leadId);
                  if (lead) setSelectedLead(lead);
                }
              }}
              currentUser={activeUser}
            />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bg-white border-b shadow-lg max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <RoleSidebar
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              userRole={activeUser?.role || 'Admin'}
              onShowAdmin={() => { setShowAdmin(true); setMobileMenuOpen(false); }}
              onShowIntegrations={() => { setShowIntegrationsPanel(true); setMobileMenuOpen(false); }}
              onShowUserSettings={() => { setShowUserSettings(true); setMobileMenuOpen(false); }}
              onShowMigration={() => { setShowMigrationPanel(true); setMobileMenuOpen(false); }}
              isMobile={true}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6 pt-16 md:pt-6">
        {/* Desktop Header Controls - Fixed in top right */}
        <div className="hidden md:flex fixed top-4 right-6 z-40 items-center gap-3">
          <LanguageToggle />
          <NotificationBell
            notifications={notifications}
            onMarkRead={markAsRead}
            onMarkAllRead={markAllAsRead}
            onDelete={deleteNotification}
            onNotificationClick={(notif) => {
              if (notif.leadId) {
                const lead = data.find(l => l.id === notif.leadId);
                if (lead) setSelectedLead(lead);
              }
            }}
            currentUser={activeUser}
          />
        </div>

        {/* Owner Dashboard */}
        {activeTab === 'owner-dashboard' && (
          <OwnerDashboard leads={data} onShowRevenue={() => setShowRevenue(true)} />
        )}

        {/* Employee Interface (Urdu) */}
        {activeTab === 'employee' && (
          <EmployeeView
            leads={data}
            currentUser={activeUser}
            onSelectLead={setSelectedLead}
            onStageChange={handleStageChange}
            onAddNote={() => { }}
          />
        )}

        {/* Finance View */}
        {activeTab === 'finance' && <FinanceView leads={data} onSyncPayments={() => { }} />}

        {/* Call List View */}
        {activeTab === 'call-list' && (
          <CallListView
            leads={data}
            currentUser={activeUser}
            onLogCall={handleLogCall}
            onSelectLead={setSelectedLead}
            onSaveLead={handleSaveLead}
          />
        )}

        {/* Simple Dashboard (Legacy) */}
        {activeTab === 'dashboard' && (
          <DashboardView stats={stats} onShowRevenue={() => setShowRevenue(true)} />
        )}

        {/* Leads Management */}
        {activeTab === 'leads' && (
          <LeadsView
            data={data}
            onSelectLead={setSelectedLead}
            onShowNewLead={() => setShowNewLead(true)}
            uploading={uploading}
            onFileUpload={handleFileUpload}
            onTruncateLeads={handleTruncateLeads}
          />
        )}

        {/* Contacts */}
        {activeTab === 'contacts' && (
          <ContactsView
            contacts={apiContacts}
            loading={contactsLoading}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            onDeleteAllContacts={deleteAllContacts}
          />
        )}

        {/* Sources */}
        {activeTab === 'sources' && (
          <SourcesView
            sources={apiSources}
            leads={data}
            onAdd={addSource}
            onUpdate={updateSource}
            onDelete={deleteSource}
            onSourceClick={setSelectedSource}
          />
        )}

        {/* Conversation Logs - Owner can view employee-client WhatsApp chats */}
        {activeTab === 'conversation-logs' && (
          <ConversationLogsView leads={data} currentUser={activeUser} />
        )}

        {/* AI Audit Logs - View AI interaction history */}
        {activeTab === 'audit-logs' && (
          <AuditLogsView leads={data} currentUser={activeUser} />
        )}

        {/* Debug Footer - Hidden on mobile */}
        {/* <div className="hidden md:block fixed bottom-0 left-0 w-full bg-black text-white text-xs p-1 text-center opacity-50 pointer-events-none">
          Debug: {data.length} Leads | {contacts.length} Contacts | Rev: {stats.revenue} |
          User: {activeUser ? `${activeUser.name} (${activeUser.role})` : 'Loading...'}
        </div> */}
      </main>
    </div>
  );
}
