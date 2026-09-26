import {
  CITY_BUCKETS, CITY_KEYS, CLOSED_CARD_LABEL, CLOSED_STAGE, HANDOVER_LABEL, HANDOVER_MATCH, LADDER_STAGES,
  OTHER_CITY_KEY, OTHER_SOURCE, OVERDUE_LABEL, PRINCIPAL_STAGE, QUALIFIED_BY, SOURCE_BUCKETS,
  canonicalCityName, cityBucketOf, cityNameKeyOf, cityNameLabelOf, cityRows, estClosureLabelOf,
  hasStageSet, isOpenStage, isQualifiedStage, isRealRecord, mergeCityNames, previousLabelOf, productOf, qualifiedByOf,
  sourceBucketOf, stageKeyOf, stageLabelOf, valueOf
} from '../config/salesFunnel.js';
import { addDays, label as formatRange } from './periods.js';
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
//
// THE PAYLOAD, for whoever is building against it:
//   meta        { reportLabel, start, end, city, comparison: { start, end, label, available }, notice }
//   filters     { cities: [ { key, label, count, options? } ] }
//   leadGeneration   { previousLabel, incoming, selfRaw, qualified, qualifiedBy[], bySource[] }
//   salesPerformance { previousLabel, estClosure, overdue, stages[], principal, closed, handover }
//   weeks       [ { weekKey, label, start, end, count, ids } ] — every Monday-start week the period
//               touches, in order, including weeks with nothing in them
//   buckets     [ { key, label, start, end, count, ids } ] — NOT weeks, and not in date order with them.
//               Two of them, always sent: 'overdue' (follow-up before the first week on screen) and
//               'later' (after the last). They exist because `weeks` only covers the period, so these
//               records would otherwise drop off the board entirely — and the overdue ones are exactly
//               what the view is for. Render them either side of the weeks, styled as their own thing.
//   records     [ { id, name, cityRaw, city, cityKey, psm, owner, salesPerson, product, status,
//                   estClosureDate, followUpDate, followUpOverdue, nextAction, weekKey, source,
//                   sourceKey, stage, stageKey, qualifiedBy, value, valueLabel, createdAt, closedOn } ]
// Every card carries { key?, label?, count, value, valueLabel, ids } and, where a comparison is honest,
// { previous, previousValue }. `overdue` has none, on purpose. A card may carry `note` (a caveat about
// its data) or its own `previousLabel` when its comparison window differs from the section's.
// Every card also carries `byCity`: three rows, DEL / HYD / OTHER, always all three even when one is
// empty, each row a card of the same shape. They partition the card, so they sum back to its `count`
// and its `value`. A row's `previous` follows the card's — overdue's rows have none either.
// Records join to weeks and buckets by `ids`, or equivalently to a week by `weekKey` (the Monday of the
// record's FOLLOW-UP week). Every record that has a follow-up appears in exactly one week or one bucket.
// The one case the UI still has to place itself:
//   weekKey null   no follow-up is booked, so the record is in no week and no bucket. Two records in
//                  three. It needs a column of its own; it must not be filed under a week it has
//                  nothing to do with, and that column is the data-entry gap made visible.

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

// A date field reduced to its day, whether Zoho sent a date or a datetime. Null when it holds nothing.
const dayOf = (value) => {
  const day = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
};
const collapse = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// The Monday of the week a day falls in, which is also the week's key. Null for a missing day, so a
// record with no date is never filed under a week it has nothing to do with.
export const weekKeyOf = (day) => (dayOf(day) ? addDays(dayOf(day), -((utc(dayOf(day)).getUTCDay() + 6) % 7)) : null);

// Every Monday-start week the period touches, in order, so the UI draws an empty week rather than
// skipping it. Weeks are whole, so the first and last may reach a little outside the period.
const MAX_WEEKS = 120;
export function weeksCovering(start, end) {
  const weeks = [];
  let monday = weekKeyOf(start);
  if (!monday) return weeks;
  while (monday <= end && weeks.length < MAX_WEEKS) {
    const last = addDays(monday, 6);
    weeks.push({ weekKey: monday, label: formatRange(monday, last), start: monday, end: last });
    monday = addDays(monday, 7);
  }
  return weeks;
}

