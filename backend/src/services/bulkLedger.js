import { unzipSync } from 'fflate';
import { config } from '../config/env.js';
import { getZohoAccessToken } from './zohoClient.js';
import { ALL_HISTORY, getStageLedger } from './stageLedger.js';

// THE DEAL HISTORY, FETCHED IN 3 REQUESTS INSTEAD OF 140.
//
// The paged Get Records walk is structurally slow and cannot be made faster: Zoho caps per_page at
// 200 and refuses page 11+ outright (DISCRETE_PAGINATION_LIMIT_EXCEEDED), so 27,997 rows means 140
// pages of which 130 must be walked one at a time through an opaque page_token. Measured at ~21s
// locally and ~17-18s in production, and that is 93% of the Design board's cold load.
//
// Bulk Read answers the same question with one asynchronous job: create, poll, download a zipped
// CSV. Measured end to end at ~5s for the same data.
//
// WHY THIS IS SAFE, established by reconciliation before any of this was written (Phase 5A):
//
//   rows            28,005 paged vs 26,539 bulk
//   the difference  1,466 rows, and 1,466 of 1,466 have a NULL Potential_Name - orphan history
//                   belonging to deleted orders. indexByRecord() already drops every one of them,
//                   because a row with no parent cannot attach to an order. Bulk Read is omitting
//                   data the dashboard already throws away, not data it uses.
//   the business    2,413 orders compared, 2,413 first-Sent-for-Approval timestamps identical,
//                   0 differences. September: 309 vs 309, and the same 309 order ids.
//
// CRM DATA IS NEVER PERSISTED. The ZIP is held in memory, unzipped in memory, parsed, aggregated,
// and dropped when the request ends. Nothing is written to disk and nothing leaves Zoho except into
// this process, exactly as the paged JSON does today.

const BULK_PATH = 'bulk/v8/read';
// Four of the module's twenty fields. Three are what the Sent-for-Approval calculation needs;
// Moved_To__s is included because indexByRecord() reads it into `movedTo`, and a ledger missing it
// would be a silently lossy drop-in for any caller that looks at stage transitions.
const FIELDS = ['Potential_Name', 'Stage', 'Modified_Time', 'Moved_To__s'];
const REQUIRED_COLUMNS = ['Potential_Name', 'Stage', 'Modified_Time'];

// Polling, and the single most important number in this file.
//
// MEASURED: Zoho processes bulk jobs roughly SERIALLY, about 3.5s each.
//   unloaded, 5 runs : 3.6 3.6 3.7 3.7 3.7s   (p50 3.7s, max 3.7s - very tight)
//   2 concurrent     : 3.7s, 7.0s
//   4 concurrent     : 3.5s, 6.9s, 9.1s, 12.5s        ~= N x 3.5s
//
// So a slow job is almost never a BROKEN job - it is a QUEUED one, and it will finish. That makes a
// short timeout actively harmful: it fires precisely when the job was about to succeed, and because
// the fallback is sequential it then adds the ~18s paged walk on top. Measured at a 15s timeout:
// a routine run took 30.2s, against a ~21s baseline. The timeout caused the regression.
//
// Hence a LONG ceiling and fallback on definite failure instead. At 25s:
//   - covers ~7 concurrent jobs at the measured rate, so queueing resolves rather than falls back
//   - worst case 25s + ~18s paged = ~43s, still inside the 60s Vercel maxDuration
//   - a real failure (refused, errored, bad archive) still falls back IMMEDIATELY - it does not wait
const POLL_EVERY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = Number(process.env.ZOHO_BULK_TIMEOUT_MS ?? 25_000);

