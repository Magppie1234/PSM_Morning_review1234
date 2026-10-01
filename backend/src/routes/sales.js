import { Router } from 'express';
import { EST_CLOSURE_FLOOR } from '../config/salesFunnel.js';
import { applyOwnerFilterFallback } from '../lib/fallbacks.js';
import { timeframeOf } from '../lib/http.js';
import { buildDesignDashboardFromDeals } from '../services/designMapper.js';
import { loadPdiReview } from '../services/pdiReview.js';
import { buildPreDesignBoard, getPreDesignDeals } from '../services/preDesignBoard.js';
import { getAllDeals } from '../services/dealsModule.js';
import { getFullDealLedger } from '../services/bulkLedger.js';
import { buildPostDesignFunnel, getPostDesignQueue } from '../services/postDesignFunnel.js';
import { ALL_HISTORY, getStageLedger, indexByRecord } from '../services/stageLedger.js';
import { getSalesManagersByContact } from '../services/salesManagers.js';
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

// The Design board's pre-design funnel, built from Zoho Deals (Orders): new requests from sales →
// designer assigned / assignment pending → under design / query to SM → sent for approval → revision
// requested → revision done → order booked (the one card with money on it) → handover to design.
// Same query contract as /sales-funnel: ?timeframe= any reporting period,
// ?city= all | DEL | HYD | OTHER | one city's name.
salesRoutes.get('/pre-design-funnel', async (request, response) => {
  const tf = getTimeframeFilter(timeframeOf(request));
  const city = cityOf(request);
  try {
    // Back to the start of the comparison window, not the period's own start, so every card's
    // "vs last period" figure is counted from a complete window.
    // The orders, and the dated stage ledger behind them. The ledger is optional on purpose: if it
    // cannot be read the board still renders from the Stage snapshot, one card at a time, rather
    // than failing — and meta.coverage.stageSource says which of the two it used.
    // FOUR READS, and the last two exist because one card is dated differently from the rest.
    //
    // "Sent for approval" counts orders by the month they FIRST entered that stage, not by when they
    // were created - so it has to see every order in the module, and a stage history deep enough to
    // find a first entry that may be years old. Both are the warm-cached reads the other boards
    // already use, so this costs a cache hit rather than a second pass over Zoho.
    const [deals, ledger, managers, allDeals, fullLedger] = await Promise.all([
      getPreDesignDeals(tf.previousStart ?? tf.start),
      getStageLedger('deals', tf.previousStart ?? tf.start).catch((error) => {
        console.error('Stage ledger unavailable, falling back to the Stage snapshot:', error.message);
        return null;
      }),
      // The SM comes from the qualified lead, one hop from the order. Optional: losing it costs the
      // SM column and its chart, not the board.
      getSalesManagersByContact().catch((error) => {
        console.error('Sales managers unavailable:', error.message);
        return null;
      }),
      getAllDeals().catch((error) => {
        console.error('Whole orders module unavailable; the dated cards fall back to the window:', error.message);
        return null;
      }),
      // The full history, through Bulk Read where it works and the paged walk where it does not.
      // 3 requests instead of 140; getFullDealLedger falls back on its own, so a bulk failure costs
      // latency rather than the card.
      getFullDealLedger().catch((error) => {
        console.error('Full stage ledger unavailable; the dated cards fall back to the window:', error.message);
        return null;
      })
    ]);
    const history = ledger ? indexByRecord(ledger, 'deals') : null;
    const fullHistory = fullLedger ? indexByRecord(fullLedger, 'deals') : null;
    response.json(buildPreDesignBoard({ tf, deals, city, history, managers, allDeals, fullHistory }));
  } catch (error) {
    // Never throw to the client: the same shape comes back with zeros and a notice on it.
    console.error('Error fetching pre-design deals, serving an empty funnel:', error.message);
    const notice = `Orders (Zoho Deals) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildPreDesignBoard({ tf, deals: [], city, notice }));
  }
});

// The Design board's post-design queue: handover → first visit → EP prep → EP approval → EP marking
// visits → production prep → PDI → payment pending → sent to factory, each with its own
// requested / planned / done split read off Deals.Stage.
//
// Period-aware via DealHistory: each card leads with how many orders ENTERED its stage in the window
// and keeps the live queue figure beside it. ?timeframe= and ?city= both filter.
salesRoutes.get('/post-design-funnel', async (request, response) => {
  const tf = getTimeframeFilter(timeframeOf(request));
  const city = cityOf(request);
  try {
    const [deals, ledger] = await Promise.all([
      getPostDesignQueue(),
      // FULL history, not the period window: the cohort is every order that has ever entered
      // post-design, so an order last touched in March still belongs to it.
      getStageLedger('deals', ALL_HISTORY).catch((error) => {
        console.error('Stage ledger unavailable, post-design falls back to the live queue:', error.message);
        return null;
      })
    ]);
    const history = ledger ? indexByRecord(ledger, 'deals') : null;
    response.json(buildPostDesignFunnel({ deals, city, tf, history }));
  } catch (error) {
    console.error('Error fetching the post-design queue, serving an empty board:', error.message);
    const notice = `Orders (Zoho Deals) could not be read: ${error.message}. Refresh to try again.`;
    response.json(buildPostDesignFunnel({ deals: [], city, tf, notice }));
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
