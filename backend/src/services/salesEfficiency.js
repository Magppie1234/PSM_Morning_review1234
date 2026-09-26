import {
  CITY_BUCKETS, CITY_KEYS, LAKH, OTHER_CITY_KEY, canonicalCityName, cityBucketOf, cityLabelOf,
  cityNameKeyOf, cityNameLabelOf, isQualifiedStage, isRealRecord, mergeCityNames, previousLabelOf,
  stageKeyOf, valueOf
} from '../config/salesFunnel.js';
import { config } from '../config/env.js';
import { inr } from './salesFunnelBoard.js';

// The Sales board's "Efficiency margin" section. Same query contract, period and comparison semantics
// as /api/sales-funnel; the rules it shares (city bucketing and merging, the lakh value convention,
// isRealRecord) come from config/salesFunnel.js and are never restated here.
//
// ---------------------------------------------------------------------------
// THE PAYLOAD (this is the contract the frontend is built against)
// ---------------------------------------------------------------------------
// meta      reportLabel, start, end, city (as /api/sales-funnel), comparison { start, end, label,
//           available }, workingDays, previousWorkingDays, excludeAmsRecords, amsExcluded, amsDetected,
//           dataFrom (first day the Contacts module holds), notice (non-null only when a read failed)
// filters   { cities: [ { key, label, count, options? } ] } — the funnel's switcher shape
// metrics   [ metric, … ] — ALWAYS the same eight keys, in this order: leadRate, qualificationRate,
//           closureRate, timeToCloseMedian, timeToCloseMean, averageOrderValue, averageRevisions,
//           averageDiscount (the last is always available:false; see its `reason`)
// series    { dataFrom, months: [ { month, label, leads, qualified, closed, closedValue,
//           closedValueLabel, available } ] } — the last 12 calendar months, oldest first
// products  { source, sample, rows: [ { key, label, count, value, valueLabel, share, previousCount,
//           previousValue, previousShare } ] }
// regions   { byBucket: [ … ], byCity: [ … ] }, each row { key, label|city, leads, closures, value,
//           valueLabel, previousLeads, previousClosures, previousValue }; byCity is the map's data
//
// Every entry of `metrics` has exactly this shape:
//   { key, label, value, unit, previous, sample, available, reason?, total?, previousTotal?,
//     valueLabel?, previousLabel? }
//   value / previous  number, or null when there is nothing to measure. NEVER 0 as a stand-in.
//   unit              'days' | 'count' | 'inr' | 'per-working-day'
//   sample            { count, of, label } — how many records the figure is built on, out of how many
//                     were in scope, and a sentence the UI can print under the number.
//   available         false when the CRM cannot answer the question; `reason` then says why.
//   total/previousTotal       only on the per-working-day rates: the raw count behind the rate.
//   valueLabel/previousLabel  only when unit === 'inr' (₹ already formatted).

// ---------------------------------------------------------------------------
// The August 2026 service entries
// ---------------------------------------------------------------------------
// 1,051 Contacts created on 6 Aug 2026 are AMS and installation service rows, not leads: names ending
// "- AMS Service" or "- Installation [UID …]", no Current Stage, no source, never closed. They are two
// of five bulk imports by the company account; the other three (Sep/Nov 2025) are a migration of real
// history and ARE leads, so the date alone is the wrong test. The durable rule: created by the company
// account, inside a minute that account used to land 100+ records, AND no Current Stage — which selects
// exactly those 1,051 and nothing else. The customer has not decided whether to drop them; flipping
// this one constant excludes them everywhere on this section and nothing else needs touching.
export const EXCLUDE_AMS_RECORDS = false;

const BULK_IMPORT_ACCOUNT = 'Magppie Living Private Limited';
const BULK_IMPORT_MINUTE = 100;

const minuteOf = (time) => String(time ?? '').slice(0, 16);

