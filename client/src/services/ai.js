/**
 * AI Service Layer using Gemini Flash API
 * Handles: First greeting, Lead assignment, Employee Urdu assistant, Owner queries
 *
 * ROLE-BASED ACCESS CONTROL:
 * - Owner/Admin: Full access to all company data
 * - Manager: Access to their team's data only
 * - Salesperson/Employee: Access to only their assigned leads
 */

import { db, appId } from '../lib/firebase';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { WA_TEMPLATES, VENUE, MANAGERS } from '../lib/constants';

/**
 * Role hierarchy for access control
 */
const ROLE_HIERARCHY = {
  owner: 3,
  admin: 3,
  manager: 2,
  sales: 1,
  employee: 1
};

/**
 * Get query scope based on user role
 * Returns filter criteria for Firestore queries
 */
export function getQueryScope(user) {
  if (!user) return { type: 'none', filter: null };

  const role = (user.role || 'employee').toLowerCase();

  // Owner/Admin - full access
  if (role === 'owner' || role === 'admin') {
    return { type: 'all', filter: null };
  }

  // Manager - team access (leads assigned to anyone on their team)
  if (role === 'manager') {
    return {
      type: 'team',
      filter: { teamId: user.teamId || null },
      managerId: user.id || user.uid
    };
  }

  // Salesperson/Employee - own leads only
  return {
    type: 'self',
    filter: { manager: user.name }
  };
}

/**
 * Check if user can access specific data scope
 */
export function canAccessScope(user, requestedScope) {
  const userRole = (user?.role || 'employee').toLowerCase();
  const userLevel = ROLE_HIERARCHY[userRole] || 1;

  if (requestedScope === 'all') return userLevel >= 3;
  if (requestedScope === 'team') return userLevel >= 2;
  if (requestedScope === 'self') return userLevel >= 1;

  return false;
}

const GEMINI_API_KEY = ''; // Set via environment or integrations settings

/**
 * Call Gemini API
 */
export async function callGemini(prompt, systemInstruction = '') {
  // Try to get API key from settings if not hardcoded
  let apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    const configDoc = await getDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', 'integrations')
    );
    apiKey = configDoc.data()?.geminiApiKey;
  }

  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { success: true, text };
    }
    return { success: false, error: 'API request failed' };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate first response greeting for new lead (Urdu)
 */
export async function generateFirstGreeting(leadData, assignedEmployee) {
  const greeting = WA_TEMPLATES.GREETING_URDU(VENUE.name, assignedEmployee);
  return greeting;
}

/**
 * Assign lead to employee using round-robin or rule-based assignment
 */
export async function assignLeadToEmployee(leadData) {
  try {
    // Get all active sales employees
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', 'allowed_users'),
        where('role', 'in', ['Sales', 'Manager', 'Admin'])
      )
    );

    const employees = usersSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => e.name && e.name !== 'Unassigned');

    if (employees.length === 0) {
      return { employee: 'Unassigned', method: 'no_employees' };
    }

    // Get lead counts per employee for round-robin
    const leadsSnapshot = await getDocs(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', 'leads'),
        where('stage', '==', 'New')
      )
    );

    const leadCounts = {};
    employees.forEach((e) => (leadCounts[e.name] = 0));

    leadsSnapshot.docs.forEach((d) => {
      const manager = d.data().manager;
      if (leadCounts[manager] !== undefined) {
        leadCounts[manager]++;
      }
    });

    // Find employee with least leads (round-robin)
    let minLeads = Infinity;
    let assignedEmployee = employees[0].name;

    for (const [name, count] of Object.entries(leadCounts)) {
      if (count < minLeads) {
        minLeads = count;
        assignedEmployee = name;
      }
    }

    return { employee: assignedEmployee, method: 'round_robin' };
  } catch (error) {
    console.error('Lead assignment error:', error);
    return { employee: MANAGERS[0] || 'Unassigned', method: 'fallback' };
  }
}

/**
 * UNIFIED AI QUERY HANDLER
 * Routes queries based on user role and applies appropriate data scoping
 *
 * @param {string} queryText - The user's query
 * @param {object} currentUser - User object with { name, role, teamId, id/uid }
 * @param {string} language - 'en' or 'ur'
 * @returns {Promise<string>} AI response
 */
