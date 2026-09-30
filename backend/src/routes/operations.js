import { Router } from 'express';
import { loadAmsDashboard } from '../services/amsMapper.js';
import { buildDispatchDashboard, DISPATCH_FIELDS, FIRST_DISPATCH_STAGES, SECOND_DISPATCH_STAGES } from '../services/dispatchMapper.js';
import { loadFactoryDashboardData } from '../services/factoryMapper.js';
import { buildInstallationDashboard, COMPLAINT_FIELDS, INSTALLATION_STAGES, ITEM_FIELDS, ORDER_FIELDS, VISIT_FIELDS } from '../services/installationMapper.js';
import { getAllRecords, getDealsInStages, getPaymentStatusByOrder } from '../services/zohoClient.js';
import { buildDispatchBoard, getComplaints, getDispatchDeals } from '../services/dispatchBoard.js';
import { buildInstallationBoard } from '../services/installationBoard.js';
import { getAllDeals } from '../services/dealsModule.js';
import { ALL_HISTORY, getStageLedger, indexByRecord } from '../services/stageLedger.js';
import { getTimeframeFilter } from '../services/timeUtils.js';

// After-sale boards: dispatch readiness, installation, and AMS (annual maintenance).
export const operationsRoutes = Router();

// The Dispatch board: Planner, Scheduler, Tracker and Complaints, ported from the :5520 mockup and
// wired to Zoho. Orders come from Deals, their movement from DealHistory (the dispatch date fields
// are empty), and complaints from the AMS_Complaints module.
// ?timeframe= any reporting period; ?city= all | DEL | HYD | OTHER | one city's name.
operationsRoutes.get('/dispatch-board', async (request, response) => {
  const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : 'monthly';
  const tf = getTimeframeFilter(timeframe);
  const city = typeof request.query.city === 'string' ? request.query.city : 'all';
  try {
    // Each read is optional apart from the orders: losing the ledger costs the flow figures, and
    // losing the complaints read costs that one view, rather than the whole board.
    const [deals, complaints, ledger] = await Promise.all([
      getDispatchDeals(),
      getComplaints().catch((error) => {
        console.error('AMS_Complaints unavailable:', error.message);
        return [];
      }),
      getStageLedger('deals', tf.previousStart ?? tf.start).catch((error) => {
        console.error('Stage ledger unavailable, dispatch falls back to live counts:', error.message);
        return null;
      })
    ]);
    const history = ledger ? indexByRecord(ledger, 'deals') : null;
    response.json(buildDispatchBoard({ deals, complaints, tf, city, history }));
  } catch (error) {
    console.error('Error building the dispatch board:', error.message);
    const notice = `Orders could not be read from Zoho: ${error.message}. Refresh to try again.`;
    response.json(buildDispatchBoard({ deals: [], complaints: [], tf, city, notice }));
  }
});

operationsRoutes.get('/dispatch-dashboard', async (_request, response) => {
  try {
    const [deals, payments] = await Promise.all([
      getDealsInStages([...FIRST_DISPATCH_STAGES, ...SECOND_DISPATCH_STAGES], DISPATCH_FIELDS),
      getPaymentStatusByOrder().catch((error) => {
        console.error('Payment milestones unavailable:', error.message);
        return new Map();
      })
    ]);
    const holds = loadFactoryDashboardData().dispatchFailures;
    response.json(buildDispatchDashboard(deals, payments, holds));
  } catch (error) {
    console.error('Error building dispatch dashboard:', error.message);
    response.status(502).json({ error: 'Dispatch data could not be loaded from Zoho CRM.' });
  }
});

// The Installation board: incoming project -> site readiness -> installation started -> due ->
// handover, with the Kitchen / Wardrobe order split applied above the funnel.
// ?timeframe=, ?city= all | DEL | HYD | OTHER | one city, ?split= all | kitchen | wardrobe | other.
operationsRoutes.get('/installation-board', async (request, response) => {
  const tf = getTimeframeFilter(typeof request.query.timeframe === 'string' ? request.query.timeframe : 'monthly');
  const city = typeof request.query.city === 'string' ? request.query.city : 'all';
  const split = typeof request.query.split === 'string' ? request.query.split : 'all';
  try {
    // The ledger is optional: without it the day buckets fall back to the thinly filled
    // Actual installation start date, which the board reports on its own coverage note.
    const [deals, ledger] = await Promise.all([
      getAllDeals(),
      getStageLedger('deals', ALL_HISTORY).catch((error) => {
        console.error('Stage ledger unavailable for installation:', error.message);
        return null;
      })
    ]);
    const history = ledger ? indexByRecord(ledger, 'deals') : null;
    response.json(buildInstallationBoard({ deals, city, split, history, tf }));
  } catch (error) {
    console.error('Error building the installation board:', error.message);
    const notice = `Orders could not be read from Zoho: ${error.message}. Refresh to try again.`;
    response.json(buildInstallationBoard({ deals: [], city, split, tf, notice }));
  }
});

operationsRoutes.get('/installation-dashboard', async (request, response) => {
  try {
    const [visits, items, complaints, orders] = await Promise.all([
      getAllRecords('Visit_Module', VISIT_FIELDS, { criteria: '(Record_Type:equals:Installation)' }),
      getAllRecords('Complaint_Items_Detail', ITEM_FIELDS),
      getAllRecords('AMS_Complaints', COMPLAINT_FIELDS, { criteria: '(Record_Type:equals:Complaint)' }),
      getDealsInStages(INSTALLATION_STAGES, ORDER_FIELDS)
    ]);
    const holds = loadFactoryDashboardData().dispatchFailures;
    response.json(buildInstallationDashboard({ visits, items, complaints, orders, holds, timeframe: request.query.timeframe }));
  } catch (error) {
    console.error('Error building installation dashboard:', error.message);
    response.status(502).json({ error: 'Installation data could not be loaded from Zoho CRM.' });
  }
});

operationsRoutes.get('/ams-dashboard', async (request, response) => {
  try {
    response.json(await loadAmsDashboard(request.query.timeframe));
  } catch (error) {
    console.error('Error building AMS dashboard:', error.message);
    response.status(502).json({ error: 'AMS data could not be loaded from Zoho CRM.' });
  }
});
