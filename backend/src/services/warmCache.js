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
    // The full ledger, because the post-design cohort needs all of it. It is the single most
    // expensive read on the server (27,797 rows, ~21s) and the whole point of warming.
    ['stage ledger (full)', async () => { const { ALL_HISTORY } = await import('./stageLedger.js'); return getStageLedger('deals', ALL_HISTORY); }],
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
}

const run = () => { warmOnce().catch((error) => console.error('Cache warm-up failed:', error.message)); };

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
