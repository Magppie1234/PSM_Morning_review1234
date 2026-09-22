import { Router } from 'express';
import { missingSettings } from '../config/env.js';
import { getLeadFieldMetadata } from '../services/zohoClient.js';
import { factoryRoutes } from './factory.js';
import { operationsRoutes } from './operations.js';
import { presalesRoutes } from './presales.js';
import { salesRoutes } from './sales.js';

// Every API route, mounted under /api by app.js.
export const apiRoutes = Router();

// Health check for the host: reports whether the Zoho settings are present (names only, never values).
apiRoutes.get('/health', (_request, response) => response.json({
  status: missingSettings.length ? 'misconfigured' : 'ok',
  source: 'Zoho CRM',
  ...(missingSettings.length ? { missing: missingSettings } : {})
}));

apiRoutes.get('/zoho/lead-fields', async (_request, response) => {
  try {
    response.json(await getLeadFieldMetadata());
  } catch {
    response.status(502).json({ error: 'Zoho field metadata could not be loaded.' });
  }
});

apiRoutes.use(presalesRoutes);
apiRoutes.use(salesRoutes);
apiRoutes.use(factoryRoutes);
apiRoutes.use(operationsRoutes);

apiRoutes.use((_request, response) => response.status(404).json({ error: 'Unknown API route.' }));
