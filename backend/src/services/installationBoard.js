import {
  CITY_BUCKETS, CITY_KEYS, OTHER_CITY_KEY, canonicalCityName, cityBucketOf,
  cityNameKeyOf, cityNameLabelOf, cityRows, mergeCityNames
} from '../config/salesFunnel.js';
import { canonicalStage } from '../config/crmNames.js';
import { getAllDeals } from './dealsModule.js';
import { isRealDeal, LAKH } from './preDesignBoard.js';
import { inr } from './salesFunnelBoard.js';

// The Installation board:
//
//   Incoming project → Site readiness → Installation started → Installation due → Handover
//
// with an ORDER SPLIT filter (Kitchen / Wardrobe) above the funnel rather than inside it, so it
// narrows every card at once instead of being a card of its own.
//
// ---------------------------------------------------------------------------
// WHAT ZOHO HOLDS FOR INSTALLATION, measured across 7,645 orders
// ---------------------------------------------------------------------------
//   Product_Type                   7,249   the order split: Kitchen 3,870, Wardrobe 1,512
//   Handover_Date                  1,849   handover
//   Dispatch_Date                  1,850   material out, which is what makes a project incoming
//   Installation_Managers            276
//   Actual_installation_start_date   139   thin, so the start date comes off the stage ledger
//   Est_Handover_Date                129   the ONLY due date there is, and it is thin
//   Installation_done / Actual_End_Date / Installation_open / _received        0   EMPTY
//
// So the day buckets are measured from the stage ledger — the date an order ENTERED its
// installation stage — rather than from Actual_installation_start_date, which is filled on 139
// orders against 93 sitting at an installation stage. The ledger covers all of them.

// 'Site Approved for Dispatch' USED TO BE HERE AS WELL as in SITE_READY_STAGES, which meant its 7
// orders were counted on Incoming project AND on Site readiness — the same orders on two cards of a
// chain that is supposed to move orders along it. Incoming is now only the orders handed over and
// not yet site-approved, so the two cards are disjoint and the chain reads as a chain.
export const INCOMING_STAGES = ['Handover to Installation Team'];
export const STARTED_STAGES = ['Start First Installation Process', 'Start Second Installation Process'];
export const DONE_STAGES = ['First Installation Done', 'Second Installation Done'];
export const HANDOVER_STAGES = ['Final Handover', 'Complete'];
// Site readiness has no stage of its own in this CRM. The nearest real signals are the dispatch
// approval and whether a measurement person is named; both are thin and the card says so.
export const SITE_READY_STAGES = ['Site Approved for Dispatch'];

const clean = (value) => String(value ?? '').trim();
const set = (value) => Boolean(clean(value)) && clean(value) !== '-None-';
const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const lower = (value) => clean(value).toLowerCase();
const asSet = (list) => new Set(list.map(lower));

const INCOMING = asSet(INCOMING_STAGES);
const STARTED = asSet(STARTED_STAGES);
const DONE = asSet(DONE_STAGES);
const HANDOVER = asSet(HANDOVER_STAGES);
const SITE_READY = asSet(SITE_READY_STAGES);

const DAY = 86_400_000;
const daysSince = (date) => {
  if (!date) return null;
  const days = (Date.now() - Date.parse(date)) / DAY;
  return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : null;
};

// ---------------------------------------------------------------------------
// The order split — the universal filter above the funnel
// ---------------------------------------------------------------------------
// Product_Type is free-ish: "Sunroof" and "SUNROOOF" both appear, as do "Kitchen & Wardrobe" and
// "Countertop / Backplash". Kitchen and Wardrobe are the two the customer asked for; everything
// else stays reachable under "Other" so no order is hidden by a filter it does not match.
export const ORDER_SPLITS = [
  { key: 'all', label: 'All orders', matches: () => true },
  { key: 'kitchen', label: 'Kitchen', matches: (record) => /kitchen/i.test(record.product) },
  { key: 'wardrobe', label: 'Wardrobe', matches: (record) => /wardrobe/i.test(record.product) },
  { key: 'other', label: 'Other', matches: (record) => !/kitchen|wardrobe/i.test(record.product) }
];

