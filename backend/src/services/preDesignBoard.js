import {
  CITY_BUCKETS, CITY_KEYS, OTHER_CITY_KEY, canonicalCityName, cityBucketOf,
  cityNameKeyOf, cityNameLabelOf, cityRows, mergeCityNames, previousLabelOf
} from '../config/salesFunnel.js';
import { zohoGet } from './zohoClient.js';

// The Design board's pre-design funnel, built from Zoho Deals (the Orders module), NOT Contacts.
// The customer's five steps, in their order:
//   1 intake       total Area (Sqft) sent in for design, with the order count and DEL / HYD / Others
//   2 firstDesign  the first design produced for an order
//   3 revisions    revisions against the three-revision limit, as a distribution
//   4 booked       the order was booked
//   5 handover     the order left design for post-design
//
// ---------------------------------------------------------------------------
// THE STAGE TABLE — the one place a stage-to-card mapping is corrected
// ---------------------------------------------------------------------------
// Deals.Stage is a 60+ value picklist and it is a SNAPSHOT: it says where an order stands now, not
// where it has been. So each stage is given the furthest milestone it proves the order reached, and a
// card counts "rank >= its own". Zoho's own picklist sequence numbers were the starting point, but they
// are not usable directly — the list was extended twice, so "Order Booked" is seq 11 while "Sent for
// Approval" is seq 16 even though booking follows approval. The ranks below are the real order.
//
// Several live values are not in the Deals layout picklist at all (PD Approvals, Complete, Wall
// cladding, Precourement, Query to SM, Modd Board, Final DWG, Stone Dwg, EP DWG, ...). They come from
// another layout and are listed here explicitly rather than matched by pattern.
//
//   rank 0  OUT      never started, or stopped: no claim is made about it
//   rank 1  DESIGN   with a designer, being drawn
//   rank 2  SENT     a design has been produced and gone out          -> card 2
//   rank 3  BOOKED   the order was booked                             -> card 4
//   rank 4  POST     the order has left design for post-design        -> card 5
//
// An unlisted stage falls to rank 1 (in design, nothing further claimed), so a new picklist value can
// never quietly inflate the booked or handed-over cards. Add it below when one appears.
export const STAGE_RANKS = [
  { rank: 0, name: 'Out of play', stages: [
    'None', 'Raw Quote', 'Ringing No Response', 'Call Back Later', 'Will Visit Showroom',
    'Under Follow Up', 'Not Interested', 'Closed Lost', 'Stalled', 'Hold'] },
  { rank: 1, name: 'In design', stages: [
    'Designer Assigned', 'Design Discussion', 'Revised Design Discussion', 'Revision Required',
    'Revision For 3D Drawing', 'Design Revision After Site Measurement', 'Query to SM',
    'Modd Board', 'Modd Board Selection(Client) Request', 'Under Follow Up Design'] },
  { rank: 2, name: 'Design sent', stages: [
    'Sent for Approval', 'Design Dis-Approved', 'Price Discussion'] },
  { rank: 3, name: 'Booked', stages: [
    'Order Booked', 'Closed Won', 'Payment Awaited', 'Payment Approvals'] },
  // Everything from "Assign Post - Designer" onwards. Reaching any of these means design handed the
  // order on, so each of them also proves booking (card 4 counts rank >= 3).
  { rank: 4, name: 'Handed to post-design', stages: [
    'Assign Post - Designer', 'PD Approvals', 'Align First Measurement', 'First Measurement Done',
    'First Measurement Approved', 'First Measurement / EPT /Production Drawing / Mood Board 3D / PDI',
    'Request Appliances from Client', 'Appliances Details', 'Schedule Meeting for Finishes',
    'Preparation of Electrical and Plumbing Drawings', 'EP DWG', 'EP Marking', 'EP Verification',
    'Electric/Plumbing Marking Aligned', 'Electric/Plumbing Marking Done',
    'Electric/Plumbing Checking Done', 'Request for Electric Plumbing Checking',
    'Prep. of Sign-off & Production Drawing', 'Final DWG', 'Stone Dwg', 'Wall cladding',
    'Sent for Design Approval', 'Design Approval', 'Verification',
    'Handover to Factory', 'Create MPP', 'Material Procurement', 'Precourement',
    'Prepare PDI', 'PDI', 'PDI Done', 'PDI Verifiction', 'Align PDI', 'Request Visit for PDI',
    'Send PDI Drawings to Factory', 'Create Production Set', 'Start Production',
    'Sent for PDI payment Approval', 'PDI Payment Done', 'Site Approved for Dispatch',
    'Request for Site Visit', 'Site Follow up Done',
    'First Dipatch Done', 'Full Dispatch', 'Sent for Second Dispatch Approval', 'Second Dispatch Done',
    'Start First Installation Process', 'First Installation Done',
    'Start Second Installation Process', 'Second Installation Done',
    'Handover to Installation Team', 'Final Handover', 'Complete',
    'Raise Final Complaint', 'Complaint Material Dispatched'] }
];

