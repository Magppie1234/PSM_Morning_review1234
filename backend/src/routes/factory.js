import { Router } from 'express';
import { loadFactoryDashboardData } from '../services/factoryMapper.js';
import { buildFactoryStandup } from '../services/factoryStandup.js';
import { applyQueryUpdate, loadStandupState, parseQueryUpdate, saveStandupState } from '../services/standupStore.js';
import { localDayKey } from '../services/timeUtils.js';

// Factory boards, read from the planning / dispatch / CHI spreadsheets (FACTORY_*_FILE).
export const factoryRoutes = Router();

factoryRoutes.get('/factory-dashboard', (request, response) => {
  try {
    response.json(loadFactoryDashboardData({
      designerFilter: request.query.designer,
      bucketFilter: request.query.bucket,
      productFilter: request.query.product,
      tatSlabFilter: request.query.tatSlab
    }));
  } catch (error) {
    console.error('Error loading factory dashboard:', error.message);
    response.status(500).json({ error: 'Factory data could not be loaded.' });
  }
});

factoryRoutes.get('/factory-standup', (request, response) => {
  try {
    response.json(buildFactoryStandup(request.query.timeframe));
  } catch (error) {
    console.error('Error building factory stand-up:', error.message);
    response.status(500).json({ error: 'Factory stand-up data could not be loaded.' });
  }
});

// Records a meeting decision (due date, closed, discussed) for one or more planning queries.
factoryRoutes.post('/factory-standup/queries', (request, response) => {
  const keys = Array.isArray(request.body?.keys) ? request.body.keys.filter((key) => typeof key === 'string') : [];
  if (!keys.length || keys.length > 200) return response.status(400).json({ error: 'keys must be a non-empty list of query ids' });
  const { error, update } = parseQueryUpdate(request.body);
  if (error) return response.status(400).json({ error });
  try {
    const known = new Set(loadFactoryDashboardData().queries.map((query) => query.key));
    const unknown = keys.filter((key) => !known.has(key));
    if (unknown.length) return response.status(404).json({ error: `Unknown query: ${unknown[0]}` });
    const state = loadStandupState();
    const today = localDayKey(new Date());
    keys.forEach((key) => applyQueryUpdate(state, key, update, today));
    saveStandupState(state);
    response.json(buildFactoryStandup(request.query.timeframe));
  } catch (err) {
    console.error('Error saving stand-up decision:', err.message);
    response.status(500).json({ error: 'The decision could not be saved.' });
  }
});
