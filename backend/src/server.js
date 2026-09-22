import { assertZohoConfigured, config } from './config/env.js';
import { createApp } from './app.js';

// Entry point: check the settings, then start listening.
try {
  assertZohoConfigured();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

createApp().listen(config.port, config.host, () => {
  console.log(`PSM Morning Review API listening at http://${config.host}:${config.port}`);
  if (config.auth.user) console.log('Sign-in is on (DASHBOARD_USER / DASHBOARD_PASSWORD).');
});
