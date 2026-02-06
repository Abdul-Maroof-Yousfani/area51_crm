import React, { useState, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  Calendar,
  User,
  ChevronRight,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  CalendarClock,
  CalendarPlus,
  Filter
} from 'lucide-react';
import { STAGE_COLORS } from '../../lib/constants';
import { getWhatsappLink } from '../../utils/helpers';
import { useLanguage } from '../../contexts/LanguageContext';
import { generateCallCalendarUrl, openInGoogleCalendar } from '../../utils/googleCalendar';
import { useGoogleCalendar } from '../../contexts/GoogleCalendarContext';

// Call outcome options
const CALL_OUTCOMES = [
  { id: 'connected_interested', label: 'Connected - Interested', labelUr: 'رابطہ ہوا - دلچسپی ہے', icon: CheckCircle, color: 'green' },
  { id: 'connected_not_interested', label: 'Connected - Not Interested', labelUr: 'رابطہ ہوا - دلچسپی نہیں', icon: XCircle, color: 'red' },
  { id: 'connected_callback', label: 'Connected - Callback Requested', labelUr: 'رابطہ ہوا - دوبارہ کال کریں', icon: PhoneCall, color: 'blue' },
  { id: 'no_answer', label: 'No Answer', labelUr: 'جواب نہیں', icon: PhoneMissed, color: 'amber' },
  { id: 'busy', label: 'Busy / Call Later', labelUr: 'مصروف / بعد میں کال کریں', icon: Clock, color: 'orange' },
  { id: 'wrong_number', label: 'Wrong Number', labelUr: 'غلط نمبر', icon: PhoneOff, color: 'gray' }
];

