import React from 'react';
import {
  LayoutDashboard,
  Users,
  Contact,
  Globe,
  Shield,
  Settings
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'contacts', label: 'Contacts', icon: Contact },
  { id: 'sources', label: 'Sources', icon: Globe }
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  onShowAdmin,
  onShowIntegrations
}) {
  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="p-6 font-bold text-xl text-blue-600">CRM</div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex gap-3 px-4 py-3 rounded-xl font-bold ${
              activeTab === item.id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
        <button
          onClick={onShowAdmin}
          className="w-full flex gap-3 px-4 py-3 rounded-xl font-bold text-purple-600 hover:bg-purple-50"
        >
          <Shield className="w-5 h-5" />
          Admin
        </button>
        <button
          onClick={onShowIntegrations}
          className="w-full flex gap-3 px-4 py-3 rounded-xl font-bold text-cyan-600 hover:bg-cyan-50"
        >
          <Settings className="w-5 h-5" />
          Integrations
        </button>
      </nav>
    </aside>
  );
}
