import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, User, Clock, AlertTriangle, Calendar, Trash2 } from 'lucide-react';

// Notification type icons and colors
const getNotificationMeta = (type) => {
  switch (type) {
    case 'lead_assigned':
      return { icon: User, color: 'blue', label: 'New Lead' };
    case 'stale_lead_reminder':
      return { icon: Clock, color: 'amber', label: 'Follow-up' };
    case 'stale_lead_escalation':
      return { icon: AlertTriangle, color: 'red', label: 'Escalation' };
    case 'site_visit_reminder':
      return { icon: Calendar, color: 'green', label: 'Site Visit' };
    default:
      return { icon: Bell, color: 'gray', label: 'Notification' };
  }
};

// Format relative time
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function NotificationBell({
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onNotificationClick,
  currentUser
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Filter notifications for current user
  const userNotifications = notifications.filter(
    n => n.assignedTo === currentUser?.name || n.assignedTo === 'all'
  );

  const unreadCount = userNotifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      onMarkRead?.(notification.id);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-all ${
          isOpen
            ? 'bg-blue-100 text-blue-600'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold">Notifications</h3>
              <p className="text-xs text-blue-200">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => onMarkAllRead?.()}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {userNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              userNotifications.map((notification) => {
                const meta = getNotificationMeta(notification.type);
                const IconComponent = meta.icon;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full bg-${meta.color}-100 flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 text-${meta.color}-600`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${meta.color}-100 text-${meta.color}-700 font-medium`}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkRead?.(notification.id);
                                }}
                                className="p-1 hover:bg-blue-100 rounded text-blue-500"
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(notification.id);
                              }}
                              className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {userNotifications.length > 5 && (
            <div className="px-4 py-2 bg-gray-50 border-t text-center">
              <button className="text-xs text-blue-600 hover:underline font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
