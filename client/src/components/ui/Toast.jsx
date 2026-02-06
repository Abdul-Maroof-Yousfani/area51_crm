import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce-in ${
        type === 'success'
          ? 'bg-slate-900 text-green-400 border border-green-500'
          : 'bg-red-900 text-white border border-red-500'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="w-6 h-6" />
      ) : (
        <AlertCircle className="w-6 h-6" />
      )}
      <div>
        <p className="font-bold">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
