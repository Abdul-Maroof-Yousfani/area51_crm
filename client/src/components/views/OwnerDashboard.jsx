import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  PieChart,
  Send,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Calendar,
  Target,
  UserCheck,
  X,
  Phone,
  MessageCircle,
  Timer
} from 'lucide-react';
import { getWhatsappLink } from '../../utils/helpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  Funnel,
  FunnelChart,
  LabelList
} from 'recharts';
import { STAGES, STAGE_COLORS, COLORS } from '../../lib/constants';
import { safeAmount, formatCurrency, isWonStage } from '../../utils/helpers';
import { handleOwnerQuery } from '../../services/ai';

export default function OwnerDashboard({ leads = [], onShowRevenue }) {
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [activeModal, setActiveModal] = useState(null); // 'leads', 'conversion', 'stale', 'ytd', 'source', 'funnel'
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);

  // Calculate all metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Helper to parse date from various formats
    // Prioritizes inquiryDate (legacy data) over createdAt (import timestamp)
    const parseLeadDate = (lead) => {
      if (lead.inquiryDate) {
        // Handle format like '16-Aug-25', '11-Jan-26'
        const parsed = new Date(lead.inquiryDate);
        if (!isNaN(parsed.getTime())) {
          if (parsed.getFullYear() < 100) {
            parsed.setFullYear(parsed.getFullYear() + 2000);
          }
          return parsed;
        }
        // Try parsing DD-MMM-YY format manually
        const match = lead.inquiryDate.match(/(\d{1,2})-(\w{3})-(\d{2})/);
        if (match) {
          const [, day, monthStr, year] = match;
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIndex = monthNames.indexOf(monthStr.toLowerCase());
          if (monthIndex !== -1) {
            return new Date(2000 + parseInt(year), monthIndex, parseInt(day));
          }
        }
      }
      // Fallback to createdAt
      if (lead.createdAt?.toDate) {
        return lead.createdAt.toDate();
      } else if (lead.createdAt?.seconds) {
        return new Date(lead.createdAt.seconds * 1000);
      } else if (lead.createdAt) {
        return new Date(lead.createdAt);
      }
      return null;
    };

    // Filter by date
    const thisMonthLeads = leads.filter((l) => {
      const d = parseLeadDate(l);
      return d && d >= startOfMonth;
    });

    const lastMonthLeads = leads.filter((l) => {
      const d = parseLeadDate(l);
      return d && d >= startOfLastMonth && d <= endOfLastMonth;
    });

    // Lead sources
    const leadsBySource = {};
    leads.forEach((l) => {
      const source = l.source || 'Unknown';
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    // Conversion by source (support both 'Booked' and 'Won' stage names)
    const conversionBySource = {};
    Object.keys(leadsBySource).forEach((source) => {
      const sourceLeads = leads.filter((l) => (l.source || 'Unknown') === source);
      const booked = sourceLeads.filter((l) => l.stage === 'Booked' || l.stage === 'Won').length;
      conversionBySource[source] = sourceLeads.length > 0
        ? ((booked / sourceLeads.length) * 100).toFixed(1)
        : 0;
    });

    // Leads by stage (funnel)
    // Map legacy stage names to current stage names
    const stageMapping = {
      'New Lead': 'New',
      'Proposal': 'Quoted',
      'Won': 'Booked',
      'Negotiation': 'Negotiating'
    };

    const leadsByStage = {};
    STAGES.forEach((s) => (leadsByStage[s] = 0));
    leads.forEach((l) => {
      // Try direct match first, then mapped name
      const normalizedStage = stageMapping[l.stage] || l.stage;
      if (leadsByStage[normalizedStage] !== undefined) {
        leadsByStage[normalizedStage]++;
      } else if (l.stage) {
        // Log stages that don't match expected values
        console.warn('Unknown stage:', l.stage, 'for lead:', l.clientName);
      }
    });

    // Employee performance with response time tracking
    const employeeStats = {};
    const employeeResponseTimes = {};
    leads.forEach((l) => {
      const mgr = l.manager || 'Unassigned';
      if (!employeeStats[mgr]) {
        employeeStats[mgr] = { leads: 0, booked: 0, revenue: 0 };
        employeeResponseTimes[mgr] = [];
      }
      employeeStats[mgr].leads++;
      if (isWonStage(l.stage)) {
        employeeStats[mgr].booked++;
        employeeStats[mgr].revenue += safeAmount(l.amount);
      }
      // Track response times
      if (l.responseTimeMinutes && l.responseTimeMinutes > 0) {
        employeeResponseTimes[mgr].push(l.responseTimeMinutes);
      }
    });

    // Calculate average response times
    Object.keys(employeeStats).forEach((mgr) => {
      const times = employeeResponseTimes[mgr] || [];
      employeeStats[mgr].avgResponseTime = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;
    });

    // Calculate overall average response time
    const allResponseTimes = leads
      .filter((l) => l.responseTimeMinutes && l.responseTimeMinutes > 0)
      .map((l) => l.responseTimeMinutes);
    const avgResponseTime = allResponseTimes.length > 0
      ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
      : null;

    // Revenue calculations (supports both 'Booked' and 'Won' stages)
    const bookedLeads = leads.filter((l) => isWonStage(l.stage));
    const totalRevenue = bookedLeads.reduce((sum, l) => sum + safeAmount(l.amount), 0);

    const thisMonthBooked = thisMonthLeads.filter((l) => isWonStage(l.stage));
    const thisMonthRevenue = thisMonthBooked.reduce((sum, l) => sum + safeAmount(l.amount), 0);

    const lastMonthBooked = lastMonthLeads.filter((l) => isWonStage(l.stage));
    const lastMonthRevenue = lastMonthBooked.reduce((sum, l) => sum + safeAmount(l.amount), 0);

    // YTD
    const ytdLeads = leads.filter((l) => {
      const d = parseLeadDate(l);
      return d && d >= startOfYear;
    });
    const ytdBooked = ytdLeads.filter((l) => isWonStage(l.stage));
    const ytdRevenue = ytdBooked.reduce((sum, l) => sum + safeAmount(l.amount), 0);

    // Conversion rate
    const conversionRate = leads.length > 0
      ? ((bookedLeads.length / leads.length) * 100).toFixed(1)
      : 0;

    // Month trend
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLeads = leads.filter((l) => {
        const d = parseLeadDate(l);
        if (!d) return false;
        return d >= month && d <= monthEnd;
      });
      const monthBooked = monthLeads.filter((l) => isWonStage(l.stage));
      monthlyTrend.push({
        name: month.toLocaleString('default', { month: 'short' }),
        leads: monthLeads.length,
        booked: monthBooked.length,
        revenue: monthBooked.reduce((sum, l) => sum + safeAmount(l.amount), 0)
      });
    }

    // Stale leads
    const staleLeads = leads.filter((l) => {
      if (!['New', 'Contacted'].includes(l.stage)) return false;
      const lastContact = l.lastContactedAt?.toDate?.() || l.createdAt?.toDate?.();
      if (!lastContact) return false;
      const hoursSince = (now - lastContact) / (1000 * 60 * 60);
      return hoursSince > 24;
    });

    // Overdue payments
    const overduePayments = leads.filter(
      (l) => l.stage === 'Booked' && l.paymentStatus === 'overdue'
    );

    return {
      totalLeads: leads.length,
      thisMonthLeads: thisMonthLeads.length,
      lastMonthLeads: lastMonthLeads.length,
      leadsBySource,
      conversionBySource,
      leadsByStage,
      employeeStats,
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      ytdRevenue,
      conversionRate,
      monthlyTrend,
      staleLeads,
      overduePayments,
      avgResponseTime,
      revenueGrowth: lastMonthRevenue > 0
        ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
        : 0
    };
  }, [leads]);

  // Handle AI query
  const handleAiSubmit = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    const response = await handleOwnerQuery(aiQuery);
    setAiResponse(response);
    setAiLoading(false);
  };

  // Prepare chart data
  const sourceData = Object.entries(metrics.leadsBySource)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const funnelData = STAGES.filter((s) => s !== 'Lost').map((stage, i) => ({
    name: stage,
    value: metrics.leadsByStage[stage] || 0,
    fill: COLORS[i % COLORS.length]
  }));

  const employeeData = Object.entries(metrics.employeeStats)
    .map(([name, stats]) => ({
      name: name.split(' ')[0], // First name only
      leads: stats.leads,
      booked: stats.booked,
      revenue: stats.revenue,
      conversion: stats.leads > 0 ? ((stats.booked / stats.leads) * 100).toFixed(0) : 0,
      avgResponseTime: stats.avgResponseTime
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Get filtered leads for drilldown
  const getFilteredLeads = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (activeModal) {
      case 'leads':
        return leads.filter((l) => {
          const d = l.createdAt?.toDate?.() || new Date(l.inquiryDate);
          return d >= startOfMonth;
        });
      case 'conversion':
        return leads.filter((l) => isWonStage(l.stage));
      case 'stale':
        return metrics.staleLeads;
      case 'ytd':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return leads.filter((l) => {
          const d = l.createdAt?.toDate?.() || new Date(l.inquiryDate);
          return d >= startOfYear && isWonStage(l.stage);
        });
      case 'source':
        return selectedSource ? leads.filter((l) => (l.source || 'Unknown') === selectedSource) : [];
      case 'funnel':
        return selectedStage ? leads.filter((l) => l.stage === selectedStage) : [];
      default:
        return [];
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'leads': return `Leads This Month (${metrics.thisMonthLeads})`;
      case 'conversion': return `Booked Leads (${metrics.conversionRate}% conversion)`;
      case 'stale': return `Stale Leads (${metrics.staleLeads.length})`;
      case 'ytd': return `Revenue YTD - ${formatCurrency(metrics.ytdRevenue)}`;
      case 'source': return `Source: ${selectedSource}`;
      case 'funnel': return `Stage: ${selectedStage}`;
      default: return '';
    }
  };

  // Drilldown Modal Component
  const DrilldownModal = () => {
    if (!activeModal) return null;
    const filteredLeads = getFilteredLeads();

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">{getModalTitle()}</h3>
            <button
              onClick={() => { setActiveModal(null); setSelectedSource(null); setSelectedStage(null); }}
              className="p-2 hover:bg-gray-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            {filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No leads found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Source</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{lead.clientName}</div>
                        <div className="text-xs text-gray-500">{lead.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STAGE_COLORS[lead.stage]?.bg || 'bg-gray-100'} ${STAGE_COLORS[lead.stage]?.text || 'text-gray-600'}`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {lead.source ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            {lead.source}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(lead.amount)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={getWhatsappLink(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg inline-block"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-4 border-t bg-gray-50 text-sm text-gray-500">
            {filteredLeads.length} leads • Total: {formatCurrency(filteredLeads.reduce((sum, l) => sum + safeAmount(l.amount), 0))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Drilldown Modal */}
      <DrilldownModal />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Owner Dashboard</h1>
          <p className="text-xs md:text-sm text-gray-500">Business Overview & Analytics</p>
        </div>
        {/* Add right margin to avoid overlap with fixed language toggle + notification bell */}
        <div className="flex gap-1 md:gap-2 overflow-x-auto md:mr-40">
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium capitalize whitespace-nowrap ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics - 2 cols mobile, 3 cols tablet, 6 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <div
          className="bg-white p-3 md:p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={onShowRevenue}
        >
          <div className="flex items-center justify-between">
            <div className="p-1.5 md:p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            {Number(metrics.revenueGrowth) > 0 ? (
              <span className="text-[10px] md:text-xs text-green-600 flex items-center gap-0.5">
                <ArrowUp className="w-3 h-3" /> {metrics.revenueGrowth}%
              </span>
            ) : Number(metrics.revenueGrowth) < 0 ? (
              <span className="text-[10px] md:text-xs text-red-600 flex items-center gap-0.5">
                <ArrowDown className="w-3 h-3" /> {Math.abs(metrics.revenueGrowth)}%
              </span>
            ) : null}
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(metrics.thisMonthRevenue)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Revenue This Month</p>
        </div>

        <div
          className="bg-white p-3 md:p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveModal('leads')}
        >
          <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg w-fit">
            <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{metrics.thisMonthLeads}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Leads This Month</p>
          <p className="text-[10px] text-blue-500 mt-1">vs {metrics.lastMonthLeads} last month</p>
        </div>

        <div
          className="bg-white p-3 md:p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveModal('conversion')}
        >
          <div className="p-1.5 md:p-2 bg-purple-100 rounded-lg w-fit">
            <Target className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{metrics.conversionRate}%</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Conversion Rate</p>
        </div>

        <div
          className="bg-white p-3 md:p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveModal('stale')}
        >
          <div className="p-1.5 md:p-2 bg-amber-100 rounded-lg w-fit">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">{metrics.staleLeads.length}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Stale Leads (24h+)</p>
        </div>

        <div
          className="bg-white p-3 md:p-5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveModal('ytd')}
        >
          <div className="p-1.5 md:p-2 bg-emerald-100 rounded-lg w-fit">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3 truncate">{formatCurrency(metrics.ytdRevenue)}</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Revenue YTD</p>
        </div>

        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-sm">
          <div className="p-1.5 md:p-2 bg-cyan-100 rounded-lg w-fit">
            <Timer className="w-4 h-4 md:w-5 md:h-5 text-cyan-600" />
          </div>
          <p className="text-lg md:text-2xl font-bold mt-2 md:mt-3">
            {metrics.avgResponseTime !== null ? (
              metrics.avgResponseTime < 60
                ? `${metrics.avgResponseTime}m`
                : `${Math.round(metrics.avgResponseTime / 60)}h`
            ) : (
              '—'
            )}
          </p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Avg Response Time</p>
          {metrics.avgResponseTime !== null && (
            <p className={`text-[10px] mt-1 ${metrics.avgResponseTime <= 30 ? 'text-green-500' : metrics.avgResponseTime <= 120 ? 'text-amber-500' : 'text-red-500'}`}>
              {metrics.avgResponseTime <= 30 ? '🟢 Excellent' : metrics.avgResponseTime <= 120 ? '🟡 Good' : '🔴 Needs Improvement'}
            </p>
          )}
        </div>
      </div>

      {/* Charts Row 1 - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base">
            <BarChart3 className="w-4 h-4" /> Revenue & Leads Trend
          </h3>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={30} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Revenue'
                      ? [`${formatCurrency(value)}`, name]
                      : [`${value.toLocaleString()} leads`, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.1}
                  name="Revenue"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="leads"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.1}
                  name="Leads"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Sources */}
        <div className="bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base">
            <PieChart className="w-4 h-4" /> Lead Sources
          </h3>
          <div className="h-36 md:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value.toLocaleString()} leads`, name]} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          {/* Legend below chart - clickable */}
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] md:text-xs">
            {sourceData.map((entry, index) => (
              <div
                key={entry.name}
                className="flex items-center gap-1 truncate cursor-pointer hover:bg-gray-100 p-1 rounded"
                onClick={() => { setSelectedSource(entry.name); setActiveModal('source'); }}
              >
                <span
                  className="w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate text-gray-600">{entry.name}</span>
                <span className="font-bold text-gray-800 ml-auto">
                  {((entry.value / metrics.totalLeads) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Funnel */}
        <div className="bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 text-sm md:text-base">Lead Funnel</h3>
          <div className="space-y-2">
            {STAGES.filter((s) => s !== 'Lost').map((stage, i) => {
              const count = metrics.leadsByStage[stage] || 0;
              const maxCount = Math.max(...Object.values(metrics.leadsByStage));
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const colors = STAGE_COLORS[stage];

              return (
                <div
                  key={stage}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                  onClick={() => { setSelectedStage(stage); setActiveModal('funnel'); }}
                >
                  <div className="w-16 md:w-24 text-[10px] md:text-xs text-gray-600 truncate">{stage}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 md:h-6 overflow-hidden">
                    <div
                      className={`h-full ${colors.bg} flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(width, 10)}%` }}
                    >
                      <span className={`text-[10px] md:text-xs font-bold ${colors.text}`}>{count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee Performance */}
        <div className="lg:col-span-2 bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base">
            <UserCheck className="w-4 h-4" /> Salesperson Performance
          </h3>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs md:text-sm min-w-[500px]">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pl-4 md:pl-0">Name</th>
                  <th className="pb-2 text-center">Leads</th>
                  <th className="pb-2 text-center">Booked</th>
                  <th className="pb-2 text-center">Conv %</th>
                  <th className="pb-2 text-center">Resp Time</th>
                  <th className="pb-2 text-right pr-4 md:pr-0">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeData.slice(0, 5).map((emp, i) => (
                  <tr key={emp.name} className="hover:bg-gray-50">
                    <td className="py-2 pl-4 md:pl-0 font-medium flex items-center gap-2">
                      <span
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      >
                        {emp.name[0]}
                      </span>
                      <span className="truncate">{emp.name}</span>
                    </td>
                    <td className="py-2 text-center">{emp.leads}</td>
                    <td className="py-2 text-center text-green-600 font-medium">{emp.booked}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${
                          Number(emp.conversion) >= 20
                            ? 'bg-green-100 text-green-700'
                            : Number(emp.conversion) >= 10
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {emp.conversion}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      {emp.avgResponseTime !== null ? (
                        <span
                          className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${
                            emp.avgResponseTime <= 30
                              ? 'bg-green-100 text-green-700'
                              : emp.avgResponseTime <= 120
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {emp.avgResponseTime < 60 ? `${emp.avgResponseTime}m` : `${Math.round(emp.avgResponseTime / 60)}h`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right pr-4 md:pr-0 font-bold">{formatCurrency(emp.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-xl p-4 md:p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="p-2 md:p-3 bg-white/10 rounded-xl w-fit">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base md:text-lg">AI Business Assistant</h3>
            <p className="text-indigo-200 text-xs md:text-sm mt-1">
              Ask questions about your business performance
            </p>

            {aiResponse && (
              <div className="mt-4 bg-white/10 rounded-lg p-3 md:p-4 text-xs md:text-sm leading-relaxed whitespace-pre-line">
                {aiResponse
                  .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove ** markers (CSS will handle emphasis via context)
                  .replace(/\*([^*]+)\*/g, '$1')     // Remove single * markers
                  .split('\n').map((line, i) => (
                    <span key={i} className={line.startsWith('•') ? 'block ml-2' : 'block'}>
                      {line.includes(':') && !line.startsWith('•') ? (
                        <strong>{line}</strong>
                      ) : line}
                    </span>
                  ))
                }
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm placeholder-indigo-300 outline-none focus:border-indigo-400"
                placeholder="e.g., How did January compare to December?"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
              />
              <button
                onClick={handleAiSubmit}
                disabled={aiLoading}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-xs md:text-sm disabled:opacity-50 flex items-center gap-1 md:gap-2"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Ask</span>
              </button>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              {[
                "Meta vs walk-ins?",
                'Stale leads?',
                'This quarter'
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setAiQuery(q);
                    handleAiSubmit();
                  }}
                  className="text-[10px] md:text-xs bg-white/10 hover:bg-white/20 px-2 md:px-3 py-1 md:py-1.5 rounded-full"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(metrics.staleLeads.length > 0 || metrics.overduePayments.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.staleLeads.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
              <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-3 text-sm md:text-base">
                <AlertTriangle className="w-4 h-4" /> Stale Leads ({metrics.staleLeads.length})
              </h3>
              <div className="space-y-2 max-h-32 md:max-h-40 overflow-y-auto">
                {metrics.staleLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex justify-between items-center text-xs md:text-sm bg-white p-2 rounded"
                  >
                    <span className="font-medium truncate">{lead.clientName}</span>
                    <span className="text-amber-600 ml-2 flex-shrink-0">{lead.manager?.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.overduePayments.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 md:p-4">
              <h3 className="font-bold text-red-800 flex items-center gap-2 mb-3 text-sm md:text-base">
                <AlertTriangle className="w-4 h-4" /> Overdue Payments ({metrics.overduePayments.length})
              </h3>
              <div className="space-y-2 max-h-32 md:max-h-40 overflow-y-auto">
                {metrics.overduePayments.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex justify-between items-center text-xs md:text-sm bg-white p-2 rounded"
                  >
                    <span className="font-medium truncate">{lead.clientName}</span>
                    <span className="text-red-600 ml-2 flex-shrink-0">{formatCurrency(lead.totalDue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
