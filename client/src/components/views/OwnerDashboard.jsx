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
import { useLanguage } from '../../contexts/LanguageContext';

export default function OwnerDashboard({ leads = [], onShowRevenue }) {
  const { t, language } = useLanguage();
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
    const locale = language === 'ur' ? 'ur-PK' : 'en-US';

    // Determine the current period's start and end dates based on selected range
    let startOfPeriod, endOfPeriod, startOfPreviousPeriod, endOfPreviousPeriod;
    let trendData = [];
    const trendLabelFormat = {
      week: { weekday: 'short' },
      month: { day: 'numeric', month: 'short' },
      quarter: { month: 'short' },
      year: { month: 'short' }
    };

    // Helper to get start of week (Monday)
    const getStartOfWeek = (d) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      return new Date(date.setDate(diff));
    };

    switch (dateRange) {
      case 'week':
        // Current Week (Monday to Sunday)
        startOfPeriod = getStartOfWeek(now);
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date(now);

        // Previous Week
        startOfPreviousPeriod = new Date(startOfPeriod);
        startOfPreviousPeriod.setDate(startOfPeriod.getDate() - 7);
        endOfPreviousPeriod = new Date(startOfPeriod);
        endOfPreviousPeriod.setSeconds(endOfPreviousPeriod.getSeconds() - 1);

        // Trend: Daily for the current week (or last 7 days? UI says "Trend", usually visualizes the period)
        // Let's show last 7 days for better context or just current week days so far
        // Going with current week days
        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfPeriod);
          d.setDate(d.getDate() + i);
          if (d > now) break; // Don't show future days
          trendData.push({ date: d, name: d.toLocaleDateString(locale, { weekday: 'short' }) });
        }
        break;

      case 'month':
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        startOfPreviousPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endOfPreviousPeriod = new Date(now.getFullYear(), now.getMonth(), 0);

        // Trend: Days of the month
        const daysInMonth = endOfPeriod.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(now.getFullYear(), now.getMonth(), i);
          if (d > now) break;
          trendData.push({ date: d, name: d.getDate().toString() });
        }
        break;

      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startOfPeriod = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endOfPeriod = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);

        startOfPreviousPeriod = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
        endOfPreviousPeriod = new Date(now.getFullYear(), currentQuarter * 3, 0);

        // Trend: Months in quarter
        for (let i = 0; i < 3; i++) {
          const d = new Date(now.getFullYear(), currentQuarter * 3 + i, 1);
          trendData.push({ date: d, name: d.toLocaleString(locale, { month: 'short' }) });
        }
        break;

      case 'year':
        startOfPeriod = new Date(now.getFullYear(), 0, 1);
        endOfPeriod = new Date(now.getFullYear(), 11, 31);

        startOfPreviousPeriod = new Date(now.getFullYear() - 1, 0, 1);
        endOfPreviousPeriod = new Date(now.getFullYear() - 1, 11, 31);

        // Trend: Months of the year
        for (let i = 0; i < 12; i++) {
          const d = new Date(now.getFullYear(), i, 1);
          trendData.push({ date: d, name: d.toLocaleString(locale, { month: 'short' }) });
        }
        break;

      default: // 'month' fallback
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfPreviousPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        trendData = [];
    }

    // Helper to parse lead date
    // Prioritizes inquiryDate (legacy data) over createdAt (import timestamp)
    const parseLeadDate = (lead) => {
      if (lead.inquiryDate) {
        const parsed = new Date(lead.inquiryDate);
        if (!isNaN(parsed.getTime())) {
          if (parsed.getFullYear() < 100) parsed.setFullYear(parsed.getFullYear() + 2000);
          return parsed;
        }
        const match = lead.inquiryDate.match(/(\d{1,2})-(\w{3})-(\d{2})/);
        if (match) {
          const [, day, monthStr, year] = match;
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIndex = monthNames.indexOf(monthStr.toLowerCase());
          if (monthIndex !== -1) return new Date(2000 + parseInt(year), monthIndex, parseInt(day));
        }
      }
      if (lead.createdAt?.toDate) return lead.createdAt.toDate();
      if (lead.createdAt?.seconds) return new Date(lead.createdAt.seconds * 1000);
      if (lead.createdAt) return new Date(lead.createdAt);
      return null;
    };

    // Filter leads for current period
    const currentPeriodLeads = leads.filter((l) => {
      const d = parseLeadDate(l);
      return d && d >= startOfPeriod && d <= new Date(now); // Up to now
    });

    // Filter leads for previous period
    const previousPeriodLeads = leads.filter((l) => {
      const d = parseLeadDate(l);
      return d && d >= startOfPreviousPeriod && d <= endOfPreviousPeriod;
    });

    // Populate trend data
    trendData = trendData.map(point => {
      const pointLeads = leads.filter(l => {
        const d = parseLeadDate(l);
        if (!d) return false;

        if (dateRange === 'week' || dateRange === 'month') {
          // Match exact date
          return d.getDate() === point.date.getDate() &&
            d.getMonth() === point.date.getMonth() &&
            d.getFullYear() === point.date.getFullYear();
        } else {
          // Match month
          return d.getMonth() === point.date.getMonth() &&
            d.getFullYear() === point.date.getFullYear();
        }
      });

      const booked = pointLeads.filter(l => isWonStage(l.stage));
      return {
        name: point.name,
        leads: pointLeads.length,
        booked: booked.length,
        revenue: booked.reduce((sum, l) => sum + safeAmount(l.amount), 0)
      };
    });

    // Lead sources (Use all leads for global context, or filtered? Usually global is better for "Distribution", but let's stick to current period for focused view or keep global? 
    // The original code used ALL leads for Sources, Funnel, Employee Performance. 
    // Let's KEEP that behavior for now unless requested, but the revenue widget MUST respond to filter.
    // Wait, if I change the date range, I expect the dashboard to reflect that range. 
    // However, Funnels and Sources are often analyzed over longer periods.
    // The prompt specifically asked for "week/month/quarter/year btn... filterate the bussiness revenue".
    // I will filter Revenue and Leads widgets, but what about the others?
    // Usually a dashboard global filter applies to everything. 
    // Let's apply to everything for consistency, BUT the original code calculated metrics on ALL leads for some things.
    // I will apply the filter to the widgets clearly labeled with the period (which I will update).
    // For Source/Funnel/Employees, I will use `currentPeriodLeads` to make it responsive.

    const leadsToAnalyze = currentPeriodLeads; // Let's try making it fully responsive

    // Lead sources
    const leadsBySource = {};
    leadsToAnalyze.forEach((l) => {
      const source = l.source || 'Unknown';
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    // Conversion by source
    const conversionBySource = {};
    Object.keys(leadsBySource).forEach((source) => {
      const sourceLeads = leadsToAnalyze.filter((l) => (l.source || 'Unknown') === source);
      const booked = sourceLeads.filter((l) => isWonStage(l.stage)).length;
      conversionBySource[source] = sourceLeads.length > 0
        ? ((booked / sourceLeads.length) * 100).toFixed(1)
        : 0;
    });

    // Leads by stage (Funnel) - Wait, funnel usually needs all active leads, regardless of creation date?
    // No, strictly "New Leads created this week/month" vs "How many are currently in stage X".
    // Dashboards usually show "Pipeline right now" (Snapshot) OR "Performance over time".
    // Revenue is performance. Trends are performance.
    // Funnel is usually snapshot of *active* leads.
    // If I filter by "Last Year", showing current pipeline is weird.
    // If I filter by "Last Year", showing funnel of leads *created* last year makes sense.
    // I will use `leadsToAnalyze` (filtered by date) for consistency.

    const stageMapping = {
      'New Lead': 'New', 'Proposal': 'Quoted', 'Won': 'Booked', 'Negotiation': 'Negotiating'
    };

    const leadsByStage = {};
    STAGES.forEach((s) => (leadsByStage[s] = 0));
    leadsToAnalyze.forEach((l) => {
      const normalizedStage = stageMapping[l.stage] || l.stage;
      if (leadsByStage[normalizedStage] !== undefined) leadsByStage[normalizedStage]++;
    });

    // Employee stats
    const employeeStats = {};
    const employeeResponseTimes = {};
    leadsToAnalyze.forEach((l) => {
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
      if (l.responseTimeMinutes > 0) employeeResponseTimes[mgr].push(l.responseTimeMinutes);
    });
    // Calc averages...
    Object.keys(employeeStats).forEach((mgr) => {
      const times = employeeResponseTimes[mgr] || [];
      employeeStats[mgr].avgResponseTime = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;
    });

    // Overall response time
    const allResponseTimes = leadsToAnalyze
      .filter((l) => l.responseTimeMinutes > 0)
      .map((l) => l.responseTimeMinutes);
    const avgResponseTime = allResponseTimes.length > 0
      ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
      : null;

    // Revenue calculations
    const revenueInPeriod = currentPeriodLeads
      .filter((l) => isWonStage(l.stage))
      .reduce((sum, l) => sum + safeAmount(l.amount), 0);

    const previousRevenue = previousPeriodLeads
      .filter((l) => isWonStage(l.stage))
      .reduce((sum, l) => sum + safeAmount(l.amount), 0);

    // YTD Revenue (Always useful to have separately, or just use the filtered one if year selected)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const ytdLeads = leads.filter(l => {
      const d = parseLeadDate(l);
      return d && d >= startOfYear;
    });
    const ytdRevenue = ytdLeads
      .filter(l => isWonStage(l.stage))
      .reduce((sum, l) => sum + safeAmount(l.amount), 0);

    // Conversion Rate
    const bookedInPeriod = currentPeriodLeads.filter(l => isWonStage(l.stage));
    const conversionRate = currentPeriodLeads.length > 0
      ? ((bookedInPeriod.length / currentPeriodLeads.length) * 100).toFixed(1)
      : 0;

    // Stale leads (Always active leads, not dependent on date creation usually? Exclude from filter? 
    // "Stale leads" implies current action needed. I should probably NOT filter this by creation date of 2020.
    // So I will keep stale leads global or just 'active' leads.
    // The original code used `leads` (all). I'll keep it global for utility.)
    const staleLeads = leads.filter((l) => {
      if (!['New', 'Contacted'].includes(l.stage)) return false;
      const lastContact = l.lastContactedAt?.toDate?.() || l.createdAt?.toDate?.();
      if (!lastContact) return false;
      const hoursSince = (now - lastContact) / (1000 * 60 * 60);
      return hoursSince > 24;
    });

    const overduePayments = leads.filter(l => l.stage === 'Booked' && l.paymentStatus === 'overdue');

    return {
      totalLeads: leads.length,
      periodLeads: currentPeriodLeads.length,
      previousPeriodLeads: previousPeriodLeads.length,
      leadsBySource,
      conversionBySource,
      leadsByStage,
      employeeStats,

      revenueInPeriod,
      previousRevenue,
      ytdRevenue,

      conversionRate,
      trendData, // Was monthlyTrend
      staleLeads,
      overduePayments,
      avgResponseTime,
      revenueGrowth: previousRevenue > 0
        ? (((revenueInPeriod - previousRevenue) / previousRevenue) * 100).toFixed(1)
        : 0
    };
  }, [leads, dateRange]);

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
      case 'leads': return `${t('leadsThisMonth')} (${metrics.periodLeads})`;
      case 'conversion': return `${t('bookedLeads')} (${metrics.conversionRate}% ${t('conversionRate').toLowerCase()})`;
      case 'stale': return `${t('staleLeads')} (${metrics.staleLeads.length})`;
      case 'ytd': return `${t('revenueYtd')} - ${formatCurrency(metrics.ytdRevenue)}`;
      case 'source': return `${t('source')}: ${selectedSource}`;
      case 'funnel': return `${t('stage')}: ${selectedStage}`;
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
              <div className="p-8 text-center text-gray-400">{t('noBookingsFound').replace('bookings', 'leads')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3">{t('client')}</th>
                    <th className="px-4 py-3">{t('stage')}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t('source')}</th>
                    <th className="px-4 py-3 text-right">{t('amount')}</th>
                    <th className="px-4 py-3">{t('actions')}</th>
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
            {filteredLeads.length} {t('leads')} • {t('total')}: {formatCurrency(filteredLeads.reduce((sum, l) => sum + safeAmount(l.amount), 0))}
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            {t('ownerDashboard')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('welcomeBack')}, <span className="font-semibold text-gray-900">{/* currentUser?.name || */ 'Admin'}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex bg-white rounded-xl shadow-sm border p-1">
          {/* ... existing buttons ... */}
          <button
            onClick={() => setDateRange('week')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateRange === 'week' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            Week
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateRange === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            Month
          </button>
          <button
            onClick={() => setDateRange('quarter')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateRange === 'quarter' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            Quarter
          </button>
          <button
            onClick={() => setDateRange('year')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateRange === 'year' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            Year
          </button>
        </div>
      </div>



      {/* Stats Grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          {t('quickStats')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Revenue */}
          <div
            onClick={() => onShowRevenue && onShowRevenue()}
            className="bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-100 text-green-600 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${parseFloat(metrics.revenueGrowth) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {parseFloat(metrics.revenueGrowth) >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                {Math.abs(metrics.revenueGrowth)}%
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('revenue')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1 truncate">{formatCurrency(metrics.revenueInPeriod)}</h3>
            </div>
          </div>

          {/* Bookings */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('booked')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1">{metrics.periodLeads > 0 ? metrics.trendData.reduce((acc, curr) => acc + curr.booked, 0) : 0}</h3>
            </div>
          </div>

          {/* Active Leads */}
          <div
            onClick={() => setActiveModal('leads')}
            className="bg-white p-4 rounded-2xl border shadow-sm cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('activeLeads')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1">{metrics.periodLeads}</h3>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('conversionRate')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1">{metrics.conversionRate}%</h3>
            </div>
          </div>

          {/* YTD Revenue */}
          <div
            className="bg-white p-4 rounded-2xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveModal('ytd')}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('revenueYtd')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1 truncate">{formatCurrency(metrics.ytdRevenue)}</h3>
            </div>
          </div>

          {/* Avg Response Time */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl">
                <Timer className="w-5 h-5" />
              </div>
              {metrics.avgResponseTime !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${metrics.avgResponseTime <= 30 ? 'bg-green-100 text-green-700' : metrics.avgResponseTime <= 120 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {metrics.avgResponseTime <= 30 ? t('excellent') : metrics.avgResponseTime <= 120 ? t('good') : t('needsImprovement')}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium truncate">{t('avgResponseTime')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1">
                {metrics.avgResponseTime !== null ? (
                  metrics.avgResponseTime < 60
                    ? `${metrics.avgResponseTime}m`
                    : `${Math.round(metrics.avgResponseTime / 60)}h`
                ) : (
                  '—'
                )}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base">
            <BarChart3 className="w-4 h-4" /> {t('revenueLeadsTrend')}
          </h3>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={30} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Revenue'
                      ? [`${formatCurrency(value)}`, t('revenue')]
                      : [`${value.toLocaleString()} ${t('leads').toLowerCase()}`, t('leads')]
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
                  name={t('revenue')}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="leads"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.1}
                  name={t('leads')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Sources */}
        <div className="bg-white p-4 md:p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base">
            <PieChart className="w-4 h-4" /> {t('trafficSources')}
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
                <Tooltip formatter={(value, name) => [`${value.toLocaleString()} ${t('leads').toLowerCase()}`, name]} />
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
                <span className="truncate text-gray-600">{entry.name === 'Unknown' ? t('unknownSource') : entry.name}</span>
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
          <h3 className="font-bold text-gray-800 mb-4 text-sm md:text-base">{t('leadConversionFunnel')}</h3>
          <div className="space-y-2">
            {STAGES.filter((s) => s !== 'Lost').map((stage, i) => {
              const count = metrics.leadsByStage[stage] || 0;
              const maxCount = Math.max(...Object.values(metrics.leadsByStage));
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const colors = STAGE_COLORS[stage];

              // Translate stage name if possible separately? 
              // Or keep English stage names as they are constants?
              // The STAGES array is constants.js.
              // I should probably translate them.
              // stageMapping in metric calculation mapped them.
              // UI displays `stage`.
              // I will use `stage` as is for now, or use a helper if I had one.
              // Assuming English stages for now as translation keys for dynamic values is tricky without a map.

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
            <UserCheck className="w-4 h-4" /> {t('topPerformingEmployees')}
          </h3>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs md:text-sm min-w-[500px]">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pl-4 md:pl-0">{t('name')}</th>
                  <th className="pb-2 text-center">{t('leads')}</th>
                  <th className="pb-2 text-center">{t('booked')}</th>
                  <th className="pb-2 text-center">{t('convRateAbbr')}</th>
                  <th className="pb-2 text-center">{t('respTimeAbbr')}</th>
                  <th className="pb-2 text-right pr-4 md:pr-0">{t('revenue')}</th>
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
                        className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${Number(emp.conversion) >= 20
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
                          className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${emp.avgResponseTime <= 30
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
            <h3 className="font-bold text-base md:text-lg">{t('aiBusinessAssistant')}</h3>
            <p className="text-indigo-200 text-xs md:text-sm mt-1">
              {t('askAboutBusiness')}
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
                placeholder={t('typeQuestion')}
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
                <span className="hidden sm:inline">{t('askButton')}</span>
              </button>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              {[
                t('activeLeads'),
                t('staleLeads'),
                t('revenue')
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
      {
        (metrics.staleLeads.length > 0 || metrics.overduePayments.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.staleLeads.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
                <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-3 text-sm md:text-base">
                  <AlertTriangle className="w-4 h-4" /> {t('staleLeads')} ({metrics.staleLeads.length})
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
                  <AlertTriangle className="w-4 h-4" /> {t('overduePayments')} ({metrics.overduePayments.length})
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
        )
      }
    </div >
  );
}