const splitFor = (requested) => ORDER_SPLITS.find((split) => split.key === lower(requested)) ?? ORDER_SPLITS[0];

function toRecord(deal) {
  const city = canonicalCityName(deal.city);
  const amount = num(deal.Value) * LAKH;
  const stage = canonicalStage(deal.Stage);
  return {
    id: String(deal.id ?? ''),
    name: deal.Deal_Name ?? 'Unnamed order',
    cityRaw: clean(deal.city),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    stage,
    stageKey: lower(stage),
    product: clean(deal.Product_Type),
    owner: deal.Owner?.name ?? '',
    manager: set(deal.Installation_Managers) ? clean(deal.Installation_Managers) : '',
    dispatchOn: deal.Dispatch_Date ?? null,
    startedOn: deal.Actual_installation_start_date ?? null,
    dueOn: deal.Est_Handover_Date ?? null,
    handoverOn: deal.Handover_Date ?? null,
    measuredBy: set(deal.Site_Measurement_Person) ? clean(deal.Site_Measurement_Person) : '',
    // Why the site was not ready. Empty on every order until the CRM field exists — the board says
    // so on the card rather than showing a column of blanks with no explanation.
    notReadyReason: set(deal.Site_Not_Ready_Reason) ? clean(deal.Site_Not_Ready_Reason) : '',
    amount,
    amountLabel: amount > 0 ? inr(amount) : '',
    createdAt: deal.Created_Time ?? null
  };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
const sumOf = (records) => records.reduce((total, record) => total + record.amount, 0);

function card(records, extra = {}) {
  const value = sumOf(records);
  return {
    ...extra,
    count: records.length,
    value,
    valueLabel: value > 0 ? inr(value) : '',
    ids: records.map((record) => record.id),
    byCity: cityRows(records, (mine, row) => ({
      ...row, count: mine.length, value: sumOf(mine), ids: mine.map((r) => r.id)
    }))
  };
}

/** Sub-cards that partition their parent: an order lands in exactly one bucket. */
const bucket = (records, buckets) => buckets.map(({ key, label, test }) => ({
  ...card(records.filter(test), { key, label })
}));

function resolveCity(requested, records) {
  const asked = clean(requested);
  if (!asked || /^all$/i.test(asked)) return { key: 'all', matches: () => true };
  const found = CITY_KEYS.find((key) => key.toLowerCase() === asked.toLowerCase());
  if (found) return { key: found, matches: (record) => record.cityKey === found };
  const name = cityNameKeyOf(asked);
  if (records.some((record) => record.cityNameKey === name)) {
    return { key: name, matches: (record) => record.cityNameKey === name };
  }
  return { key: 'all', matches: () => true };
}

function cityFilters(records) {
  const options = new Map();
  records.filter((record) => record.cityKey === OTHER_CITY_KEY).forEach((record) => {
    const entry = options.get(record.cityNameKey)
      ?? { key: record.cityNameKey, label: cityNameLabelOf(record.city), count: 0 };
    entry.count += 1;
    options.set(record.cityNameKey, entry);
  });
  return CITY_BUCKETS.map((bucketDef) => ({
    key: bucketDef.key,
    label: bucketDef.label,
    count: records.filter((record) => record.cityKey === bucketDef.key).length,
    ...(bucketDef.key === OTHER_CITY_KEY
      ? { options: [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }
      : {})
  }));
}

function applyCityMerge(records) {
  const counts = new Map();
  records.forEach((record) => counts.set(record.city, (counts.get(record.city) ?? 0) + 1));
  const merged = mergeCityNames(counts);
  if (!merged.size) return;
  records.forEach((record) => {
    const winner = merged.get(record.city);
    if (!winner) return;
    record.city = winner;
    record.cityNameKey = cityNameKeyOf(winner);
    record.cityKey = cityBucketOf(winner);
  });
}

// The due windows on Installation due, measured against Est. Handover Date.
function dueBuckets() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekEnd = today + 7 * DAY;
  const month = now.getMonth();
  const year = now.getFullYear();
  const nextStart = new Date(year, month + 1, 1).getTime();
  const nextEnd = new Date(year, month + 2, 1).getTime();
  const due = (record) => (record.dueOn ? Date.parse(record.dueOn) : NaN);
  // THE THREE WINDOWS ARE EXCLUSIVE. They did not used to be: "this week" was today..+7d and "this
  // month" was today..end of month, so every date in the next few days satisfied both and the strip
  // reported the same 3 orders as "3 this week" and "3 this month". "This month" now means the rest
  // of the month AFTER this week, which is what a reader takes three windows side by side to mean.
  const within = (d, from, to) => Number.isFinite(d) && d >= from && d < to;
  return [
    { key: 'week', label: 'This week', test: (r) => within(due(r), today, weekEnd) },
    { key: 'month', label: 'This month', test: (r) => within(due(r), weekEnd, nextStart) },
    { key: 'next', label: 'Next month', test: (r) => within(due(r), nextStart, nextEnd) }
  ];
}

/**
 * @param deals   every Zoho Deal
 * @param city    all | DEL | HYD | OTHER | one city's name
 * @param split   all | kitchen | wardrobe | other — the order-split filter above the funnel
 * @param history the stage ledger, for how long an order has been on its installation stage
 */
export function buildInstallationBoard({ deals = [], city, split = 'all', history = null, tf = null, notice = null }) {
  const all = (deals ?? []).filter(isRealDeal).map(toRecord);
  applyCityMerge(all);

  const chosen = splitFor(split);
  const byCitySel = resolveCity(city, all);
  const inView = all.filter((record) => chosen.matches(record) && byCitySel.matches(record));

  // How long an order has been on its current stage, from the ledger. Actual_installation_start_date
  // is filled on 139 orders against 93 at an installation stage, so the ledger is the better source
  // and the field is the fallback.
  const ageOf = (record) => {
    const entry = history?.get(record.id)?.entries?.at(-1);
    return daysSince(entry?.enteredAt ?? record.startedOn);
  };
  inView.forEach((record) => {
    record.daysOnStage = ageOf(record);
    // The same elapsed time in whole minutes, so the records table can render "1 day + 6h 49m"
    // rather than a bare day count. The day buckets above still use daysOnStage.
    const since = history?.get(String(record.id))?.entries?.at(-1)?.enteredAt ?? record.startedOn;
    const minutes = since ? (Date.now() - Date.parse(since)) / 60_000 : NaN;
    record.minutesInStatus = Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : null;
  });

  const at = (stages) => inView.filter((record) => stages.has(record.stageKey));
  const incoming = at(INCOMING);
  const siteReady = at(SITE_READY);
  const started = at(STARTED);
  const due = inView.filter((record) => record.dueOn && !HANDOVER.has(record.stageKey));
  const handover = at(HANDOVER);

  const days = (record) => record.daysOnStage;
  // How many of the running jobs say why the site was not ready. Counted rather than assumed, so the
  // card can tell the difference between "nobody has filled it in" and "the field does not exist".
  const reasonsGiven = started.filter((record) => record.notReadyReason).length;
  // Orders that have FINISHED installing but have not been handed over. They are past every card
  // before Handover and not yet on it, so without saying so they would simply vanish from the board.
  const installedNotHandedOver = at(DONE).length;
  // What the three due windows cannot show. Measured, not assumed: the windows only cover the next
  // ~6 weeks, and the Est. Handover Dates run from Jul 2026 to Apr 2027.
  const dueAt = (record) => (record.dueOn ? Date.parse(record.dueOn) : NaN);
  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const overdue = due.filter((record) => Number.isFinite(dueAt(record)) && dueAt(record) < startOfToday).length;
  // How much of the Handover card's money is real. Value is filled on a small fraction of it,
  // because most of those rows are a legacy import, so the rupee figure describes only those.
  const handoverPriced = at(HANDOVER).filter((record) => record.amount > 0).length;
  const startedBuckets = [
    { key: 'lt3', label: 'Under 3 days', test: (r) => days(r) !== null && days(r) < 3 },
    { key: '3to5', label: '3 to 5 days', test: (r) => days(r) !== null && days(r) >= 3 && days(r) <= 5 },
    { key: 'gt5', label: 'Over 5 days', test: (r) => days(r) !== null && days(r) > 5 }
  ];

  const cards = [
    {
      ...card(incoming, { key: 'incoming', label: 'Incoming project', tone: 'blue' }),
      sub: 'Handed to the installation team, not started',
      subs: []
    },
    {
      ...card(siteReady, { key: 'siteReady', label: 'Site readiness', tone: 'teal' }),
      sub: 'Site approved for dispatch',
      note: 'Zoho has no site-readiness field. This is the dispatch approval, the nearest real signal, and it is thinly used.',
      subs: []
    },
    {
      ...card(started, { key: 'started', label: 'Installation started', tone: 'violet' }),
      sub: 'On site now, by how long it has been running',
      // The reason column is only worth a caveat while it is empty. Once the CRM field is being
      // filled, the note turns into the count of jobs that carry a reason, which is the number the
      // installation team actually wants off this card.
      note: (reasonsGiven === 0
        ? 'Site Not Ready Reason is not a field in Zoho yet, so that column is empty on every order.'
        : `${reasonsGiven.toLocaleString('en-IN')} of these carry a Site Not Ready Reason.`)
        + (installedNotHandedOver
          ? ` A further ${installedNotHandedOver} have finished installing but not been handed over, so they are on no card.`
          : ''),
      subs: bucket(started, startedBuckets)
    },
    {
      ...card(due, { key: 'due', label: 'Installation due', tone: 'amber' }),
      sub: 'By Est. Handover Date',
      // The strip covers the next six weeks; the dates run to Apr 2027. Most of this card therefore
      // falls outside its own breakdown, and the largest group inside it is the one already late —
      // so the count that matters most is stated here rather than left off the card.
      note: `${overdue.toLocaleString('en-IN')} are already past their date. `
        + 'Est. Handover Date is the only due date Zoho holds and is filled on '
        + `${due.length.toLocaleString('en-IN')} orders, so this card sees only those.`,
      subs: bucket(due, dueBuckets())
    },
    {
      ...card(handover, { key: 'handover', label: 'Handover', tone: 'green' }),
      sub: 'Installation complete and handed to the client',
      // Without this the card reads as though 1,950 handovers are worth less than 129 due ones.
      note: `Order value is filled on only ${handoverPriced.toLocaleString('en-IN')} of these, so the `
        + 'rupee figure covers those and not the rest, which are mostly a legacy import.',
      subs: cityRows(handover, (mine, row) => card(mine, { key: row.key, label: row.label }))
    }
  ];

  return {
    meta: {
      reportLabel: tf?.reportLabel ?? null,
      city: byCitySel.key,
      split: chosen.key,
      splitLabel: chosen.label,
      coverage: {
        orders: inView.length,
        ofAll: all.length,
        ageSource: history
          ? 'Days on stage come from the dated stage ledger, which covers every order at an installation stage'
          : 'Stage ledger unavailable; days on stage fall back to Actual installation start date (139 of 7,645 orders)',
        emptyFields: ['Installation_done', 'Actual_End_Date', 'Installation_open / received'],
        thinFields: [
          { field: 'Site_Not_Ready_Reason', filled: reasonsGiven },
          { field: 'Est_Handover_Date', filled: 129 },
          { field: 'Actual_installation_start_date', filled: 139 },
          { field: 'Installation_Managers', filled: 276 }
        ],
        handoverNote: 'Final Handover holds 1,910 orders, most of them a legacy import rather than installations completed recently.'
      },
      notice
    },
    filters: {
      cities: cityFilters(all.filter((record) => chosen.matches(record))),
      // The order split, with live counts so the filter shows its own weight before it is used.
      splits: ORDER_SPLITS.map((entry) => ({
        key: entry.key,
        label: entry.label,
        count: all.filter(entry.matches).length
      }))
    },
    installation: { cards },
    records: inView.map(({ cityNameKey, stageKey, ...record }) => ({ ...record, board: 'installation' }))
  };
}
