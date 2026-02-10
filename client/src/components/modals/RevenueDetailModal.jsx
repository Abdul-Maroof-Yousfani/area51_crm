import React, { useState, useMemo } from 'react';
import { X, DollarSign, Sparkles } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import MonthEventsModal from './MonthEventsModal';
import AIReportModal from './AIReportModal';

export default function RevenueDetailModal({ data, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dateRange, setDateRange] = useState('1Y');
  const [showAIReport, setShowAIReport] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    let cutoffDate = new Date();
    if (dateRange === '3M') cutoffDate.setMonth(now.getMonth() - 3);
    else if (dateRange === '6M') cutoffDate.setMonth(now.getMonth() - 6);
    else if (dateRange === 'YTD') cutoffDate = new Date(now.getFullYear(), 0, 1);
    else if (dateRange === '1Y') cutoffDate.setFullYear(now.getFullYear() - 1);
    else cutoffDate = new Date(0);

    const isWithinRange = (d) => {
      const dateStr = d.inquiryDate || d.eventDate;
      const date = new Date(dateStr);
      return !isNaN(date) && date >= cutoffDate && date <= now;
    };

    const timeFilteredData = data.filter(isWithinRange);

    // Include all positive outcomes
    const wonDeals = timeFilteredData.filter((d) => {
      const stage = (d.stage || '').toLowerCase();
      const status = (d.status || '').toLowerCase();
      return (
        stage === 'booked' || stage === 'won' || stage === 'completed' ||
        status === 'booked' || status === 'won' || status === 'completed' ||
        stage.includes('won') || status.includes('won')
      );
    });

    const pipelineDeals = timeFilteredData.filter((d) =>
      ['proposal', 'negotiation', 'visit', 'meeting'].includes((d.stage || '').toLowerCase())
    );

    const totalRevenue = wonDeals.reduce((sum, d) => sum + safeAmount(d.finalAmount || d.amount), 0);
    const potentialRevenue = pipelineDeals.reduce((sum, d) => sum + safeAmount(d.amount), 0);
    const avgDealSize = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;

    const trendMap = {};
    const eventsByMonth = {};

    wonDeals.forEach((d) => {
      const date = new Date(d.inquiryDate || d.eventDate);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const displayKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      if (!trendMap[key]) trendMap[key] = { name: displayKey, value: 0, rawDate: key };
      trendMap[key].value += safeAmount(d.finalAmount || d.amount);

      if (!eventsByMonth[displayKey]) eventsByMonth[displayKey] = [];
      eventsByMonth[displayKey].push(d);
    });

    const trendData = Object.keys(trendMap)
      .sort()
      .map((key) => trendMap[key]);

    const eventMap = {};
    wonDeals.forEach((d) => {
      const type =
        d.eventType && d.eventType.trim()
          ? d.eventType.trim().charAt(0).toUpperCase() + d.eventType.trim().slice(1)
          : 'Other';
      eventMap[type] = (eventMap[type] || 0) + safeAmount(d.finalAmount || d.amount);
    });
    const eventData = Object.entries(eventMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const topDeals = [...wonDeals]
      .sort((a, b) => safeAmount(b.finalAmount || b.amount) - safeAmount(a.finalAmount || a.amount))
      .slice(0, 5);

    return {
      totalRevenue,
      potentialRevenue,
      avgDealSize,
      trendData,
      eventData,
      topDeals,
      eventsByMonth,
      total: timeFilteredData.length,
      wonCount: wonDeals.length
    };
  }, [data, dateRange]);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      {selectedMonth && (
        <MonthEventsModal
          monthName={selectedMonth}
          events={stats.eventsByMonth[selectedMonth] || []}
          onClose={() => setSelectedMonth(null)}
        />
      )}
      {showAIReport && <AIReportModal stats={stats} onClose={() => setShowAIReport(false)} />}

      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl text-green-700">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
              <p className="text-sm text-gray-500">Confirmed Bookings (Won / Booked / Completed)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAIReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold text-xs hover:bg-purple-200 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> AI Analysis
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                Gross Revenue
              </p>
              <h3 className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                Pipeline Potential
              </p>
              <h3 className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.potentialRevenue)}
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-72">
              <h3 className="font-bold text-gray-900 mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData}>
                  <XAxis dataKey="name" />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-72">
              <h3 className="font-bold text-gray-900 mb-4">By Event Type</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.eventData}>
                  <XAxis dataKey="name" />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="font-bold text-gray-900">Top Deals</h3>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.topDeals.map((d, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3">{d.clientName}</td>
                    <td className="px-6 py-3 text-right font-bold text-green-600">
                      {formatCurrency(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
