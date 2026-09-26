import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config/env.js';
import { basicAuth } from './middleware/basicAuth.js';
import { apiRoutes } from './routes/index.js';
import { dashboardCache } from './lib/cache/dashboardCache.js';

// Builds the Express app. Kept separate from server.js so it can be started, tested or wrapped by a host
// without opening a port.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  if (config.auth.user && config.auth.password) app.use(basicAuth(config.auth));

  // Browsers may call the API only from the listed origins (the Vite dev server locally). In production the
  // frontend is served by this same server, so no cross-origin access is needed.
  app.use('/api', cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', dashboardCache());
  app.use('/api', apiRoutes);

  // Production: serve the built frontend, and send every other page request to its index.html.
  if (fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist, { index: false, maxAge: '1h' }));
    app.get('*', (_request, response) => response.sendFile(path.join(config.frontendDist, 'index.html')));
  }

  // Last resort: log the detail, return a plain message (never a stack trace or a file path).
  app.use((error, _request, response, _next) => {
    console.error('Unhandled error:', error.message);
    response.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
