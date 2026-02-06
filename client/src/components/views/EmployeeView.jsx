import React, { useState, useMemo, useRef } from 'react';
import {
  MessageCircle,
  Phone,
  Calendar,
  Users,
  Send,
  Sparkles,
  User,
  ArrowLeft,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { STAGES, STAGE_COLORS } from '../../lib/constants';
import { formatCurrency, getWhatsappLink } from '../../utils/helpers';
import { handleAIQuery } from '../../services/ai';
import { useLanguage } from '../../contexts/LanguageContext';

export default function EmployeeView({
  leads,
  currentUser,
  onSelectLead,
  onStageChange,
  onAddNote
}) {
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState([]); // Chat history: [{role: 'user'|'assistant', content: string}]
  const [aiLoading, setAiLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const chatEndRef = useRef(null);

  const { language, t, isRTL } = useLanguage();

  // Filter leads assigned to current employee
  const myLeads = useMemo(() => {
    let filtered = leads.filter((l) => l.manager === currentUser?.name);

    if (filter === 'new') {
      filtered = filtered.filter((l) => l.stage === 'New');
    } else if (filter === 'followup') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter((l) => l.followUpDate === today);
    } else if (filter === 'sitevisit') {
      filtered = filtered.filter((l) => l.stage === 'Site Visit Scheduled');
    }

    return filtered.sort(
      (a, b) => new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0)
    );
  }, [leads, currentUser, filter]);

  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);

  // Stats
  const stats = useMemo(() => {
    const all = leads.filter((l) => l.manager === currentUser?.name);
    return {
      total: all.length,
      new: all.filter((l) => l.stage === 'New').length,
      siteVisits: all.filter((l) => l.stage === 'Site Visit Scheduled').length,
      booked: all.filter((l) => l.stage === 'Booked').length
    };
  }, [leads, currentUser]);

  // Handle AI query (supports both English and Urdu)
  // Uses unified handler with role-based scoping
  const handleAiSubmit = async () => {
    if (!aiQuery.trim()) return;
    const userMessage = aiQuery.trim();
    setAiQuery('');

    // Add user message to chat
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    // Use unified AI handler - automatically scopes data based on user role
    const response = await handleAIQuery(userMessage, currentUser, language);

    // Add assistant response to chat
    setAiMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setAiLoading(false);

    // Scroll to bottom
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const getStageColor = (stage) => STAGE_COLORS[stage] || STAGE_COLORS['New'];

  // Mobile: Show lead detail view
  if (selectedLead && window.innerWidth < 768) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Mobile Header */}
        <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center gap-3">
          <button
            onClick={() => setSelectedLeadId(null)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{selectedLead.clientName}</h2>
            <p className="text-sm text-gray-500">{selectedLead.phone}</p>
          </div>
          <a
            href={getWhatsappLink(selectedLead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        </div>

        {/* Stage Pills - Scrollable */}
        <div className="px-4 py-3 border-b overflow-x-auto">
          <div className="flex gap-2">
            {STAGES.filter((s) => s !== 'Lost').map((stage) => (
              <button
                key={stage}
                onClick={() => onStageChange(selectedLead.id, stage, selectedLead.stage)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedLead.stage === stage
                    ? `${getStageColor(stage).bg} ${getStageColor(stage).text} ring-2 ring-offset-1`
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Info Cards */}
        <div className="p-4 grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-[10px] text-blue-600 font-medium">{t('event')}</p>
            <p className="font-bold text-blue-900 text-sm truncate">{selectedLead.eventType || '-'}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-[10px] text-green-600 font-medium">{t('budget')}</p>
            <p className="font-bold text-green-900 text-sm truncate">
              {selectedLead.amount ? formatCurrency(selectedLead.amount) : '-'}
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <p className="text-[10px] text-purple-600 font-medium">{t('source')}</p>
            {selectedLead.source ? (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 truncate max-w-full">
                {selectedLead.source}
              </span>
            ) : (
              <p className="font-bold text-purple-900 text-sm">-</p>
            )}
          </div>
        </div>

        {/* Event Details */}
        <div className="px-4 pb-3 flex flex-wrap gap-3 text-sm text-gray-600">
          {selectedLead.eventDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" /> {selectedLead.eventDate}
            </span>
          )}
          {selectedLead.guests && (
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {selectedLead.guests} {t('guests')}
            </span>
          )}
        </div>

        {/* Notes/Activity */}
        <div className="flex-1 p-4 overflow-y-auto border-t">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{t('notesAndActivity')}</h3>
          {selectedLead.notes && (
            <div className="bg-yellow-50 p-3 rounded-lg mb-3 text-sm">
              {selectedLead.notes}
            </div>
          )}
          {selectedLead.comments?.map((c, i) => (
            <div key={i} className="mb-2 p-3 bg-gray-50 rounded-lg text-sm">
              <p>{c.text}</p>
              <p className="text-xs text-gray-400 mt-1">
                {c.author} • {new Date(c.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t bg-gray-50 flex gap-2 safe-area-bottom">
          <button
            onClick={() => onSelectLead(selectedLead)}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium"
          >
            {t('viewDetails')}
          </button>
          <button
            onClick={() => {
              if (selectedLead.stage !== 'Lost') {
                onStageChange(selectedLead.id, 'Lost', selectedLead.stage);
                setSelectedLeadId(null);
              }
            }}
            className="px-6 py-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium"
          >
            {t('lost')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Language Toggle */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-xl mb-4">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-xl font-bold truncate">{t('welcome')}، {currentUser?.name}</h1>
            <p className="text-emerald-100 text-xs md:text-sm mt-1">{t('yourLeadsAndMessages')}</p>
          </div>
          {/* AI Button - Mobile */}
          <button
            onClick={() => setShowAiPanel(true)}
            className="md:hidden p-2 bg-white/20 hover:bg-white/30 rounded-lg"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats - 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div
          onClick={() => setFilter('all')}
          className={`p-3 rounded-xl cursor-pointer transition-all ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border hover:border-blue-300'
          }`}
        >
          <p className="text-xl md:text-2xl font-bold">{stats.total}</p>
          <p className="text-xs opacity-80">{t('totalLeads')}</p>
        </div>
        <div
          onClick={() => setFilter('new')}
          className={`p-3 rounded-xl cursor-pointer transition-all ${
            filter === 'new' ? 'bg-green-600 text-white' : 'bg-white border hover:border-green-300'
          }`}
        >
          <p className="text-xl md:text-2xl font-bold">{stats.new}</p>
          <p className="text-xs opacity-80">{t('new')}</p>
        </div>
        <div
          onClick={() => setFilter('sitevisit')}
          className={`p-3 rounded-xl cursor-pointer transition-all ${
            filter === 'sitevisit'
              ? 'bg-purple-600 text-white'
              : 'bg-white border hover:border-purple-300'
          }`}
        >
          <p className="text-xl md:text-2xl font-bold">{stats.siteVisits}</p>
          <p className="text-xs opacity-80">{t('siteVisit')}</p>
        </div>
        <div className="p-3 rounded-xl bg-white border">
          <p className="text-xl md:text-2xl font-bold text-green-600">{stats.booked}</p>
          <p className="text-xs text-gray-500">{t('booked')}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Leads Inbox - Full width on mobile */}
        <div className="flex-1 md:w-1/3 md:flex-none bg-white rounded-xl border shadow-sm flex flex-col min-h-0">
          <div className="p-3 border-b bg-gray-50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> {t('inbox')}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {myLeads.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('noLeads')}</p>
              </div>
            ) : (
              myLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100 ${
                    selectedLeadId === lead.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate">{lead.clientName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 flex-shrink-0" /> {lead.phone}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                        getStageColor(lead.stage).bg
                      } ${getStageColor(lead.stage).text}`}
                    >
                      {lead.stage}
                    </span>
                  </div>
                  {lead.eventDate && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {lead.eventDate}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lead Detail - Hidden on mobile (shown as full screen above) */}
        <div className="hidden md:flex flex-1 bg-white rounded-xl border shadow-sm flex-col">
          {selectedLead ? (
            <>
              {/* Lead Header */}
              <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedLead.clientName}</h2>
                    <div className="flex gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedLead.phone}
                      </span>
                      {selectedLead.eventDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {selectedLead.eventDate}
                        </span>
                      )}
                      {selectedLead.guests && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {selectedLead.guests} {t('guests')}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={getWhatsappLink(selectedLead.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                </div>

                {/* Stage Pills */}
                <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
                  {STAGES.filter((s) => s !== 'Lost').map((stage) => (
                    <button
                      key={stage}
                      onClick={() => onStageChange(selectedLead.id, stage, selectedLead.stage)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                        selectedLead.stage === stage
                          ? `${getStageColor(stage).bg} ${getStageColor(stage).text} ring-2 ring-offset-1 ${getStageColor(stage).border}`
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lead Info Cards */}
              <div className="p-4 border-b grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">{t('event')}</p>
                  <p className="font-bold text-blue-900">{selectedLead.eventType || '-'}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">{t('budget')}</p>
                  <p className="font-bold text-green-900">
                    {selectedLead.amount ? formatCurrency(selectedLead.amount) : '-'}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">{t('source')}</p>
                  {selectedLead.source ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {selectedLead.source}
                    </span>
                  ) : (
                    <p className="font-bold text-purple-900">-</p>
                  )}
                </div>
              </div>

              {/* Notes/Activity */}
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-700 mb-3">{t('notesAndActivity')}</h3>
                {selectedLead.notes && (
                  <div className="bg-yellow-50 p-3 rounded-lg mb-3 text-sm">
                    {selectedLead.notes}
                  </div>
                )}
                {selectedLead.comments?.map((c, i) => (
                  <div key={i} className="mb-2 p-2 bg-gray-50 rounded text-sm">
                    <p>{c.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {c.author} • {new Date(c.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="p-3 border-t bg-gray-50 flex gap-2">
                <button
                  onClick={() => onSelectLead(selectedLead)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {t('viewDetails')}
                </button>
                <button
                  onClick={() => {
                    if (selectedLead.stage !== 'Lost') {
                      onStageChange(selectedLead.id, 'Lost', selectedLead.stage);
                    }
                  }}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200"
                >
                  {t('lost')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('selectLead')}</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant - Hidden on mobile, collapsible on desktop */}
        {aiPanelCollapsed ? (
          /* Collapsed: Floating button at bottom right */
          <button
            onClick={() => setAiPanelCollapsed(false)}
            className="hidden md:flex fixed bottom-6 right-6 items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all z-40"
          >
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="font-medium">{t('aiAssistant')}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          /* Expanded: Full sidebar */
          <div className="hidden md:flex w-80 bg-gradient-to-b from-indigo-900 to-slate-900 rounded-xl shadow-sm flex-col text-white">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  {t('aiAssistant')}
                </h2>
                {/* Collapse button */}
                <button
                  onClick={() => setAiPanelCollapsed(true)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Collapse AI Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-indigo-300 mt-1">{t('askInUrdu')}</p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {aiMessages.length === 0 ? (
                <div className="text-center text-indigo-300 text-sm">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{t('example')}</p>
                  <p className="text-xs mt-2 opacity-70">"{t('showTodayFollowups')}"</p>
                  <p className="text-xs opacity-70">"{t('whatIsLeadStatus')}"</p>
                  <p className="text-xs opacity-70">"{t('isDateAvailable')}"</p>
                </div>
              ) : (
                aiMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 ml-8'
                        : 'bg-white/10 mr-8'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))
              )}
              {aiLoading && (
                <div className="bg-white/10 rounded-lg p-3 mr-8">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-indigo-300 outline-none focus:border-indigo-400"
                  placeholder={t('typeQuestion')}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                <button
                  onClick={handleAiSubmit}
                  disabled={aiLoading}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {aiLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile AI Panel - Overlay */}
      {showAiPanel && (
        <div className="md:hidden fixed inset-0 z-50 bg-gradient-to-b from-indigo-900 to-slate-900 flex flex-col text-white">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              {t('aiAssistant')}
            </h2>
            <button
              onClick={() => setShowAiPanel(false)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {aiMessages.length === 0 ? (
              <div className="text-center text-indigo-300 text-sm py-8">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-4">{t('askInUrdu')}</p>
                <p className="text-xs opacity-70">"{t('showTodayFollowups')}"</p>
                <p className="text-xs opacity-70">"{t('whatIsLeadStatus')}"</p>
                <p className="text-xs opacity-70">"{t('isDateAvailable')}"</p>
              </div>
            ) : (
              aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 ml-8'
                      : 'bg-white/10 mr-8'
                  }`}
                >
                  {msg.content}
                </div>
              ))
            )}
            {aiLoading && (
              <div className="bg-white/10 rounded-lg p-4 mr-8">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-white/10 safe-area-bottom">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-base placeholder-indigo-300 outline-none focus:border-indigo-400"
                placeholder={t('typeQuestion')}
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <button
                onClick={handleAiSubmit}
                disabled={aiLoading}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
              >
                {aiLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
