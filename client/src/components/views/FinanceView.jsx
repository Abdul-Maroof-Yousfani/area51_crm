import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import { PAYMENT_MILESTONES } from '../../lib/constants';
import { syncAllPaymentStatuses, calculatePaymentMilestones } from '../../services/invoicing';
import PaymentDetailModal from '../modals/PaymentDetailModal';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FinanceView({ leads, onSyncPayments }) {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [selectedLeadForPayment, setSelectedLeadForPayment] = useState(null);

  // Pagination State
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Keep selected lead in sync with updates
  useEffect(() => {
    if (selectedLeadForPayment) {
      const updatedLead = leads.find(l => l.id === selectedLeadForPayment.id);
      if (updatedLead) {
        setSelectedLeadForPayment(updatedLead);
      }
    }
  }, [leads]);

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

        // Calculate total paid from payments array if available, else fallback to advanceAmount
        let totalPaid = 0;
        if (l.payments && Array.isArray(l.payments) && l.payments.length > 0) {
          totalPaid = l.payments.reduce((sum, p) => sum + safeAmount(p.amount), 0);
        } else {
          totalPaid = safeAmount(l.advanceAmount);
        }

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
    // Reset to first page when filter changes
    setPageIndex(0);
    if (filter === 'all') return bookedLeads;
    // Use the calculated paymentStatus
    return bookedLeads.filter((l) => l.paymentStatus === 'overdue' ? filter === 'overdue' : l.paymentStatus === filter);
  }, [bookedLeads, filter]);

  const paginatedLeads = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, pageIndex, pageSize]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);

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
    const baseClasses = "px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 w-fit mx-auto";

    switch (status) {
      case 'paid':
        return (
          <span className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-200`}>
            <CheckCircle className="w-3.5 h-3.5" /> {t('paid')}
          </span>
        );
      case 'partial':
        return (
          <span className={`${baseClasses} bg-amber-50 text-amber-700 border-amber-200`}>
            <Clock className="w-3.5 h-3.5" /> {t('partial')}
          </span>
        );
      case 'overdue':
        return (
          <span className={`${baseClasses} bg-red-50 text-red-700 border-red-200`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {t('overdue')}
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-slate-50 text-slate-600 border-slate-200`}>
            {t('pending')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t('financeDashboard')}</h1>
          <p className="text-xs md:text-sm text-gray-500">{t('bookingPaymentsInvoicing')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('sync')}</span>
          </button>
          <button className="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2 hover:bg-gray-200">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('export')}</span>
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
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{t('totalBookings')}</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-green-100 rounded-lg w-fit">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(stats.totalValue)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{t('totalValue')}</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-emerald-100 rounded-lg w-fit">
            <Banknote className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{t('collected')}</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-amber-100 rounded-lg w-fit">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{stats.collectionRate}%</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{t('collectionRate')}</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm border-red-200 col-span-2 sm:col-span-1">
          <div className="p-1.5 md:p-2 bg-red-100 rounded-lg w-fit">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 text-red-600">{stats.overdueCount}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">{t('overdue')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 bg-white p-2 md:p-3 rounded-xl border overflow-x-auto">
        <Filter className="w-4 h-4 text-gray-400 my-auto flex-shrink-0" />
        {[
          { key: 'all', label: t('all') },
          { key: 'pending', label: t('pending') },
          { key: 'partial', label: t('partial') },
          { key: 'paid', label: t('paid') },
          { key: 'overdue', label: t('overdue') }
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
        {paginatedLeads.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border">
            {t('noBookingsFound')}
          </div>
        ) : (
          paginatedLeads.map((lead) => (
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
                  <p className="text-[10px] text-gray-400">{t('total')}</p>
                  <p className="text-sm font-bold">{formatCurrency(lead.totalValue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">{t('collected')}</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(lead.totalPaid)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">{t('due')}</p>
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
                <th className="text-left px-4 py-3">{t('client')}</th>
                <th className="text-left px-4 py-3">{t('eventDate')}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t('eventType')}</th>
                <th className="text-right px-4 py-3">{t('total')}</th>
                <th className="text-right px-4 py-3">{t('collected')}</th>
                <th className="text-right px-4 py-3">{t('due')}</th>
                <th className="text-center px-4 py-3">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLeadForPayment(lead)}>
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

      {/* Pagination Controls */}
      {filteredLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          {/* Page Info */}
          <div className="text-sm text-gray-600">
            Page{' '}
            <span className="font-semibold text-gray-900">
              {pageIndex + 1}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-900">
              {totalPages}
            </span>
            {' · '}
            <span className="text-gray-500">
              {filteredLeads.length} results
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPageIndex(p => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Number Buttons */}
            <div className="hidden sm:flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (pageIndex <= 2) {
                  pageNum = i;
                } else if (pageIndex >= totalPages - 3) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = pageIndex - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPageIndex(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageIndex === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
              disabled={pageIndex >= totalPages - 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPageIndex(totalPages - 1)}
              disabled={pageIndex >= totalPages - 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
      {selectedLeadForPayment && (
        <PaymentDetailModal
          lead={selectedLeadForPayment}
          onClose={() => setSelectedLeadForPayment(null)}
          onUpdate={(leadId, updates) => {
            if (onSyncPayments) onSyncPayments();
          }}
        />
      )}
    </div>
  );
}
