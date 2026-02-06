import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

/**
 * Hook for managing real-time notifications from Firestore
 * @param {Object} currentUser - The current logged-in user
 * @param {Object} options - Configuration options
 * @returns {Object} Notifications state and handlers
 */
export function useNotifications(currentUser, options = {}) {
  const { maxNotifications = 50, enableBrowserNotifications = false } = options;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  // Track notification IDs we've already shown browser notifications for
  const [shownNotificationIds, setShownNotificationIds] = useState(new Set());

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('Browser notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      setBrowserPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      return permission === 'granted';
    }

    return false;
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((notification) => {
    if (browserPermission !== 'granted' || !enableBrowserNotifications) return;
    if (shownNotificationIds.has(notification.id)) return;

    try {
      const title = getNotificationTitle(notification.type);
      const browserNotif = new Notification(title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'high'
      });

      // Auto-close after 5 seconds for non-high-priority
      if (notification.priority !== 'high') {
        setTimeout(() => browserNotif.close(), 5000);
      }

      // Track that we've shown this notification
      setShownNotificationIds(prev => new Set([...prev, notification.id]));

      // Handle click
      browserNotif.onclick = () => {
        window.focus();
        browserNotif.close();
      };
    } catch (err) {
      console.error('Error showing browser notification:', err);
    }
  }, [browserPermission, enableBrowserNotifications, shownNotificationIds]);

  // Get notification title based on type
  const getNotificationTitle = (type) => {
    switch (type) {
      case 'lead_assigned':
        return 'New Lead Assigned!';
      case 'stale_lead_reminder':
        return 'Follow-up Reminder';
      case 'stale_lead_escalation':
        return 'URGENT: Lead Escalation';
      case 'site_visit_reminder':
        return 'Site Visit Tomorrow';
      default:
        return 'Area 51 CRM';
    }
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!currentUser?.name) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const notificationsRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'notifications'
    );

    // Query notifications for this user, ordered by creation time
    const q = query(
      notificationsRef,
      where('assignedTo', 'in', [currentUser.name, 'all']),
      orderBy('createdAt', 'desc'),
      limit(maxNotifications)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        // Check for new unread notifications and show browser notification
        if (enableBrowserNotifications) {
          notifs.forEach((notif) => {
            if (!notif.read && !shownNotificationIds.has(notif.id)) {
              // Check if this is a recent notification (within last 30 seconds)
              const createdAt = notif.createdAt?.toDate?.() || new Date(notif.createdAt);
              const isRecent = Date.now() - createdAt.getTime() < 30000;
              if (isRecent) {
                showBrowserNotification(notif);
              }
            }
          });
        }

        setNotifications(notifs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching notifications:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.name, maxNotifications, enableBrowserNotifications, showBrowserNotification, shownNotificationIds]);

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const notifRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'notifications',
        notificationId
      );
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      const unreadNotifs = notifications.filter((n) => !n.read);

      unreadNotifs.forEach((notif) => {
        const notifRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'notifications',
          notif.id
        );
        batch.update(notifRef, { read: true });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, [notifications]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const notifRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'notifications',
        notificationId
      );
      await deleteDoc(notifRef);
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, []);

  // Get unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    browserPermission,
    requestBrowserPermission
  };
}

export default useNotifications;