const RANK_OF = new Map(STAGE_RANKS.flatMap(({ rank, stages }) =>
  stages.map((stage) => [stage.trim().toLowerCase(), rank])));
// Unlisted stage: "in design", the claim that costs nothing.
const UNKNOWN_RANK = 1;
export const rankOf = (stage) => RANK_OF.get(String(stage ?? '').trim().toLowerCase()) ?? UNKNOWN_RANK;

// The limit the business works to. Card 3 shows the spread against it.
export const REVISION_LIMIT = 3;

const clean = (value) => String(value ?? '').trim();
// Zoho writes an unset picklist as the literal "-None-", which is not a value.
const set = (value) => Boolean(clean(value)) && clean(value) !== '-None-';
const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------
// Sqaure_Feet is the CRM's own misspelling of the field labelled "Area (Sqft)". It is filled on 11% of
// the module and on NONE of the orders created this month, so on its own the headline card would read
// zero. Cabinet_Area_Sqft is filled three times as often, and where both exist they are the same
// number on 283 of 331 orders (and within 10% on 306), so cabinet area is the same measure keyed into
// a different box rather than a component of it. Hence "else", never "plus": adding the cabinet,
// backsplash and countertop fields together would double-count the 331.
const areaOf = (deal) => (num(deal.Sqaure_Feet) > 0 ? num(deal.Sqaure_Feet) : num(deal.Cabinet_Area_Sqft));

const sqft = (value) => `${Math.round(value).toLocaleString('en-IN')} sq ft`;

// ---------------------------------------------------------------------------
// Which orders this board is about
// ---------------------------------------------------------------------------
// "Sent in for design" is read off the design fields, never off Stage. The CRM was loaded with legacy
// orders that sit at Final Handover carrying no designer, no design date and no design presentation —
// 1,811 of the orders created in the current quarter. A stage-based test would sweep all of them onto
// a design board they never passed through, and would make the funnel widen at the bottom.
//
// Every order created in the period is kept and counted (the intake card's first bracket figure); this
// decides only which of them the funnel is ABOUT.
const enteredDesign = (deal) =>
  set(deal.Designer_Name) || set(deal.Design_Required_on) || set(deal.Expected_Design_Date)
  || set(deal.Send_For_Approval_Date) || set(deal.Design_Presentation)
  || set(deal.Design_Approved_Date) || set(deal.Number_of_Design_Revisions);

// Staff test orders. The Sales funnel's isRealRecord reads Full_Name, which Deals do not have — theirs
// is Deal_Name — so it passes every deal through. 66 test orders are in the module; this is the field
// that actually filters them.
export const isRealDeal = (deal) => !/\btest\b/i.test(deal?.Deal_Name ?? '');

