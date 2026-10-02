import { config } from '../config/env.js';
import { getTimeframeFilter } from './timeUtils.js';

// KEEPING THE HEAVY BOARDS WARM.
//
// The Design and Dispatch boards read a lot: the whole Orders module (7,687 rows) and a month of
// the stage ledger (10,000 rows). Cached, both are instant; cold, they are ten seconds. The cache
// holds for 30 minutes, so in practice the only slow loads are the first visit after the server
// starts and the first visit after a window expires — which is exactly when someone opens the
// dashboard in the morning and waits.
//
// So the server fetches them in the background instead of making the first visitor do it: once a
// few seconds after boot, then on a repeating cycle set just inside the cache window so an entry is
// replaced shortly before it would have gone stale. Nobody should ever meet a cold board.
//
// This does spend Zoho reads whether or not anyone is looking. That is the trade, it is why the
// interval sits just under the cache TTL rather than far below it, and it can be switched off with
// WARM_CACHE=off for a deployment where quota matters more than the first load.

const CACHE_TTL_MS = 30 * 60 * 1000;
// Just inside the window, so a refresh lands before the old entry expires rather than after.
const CYCLE_MS = 25 * 60 * 1000;
const FIRST_RUN_MS = 3_000;

let timer = null;

// The stage value map has to be learned from the org before any board matches on a stage — 20
// stages here store a value that differs from their label. Learned once, then reused.
let stagesLearned = false;
async function learnStages() {
  if (stagesLearned) return;
  try {
    const [{ zohoGet }, { learnStageValues }, { learnStageSequence }] = await Promise.all([
      import('./zohoClient.js'), import('../config/crmNames.js'), import('./postDesignModel.js')
    ]);
    const meta = await zohoGet('settings/fields', { module: 'Deals' });
    const stage = (meta.fields ?? []).find((field) => field.api_name === 'Stage');
    const values = stage?.pick_list_values ?? [];
    const learned = learnStageValues(values);
    // Post-design proper is the CRM's own sequence 18-35, read from the org rather than copied.
    const core = learnStageSequence(values);
    stagesLearned = true;
    console.log(`Stage map learned from Zoho: ${learned} stored values differ from their label, ${core} stages in the post-design block.`);
  } catch (error) {
    console.error('Could not read the Stage picklist; using the built-in stage aliases:', error.message);
  }
}

// WHICH ENDPOINTS GET WARMED, and the exact query each is warmed with.
//
// The response cache (lib/cache/dashboardCache.js) is Express middleware keyed on
// `reportingDay:path?query`, so the ONLY way to populate it is a real request through the stack.
// That is a feature here, not a workaround: warming by HTTP reuses each endpoint's own logic, so
// there is no second copy of a dashboard calculation to drift out of step with the first.
//
// The query must match what the browser sends or the keys differ and the warm entry is never read.
// These are taken from the useDashboard calls in the frontend: the app opens on `daily`, Sales on
// `monthly` with `city=all`, and Pre Sales adds its PSM filter.
//
// Only paths that HAVE a response cache are listed. /post-design-funnel, /dispatch-board,
// /installation-board and /factory-standup are not in the middleware's PATHS set, so warming them
// would do the work and then throw it away. Adding them to that set is a separate decision.
const WARM_ENDPOINTS = [
  // The expensive one, and the reason this exists: ~23s cold, almost all of it the full DealHistory.
  '/api/pre-design-funnel?timeframe=daily',
  '/api/sales-efficiency?city=all&timeframe=monthly',
  '/api/sales-funnel?city=all&timeframe=monthly',
  '/api/ams-dashboard?timeframe=daily',
  '/api/dashboard?psm=All%20PSM&timeframe=daily'
];

/**
 * Warms the dashboard RESPONSES by requesting the endpoints, after the source reads above.
 *
 * Ordering matters: the source reads run first and populate ReadCache, so by the time these
 * requests arrive the expensive Zoho work is already done and each one is only paying for its own
 * transform. If a user clicks mid-cycle they do not start a second scan - ReadCache coalesces
 * in-flight source reads, and the response cache has its own `pending` map that hands a concurrent
 * caller the same promise.
 */