export default function CallListView({
  leads,
  currentUser,
  onLogCall,
  onSelectLead,
  onSaveLead
}) {
  const { t, language } = useLanguage();
  const { syncLeadEvent, shouldAutoSync } = useGoogleCalendar();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, overdue, today, upcoming
  const [callLog, setCallLog] = useState({
    outcome: '',
    notes: '',
    nextCallDate: '',
    nextCallTime: ''
  });
  const [saving, setSaving] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // Categorize leads by call status
  const callList = useMemo(() => {
    // Filter leads assigned to current user (or all for admin)
    const userLeads = currentUser?.role === 'Owner' || currentUser?.role === 'Admin'
      ? leads
      : leads.filter(l => l.manager === currentUser?.name);

    // Only include active leads (not Booked or Lost)
    const activeLeads = userLeads.filter(l =>
      l.stage !== 'Booked' && l.stage !== 'Lost'
    );

    const overdue = [];
    const todayCalls = [];
    const upcoming = [];
    const neverCalled = [];

    activeLeads.forEach(lead => {
      const nextCallDate = lead.nextCallDate;
      const lastCallDate = lead.lastCallDate;

      // If no call scheduled yet, it's a new lead needing first call
      if (!nextCallDate) {
        neverCalled.push({
          ...lead,
          callPriority: 'new',
          callStatus: 'New Lead - Never Called'
        });
        return;
      }

      // Compare dates
      if (nextCallDate < today) {
        overdue.push({
          ...lead,
          callPriority: 'overdue',
          callStatus: `Overdue: ${nextCallDate}`
        });
      } else if (nextCallDate === today) {
        todayCalls.push({
          ...lead,
          callPriority: 'today',
          callStatus: lead.nextCallTime ? `Today at ${lead.nextCallTime}` : 'Today'
        });
      } else {
        upcoming.push({
          ...lead,
          callPriority: 'upcoming',
          callStatus: `${nextCallDate}${lead.nextCallTime ? ` at ${lead.nextCallTime}` : ''}`
        });
      }
    });

    // Sort each category
    overdue.sort((a, b) => new Date(a.nextCallDate) - new Date(b.nextCallDate));
    todayCalls.sort((a, b) => {
      if (!a.nextCallTime) return 1;
      if (!b.nextCallTime) return -1;
      return a.nextCallTime.localeCompare(b.nextCallTime);
    });
    upcoming.sort((a, b) => {
      const dateCompare = new Date(a.nextCallDate) - new Date(b.nextCallDate);
      if (dateCompare !== 0) return dateCompare;
      if (!a.nextCallTime) return 1;
      if (!b.nextCallTime) return -1;
      return a.nextCallTime.localeCompare(b.nextCallTime);
    });
    neverCalled.sort((a, b) =>
      new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0)
    );

    return { overdue, today: todayCalls, upcoming, neverCalled };
  }, [leads, currentUser, today]);

  // Get filtered list based on filter type
  const filteredList = useMemo(() => {
    switch (filterType) {
      case 'overdue':
        return [...callList.overdue, ...callList.neverCalled];
      case 'today':
        return callList.today;
      case 'upcoming':
        return callList.upcoming;
      default:
        return [
          ...callList.overdue,
          ...callList.neverCalled,
          ...callList.today,
          ...callList.upcoming
        ];
    }
  }, [callList, filterType]);

  // Stats
  const stats = {
    overdue: callList.overdue.length + callList.neverCalled.length,
    today: callList.today.length,
    upcoming: callList.upcoming.length,
    total: callList.overdue.length + callList.neverCalled.length + callList.today.length + callList.upcoming.length
  };

  // Handle initiating a call
  const handleCallClick = (lead) => {
    setSelectedLead(lead);
    // Set default next call date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCallLog({
      outcome: '',
      notes: '',
      nextCallDate: tomorrow.toISOString().split('T')[0],
      nextCallTime: '10:00'
    });
    setShowLogModal(true);
  };

  // Save call log
  const handleSaveCall = async () => {
    if (!callLog.outcome) return;

    setSaving(true);
    try {
      await onLogCall(selectedLead.id, {
        outcome: callLog.outcome,
        notes: callLog.notes,
        nextCallDate: callLog.nextCallDate,
        nextCallTime: callLog.nextCallTime,
        calledAt: new Date().toISOString(),
        calledBy: currentUser?.name
      });

      // Auto-sync to Google Calendar if enabled and next call is scheduled
      if (callLog.nextCallDate && shouldAutoSync('call') && onSaveLead) {
        try {
          const updatedLead = {
            ...selectedLead,
            nextCallDate: callLog.nextCallDate,
            nextCallTime: callLog.nextCallTime,
            lastCallNotes: callLog.notes
          };
          await syncLeadEvent(updatedLead, 'call', onSaveLead);
        } catch (calendarError) {
          console.error('Calendar sync error:', calendarError);
        }
      }

      setShowLogModal(false);
      setSelectedLead(null);
    } catch (error) {
      console.error('Error saving call log:', error);
    }
    setSaving(false);
  };

  const getStageColor = (stage) => STAGE_COLORS[stage] || STAGE_COLORS['New'];

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'overdue':
        return 'border-l-4 border-l-red-500 bg-red-50';
      case 'new':
        return 'border-l-4 border-l-amber-500 bg-amber-50';
      case 'today':
        return 'border-l-4 border-l-blue-500 bg-blue-50';
      case 'upcoming':
        return 'border-l-4 border-l-gray-300 bg-white';
      default:
        return 'bg-white';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 rounded-xl mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {language === 'ur' ? 'کال لسٹ' : 'Call List'}
            </h1>
            <p className="text-orange-100 text-sm mt-1">
              {language === 'ur'
                ? `آج ${stats.today} کالز، ${stats.overdue} بقایا`
                : `${stats.today} calls today, ${stats.overdue} overdue`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => setFilterType('all')}
          className={`p-3 rounded-xl text-center transition-all ${
            filterType === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white border hover:border-gray-400'
          }`}
        >
          <p className="text-xl font-bold">{stats.total}</p>
          <p className="text-[10px] opacity-80">{language === 'ur' ? 'کل' : 'Total'}</p>
        </button>
        <button
          onClick={() => setFilterType('overdue')}
          className={`p-3 rounded-xl text-center transition-all ${
            filterType === 'overdue'
              ? 'bg-red-600 text-white'
              : 'bg-white border hover:border-red-400'
          }`}
        >
          <p className="text-xl font-bold">{stats.overdue}</p>
          <p className="text-[10px] opacity-80">{language === 'ur' ? 'بقایا' : 'Overdue'}</p>
        </button>
        <button
          onClick={() => setFilterType('today')}
          className={`p-3 rounded-xl text-center transition-all ${
            filterType === 'today'
              ? 'bg-blue-600 text-white'
              : 'bg-white border hover:border-blue-400'
          }`}
        >
          <p className="text-xl font-bold">{stats.today}</p>
          <p className="text-[10px] opacity-80">{language === 'ur' ? 'آج' : 'Today'}</p>
        </button>
        <button
          onClick={() => setFilterType('upcoming')}
          className={`p-3 rounded-xl text-center transition-all ${
            filterType === 'upcoming'
              ? 'bg-green-600 text-white'
              : 'bg-white border hover:border-green-400'
          }`}
        >
          <p className="text-xl font-bold">{stats.upcoming}</p>
          <p className="text-[10px] opacity-80">{language === 'ur' ? 'آنے والی' : 'Upcoming'}</p>
        </button>
      </div>

      {/* Call List */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />
            {filterType === 'all' && (language === 'ur' ? 'تمام کالز' : 'All Calls')}
            {filterType === 'overdue' && (language === 'ur' ? 'بقایا کالز' : 'Overdue Calls')}
            {filterType === 'today' && (language === 'ur' ? 'آج کی کالز' : "Today's Calls")}
            {filterType === 'upcoming' && (language === 'ur' ? 'آنے والی کالز' : 'Upcoming Calls')}
          </h2>
          <span className="text-sm text-gray-500">{filteredList.length} leads</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{language === 'ur' ? 'کوئی کال نہیں' : 'No calls scheduled'}</p>
            </div>
          ) : (
            filteredList.map((lead) => (
              <div
                key={lead.id}
                className={`p-4 border-b transition-colors hover:bg-gray-50 ${getPriorityStyles(lead.callPriority)}`}
              >
                <div className="flex items-center gap-3">
                  {/* Priority Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    lead.callPriority === 'overdue' ? 'bg-red-100' :
                    lead.callPriority === 'new' ? 'bg-amber-100' :
                    lead.callPriority === 'today' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    {lead.callPriority === 'overdue' && <AlertCircle className="w-5 h-5 text-red-600" />}
                    {lead.callPriority === 'new' && <User className="w-5 h-5 text-amber-600" />}
                    {lead.callPriority === 'today' && <Clock className="w-5 h-5 text-blue-600" />}
                    {lead.callPriority === 'upcoming' && <Calendar className="w-5 h-5 text-gray-500" />}
                  </div>

                  {/* Lead Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 truncate">{lead.clientName}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        getStageColor(lead.stage).bg
                      } ${getStageColor(lead.stage).text}`}>
                        {lead.stage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                    <p className={`text-xs mt-1 ${
                      lead.callPriority === 'overdue' ? 'text-red-600 font-medium' :
                      lead.callPriority === 'new' ? 'text-amber-600 font-medium' :
                      lead.callPriority === 'today' ? 'text-blue-600 font-medium' :
                      'text-gray-400'
                    }`}>
                      {lead.callPriority === 'new'
                        ? (language === 'ur' ? 'نیا لیڈ - پہلی کال کریں' : 'New Lead - Make First Call')
                        : lead.callStatus
                      }
                    </p>
                    {lead.lastCallOutcome && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last: {lead.lastCallOutcome} ({lead.lastCallDate})
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Add to Calendar - only show if call is scheduled */}
                    {lead.nextCallDate && (
                      <button
                        onClick={() => openInGoogleCalendar(generateCallCalendarUrl(lead))}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        title={language === 'ur' ? 'کیلنڈر میں شامل کریں' : 'Add to Calendar'}
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                    )}
                    <a
                      href={getWhatsappLink(lead.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleCallClick(lead)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm font-medium"
                    >
                      <Phone className="w-4 h-4" />
                      {language === 'ur' ? 'کال' : 'Call'}
                    </button>
                    <button
                      onClick={() => onSelectLead(lead)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="View Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Log Call Modal */}
      {showLogModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <PhoneCall className="w-5 h-5" />
                {language === 'ur' ? 'کال لاگ کریں' : 'Log Call'}
              </h3>
              <p className="text-blue-100 text-sm mt-1">{selectedLead.clientName} - {selectedLead.phone}</p>
            </div>

            {/* Quick Dial */}
            <div className="p-4 border-b bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">{language === 'ur' ? 'پہلے کال کریں:' : 'Make the call first:'}</p>
              <div className="flex gap-2">
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-center text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {language === 'ur' ? 'فون کال' : 'Phone Call'}
                </a>
                <a
                  href={getWhatsappLink(selectedLead.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-center text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            {/* Call Outcome */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'ur' ? 'کال کا نتیجہ' : 'Call Outcome'} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CALL_OUTCOMES.map((outcome) => {
                    const Icon = outcome.icon;
                    const isSelected = callLog.outcome === outcome.id;
                    return (
                      <button
                        key={outcome.id}
                        onClick={() => setCallLog({ ...callLog, outcome: outcome.id })}
                        className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-all ${
                          isSelected
                            ? `border-${outcome.color}-500 bg-${outcome.color}-50 text-${outcome.color}-700`
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? `text-${outcome.color}-600` : 'text-gray-400'}`} />
                        <span className="truncate">{language === 'ur' ? outcome.labelUr : outcome.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {language === 'ur' ? 'نوٹس' : 'Notes'}
                </label>
                <textarea
                  className="w-full p-3 border rounded-lg text-sm outline-none focus:border-blue-400 h-20 resize-none"
                  placeholder={language === 'ur' ? 'کال کی تفصیلات...' : 'Call details...'}
                  value={callLog.notes}
                  onChange={(e) => setCallLog({ ...callLog, notes: e.target.value })}
                />
              </div>

              {/* Schedule Next Call */}
              <div className="border-t pt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  {language === 'ur' ? 'اگلی کال شیڈول کریں' : 'Schedule Next Call'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="p-2 border rounded-lg text-sm outline-none focus:border-blue-400"
                    value={callLog.nextCallDate}
                    onChange={(e) => setCallLog({ ...callLog, nextCallDate: e.target.value })}
                    min={today}
                  />
                  <input
                    type="time"
                    className="p-2 border rounded-lg text-sm outline-none focus:border-blue-400"
                    value={callLog.nextCallTime}
                    onChange={(e) => setCallLog({ ...callLog, nextCallTime: e.target.value })}
                  />
                </div>
                {callLog.nextCallDate && (
                  <button
                    type="button"
                    onClick={() => openInGoogleCalendar(generateCallCalendarUrl({
                      ...selectedLead,
                      nextCallDate: callLog.nextCallDate,
                      nextCallTime: callLog.nextCallTime,
                      lastCallNotes: callLog.notes
                    }))}
                    className="mt-2 w-full py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-2 border border-blue-200"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    {language === 'ur' ? 'گوگل کیلنڈر میں شامل کریں' : 'Add to Google Calendar'}
                  </button>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowLogModal(false);
                  setSelectedLead(null);
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                {language === 'ur' ? 'منسوخ' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveCall}
                disabled={!callLog.outcome || saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? (language === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...')
                  : (language === 'ur' ? 'محفوظ کریں' : 'Save & Next')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
