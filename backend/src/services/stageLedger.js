import { zohoGet } from './zohoClient.js';

// THE STAGE LEDGER — the dated spine every board is being moved onto.
//
// Zoho keeps a field-tracker module beside each of the three business modules, and each row in one
// is ONE DATED PERIOD SPENT IN ONE STAGE:
//
//     Modified_Time   when the record ENTERED that stage
//     <stage field>   the stage it was in
//     Moved_To__s     the stage it went to next; null means it is still there
//     <days field>    how long it stayed
//
// Verified against live records on 2026-09-28: the row whose `Moved_To__s` is null always matches
// the live record's own Stage field. A real trace from DealHistory:
//
//     2026-09-26 16:52  None              -> Form Filled        0 days
//     2026-09-26 16:53  Form Filled       -> Designer Assigned  1 day
//     2026-09-27 22:16  Designer Assigned -> Sent for Approval  1 day
//     2026-09-28 18:40  Sent for Approval -> (current)
//
// WHY THIS MATTERS. Every card on every board currently infers its milestone from a SNAPSHOT field
// (Deals.Stage, Contacts.Client_Status) which says where a record is now and carries no date. Three
// things follow, and all three are bugs the customer has reported:
//   · a record that has moved PAST a stage is invisible to that stage's card, so the middle of every
//     funnel under-reports;
//   · with no date there is nothing to filter a period on, so each board invented its own cohort
//     rule and the boards stopped reconciling with each other;
//   · the post-design board had to give up period filtering entirely and show a live queue.
//
// With the ledger, one rule replaces all of that: A CARD COUNTS RECORDS THAT ENTERED ITS STAGE
// DURING THE PERIOD. The backlog ("still sitting there") and the time-in-stage come out of the same
// rows for free, so a card can show flow and stock without a second read.

// ---------------------------------------------------------------------------
// The three ledgers
// ---------------------------------------------------------------------------
// Same shape, different field names — which is the only reason this table exists. `extra` is the
// per-ledger columns a board needs beside the stage itself (the PSM on a lead, the value on an
// order), fetched in the same pass rather than by joining back to the parent module.
export const LEDGERS = {
  leads: {
    module: 'Lead_Status_History',
    record: 'Full_Name',
    stage: 'Lead_Status',
    days: 'Duration_Days',
    extra: ['Lead_Owner', 'Lead_Source']
  },
  contacts: {
    module: 'Opportunity_Stage_History',
    record: 'Full_Name',
    stage: 'Stage',
    days: 'Duration_Days',
    extra: ['Sales_Manager', 'Contact_Owner', 'Actual_Closure_Date']
  },
  deals: {
    module: 'DealHistory',
    record: 'Potential_Name',
    stage: 'Stage',
    days: 'Stage_Duration_Calendar_Days',
    extra: ['Value']
  }
};

// The whole of DealHistory is 27,797 rows over 139 pages and takes 21s cold — measured, and it
// covers all 7,703 orders back to September 2025. The old cap of 60 stopped at 12,000 rows and
// roughly two months, which silently shortened every cohort built on it: the post-design cohort
// came out at 624 against the validated 875 purely because the older orders had no history.
// 160 pages leaves headroom; the read is cached for 30 minutes and warmed in the background, so
// nobody waits for it.
const MAX_PAGES = 160;

// Pass this as `since` to page all the way back rather than to a period window.
export const ALL_HISTORY = '2020-01-01';

/**
 * Every ledger row from `since` to now, newest first.
 *
 * Paged rather than searched on purpose: `/search` with a criteria returns NO_PERMISSION on all
 * three tracker modules, so the window is taken by paging `Modified_Time desc` and stopping once a
 * page ends older than the cutoff — the same shape as getPreDesignDeals in preDesignBoard.js,
 * including the page_token handover at Zoho's 2,000-record page-number ceiling.
 *
 * Measured: a month of DealHistory is ~3,000 rows over 15 pages in 1.9s, and zohoGet caches it.
 *
 * @param {string} key    one of the LEDGERS keys
 * @param {string} since  plain date, e.g. the comparison window's start
 */
