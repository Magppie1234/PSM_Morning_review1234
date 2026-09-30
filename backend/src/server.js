import { assertZohoConfigured, config } from './config/env.js';
import { createApp } from './app.js';
import { startCacheWarmUp } from './services/warmCache.js';

// Entry point: check the settings, then start listening.
try {
  assertZohoConfigured();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

createApp().listen(config.port, config.host, () => {
  console.log(`PSM Morning Review API listening at http://${config.host}:${config.port}`);
  // The Orders module and the stage ledger are ten seconds cold and instant warm, so they are read
  // in the background rather than by whoever opens the board first. WARM_CACHE=off disables it.
  startCacheWarmUp();
  if (config.auth.user) console.log('Sign-in is on (DASHBOARD_USER / DASHBOARD_PASSWORD).');
});