// One order, flattened so the frontend never sees a Zoho field name.
function toRecord(deal) {
  const rank = rankOf(deal.Stage);
  const city = canonicalCityName(deal.city);
  const area = areaOf(deal);
  const revisions = num(deal.Number_of_Design_Revisions);
  // Handover out of design. Handover_Date is the customer handover at the very end of the pipeline
  // (1,814 of the 1,851 that carry it sit at Final Handover), so it proves the order left design too.
  const handedOver = rank >= 4 || set(deal.Handover_Date);
  return {
    id: String(deal.id ?? ''),
    name: deal.Deal_Name ?? 'Unnamed order',
    cityRaw: clean(deal.city),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    designer: set(deal.Designer_Name) ? clean(deal.Designer_Name) : '',
    owner: deal.Owner?.name ?? '',
    stage: clean(deal.Stage),
    rank,
    // The measure this board counts in. `value` keeps the house card shape; here it is square feet,
    // never rupees — Deals.Amount is empty on every record in the module.
    value: area,
    hasArea: area > 0,
    revisions,
    hasRevisions: set(deal.Number_of_Design_Revisions) && revisions > 0,
    designSentOn: deal.Send_For_Approval_Date ?? null,
    designPresentation: clean(deal.Design_Presentation),
    designRequiredOn: deal.Design_Required_on ?? null,
    expectedDesignDate: deal.Expected_Design_Date ?? null,
    designApprovedOn: deal.Design_Approved_Date ?? null,
    handoverOn: deal.Handover_Date ?? null,
    createdAt: deal.Created_Time ?? null,
    // Whether this order reached design at all. Every order created in the period is counted on the
    // intake card; only the ones with this flag are what the funnel below it is about.
    inDesign: enteredDesign(deal),
    // The three milestones the cards cut on. Booked is implied by handover, so the chain can never
    // widen: every handed-over order is a booked one.
    firstDesign: rank >= 2 || set(deal.Send_For_Approval_Date) || set(deal.Design_Presentation),
    booked: rank >= 3 || handedOver,
    handedOver
  };
}

// ---------------------------------------------------------------------------
// Cards — the house shape: { key, label, count, value, valueLabel, ids, byCity, previous?, note? }
// `byCity` is on every card: three rows, DEL / HYD / OTHER, always all three even when one is empty,
// each row the same shape and measured in square feet like the card it sits under. The rows partition
// the card, so they sum back to its count and its value.
// ---------------------------------------------------------------------------
const totals = (records) => ({
  count: records.length,
  value: records.reduce((sum, record) => sum + record.value, 0),
  ids: records.map((record) => record.id)
});

function card(records, extra = {}, previous = null) {
  const { note, ...rest } = extra;
  const { count, value, ids } = totals(records);
  const trend = previous ? { previous: previous.length, previousValue: totals(previous).value } : {};
  return { ...rest, count, value, valueLabel: sqft(value), ids, ...trend, ...(note ? { note } : {}) };
}

const sliceOf = (records, test) => (records ? records.filter(test) : null);

// A card with its Delhi / Hyderabad / Others rows under it. The rows partition the card, so the three
// counts sum back to its own and the three areas to its `value` — which is square feet here, never
// rupees, in the rows exactly as in the card.
function cityCard(records, extra = {}, previous = null) {
  const inBucket = (key) => (record) => record.cityKey === key;
  return {
    ...card(records, extra, previous),
    byCity: cityRows(records, (mine, row) => card(mine, row, sliceOf(previous, inBucket(row.key))))
  };
}

