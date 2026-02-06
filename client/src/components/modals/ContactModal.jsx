import React, { useState } from 'react';
import { X } from 'lucide-react';
import { normalizePakPhone } from '../../utils/helpers';

export default function ContactModal({ onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(
    initialData || { firstName: '', lastName: '', phone: '', email: '', notes: '' }
  );
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!formData.firstName) {
      setError('First Name is required');
      return;
    }
    const normalized = normalizePakPhone(formData.phone);
    if (!normalized) {
      setError('Invalid Phone. Use 03XXXXXXXXX format.');
      return;
    }
    onSave({ ...formData, phone: normalized });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">
            {initialData ? 'Edit Contact' : 'Add New Contact'}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">First Name</label>
              <input
                className="w-full p-2 border rounded-lg mt-1"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Ali"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Last Name</label>
              <input
                className="w-full p-2 border rounded-lg mt-1"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Khan"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Phone (Pakistan)</label>
            <input
              className="w-full p-2 border rounded-lg mt-1"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="03001234567"
            />
            <p className="text-[10px] text-gray-400 mt-1">Format: 03XXXXXXXXX (11 Digits)</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Email (Optional)</label>
            <input
              className="w-full p-2 border rounded-lg mt-1"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ali@example.com"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
          >
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}
