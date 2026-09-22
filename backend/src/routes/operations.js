import { Router } from 'express';
import { loadAmsDashboard } from '../services/amsMapper.js';
import { buildDispatchDashboard, DISPATCH_FIELDS, FIRST_DISPATCH_STAGES, SECOND_DISPATCH_STAGES } from '../services/dispatchMapper.js';
import { loadFactoryDashboardData } from '../services/factoryMapper.js';
import { buildInstallationDashboard, COMPLAINT_FIELDS, INSTALLATION_STAGES, ITEM_FIELDS, ORDER_FIELDS, VISIT_FIELDS } from '../services/installationMapper.js';
import { getAllRecords, getDealsInStages, getPaymentStatusByOrder } from '../services/zohoClient.js';

// After-sale boards: dispatch readiness, installation, and AMS (annual maintenance).
export const operationsRoutes = Router();

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