// The intake card, which is the only one that carries TWO counts: everything that arrived in the
// period, and how much of that was sent in for design. The customer reads the pair as "what came in,
// and how much of it actually reached us" — so `total` is every order created in the period and
// `count` is the design cohort, which is also what `ids`, `value` and every card below this one use.
// Delhi / Hyderabad / Others come with both figures too, so a city row reconciles the same way.
function intakeCard(cohort, arrived, cohortBefore, arrivedBefore, extra = {}) {
  const pair = (mine, all, mineBefore, allBefore, rest) => ({
    ...card(mine, rest, mineBefore),
    total: all.length,
    ...(allBefore ? { previousTotal: allBefore.length } : {})
  });
  const inBucket = (key) => (record) => record.cityKey === key;
  return {
    ...pair(cohort, arrived, cohortBefore, arrivedBefore, extra),
    byCity: cityRows(cohort, (mine, row) => pair(
      mine, arrived.filter(inBucket(row.key)),
      sliceOf(cohortBefore, inBucket(row.key)), sliceOf(arrivedBefore, inBucket(row.key)),
      row
    ))
  };
}

// The city the request asked for: a bucket key, one city's name, or everything. An unknown value falls
// back to everything, so a stale link still answers instead of showing an empty board.
function resolveCity(requested, records) {
  const asked = clean(requested);
  if (!asked || /^all$/i.test(asked)) return { key: 'all', matches: () => true };
  const bucket = CITY_KEYS.find((key) => key.toLowerCase() === asked.toLowerCase());
  if (bucket) return { key: bucket, matches: (record) => record.cityKey === bucket };
  const name = cityNameKeyOf(asked);
  if (records.some((record) => record.cityNameKey === name)) {
    return { key: name, matches: (record) => record.cityNameKey === name };
  }
  return { key: 'all', matches: () => true };
}

