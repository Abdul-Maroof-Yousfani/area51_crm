/**
 * Google Calendar Integration Utilities
 *
 * Provides two modes:
 * 1. Quick "Add to Calendar" links (no API needed)
 * 2. Full Google Calendar API sync (requires OAuth)
 */

// Google Calendar API configuration
const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Selected calendar ID (defaults to 'primary')
let selectedCalendarId = 'primary';

/**
 * Generate a Google Calendar "Add to Calendar" URL
 * Opens Google Calendar with pre-filled event details
 *
 * @param {Object} options - Event options
 * @param {string} options.title - Event title
 * @param {string} options.description - Event description
 * @param {string} options.location - Event location
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.startTime - Start time (HH:MM) - optional
 * @param {string} options.endDate - End date (YYYY-MM-DD) - optional, defaults to startDate
 * @param {string} options.endTime - End time (HH:MM) - optional
 * @param {number} options.durationMinutes - Duration in minutes (default: 60)
 * @returns {string} Google Calendar URL
 */
export function generateGoogleCalendarUrl({
  title,
  description = '',
  location = '',
  startDate,
  startTime = null,
  endDate = null,
  endTime = null,
  durationMinutes = 60
}) {
  const baseUrl = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams();

  params.set('action', 'TEMPLATE');
  params.set('text', title);

  if (description) {
    params.set('details', description);
  }

  if (location) {
    params.set('location', location);
  }

  // Format dates for Google Calendar
  // If time is provided, use datetime format: YYYYMMDDTHHmmss
  // If no time, use date-only format: YYYYMMDD

  const formatDate = (date) => date.replace(/-/g, '');
  const formatTime = (time) => time.replace(':', '') + '00';

  let dates;

  if (startTime) {
    // With time - use datetime format
    const startDateTime = `${formatDate(startDate)}T${formatTime(startTime)}`;

    // Calculate end time
    let endDateTime;
    if (endDate && endTime) {
      endDateTime = `${formatDate(endDate)}T${formatTime(endTime)}`;
    } else if (endTime) {
      endDateTime = `${formatDate(startDate)}T${formatTime(endTime)}`;
    } else {
      // Calculate end time based on duration
      const [hours, minutes] = startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + durationMinutes;
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      const calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
      endDateTime = `${formatDate(endDate || startDate)}T${formatTime(calculatedEndTime)}`;
    }

    dates = `${startDateTime}/${endDateTime}`;
  } else {
    // All-day event - use date-only format
    const start = formatDate(startDate);
    const end = formatDate(endDate || startDate);
    // For all-day events, end date should be the day after
    const endDateObj = new Date(endDate || startDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const adjustedEnd = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
    dates = `${start}/${adjustedEnd}`;
  }

  params.set('dates', dates);

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate calendar URL for a site visit
 */
export function generateSiteVisitCalendarUrl(lead) {
  const { clientName, phone, siteVisitDate, siteVisitTime, notes } = lead;

  return generateGoogleCalendarUrl({
    title: `🏠 Site Visit: ${clientName}`,
    description: `Client: ${clientName}\nPhone: ${phone || 'N/A'}\n\nNotes:\n${notes || 'No notes'}`,
    location: 'Area 51 Banquet Hall',
    startDate: siteVisitDate,
    startTime: siteVisitTime || null,
    durationMinutes: 60
  });
}

/**
 * Generate calendar URL for a scheduled call
 */
export function generateCallCalendarUrl(lead) {
  const { clientName, phone, nextCallDate, nextCallTime, lastCallNotes } = lead;

  return generateGoogleCalendarUrl({
    title: `📞 Call: ${clientName}`,
    description: `Client: ${clientName}\nPhone: ${phone || 'N/A'}\n\nLast Call Notes:\n${lastCallNotes || 'No previous notes'}`,
    startDate: nextCallDate,
    startTime: nextCallTime || '10:00',
    durationMinutes: 15
  });
}

/**
 * Generate calendar URL for the event/booking date
 */
export function generateEventCalendarUrl(lead) {
  const { clientName, phone, eventDate, eventType, guests, amount, notes } = lead;

  return generateGoogleCalendarUrl({
    title: `🎉 Event: ${clientName} - ${eventType || 'Booking'}`,
    description: `Client: ${clientName}\nPhone: ${phone || 'N/A'}\nEvent Type: ${eventType || 'N/A'}\nGuests: ${guests || 'N/A'}\nAmount: PKR ${amount?.toLocaleString() || 'N/A'}\n\nNotes:\n${notes || 'No notes'}`,
    location: 'Area 51 Banquet Hall',
    startDate: eventDate,
    durationMinutes: 480 // 8 hours for events
  });
}

/**
 * Generate calendar URL for a follow-up reminder
 */
export function generateFollowUpCalendarUrl(lead, followUpDate, followUpTime = null) {
  const { clientName, phone, stage, notes } = lead;

  return generateGoogleCalendarUrl({
    title: `📋 Follow-up: ${clientName}`,
    description: `Client: ${clientName}\nPhone: ${phone || 'N/A'}\nCurrent Stage: ${stage}\n\nNotes:\n${notes || 'No notes'}`,
    startDate: followUpDate,
    startTime: followUpTime || '10:00',
    durationMinutes: 15
  });
}

/**
 * Open Google Calendar URL in new tab
 */
export function openInGoogleCalendar(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================
// Google Calendar API Integration (OAuth)
// ============================================

let gapiInitialized = false;
let gisInitialized = false;
let tokenClient = null;

/**
 * Load Google API scripts dynamically
 */
export function loadGoogleScripts() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.gapi && window.google) {
      resolve();
      return;
    }

    // Load GAPI
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;

    // Load GIS (Google Identity Services)
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;

    let gapiLoaded = false;
    let gisLoaded = false;

    const checkBothLoaded = () => {
      if (gapiLoaded && gisLoaded) {
        resolve();
      }
    };

    gapiScript.onload = () => {
      gapiLoaded = true;
      checkBothLoaded();
    };

    gisScript.onload = () => {
      gisLoaded = true;
      checkBothLoaded();
    };

    gapiScript.onerror = reject;
    gisScript.onerror = reject;

    document.head.appendChild(gapiScript);
    document.head.appendChild(gisScript);
  });
}