async function warmEndpoints() {
  const base = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
  // The warm-up is a real HTTP request through this server's own stack, so when sign-in is on it has to
  // sign in like any other caller. Without this every warm request 401s and the cache stays empty while
  // the log reports a cheerful 0.0s warm-up. The credentials come from config and are never logged.
  const headers = config.auth.user && config.auth.password
    ? { Authorization: `Basic ${Buffer.from(`${config.auth.user}:${config.auth.password}`).toString('base64')}` }
    : {};
  const started = Date.now();
  const results = await Promise.allSettled(WARM_ENDPOINTS.map(async (path) => {
    const response = await fetch(`${base}${path}`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // The body has to be drained or the connection is left open.
    await response.json();
    return response.headers.get('X-Dashboard-Cache');
  }));
  const failed = results
    .map((result, index) => (result.status === 'rejected' ? `${WARM_ENDPOINTS[index]} (${result.reason?.message})` : null))
    .filter(Boolean);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed.length) console.log(`Endpoint warm-up finished in ${seconds}s; could not warm: ${failed.join(', ')}`);
  else console.log(`Endpoint warm-up finished in ${seconds}s — ${WARM_ENDPOINTS.length} dashboard responses are cached.`);
}

async function warmOnce() {
  await learnStages();
  // Imported here rather than at the top so a failure in one board's module cannot stop the server
  // booting — this is a background nicety, never a dependency.
  const [{ getAllDeals }, { getStageLedger }, { getPreDesignDeals }, { getComplaints }] = await Promise.all([
    import('./dealsModule.js'),
    import('./stageLedger.js'),
    import('./preDesignBoard.js'),
    import('./dispatchBoard.js')
  ]);
  const tf = getTimeframeFilter('monthly');
  const since = tf.previousStart ?? tf.start;

  // Each read is independent and each is allowed to fail on its own: a warm-up that throws should
  // cost one cache entry, not the whole cycle.
  const reads = [
    ['orders module', () => getAllDeals()],
    // The windowed ledger as well as the full one: /pre-design-funnel reads both, and this is the cheap
    // one (a month, ~15 pages). Warming only the full ledger left the window read cold.
    ['stage ledger (window)', () => getStageLedger('deals', since)],
    // The full ledger, because the post-design cohort needs all of it: the single most expensive read
    // on the server and the whole point of warming. It goes through getFullDealLedger rather than the
    // paged walk because that is what /pre-design-funnel calls - warming the paged path instead would
    // spend 140 requests and ~21s filling a cache the route never reads.
    ['stage ledger (full)', async () => { const { getFullDealLedger } = await import('./bulkLedger.js'); return getFullDealLedger(); }],
    ['pre-design orders', () => getPreDesignDeals(since)],
    ['complaints', () => getComplaints()]
  ];
  const started = Date.now();
  const results = await Promise.allSettled(reads.map(([, read]) => read()));
  const failed = results
    .map((result, index) => (result.status === 'rejected' ? reads[index][0] : null))
    .filter(Boolean);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed.length) console.log(`Cache warm-up finished in ${seconds}s; could not read: ${failed.join(', ')}`);
  else console.log(`Cache warm-up finished in ${seconds}s — the Design and Dispatch boards are ready.`);

  // Then the responses themselves. Reads first, so these are cheap: the Zoho work is already in
  // ReadCache and each endpoint only pays for its own transform.
  await warmEndpoints();
}

// A cycle is ~30s against a 25-minute interval, so cycles should never meet - but a stalled Zoho
// read could run one long, and two concurrent cycles would mean two 140-page traversals competing
// for the same API quota. The guard makes that impossible rather than improbable.
let running = false;
const run = () => {
  if (running) {
    console.log('Cache warm-up skipped: the previous cycle is still running.');
    return;
  }
  running = true;
  warmOnce()
    .catch((error) => console.error('Cache warm-up failed:', error.message))
    .finally(() => { running = false; });
};

/** Starts the background warm-up. Returns a stop function, which the tests use. */
export function startCacheWarmUp() {
  if (String(process.env.WARM_CACHE ?? '').toLowerCase() === 'off') {
    console.log('Cache warm-up is off (WARM_CACHE=off); the first visit to a heavy board will be slow.');
    return () => {};
  }
  // A moment after boot, so the server is already answering before the reads start competing for it.
  const first = setTimeout(run, FIRST_RUN_MS);
  timer = setInterval(run, CYCLE_MS);
  // Neither timer should hold the process open on shutdown.
  first.unref?.();
  timer.unref?.();
  return () => { clearTimeout(first); clearInterval(timer); timer = null; };
}

export const WARM_CYCLE_MS = CYCLE_MS;
export const WARM_CACHE_TTL_MS = CACHE_TTL_MS;
