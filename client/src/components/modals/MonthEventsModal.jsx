import React, { useMemo } from 'react';
import { X, UserCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function MonthEventsModal({ monthName, events, onClose }) {
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.inquiryDate || a.eventDate) - new Date(b.inquiryDate || b.eventDate)
      ),
    [events]
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-gray-200">
        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Booked Events: {monthName}</h2>
            <p className="text-sm text-gray-500">{sortedEvents.length} confirmed bookings</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEvents.map((evt, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-green-400 hover:shadow-md transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <div className="flex justify-between items-start mb-3 pl-2">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">
                    {evt.eventType || 'Event'}
                  </span>
                  <span className="text-xs font-medium text-gray-400">{evt.inquiryDate}</span>
                </div>
                <h4 className="font-bold text-gray-900 text-lg pl-2 mb-1">{evt.clientName}</h4>
                <p className="text-xs text-gray-500 pl-2 mb-4 flex items-center gap-1">
                  <UserCircle className="w-3 h-3" /> {evt.manager}
                </p>
                <div className="flex justify-between items-center border-t border-gray-50 pt-3 pl-2">
                  <span className="font-bold text-green-700 text-sm">
                    {formatCurrency(evt.amount)}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    {evt.guests || 0} Pax
                  </span>
                </div>
              </div>
            ))}
          </div>
          {sortedEvents.length === 0 && (
            <p className="text-center text-gray-400 mt-10">No confirmed bookings found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
