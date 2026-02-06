import React, { useState, useMemo } from 'react';
import { Search, Upload, Plus, ArrowUpDown, ArrowUp, ArrowDown, Loader, Phone, Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import { STAGES, STAGE_COLORS } from '../../lib/constants';

export default function LeadsView({
  data,
  onSelectLead,
  onShowNewLead,
  uploading,
  onFileUpload,
  onTruncateLeads
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'inquiryDate', direction: 'desc' });

  const filteredData = useMemo(() => {
    return data
      .filter((item) => {
        const s = searchTerm.toLowerCase();
        const matchesSearch = (item.clientName || '').toLowerCase().includes(s);
        const matchesStatus =
          statusFilter === 'All'
            ? true
            : statusFilter === 'Pipeline'
            ? ['Proposal', 'Negotiation'].includes(item.stage)
            : item.stage === statusFilter;
        const matchesManager = managerFilter === 'All' || item.manager === managerFilter;
        let matchesDate = true;
        if (startDate && endDate) {
          const d = new Date(item.inquiryDate);
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = !isNaN(d) && d >= start && d <= end;
        }
        return matchesSearch && matchesStatus && matchesManager && matchesDate;
      })
      .sort((a, b) => {
        let valA = a[sortConfig.key],
          valB = b[sortConfig.key];
        if (sortConfig.key === 'amount') {
          valA = safeAmount(valA);
          valB = safeAmount(valB);
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [data, searchTerm, statusFilter, managerFilter, startDate, endDate, sortConfig]);

  const handleSort = (key) =>
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });

  const renderSortIcon = (k) =>
    sortConfig.key !== k ? (
      <ArrowUpDown className="w-3 h-3 md:w-4 md:h-4 text-gray-300" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
    );

  const uniqueManagers = [...new Set(data.map((d) => d.manager))];

  const getStageColor = (stage) => STAGE_COLORS[stage] || STAGE_COLORS['New'];

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Leads Toolbar */}
      <div className="flex flex-col gap-3 bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-10">
        {/* Top row - Search and Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-lg text-sm"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {uploading ? (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" /> Importing...
              </span>
            ) : (
              <label className="bg-green-600 hover:bg-green-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-md flex items-center gap-1 md:gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
                <input type="file" className="hidden" onChange={onFileUpload} />
              </label>
            )}
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-md flex items-center gap-1 md:gap-2"
              onClick={onTruncateLeads}
              title="Delete All Leads"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-md flex items-center gap-1 md:gap-2"
              onClick={onShowNewLead}
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Lead</span>
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 items-center overflow-x-auto">
          <select
            className="px-2 md:px-3 py-2 bg-slate-50 border rounded-lg text-xs md:text-sm font-medium"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Pipeline">Pipeline</option>
          </select>
          <select
            className="px-2 md:px-3 py-2 bg-slate-50 border rounded-lg text-xs md:text-sm font-medium"
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
          >
            <option value="All">All Managers</option>
            {uniqueManagers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {/* Date filter - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1">
            <span className="text-xs font-bold text-gray-500">DATE:</span>
            <input
              type="date"
              className="bg-transparent border-none text-sm p-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              className="bg-transparent border-none text-sm p-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-red-500"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {filteredData.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            className="bg-white p-3 rounded-xl border shadow-sm active:bg-gray-50"
          >
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 truncate">{lead.clientName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {lead.phone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    getStageColor(lead.stage).bg
                  } ${getStageColor(lead.stage).text}`}
                >
                  {lead.stage}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="text-sm font-bold text-green-600">{formatCurrency(lead.amount)}</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {lead.inquiryDate}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 font-bold border-b">
              <tr>
                <th
                  className="px-4 lg:px-6 py-3 cursor-pointer"
                  onClick={() => handleSort('clientName')}
                >
                  <span className="flex items-center gap-1">
                    Client {renderSortIcon('clientName')}
                  </span>
                </th>
                <th className="px-4 lg:px-6 py-3 cursor-pointer" onClick={() => handleSort('stage')}>
                  <span className="flex items-center gap-1">
                    Stage {renderSortIcon('stage')}
                  </span>
                </th>
                <th className="px-4 lg:px-6 py-3 cursor-pointer" onClick={() => handleSort('amount')}>
                  <span className="flex items-center gap-1">
                    Amount {renderSortIcon('amount')}
                  </span>
                </th>
                <th className="px-4 lg:px-6 py-3 cursor-pointer hidden lg:table-cell" onClick={() => handleSort('source')}>
                  <span className="flex items-center gap-1">
                    Source {renderSortIcon('source')}
                  </span>
                </th>
                <th
                  className="px-4 lg:px-6 py-3 cursor-pointer"
                  onClick={() => handleSort('inquiryDate')}
                >
                  <span className="flex items-center gap-1">
                    Date {renderSortIcon('inquiryDate')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredData.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 lg:px-6 py-3 font-bold">{lead.clientName}</td>
                  <td className="px-4 lg:px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStageColor(lead.stage).bg} ${getStageColor(lead.stage).text}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3">{formatCurrency(lead.amount)}</td>
                  <td className="px-4 lg:px-6 py-3 hidden lg:table-cell">
                    {lead.source && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {lead.source}
                      </span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 text-gray-500">{lead.inquiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 text-center">
        Showing {filteredData.length} of {data.length} leads
      </p>
    </div>
  );
}