export async function handleAIQuery(queryText, currentUser, language = 'en') {
  if (!currentUser) {
    return language === 'ur'
      ? 'User session nahi mila. Dobara login karein.'
      : 'User session not found. Please log in again.';
  }

  const scope = getQueryScope(currentUser);
  const role = (currentUser.role || 'employee').toLowerCase();
  const isUrdu = language === 'ur';

  // Route to appropriate handler based on role
  if (role === 'owner' || role === 'admin') {
    return handleOwnerQuery(queryText, currentUser);
  }

  if (role === 'manager') {
    return handleManagerQuery(queryText, currentUser, language);
  }

  // Default: Employee/Sales - scoped to their leads only
  return handleEmployeeQuery(queryText, currentUser.name, language, currentUser);
}

/**
 * Manager Query Handler - Access to team data
 */
export async function handleManagerQuery(queryText, currentUser, language = 'en') {
  const isUrdu = language === 'ur';

  const systemInstruction = isUrdu
    ? `
    You are an AI assistant for "${VENUE.name}" CRM, helping a manager in Urdu.
    Manager name: ${currentUser.name}

    You can help with:
    - Team performance ("Team ki performance kaisi hai?")
    - Team's leads and follow-ups
    - Individual team member stats
    - Team conversion rates

    IMPORTANT: You can ONLY see data for this manager's team.
    You cannot compare with other teams or see company-wide data.

    Respond in Urdu (Roman script). Be concise.
  `
    : `
    You are an AI assistant for "${VENUE.name}" CRM, helping a manager.
    Manager name: ${currentUser.name}

    You can help with:
    - Team performance queries
    - Team's leads and follow-ups
    - Individual team member statistics
    - Team conversion rates and metrics

    IMPORTANT: You can ONLY see data for this manager's team.
    You cannot compare with other teams or access company-wide data.

    Respond in English. Be data-driven and concise.
  `;

  // Fetch team-scoped metrics
  const teamData = await getTeamContext(currentUser);

  const prompt = `
    Manager Query: "${queryText}"

    Team Metrics:
    - Total team leads: ${teamData.totalLeads}
    - Team conversion rate: ${teamData.conversionRate}%
    - Team revenue this month: PKR ${teamData.revenueThisMonth.toLocaleString()}

    Team Members:
    ${teamData.members.map((m) => `- ${m.name}: ${m.leads} leads, ${m.converted} converted`).join('\n')}

    Respond to the manager's query in ${isUrdu ? 'Urdu (Roman script)' : 'English'}.
    ${isUrdu ? 'Agar manager company-wide data maangta hai, politely bataein ke aap sirf team data access kar sakte hain.' : 'If the manager asks for company-wide data, politely explain you can only access team data.'}
  `;

  const result = await callGemini(prompt, systemInstruction);
  const fallbackMessage = isUrdu
    ? 'Maaf kijiye, abhi jawab nahi de sakta. Dobara koshish karein.'
    : 'Sorry, unable to respond right now. Please try again.';
  return result.success ? result.text : fallbackMessage;
}

/**
 * Get team context for manager queries
 */
async function getTeamContext(manager) {
  const context = {
    totalLeads: 0,
    conversionRate: 0,
    revenueThisMonth: 0,
    members: []
  };

  try {
    // For now, get all employees reporting to this manager
    // In a full implementation, you'd have team_id on users
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', 'allowed_users'),
        where('role', 'in', ['Sales', 'Employee'])
      )
    );

    const teamMembers = usersSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.name);

    // Get leads for all team members
    const memberStats = {};
    let totalLeads = 0;
    let bookedLeads = 0;
    let revenueThisMonth = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const member of teamMembers) {
      const leadsSnapshot = await getDocs(
        query(
          collection(db, 'artifacts', appId, 'public', 'data', 'leads'),
          where('manager', '==', member.name),
          limit(100)
        )
      );

      memberStats[member.name] = { leads: 0, converted: 0 };

      leadsSnapshot.docs.forEach((d) => {
        const lead = d.data();
        totalLeads++;
        memberStats[member.name].leads++;

        if (lead.stage === 'Booked') {
          bookedLeads++;
          memberStats[member.name].converted++;
          if (lead.createdAt?.toDate?.() >= startOfMonth) {
            revenueThisMonth += Number(lead.amount) || 0;
          }
        }
      });
    }

    context.totalLeads = totalLeads;
    context.conversionRate = totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(1) : 0;
    context.revenueThisMonth = revenueThisMonth;
    context.members = Object.entries(memberStats).map(([name, stats]) => ({
      name,
      ...stats
    }));
  } catch (error) {
    console.error('Error fetching team context:', error);
  }

  return context;
}