// Which minutes the company account used for a bulk import. Counted over the WHOLE fetched window
// (always 12 months here) so a burst is never half-seen and mistaken for ordinary traffic.
function bulkImportMinutes(contacts) {
  const counts = new Map();
  contacts.forEach((contact) => {
    if ((contact?.Created_By?.name ?? '') !== BULK_IMPORT_ACCOUNT) return;
    const key = minuteOf(contact.Created_Time);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count >= BULK_IMPORT_MINUTE).map(([key]) => key));
}

const isServiceImport = (contact, minutes) =>
  (contact?.Created_By?.name ?? '') === BULK_IMPORT_ACCOUNT
  && minutes.has(minuteOf(contact.Created_Time))
  && !String(contact?.Client_Status ?? '').trim();

// ---------------------------------------------------------------------------
// Working days
// ---------------------------------------------------------------------------
// Sunday is the only weekly off. Measured, not assumed: of the leads created in the last 12 months,
// Saturday carries 379 and Sunday 69 (1.5% — the usual trickle of out-of-hours entry), so counting
// Saturday as a working day is what matches how this business actually sells.
export const WEEKLY_OFF_DAYS = [0];

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Which day a record belongs to
// ---------------------------------------------------------------------------
// services/timeUtils.localDayKey defines this — "the calendar day in the dashboard's timezone" — and
// tf.matches is built on it, but it constructs a fresh Intl.DateTimeFormat per call (~0.14ms). That is
// nothing on a board converting a few hundred dates and ~10s on this one, which reads twelve months of
// two modules. Same setting, same result, one formatter instead of 25,000; the window still decides.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.zoho.timezone, year: 'numeric', month: '2-digit', day: '2-digit'
});
const dayKeyOf = (date) => (date && !Number.isNaN(Date.parse(date)) ? dayFormat.format(new Date(date)) : '');

export function workingDaysBetween(start, end) {
  if (!start || !end || start > end) return 0;
  let days = 0;
  for (let ms = utc(start).getTime(); ms <= utc(end).getTime(); ms += 86_400_000) {
    if (!WEEKLY_OFF_DAYS.includes(new Date(ms).getUTCDay())) days += 1;
  }
  return days;
}

// A qualified-lead record, cut down to what this section counts. Field names and the value convention
// follow config/salesFunnel.js, so a contact is valued here exactly as it is on the funnel board.
function toContact(contact) {
  const stageKey = stageKeyOf(contact.Client_Status);
  const city = canonicalCityName(contact.City);
  return {
    id: String(contact.id ?? ''),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    stageKey,
    qualified: isQualifiedStage(stageKey),
    value: valueOf(contact),
    createdAt: dayKeyOf(contact.Created_Time),
    closedOn: dayKeyOf(contact.Actual_Closure_Date)
  };
}

// A Deal, for the product split and the revision count only. Deals.Value is the pre-tax figure in lakhs
// (median 15; Total_Amount is the same number plus GST), so it is scaled exactly like a Contact's.
// Deals carry their own free-text `city`, which is what a city filter narrows these two metrics on —
// the Contacts city cannot be reached from here. Bucketed and merged with the same rules all the same.
function toDeal(deal) {
  const city = canonicalCityName(deal.city);
  const value = Number(deal.Value);
  const revisions = Number(deal.Number_of_Design_Revisions);
  return {
    id: String(deal.id ?? ''),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    product: String(deal.Product_Type ?? '').trim(),
    revisions: Number.isFinite(revisions) && deal.Number_of_Design_Revisions !== null ? revisions : null,
    value: Number.isFinite(value) && value > 0 ? value * LAKH : 0,
    createdAt: dayKeyOf(deal.Created_Time)
  };
}

// Sunrooof is left out of the product split, as it is everywhere else on this board. The CRM spells it
// Sunrooof, Sunroof and SUNROOOF, so the pattern is relaxed about how many o's it has.
const SUNROOOF = /sun\s*ro+f/i;

// Folds near-duplicate spellings together across every list in view, then writes the winner back —
// the same two-step tidy the funnel board does, so both sections name a city the same way.
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
    record.cityKey = cityBucketOf(winner);
  });
}

