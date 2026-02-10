import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  UserPlus,
  Plus,
  Loader,
  Trash2,
  Database,
  RefreshCw,
  Globe,
  AlertTriangle,
  Users,
  Shuffle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  PhoneCall,
  Mail,
  MessageSquare,
  Bot,
  Bell,
  Send,
  Search,
  Settings,
  Calendar,
  Edit2
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  limit
} from 'firebase/firestore';
import { db, appId, functions, auth } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { normalizePakPhone } from '../../utils/helpers';
import { ROLES, MANAGERS, EVENT_TYPES } from '../../lib/constants';

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Manager');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showAssignmentRules, setShowAssignmentRules] = useState(false);
  const [assignmentConfig, setAssignmentConfig] = useState({
    mode: 'round_robin', // 'round_robin', 'source_based', 'manual', 'single_person'
    defaultAssignee: 'Unassigned',
    sourceRules: [] // { source: 'Meta Lead Gen', assignTo: 'Zia un Nabi' }
  });
  const [sources, setSources] = useState([]);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationRules, setAutomationRules] = useState({});
  const [automationSearch, setAutomationSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [managers, setManagers] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [newManager, setNewManager] = useState('');
  const [newEventType, setNewEventType] = useState('');
  const [editingManager, setEditingManager] = useState(null);
  const [editingEventType, setEditingEventType] = useState(null);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'allowed_users');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Error fetching users', err)
    );
    return () => unsubscribe();
  }, []);

  // Load sources for assignment rules
  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'lead_sources');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSources(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Load assignment config
  useEffect(() => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'assignment_rules');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setAssignmentConfig(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  // Load automation rules
  useEffect(() => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'automation_rules');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setAutomationRules(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  // Load managers from Firestore (fallback to constants if not set)
  useEffect(() => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'managers');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().list?.length > 0) {
        setManagers(docSnap.data().list);
      } else {
        setManagers(MANAGERS);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load event types from Firestore (fallback to constants if not set)
  useEffect(() => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'event_types');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().list?.length > 0) {
        setEventTypes(docSnap.data().list);
      } else {
        setEventTypes(EVENT_TYPES);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSaveAssignmentRules = async () => {
    setLoading(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'assignment_rules'),
        {
          ...assignmentConfig,
          updatedAt: serverTimestamp()
        }
      );
      alert('Assignment rules saved!');
    } catch (error) {
      console.error(error);
      alert('Failed to save rules.');
    } finally {
      setLoading(false);
    }
  };

  const addSourceRule = () => {
    setAssignmentConfig((prev) => ({
      ...prev,
      sourceRules: [...(prev.sourceRules || []), { source: '', assignTo: MANAGERS[0] }]
    }));
  };

  const updateSourceRule = (index, field, value) => {
    setAssignmentConfig((prev) => {
      const rules = [...(prev.sourceRules || [])];
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, sourceRules: rules };
    });
  };

  const removeSourceRule = (index) => {
    setAssignmentConfig((prev) => ({
      ...prev,
      sourceRules: (prev.sourceRules || []).filter((_, i) => i !== index)
    }));
  };

  // Get automation rule for a source (or default)
  const getAutomationRule = (sourceKey) => {
    return automationRules[sourceKey] || {
      addToCallList: true,
      sendNotification: true,
      emailResponse: false,
      textAutoResponse: false,
      aiBot: false
    };
  };

  // Toggle automation setting for a source
  const toggleAutomation = (sourceKey, field) => {
    setAutomationRules(prev => ({
      ...prev,
      [sourceKey]: {
        ...getAutomationRule(sourceKey),
        [field]: !getAutomationRule(sourceKey)[field]
      }
    }));
  };

  // Save automation rules
  const handleSaveAutomationRules = async () => {
    setLoading(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'automation_rules'),
        {
          ...automationRules,
          updatedAt: serverTimestamp()
        }
      );
      alert('Automation rules saved!');
    } catch (error) {
      console.error(error);
      alert('Failed to save automation rules.');
    } finally {
      setLoading(false);
    }
  };

  // Manager CRUD
  const handleAddManager = async () => {
    if (!newManager.trim()) return;
    if (managers.includes(newManager.trim())) {
      alert('Manager already exists');
      return;
    }
    const updated = [...managers, newManager.trim()];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'managers'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
    setNewManager('');
  };

  const handleUpdateManager = async (oldName, newName) => {
    if (!newName.trim()) return;
    const updated = managers.map(m => m === oldName ? newName.trim() : m);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'managers'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
    setEditingManager(null);
  };

  const handleDeleteManager = async (name) => {
    if (name === 'Unassigned') {
      alert('Cannot delete "Unassigned"');
      return;
    }
    if (!window.confirm(`Delete manager "${name}"?`)) return;
    const updated = managers.filter(m => m !== name);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'managers'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
  };

  // Event Type CRUD
  const handleAddEventType = async () => {
    if (!newEventType.trim()) return;
    if (eventTypes.includes(newEventType.trim())) {
      alert('Event type already exists');
      return;
    }
    const updated = [...eventTypes, newEventType.trim()];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'event_types'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
    setNewEventType('');
  };

  const handleUpdateEventType = async (oldName, newName) => {
    if (!newName.trim()) return;
    const updated = eventTypes.map(e => e === oldName ? newName.trim() : e);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'event_types'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
    setEditingEventType(null);
  };

  const handleDeleteEventType = async (name) => {
    if (!window.confirm(`Delete event type "${name}"?`)) return;
    const updated = eventTypes.filter(e => e !== name);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'event_types'), {
      list: updated,
      updatedAt: serverTimestamp()
    });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) return;
    setLoading(true);
    try {
      // Call cloud function to create user and send invite email
      const inviteUser = httpsCallable(functions, 'inviteUser');
      const result = await inviteUser({
        email: newUserEmail,
        name: newUserName,
        role: newUserRole
      });

      if (result.data.success) {
        const savedEmail = newUserEmail;
        const savedName = newUserName;

        // Now send the password reset email using Firebase Auth (this actually sends the email!)
        try {
          await sendPasswordResetEmail(auth, savedEmail, {
            url: 'https://area-51-crm.web.app',
            handleCodeInApp: false
          });

          setNewUserEmail('');
          setNewUserName('');
          alert(`✅ Invite sent!\n\n${savedName} will receive an email at ${savedEmail} to set their password.`);
        } catch (emailError) {
          console.error('Email send error:', emailError);
          // User was created but email failed - offer to copy the link
          setNewUserEmail('');
          setNewUserName('');

          const copyLink = window.confirm(
            `✅ User ${savedName} has been added!\n\n` +
            `⚠️ Could not send email automatically. Copy the password reset link to share manually?\n\n` +
            `(Click OK to copy the link)`
          );
          if (copyLink && result.data.resetLink) {
            try {
              await navigator.clipboard.writeText(result.data.resetLink);
              alert('Password reset link copied to clipboard!');
            } catch {
              prompt('Copy this password reset link:', result.data.resetLink);
            }
          }
        }
      } else {
        throw new Error(result.data.message || 'Failed to invite user');
      }
    } catch (error) {
      console.error(error);
      // Fallback to just adding to allowlist if function fails
      if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') {
        try {
          await setDoc(
            doc(db, 'artifacts', appId, 'public', 'data', 'allowed_users', newUserEmail),
            {
              email: newUserEmail,
              name: newUserName,
              role: newUserRole,
              addedAt: serverTimestamp()
            }
          );
          setNewUserEmail('');
          setNewUserName('');
          alert(`User added! They need to register manually at the login page with ${newUserEmail}.`);
        } catch (fallbackError) {
          alert('Failed to add user: ' + fallbackError.message);
        }
      } else {
        alert('Failed to invite user: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (email) => {
    if (!window.confirm(`Revoke access for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'allowed_users', email));
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('DANGER: This will permanently delete ALL leads. Are you sure?'))
      return;
    setResetting(true);
    try {
      const leadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      while (true) {
        const snapshot = await getDocs(query(leadsRef, limit(400)));
        if (snapshot.size === 0) break;
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      alert('Database cleared successfully.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to reset database: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleMigrateContacts = async () => {
    if (!window.confirm('This will create contacts from existing leads. Continue?')) return;
    setLoading(true);
    try {
      const leadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      const contactsRef = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');

      const leadsSnap = await getDocs(leadsRef);
      const contactsSnap = await getDocs(contactsRef);

      const existingContacts = new Map();
      contactsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.phone) existingContacts.set(data.phone, doc.id);
      });

      let batch = writeBatch(db);
      let opsCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data();
        if (lead.contactId) continue;

        const phone = normalizePakPhone(lead.phone);
        if (!phone) continue;

        let contactId = existingContacts.get(phone);

        if (!contactId) {
          const newContactRef = doc(contactsRef);
          contactId = newContactRef.id;

          const nameParts = (lead.clientName || 'Unknown').split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');

          batch.set(newContactRef, {
            firstName,
            lastName,
            phone,
            email: '',
            createdAt: serverTimestamp()
          });

          existingContacts.set(phone, contactId);
          createdCount++;
          opsCount++;
        }

        batch.set(leadDoc.ref, { contactId: contactId, phone: phone }, { merge: true });
        updatedCount++;
        opsCount++;

        if (opsCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }

      if (opsCount > 0) await batch.commit();
      alert(
        `Migration Complete.\nCreated Contacts: ${createdCount}\nUpdated Leads: ${updatedCount}`
      );
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Migration failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConsolidateSources = async () => {
    setLoading(true);
    try {
      const leadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      const sourcesRef = collection(db, 'artifacts', appId, 'public', 'data', 'lead_sources');

      const [leadsSnap, sourcesSnap] = await Promise.all([
        getDocs(leadsRef),
        getDocs(sourcesRef)
      ]);

      const existingSources = new Set(
        sourcesSnap.docs.map((d) => d.data().name.toLowerCase().trim())
      );
      const newSources = new Set();

      leadsSnap.docs.forEach((doc) => {
        const s = doc.data().source;
        if (s && typeof s === 'string') {
          const clean = s.trim();
          if (clean && !existingSources.has(clean.toLowerCase())) {
            newSources.add(clean);
            existingSources.add(clean.toLowerCase());
          }
        }
      });

      if (newSources.size === 0) {
        alert('All sources are already consolidated.');
      } else {
        const batch = writeBatch(db);
        newSources.forEach((src) => {
          const newDocRef = doc(sourcesRef);
          batch.set(newDocRef, { name: src, createdAt: serverTimestamp() });
        });
        await batch.commit();
        alert(`Successfully consolidated ${newSources.size} new sources from leads.`);
      }
    } catch (e) {
      console.error(e);
      alert('Consolidation failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in h-[80vh]">
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-xl font-bold">Admin Control Panel</h2>
              <p className="text-slate-400 text-xs">Manage Team Access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite Team Member
            </h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                required
              />
              <input
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-lg text-sm flex-1"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              📧 User will receive an email to set their password and access the CRM.
            </p>
          </div>

          {/* Assignment Rules Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl mb-6 overflow-hidden">
            <button
              onClick={() => setShowAssignmentRules(!showAssignmentRules)}
              className="w-full p-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-purple-800">Lead Assignment Rules</h3>
              </div>
              {showAssignmentRules ? (
                <ChevronUp className="w-4 h-4 text-purple-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-purple-600" />
              )}
            </button>

            {showAssignmentRules && (
              <div className="px-5 pb-5 space-y-4">
                {/* Assignment Mode */}
                <div>
                  <label className="block text-xs font-bold text-purple-700 mb-2">
                    Assignment Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'round_robin', label: 'Round Robin', desc: 'Evenly distribute leads' },
                      { value: 'source_based', label: 'By Source', desc: 'Assign based on lead source' },
                      { value: 'single_person', label: 'Single Person', desc: 'All leads to one person' },
                      { value: 'manual', label: 'Manual Only', desc: 'No auto-assignment' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAssignmentConfig((prev) => ({ ...prev, mode: opt.value }))}
                        className={`p-3 rounded-lg border text-left transition-all ${assignmentConfig.mode === opt.value
                            ? 'border-purple-500 bg-purple-100'
                            : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Single Person Selector */}
                {assignmentConfig.mode === 'single_person' && (
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-2">
                      Assign All Leads To
                    </label>
                    <select
                      value={assignmentConfig.defaultAssignee || ''}
                      onChange={(e) =>
                        setAssignmentConfig((prev) => ({ ...prev, defaultAssignee: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {MANAGERS.filter((m) => m !== 'Unassigned').map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Source-Based Rules */}
                {assignmentConfig.mode === 'source_based' && (
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-2">
                      Source → Employee Rules
                    </label>
                    <div className="space-y-2">
                      {(assignmentConfig.sourceRules || []).map((rule, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            value={rule.source}
                            onChange={(e) => updateSourceRule(idx, 'source', e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                          >
                            <option value="">Select Source...</option>
                            {sources.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                            <option value="Meta Lead Gen">Meta Lead Gen</option>
                            <option value="WhatsApp Inbound">WhatsApp Inbound</option>
                            <option value="Walk-in">Walk-in</option>
                          </select>
                          <span className="text-gray-400">→</span>
                          <select
                            value={rule.assignTo}
                            onChange={(e) => updateSourceRule(idx, 'assignTo', e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                          >
                            {MANAGERS.filter((m) => m !== 'Unassigned').map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeSourceRule(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addSourceRule}
                        className="text-purple-600 text-sm font-medium flex items-center gap-1 hover:text-purple-700"
                      >
                        <Plus className="w-4 h-4" /> Add Rule
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Leads from sources not listed will use round-robin.
                    </p>
                  </div>
                )}

                {/* Fallback Assignee */}
                {assignmentConfig.mode !== 'manual' && (
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-2">
                      Fallback (if no rule matches)
                    </label>
                    <select
                      value={assignmentConfig.fallbackAssignee || 'round_robin'}
                      onChange={(e) =>
                        setAssignmentConfig((prev) => ({ ...prev, fallbackAssignee: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="round_robin">Use Round Robin</option>
                      <option value="unassigned">Leave Unassigned</option>
                      {MANAGERS.filter((m) => m !== 'Unassigned').map((m) => (
                        <option key={m} value={m}>
                          Always assign to {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveAssignmentRules}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Save Assignment Rules
                </button>
              </div>
            )}
          </div>

          {/* Lead Automation Rules Section */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl mb-6 overflow-hidden">
            <button
              onClick={() => setShowAutomation(!showAutomation)}
              className="w-full p-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-cyan-800">Lead Automation Rules</h3>
                <span className="text-xs text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full">
                  Per Source
                </span>
              </div>
              {showAutomation ? (
                <ChevronUp className="w-4 h-4 text-cyan-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-cyan-600" />
              )}
            </button>

            {showAutomation && (
              <div className="px-5 pb-5 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={automationSearch}
                    onChange={(e) => setAutomationSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>

                {/* Automation Table */}
                <div className="bg-white rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[150px]">Source</th>
                          <th className="px-3 py-3 text-center font-semibold text-gray-600">
                            <div className="flex flex-col items-center gap-1">
                              <PhoneCall className="w-4 h-4 text-blue-500" />
                              <span>Call List</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-gray-600">
                            <div className="flex flex-col items-center gap-1">
                              <Bell className="w-4 h-4 text-amber-500" />
                              <span>Notify</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-gray-600">
                            <div className="flex flex-col items-center gap-1">
                              <Mail className="w-4 h-4 text-green-500" />
                              <span>Email</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-gray-600">
                            <div className="flex flex-col items-center gap-1">
                              <MessageSquare className="w-4 h-4 text-purple-500" />
                              <span>Text</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-gray-600">
                            <div className="flex flex-col items-center gap-1">
                              <Bot className="w-4 h-4 text-indigo-500" />
                              <span>AI Bot</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {/* DEFAULT Row */}
                        <tr className="bg-blue-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">DEFAULT</span>
                              <span className="text-gray-400 text-[10px]">All Sources</span>
                            </div>
                          </td>
                          {['addToCallList', 'sendNotification', 'emailResponse', 'textAutoResponse', 'aiBot'].map(field => (
                            <td key={field} className="px-3 py-3 text-center">
                              <button
                                onClick={() => toggleAutomation('_default', field)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${getAutomationRule('_default')[field]
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300'
                                  }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${getAutomationRule('_default')[field] ? 'left-5' : 'left-0.5'
                                    }`}
                                />
                              </button>
                            </td>
                          ))}
                        </tr>

                        {/* Source Rows */}
                        {sources
                          .filter(s =>
                            !automationSearch ||
                            s.name.toLowerCase().includes(automationSearch.toLowerCase())
                          )
                          .map(source => {
                            const sourceKey = source.name.replace(/\s+/g, '_').toLowerCase();
                            return (
                              <tr key={source.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{source.name}</span>
                                    {source.isIntegration && (
                                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] rounded">
                                        Integration
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {['addToCallList', 'sendNotification', 'emailResponse', 'textAutoResponse', 'aiBot'].map(field => (
                                  <td key={field} className="px-3 py-3 text-center">
                                    <button
                                      onClick={() => toggleAutomation(sourceKey, field)}
                                      className={`w-10 h-5 rounded-full transition-colors relative ${getAutomationRule(sourceKey)[field]
                                          ? 'bg-blue-500'
                                          : 'bg-gray-300'
                                        }`}
                                    >
                                      <span
                                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${getAutomationRule(sourceKey)[field] ? 'left-5' : 'left-0.5'
                                          }`}
                                      />
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <PhoneCall className="w-3 h-3 text-blue-500" />
                    <span>Call List - Auto-add to today's call list</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bell className="w-3 h-3 text-amber-500" />
                    <span>Notify - Send in-app/SMS notification</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-green-500" />
                    <span>Email - Auto-send welcome email</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-purple-500" />
                    <span>Text - Auto-send SMS response</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bot className="w-3 h-3 text-indigo-500" />
                    <span>AI Bot - AI handles initial response</span>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveAutomationRules}
                  disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Save Automation Rules
                </button>
              </div>
            )}
          </div>

          {/* Settings Section - Managers & Event Types */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl mb-6 overflow-hidden">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full p-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-emerald-800">Settings</h3>
                <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Managers & Event Types
                </span>
              </div>
              {showSettings ? (
                <ChevronUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              )}
            </button>

            {showSettings && (
              <div className="px-5 pb-5 space-y-6">
                {/* Managers Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-emerald-800">Managers / Sales Team</h4>
                  </div>
                  <div className="bg-white rounded-lg border p-4 space-y-2">
                    {managers.map((manager) => (
                      <div key={manager} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        {editingManager === manager ? (
                          <input
                            type="text"
                            defaultValue={manager}
                            autoFocus
                            onBlur={(e) => handleUpdateManager(manager, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateManager(manager, e.target.value);
                              if (e.key === 'Escape') setEditingManager(null);
                            }}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{manager}</span>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingManager(manager)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteManager(manager)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                            disabled={manager === 'Unassigned'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="New manager name..."
                        value={newManager}
                        onChange={(e) => setNewManager(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManager()}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      />
                      <button
                        onClick={handleAddManager}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Event Types Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-emerald-800">Event Types</h4>
                  </div>
                  <div className="bg-white rounded-lg border p-4 space-y-2">
                    {eventTypes.map((eventType) => (
                      <div key={eventType} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        {editingEventType === eventType ? (
                          <input
                            type="text"
                            defaultValue={eventType}
                            autoFocus
                            onBlur={(e) => handleUpdateEventType(eventType, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateEventType(eventType, e.target.value);
                              if (e.key === 'Escape') setEditingEventType(null);
                            }}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{eventType}</span>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingEventType(eventType)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEventType(eventType)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="New event type..."
                        value={newEventType}
                        onChange={(e) => setNewEventType(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEventType()}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      />
                      <button
                        onClick={handleAddEventType}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
              <Database className="w-4 h-4" /> Data Maintenance
            </h3>
            <p className="text-xs text-blue-600 mb-4">
              Migrate existing leads to the new contacts system.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleMigrateContacts}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}{' '}
                Migrate Leads to Contacts
              </button>
              <button
                onClick={handleConsolidateSources}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}{' '}
                Consolidate Sources from Leads
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{u.name}</td>
                    <td className="px-6 py-3 text-gray-500">{u.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'Admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleRemoveUser(u.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                        title="Revoke Access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h3>
            <p className="text-xs text-red-600 mb-4">
              This will permanently delete ALL leads. Cannot be undone.
            </p>
            <button
              onClick={handleResetDatabase}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              {resetting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}{' '}
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