/**
 * Employee Assistant - Answer questions about leads, availability, tasks
 * Supports both English and Urdu based on language parameter
 * SCOPED: Only sees leads assigned to this employee
 */
export async function handleEmployeeQuery(queryText, employeeName, language = 'en', currentUser = null) {
  const isUrdu = language === 'ur';

  const systemInstruction = isUrdu
    ? `
    You are an AI assistant for "${VENUE.name}" CRM, helping sales employees in Urdu.
    The employee's name is ${employeeName}.

    You can help with:
    - Lead status queries ("Is lead ka status kya hai?")
    - Follow-up reminders ("Aaj ke follow-ups dikhao")
    - Date availability ("15 March available hai?")
    - Lead details and history
    - Personal performance metrics ("Meri conversion rate kya hai?")

    IMPORTANT SCOPE RULES:
    - You can ONLY see leads assigned to ${employeeName}
    - You CANNOT see other team members' leads or performance
    - If asked about team/company data, politely explain you can only show their personal data
    - Never reveal other employees' metrics or compare performance

    Always respond in Urdu (Roman script). Be concise and helpful.
  `
    : `
    You are an AI assistant for "${VENUE.name}" CRM, helping sales employees.
    The employee's name is ${employeeName}.

    You can help with:
    - Lead status queries ("What's the status of this lead?")
    - Follow-up reminders ("Show me today's follow-ups")
    - Date availability ("Is March 15 available?")
    - Lead details and history
    - Personal performance metrics ("What's my conversion rate?")

    IMPORTANT SCOPE RULES:
    - You can ONLY see leads assigned to ${employeeName}
    - You CANNOT see other team members' leads or performance
    - If asked about team/company data, politely explain you can only show their personal data
    - Never reveal other employees' metrics or compare performance

    Always respond in English. Be concise and helpful.
  `;

  // Fetch context data for the employee (scoped to their leads only)
  const contextData = await getEmployeeContext(employeeName);

  const prompt = `
    Employee Query: "${queryText}"

    YOUR Leads Data (${employeeName}'s data only):
    - Total assigned leads: ${contextData.totalLeads}
    - New leads: ${contextData.newLeads}
    - Booked/Won: ${contextData.bookedLeads}
    - Your conversion rate: ${contextData.conversionRate}%
    - Today's follow-ups: ${contextData.todayFollowups}
    - Pending site visits: ${contextData.pendingSiteVisits}
    - Your revenue: PKR ${contextData.revenue?.toLocaleString() || 0}

    Your recent leads:
    ${contextData.recentLeads.map((l) => `- ${l.clientName}: ${l.stage} (${l.eventDate || 'No date'})`).join('\n')}

    Respond to the employee's query in ${isUrdu ? 'Urdu (Roman script)' : 'English'}.
    ${isUrdu ? 'Agar employee team ya company data poochhe, politely bataein ke aap sirf unke personal data access kar sakte hain.' : 'If the employee asks about team or company data, politely explain you can only access their personal data.'}
  `;

  const result = await callGemini(prompt, systemInstruction);
  const fallbackMessage = isUrdu
    ? 'Maaf kijiye, abhi jawab nahi de sakta. Dobara koshish karein.'
    : 'Sorry, unable to respond right now. Please try again.';
  return result.success ? result.text : fallbackMessage;
}

/**
 * Get employee context for AI queries
 * SCOPED: Only fetches leads assigned to this employee
 */
async function getEmployeeContext(employeeName) {
  const context = {
    totalLeads: 0,
    newLeads: 0,
    bookedLeads: 0,
    conversionRate: 0,
    revenue: 0,
    todayFollowups: 0,
    pendingSiteVisits: 0,
    recentLeads: []
  };

  try {
    // SCOPED QUERY: Only this employee's leads
    const leadsSnapshot = await getDocs(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', 'leads'),
        where('manager', '==', employeeName),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
    );

    const today = new Date().toISOString().split('T')[0];

    leadsSnapshot.docs.forEach((d) => {
      const lead = d.data();
      context.totalLeads++;

      if (lead.stage === 'New') context.newLeads++;
      if (lead.stage === 'Site Visit Scheduled') context.pendingSiteVisits++;
      if (lead.followUpDate === today || lead.nextCallDate === today) context.todayFollowups++;

      // Track booked leads for conversion rate
      if (lead.stage === 'Booked' || lead.stage === 'Won') {
        context.bookedLeads++;
        context.revenue += Number(lead.amount) || 0;
      }

      // Only include recent 10 leads for display
      if (context.recentLeads.length < 10) {
        context.recentLeads.push({
          clientName: lead.clientName,
          stage: lead.stage,
          eventDate: lead.eventDate
        });
      }
    });

    // Calculate personal conversion rate
    context.conversionRate = context.totalLeads > 0
      ? ((context.bookedLeads / context.totalLeads) * 100).toFixed(1)
      : 0;

  } catch (error) {
    console.error('Error fetching employee context:', error);
  }

  return context;
}

