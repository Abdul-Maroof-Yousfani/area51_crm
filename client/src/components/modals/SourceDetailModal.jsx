import React, { useState, useMemo } from 'react';
import { X, TrendingUp, Users, DollarSign, Calendar, MapPin, Filter, Search, ChevronDown, ChevronUp, Zap, Phone, Mail } from 'lucide-react';

const formatCurrency = (amount) => {
  if (!amount) return 'Rs 0';
  if (amount >= 1000000) return `Rs ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `Rs ${(amount / 1000).toFixed(0)}k`;
  return `Rs ${amount}`;
};

const formatPercent = (value) => {
  if (!value || !isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
};

export default function SourceDetailModal({ source, leads, onClose, onSelectLead }) {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Filter leads for this source
  const sourceLeads = useMemo(() => {
    return leads.filter(l => l.source === source.name);
  }, [leads, source.name]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const total = sourceLeads.length;

    // Include all positive outcomes
    const bookedLeads = sourceLeads.filter(l =>
      ['Booked', 'Won', 'Completed'].includes(l.stage) ||
      ['Booked', 'Won', 'Completed'].includes(l.status)
    );

    const booked = bookedLeads.length;

    const totalRevenue = bookedLeads.reduce((sum, l) => {
      // Use finalAmount if available, otherwise amount
      const val = l.finalAmount || l.amount || 0;
      return sum + Number(val);
    }, 0);

    const conversionRate = total > 0 ? (booked / total) * 100 : 0;
    const avgDealSize = booked > 0 ? totalRevenue / booked : 0;

    return { total, booked, totalRevenue, conversionRate, avgDealSize };
  }, [sourceLeads]);

  // Campaign breakdown (for Meta leads)
  const campaignStats = useMemo(() => {
    const campaigns = {};

    sourceLeads.forEach(lead => {
      const campaignName = lead.meta?.campaign_name || 'Unknown Campaign';

      if (!campaigns[campaignName]) {
        campaigns[campaignName] = {
          name: campaignName,
          leads: [],
          booked: 0,
          totalRevenue: 0,
          platforms: new Set(),
          adSets: new Set(),
          ads: new Set()
        };
      }

      campaigns[campaignName].leads.push(lead);
      if (['Booked', 'Won', 'Completed'].includes(lead.stage) || ['Booked', 'Won', 'Completed'].includes(lead.status)) {
        campaigns[campaignName].booked++;
        campaigns[campaignName].totalRevenue += (lead.finalAmount || lead.amount || 0);
      }
      if (lead.meta?.platform) campaigns[campaignName].platforms.add(lead.meta.platform);
      if (lead.meta?.adset_name) campaigns[campaignName].adSets.add(lead.meta.adset_name);
      if (lead.meta?.ad_name) campaigns[campaignName].ads.add(lead.meta.ad_name);
    });

    return Object.values(campaigns)
      .map(c => ({
        ...c,
        count: c.leads.length,
        conversionRate: c.leads.length > 0 ? (c.booked / c.leads.length) * 100 : 0,
        avgDealSize: c.booked > 0 ? c.totalRevenue / c.booked : 0,
        platforms: Array.from(c.platforms),
        adSets: Array.from(c.adSets),
        ads: Array.from(c.ads)
      }))
      .sort((a, b) => b.count - a.count);
  }, [sourceLeads]);

  // Location breakdown
  const locationStats = useMemo(() => {
    const locations = {};

    sourceLeads.forEach(lead => {
      const city = lead.meta?.city || 'Unknown';

      if (!locations[city]) {
        locations[city] = { name: city, leads: [], booked: 0, totalRevenue: 0 };
      }

      locations[city].leads.push(lead);
      if (['Booked', 'Won', 'Completed'].includes(lead.stage) || ['Booked', 'Won', 'Completed'].includes(lead.status)) {
        locations[city].booked++;
        locations[city].totalRevenue += (lead.finalAmount || lead.amount || 0);
      }
    });

    return Object.values(locations)
      .map(l => ({
        ...l,
        count: l.leads.length,
        conversionRate: l.leads.length > 0 ? (l.booked / l.leads.length) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [sourceLeads]);

  // Filter leads based on selected campaign and search
  const filteredLeads = useMemo(() => {
    let filtered = sourceLeads;

    if (selectedCampaign) {
      filtered = filtered.filter(l =>
        (l.meta?.campaign_name || 'Unknown Campaign') === selectedCampaign
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.clientName?.toLowerCase().includes(query) ||
        l.phone?.includes(query) ||
        l.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [sourceLeads, selectedCampaign, searchQuery]);

  const toggleRowExpand = (campaignName) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(campaignName)) {
        next.delete(campaignName);
      } else {
        next.add(campaignName);
      }
      return next;
    });
  };

  const isMetaSource = source.name === 'Meta Lead Gen';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {source.isIntegration && (
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{source.name}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {overallStats.total} leads • {formatPercent(overallStats.conversionRate)} conversion
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border-b">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1 font-semibold uppercase">
              <Users className="w-4 h-4" /> Total Leads
            </div>
            <div className="text-2xl font-bold text-blue-900">{overallStats.total}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 text-xs mb-1 font-semibold uppercase">
              <TrendingUp className="w-4 h-4" /> Booked Deals
            </div>
            <div className="text-2xl font-bold text-emerald-900">{overallStats.booked}</div>
          </div>
          <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 shadow-sm">
            <div className="flex items-center gap-2 text-violet-600 text-xs mb-1 font-semibold uppercase">
              <DollarSign className="w-4 h-4" /> Total Revenue
            </div>
            <div className="text-xl md:text-2xl font-bold text-violet-900 truncate" title={formatCurrency(overallStats.totalRevenue)}>
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumSignificantDigits: 3 }).format(overallStats.totalRevenue)}
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 text-xs mb-1 font-semibold uppercase">
              <TrendingUp className="w-4 h-4" /> Avg Deal Size
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-900 truncate" title={formatCurrency(overallStats.avgDealSize)}>
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumSignificantDigits: 3 }).format(overallStats.avgDealSize)}
            </div>
          </div>
        </div>

        {/* Tabs - Only show for Meta source */}
        {isMetaSource && (
          <div className="flex gap-2 px-4 pt-4 bg-white border-b">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'campaigns'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('locations')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'locations'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Locations
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'leads'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              All Leads
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Campaign Breakdown Tab */}
          {(activeTab === 'campaigns' && isMetaSource) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                Campaign Performance
              </h3>

              {campaignStats.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No campaign data available</p>
                  <p className="text-xs mt-1">Leads imported before the update won't have campaign info</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3 text-center">Leads</th>
                        <th className="px-4 py-3 text-center">Booked</th>
                        <th className="px-4 py-3 text-center">Conv %</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                        <th className="px-4 py-3 text-right">Avg Deal</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {campaignStats.map((campaign) => (
                        <React.Fragment key={campaign.name}>
                          <tr
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedCampaign(campaign.name);
                              setActiveTab('leads');
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{campaign.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {campaign.platforms.join(', ')}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">{campaign.count}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {campaign.booked}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-medium ${campaign.conversionRate >= 5 ? 'text-green-600' :
                                  campaign.conversionRate >= 2 ? 'text-yellow-600' : 'text-red-500'
                                }`}>
                                {formatPercent(campaign.conversionRate)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {formatCurrency(campaign.totalRevenue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {formatCurrency(campaign.avgDealSize)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpand(campaign.name);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {expandedRows.has(campaign.name) ?
                                  <ChevronUp className="w-4 h-4 text-gray-400" /> :
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                }
                              </button>
                            </td>
                          </tr>
                          {expandedRows.has(campaign.name) && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Ad Sets:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {campaign.adSets.length > 0 ? campaign.adSets.map(adSet => (
                                        <span key={adSet} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                          {adSet}
                                        </span>
                                      )) : <span className="text-gray-400 text-xs">No data</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Ads:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {campaign.ads.length > 0 ? campaign.ads.map(ad => (
                                        <span key={ad} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                          {ad}
                                        </span>
                                      )) : <span className="text-gray-400 text-xs">No data</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Locations Tab */}
          {(activeTab === 'locations' && isMetaSource) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                Location Breakdown
              </h3>

              {locationStats.filter(l => l.name !== 'Unknown').length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No location data available</p>
                  <p className="text-xs mt-1">Configure city field in your Meta lead form</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {locationStats.map((location) => (
                    <div
                      key={location.name}
                      className="bg-white p-4 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        // Could filter by location
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{location.name}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-lg font-bold text-gray-900">{location.count}</div>
                          <div className="text-xs text-gray-500">Leads</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">{location.booked}</div>
                          <div className="text-xs text-gray-500">Booked</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${location.conversionRate >= 5 ? 'text-green-600' :
                              location.conversionRate >= 2 ? 'text-yellow-600' : 'text-red-500'
                            }`}>
                            {formatPercent(location.conversionRate)}
                          </div>
                          <div className="text-xs text-gray-500">Conv</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leads List Tab (or default for non-Meta sources) */}
          {(activeTab === 'leads' || !isMetaSource) && (
            <div className="space-y-3">
              {/* Filter Bar */}
              <div className="flex gap-3 items-center">
                {isMetaSource && selectedCampaign && (
                  <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">
                    <Filter className="w-4 h-4" />
                    {selectedCampaign}
                    <button
                      onClick={() => setSelectedCampaign(null)}
                      className="ml-1 hover:bg-blue-100 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {filteredLeads.length} leads
                </div>
              </div>

              {/* Leads Grid */}
              <div className="space-y-2">
                {filteredLeads.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No leads found</p>
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="bg-white p-4 rounded-xl border hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{lead.clientName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lead.stage === 'Booked' ? 'bg-green-100 text-green-700' :
                                lead.stage === 'Lost' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>
                              {lead.stage}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {lead.phone}
                              </span>
                            )}
                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {lead.email}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Custom Field Chips */}
                        <div className="flex items-center gap-2 ml-4">
                          {lead.budgetRange && (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                              {lead.budgetRange}
                            </span>
                          )}
                          {lead.eventDate && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(lead.eventDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          {lead.guests && (
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {lead.guests}
                            </span>
                          )}
                          {lead.amount > 0 && (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                              {formatCurrency(lead.amount)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta Campaign Info */}
                      {isMetaSource && lead.meta?.campaign_name && (
                        <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs text-gray-400">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{lead.meta.campaign_name}</span>
                          {lead.meta.platform && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded capitalize">{lead.meta.platform}</span>
                          )}
                          {lead.meta.ad_name && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded truncate max-w-[200px]">{lead.meta.ad_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