/**
 * The weekly view: the period's weeks, plus the two buckets that catch follow-ups falling outside them.
 * Without the buckets those records simply disappear from the board, and they are mostly follow-ups
 * months past their date — the ones the view exists to surface. Weeks and buckets carry the same
 * { label, start, end, count, ids }, so the UI can iterate both the same way; only a week has a weekKey.
 * Every record that has a follow-up lands in exactly one of them. Records without one are in neither,
 * deliberately: they belong in a column of their own, not filed under a week they have nothing to do with.
 */
function weeklyView(records, tf) {
  const weeks = weeksCovering(tf.start, tf.end);
  const dated = records.filter((record) => record.weekKey);
  const idsOf = (list) => list.map((record) => record.id);
  const firstWeek = weeks[0]?.weekKey ?? null;
  const lastWeek = weeks.at(-1)?.weekKey ?? null;
  weeks.forEach((week) => {
    const mine = dated.filter((record) => record.weekKey === week.weekKey);
    week.count = mine.length;
    week.ids = idsOf(mine);
  });
  const before = firstWeek ? dated.filter((record) => record.weekKey < firstWeek) : [];
  const after = lastWeek ? dated.filter((record) => record.weekKey > lastWeek) : [];
  const earliest = before.map((record) => record.followUpDate).sort()[0] ?? null;
  const latest = after.map((record) => record.followUpDate).sort().at(-1) ?? null;
  return {
    weeks,
    buckets: [
      // Follow-ups dated before the first week on screen. Almost always long overdue.
      { key: 'overdue', label: 'Overdue', start: earliest, end: firstWeek ? addDays(firstWeek, -1) : null, count: before.length, ids: idsOf(before) },
      // Follow-ups booked beyond the last week on screen.
      { key: 'later', label: 'Later', start: lastWeek ? addDays(lastWeek, 7) : null, end: latest, count: after.length, ids: idsOf(after) }
    ]
  };
}

