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
  // API already filters for current user, so just use the list
  const userNotifications = notifications;

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

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    onMarkAllRead?.();
    // setIsOpen(false); // Keep open as per user request
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-all ${isOpen
          ? 'bg-blue-100 text-blue-600'
          : 'hover:bg-gray-100 text-gray-600'
          }`}
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge (Red Dot) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-scale-in origin-top-right">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 backdrop-blur-sm">
            <div>
              <h3 className="font-bold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-500 hover:text-blue-700 hover:underline font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {userNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 opacity-20" />
                </div>
                <p className="font-medium text-gray-900">No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {userNotifications.map((notification) => {
                  const meta = getNotificationMeta(notification.type);
                  const IconComponent = meta.icon;

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`relative px-4 py-3 cursor-pointer transition-all duration-300 hover:bg-gray-50 group ${!notification.read ? 'bg-yellow-50' : 'opacity-60 hover:opacity-100'
                        }`}
                    >
                      {/* Unread Indicator Border */}
                      {!notification.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400"></div>
                      )}

                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full bg-${meta.color}-100 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <IconComponent className={`w-5 h-5 text-${meta.color}-600`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm leading-snug ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {notification.message}
                            </p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${meta.color}-50 text-${meta.color}-700 font-medium border border-${meta.color}-100`}>
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