// The city the request asked for: "all", a bucket key, or one city's name. Anything the data does not
// know about falls back to every city, so a stale link still answers instead of showing an empty board.
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

// The city switcher, built from every record in view before the filter is applied.
function cityFilters(records) {
  const options = new Map();
  records.filter((record) => record.cityKey === OTHER_CITY_KEY).forEach((record) => {
    const entry = options.get(record.cityNameKey) ?? { key: record.cityNameKey, label: cityNameLabelOf(record.city), count: 0 };
    entry.count += 1;
    options.set(record.cityNameKey, entry);
  });
  return CITY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: records.filter((record) => record.cityKey === bucket.key).length,
    ...(bucket.key === OTHER_CITY_KEY
      ? { options: [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }
      : {})
  }));
}

// Metrics: the small statistics the cards are built from.
const sum = (numbers) => numbers.reduce((total, value) => total + value, 0);
const mean = (numbers) => (numbers.length ? sum(numbers) / numbers.length : null);
const median = (numbers) => {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value, digits = 1) => (value === null ? null : Number(value.toFixed(digits)));

/**
 * One metric, in the single shape every card on this section reads. `value`/`previous` are null rather
 * than 0 when nothing was measured, so the UI can never print a missing measurement as a real zero.
 */
function metric({ key, label, unit, value, previous = null, sample, available = true, reason = null, total, previousTotal }) {
  const usable = available && sample.count > 0;
  const money = unit === 'inr';
  // Rates get two decimals: one closure in a 21-day month is 0.05 a day, and at one decimal that prints
  // as 0 — the exact reading this section is meant to avoid.
  const digits = money ? 0 : (unit === 'per-working-day' ? 2 : 1);
  return {
    key,
    label,
    unit,
    value: usable ? round(value, digits) : null,
    previous: usable && previous !== null ? round(previous, digits) : null,
    sample,
    available: usable,
    ...(usable ? {} : { reason: reason ?? 'No records in this period carry the field this is measured from.' }),
    ...(total === undefined ? {} : { total, previousTotal: previousTotal ?? 0 }),
    ...(money ? { valueLabel: usable ? inr(value) : null, previousLabel: usable && previous !== null ? inr(previous) : null } : {})
  };
}

const sampleOf = (count, of, label) => ({ count, of, label });

// Contacts.Created_Time → Actual_Closure_Date. 179 of the 483 closed Contacts carry a closure date
// BEFORE their creation date — imported history keeping its real closure date against a new record —
// so those are dropped rather than counted as negative or clamped to zero; the sample says how many remain.
const closureSpans = (records) => records
  .filter((record) => record.createdAt && record.closedOn)
  .map((record) => Math.round((utc(record.closedOn) - utc(record.createdAt)) / 86_400_000))
  .filter((days) => Number.isFinite(days) && days >= 0);

/**
 * `contacts` are Zoho Contacts created in the last 12 months (the whole module today), `closed` every
 * Closed contact — a closure can belong to a lead created before the window — and `deals` every Deal
 * created since the comparison window opened.
 * Pass `notice` when Zoho could not be read: the same shape comes back, with zeros and null measurements.
 */
