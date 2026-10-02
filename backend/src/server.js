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

// Declared before listen() so the callback cannot read it in its temporal dead zone. It only works
// today because the callback fires on a later tick; that is timing, not a guarantee.
let stopWarmUp = () => {};

const server = createApp().listen(config.port, config.host, () => {
  console.log(`PSM Morning Review API listening at http://${config.host}:${config.port}`);
  // The Orders module and the stage ledger are ten seconds cold and instant warm, so they are read
  // in the background rather than by whoever opens the board first. WARM_CACHE=off disables it.
  stopWarmUp = startCacheWarmUp();
  if (config.auth.user) console.log('Sign-in is on (DASHBOARD_USER / DASHBOARD_PASSWORD).');
});

// GRACEFUL SHUTDOWN.
//
// A hosted process is restarted on every deploy, every scale event and every host maintenance
// window, and the signal arrives mid-request. Exiting immediately would cut off whoever is waiting
// — and on this API a single request can legitimately be 20 seconds of Zoho paging, so "mid-request"
// is a wide target.
//
// The sequence is: stop the background warm-up so it cannot start new Zoho work, stop accepting new
// connections, let the requests already in flight finish, then exit. The timeout is a backstop, not
// the normal path: if something is wedged we leave anyway rather than hanging until the host sends
// SIGKILL, which would look identical to a crash in the host's logs.
const SHUTDOWN_GRACE_MS = Number(process.env.SHUTDOWN_GRACE_MS ?? 25_000);
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: finishing in-flight requests, then exiting.`);

  // Nothing new starts: the warm-up timer is cleared before the server stops listening, so a cycle
  // cannot begin during the drain and hold the process open with a fresh 20-second Zoho read.
  try { stopWarmUp(); } catch { /* the warm-up may never have started */ }

  const giveUp = setTimeout(() => {
    console.warn(`Shutdown timed out after ${SHUTDOWN_GRACE_MS}ms; exiting with requests still open.`);
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  giveUp.unref();

  server.close((error) => {
    clearTimeout(giveUp);
    if (error) {
      console.error('Error while closing the server:', error.message);
      process.exit(1);
    }
    console.log('All requests finished; shutting down cleanly.');
    process.exit(0);
  });
}

// SIGTERM is what a container host sends on deploy or restart; SIGINT is Ctrl-C locally. Both get
// the same treatment so what happens in production is what was tested on a laptop.
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
