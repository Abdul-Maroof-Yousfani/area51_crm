import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Contact,
  Globe,
  Shield,
  Settings,
  MessageSquare,
  CreditCard,
  BarChart3,
  Briefcase,
  PhoneCall,
  MessageCircle,
  Brain,
  UserCircle,
  Database
} from 'lucide-react';

// Navigation items by role
// Navigation items by role
const getNavItems = (role, t) => {
  const ownerItems = [
    { id: 'owner-dashboard', path: '/', label: t('dashboard'), icon: BarChart3, description: 'Analytics & KPIs' },
    { id: 'leads', path: '/leads', label: t('allLeads'), icon: Users, description: 'Manage leads' },
    { id: 'employee', path: '/employee', label: t('salesView'), icon: MessageSquare, description: 'Employee interface' },
    { id: 'call-list', path: '/call-list', label: t('callList'), icon: PhoneCall, description: 'Scheduled calls' },
    { id: 'conversation-logs', path: '/conversation-logs', label: t('conversations'), icon: MessageCircle, description: 'WhatsApp history' },
    { id: 'finance', path: '/finance', label: t('finance'), icon: CreditCard, description: 'Payments & invoicing' },
    { id: 'contacts', path: '/contacts', label: t('contacts'), icon: Contact, description: 'Contact directory' },
    { id: 'sources', path: '/sources', label: t('sources'), icon: Globe, description: 'Lead sources' },
    { id: 'audit-logs', path: '/audit-logs', label: t('aiAudit'), icon: Brain, description: 'AI interaction logs' }
  ];

  const salesItems = [
    { id: 'employee', path: '/employee', label: t('myLeads'), icon: MessageSquare, description: 'My inbox' },
    { id: 'call-list', path: '/call-list', label: t('callList'), icon: PhoneCall, description: 'Scheduled calls' },
    { id: 'contacts', path: '/contacts', label: t('contacts'), icon: Contact, description: 'Contacts' }
  ];

  const financeItems = [
    { id: 'finance', path: '/finance', label: t('finance'), icon: CreditCard, description: 'Payments & invoicing' }
  ];

  switch (role) {
    case 'Owner':
    case 'Admin':
      return ownerItems;
    case 'Sales':
      return salesItems;
    case 'Finance':
      return financeItems;
    default:
      return ownerItems;
  }
};

import { useLanguage } from '../../contexts/LanguageContext';

export default function RoleSidebar({
  activeTab, // Now unused/deprecated, keeping for prop compatibility if needed
  setActiveTab, // Now strictly for mobile menu closing if passed
  userRole,
  onShowAdmin,
  onShowIntegrations,
  onShowUserSettings,
  onShowMigration,
  isMobile = false
}) {
  const { t } = useLanguage();
  const navItems = getNavItems(userRole, t);
  const isOwnerOrAdmin = ['Owner', 'Admin'].includes(userRole);

  const handleNavClick = () => {
    if (isMobile && setActiveTab) {
      setActiveTab(); // This is effectively setMobileMenuOpen(false) from App.jsx
    }
  };

  // Mobile layout - simplified dropdown menu
  if (isMobile) {
    return (
      <div className="p-2">
        {/* Role Badge */}
        <div className="px-3 py-2 mb-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${userRole === 'Owner' || userRole === 'Admin'
              ? 'bg-purple-100 text-purple-700'
              : userRole === 'Sales'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
              }`}
          >
            {userRole}
          </span>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-3 rounded-xl text-left transition-all ${isActive
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
                }`}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'
                      }`}
                  />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Admin Section */}
        {isOwnerOrAdmin && (
          <>
            <div className="my-3 border-t border-gray-200"></div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onShowAdmin}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-left bg-purple-50 text-purple-700 active:bg-purple-100"
              >
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium">Admin</span>
              </button>
              <button
                onClick={onShowIntegrations}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-left bg-cyan-50 text-cyan-700 active:bg-cyan-100"
              >
                <Settings className="w-5 h-5 text-cyan-500" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </>
        )}

        {/* User Settings - Available to all users */}
        <div className="my-3 border-t border-gray-200"></div>
        <button
          onClick={onShowUserSettings}
          className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-left bg-gray-100 text-gray-700 active:bg-gray-200"
        >
          <UserCircle className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium">My Account</span>
        </button>
      </div>
    );
  }

  // Desktop layout - original sidebar
  return (
    <aside className="w-64 bg-white border-r flex flex-col shadow-sm h-full">
      {/* Logo */}
      <div className="p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Area 51</h1>
            <p className="text-xs text-gray-500">Banquet Hall CRM</p>
          </div>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-5 py-3 bg-gray-50 border-b">
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${userRole === 'Owner' || userRole === 'Admin'
            ? 'bg-purple-100 text-purple-700'
            : userRole === 'Sales'
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
            }`}
        >
          {userRole}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${isActive
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'
                    }`}
                />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  {!isActive && (
                    <p className="text-[10px] text-gray-400">{item.description}</p>
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}

        {/* Admin Section */}
        {isOwnerOrAdmin && (
          <>
            <div className="my-4 border-t border-gray-100"></div>
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Settings
            </p>
            <button
              onClick={onShowAdmin}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-all"
            >
              <Shield className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Admin Panel</p>
                <p className="text-[10px] text-gray-400">Users & permissions</p>
              </div>
            </button>
            <button
              onClick={onShowIntegrations}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-all"
            >
              <Settings className="w-5 h-5 text-cyan-500" />
              <div>
                <p className="text-sm font-medium">Integrations</p>
                <p className="text-[10px] text-gray-400">WhatsApp, Meta, AI</p>
              </div>
            </button>
            <button
              onClick={onShowMigration}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-600 hover:bg-orange-50 hover:text-orange-700 transition-all font-medium"
            >
              <Database className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Data Migration</p>
                <p className="text-[10px] text-gray-400">Firebase to SQL</p>
              </div>
            </button>
          </>
        )}
      </nav>

      {/* User Account */}
      <div className="p-4 border-t">
        <button
          onClick={onShowUserSettings}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-600 hover:bg-gray-100 transition-all"
        >
          <UserCircle className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm font-medium">My Account</p>
            <p className="text-[10px] text-gray-400">Profile & password</p>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <p className="text-[10px] text-gray-400 text-center">
          Area 51 CRM v1.0
        </p>
      </div>
    </aside>
  );
}