export function buildSalesEfficiency({ tf, contacts = [], closed = [], deals = [], dataFrom = null, city, notice = null, now = new Date() }) {
  // Closures come from their own read, so the same contact can arrive twice; one copy of each.
  const byId = new Map([...(contacts ?? []), ...(closed ?? [])].filter(isRealRecord).map((contact) => [String(contact.id), contact]));
  const rawContacts = [...byId.values()];
  const importMinutes = bulkImportMinutes(rawContacts);
  const isService = (contact) => isServiceImport(contact, importMinutes);
  const amsDetected = rawContacts.filter(isService).length;

  const allContacts = (EXCLUDE_AMS_RECORDS ? rawContacts.filter((contact) => !isService(contact)) : rawContacts).map(toContact);
  // isRealRecord reads Full_Name, which on a Deal is Deal_Name. Worth the mapping: six staff test
  // orders ("Test Opportunity", "test-opp") carry values of 1,00,000 to 3,00,000 lakh and are 92% of
  // every rupee in the module, so leaving them in makes the product split meaningless.
  const allDeals = (deals ?? []).filter((deal) => isRealRecord({ Full_Name: deal?.Deal_Name })).map(toDeal);

  applyCityMerge([allContacts, allDeals]);

  // Both windows are plain day-key ranges, so a string comparison is exactly what tf.matches means.
  // The older "7d" / "dN" day windows state no previous bounds, so there the window's own predicate
  // still decides — a day key is a valid input to it.
  const between = (from, to) => (day) => Boolean(day) && Boolean(from) && day >= from && day <= to;
  const inNow = tf.start && tf.end ? between(tf.start, tf.end) : (day) => Boolean(day) && tf.matches(day);
  const inBefore = tf.previousStart && tf.previousEnd
    ? between(tf.previousStart, tf.previousEnd)
    : (day) => Boolean(day) && tf.previousMatches(day);
  // Everything this section can show, before any city filter: the switcher is built from it so the user
  // can always see — and switch to — a city they are not currently looking at. Records outside the
  // period and its comparison window are not in view and must not inflate the counts.
  const dated = (record) => inNow(record.createdAt) || inBefore(record.createdAt)
    || inNow(record.closedOn) || inBefore(record.closedOn);
  const universe = [...allContacts.filter(dated), ...allDeals.filter(dated)];

  const selected = resolveCity(city, universe);
  const only = (list) => list.filter(selected.matches);

  const leads = only(allContacts.filter((record) => inNow(record.createdAt)));
  const leadsBefore = only(allContacts.filter((record) => inBefore(record.createdAt)));
  const closures = only(allContacts.filter((record) => inNow(record.closedOn)));
  const closuresBefore = only(allContacts.filter((record) => inBefore(record.closedOn)));
  const periodDeals = only(allDeals.filter((record) => inNow(record.createdAt)));
  const dealsBefore = only(allDeals.filter((record) => inBefore(record.createdAt)));

  const workingDays = workingDaysBetween(tf.start, tf.end);
  const previousWorkingDays = workingDaysBetween(tf.previousStart, tf.previousEnd);
  const comparisonLabel = previousLabelOf(tf.kind, tf.previousLabel ?? null);

  return {
    meta: {
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      city: selected.key,
      comparison: {
        start: tf.previousStart ?? null,
        end: tf.previousEnd ?? null,
        label: comparisonLabel,
        available: Boolean(tf.previousStart) && (!dataFrom || dataFrom <= tf.previousStart)
      },
      workingDays,
      previousWorkingDays,
      excludeAmsRecords: EXCLUDE_AMS_RECORDS,
      amsExcluded: EXCLUDE_AMS_RECORDS ? amsDetected : 0,
      // How many the rule identifies, whether or not the switch is on, so the customer can see the size
      // of the decision without the board having to be rebuilt to show it.
      amsDetected,
      dataFrom,
      notice
    },
    filters: { cities: cityFilters(universe) },
    metrics: buildMetrics({ leads, leadsBefore, closures, closuresBefore, periodDeals, dealsBefore, workingDays, previousWorkingDays, notice }),
    series: monthlySeries(allContacts, selected, dataFrom, now),
    products: productSplit(periodDeals, dealsBefore),
    regions: regionRows(leads, leadsBefore, closures, closuresBefore)
  };
}