/**
 * Initialize Google Calendar API
 * @param {string} clientId - Google OAuth Client ID
 * @param {string} apiKey - Google API Key
 */
export async function initGoogleCalendarApi(clientId, apiKey) {
  await loadGoogleScripts();

  // Initialize GAPI client
  await new Promise((resolve, reject) => {
    window.gapi.load('client', { callback: resolve, onerror: reject });
  });

  await window.gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: [GOOGLE_DISCOVERY_DOC],
  });

  gapiInitialized = true;

  // Initialize Google Identity Services
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_CALENDAR_SCOPES,
    callback: '', // Will be set when requesting token
  });

  gisInitialized = true;

  return { gapiInitialized, gisInitialized };
}

/**
 * Check if user is signed in
 */
export function isSignedIn() {
  return window.gapi?.client?.getToken() !== null;
}

/**
 * Request user authorization
 */
export function requestAuthorization() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Calendar API not initialized'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(response);
      } else {
        resolve(response);
      }
    };

    if (window.gapi.client.getToken() === null) {
      // Prompt user to select account and consent
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip consent if already authorized
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

/**
 * Sign out user
 */
export function signOut() {
  const token = window.gapi?.client?.getToken();
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
  }
  selectedCalendarId = 'primary';
}

/**
 * Set the calendar ID to use for syncing
 * @param {string} calendarId - Calendar ID (or 'primary' for default)
 */
export function setSelectedCalendar(calendarId) {
  selectedCalendarId = calendarId || 'primary';
}

/**
 * Get the currently selected calendar ID
 */
export function getSelectedCalendar() {
  return selectedCalendarId;
}

/**
 * Fetch list of user's calendars
 * @returns {Promise<Array>} List of calendars with id, name, and color
 */
export async function listCalendars() {
  if (!gapiInitialized) {
    throw new Error('Google Calendar API not initialized');
  }

  if (!isSignedIn()) {
    await requestAuthorization();
  }

  const response = await window.gapi.client.calendar.calendarList.list({
    minAccessRole: 'writer' // Only calendars user can write to
  });

  return response.result.items.map(cal => ({
    id: cal.id,
    name: cal.summary,
    description: cal.description || '',
    primary: cal.primary || false,
    backgroundColor: cal.backgroundColor
  }));
}