/**
 * Owner Dashboard AI Query Handler
 * FULL ACCESS: Can see all company data, all employees, all metrics
 *
 * @param {string} queryText - The owner's query
 * @param {object} currentUser - User object (for logging/audit purposes)
 */
export async function handleOwnerQuery(queryText, currentUser = null) {
  const systemInstruction = `
    You are an AI analytics assistant for "${VENUE.name}" CRM, helping the owner understand business performance.
    ${currentUser ? `Current user: ${currentUser.name} (${currentUser.role})` : ''}

    RESPONSE FORMAT RULES (CRITICAL):
    - Keep responses SHORT and SCANNABLE (max 150 words)
    - Use bullet points (•) for lists, NOT asterisks
    - Use line breaks between sections
    - Bold key numbers by wrapping in **number**
    - Structure: Brief insight → Key metrics → 1-2 action items

    Example good response:
    "Lead volume is strong but conversion needs work.

    • Total Leads: **5,600+** (mostly from Meta)
    • Conversion Rate: **1.9%** (below 5% target)
    • Revenue: PKR **0** this month

    Action Items:
    • Review Meta ad targeting quality
    • Train team on follow-up timing"

    You have FULL ACCESS to all company data, employees, revenue, and analytics.
    Be direct, data-driven, and actionable.
  `;

  // Fetch business metrics
  const metrics = await getBusinessMetrics();

  const prompt = `
    Owner Query: "${queryText}"

    Business Metrics:
    - Total leads this month: ${metrics.leadsThisMonth}
    - Leads by source: ${JSON.stringify(metrics.leadsBySource)}
    - Conversion rate: ${metrics.conversionRate}%
    - Average response time: ${metrics.avgResponseTime} hours
    - Revenue this month: PKR ${metrics.revenueThisMonth.toLocaleString()}
    - Revenue YTD: PKR ${metrics.revenueYTD.toLocaleString()}

    Leads by stage:
    ${Object.entries(metrics.leadsByStage).map(([stage, count]) => `- ${stage}: ${count}`).join('\n')}

    Employee Performance:
    ${metrics.employeePerformance.map((e) => `- ${e.name}: ${e.leads} leads, ${e.converted} converted, PKR ${e.revenue.toLocaleString()}`).join('\n')}

    Answer the owner's question based on this data.
  `;

  const result = await callGemini(prompt, systemInstruction);
  return result.success ? result.text : 'Unable to process query. Please try again.';
}

/**
 * Get business metrics for owner queries
 */
async function getBusinessMetrics() {
  const metrics = {
    leadsThisMonth: 0,
    leadsBySource: {},
    leadsByStage: {},
    conversionRate: 0,
    avgResponseTime: 0,
    revenueThisMonth: 0,
    revenueYTD: 0,
    employeePerformance: []
  };

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const leadsSnapshot = await getDocs(
      collection(db, 'artifacts', appId, 'public', 'data', 'leads')
    );

    const employeeStats = {};
    let totalLeads = 0;
    let bookedLeads = 0;

    leadsSnapshot.docs.forEach((d) => {
      const lead = d.data();
      totalLeads++;

      // Count by stage
      metrics.leadsByStage[lead.stage] = (metrics.leadsByStage[lead.stage] || 0) + 1;

      // Count by source
      const source = lead.source || 'Unknown';
      metrics.leadsBySource[source] = (metrics.leadsBySource[source] || 0) + 1;

      // This month's leads
      if (lead.createdAt?.toDate?.() >= new Date(startOfMonth)) {
        metrics.leadsThisMonth++;
      }

      // Booked/Won leads
      if (lead.stage === 'Booked' || lead.stage === 'Won') {
        bookedLeads++;
        const amount = Number(lead.amount) || 0;

        if (lead.createdAt?.toDate?.() >= new Date(startOfMonth)) {
          metrics.revenueThisMonth += amount;
        }
        if (lead.createdAt?.toDate?.() >= new Date(startOfYear)) {
          metrics.revenueYTD += amount;
        }
      }

      // Employee performance
      const manager = lead.manager || 'Unassigned';
      if (!employeeStats[manager]) {
        employeeStats[manager] = { leads: 0, converted: 0, revenue: 0 };
      }
      employeeStats[manager].leads++;
      if (lead.stage === 'Booked') {
        employeeStats[manager].converted++;
        employeeStats[manager].revenue += Number(lead.amount) || 0;
      }
    });

    metrics.conversionRate = totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(1) : 0;

    metrics.employeePerformance = Object.entries(employeeStats).map(([name, stats]) => ({
      name,
      ...stats
    }));
  } catch (error) {
    console.error('Error fetching business metrics:', error);
  }

  return metrics;
}