// The eight cards, always all eight and always in this order, so the UI's layout never depends on what
// the CRM happened to hold this month.
function buildMetrics({ leads, leadsBefore, closures, closuresBefore, periodDeals, dealsBefore, workingDays, previousWorkingDays, notice }) {
  const spans = closureSpans(closures);
  const spansBefore = closureSpans(closuresBefore);
  const closureSample = sampleOf(spans.length, closures.length,
    `${spans.length} of ${closures.length} closed leads carry a usable created-to-closed span`);

  const revisions = periodDeals.map((deal) => deal.revisions).filter((count) => count !== null);
  const revisionsBefore = dealsBefore.map((deal) => deal.revisions).filter((count) => count !== null);
  const closedValues = closures.map((record) => record.value).filter((value) => value > 0);
  const closedValuesBefore = closuresBefore.map((record) => record.value).filter((value) => value > 0);
  const qualified = leads.filter((record) => record.qualified);
  const qualifiedBefore = leadsBefore.filter((record) => record.qualified);

  // A rate per working day is a real measurement even when the count is zero, so its sample counts
  // working days rather than records — otherwise a genuinely quiet week would report as unmeasurable.
  // The one exception is a failed read: there the zero is an absence of data, not an absence of leads.
  const rate = (key, label, records, before) => metric({
    key,
    label,
    unit: 'per-working-day',
    value: workingDays ? records.length / workingDays : null,
    previous: previousWorkingDays ? before.length / previousWorkingDays : null,
    total: records.length,
    previousTotal: before.length,
    available: !notice,
    reason: notice,
    sample: sampleOf(workingDays, workingDays,
      `${records.length} over ${workingDays} working day${workingDays === 1 ? '' : 's'} (Mon–Sat)`)
  });

  return [
    rate('leadRate', 'Average lead generation', leads, leadsBefore),
    rate('qualificationRate', 'Average qualification', qualified, qualifiedBefore),
    rate('closureRate', 'Average closure', closures, closuresBefore),
    metric({ key: 'timeToCloseMedian', label: 'Median time to close', unit: 'days', value: median(spans), previous: median(spansBefore), sample: closureSample }),
    // The mean sits next to the median on purpose: over a handful of records one long-running deal
    // moves it a long way, and the pair shows that where a single number would hide it.
    metric({ key: 'timeToCloseMean', label: 'Mean time to close', unit: 'days', value: mean(spans), previous: mean(spansBefore), sample: closureSample }),
    // Value comes from Contacts: Deals.Amount measured 0% filled, so the closed set is the only source.
    metric({
      key: 'averageOrderValue',
      label: 'Average order value',
      unit: 'inr',
      value: mean(closedValues),
      previous: mean(closedValuesBefore),
      sample: sampleOf(closedValues.length, closures.length, `${closedValues.length} of ${closures.length} closed leads carry a value`)
    }),
    // Deals, not Contacts: Number_of_Design_Revisions exists only there, and only on about 9% of orders.
    metric({
      key: 'averageRevisions',
      label: 'Average design revisions',
      unit: 'count',
      value: mean(revisions),
      previous: mean(revisionsBefore),
      sample: sampleOf(revisions.length, periodDeals.length, `${revisions.length} of ${periodDeals.length} orders record a revision count`)
    }),
    metric({
      key: 'averageDiscount',
      label: 'Average discount',
      unit: 'count',
      value: null,
      sample: sampleOf(0, 0, 'Not recorded in Zoho'),
      available: false,
      reason: 'Discount is not filled in Zoho. Discount (%) is set on 2 of 4,910 Contacts and 3 of 7,591 orders, '
        + 'and Management Discount on 1 and 10. Amount After Discount is a formula over that empty field, so it '
        + 'equals the pre-discount value and measures nothing. No proxy is substituted for it.'
    })
  ];
}

// ---------------------------------------------------------------------------
// The 12-month trend
// ---------------------------------------------------------------------------
// Counted off the SAME Contacts list the cards are built from — that read already covers 12 months, so
// the series costs no extra call to Zoho. City-filtered like everything else on the section.
function monthlySeries(records, selected, dataFrom, now) {
  const inScope = records.filter(selected.matches);
  const today = toIso(new Date(now));
  const first = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 12, 1));
  const monthOf = (date) => String(date ?? '').slice(0, 7);
  const months = Array.from({ length: 12 }, (_, index) =>
    toIso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1))).slice(0, 7));
  return {
    dataFrom,
    months: months.map((month) => {
      const created = inScope.filter((record) => monthOf(record.createdAt) === month);
      const closed = inScope.filter((record) => monthOf(record.closedOn) === month);
      const closedValue = sum(closed.map((record) => record.value));
      return {
        month,
        label: utc(`${month}-01`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' }),
        leads: created.length,
        qualified: created.filter((record) => record.qualified).length,
        closed: closed.length,
        closedValue,
        closedValueLabel: inr(closedValue),
        // A month before the CRM held anything is not a quiet month, and the UI has to be able to draw
        // it as "no data" rather than as a collapse to zero.
        available: !dataFrom || month >= dataFrom.slice(0, 7)
      };
    })
  };
}