export async function getStageLedger(key, since) {
  const ledger = LEDGERS[key];
  if (!ledger) throw new Error(`Unknown stage ledger: ${key}`);
  // A day of margin, because Modified_Time is a local-timezone stamp and `since` is a plain date.
  const cutoff = Date.parse(`${since}T00:00:00Z`) - 86_400_000;
  const fields = [ledger.record, ledger.stage, ledger.days, 'Modified_Time', 'Moved_To__s', ...ledger.extra].join(',');
  const base = { fields, per_page: 200, sort_by: 'Modified_Time', sort_order: 'desc' };

  // The first ten pages are independent URLs (Zoho pages by number up to 2,000 records), so they go
  // out together rather than one at a time. A month of DealHistory is 50 pages and was taking 8.2s
  // walked serially; the burst removes nine of those round trips.
  const firstTen = await Promise.all(
    Array.from({ length: 10 }, (_, index) => zohoGet(ledger.module, { ...base, page: index + 1 }))
  );
  const rows = firstTen.flatMap((payload) => payload.data ?? []);
  const last = firstTen.at(-1);
  const pastWindow = () => {
    const oldest = rows.at(-1)?.Modified_Time;
    return oldest && Date.parse(oldest) < cutoff;
  };
  if (last?.info?.more_records && !pastWindow()) {
    // Beyond 2,000 records Zoho only pages by an opaque token, which has to be walked in order.
    let pageToken = last.info?.next_page_token;
    for (let page = 11; page <= MAX_PAGES && pageToken; page += 1) {
      const payload = await zohoGet(ledger.module, { ...base, page_token: pageToken });
      rows.push(...(payload.data ?? []));
      if (!payload.info?.more_records || pastWindow()) break;
      pageToken = payload.info?.next_page_token;
    }
  }
  // The parallel pages can overlap if a row is written mid-read, and a duplicate transition would
  // show up as a record counted twice on a card.
  const seen = new Set();
  return rows.filter((row) => {
    const id = String(row?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const clean = (value) => String(value ?? '').trim();
const stageKeyOf = (stage) => clean(stage).toLowerCase();

/**
 * The ledger rows folded into one entry per record, oldest move first.
 *
 * @returns {Map<string, {id, name, owner, psm, entries: Array<{stage, stageKey, enteredAt, movedTo, days, value}>}>}
 */
export function indexByRecord(rows, key) {
  const ledger = LEDGERS[key];
  const index = new Map();
  for (const row of rows ?? []) {
    const parent = row[ledger.record];
    const id = parent?.id ? String(parent.id) : null;
    if (!id) continue;
    let entry = index.get(id);
    if (!entry) {
      entry = {
        id,
        name: parent.name ?? 'Unnamed',
        // Whoever the tracker names on the row. Lead rows carry the PSM, contact rows carry both the
        // PSM and the salesperson, deal rows carry neither.
        psm: row.Sales_Manager?.name ?? row.Lead_Owner?.name ?? '',
        owner: row.Contact_Owner?.name ?? '',
        entries: []
      };
      index.set(id, entry);
    }
    entry.entries.push({
      stage: clean(row[ledger.stage]),
      stageKey: stageKeyOf(row[ledger.stage]),
      enteredAt: row.Modified_Time ?? null,
      movedTo: clean(row.Moved_To__s) || null,
      // `null` rather than 0 where Zoho leaves it blank — which it does on the current stage, since
      // that period has not ended. Averaging a blank in as zero would drag every duration down.
      days: Number.isFinite(Number(row[ledger.days])) && row[ledger.days] !== null
        ? Number(row[ledger.days])
        : null,
      value: Number(row.Value) || 0
    });
  }
  // Oldest first, so a record's history reads forwards and `.at(-1)` is where it stands now.
  for (const entry of index.values()) {
    entry.entries.sort((a, b) => Date.parse(a.enteredAt ?? 0) - Date.parse(b.enteredAt ?? 0));
    // COLLAPSE CONSECUTIVE DUPLICATES. The same stage saved twice in a row is one visit, not a
    // re-entry — a rule the validated handoff pack calls out explicitly. Without it a record that
    // was simply re-saved looks like it bounced, which inflates every "entered this stage" count
    // and splits one stay into two shorter ones.
    entry.entries = entry.entries.filter((step, index) => index === 0 || step.stageKey !== entry.entries[index - 1].stageKey);
  }
  return index;
}

const asSet = (stages) => (stages instanceof Set
  ? stages
  : new Set((Array.isArray(stages) ? stages : [stages]).map(stageKeyOf)));

/**
 * FLOW — the records that entered any of `stages` during the period.
 *
 * A record is counted ONCE however many times it entered, and the entry kept is the FIRST one inside
 * the window. Records do bounce back into a stage (a design that is revised re-enters "Sent for
 * Approval"), and counting those twice would make a card exceed the population it is drawn from.
 *
 * @param tf  a timeframe from getTimeframeFilter; `previous` swaps to its comparison window
 */
export function enteredDuring(index, stages, tf, { previous = false } = {}) {
  const want = asSet(stages);
  const matches = previous ? (date) => tf.previousMatches(date) : (date) => tf.matches(date);
  const out = [];
  for (const record of index.values()) {
    const hit = record.entries.find((e) => want.has(e.stageKey) && e.enteredAt && matches(e.enteredAt));
    if (hit) out.push({ ...record, at: hit.enteredAt, stage: hit.stage, days: hit.days, value: hit.value });
  }
  return out;
}

/**
 * STOCK — the records sitting at any of `stages` right now.
 *
 * "Now" is the open period: the one entry with no `movedTo`. That row is the record's live stage, and
 * it is what the parent module's own Stage field reads.
 */
export function sittingAt(index, stages) {
  const want = asSet(stages);
  const out = [];
  for (const record of index.values()) {
    const current = record.entries.at(-1);
    if (current && !current.movedTo && want.has(current.stageKey)) {
      out.push({ ...record, at: current.enteredAt, stage: current.stage, days: current.days, value: current.value });
    }
  }
  return out;
}

/**
 * The record's live stage, or null when its history is empty. Lets a caller reconcile the ledger
 * against the parent module's snapshot field — which is how the ledger's own correctness is checked.
 */
export function currentStageOf(record) {
  const current = record?.entries?.at(-1);
  return current && !current.movedTo ? current.stage : null;
}

/**
 * TIME — how long each record spent in `stages`, for the records that have LEFT it.
 *
 * Only closed periods count. A record still sitting in the stage has no duration yet, and treating
 * today as its end date would report a number that shrinks every time the board is refreshed.
 * Returns the day counts; the caller averages them and says how many they were taken over.
 */
export function daysIn(index, stages, tf, { previous = false } = {}) {
  const want = asSet(stages);
  const matches = previous ? (date) => tf.previousMatches(date) : (date) => tf.matches(date);
  const out = [];
  for (const record of index.values()) {
    for (const entry of record.entries) {
      if (!want.has(entry.stageKey) || !entry.movedTo) continue;
      if (entry.days === null || !entry.enteredAt || !matches(entry.enteredAt)) continue;
      out.push({ id: record.id, name: record.name, days: entry.days, at: entry.enteredAt });
    }
  }
  return out;
}

/**
 * Time from entering `from` to first entering `to`, in days, per record — the honest way to measure
 * "average time to X" across a run of stages rather than a single one.
 */
export function daysBetweenStages(index, from, to, tf, { previous = false } = {}) {
  const fromSet = asSet(from);
  const toSet = asSet(to);
  const matches = previous ? (date) => tf.previousMatches(date) : (date) => tf.matches(date);
  const out = [];
  for (const record of index.values()) {
    const start = record.entries.find((e) => fromSet.has(e.stageKey) && e.enteredAt);
    if (!start) continue;
    const end = record.entries.find((e) => toSet.has(e.stageKey) && e.enteredAt
      && Date.parse(e.enteredAt) >= Date.parse(start.enteredAt));
    if (!end || !matches(end.enteredAt)) continue;
    const days = (Date.parse(end.enteredAt) - Date.parse(start.enteredAt)) / 86_400_000;
    if (Number.isFinite(days) && days >= 0) out.push({ id: record.id, name: record.name, days, at: end.enteredAt });
  }
  return out;
}