// The city switcher, built before the city filter is applied so a bucket you are not looking at is
// still offered.
function cityFilters(records) {
  const options = new Map();
  records.filter((record) => record.cityKey === OTHER_CITY_KEY).forEach((record) => {
    const entry = options.get(record.cityNameKey)
      ?? { key: record.cityNameKey, label: cityNameLabelOf(record.city), count: 0 };
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

// One spelling per city across everything in view, so the dropdown and the city rows agree. Same rule
// as the Sales funnel; the bucket has to follow the winning name or "Hydrabad" stays in Others.
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

const share = (part, whole) => (whole ? part / whole : null);

// ---------------------------------------------------------------------------
// Card 3 — revisions against the three-revision limit
// ---------------------------------------------------------------------------
// A distribution, not a total: one bucket per allowed revision and one for the orders that went past
// the limit. Number_of_Design_Revisions is filled on 9% of the module, so the card says on how many
// orders it is recorded and never implies the rest had none.
const REVISION_BUCKETS = [
  { key: 'r1', label: '1 revision', test: (record) => record.revisions === 1 },
  { key: 'r2', label: '2 revisions', test: (record) => record.revisions === 2 },
  { key: 'r3', label: '3 revisions', test: (record) => record.revisions === 3 },
  { key: 'over', label: `Over ${REVISION_LIMIT}`, test: (record) => record.revisions > REVISION_LIMIT, pastLimit: true }
];

function revisionCard(cohort, previousCohort, label) {
  const withCount = cohort.filter((record) => record.hasRevisions);
  const before = previousCohort.filter((record) => record.hasRevisions);
  const note = cohort.length
    ? `Recorded on ${withCount.length.toLocaleString('en-IN')} of ${cohort.length.toLocaleString('en-IN')} orders in design; the rest are blank in Zoho, not zero`
    : null;
  return {
    // The card's own three city numbers count the orders a revision count is recorded on, which is
    // what the card counts — not the whole cohort behind the note.
    ...cityCard(withCount, { key: 'revisions', label, note }, before),
    limit: REVISION_LIMIT,
    withinLimit: withCount.filter((record) => record.revisions <= REVISION_LIMIT).length,
    overLimit: withCount.filter((record) => record.revisions > REVISION_LIMIT).length,
    // `pastLimit` is a flag on the ONE bucket that sits outside the rule; the card's own `overLimit`
    // above is a count. Two different things, so two different names.
    buckets: REVISION_BUCKETS.map(({ key, label: bucketLabel, test, pastLimit }) => ({
      ...cityCard(withCount.filter(test), { key, label: bucketLabel }, sliceOf(before, test)),
      pastLimit: Boolean(pastLimit),
      share: share(withCount.filter(test).length, withCount.length)
    }))
  };
}

// ---------------------------------------------------------------------------
// The Zoho read
// ---------------------------------------------------------------------------
// Its own read because no existing one covers this field set: getRecentDeals omits Sqaure_Feet, city
// and Design_Presentation, and getEfficiencyDeals omits every design field. Paged here rather than in
// zohoClient because getAllRecords stops at Zoho's 2,000-record page-number ceiling and a quarter's
// comparison window runs to roughly 6,000 orders. zohoGet brings the shared token and 60s cache with it.
const DEAL_FIELDS = [
  'Deal_Name', 'Owner', 'Stage', 'city', 'Created_Time',
  'Sqaure_Feet', 'Cabinet_Area_Sqft',
  'Designer_Name', 'Design_Required_on', 'Expected_Design_Date', 'Design_Approved_Date',
  'Design_Presentation', 'Send_For_Approval_Date', 'Number_of_Design_Revisions', 'Handover_Date'
].join(',');

const MAX_PAGES = 45;

export async function getPreDesignDeals(since) {
  // A day of margin, because Created_Time is a local-timezone stamp and `since` is a plain date.
  const cutoff = Date.parse(`${since}T00:00:00Z`) - 86_400_000;
  const base = { fields: DEAL_FIELDS, per_page: 200, sort_by: 'Created_Time', sort_order: 'desc' };
  const rows = [];
  let pageToken;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // Zoho serves the first 2,000 records by page number and needs the page token beyond that.
    if (page > 10 && !pageToken) break;
    const payload = await zohoGet('Deals', { ...base, ...(page > 10 ? { page_token: pageToken } : { page }) });
    const batch = payload.data ?? [];
    rows.push(...batch);
    pageToken = payload.info?.next_page_token;
    // Newest first, so a page that ends older than the window is the last one worth asking for.
    const oldest = batch.at(-1)?.Created_Time;
    if (!payload.info?.more_records || !oldest || Date.parse(oldest) < cutoff) break;
  }
  return rows.filter((deal) => Date.parse(deal.Created_Time) >= cutoff);
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
/**
 * @param tf      the period window from getTimeframeFilter
 * @param deals   Zoho Deals created since the comparison window's start
 * @param city    all | DEL | HYD | OTHER | one city's name
 * @param notice  set when Zoho could not be read: the same shape comes back, with zeros
 */
export function buildPreDesignBoard({ tf, deals = [], city, notice = null }) {
  // Everything real that arrived, design or not. The cohort is taken out of this a few lines down
  // rather than filtered away here, because the intake card has to report both figures.
  const all = (deals ?? []).filter(isRealDeal).map(toRecord);
  const created = all.filter((record) => record.createdAt && tf.matches(record.createdAt));
  const createdBefore = all.filter((record) => record.createdAt && tf.previousMatches(record.createdAt));
  applyCityMerge([created, createdBefore]);

  const selected = resolveCity(city, created);
  const only = (list) => list.filter(selected.matches);
  // Everything created in the period: the first figure in the intake card's bracket.
  const arrived = only(created);
  const arrivedBefore = only(createdBefore);
  // The cohort every card cuts: the arrivals that were sent in for design. The cards never re-filter
  // it, so each one is a subset of the one above it.
  const cohort = arrived.filter((record) => record.inDesign);
  const before = arrivedBefore.filter((record) => record.inDesign);
  const cut = (test) => [cohort.filter(test), before.filter(test)];

  const [firstDesign, firstDesignBefore] = cut((record) => record.firstDesign);
  const [booked, bookedBefore] = cut((record) => record.booked);
  const [handover, handoverBefore] = cut((record) => record.handedOver);

  const withArea = cohort.filter((record) => record.hasArea);
  const comparisonLabel = previousLabelOf(tf.kind, tf.previousLabel ?? null);

  // Orders that arrived already past design — imported straight into post-design or Final Handover
  // with no design field on them. They are part of the gap between the two bracket figures but they
  // are NOT work that design failed to pick up, so the card says so rather than letting the pair be
  // read as a conversion rate. Nil in a normal month; 1,800-odd in the quarter the CRM was loaded.
  const imported = arrived.filter((record) => !record.inDesign && record.rank >= 4).length;

  // Every number on the intake card that a reader could mistake for something else, said out loud.
  const intakeNote = [
    cohort.length
      ? `Area (Sqft) recorded on ${withArea.length.toLocaleString('en-IN')} of ${cohort.length.toLocaleString('en-IN')} orders sent to design — the total covers those only`
      : null,
    imported
      ? `${imported.toLocaleString('en-IN')} of the ${(arrived.length - cohort.length).toLocaleString('en-IN')} not sent to design arrived already past it, as imported orders`
      : null
  ].filter(Boolean).join('. ') || null;

  return {
    meta: {
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      city: selected.key,
      comparison: { start: tf.previousStart ?? null, end: tf.previousEnd ?? null, label: comparisonLabel, available: Boolean(tf.previousStart) },
      // What the board could and could not measure, so the caveats are data rather than prose in the
      // component. `booked` and `handover` are cohort positions: an order created this week has not had
      // time to reach them, so a short period reads near zero by construction, not by fault.
      coverage: {
        // `arrived` is every order created in the period; `orders` is the design cohort the funnel is
        // about. The intake card shows the pair; the gap between them is not all missed design work,
        // which is what `importedPastDesign` accounts for.
        arrived: arrived.length,
        orders: cohort.length,
        importedPastDesign: imported,
        withArea: withArea.length,
        withRevisionCount: cohort.filter((record) => record.hasRevisions).length,
        areaField: 'Deals.Sqaure_Feet ("Area (Sqft)"), falling back to Cabinet_Area_Sqft where it is blank',
        cohortRule: 'Orders created in the period carrying any design field (designer, design date, design presentation, revision count)',
        cohortNote: 'Legacy orders imported straight into Final Handover carry no design field and are left out',
        tailNote: 'Booked and Handed over are where this period’s intake stands today, so a short period shows few of either'
      },
      notice
    },
    // The switcher counts the design cohort, because that is what the rows under the card show and
    // what switching city actually changes on the funnel.
    filters: { cities: cityFilters(created.filter((record) => record.inDesign)) },
    preDesign: {
      previousLabel: comparisonLabel,
      // 1 — the headline: square feet, with BOTH counts (everything that arrived, and how much of it
      // was sent to design), split by city. `count`/`ids`/`value` stay the design cohort, so the ids
      // the popup opens are design orders and every card below this one is a subset of them.
      intake: intakeCard(cohort, arrived, before, arrivedBefore, {
        key: 'intake', label: 'Sent in for design', note: intakeNote
      }),
      // 2 — the first design produced for the order.
      firstDesign: cityCard(firstDesign, {
        key: 'firstDesign',
        label: 'First fresh design',
        share: share(firstDesign.length, cohort.length)
      }, firstDesignBefore),
      // 3 — the spread against the three-revision limit.
      revisions: revisionCard(cohort, before, 'Revisions'),
      // 4 and 5 — where the cohort stands now.
      booked: cityCard(booked, { key: 'booked', label: 'Booked', share: share(booked.length, cohort.length) }, bookedBefore),
      handover: cityCard(handover, {
        key: 'handover',
        label: 'Handed over',
        share: share(handover.length, cohort.length)
      }, handoverBefore)
    },
    // The design cohort, which is what every card's `ids` point into — including the intake card,
    // whose `total` counts wider than its ids on purpose. The internal signals the cards were cut on
    // are dropped; the frontend gets the flat order only.
    records: cohort.map(({ cityNameKey, rank, hasArea, hasRevisions, inDesign, firstDesign: _fd, booked: _bk, handedOver, ...record }) => record)
  };
}
