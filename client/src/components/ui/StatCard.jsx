import React from 'react';

export default function StatCard({ title, value, icon: Icon, color, subtext, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
    >
      <div
        className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace(
          'bg-',
          'text-'
        )}`}
      >
        <Icon className="w-16 h-16" />
      </div>
      <div className="relative z-10">
        <div className={`p-3 rounded-xl ${color} bg-opacity-10 w-fit mb-4`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
      </div>
    </div>
  );
}
