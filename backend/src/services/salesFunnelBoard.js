import {
  CITY_BUCKETS, CITY_KEYS, CLOSED_CARD_LABEL, CLOSED_STAGE, HANDOVER_LABEL, HANDOVER_MATCH, LADDER_STAGES,
  OTHER_CITY_KEY, OTHER_SOURCE, OVERDUE_LABEL, PRINCIPAL_STAGE, QUALIFIED_BY, SOURCE_BUCKETS,
  canonicalCityName, cityBucketOf, cityLabelOf, cityNameKeyOf, cityNameLabelOf, estClosureLabelOf,
  hasStageSet, isOpenStage, isQualifiedStage, isRealRecord, mergeCityNames, productOf, qualifiedByOf,
  sourceBucketOf, stageKeyOf, stageLabelOf, valueOf
} from '../config/salesFunnel.js';
import { addDays } from './periods.js';
import { localDayKey } from './timeUtils.js';

// The Sales board's "Lead generation" and "Sales performance" sections, both built from Zoho Contacts
// (qualified leads). Every rule they follow lives in config/salesFunnel.js, so this file only counts.
// The period's intake is every qualified lead created in it:
//   incoming                    the whole intake, one card
//   qualified + dead + S1       the intake by Current Stage, without remainder. `dead` has no card of
//                               its own, so from outside, incoming - qualified - S1 is the dead count.
//   S1..S6                      the open part of the intake, the cohort ladder
//   handover                    that same cohort, once it reaches Handover To Post Design
//   closed                      what actually closed: Actual_Closure_Date in the period
//   estClosure                  what is expected to close: Est_Closoure_Date in the period, still open
//   overdue                     estimate already passed and the deal still open — not period-filtered
// The last three are NOT part of the intake, so they never enter either split above. estClosure and
// closed are deliberately different sets: the flow reads expected -> ladder -> actual, not one funnel.

const CRORE = 1e7;
const LAKH = 1e5;

