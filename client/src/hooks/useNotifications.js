import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { notificationsService } from '../services/api';

/**
 * Hook for managing real-time notifications from API (Postgres)
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

      setShownNotificationIds(prev => new Set([...prev, notification.id]));

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

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    const userId = currentUser?.id || currentUser?.uid;
    if (!userId) return;
    setLoading(true);
    try {
      // Pass userId and role to API (although API might infer role if auth was strict, here we pass what we have)
      const data = await notificationsService.getAll({
        userId: userId,
        role: currentUser.role,
        limit: maxNotifications
      });
      setNotifications(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, maxNotifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ));

    try {
      await notificationsService.markAsRead(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Revert if failed? For now, just log.
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const userId = currentUser?.id || currentUser?.uid;
      await notificationsService.markAllAsRead({
        userId: userId,
        role: currentUser.role
      });
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [currentUser]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    try {
      await notificationsService.delete(notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, []);

  // Add a local notification (e.g. from Socket.IO)
  // This just adds to state, assuming server already saved it.
  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => {
      // Avoid duplicates if ID exists
      if (prev.some(n => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });

    if (enableBrowserNotifications) {
      showBrowserNotification(notification);
    }
  }, [enableBrowserNotifications, showBrowserNotification]);

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
    requestBrowserPermission,
    handleNewNotification,
    refreshNotifications: fetchNotifications
  };
}

// Helper for sound
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification.mp3.mp3');
    audio.play().catch(e => console.error('Audio play error', e));
  } catch (e) {
    console.error('Audio setup error', e);
  }
};

export function useSocketNotifications(onNewLead) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewLead = (payload) => {
      // Payload can be just lead object OR { lead, notification }
      console.log('🔔 Received new-lead event:', payload);
      playNotificationSound();
      if (onNewLead) onNewLead(payload);
    };

    console.log('👂 Listening for new-lead events');
    socket.on('new-lead', handleNewLead);

    return () => {
      socket.off('new-lead', handleNewLead);
    };
  }, [socket, onNewLead]);
}

export default useNotifications;
