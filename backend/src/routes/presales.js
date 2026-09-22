import { Router } from 'express';
import { dashboardData } from '../data/dashboardData.js';
import { applyPsmFilterFallback } from '../lib/fallbacks.js';
import { timeframeOf } from '../lib/http.js';
import { buildDashboardFromLeads } from '../services/leadMapper.js';
import { getTimeframeFilter } from '../services/timeUtils.js';
import {
  getClosedContacts, getDealStages, getLeadOwnerChanges, getRecentCalls, getRecentContacts, getRecentLeads,
  getRecentStatusHistory
} from '../services/zohoClient.js';

// Pre Sales board: funnel, mandate, PSM performance and the lead details behind them.
export const presalesRoutes = Router();

presalesRoutes.get('/dashboard', async (request, response) => {
  try {
    const timeframe = timeframeOf(request);
    // Fetch back to the start of the comparison period so previous-period figures are complete.
    const window = getTimeframeFilter(timeframe);
    const leads = await getRecentLeads(window.previousStart ?? window.start);
    const dealIds = [...new Set(leads.map((lead) => lead.Converted_Deal?.id).filter(Boolean))];
    const dealStages = await getDealStages(dealIds).catch((error) => {
      console.error('Converted deal stages unavailable:', error.message);
      return new Map();
    });
    // Extra reads run side by side; if one fails the page still loads without it.
    //   contacts       qualified opportunities (mandate bar, Sales qualified)
    //   statusHistory  when each lead entered its current status (time in status)
    //   calls          call logs, for when each lead was last contacted
    //   closedContacts closures, dated by their Actual Closure Date
    const optional = (label, read, fallback) => read.catch((error) => {
      console.error(`${label} unavailable:`, error.message);
      return fallback;
    });
    const [contacts, statusHistory, calls, closedContacts] = await Promise.all([
      optional('Contacts (qualified opportunities)', getRecentContacts(window.previousStart ?? window.start), null),
      optional('Lead status history', getRecentStatusHistory(window.start), []),
      optional('Call logs', getRecentCalls(window.start), []),
      optional('Closed contacts', getClosedContacts(), [])
    ]);
    response.json(buildDashboardFromLeads(leads, request.query.psm, timeframe, dealStages, contacts, statusHistory, calls, closedContacts));
  } catch (error) {
    console.error('Error fetching leads, serving fallback:', error.message);
    const source = { ...dashboardData, meta: { ...dashboardData.meta, notice: error.message } };
    response.json(applyPsmFilterFallback(source, request.query.psm));
  }
});

// Latest reassignment of each lead (to whom, from whom, by whom, when), read from the Zoho Timeline.
// Takes up to 100 lead ids; `latest` is null for a lead that was never reassigned.
presalesRoutes.get('/lead-reassignments', async (request, response) => {
  const ids = String(request.query.ids ?? '').split(',').map((id) => id.trim()).filter((id) => /^\d{6,25}$/.test(id));
  if (!ids.length || ids.length > 100) return response.status(400).json({ error: 'ids must be 1 to 100 numeric lead ids' });
  const result = {};
  for (let index = 0; index < ids.length; index += 5) {
    await Promise.all(ids.slice(index, index + 5).map(async (id) => {
      try {
        const { changes, assigned } = await getLeadOwnerChanges(id);
        result[id] = { latest: changes[0] ?? null, count: changes.length, assigned };
      } catch (error) {
        console.error(`Timeline unavailable for lead ${id}:`, error.message);
        result[id] = { error: true };
      }
    }));
  }
  response.json(result);
});

presalesRoutes.get('/decision-queue', (request, response) => response.json(applyPsmFilterFallback(dashboardData, request.query.psm).decisions));