// Same ₹ wording the Pre Sales mandate bar uses, so both boards read alike.
const trim = (value, digits) => Number(value.toFixed(digits)).toLocaleString('en-IN');
export function inr(value) {
  const amount = Number.isFinite(value) ? value : 0;
  if (amount >= CRORE) return `₹${trim(amount / CRORE, amount >= 10 * CRORE ? 1 : 2)} Cr`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH, 1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// One qualified-lead record, flattened so the frontend never has to know Zoho's field names.
function toRecord(contact) {
  const stageKey = stageKeyOf(contact.Client_Status);
  const value = valueOf(contact);
  const city = canonicalCityName(contact.City);
  return {
    id: String(contact.id ?? ''),
    name: contact.Full_Name ?? 'Unnamed',
    // What the CRM actually holds, kept so the table can show it and nothing is lost.
    cityRaw: contact.City?.trim() || '',
    // The tidied name; applyCityMerge may replace it once the whole batch has been counted.
    city,
    // Bucketing follows the tidied name, so a lead typed "Hydrabad" counts under Hyderabad rather than
    // falling into Others. applyCityMerge recomputes this whenever it rewrites the name.
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    psm: contact.Sales_Manager?.name ?? '',
    owner: contact.Owner?.name ?? '',
    // The popup table calls the owner "Salesperson assigned"; `psm` stays the Sales_Manager field.
    salesPerson: contact.Owner?.name ?? '',
    // Blank on most records, and blank is the honest answer — the UI shows "Not recorded".
    product: productOf(contact),
    // Contacts.Stage, whose Zoho label is "Status": the process step, a separate column from the ladder.
    status: contact.Stage ?? '',
    estClosureDate: contact.Est_Closoure_Date ?? null,
    source: contact.Lead_Source ?? '',
    sourceKey: sourceBucketOf(contact.Lead_Source),
    stage: stageLabelOf(stageKey),
    stageKey,
    hasStage: hasStageSet(contact.Client_Status),
    qualifiedBy: qualifiedByOf(contact.Sales_Manager?.name),
    value,
    valueLabel: inr(value),
    createdAt: contact.Created_Time ?? null,
    closedOn: contact.Actual_Closure_Date ?? null,
    handover: HANDOVER_MATCH.test(contact.Stage ?? '')
  };
}

const totals = (records) => ({
  count: records.length,
  value: records.reduce((sum, record) => sum + record.value, 0),
  ids: records.map((record) => record.id)
});

// A card: the headline numbers plus the ids behind them, so the frontend can open the records.
// `note` is a caveat about the data behind the card; a card without one omits the field entirely.
function card(records, extra = {}) {
  const { note, ...rest } = extra;
  const { count, value, ids } = totals(records);
  return { ...rest, count, value, valueLabel: inr(value), ids, ...(note ? { note } : {}) };
}

// A card broken down by city bucket. byCity always lists all three, so the three counts add up to `count`.
function cityCard(records, extra = {}) {
  return {
    ...card(records, extra),
    byCity: CITY_KEYS.map((key) => card(records.filter((record) => record.cityKey === key), { key, label: cityLabelOf(key) }))
  };
}

const bucketCards = (records, buckets, field) =>
  buckets.map(({ key, label }) => card(records.filter((record) => record[field] === key), { key, label }));

// The city the request asked for. A bucket key (DEL / HYD / OTHER) narrows to that bucket, a city name
// narrows to that one city, and anything the data does not know about falls back to every city, so a
// stale or hand-typed link still answers instead of showing an empty board.
function resolveCity(requested, records) {
  const asked = String(requested ?? '').trim();
  if (!asked || /^all$/i.test(asked)) return { key: 'all', matches: () => true };
  const bucket = CITY_KEYS.find((key) => key.toLowerCase() === asked.toLowerCase());
  if (bucket) return { key: bucket, matches: (record) => record.cityKey === bucket };
  const name = cityNameKeyOf(asked);
  if (records.some((record) => record.cityNameKey === name)) {
    return { key: name, matches: (record) => record.cityNameKey === name };
  }
  return { key: 'all', matches: () => true };
}

// The city switcher. Built from every record in view before the city filter is applied, so the user can
// always see — and switch to — a bucket they are not currently looking at.
function cityFilters(records) {
  const others = records.filter((record) => record.cityKey === OTHER_CITY_KEY);
  const options = new Map();
  others.forEach((record) => {
    const entry = options.get(record.cityNameKey) ?? { key: record.cityNameKey, label: cityNameLabelOf(record.city), count: 0 };
    entry.count += 1;
    options.set(record.cityNameKey, entry);
  });
  return CITY_BUCKETS.map((bucket) => {
    const mine = records.filter((record) => record.cityKey === bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      count: mine.length,
      ...(bucket.key === OTHER_CITY_KEY
        ? { options: [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }
        : {})
    };
  });
}

// Folds the near-duplicate spellings together across every record in view, then writes the winning name
// back. Done over all the lists at once so the dropdown, the table cells and the Others menu agree; the
// same contact can appear in more than one list as a separate object, which is why this mutates in place.
function applyCityMerge(lists) {
  const records = lists.flat();
  const counts = new Map();
  records.forEach((record) => counts.set(record.city, (counts.get(record.city) ?? 0) + 1));
  const merged = mergeCityNames(counts);
  if (!merged.size) return;
  records.forEach((record) => {
    const winner = merged.get(record.city);
    if (!winner) return;
    record.city = winner;
    record.cityNameKey = cityNameKeyOf(winner);
    // The bucket has to follow the new name. "Hydrabad" is not a spelling CITY_BUCKETS knows, so its
    // bucket was OTHER until the merge made it "Hyderabad"; without this it would stay in Others.
    record.cityKey = cityBucketOf(winner);
  });
}

const inWindow = (tf, date) => Boolean(date) && tf.matches(date);

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const monthEndAfter = (iso, months) => {
  const date = utc(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).toISOString().slice(0, 10);
};

// An estimate looks forward, so its card covers the WHOLE calendar period rather than the part of it
// that has already happened. On the 23rd, "Est. closure for this month" still means the whole month —
// the deals due between today and the 30th are exactly what a forecast is for, and month-to-date would
// hide them. Every other card stays to-date, which is why this end is worked out here and not taken
// from tf.end. Weekly, daily and custom windows are already complete, so they keep theirs.
export function estimateEndOf(tf) {
  if (tf.kind === 'monthly') return monthEndAfter(tf.start, 0);
  if (tf.kind === 'quarterly') return monthEndAfter(tf.start, 2);
  if (tf.kind === 'this-week') return addDays(tf.start, 6);
  return tf.end;
}

/**
 * `contacts` are Zoho Contacts created since the period start, `closed` every Closed contact (closures
 * are dated by Actual_Closure_Date, so they can be far older than the window) and `estimates` every
 * contact carrying an Est. Closure Date, which can be older still.
 * Pass `notice` when Zoho could not be read: the same shape comes back, with zeros.
 */
export function buildSalesFunnelBoard({ tf, contacts = [], closed = [], estimates = [], city, notice = null, now = new Date() }) {
  const real = (list) => (list ?? []).filter(isRealRecord).map(toRecord);
  const created = real(contacts).filter((record) => inWindow(tf, record.createdAt));
  const closures = real(closed).filter((record) => inWindow(tf, record.closedOn));
  // A deal that is Dead or already Closed cannot close again, so it is neither expected nor overdue.
  const openEstimates = real(estimates).filter((record) => record.estClosureDate && isOpenStage(record.stageKey));
  const estimateEnd = estimateEndOf(tf);
  const expected = openEstimates.filter((record) => record.estClosureDate >= tf.start && record.estClosureDate <= estimateEnd);
  // Overdue follows today, not the reporting period: an estimate that has passed stays passed whichever
  // period is on screen. It is still city-filtered, like every other card.
  const today = localDayKey(now);
  const overdue = openEstimates.filter((record) => record.estClosureDate < today);
  // One spelling per city, decided across everything in view before any card is counted.
  applyCityMerge([created, closures, expected, overdue]);
  // The same record can reach this list by several routes; one copy of each, so every id a card quotes
  // resolves against `records`.
  const byId = new Map([...created, ...closures, ...expected, ...overdue].map((record) => [record.id, record]));
  const universe = [...byId.values()];

  const selected = resolveCity(city, universe);
  const only = (list) => list.filter(selected.matches);
  // Everything created in the period, and the whole of it is the `incoming` card. The cards below cut
  // this one set up; they never re-filter `created`, so they always add back up to it.
  const intake = only(created);
  // Closures are dated by Actual_Closure_Date rather than by when the lead arrived: a lead takes months
  // to close, so they belong to the period's activity, not to its intake.
  const closedNow = only(closures);
  const open = intake.filter((record) => isOpenStage(record.stageKey));
  const qualified = intake.filter((record) => isQualifiedStage(record.stageKey));

  const stageCard = (stage) => {
    const records = open.filter((record) => record.stageKey === stage.key);
    // S1 is mostly records with no Current Stage at all, so it says so rather than letting the card be
    // read as "the CRM checked these and found them unvalidated".
    const blank = records.filter((record) => !record.hasStage).length;
    const note = stage.key === 'S1' && blank
      ? `${blank} of ${records.length} have no Current Stage set in Zoho`
      : null;
    return card(records, { key: stage.key, label: stage.label, short: stage.short, note });
  };

  return {
    meta: {
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      city: selected.key,
      notice
    },
    filters: { cities: cityFilters(universe) },
    leadGeneration: {
      // The whole period's intake. The customer's wording is "Incoming leads from PSM", though the PSM
      // field names a real PSM on only part of it — `qualifiedBy` below is where that split is shown.
      incoming: cityCard(intake, { label: 'Incoming leads from PSM' }),
      // The qualified part of the intake, then cut two ways: by who qualified it and by where it came from.
      qualified: cityCard(qualified),
      qualifiedBy: bucketCards(qualified, QUALIFIED_BY, 'qualifiedBy'),
      bySource: bucketCards(qualified, [...SOURCE_BUCKETS, OTHER_SOURCE], 'sourceKey')
    },
    salesPerformance: {
      // What the sales team expects to close in the period, and what has already slipped past its
      // estimate. Neither is the same set as `closed` below, which is what actually closed.
      estClosure: cityCard(only(expected), { key: 'estClosure', label: estClosureLabelOf(tf.kind) }),
      overdue: cityCard(only(overdue), { key: 'overdue', label: OVERDUE_LABEL }),
      stages: LADDER_STAGES.map(stageCard),
      principal: stageCard(PRINCIPAL_STAGE),
      // What actually closed in the period, by Actual_Closure_Date. The flow reads
      // Est. closure → Overdue → S1..S5 → S6 → Order Booked → Handover.
      closed: card(closedNow, { key: CLOSED_STAGE.key, label: CLOSED_CARD_LABEL }),
      handover: card(open.filter((record) => record.handover), { key: 'handover', label: HANDOVER_LABEL })
    },
    // The internal signals the cards were built from are dropped; the frontend gets the flat record only.
    records: only(universe).map(({ cityNameKey, handover, hasStage, ...record }) => record)
  };
}