// One qualified-lead record, flattened so the frontend never has to know Zoho's field names.
// `today` is the dashboard's own day, so whether a follow-up is overdue is decided in the business's
// timezone rather than the viewer's browser.
function toRecord(contact, today) {
  const stageKey = stageKeyOf(contact.Client_Status);
  const value = valueOf(contact);
  const city = canonicalCityName(contact.City);
  // "Follow Up Date" is the field the team fills (27% of this month's records); the newer datetime field
  // is filled on about 1%, so it is only a fallback.
  const followUpDate = dayOf(contact.Next_Follow_UP_Date) ?? dayOf(contact.Next_Follow_Up_Date1);
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
    // Null means no follow-up is booked, which is the common case; the UI should show that as a gap
    // rather than filling it in.
    followUpDate,
    // The mock-up shows overdue follow-ups in red. Decided here so every viewer sees the same thing
    // whatever timezone their browser is in. False when no follow-up is booked — missing is not late.
    followUpOverdue: Boolean(followUpDate && today && followUpDate < today),
    // Last_Note, the free text the team writes ("waiting for the architect approval", "rnr - 16-Sep-26").
    // Description is deliberately NOT a fallback: 80% of it is bulk-import boilerplate, so falling back
    // would fill this column with "imported parent for 1 explicit ams visit" dressed up as a note.
    nextAction: collapse(contact.Last_Note),
    // The Monday-start week this record belongs to, keyed on the FOLLOW-UP date, because the weekly view
    // is about what needs acting on. Null when no follow-up is booked.
    weekKey: weekKeyOf(followUpDate),
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
// `previous` is the same set one period earlier, which adds `previous` and `previousValue` for the trend.
// Pass null when there is no honest comparison to make and the card simply goes without.
function card(records, extra = {}, previous = null) {
  const { note, ...rest } = extra;
  const { count, value, ids } = totals(records);
  const trend = previous ? { previous: previous.length, previousValue: totals(previous).value } : {};
  return { ...rest, count, value, valueLabel: inr(value), ids, ...trend, ...(note ? { note } : {}) };
}

const sliceOf = (records, test) => (records ? records.filter(test) : null);

// A card broken down by city bucket. byCity always lists all three, so the three counts add up to
// `count`. Each row carries the comparison too, unless the card itself goes without one (overdue).
function cityCard(records, extra = {}, previous = null) {
  const inBucket = (key) => (record) => record.cityKey === key;
  return {
    ...card(records, extra, previous),
    byCity: cityRows(records, (mine, row) => card(mine, row, sliceOf(previous, inBucket(row.key))))
  };
}

// The rows of a breakdown (who qualified it, where it came from) are cards in their own right, so they
// carry the same three city numbers as the headline cards above them.
const bucketCards = (records, buckets, field, previous = null) =>
  buckets.map(({ key, label }) => {
    const inBucket = (record) => record[field] === key;
    return cityCard(records.filter(inBucket), { key, label }, sliceOf(previous, inBucket));
  });

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
export function estimateEndOf({ kind, start, end }) {
  if (kind === 'monthly') return monthEndAfter(start, 0);
  if (kind === 'quarterly') return monthEndAfter(start, 2);
  if (kind === 'yearly') return monthEndAfter(start, 11);
  if (kind === 'this-week') return addDays(start, 6);
  return end;
}

// The same span one period earlier, so the estimate card compares like with like: a whole month against
// a whole month, rather than against however much of it had elapsed by today's date.
const previousEstimateEnd = (tf) => estimateEndOf({ kind: tf.kind, start: tf.previousStart, end: tf.previousEnd });

/**
 * `contacts` are Zoho Contacts created since the period start, `closed` every Closed contact (closures
 * are dated by Actual_Closure_Date, so they can be far older than the window) and `estimates` every
 * contact carrying an Est. Closure Date, which can be older still.
 * Pass `notice` when Zoho could not be read: the same shape comes back, with zeros.
 */
export function buildSalesFunnelBoard({ tf, contacts = [], closed = [], estimates = [], dataFrom = null, city, notice = null, now = new Date() }) {
  // The dashboard's own day, used for "is this follow-up late" and for the overdue card below.
  const today = localDayKey(now);
  const real = (list) => (list ?? []).filter(isRealRecord).map((contact) => toRecord(contact, today));
  const allContacts = real(contacts);
  const allClosures = real(closed);
  const created = allContacts.filter((record) => inWindow(tf, record.createdAt));
  const closures = allClosures.filter((record) => inWindow(tf, record.closedOn));
  // The comparison window the period already defines, counted the same way, so "vs last period" means
  // the same thing here as it does on the PSM board's funnel.
  const wasInWindow = (date) => Boolean(date) && tf.previousMatches(date);
  const createdBefore = allContacts.filter((record) => wasInWindow(record.createdAt));
  const closuresBefore = allClosures.filter((record) => wasInWindow(record.closedOn));
  // A deal that is Dead or already Closed cannot close again, so it is neither expected nor overdue.
  const openEstimates = real(estimates).filter((record) => record.estClosureDate && isOpenStage(record.stageKey));
  const estimateEnd = estimateEndOf(tf);
  const between = (from, to) => (record) => record.estClosureDate >= from && record.estClosureDate <= to;
  const expected = openEstimates.filter(between(tf.start, estimateEnd));
  const expectedBefore = openEstimates.filter(between(tf.previousStart, previousEstimateEnd(tf)));
  // Overdue follows today, not the reporting period: an estimate that has passed stays passed whichever
  // period is on screen. It is still city-filtered, like every other card.
  const overdue = openEstimates.filter((record) => record.estClosureDate < today);
  // One spelling per city, decided across everything in view before any card is counted. The comparison
  // lists are in here too, so their city rows are bucketed the same way as the current ones.
  applyCityMerge([created, closures, expected, overdue, createdBefore, closuresBefore, expectedBefore]);
  // The same record can reach this list by several routes; one copy of each, so every id a card quotes
  // resolves against `records`.
  const byId = new Map([...created, ...closures, ...expected, ...overdue].map((record) => [record.id, record]));
  const universe = [...byId.values()];

  const selected = resolveCity(city, universe);
  const only = (list) => list.filter(selected.matches);
  // Everything created in the period, and the whole of it is the `incoming` card. The cards below cut
  // this one set up; they never re-filter `created`, so they always add back up to it.
  const intake = only(created);
  const intakeBefore = only(createdBefore);
  // Closures are dated by Actual_Closure_Date rather than by when the lead arrived: a lead takes months
  // to close, so they belong to the period's activity, not to its intake.
  const closedNow = only(closures);
  const open = intake.filter((record) => isOpenStage(record.stageKey));
  const openBefore = intakeBefore.filter((record) => isOpenStage(record.stageKey));
  const qualified = intake.filter((record) => isQualifiedStage(record.stageKey));
  const qualifiedBefore = intakeBefore.filter((record) => isQualifiedStage(record.stageKey));
  const byQualifier = (records, key) => records.filter((record) => record.qualifiedBy === key);
  const comparisonLabel = previousLabelOf(tf.kind, tf.previousLabel ?? null);
  // Everything the board will show, once. The weekly view groups these, and they are what `records` sends.
  const visible = only(universe);

  const stageCard = (stage) => {
    const records = open.filter((record) => record.stageKey === stage.key);
    // S1 is mostly records with no Current Stage at all, so it says so rather than letting the card be
    // read as "the CRM checked these and found them unvalidated".
    const blank = records.filter((record) => !record.hasStage).length;
    const note = stage.key === 'S1' && blank
      ? `${blank} of ${records.length} have no Current Stage set in Zoho`
      : null;
    return cityCard(records, { key: stage.key, label: stage.label, short: stage.short, note },
      openBefore.filter((record) => record.stageKey === stage.key));
  };

  return {
    meta: {
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      city: selected.key,
      // What every card's `previous` is measured against. `available` is false when the CRM held nothing
      // for part of that window — the Contacts module only starts in late 2025, so a year-on-year
      // comparison has nothing real behind it and a trend arrow would read as infinite growth rather
      // than "no data". The figures are still returned; this says whether they mean anything.
      comparison: {
        start: tf.previousStart ?? null,
        end: tf.previousEnd ?? null,
        label: comparisonLabel,
        available: Boolean(tf.previousStart) && (!dataFrom || dataFrom <= tf.previousStart)
      },
      notice
    },
    filters: { cities: cityFilters(universe) },
    leadGeneration: {
      // What every trend in this section is measured against, worded for the period on screen. A card
      // whose comparison window differs from the section's carries its own `previousLabel` instead.
      previousLabel: comparisonLabel,
      // The intake, split by who the PSM field names: a real PSM handed it over, or a sales person
      // brought it in themselves. The two cover the intake exactly.
      incoming: cityCard(byQualifier(intake, 'psm'), { key: 'incoming', label: 'Incoming leads from PSM' },
        byQualifier(intakeBefore, 'psm')),
      selfRaw: cityCard(byQualifier(intake, 'self'), { key: 'selfRaw', label: 'Self-generated raw leads' },
        byQualifier(intakeBefore, 'self')),
      // The qualified part of the WHOLE intake, so both cards above feed it, then cut two ways: by who
      // qualified it and by where it came from.
      qualified: cityCard(qualified, {}, qualifiedBefore),
      qualifiedBy: bucketCards(qualified, QUALIFIED_BY, 'qualifiedBy', qualifiedBefore),
      bySource: bucketCards(qualified, [...SOURCE_BUCKETS, OTHER_SOURCE], 'sourceKey', qualifiedBefore)
    },
    salesPerformance: {
      previousLabel: comparisonLabel,
      // What the sales team expects to close in the period, and what has already slipped past its
      // estimate. Neither is the same set as `closed` below, which is what actually closed.
      // Its own `previousLabel`: the estimate card compares whole calendar periods, so its comparison
      // window is a different span from the section's and must be named separately.
      estClosure: cityCard(only(expected), {
        key: 'estClosure',
        label: estClosureLabelOf(tf.kind),
        previousLabel: previousLabelOf(tf.kind, formatRange(tf.previousStart, previousEstimateEnd(tf)))
      }, only(expectedBefore)),
      // No `previous`: overdue is not period-filtered, it is everything still open with a date in the
      // past, so any "last period" figure would be invented rather than measured.
      overdue: cityCard(only(overdue), { key: 'overdue', label: OVERDUE_LABEL }),
      stages: LADDER_STAGES.map(stageCard),
      principal: stageCard(PRINCIPAL_STAGE),
      // What actually closed in the period, by Actual_Closure_Date. The flow reads
      // Est. closure → Overdue → S1..S5 → S6 → Order Booked → Handover.
      closed: cityCard(closedNow, { key: CLOSED_STAGE.key, label: CLOSED_CARD_LABEL }, only(closuresBefore)),
      handover: cityCard(open.filter((record) => record.handover), { key: 'handover', label: HANDOVER_LABEL },
        openBefore.filter((record) => record.handover))
    },
    // The weekly view. `weeks` are the period's Monday-start weeks, sent whether or not anything falls
    // in them so the UI draws the empty ones; `buckets` catch the follow-ups either side.
    ...weeklyView(visible, tf),
    // The internal signals the cards were built from are dropped; the frontend gets the flat record only.
    records: visible.map(({ cityNameKey, handover, hasStage, ...record }) => record)
  };
}
