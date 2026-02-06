import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import {
  initGoogleCalendarApi,
  isSignedIn as checkGoogleSignedIn,
  createLeadCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventFieldName,
  loadGoogleScripts,
  setSelectedCalendar
} from '../utils/googleCalendar';

const GoogleCalendarContext = createContext(null);

export function GoogleCalendarProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Initialize Google Calendar API when settings are loaded
  useEffect(() => {
    const initCalendar = async () => {
      if (!settings?.googleCalendarEnabled || !settings?.googleCalendarClientId || !settings?.googleCalendarApiKey) {
        setIsInitialized(false);
        setIsConnected(false);
        return;
      }

      try {
        await loadGoogleScripts();
        await initGoogleCalendarApi(settings.googleCalendarClientId, settings.googleCalendarApiKey);
        setIsInitialized(true);
        setIsConnected(checkGoogleSignedIn());

        // Set the selected calendar from settings
        if (settings.googleCalendarSelectedId) {
          setSelectedCalendar(settings.googleCalendarSelectedId);
        }
      } catch (error) {
        console.error('Failed to initialize Google Calendar:', error);
        setIsInitialized(false);
        setIsConnected(false);
      }
    };

    initCalendar();
  }, [settings?.googleCalendarEnabled, settings?.googleCalendarClientId, settings?.googleCalendarApiKey]);

  // Check if auto-sync is enabled for a specific event type
  const shouldAutoSync = useCallback((eventType) => {
    if (!settings?.googleCalendarEnabled || !settings?.googleCalendarAutoSync) return false;
    if (!isConnected) return false;

    switch (eventType) {
      case 'siteVisit':
        return settings.googleCalendarSyncSiteVisits;
      case 'call':
        return settings.googleCalendarSyncCalls;
      case 'event':
        return settings.googleCalendarSyncEvents;
      case 'booking':
        return settings.googleCalendarSyncBookings;
      default:
        return false;
    }
  }, [settings, isConnected]);

  // Sync a lead event to Google Calendar
  const syncLeadEvent = useCallback(async (lead, eventType, onUpdateLead) => {
    if (!shouldAutoSync(eventType)) return null;

    const eventFieldName = getCalendarEventFieldName(eventType);
    const existingEventId = lead[eventFieldName];

    try {
      // Determine if we should create, update, or delete
      let hasDate = false;
      switch (eventType) {
        case 'siteVisit':
          hasDate = !!lead.siteVisitDate;
          break;
        case 'call':
          hasDate = !!lead.nextCallDate;
          break;
        case 'event':
        case 'booking':
          hasDate = !!lead.eventDate;
          break;
      }

      if (!hasDate) {
        // If date is removed, delete the calendar event
        if (existingEventId) {
          await deleteCalendarEvent(existingEventId);
          if (onUpdateLead) {
            await onUpdateLead(lead.id, { [eventFieldName]: null });
          }
        }
        return null;
      }

      if (existingEventId) {
        // Update existing event
        const eventData = getEventData(lead, eventType);
        await updateCalendarEvent(existingEventId, eventData);
        return existingEventId;
      } else {
        // Create new event
        const result = await createLeadCalendarEvent(lead, eventType);
        if (result?.id && onUpdateLead) {
          await onUpdateLead(lead.id, { [eventFieldName]: result.id });
        }
        return result?.id;
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      return null;
    }
  }, [shouldAutoSync]);

  // Remove a calendar event for a lead
  const removeLeadEvent = useCallback(async (lead, eventType, onUpdateLead) => {
    const eventFieldName = getCalendarEventFieldName(eventType);
    const existingEventId = lead[eventFieldName];

    if (!existingEventId) return;

    try {
      await deleteCalendarEvent(existingEventId);
      if (onUpdateLead) {
        await onUpdateLead(lead.id, { [eventFieldName]: null });
      }
    } catch (error) {
      console.error('Failed to remove calendar event:', error);
    }
  }, []);

  const value = {
    isEnabled: settings?.googleCalendarEnabled || false,
    isConnected,
    isInitialized,
    shouldAutoSync,
    syncLeadEvent,
    removeLeadEvent,
    settings
  };

  return (
    <GoogleCalendarContext.Provider value={value}>
      {children}
    </GoogleCalendarContext.Provider>
  );
}

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error('useGoogleCalendar must be used within a GoogleCalendarProvider');
  }
  return context;
}

// Helper to get event data based on type
function getEventData(lead, eventType) {
  switch (eventType) {
    case 'siteVisit':
      return {
        title: `🏠 Site Visit: ${lead.clientName}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nStage: ${lead.stage}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.siteVisitDate,
        startTime: lead.siteVisitTime || null,
        durationMinutes: 60
      };

    case 'call':
      return {
        title: `📞 Call: ${lead.clientName}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nStage: ${lead.stage}\n\nLast Call Notes:\n${lead.lastCallNotes || 'No previous notes'}`,
        startDate: lead.nextCallDate,
        startTime: lead.nextCallTime || '10:00',
        durationMinutes: 15
      };

    case 'event':
      return {
        title: `🎉 Event: ${lead.clientName} - ${lead.eventType || 'Booking'}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nEvent Type: ${lead.eventType || 'N/A'}\nGuests: ${lead.guests || 'N/A'}\nAmount: PKR ${lead.amount?.toLocaleString() || 'N/A'}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.eventDate,
        durationMinutes: 480
      };

    case 'booking':
      return {
        title: `✅ BOOKED: ${lead.clientName} - ${lead.eventType || 'Event'}`,
        description: `CONFIRMED BOOKING\n\nClient: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nEvent Type: ${lead.eventType || 'N/A'}\nGuests: ${lead.guests || 'N/A'}\nAmount: PKR ${lead.amount?.toLocaleString() || 'N/A'}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.eventDate,
        durationMinutes: 480
      };

    default:
      return null;
  }
}
