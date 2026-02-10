import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  User,
  Phone,
  Filter,
  Download,
  RefreshCw,
  CreditCard,
  Banknote,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import { PAYMENT_MILESTONES } from '../../lib/constants';
import { syncAllPaymentStatuses, calculatePaymentMilestones } from '../../services/invoicing';

export default function FinanceView({ leads, onSyncPayments }) {
  const [filter, setFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);

  // Filter booked leads and calculate derived fields
  const bookedLeads = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return leads
      .filter((l) => {
        const s = (l.stage || '').toLowerCase();
        const st = (l.status || '').toLowerCase();
        return (
          s === 'booked' || s === 'won' || s === 'completed' ||
          st === 'booked' || st === 'won' || st === 'completed' ||
          s.includes('won') || st.includes('won')
        );
      })
      .map((l) => {
        // Calculate financial fields dynamically
        // Use finalAmount if available, otherwise amount. Ensure numbers.
        const totalValue = safeAmount(l.finalAmount !== undefined && l.finalAmount !== null ? l.finalAmount : l.amount);
        const totalPaid = safeAmount(l.advanceAmount); // Currently only advance is tracked
        const totalDue = Math.max(0, totalValue - totalPaid);

        // Determine status
        let paymentStatus = 'pending';
        if (totalValue > 0 && totalDue <= 0) {
          paymentStatus = 'paid';
        } else if (totalPaid > 0) {
          paymentStatus = 'partial';
        }

        // Check for overdue (if event has passed and full payment not received)
        if (l.eventDate) {
          const eventDate = new Date(l.eventDate);
          if (eventDate < today && totalDue > 0) {
            paymentStatus = 'overdue';
          }
        }

        return {
          ...l,
          totalValue,   // Calculated
          totalPaid,    // Calculated
          totalDue,     // Calculated
          paymentStatus // Calculated
        };
      })
      .sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0));
  }, [leads]);

  // Filtered data
  const filteredLeads = useMemo(() => {
    if (filter === 'all') return bookedLeads;
    // Use the calculated paymentStatus
    return bookedLeads.filter((l) => l.paymentStatus === 'overdue' ? filter === 'overdue' : l.paymentStatus === filter);
  }, [bookedLeads, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalBookings = bookedLeads.length;
    const totalValue = bookedLeads.reduce((sum, l) => sum + l.totalValue, 0);
    const totalPaid = bookedLeads.reduce((sum, l) => sum + l.totalPaid, 0);
    const totalDue = bookedLeads.reduce((sum, l) => sum + l.totalDue, 0);
    const overdueCount = bookedLeads.filter((l) => l.paymentStatus === 'overdue').length;
    const overdueAmount = bookedLeads
      .filter((l) => l.paymentStatus === 'overdue')
      .reduce((sum, l) => sum + l.totalDue, 0);

    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const upcomingThisMonth = bookedLeads.filter((l) => {
      // Ensure date exists
      if (!l.eventDate) return false;
      const eventDate = new Date(l.eventDate);
      return eventDate >= now && eventDate <= endOfMonth;
    });

    return {
      totalBookings,
      totalValue,
      totalPaid,
      totalDue,
      overdueCount,
      overdueAmount,
      upcomingThisMonth: upcomingThisMonth.length,
      collectionRate: totalValue > 0 ? ((totalPaid / totalValue) * 100).toFixed(1) : 0
    };
  }, [bookedLeads]);

  const handleSync = async () => {
    setSyncing(true);
    await syncAllPaymentStatuses(bookedLeads);
    setSyncing(false);
    if (onSyncPayments) onSyncPayments();
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] md:text-xs font-bold rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Paid
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] md:text-xs font-bold rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> Partial
          </span>
        );
      case 'overdue':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] md:text-xs font-bold rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] md:text-xs font-bold rounded-full">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-xs md:text-sm text-gray-500">Booking payments & invoicing</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button className="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2 hover:bg-gray-200">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg w-fit">
            <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{stats.totalBookings}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Total Bookings</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-green-100 rounded-lg w-fit">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(stats.totalValue)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Total Value</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-emerald-100 rounded-lg w-fit">
            <Banknote className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Collected</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-amber-100 rounded-lg w-fit">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{stats.collectionRate}%</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Collection Rate</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm border-red-200 col-span-2 sm:col-span-1">
          <div className="p-1.5 md:p-2 bg-red-100 rounded-lg w-fit">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 text-red-600">{stats.overdueCount}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Overdue</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 bg-white p-2 md:p-3 rounded-xl border overflow-x-auto">
        <Filter className="w-4 h-4 text-gray-400 my-auto flex-shrink-0" />
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'partial', label: 'Partial' },
          { key: 'paid', label: 'Paid' },
          { key: 'overdue', label: 'Overdue' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap ${filter === f.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border">
            No bookings found
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-white p-3 rounded-xl border shadow-sm">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{lead.clientName}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" /> {lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>
                {getPaymentStatusBadge(lead.paymentStatus)}
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t">
                <div>
                  <p className="text-[10px] text-gray-400">Total</p>
                  <p className="text-sm font-bold">{formatCurrency(lead.totalValue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Paid</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(lead.totalPaid)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">Due</p>
                  <p className="text-sm font-bold text-red-600">{formatCurrency(lead.totalDue)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
              <tr>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Event Date</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Event Type</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Due</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.clientName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Calendar className="w-3 h-3" />
                        {lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{lead.eventType || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatCurrency(lead.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      {formatCurrency(lead.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {formatCurrency(lead.totalDue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getPaymentStatusBadge(lead.paymentStatus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Milestones Info - Hidden on mobile */}
      <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5">
        <h3 className="font-bold text-blue-900 mb-3">Payment Milestone Structure</h3>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {PAYMENT_MILESTONES.map((milestone, i) => (
            <div key={milestone} className="bg-white p-3 md:p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 md:w-6 md:h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="font-medium text-blue-900 text-sm">{milestone}</span>
              </div>
              <p className="text-xs md:text-sm text-blue-700">
                {i === 0 && '30% on booking'}
                {i === 1 && '40% week before'}
                {i === 2 && '30% event day'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Events Alert */}
      {stats.upcomingThisMonth > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-900 text-sm md:text-base">
                {stats.upcomingThisMonth} events this month
              </p>
              <p className="text-xs md:text-sm text-amber-700">
                Ensure all payments are collected before event dates
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