// CIRCUIT BREAKER, instance-local. After repeated failures this instance stops attempting bulk for
// a cooling-off period and goes straight to the paged walk, so a broken bulk endpoint costs the
// timeout once rather than on every request.
//
// ITS LIMITATION, stated plainly: this is process memory. Each Lambda instance keeps its own
// counter, so with N instances a broken bulk path can still be attempted N times before any of them
// trips. Fixing that properly needs shared state, which this phase forbids. It bounds the damage
// per instance; it does not coordinate across them.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
const breaker = { failures: 0, openedAt: 0 };
const breakerOpen = () => breaker.openedAt > 0 && Date.now() - breaker.openedAt < BREAKER_COOLDOWN_MS;
// A sanity floor. An export far smaller than the module means something truncated it, and silently
// aggregating a partial export would under-report the card rather than fail honestly.
const MIN_PLAUSIBLE_ROWS = 1_000;

const api = (path) => new URL(path, `${config.zoho.apiDomain}/crm/`);
const authHeader = (token) => ({ Authorization: `Zoho-oauthtoken ${token}` });

/** Starts the export job and returns its id. */
async function createJob(token) {
  const response = await fetch(api(BULK_PATH), {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { module: { api_name: 'DealHistory' }, fields: FIELDS } })
  });
  const payload = await response.json();
  const job = payload?.data?.[0];
  if (!response.ok || job?.status !== 'success' || !job?.details?.id) {
    throw new Error(`bulk read not accepted: ${job?.code ?? response.status}`);
  }
  return String(job.details.id);
}

/** Polls until the job completes, or throws once `timeoutMs` has elapsed. */
async function waitForJob(token, id, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(api(`${BULK_PATH}/${id}`), { headers: authHeader(token) });
    const job = (await response.json())?.data?.[0] ?? {};
    if (job.state === 'COMPLETED') return Number(job.result?.count ?? 0);
    if (job.state === 'FAILURE') throw new Error('bulk read job failed');
    await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
  }
  throw new Error(`bulk read job did not finish within ${timeoutMs}ms`);
}

/** Downloads the result and unzips it in memory. */
async function downloadCsv(token, id) {
  const response = await fetch(api(`${BULK_PATH}/${id}/result`), { headers: authHeader(token) });
  if (!response.ok) throw new Error(`bulk read download failed: HTTP ${response.status}`);
  const zip = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(zip);
  const name = Object.keys(files).find((file) => file.toLowerCase().endsWith('.csv'));
  if (!name) throw new Error('bulk read archive contained no CSV');
  return Buffer.from(files[name]).toString('utf8');
}

/**
 * Turns the CSV into the SAME row shape getStageLedger() returns, so indexByRecord() and every
 * caller downstream are unchanged.
 *
 * The CSV gives Potential_Name as a bare order id; indexByRecord expects `{ id, name }`, so it is
 * reshaped here. The export carries no order NAME - entries fall back to "Unnamed", which no card
 * reads, and no duration column, which the Sent-for-Approval calculation does not use.
 */
function parseCsv(csv) {
  const lines = csv.split(/\r?\n/);
  const header = (lines[0] ?? '').split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length) throw new Error(`bulk read CSV missing column(s): ${missing.join(', ')}`);

  const at = Object.fromEntries(header.map((name, index) => [name, index]));
  const rows = [];
  for (let line = 1; line < lines.length; line += 1) {
    const raw = lines[line];
    if (!raw) continue;
    const cells = raw.split(',');
    const orderId = cells[at.Potential_Name]?.trim();
    // No parent order: the same rows the paged walk returns with a null lookup, and the same ones
    // indexByRecord already drops. Skipped here so the two paths produce identical input.
    if (!orderId) continue;
    rows.push({
      id: cells[at.Id]?.trim() ?? null,
      Potential_Name: { id: orderId, name: '' },
      Stage: cells[at.Stage]?.trim() ?? '',
      Modified_Time: cells[at.Modified_Time]?.trim() || null,
      Moved_To__s: at.Moved_To__s != null ? (cells[at.Moved_To__s]?.trim() || null) : null
    });
  }
  return rows;
}

/**
 * The whole Deal history through Bulk Read.
 *
 * @param {number} [timeoutMs] how long to wait for the job before giving up
 * @returns {Promise<{rows: Array, timings: object}>}
 * @throws on any failure, so the caller can fall back to the paged walk
 */
