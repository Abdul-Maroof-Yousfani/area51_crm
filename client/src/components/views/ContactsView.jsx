import React, { useState } from 'react';
import { Search, UserPlus, MessageCircle, Phone, Mail, ChevronRight, Trash2 } from 'lucide-react';
import { getWhatsappLink } from '../../utils/helpers';
import { ContactModal } from '../modals';

export default function ContactsView({ contacts, onAddContact, onUpdateContact, onDeleteAllContacts }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  const filtered = contacts.filter(
    (c) =>
      c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

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

  const openContactDetail = (contact) => {
    setSelectedContact(contact);
  };

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
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
      <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Contacts Directory</h2>
          <p className="text-xs md:text-sm text-gray-500">{contacts.length} total contacts</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full sm:w-auto pl-10 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-lg text-sm"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Debug log */}
          {console.log('ContactsView render:', { contactsLength: contacts.length, hasDeleteHandler: !!onDeleteAllContacts })}

          {onDeleteAllContacts && (
            <button
              onClick={onDeleteAllContacts}
              className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 hover:bg-red-700 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete All</span>
            </button>
          )}
          < button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 md:gap-2 hover:bg-blue-700 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => openContactDetail(c)}
            className="bg-white p-3 rounded-xl border shadow-sm active:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" /> {c.phone}
                </p>
                {c.email && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3 h-3" /> {c.email}
                  </p>
                )}
              </div>
              <a
                href={getWhatsappLink(c.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-green-100 text-green-600 rounded-full"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No contacts found
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-gray-500 font-bold border-b">
            <tr>
              <th className="px-4 lg:px-6 py-4">Name</th>
              <th className="px-4 lg:px-6 py-4">Phone</th>
              <th className="px-4 lg:px-6 py-4 hidden lg:table-cell">Email</th>
              <th className="px-4 lg:px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td
                  className="px-4 lg:px-6 py-4 font-bold text-blue-600 cursor-pointer hover:underline"
                  onClick={() => openContactDetail(c)}
                >
                  {c.firstName} {c.lastName}
                </td>
                <td className="px-4 lg:px-6 py-4 font-mono text-gray-600">{c.phone}</td>
                <td className="px-4 lg:px-6 py-4 text-gray-500 hidden lg:table-cell">{c.email || '-'}</td>
                <td className="px-4 lg:px-6 py-4">
                  <button
                    onClick={() => window.open(getWhatsappLink(c.phone), '_blank')}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 text-center">
        Showing {filtered.length} of {contacts.length} contacts
      </p>
    </div >
  );
}
