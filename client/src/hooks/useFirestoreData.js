import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { safeAmount, normalizePakPhone, isWonStage, createActivityEntry, ACTIVITY_TYPES } from '../utils/helpers';
import { arrayUnion } from 'firebase/firestore';

export function useFirestoreData(user) {
  const [data, setData] = useState([]);
  const [sources, setSources] = useState([]);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (!user) return;

    const unsubLeads = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leads'),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubSources = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'lead_sources'),
      (snap) => {
        setSources(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubContacts = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'contacts'),
      (snap) => {
        setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubLeads();
      unsubSources();
      unsubContacts();
    };
  }, [user]);

  const stats = useMemo(() => {
    const won = data.filter((d) => isWonStage(d.stage));
    const revenue = won.reduce((sum, d) => sum + safeAmount(d.amount), 0);
    const pipe = data
      .filter((d) =>
        ['proposal', 'negotiation'].some((k) => (d.stage || '').toLowerCase().includes(k))
      )
      .reduce((sum, d) => sum + safeAmount(d.amount), 0);
    const conversion = data.length > 0 ? ((won.length / data.length) * 100).toFixed(1) : 0;
    return { revenue, pipe, total: data.length, conversion, wonCount: won.length };
  }, [data]);

  const handleSaveLead = async (id, update, activityLog = null) => {
    const payload = { ...update };

    // If activity log entry provided, append it
    if (activityLog) {
      payload.activityLog = arrayUnion(activityLog);
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', id), payload, {
      merge: true
    });
  };

  // Add activity log entry to a lead
  const addActivityLog = async (leadId, activityEntry) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', leadId), {
      activityLog: arrayUnion(activityEntry)
    }, { merge: true });
  };

  const handleAddLead = async (lead, userName = 'System') => {
    // Create lead with initial activity log
    const activityEntry = createActivityEntry(ACTIVITY_TYPES.LEAD_CREATED, {}, userName);

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leads'), {
      ...lead,
      createdAt: serverTimestamp(),
      activityLog: [activityEntry]
    });
  };

  const handleAddSource = async (name) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'lead_sources'), {
      name,
      createdAt: serverTimestamp()
    });
  };

  const handleDeleteSource = async (id) => {
    if (window.confirm('Delete source?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lead_sources', id));
    }
  };

  const handleUpdateSource = async (id, newName) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lead_sources', id), {
      name: newName
    }, { merge: true });
  };

  const handleAddContact = async (contactData) => {
    try {
      const docRef = await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', 'contacts'),
        {
          ...contactData,
          createdAt: serverTimestamp()
        }
      );
      return { id: docRef.id, ...contactData };
    } catch (e) {
      console.error(e);
      alert('Failed to save contact');
      return null;
    }
  };

  const handleUpdateContact = async (id, contactData) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', id), contactData, {
        merge: true
      });
      return true;
    } catch (e) {
      console.error(e);
      alert('Failed to update contact');
      return false;
    }
  };

  const handleTruncateLeads = async () => {
    if (!window.confirm('WARNING: This will delete ALL leads. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      const leadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      const snapshot = await getDocs(leadsRef);

      if (snapshot.empty) {
        alert('No leads to delete.');
        return;
      }

      // Chunking for batch limits (500 ops per batch)
      const chunk = 450;
      const chunks = [];
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += chunk) {
        chunks.push(docs.slice(i, i + chunk));
      }

      for (const currentChunk of chunks) {
        const batch = writeBatch(db);
        currentChunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      alert('All leads have been deleted.');
    } catch (error) {
      console.error('Error truncating leads:', error);
      alert('Failed to truncate leads: ' + error.message);
    }
  };

  const handleDeleteAllContacts = async () => {
    if (!window.confirm('WARNING: This will delete ALL contacts. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      const contactsRef = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
      const snapshot = await getDocs(contactsRef);

      if (snapshot.empty) {
        alert('No contacts to delete.');
        return;
      }

      const chunk = 450;
      const chunks = [];
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += chunk) {
        chunks.push(docs.slice(i, i + chunk));
      }

      for (const currentChunk of chunks) {
        const batch = writeBatch(db);
        currentChunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      alert('All contacts have been deleted.');
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts: ' + error.message);
    }
  };

  return {
    data,
    sources,
    contacts,
    stats,
    handleSaveLead,
    handleAddLead,
    addActivityLog,
    handleAddSource,
    handleUpdateSource,
    handleDeleteSource,
    handleAddContact,
    handleUpdateContact,
    handleTruncateLeads,
    handleDeleteAllContacts
  };
}

export function useAutoMigrateContacts(activeUser, data, contacts, setToast) {
  useEffect(() => {
    if (!activeUser || data.length === 0) return;

    const autoMigrateContacts = async () => {
      const leadsWithoutContacts = data.filter((l) => !l.contactId && l.phone);
      if (leadsWithoutContacts.length === 0) return;

      try {
        const batch = writeBatch(db);
        const contactsRef = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
        let opsCount = 0;
        let createdCount = 0;

        const existingPhones = new Map();
        contacts.forEach((c) => existingPhones.set(c.phone, c.id));

        for (const lead of leadsWithoutContacts) {
          const phone = normalizePakPhone(lead.phone);
          if (!phone) continue;

          let contactId = existingPhones.get(phone);

          if (!contactId) {
            const newContactRef = doc(contactsRef);
            contactId = newContactRef.id;
            const nameParts = (lead.clientName || 'Unknown').split(' ');
            batch.set(newContactRef, {
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(' '),
              phone,
              email: '',
              createdAt: serverTimestamp()
            });
            existingPhones.set(phone, contactId);
            createdCount++;
            opsCount++;
          }

          const leadRef = doc(db, 'artifacts', appId, 'public', 'data', 'leads', lead.id);
          batch.set(leadRef, { contactId, phone }, { merge: true });
          opsCount++;

          if (opsCount >= 450) break;
        }

        if (opsCount > 0) {
          await batch.commit();
          setToast({
            message: `System Auto-Fix: ${createdCount} contacts created & linked.`,
            type: 'success'
          });
        }
      } catch (e) {
        console.error('Auto-fix failed', e);
      }
    };

    const timeout = setTimeout(autoMigrateContacts, 2000);
    return () => clearTimeout(timeout);
  }, [activeUser, data.length, contacts.length, setToast]);
}