export async function getDealHistoryViaBulk(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const mark = {};
  const since = Date.now();
  const lap = (name) => { mark[name] = Date.now() - since; };

  const token = await getZohoAccessToken();
  const id = await createJob(token);
  lap('created');
  const reported = await waitForJob(token, id, timeoutMs);
  lap('completed');
  const csv = await downloadCsv(token, id);
  lap('downloaded');
  const rows = parseCsv(csv);
  lap('parsed');

  // A technically successful job that returned too little is a correctness risk, not a win.
  if (rows.length < MIN_PLAUSIBLE_ROWS) {
    throw new Error(`bulk read returned only ${rows.length} usable rows (reported ${reported})`);
  }
  return { rows, timings: { ...mark, total: Date.now() - since, reported, usable: rows.length } };
}

/**
 * The full Deal history, fast path first.
 *
 * Bulk Read when it works; the existing paged walk whenever it does not, for any reason — job
 * refused, job failed, timeout, bad download, unreadable archive, missing column, implausibly small
 * export. The fallback is the code that has always run, so a failure costs latency, never accuracy.
 */
// SINGLE FLIGHT, AND IT IS NOT OPTIONAL.
//
// The bulk calls go through fetch() directly rather than zohoGet(), so they get NONE of ReadCache's
// coalescing - every caller would start its own job. Measured before this existed, in one process
// with distinct cache keys: 6 concurrent requests created 6 bulk jobs, and 10 created enough that
// every one of them timed out and fell back.
//
// Zoho runs jobs roughly serially at ~3.5s each, so N jobs for the same data is not merely wasteful,
// it is self-defeating: the queue they form is what breaks them. One in-flight promise, shared by
// every caller, is the entire difference between this working and not.
//
// The result is held briefly after it resolves so the warm-up and a user arriving moments apart
// share one job rather than two. It lives in process memory and dies with the process - no external
// store, nothing on disk.
const SHARE_WINDOW_MS = Number(process.env.ZOHO_BULK_SHARE_MS ?? 60_000);
let inFlight = null;
let lastResult = null;

export async function getFullDealLedger() {
  // Someone is already fetching it: wait for theirs rather than starting a second job.
  if (inFlight) return inFlight;
  if (lastResult && Date.now() - lastResult.at < SHARE_WINDOW_MS) return lastResult.rows;

  inFlight = fetchLedger().finally(() => { inFlight = null; });
  return inFlight;
}

async function fetchLedger() {
  if (breakerOpen()) {
    console.warn('bulk_job_skipped reason=circuit_open; using the paged Deal history.');
    return getStageLedger('deals', ALL_HISTORY);
  }
  try {
    const { rows, timings } = await getDealHistoryViaBulk();
    breaker.failures = 0;
    breaker.openedAt = 0;
    lastResult = { rows, at: Date.now() };
    // Operational metadata only - never row contents, customer data or payloads.
    console.log(`bulk_job_completed rows=${rows.length} total_ms=${timings.total} `
      + `create_ms=${timings.created} job_ms=${timings.completed} download_ms=${timings.downloaded} parse_ms=${timings.parsed}`);
    return rows;
  } catch (error) {
    breaker.failures += 1;
    if (breaker.failures >= BREAKER_THRESHOLD) {
      breaker.openedAt = Date.now();
      console.warn(`bulk_circuit_opened failures=${breaker.failures} cooldown_ms=${BREAKER_COOLDOWN_MS}`);
    }
    const kind = /did not finish/.test(error.message) ? 'timeout'
      : /CSV|archive|column|usable rows/.test(error.message) ? 'parse_failed' : 'failed';
    console.warn(`bulk_job_${kind} reason="${error.message.slice(0, 90)}" failures=${breaker.failures}; falling back to the paged Deal history.`);
    return getStageLedger('deals', ALL_HISTORY);
  }
}
