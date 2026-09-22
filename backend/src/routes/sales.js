import { Router } from 'express';
import { applyOwnerFilterFallback } from '../lib/fallbacks.js';
import { timeframeOf } from '../lib/http.js';
import { buildDesignDashboardFromDeals } from '../services/designMapper.js';
import { buildPdiDashboardFromDeals } from '../services/pdiMapper.js';
import { buildSalesDashboardFromDeals } from '../services/salesMapper.js';
import { getTimeframeFilter } from '../services/timeUtils.js';
import { getRecentDeals } from '../services/zohoClient.js';

// Boards built from Zoho Deals (Orders): Sales, Design and PDI / site.
export const salesRoutes = Router();

const dealsFor = (timeframe) => getRecentDeals(getTimeframeFilter(timeframe).start);

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
