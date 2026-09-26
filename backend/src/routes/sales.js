import { Router } from 'express';
import { EST_CLOSURE_FLOOR } from '../config/salesFunnel.js';
import { applyOwnerFilterFallback } from '../lib/fallbacks.js';
import { timeframeOf } from '../lib/http.js';
import { buildDesignDashboardFromDeals } from '../services/designMapper.js';
import { loadPdiReview } from '../services/pdiReview.js';
import { buildPreDesignBoard, getPreDesignDeals } from '../services/preDesignBoard.js';
import { buildPostDesignBoard, getPostDesignDeals } from '../services/postDesignBoard.js';
import { buildSalesEfficiency } from '../services/salesEfficiency.js';
import { buildSalesFunnelBoard, estimateEndOf } from '../services/salesFunnelBoard.js';
import { buildSalesDashboardFromDeals } from '../services/salesMapper.js';
import { getTimeframeFilter, localDayKey } from '../services/timeUtils.js';
import {
  getClosedContacts, getEarliestContactDate, getEfficiencyContacts, getEfficiencyDeals,
  getEstimateContacts, getRecentContacts, getRecentDeals
} from '../services/zohoClient.js';

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

salesRoutes.get('/post-design-dashboard', async (request, response) => {
  try {
    const tf = getTimeframeFilter(timeframeOf(request));
    response.json(buildPostDesignBoard({ deals: await getPostDesignDeals(tf.start), tf }));
  } catch (error) {
    console.error('Post Design read failed:', error.message);
    response.status(502).json({ error: 'Post Design could not be read from Zoho. Retry or choose a shorter reporting period.' });
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

// The Design board's pre-design funnel, built from Zoho Deals (Orders): square feet sent in for design
// → first fresh design → revisions against the three-revision limit → booked → handed over.
// Same query contract as /sales-funnel: ?timeframe= any reporting period,
// ?city= all | DEL | HYD | OTHER | one city's name.
salesRoutes.get('/pre-design-funnel', async (request, response) => {
  const tf = getTimeframeFilter(timeframeOf(request));
  const city = cityOf(request);
  try {
    // Back to the start of the comparison window, not the period's own start, so every card's
    // "vs last period" figure is counted from a complete window.
    const deals = await getPreDesignDeals(tf.previousStart ?? tf.start);
    response.json(buildPreDesignBoard({ tf, deals, city }));
  } catch (error) {
    // Never throw to the client: the same shape comes back with zeros and a notice on it.
    console.error('Error fetching pre-design deals, serving an empty funnel:', error.message);
    const notice = `Orders (Zoho Deals) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildPreDesignBoard({ tf, deals: [], city, notice }));
  }
});

salesRoutes.get('/pdi-dashboard', async (request, response) => {
  try {
    const timeframe = timeframeOf(request);
    response.json(await loadPdiReview(getTimeframeFilter(timeframe)));
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
    const [contacts, closed, estimates, dataFrom] = await Promise.all([
      // Back to the start of the comparison window rather than the period's own start, so every card's
      // "vs last period" figure is counted from a complete window.
      getRecentContacts(tf.previousStart ?? tf.start),
      // Closures are dated by their closure date, so they come from their own read.
      optional('Closed contacts', getClosedContacts()),
      // Estimates likewise: one read serves both the estimate card (its period) and the overdue card
      // (anything before today).
      optional('Est. closure contacts', getEstimateContacts(EST_CLOSURE_FLOOR, estimateEnd > today ? estimateEnd : today)),
      // One record: when the CRM's history starts, so a comparison window that predates it is marked
      // as having nothing behind it rather than showing every card as infinite growth.
      getEarliestContactDate().catch((error) => {
        console.error('Earliest contact date unavailable:', error.message);
        return null;
      })
    ]);
    response.json(buildSalesFunnelBoard({ tf, contacts, closed, estimates, dataFrom, city }));
  } catch (error) {
    console.error('Error fetching sales funnel contacts, serving an empty board:', error.message);
    const notice = `Qualified leads (Zoho Contacts) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildSalesFunnelBoard({ tf, contacts: [], closed: [], estimates: [], city, notice }));
  }
});

// The Efficiency margin section. Same query contract as /sales-funnel: ?timeframe= any reporting period,
// ?city= all | DEL | HYD | OTHER | one city's name.
salesRoutes.get('/sales-efficiency', async (request, response) => {
  const tf = getTimeframeFilter(timeframeOf(request));
  const city = cityOf(request);
  try {
    // Losing an optional read costs only the cards built from it, not the whole section.
    const optional = (label, read) => read.catch((error) => {
      console.error(`${label} unavailable:`, error.message);
      return [];
    });
    // Contacts always go back a full year: the section's trend series is the last 12 months, and reading
    // that window once serves the period cards, their comparison and the series without a second call.
    const today = localDayKey(new Date());
    const [year, month] = today.split('-').map(Number);
    // The first of the month 11 months back — the oldest month the series draws.
    const seriesStart = new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10);
    const windowStart = tf.previousStart ?? tf.start;
    const contactsFrom = seriesStart < windowStart ? seriesStart : windowStart;
    const [contacts, closed, deals, dataFrom] = await Promise.all([
      getEfficiencyContacts(contactsFrom),
      // A closure in the period can belong to a lead created before the window, so closures keep their
      // own read exactly as they do on the funnel board.
      optional('Closed contacts', getClosedContacts()),
      // Deals feed only the product split and the revision count, so they stop at the comparison window.
      optional('Orders (Deals)', getEfficiencyDeals(tf.previousStart ?? tf.start)),
      getEarliestContactDate().catch((error) => {
        console.error('Earliest contact date unavailable:', error.message);
        return null;
      })
    ]);
    response.json(buildSalesEfficiency({ tf, contacts, closed, deals, dataFrom, city }));
  } catch (error) {
    console.error('Error fetching sales efficiency contacts, serving an empty section:', error.message);
    const notice = `Qualified leads (Zoho Contacts) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildSalesEfficiency({ tf, contacts: [], closed: [], deals: [], city, notice }));
  }
});
