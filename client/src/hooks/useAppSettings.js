import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { MANAGERS, EVENT_TYPES } from '../lib/constants';

/**
 * Hook to get app settings (managers, event types) from Firestore
 * Falls back to constants if not configured
 */
export function useAppSettings() {
  const [managers, setManagers] = useState(MANAGERS);
  const [eventTypes, setEventTypes] = useState(EVENT_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubManagers = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'managers'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().list?.length > 0) {
          setManagers(docSnap.data().list);
        }
      }
    );

    const unsubEventTypes = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'event_types'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().list?.length > 0) {
          setEventTypes(docSnap.data().list);
        }
        setLoading(false);
      }
    );

    return () => {
      unsubManagers();
      unsubEventTypes();
    };
  }, []);

  return { managers, eventTypes, loading };
}
