import React, { useState } from 'react';
import { Loader, Menu, X } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, appId } from './lib/firebase';
import { createActivityEntry, ACTIVITY_TYPES } from './utils/helpers';

// Hooks
import { useAuth, useFirestoreData, useAutoMigrateContacts, useCsvUpload, useNotifications, useAppSettings, useContacts, useSources, useLeads, useUsers } from './hooks';

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
  const { eventTypes } = useAppSettings();

  // Users from API (for managers list)
  const { users: apiUsers } = useUsers();
  const managerNames = apiUsers.map(u => u.username);

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

  // Leads from API
  const {
    leads: apiLeads,
    stats: leadsStats,
    loading: leadsLoading,
    addLead,
    updateLead,
    deleteLead,
    deleteAllLeads,
    addLeadNote
  } = useLeads();

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

  // Wrapper for adding lead to handle name-to-ID mapping
  const handleAddLeadWrapper = async (leadData) => {
    try {
      // Find manager ID
      const managerUser = apiUsers.find(u => u.username === leadData.manager);
      const assignedTo = managerUser ? managerUser.id : null;

      // Find source ID
      const sourceObj = apiSources.find(s => s.name === leadData.source);
      const sourceId = sourceObj ? sourceObj.id : null;

      // Construct title from event type and date if available
      let title = leadData.title;
      if (!title && leadData.eventType) {
        title = `${leadData.eventType}${leadData.eventDate ? ` - ${leadData.eventDate}` : ''}`;
      }

      // Construct clean payload matching Joi schema
      // Ensure status is valid
      const status = (leadData.stage === 'New Lead' ? 'New' : leadData.stage) || 'New';

      const payload = {
        amount: Number(leadData.amount) || 0,
        status,
        notes: leadData.notes,
        contactId: leadData.contactId,
        assignedTo,
        sourceId,
        title,
        // Map inquiryDate to expectedCloseDate if provided, or leave undefined
        expectedCloseDate: leadData.inquiryDate ? new Date(leadData.inquiryDate).toISOString() : null,
        // Event details
        eventDate: leadData.eventDate ? new Date(leadData.eventDate).toISOString() : null,
        eventType: leadData.eventType,
        venue: leadData.venue,
        guests: leadData.guests ? parseInt(leadData.guests) : null
      };

      await addLead(payload);
      setShowNewLead(false);
      setToast({ message: 'Lead added successfully', type: 'success' });
    } catch (error) {
      console.error('Error adding lead:', error);
      setToast({ message: error.message || 'Failed to add lead', type: 'error' });
    }
  };


  // Wrapper for updating lead to handle field name mapping
  const handleUpdateLeadWrapper = async (id, updateData) => {
    try {
      // Map frontend field names to backend schema
      const payload = { ...updateData };

      // Map 'stage' to 'status'
      if (payload.stage) {
        payload.status = payload.stage;
        delete payload.stage;
      }

      // Map source name to sourceId
      if (payload.source && typeof payload.source === 'string') {
        const sourceObj = apiSources.find(s => s.name === payload.source);
        payload.sourceId = sourceObj ? sourceObj.id : null;
        delete payload.source;
      }

      // Map manager name to assignedTo (user ID)
      if (payload.manager && typeof payload.manager === 'string') {
        const managerObj = apiUsers.find(u => u.username === payload.manager);
        payload.assignedTo = managerObj ? managerObj.id : null;
        delete payload.manager;
      }

      // Remove frontend-only fields that don't exist in backend schema
      delete payload.id; // Prisma error: id is in where clause, not data
      delete payload.contactId; // Can't update foreign key directly
      delete payload.clientName;
      delete payload.phone;
      delete payload.source; // Already mapped to sourceId
      delete payload.inquiryDate;
      delete payload.stageUpdatedAt;
      delete payload.stageUpdatedBy;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.contact;
      delete payload.assignee;
      delete payload.activityLog;
      delete payload.totalPaid;
      delete payload.totalDue;
      // Note: guests, venue, eventType, eventDate, finalAmount, advanceAmount, 
      // siteVisitDate, siteVisitTime, bookingNotes, bookedAt, bookedBy are valid database fields.

      await updateLead(id, payload);
      setToast({ message: 'Lead updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating lead:', error);
      setToast({ message: error.message || 'Failed to update lead', type: 'error' });
    }
  };

  // Handle stage change from employee view with activity logging
  // Handle stage change from employee view with activity logging
  const handleStageChange = async (leadId, newStage, oldStage = null) => {
    try {
      // 1. Update lead stage
      await updateLead(leadId, {
        stage: newStage,
        stageUpdatedAt: new Date().toISOString(),
        stageUpdatedBy: activeUser?.name
      });

      // 2. Add log entry
      const activityData = { from: oldStage || 'Unknown', to: newStage };
      await addLeadNote(leadId,
        JSON.stringify(activityData),
        ACTIVITY_TYPES.STAGE_CHANGE
      );

      setToast({ message: `Lead moved to ${newStage}`, type: 'success' });
    } catch (error) {
      console.error('Error updating stage:', error);
      setToast({ message: 'Failed to update stage', type: 'error' });
    }
  };

  // Log WhatsApp click activity
  const handleWhatsAppClick = async (leadId) => {
    try {
      await addLeadNote(leadId,
        JSON.stringify({}),
        ACTIVITY_TYPES.WHATSAPP_OPENED
      );
    } catch (error) {
      console.error('Error logging WhatsApp activity:', error);
    }
  };

  // Handle call logging from CallListView
  const handleLogCall = async (leadId, callData) => {
    try {
      // 1. Add log entry
      const activityData = {
        outcome: callData.outcome,
        notes: callData.notes,
        nextCallDate: callData.nextCallDate,
        nextCallTime: callData.nextCallTime
      };
      await addLeadNote(leadId,
        JSON.stringify(activityData),
        ACTIVITY_TYPES.CALL_LOGGED
      );

      // 2. Update lead
      const updateData = {
        lastCallDate: new Date().toISOString(),
        lastCallOutcome: callData.outcome,
        lastCallNotes: callData.notes,
        lastCalledBy: activeUser?.name
      };
      if (callData.nextCallDate) {
        updateData.nextCallDate = callData.nextCallDate;
        updateData.nextCallTime = callData.nextCallTime || null;
      }
      await updateLead(leadId, updateData);

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
          onSave={handleUpdateLeadWrapper}
          currentUser={activeUser}
          sources={apiSources}
          managers={managerNames}
          eventTypes={eventTypes}
          onOpenAi={() => { }}
        />
      )}
      {showRevenue && <RevenueDetailModal data={apiLeads} onClose={() => setShowRevenue(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showIntegrationsPanel && (
        <IntegrationsPanel onClose={() => setShowIntegrationsPanel(false)} />
      )}
      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onSave={handleAddLeadWrapper}
          managers={managerNames}
          contacts={apiContacts}
          onAddContact={addContact}
          sources={apiSources}
          eventTypes={eventTypes}
        />
      )}
      {selectedSource && (
        <SourceDetailModal
          source={selectedSource}
          leads={apiLeads}
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
          <OwnerDashboard leads={apiLeads} onShowRevenue={() => setShowRevenue(true)} />
        )}

        {/* Employee Interface (Urdu) */}
        {activeTab === 'employee' && (
          <EmployeeView
            leads={apiLeads}
            currentUser={activeUser}
            onSelectLead={setSelectedLead}
            onStageChange={handleStageChange}
            onAddNote={() => { }}
          />
        )}

        {/* Finance View */}
        {activeTab === 'finance' && <FinanceView leads={apiLeads} onSyncPayments={() => { }} />}

        {/* Call List View */}
        {activeTab === 'call-list' && (
          <CallListView
            leads={apiLeads}
            currentUser={activeUser}
            onLogCall={handleLogCall}
            onSelectLead={setSelectedLead}
            onSaveLead={updateLead}
          />
        )}

        {/* Simple Dashboard (Legacy) */}
        {activeTab === 'dashboard' && (
          <DashboardView stats={leadsStats} onShowRevenue={() => setShowRevenue(true)} />
        )}

        {/* Leads Management */}
        {activeTab === 'leads' && (
          <LeadsView
            data={apiLeads}
            onSelectLead={setSelectedLead}
            onShowNewLead={() => setShowNewLead(true)}
            uploading={uploading}
            onFileUpload={handleFileUpload}
            onTruncateLeads={deleteAllLeads}
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
            leads={apiLeads}
            onAdd={addSource}
            onUpdate={updateSource}
            onDelete={deleteSource}
            onSourceClick={setSelectedSource}
          />
        )}

        {/* Conversation Logs - Owner can view employee-client WhatsApp chats */}
        {activeTab === 'conversation-logs' && (
          <ConversationLogsView leads={apiLeads} currentUser={activeUser} />
        )}

        {/* AI Audit Logs - View AI interaction history */}
        {activeTab === 'audit-logs' && (
          <AuditLogsView leads={apiLeads} currentUser={activeUser} />
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
