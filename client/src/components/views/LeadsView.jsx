import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Search, Upload, Plus, Loader, Phone, Calendar, ChevronRight, Trash2, ChevronUp, ChevronDown, ChevronsLeft, ChevronLeft, ChevronsRight } from 'lucide-react';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import { STAGES, STAGE_COLORS } from '../../lib/constants';
import { useLanguage } from '../../contexts/LanguageContext';

export default function LeadsView({
  data,
  onSelectLead,
  onShowNewLead,
  uploading,
  onFileUpload,
  onTruncateLeads
}) {
  const { t } = useLanguage();
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sorting, setSorting] = useState([{ id: 'inquiryDate', desc: true }]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    return data.filter((item) => {
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
      return matchesStatus && matchesManager && matchesDate;
    });
  }, [data, statusFilter, managerFilter, startDate, endDate]);

  // Define columns
  const columns = useMemo(() => [
    {
      id: 'clientName',
      accessorKey: 'clientName',
      header: t('client'),
      cell: ({ row }) => (
        <button
          onClick={() => onSelectLead(row.original)}
          className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-left"
        >
          {row.original.clientName}
        </button>
      ),
    },
    {
      accessorKey: 'stage',
      header: t('stage'),
      cell: ({ getValue }) => {
        const stage = getValue();
        const color = STAGE_COLORS[stage] || STAGE_COLORS['New'];
        return (
          <span className={`px-2 py-1 rounded text-xs font-bold ${color.bg} ${color.text}`}>
            {stage}
          </span>
        );
      },
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ getValue }) => formatCurrency(getValue()),
      sortingFn: (rowA, rowB, columnId) => {
        return safeAmount(rowA.getValue(columnId)) - safeAmount(rowB.getValue(columnId));
      },
    },
    {
      accessorKey: 'source',
      header: t('source'),
      cell: ({ getValue }) => {
        const source = getValue();
        return source ? (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {source}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'inquiryDate',
      header: t('date'),
      cell: ({ getValue }) => (
        <span className="text-gray-500">{getValue()}</span>
      ),
    },
  ], [onSelectLead, t]);

  // Initialize table
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const uniqueManagers = [...new Set(data.map((d) => d.manager))];
  const getStageColor = (stage) => STAGE_COLORS[stage] || STAGE_COLORS['New'];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Toolbar */}
      <div className="flex flex-col gap-3 bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('allLeads')}</h2>
            <p className="text-sm text-gray-500">{data.length} {t('leads').toLowerCase()}</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder={t('searchLeads')}
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
            {uploading ? (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" /> {t('importing')}
              </span>
            ) : (
              <label className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-green-700 transition-colors whitespace-nowrap cursor-pointer">
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">{t('importCsv')}</span>
                <input type="file" className="hidden" onChange={onFileUpload} />
              </label>
            )}
            {onTruncateLeads && (
              <button
                onClick={onTruncateLeads}
                className="bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">{t('deleteAll')}</span>
              </button>
            )}
            <button
              onClick={onShowNewLead}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('addLead')}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="bg-slate-50 border border-gray-200 rounded-lg text-sm px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">{t('allStages')}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Pipeline">{t('pipeline')}</option>
          </select>
          <select
            className="bg-slate-50 border border-gray-200 rounded-lg text-sm px-3 py-2"
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
          >
            <option value="All">{t('allManagers')}</option>
            {uniqueManagers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-slate-50 border border-gray-200 rounded-lg text-sm px-3 py-2">
            <input
              type="date"
              className="bg-transparent border-none text-sm p-1"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
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
                className="text-xs text-red-500 px-2"
              >
                {t('clear')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            onClick={() => onSelectLead(row.original)}
            className="bg-white p-4 rounded-xl border shadow-sm active:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900">{row.original.clientName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {row.original.phone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStageColor(row.original.stage).bg
                    } ${getStageColor(row.original.stage).text}`}
                >
                  {row.original.stage}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="text-sm font-bold text-green-600">{formatCurrency(row.original.amount)}</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {row.original.inquiryDate}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-gray-200">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-2' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp className="w-4 h-4" />,
                            desc: <ChevronDown className="w-4 h-4" />,
                          }[header.column.getIsSorted()] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{t('show')}</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[10, 20, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">{t('perPage')}</span>
          </div>

          {/* Page Info */}
          <div className="text-sm text-gray-600">
            {t('page')}{' '}
            <span className="font-semibold text-gray-900">
              {table.getState().pagination.pageIndex + 1}
            </span>{' '}
            {t('of')}{' '}
            <span className="font-semibold text-gray-900">
              {table.getPageCount()}
            </span>
            {' · '}
            <span className="text-gray-500">
              {table.getFilteredRowModel().rows.length} {t('results')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="hidden sm:flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                const currentPage = table.getState().pagination.pageIndex;
                const totalPages = table.getPageCount();
                let pageNum;

                if (totalPages <= 5) {
                  pageNum = i;
                } else if (currentPage <= 2) {
                  pageNum = i;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => table.setPageIndex(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
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
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
