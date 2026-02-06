import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader } from 'lucide-react';
import { callGemini } from '../../utils/ai';

export default function LeadAssistantModal({ lead, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activeTab, setActiveTab] = useState('strategy');

  useEffect(() => {
    if (lead) generateStrategy();
  }, [lead]);

  const generateStrategy = async () => {
    setLoading(true);
    const prompt = `Analyze lead: ${lead.clientName}, ${lead.eventType}, ${lead.amount}, Stage: ${lead.stage}, Notes: ${lead.notes}. Suggest 3 closing steps.`;
    setResult(await callGemini(prompt));
    setLoading(false);
  };

  const generateEmail = async () => {
    setLoading(true);
    const prompt = `Write a follow-up email for lead: ${lead.clientName}, ${lead.eventType}, Date: ${lead.eventDate}. Context: ${lead.notes}. Keep it short and professional.`;
    setResult(await callGemini(prompt));
    setLoading(false);
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <h2 className="font-bold text-lg">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => {
              setActiveTab('strategy');
              generateStrategy();
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'strategy'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Strategy
          </button>
          <button
            onClick={() => {
              setActiveTab('email');
              generateEmail();
            }}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'email'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Email Draft
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-3">
              <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-sm text-gray-500 animate-pulse">Thinking...</span>
            </div>
          ) : (
            <div className="prose prose-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(result)}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            Copy Result
          </button>
        </div>
      </div>
    </div>
  );
}
