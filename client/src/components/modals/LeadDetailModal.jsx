import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Edit3, MessageSquare, Sparkles, Save, Send, Loader, Clock, Zap, Users, Calendar, DollarSign, CalendarPlus, Phone, MapPin, Building, AlertCircle, CheckCircle } from 'lucide-react';
import { arrayUnion } from 'firebase/firestore';
import { STAGES, MANAGERS, VENUES, EVENT_TYPES } from '../../lib/constants';
import { getActivityMeta, formatActivityMessage, createActivityEntry, ACTIVITY_TYPES } from '../../utils/helpers';
import {
  generateSiteVisitCalendarUrl,
  generateCallCalendarUrl,
  generateEventCalendarUrl,
  openInGoogleCalendar
} from '../../utils/googleCalendar';
import { useGoogleCalendar } from '../../contexts/GoogleCalendarContext';

export default function LeadDetailModal({
  lead,
  currentUser,
  onClose,
  onSave,
  onOpenAi,
  sources,
  managers,
  eventTypes
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState({ ...lead });
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [stageChangeConfirm, setStageChangeConfirm] = useState(null); // { from, to }
  const [bookingConfirm, setBookingConfirm] = useState(null); // For booking confirmation modal
  const [bookingData, setBookingData] = useState({
    venue: '',
    eventDate: '',
    eventType: '',
    guests: '',
    finalAmount: '',
    advanceAmount: '',
    notes: ''
  });
  const activityEndRef = useRef(null);
  const { syncLeadEvent, shouldAutoSync } = useGoogleCalendar();

  useEffect(() => {
    if (activeTab === 'activity')
      activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTab, lead.activityLog]);

  const handleSave = async () => {
    setIsSaving(true);

    // Save the lead first
    await onSave(lead.id, formData);

    // Auto-sync calendar events if enabled
    try {
      // Check for site visit changes
      if (formData.siteVisitDate !== lead.siteVisitDate || formData.siteVisitTime !== lead.siteVisitTime) {
        if (shouldAutoSync('siteVisit')) {
          await syncLeadEvent({ ...formData, id: lead.id }, 'siteVisit', onSave);
        }
      }

      // Check for event date changes
      if (formData.eventDate !== lead.eventDate) {
        if (formData.stage === 'Booked' && shouldAutoSync('booking')) {
          await syncLeadEvent({ ...formData, id: lead.id }, 'booking', onSave);
        } else if (shouldAutoSync('event')) {
          await syncLeadEvent({ ...formData, id: lead.id }, 'event', onSave);
        }
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
    }

    setIsSaving(false);
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;

    // Create activity entry for the note
    const activityEntry = createActivityEntry(
      ACTIVITY_TYPES.NOTE_ADDED,
      { note: comment },
      currentUser.name
    );

    // Also keep backward compatibility with comments array
    const newComment = {
      text: comment,
      author: currentUser.name,
      timestamp: new Date().toISOString(),
      role: currentUser.role
    };

    setFormData((prev) => ({
      ...prev,
      comments: [...(prev.comments || []), newComment],
      activityLog: [...(prev.activityLog || []), activityEntry]
    }));

    await onSave(lead.id, {
      comments: arrayUnion(newComment),
      activityLog: arrayUnion(activityEntry)
    });
    setComment('');
  };

  const handleStageClick = (newStage) => {
    if (newStage === formData.stage) return; // Already on this stage

    // If moving to Booked, show booking confirmation modal
    if (newStage === 'Booked') {
      setBookingData({
        venue: formData.venue || '',
        eventDate: formData.eventDate || '',
        eventType: formData.eventType || '',
        guests: formData.guests || '',
        finalAmount: formData.amount || '',
        advanceAmount: formData.advancePaid || '',
        notes: formData.bookingNotes || ''
      });
      setBookingConfirm({ from: formData.stage, to: newStage });
    } else {
      setStageChangeConfirm({ from: formData.stage, to: newStage });
    }
  };

  const handleStageChangeConfirm = async () => {
    if (!stageChangeConfirm) return;

    const { from, to } = stageChangeConfirm;

    // Create activity entry for stage change
    const activityEntry = createActivityEntry(
      ACTIVITY_TYPES.STAGE_CHANGE,
      { from, to },
      currentUser.name
    );

    // Update form data with new stage and activity log
    setFormData((prev) => ({
      ...prev,
      stage: to,
      activityLog: [...(prev.activityLog || []), activityEntry]
    }));

    // Save to database
    await onSave(lead.id, {
      stage: to,
      stageUpdatedAt: new Date().toISOString(),
      stageUpdatedBy: currentUser.name,
      activityLog: arrayUnion(activityEntry)
    });

    // Close confirmation and switch to timeline
    setStageChangeConfirm(null);
    setActiveTab('activity');
  };

  const handleStageChangeCancel = () => {
    setStageChangeConfirm(null);
  };

  const handleBookingConfirm = async () => {
    if (!bookingConfirm) return;

    // Validate required fields
    if (!bookingData.venue || !bookingData.eventDate || !bookingData.finalAmount) {
      return; // Don't proceed if required fields are missing
    }

    const { from, to } = bookingConfirm;

    // Create activity entry for booking
    const activityEntry = createActivityEntry(
      ACTIVITY_TYPES.STAGE_CHANGE,
      {
        from,
        to,
        bookingDetails: {
          venue: bookingData.venue,
          eventDate: bookingData.eventDate,
          finalAmount: bookingData.finalAmount,
          advanceAmount: bookingData.advanceAmount
        }
      },
      currentUser.name
    );

    // Update form data with booking details
    const updatedData = {
      ...formData,
      stage: to,
      venue: bookingData.venue,
      eventDate: bookingData.eventDate,
      eventType: bookingData.eventType,
      guests: bookingData.guests,
      amount: Number(bookingData.finalAmount),
      advancePaid: Number(bookingData.advanceAmount) || 0,
      totalPaid: Number(bookingData.advanceAmount) || 0,
      totalDue: Number(bookingData.finalAmount) - (Number(bookingData.advanceAmount) || 0),
      bookingNotes: bookingData.notes,
      bookedAt: new Date().toISOString(),
      bookedBy: currentUser.name,
      activityLog: [...(formData.activityLog || []), activityEntry]
    };

    setFormData(updatedData);

    // Save to database
    await onSave(lead.id, {
      stage: to,
      venue: bookingData.venue,
      eventDate: bookingData.eventDate,
      eventType: bookingData.eventType,
      guests: bookingData.guests,
      amount: Number(bookingData.finalAmount),
      advancePaid: Number(bookingData.advanceAmount) || 0,
      totalPaid: Number(bookingData.advanceAmount) || 0,
      totalDue: Number(bookingData.finalAmount) - (Number(bookingData.advanceAmount) || 0),
      bookingNotes: bookingData.notes,
      bookedAt: new Date().toISOString(),
      bookedBy: currentUser.name,
      stageUpdatedAt: new Date().toISOString(),
      stageUpdatedBy: currentUser.name,
      activityLog: arrayUnion(activityEntry)
    });

    // Close confirmation and switch to timeline
    setBookingConfirm(null);
    setActiveTab('activity');
  };

  const handleBookingCancel = () => {
    setBookingConfirm(null);
  };

  const isBookingFormValid = bookingData.venue && bookingData.eventDate && bookingData.finalAmount;

  const sourceOptions = useMemo(() => {
    const list = [...(sources || [])];
    if (formData.source && !list.find((s) => s.name === formData.source)) {
      list.push({ id: 'temp', name: formData.source });
    }
    return list;
  }, [sources, formData.source]);

  // Combine activity log and comments for timeline
  const timeline = useMemo(() => {
    const items = [];

    // Add activity log entries
    (formData.activityLog || []).forEach((a) => {
      items.push({
        type: 'activity',
        data: a,
        timestamp: new Date(a.timestamp)
      });
    });

    // Add legacy comments that aren't in activity log
    (formData.comments || []).forEach((c) => {
      // Check if this comment is already in activity log
      const alreadyLogged = (formData.activityLog || []).some(
        (a) => a.type === ACTIVITY_TYPES.NOTE_ADDED && a.note === c.text
      );
      if (!alreadyLogged) {
        items.push({
          type: 'comment',
          data: c,
          timestamp: new Date(c.timestamp)
        });
      }
    });

    // Sort by timestamp descending (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [formData.activityLog, formData.comments]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in relative">
        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {formData.clientName}
              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full uppercase tracking-wider">
                {formData.stage}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAi(lead)}
              className="p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              title="Ask AI Assistant"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border-b border-gray-200 px-6 py-2 flex gap-2 overflow-x-auto">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => handleStageClick(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                formData.stage === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Stage Change Confirmation Dialog */}
        {stageChangeConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30 rounded-2xl">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 animate-scale-in">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Stage Change</h3>
              <p className="text-gray-600 mb-4">
                Move this lead from <span className="font-semibold text-gray-900">{stageChangeConfirm.from}</span> to{' '}
                <span className="font-semibold text-blue-600">{stageChangeConfirm.to}</span>?
              </p>
              <p className="text-xs text-gray-400 mb-4">This will be logged in the timeline.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleStageChangeCancel}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStageChangeConfirm}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Booking Confirmation Modal */}
        {bookingConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30 rounded-2xl overflow-y-auto py-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 animate-scale-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Confirm Booking</h3>
                    <p className="text-green-100 text-sm">Please verify all details before confirming</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {/* Client Info Summary */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-bold text-gray-900">{formData.clientName}</p>
                  <p className="text-sm text-gray-500">{formData.phone}</p>
                </div>

                {/* Venue Selection - Required */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VENUES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setBookingData({ ...bookingData, venue: v.id })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          bookingData.venue === v.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building className={`w-5 h-5 ${bookingData.venue === v.id ? 'text-green-600' : 'text-gray-400'}`} />
                          <div>
                            <p className={`font-medium ${bookingData.venue === v.id ? 'text-green-700' : 'text-gray-700'}`}>
                              {v.name}
                            </p>
                            <p className="text-xs text-gray-500">{v.label}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!bookingData.venue && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Please select a venue
                    </p>
                  )}
                </div>

                {/* Event Date - Required */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Event Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={`w-full p-2.5 border rounded-lg text-sm ${!bookingData.eventDate ? 'border-red-300' : 'border-gray-200'}`}
                    value={bookingData.eventDate}
                    onChange={(e) => setBookingData({ ...bookingData, eventDate: e.target.value })}
                  />
                </div>

                {/* Event Type & Guests */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Event Type</label>
                    <input
                      type="text"
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      value={bookingData.eventType}
                      onChange={(e) => setBookingData({ ...bookingData, eventType: e.target.value })}
                      placeholder="e.g., Wedding, Mehndi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Guests</label>
                    <input
                      type="text"
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      value={bookingData.guests}
                      onChange={(e) => setBookingData({ ...bookingData, guests: e.target.value })}
                      placeholder="e.g., 200"
                    />
                  </div>
                </div>

                {/* Final Amount - Required */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Final Invoice Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
                    <input
                      type="number"
                      className={`w-full p-2.5 pl-12 border rounded-lg text-sm ${!bookingData.finalAmount ? 'border-red-300' : 'border-gray-200'}`}
                      value={bookingData.finalAmount}
                      onChange={(e) => setBookingData({ ...bookingData, finalAmount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Advance Paid */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Advance Received</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">PKR</span>
                    <input
                      type="number"
                      className="w-full p-2.5 pl-12 border border-gray-200 rounded-lg text-sm"
                      value={bookingData.advanceAmount}
                      onChange={(e) => setBookingData({ ...bookingData, advanceAmount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  {bookingData.finalAmount && bookingData.advanceAmount && (
                    <p className="text-xs text-gray-500 mt-1">
                      Balance due: PKR {(Number(bookingData.finalAmount) - Number(bookingData.advanceAmount)).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Booking Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Booking Notes</label>
                  <textarea
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm h-20 resize-none"
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    placeholder="Special requirements, menu preferences, etc."
                  />
                </div>

                {/* Summary */}
                {isBookingFormValid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Booking Summary</p>
                    <div className="text-sm text-green-800 space-y-1">
                      <p><span className="text-green-600">Venue:</span> {VENUES.find(v => v.id === bookingData.venue)?.label}</p>
                      <p><span className="text-green-600">Date:</span> {new Date(bookingData.eventDate).toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p><span className="text-green-600">Amount:</span> PKR {Number(bookingData.finalAmount).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end rounded-b-xl">
                <button
                  onClick={handleBookingCancel}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBookingConfirm}
                  disabled={!isBookingFormValid}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isBookingFormValid
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden bg-slate-50">
          <div className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('details')}
              className={`text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${
                activeTab === 'details'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Edit3 className="w-4 h-4" /> Details
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${
                activeTab === 'activity'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-4 h-4" /> Timeline
              {timeline.length > 0 && (
                <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {timeline.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'details' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Meta Campaign Info - Show if lead has meta data */}
                {formData.meta && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                        Meta Campaign Info
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {formData.meta.campaign_name && (
                        <div>
                          <span className="text-gray-500 text-xs">Campaign</span>
                          <div className="font-medium text-gray-900">{formData.meta.campaign_name}</div>
                        </div>
                      )}
                      {formData.meta.adset_name && (
                        <div>
                          <span className="text-gray-500 text-xs">Ad Set</span>
                          <div className="font-medium text-gray-900">{formData.meta.adset_name}</div>
                        </div>
                      )}
                      {formData.meta.ad_name && (
                        <div>
                          <span className="text-gray-500 text-xs">Ad</span>
                          <div className="font-medium text-gray-900 truncate" title={formData.meta.ad_name}>
                            {formData.meta.ad_name}
                          </div>
                        </div>
                      )}
                      {formData.meta.platform && (
                        <div>
                          <span className="text-gray-500 text-xs">Platform</span>
                          <div className="font-medium text-gray-900 capitalize">{formData.meta.platform}</div>
                        </div>
                      )}
                      {formData.meta.form_name && (
                        <div>
                          <span className="text-gray-500 text-xs">Form</span>
                          <div className="font-medium text-gray-900">{formData.meta.form_name}</div>
                        </div>
                      )}
                      {formData.meta.city && (
                        <div>
                          <span className="text-gray-500 text-xs">City</span>
                          <div className="font-medium text-gray-900">{formData.meta.city}</div>
                        </div>
                      )}
                    </div>

                    {/* Custom Fields Chips */}
                    {(formData.budgetRange || formData.meta.budget_range || formData.meta.event_type) && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-blue-200">
                        {(formData.budgetRange || formData.meta.budget_range) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <DollarSign className="w-3 h-3" />
                            {formData.budgetRange || formData.meta.budget_range}
                          </span>
                        )}
                        {formData.meta.event_type && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {formData.meta.event_type}
                          </span>
                        )}
                        {formData.meta.guest_count && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            <Users className="w-3 h-3" />
                            {formData.meta.guest_count} guests
                          </span>
                        )}
                        {formData.meta.event_date && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            <Calendar className="w-3 h-3" />
                            {formData.meta.event_date}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">
                    Event Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Event Date</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm mt-1"
                        value={formData.eventDate}
                        onChange={(e) =>
                          setFormData({ ...formData, eventDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Guests</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm mt-1"
                        value={formData.guests}
                        onChange={(e) =>
                          setFormData({ ...formData, guests: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Budget</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm mt-1"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: Number(e.target.value) })
                        }
                        type="number"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Manager</label>
                      <select
                        className="w-full p-2 border rounded-lg text-sm mt-1 bg-white"
                        value={formData.manager}
                        onChange={(e) =>
                          setFormData({ ...formData, manager: e.target.value })
                        }
                      >
                        {(managers || MANAGERS).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Event Type</label>
                      <select
                        className="w-full p-2 border rounded-lg text-sm mt-1 bg-white"
                        value={formData.eventType || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, eventType: e.target.value })
                        }
                      >
                        <option value="">Select Event Type</option>
                        {(eventTypes || EVENT_TYPES).map((et) => (
                          <option key={et} value={et}>
                            {et}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Venue Preference</label>
                      <select
                        className="w-full p-2 border rounded-lg text-sm mt-1 bg-white"
                        value={formData.venue || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, venue: e.target.value })
                        }
                      >
                        <option value="">Select Venue</option>
                        {VENUES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Source</label>
                      <select
                        className="w-full p-2 border rounded-lg text-sm mt-1 bg-white"
                        value={formData.source || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, source: e.target.value })
                        }
                      >
                        <option value="">Unknown</option>
                        {sourceOptions.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Site Visit Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">
                    Site Visit
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Site Visit Date</label>
                      <input
                        type="date"
                        className="w-full p-2 border rounded-lg text-sm mt-1"
                        value={formData.siteVisitDate || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, siteVisitDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Site Visit Time</label>
                      <input
                        type="time"
                        className="w-full p-2 border rounded-lg text-sm mt-1"
                        value={formData.siteVisitTime || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, siteVisitTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Calendar Actions */}
                {(formData.eventDate || formData.siteVisitDate || formData.nextCallDate) && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <CalendarPlus className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                        Add to Google Calendar
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.siteVisitDate && (
                        <button
                          onClick={() => openInGoogleCalendar(generateSiteVisitCalendarUrl(formData))}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                          Site Visit
                          <span className="text-xs text-blue-500">
                            ({new Date(formData.siteVisitDate).toLocaleDateString()})
                          </span>
                        </button>
                      )}
                      {formData.nextCallDate && (
                        <button
                          onClick={() => openInGoogleCalendar(generateCallCalendarUrl(formData))}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 hover:border-green-300 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Scheduled Call
                          <span className="text-xs text-green-500">
                            ({new Date(formData.nextCallDate).toLocaleDateString()})
                          </span>
                        </button>
                      )}
                      {formData.eventDate && (
                        <button
                          onClick={() => openInGoogleCalendar(generateEventCalendarUrl(formData))}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 hover:border-purple-300 transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                          {formData.stage === 'Booked' ? 'Booking' : 'Event Date'}
                          <span className="text-xs text-purple-500">
                            ({new Date(formData.eventDate).toLocaleDateString()})
                          </span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-blue-500 mt-3">
                      Click to open Google Calendar with pre-filled event details
                    </p>
                  </div>
                )}

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">
                    Notes
                  </h3>
                  <textarea
                    className="w-full p-3 border rounded-lg text-sm h-32"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="flex flex-col h-full">
                {/* Timeline */}
                <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
                  {timeline.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No activity yet</p>
                      <p className="text-xs mt-1">Add a note below to start tracking</p>
                    </div>
                  ) : (
                    timeline.map((item, i) => {
                      if (item.type === 'activity') {
                        const meta = getActivityMeta(item.data.type);
                        return (
                          <div key={i} className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full bg-${meta.color}-100 flex items-center justify-center flex-shrink-0`}>
                              <span className="text-sm">{meta.icon}</span>
                            </div>
                            <div className="flex-1 bg-white p-3 rounded-xl border shadow-sm">
                              <p className="text-sm font-medium text-gray-900">
                                {formatActivityMessage(item.data)}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {item.data.user} • {item.timestamp.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      } else {
                        // Legacy comment
                        return (
                          <div key={i} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="flex-1 bg-white p-3 rounded-xl border shadow-sm">
                              <p className="text-sm text-gray-700">{item.data.text}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {item.data.author} • {item.timestamp.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                  <div ref={activityEndRef} />
                </div>

                {/* Add Note Input */}
                <div className="flex gap-2 pt-4 border-t">
                  <input
                    className="flex-1 p-3 rounded-xl border outline-none text-sm"
                    placeholder="Add note..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <button
                    onClick={handleAddComment}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2"
          >
            {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