/**
 * Create a calendar event via API
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
export async function createCalendarEvent(eventData) {
  if (!gapiInitialized) {
    throw new Error('Google Calendar API not initialized');
  }

  if (!isSignedIn()) {
    await requestAuthorization();
  }

  const { title, description, location, startDate, startTime, endDate, endTime, durationMinutes = 60 } = eventData;

  let start, end;

  if (startTime) {
    // Timed event
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = endDate && endTime
      ? new Date(`${endDate}T${endTime}:00`)
      : new Date(startDateTime.getTime() + durationMinutes * 60000);

    start = { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Karachi' };
    end = { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Karachi' };
  } else {
    // All-day event
    start = { date: startDate };
    const endDateObj = new Date(endDate || startDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    end = { date: endDateObj.toISOString().split('T')[0] };
  }

  const event = {
    summary: title,
    description: description || '',
    location: location || '',
    start,
    end,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }
      ]
    }
  };

  const response = await window.gapi.client.calendar.events.insert({
    calendarId: selectedCalendarId,
    resource: event,
  });

  return response.result;
}

/**
 * Update a calendar event via API
 * @param {string} eventId - Google Calendar Event ID
 * @param {Object} eventData - Updated event data
 * @returns {Promise<Object>} Updated event
 */
export async function updateCalendarEvent(eventId, eventData) {
  if (!gapiInitialized) {
    throw new Error('Google Calendar API not initialized');
  }

  if (!isSignedIn()) {
    await requestAuthorization();
  }

  const { title, description, location, startDate, startTime, endDate, endTime, durationMinutes = 60 } = eventData;

  let start, end;

  if (startTime) {
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = endDate && endTime
      ? new Date(`${endDate}T${endTime}:00`)
      : new Date(startDateTime.getTime() + durationMinutes * 60000);

    start = { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Karachi' };
    end = { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Karachi' };
  } else {
    start = { date: startDate };
    const endDateObj = new Date(endDate || startDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    end = { date: endDateObj.toISOString().split('T')[0] };
  }

  const event = {
    summary: title,
    description: description || '',
    location: location || '',
    start,
    end,
  };

  const response = await window.gapi.client.calendar.events.update({
    calendarId: selectedCalendarId,
    eventId: eventId,
    resource: event,
  });

  return response.result;
}

/**
 * Delete a calendar event via API
 * @param {string} eventId - Google Calendar Event ID
 */
export async function deleteCalendarEvent(eventId) {
  if (!gapiInitialized) {
    throw new Error('Google Calendar API not initialized');
  }

  if (!isSignedIn()) {
    await requestAuthorization();
  }

  await window.gapi.client.calendar.events.delete({
    calendarId: selectedCalendarId,
    eventId: eventId,
  });
}

/**
 * Create event for a lead and store the event ID
 * @param {Object} lead - Lead data
 * @param {string} eventType - Type of event ('siteVisit', 'call', 'event', 'followUp')
 * @returns {Promise<Object>} Created event with ID
 */
export async function createLeadCalendarEvent(lead, eventType) {
  let eventData;

  switch (eventType) {
    case 'siteVisit':
      eventData = {
        title: `🏠 Site Visit: ${lead.clientName}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nStage: ${lead.stage}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.siteVisitDate,
        startTime: lead.siteVisitTime || null,
        durationMinutes: 60
      };
      break;

    case 'call':
      eventData = {
        title: `📞 Call: ${lead.clientName}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nStage: ${lead.stage}\n\nLast Call Notes:\n${lead.lastCallNotes || 'No previous notes'}`,
        startDate: lead.nextCallDate,
        startTime: lead.nextCallTime || '10:00',
        durationMinutes: 15
      };
      break;

    case 'event':
      eventData = {
        title: `🎉 Event: ${lead.clientName} - ${lead.eventType || 'Booking'}`,
        description: `Client: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nEvent Type: ${lead.eventType || 'N/A'}\nGuests: ${lead.guests || 'N/A'}\nAmount: PKR ${lead.amount?.toLocaleString() || 'N/A'}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.eventDate,
        durationMinutes: 480
      };
      break;

    case 'booking':
      eventData = {
        title: `✅ BOOKED: ${lead.clientName} - ${lead.eventType || 'Event'}`,
        description: `CONFIRMED BOOKING\n\nClient: ${lead.clientName}\nPhone: ${lead.phone || 'N/A'}\nEvent Type: ${lead.eventType || 'N/A'}\nGuests: ${lead.guests || 'N/A'}\nAmount: PKR ${lead.amount?.toLocaleString() || 'N/A'}\n\nNotes:\n${lead.notes || 'No notes'}`,
        location: 'Area 51 Banquet Hall',
        startDate: lead.eventDate,
        durationMinutes: 480
      };
      break;

    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }

  return await createCalendarEvent(eventData);
}

/**
 * Get calendar event field name for a lead event type
 */
export function getCalendarEventFieldName(eventType) {
  const fieldMap = {
    siteVisit: 'calendarEventIdSiteVisit',
    call: 'calendarEventIdCall',
    event: 'calendarEventIdEvent',
    booking: 'calendarEventIdBooking'
  };
  return fieldMap[eventType] || `calendarEventId${eventType}`;
}