// ---------------------------------------------------------------------------
// Product split
// ---------------------------------------------------------------------------
// Deals.Product_Type, filled on 7,194 of 7,591 (95%). The Contacts product fields are 33% and 15%
// filled, so they are the wrong source for a share. Sunrooof is left out, as elsewhere on this board.
// The AMS switch does not reach here: the bulk-import rule selects 0 Deals, because every bulk-created
// order carries a real Stage. Only the Contacts-derived figures move when it is flipped.
function productSplit(periodDeals, dealsBefore) {
  const counted = (list) => list.filter((deal) => deal.product && !SUNROOOF.test(deal.product));
  const now = counted(periodDeals);
  const before = counted(dealsBefore);
  const totalValue = sum(now.map((deal) => deal.value));
  const previousTotal = sum(before.map((deal) => deal.value));
  const share = (value, total) => (total ? Number(((value / total) * 100).toFixed(1)) : 0);
  const rows = [...new Set([...now, ...before].map((deal) => deal.product))].map((product) => {
    const mine = now.filter((deal) => deal.product === product);
    const theirs = before.filter((deal) => deal.product === product);
    const value = sum(mine.map((deal) => deal.value));
    const wasValue = sum(theirs.map((deal) => deal.value));
    return {
      key: product.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: product,
      count: mine.length,
      value,
      valueLabel: inr(value),
      share: share(value, totalValue),
      previousCount: theirs.length,
      previousValue: wasValue,
      previousShare: share(wasValue, previousTotal)
    };
  }).sort((a, b) => b.value - a.value || b.count - a.count || a.label.localeCompare(b.label));
  return {
    source: 'Zoho Deals · Product Type (Sunrooof excluded)',
    sample: sampleOf(now.length, periodDeals.length,
      `${now.length} of ${periodDeals.length} orders in this period record a product type`),
    rows
  };
}

// ---------------------------------------------------------------------------
// Region-wise sale
// ---------------------------------------------------------------------------
// The DEL / HYD / OTHER buckets, then each city on its own, both carrying leads, closures and closed
// value. `byCity` uses the canonical names the board already produces, so "banglore" and "BENGALURU"
// are one row — and it is the list the heat map is drawn from.
function regionRows(leads, leadsBefore, closures, closuresBefore) {
  const tally = (leadSet, closureSet) => {
    const value = sum(closureSet.map((record) => record.value));
    return { leads: leadSet.length, closures: closureSet.length, value, valueLabel: inr(value) };
  };
  const row = (test, extra) => {
    const nowRow = tally(leads.filter(test), closures.filter(test));
    const was = tally(leadsBefore.filter(test), closuresBefore.filter(test));
    return { ...extra, ...nowRow, previousLeads: was.leads, previousClosures: was.closures, previousValue: was.value };
  };

  const byBucket = CITY_KEYS.map((key) =>
    row((record) => record.cityKey === key, { key, label: cityLabelOf(key) }));

  const names = new Map();
  [...leads, ...closures, ...leadsBefore, ...closuresBefore].forEach((record) => {
    if (!names.has(record.cityNameKey)) names.set(record.cityNameKey, cityNameLabelOf(record.city));
  });
  const byCity = [...names.entries()]
    .map(([key, label]) => row((record) => record.cityNameKey === key, { key, city: label, cityKey: cityBucketOf(label) }))
    .sort((a, b) => b.leads - a.leads || b.value - a.value || a.city.localeCompare(b.city));

  return { byBucket, byCity };
}