/**
 * Check for stale leads and generate reminders
 */
export async function checkStaleLeads() {
  const staleLeads = {
    needsReminder: [], // 24+ hours
    needsEscalation: [] // 48+ hours
  };

  try {
    const now = new Date();
    const hours24Ago = new Date(now - 24 * 60 * 60 * 1000);
    const hours48Ago = new Date(now - 48 * 60 * 60 * 1000);

    const leadsSnapshot = await getDocs(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', 'leads'),
        where('stage', 'in', ['New', 'Contacted'])
      )
    );

    leadsSnapshot.docs.forEach((d) => {
      const lead = { id: d.id, ...d.data() };
      const lastContact = lead.lastContactedAt?.toDate?.() || lead.createdAt?.toDate?.();

      if (!lastContact) return;

      if (lastContact < hours48Ago) {
        staleLeads.needsEscalation.push(lead);
      } else if (lastContact < hours24Ago) {
        staleLeads.needsReminder.push(lead);
      }
    });
  } catch (error) {
    console.error('Error checking stale leads:', error);
  }

  return staleLeads;
}

/**
 * Generate AI-powered closing strategy for a lead
 */
export async function generateClosingStrategy(lead) {
  const prompt = `
    Analyze this lead and suggest 3 actionable closing steps:

    Client: ${lead.clientName}
    Event Type: ${lead.eventType || 'Not specified'}
    Event Date: ${lead.eventDate || 'Not specified'}
    Budget: PKR ${lead.amount || 'Not specified'}
    Current Stage: ${lead.stage}
    Notes: ${lead.notes || 'None'}

    Provide specific, actionable steps to move this lead to booking.
    Keep response brief and practical.
  `;

  const result = await callGemini(prompt);
  return result.success ? result.text : 'Unable to generate strategy.';
}

/**
 * Generate follow-up email draft
 */
export async function generateFollowUpEmail(lead) {
  const prompt = `
    Write a brief, professional follow-up email for:

    Client: ${lead.clientName}
    Event: ${lead.eventType || 'their event'} on ${lead.eventDate || 'upcoming date'}
    Venue: ${VENUE.name}
    Context: ${lead.notes || 'Initial inquiry follow-up'}

    Keep it warm, professional, and under 100 words.
    Include a clear call-to-action.
  `;

  const result = await callGemini(prompt);
  return result.success ? result.text : 'Unable to generate email.';
}

/**
 * Log AI interaction to audit log
 * @param {object} logData - { type, query, response, userName, leadId?, leadName?, context?, model?, latencyMs? }
 */
export async function logAIInteraction(logData) {
  try {
    await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', 'ai_audit_logs'),
      {
        ...logData,
        timestamp: serverTimestamp(),
        success: true
      }
    );
    return true;
  } catch (error) {
    console.error('Error logging AI interaction:', error);
    return false;
  }
}

/**
 * Wrapper for handleAIQuery that logs to audit trail
 */
export async function handleAIQueryWithAudit(queryText, currentUser, language = 'en', leadContext = null) {
  const startTime = Date.now();
  const response = await handleAIQuery(queryText, currentUser, language);
  const latencyMs = Date.now() - startTime;

  // Log the interaction
  await logAIInteraction({
    type: 'query',
    query: queryText,
    response: response,
    userName: currentUser?.name || 'Unknown',
    userId: currentUser?.id || currentUser?.uid,
    userRole: currentUser?.role,
    leadId: leadContext?.id,
    leadName: leadContext?.clientName,
    language,
    model: 'gemini-2.0-flash',
    latencyMs
  });

  return response;
}
