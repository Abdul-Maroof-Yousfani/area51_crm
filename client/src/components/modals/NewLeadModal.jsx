import React, { useState } from 'react';
import { X, Search, Plus, ChevronRight, User } from 'lucide-react';
import { STAGES, MANAGERS, EVENT_TYPES } from '../../lib/constants';
import ContactModal from './ContactModal';
import { contactService } from '../../services/api';

export default function NewLeadModal({ onClose, onSave, managers, contacts, onAddContact, sources, eventTypes }) {
  const [step, setStep] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactCreator, setShowContactCreator] = useState(false);
  const [formData, setFormData] = useState({
    manager: 'Unassigned',
    stage: 'New',
    quotationAmount: '',
    clientBudget: '',
    eventType: '',
    eventDate: '',
    inquiryDate: new Date().toISOString().split('T')[0],
    notes: '',
    source: ''
  });

  // Async search state
  const [searchedContacts, setSearchedContacts] = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounced search effect
  React.useEffect(() => {
    const search = async () => {
      if (!contactSearch) {
        setSearchedContacts([]);
        return;
      }
      setSearching(true);
      try {
        const result = await contactService.getAll(null, 5, contactSearch);
        setSearchedContacts(result.data);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(search, 400);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  const displayContacts = contactSearch ? searchedContacts : (contacts || []).slice(0, 5);

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setStep(2);
  };

  const handleCreateContact = async (data) => {
    const newContact = await onAddContact(data);
    if (newContact) {
      setSelectedContact(newContact);
      setShowContactCreator(false);
      setStep(2);
    }
  };

  const handleSubmit = () => {
    if (!selectedContact) return alert('Contact is required');

    // Validate client budget is filled
    if (!formData.clientBudget || formData.clientBudget === '') {
      return alert('Client Budget is required');
    }

    onSave({
      ...formData,
      contactId: selectedContact.id,
      clientName: `${selectedContact.firstName} ${selectedContact.lastName || ''}`.trim(),
      phone: selectedContact.phone,
      quotationAmount: Number(formData.quotationAmount) || 0,
      clientBudget: Number(formData.clientBudget)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {showContactCreator && (
        <ContactModal
          onClose={() => setShowContactCreator(false)}
          onSave={handleCreateContact}
        />
      )}
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">
            {step === 1 ? 'Step 1: Select Contact' : 'Step 2: Lead Details'}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Every lead must be linked to a contact. Search for an existing contact or create
                a new one.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-10 p-3 border rounded-xl bg-gray-50 outline-none"
                  placeholder="Search by name or 03..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searching && <p className="text-center text-xs text-gray-500">Searching...</p>}
                {displayContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleContactSelect(c)}
                    className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg cursor-pointer border border-transparent hover:border-blue-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {c.firstName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
                {!searching && displayContacts.length === 0 && contactSearch && (
                  <p className="text-center text-sm text-gray-400 py-2">No contacts found.</p>
                )}
              </div>
              <button
                onClick={() => setShowContactCreator(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create New Contact
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-blue-800 text-sm">
                    {selectedContact.firstName} {selectedContact.lastName}
                  </span>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-600 underline"
                >
                  Change
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Client Budget <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.clientBudget}
                    onChange={(e) => setFormData({ ...formData, clientBudget: e.target.value })}
                    placeholder="PKR"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Quotation Amount</label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.quotationAmount}
                    onChange={(e) => setFormData({ ...formData, quotationAmount: e.target.value })}
                    placeholder="PKR (based on budget)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Stage</label>
                  <select
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Manager</label>
                  <select
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  >
                    {([...new Set(managers || MANAGERS)]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Source</label>
                  <select
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="">Select Source</option>
                    {(sources || []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Date</label>
                  <input
                    type="date"
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Inquiry Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border rounded-lg mt-1"
                    value={formData.inquiryDate}
                    onChange={(e) => setFormData({ ...formData, inquiryDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Event Type</label>
                <select
                  className="w-full p-2 border rounded-lg mt-1"
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                >
                  <option value="">Select Event Type</option>
                  {([...new Set(eventTypes || EVENT_TYPES)]).map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
                <textarea
                  className="w-full p-2 border rounded-lg mt-1 h-20"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
              >
                Create Lead
              </button>
            </>
          )}
          {step === 1 && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div >
  );
}
