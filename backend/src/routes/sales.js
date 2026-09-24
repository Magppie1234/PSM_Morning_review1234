import { Router } from 'express';
import { EST_CLOSURE_FLOOR } from '../config/salesFunnel.js';
import { applyOwnerFilterFallback } from '../lib/fallbacks.js';
import { timeframeOf } from '../lib/http.js';
import { buildDesignDashboardFromDeals } from '../services/designMapper.js';
import { buildPdiDashboardFromDeals } from '../services/pdiMapper.js';
import { buildSalesFunnelBoard, estimateEndOf } from '../services/salesFunnelBoard.js';
import { buildSalesDashboardFromDeals } from '../services/salesMapper.js';
import { getTimeframeFilter, localDayKey } from '../services/timeUtils.js';
import { getClosedContacts, getEstimateContacts, getRecentContacts, getRecentDeals } from '../services/zohoClient.js';

// Boards built from Zoho Deals (Orders): Sales, Design and PDI / site.
export const salesRoutes = Router();

const dealsFor = (timeframe) => getRecentDeals(getTimeframeFilter(timeframe).start);

// A city is either "all", a bucket key, or one city's name. Anything longer or stranger than a real city
// name is dropped here, and buildSalesFunnelBoard falls back to "all" for a value the data does not know.
const CITY_QUERY = /^[\p{L}\s.'-]{1,60}$/u;
const cityOf = (request) => {
  const value = String(request.query.city ?? '').trim();
  return CITY_QUERY.test(value) ? value : 'all';
};

salesRoutes.get('/sales-dashboard', async (request, response) => {
  try {
    const timeframe = timeframeOf(request);
    response.json(buildSalesDashboardFromDeals(await dealsFor(timeframe), request.query.owner, timeframe));
  } catch (error) {
    console.error('Error fetching deals, serving fallback:', error.message);
    const { salesData } = await import('../data/salesData.js');
    response.json(applyOwnerFilterFallback(salesData, request.query.owner));
  }
});

salesRoutes.get('/design-dashboard', async (request, response) => {
  try {
    const timeframe = timeframeOf(request);
    response.json(buildDesignDashboardFromDeals(await dealsFor(timeframe), request.query.designer, timeframe));
  } catch (error) {
    console.error('Error fetching design deals:', error.message);
    response.status(502).json({ error: 'Zoho CRM design deal data could not be loaded.' });
  }
});

salesRoutes.get('/pdi-dashboard', async (request, response) => {
  try {
    const timeframe = timeframeOf(request);
    response.json(buildPdiDashboardFromDeals(await dealsFor(timeframe), {
      measurementFilter: request.query.measurement,
      applianceFilter: request.query.appliance,
      criticalityFilter: request.query.criticality,
      ownerFilter: request.query.owner,
      timeframe
    }));
  } catch (error) {
    console.error('Error fetching PDI deals:', error.message);
    response.status(502).json({ error: 'Zoho CRM PDI / Site deal data could not be loaded.' });
  }
});

// Lead generation and Sales performance, built from Zoho Contacts (qualified leads) rather than Deals.
// ?timeframe= any reporting period; ?city= all | DEL | HYD | OTHER | one city's name.
salesRoutes.get('/sales-funnel', async (request, response) => {
  const tf = getTimeframeFilter(timeframeOf(request));
  const city = cityOf(request);
  try {
    // Losing either extra read costs only the cards built from it, not the whole board.
    const optional = (label, read) => read.catch((error) => {
      console.error(`${label} unavailable:`, error.message);
      return [];
    });
    // The read must reach the later of today (for overdue) and the estimate card's own period end,
    // which runs past today on a month or quarter still in progress.
    const today = localDayKey(new Date());
    const estimateEnd = estimateEndOf(tf);
    const [contacts, closed, estimates] = await Promise.all([
      getRecentContacts(tf.start),
      // Closures are dated by their closure date, so they come from their own read.
      optional('Closed contacts', getClosedContacts()),
      // Estimates likewise: one read serves both the estimate card (its period) and the overdue card
      // (anything before today).
      optional('Est. closure contacts', getEstimateContacts(EST_CLOSURE_FLOOR, estimateEnd > today ? estimateEnd : today))
    ]);
    response.json(buildSalesFunnelBoard({ tf, contacts, closed, estimates, city }));
  } catch (error) {
    console.error('Error fetching sales funnel contacts, serving an empty board:', error.message);
    const notice = `Qualified leads (Zoho Contacts) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildSalesFunnelBoard({ tf, contacts: [], closed: [], estimates: [], city, notice }));
  }
});
