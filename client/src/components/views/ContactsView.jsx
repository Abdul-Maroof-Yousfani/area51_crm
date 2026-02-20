import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Search, UserPlus, MessageCircle, Phone, Mail, Trash2, ChevronUp, ChevronDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Loader } from 'lucide-react';
import { getWhatsappLink } from '../../utils/helpers';
import { ContactModal } from '../modals';

export default function ContactsView({ contacts, loading, onAddContact, onUpdateContact, onDeleteContact, onDeleteAllContacts, searchContacts, loadMore, hasMore }) {
  // URL State
  const [searchParams, setSearchParams] = useSearchParams();
  const showModal = searchParams.get('modal') === 'new-contact';

  const selectedContactId = searchParams.get('contactId');
  const isEditing = searchParams.get('modal') === 'edit-contact'

  const selectedContact = useMemo(() => {
    if (!isEditing || !selectedContactId) return null;
    return contacts.find(c => c.id == selectedContactId) || null;
  }, [contacts, selectedContactId, isEditing]);

  const setShowModal = (show) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (show) newParams.set('modal', 'new-contact');
      else if (newParams.get('modal') === 'new-contact') newParams.delete('modal');
      return newParams;
    });
  };

  const setSelectedContact = (contact) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (contact) {
        newParams.set('modal', 'edit-contact');
        newParams.set('contactId', contact.id);
      } else {
        if (newParams.get('modal') === 'edit-contact') newParams.delete('modal');
        newParams.delete('contactId');
      }
      return newParams;
    });
  };
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  // Define columns for the table
  const columns = useMemo(() => [
    {
      id: 'name',
      accessorFn: row => `${row.firstName} ${row.lastName || ''}`.trim(),
      header: 'Name',
      cell: ({ row }) => (
        <button
          onClick={() => setSelectedContact(row.original)}
          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
        >
          {row.original.firstName} {row.original.lastName || ''}
        </button>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => (
        <span className="font-mono text-gray-600">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => (
        <span className="text-gray-500 truncate max-w-[200px] block">{getValue() || '-'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => {
        const date = getValue();
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.open(getWhatsappLink(row.original.phone), '_blank')}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteContact && onDeleteContact(row.original.id)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ], [onDeleteContact]);

  // Initialize the table
  const table = useReactTable({
    data: contacts,
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

  const handleSave = async (data) => {
    await onAddContact(data);
    setShowModal(false);
  };

  const handleUpdate = async (data) => {
    if (selectedContact && selectedContact.id) {
      await onUpdateContact(selectedContact.id, data);
    }
    setSelectedContact(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Add New Contact Modal */}
      {showModal && <ContactModal onClose={() => setShowModal(false)} onSave={handleSave} />}

      {/* Edit Contact Modal */}
      {selectedContact && (
        <ContactModal
          onClose={() => setSelectedContact(null)}
          onSave={handleUpdate}
          initialData={selectedContact}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Contacts Directory</h2>
          <p className="text-sm text-gray-500">{contacts.length} total contacts</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Search contacts..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          {/* Server-side Search Trigger */}
          {React.useEffect(() => {
            const timer = setTimeout(() => {
              if (searchContacts) searchContacts(globalFilter);
            }, 500);
            return () => clearTimeout(timer);
          }, [globalFilter, searchContacts])}
        </div>
        {onDeleteAllContacts && (
          <button
            onClick={onDeleteAllContacts}
            className="bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete All</span>
          </button>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Contact</span>
        </button>
      </div>
      {/* Mobile Card View */}
      <div className={`md:hidden space-y-2 ${loading ? 'opacity-70 pointer-events-none' : ''}`}>
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              onClick={() => setSelectedContact(row.original)}
              className="bg-white p-4 rounded-xl border shadow-sm active:bg-gray-50 cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">
                    {row.original.firstName} {row.original.lastName}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" /> {row.original.phone}
                  </p>
                  {row.original.email && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="w-3 h-3" /> {row.original.email}
                    </p>
                  )}
                </div>
                <a
                  href={getWhatsappLink(row.original.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-green-100 text-green-600 rounded-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>
          ))
        )}
        {!loading && table.getRowModel().rows.length === 0 && (
          <div className="text-center py-8 text-gray-400">No contacts found</div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className={`hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${loading ? 'opacity-70 pointer-events-none' : ''}`}>
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`px-5 py-4 text-left font-semibold text-gray-600 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors' : ''
                          }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-gray-400">
                              {header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <div className="w-4 h-4 opacity-0 group-hover:opacity-50">
                                  <ChevronUp className="w-4 h-4" />
                                </div>
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && table.getRowModel().rows.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No contacts found</p>
            <p className="text-sm mt-1">Add your first contact to get started</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {
        contacts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[10, 20, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">per page</span>
            </div>

            {/* Page Info */}
            <div className="text-sm text-gray-600">
              Page{' '}
              <span className="font-semibold text-gray-900">
                {table.getState().pagination.pageIndex + 1}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-900">
                {table.getPageCount()}
              </span>
              {' · '}
              <span className="text-gray-500">
                {table.getFilteredRowModel().rows.length} results
              </span>
            </div>

            {/* Navigation Buttons */}
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

              {/* Page Number Buttons */}
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
        )
      }
    </div >
  );
}
