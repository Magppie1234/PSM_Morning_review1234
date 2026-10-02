import {
  CITY_BUCKETS, CITY_KEYS, OTHER_CITY_KEY, canonicalCityName, cityBucketOf,
  cityNameKeyOf, cityNameLabelOf, cityRows, mergeCityNames, previousLabelOf
} from '../config/salesFunnel.js';
import { DEAL_PRE_DESIGN_STEPS, EMPTY_STAGE } from '../config/journey.js';
import { attachPreDesignFormulas } from '../config/cardFormula.js';
import { canonicalDesigner, canonicalStage } from '../config/crmNames.js';
import { inr } from './salesFunnelBoard.js';
import { managerOf } from './salesManagers.js';
import { zohoGet } from './zohoClient.js';

// The Design board's pre-design funnel, built from Zoho Deals (the Orders module), NOT Contacts.
// The chain the customer asked for, branch by branch:
//
//   Total new requests ─┬─ Designer assigned ──────────┬─ Under design ─┬─ Sent for ─ Revision ─ Revision ─ Order ─ Handover
//        from sales     └─ Designer assignment pending ┴─ Query to SM ──┘  approval   requested    done     booked  to design
//
// Two of the columns are a PAIR, and each pair PARTITIONS the card before it: every request is either
// assigned or pending, and every request either had a query raised to the sales manager or did not.
// The two counts in a pair therefore add back to the requests card, which is what the bracket drawn
// between them means.
//
// Every card is a COUNT of orders. Only "Order booked" also carries money, because that is the only
// point in the chain where a rupee figure is real: Deals.Value fills as the order is booked.
//
// ---------------------------------------------------------------------------
// THE STAGE TABLE — the one place a stage-to-card mapping is corrected
// ---------------------------------------------------------------------------
// Deals.Stage is a 100-value picklist and it is a SNAPSHOT: it says where an order stands now, not
// where it has been. So each stage is given the furthest milestone it proves the order reached, and a
// card counts "rank >= its own". Zoho's own picklist sequence numbers were the starting point, but they
// are not usable directly — the list was extended twice, so "Order Booked" is seq 11 while "Sent for
// Approval" is seq 16 even though booking follows approval. The ranks below are the real order.
//
//   rank 0  OUT      never started, or stopped: no claim is made about it
//   rank 1  DESIGN   with a designer, being drawn
//   rank 2  SENT     a design has been produced and gone out
//   rank 3  BOOKED   the order was booked
//   rank 4  POST     the order has left design for post-design
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
    'Modd Board', 'Modd Board Selection(Client) Request', 'Modd Board Selection Approved',
    'Revision Modd Board', 'Preparation of 3D Drawings', '3D Drawings Approved',
    'Form Filled', 'Sample Request', 'Under Follow Up Design'] },
  { rank: 2, name: 'Design sent', stages: [
    'Sent for Approval', 'Sent to Client (First Design)', 'Design Dis-Approved', 'Price Discussion'] },
  { rank: 3, name: 'Booked', stages: [
    'Order Booked', 'Closed Won', 'Payment Awaited', 'Payment Approvals'] },
  // Everything from "Assign Post - Designer" onwards. Reaching any of these means design handed the
  // order on, so each of them also proves booking (the booked card counts rank >= 3).
  { rank: 4, name: 'Handed to post-design', stages: [
    'Assign Post - Designer', 'Handover to Post Design', 'PD Approvals', 'Approval from Accounts',
    'Align First Measurement', 'First Measurement', 'First Measurement Done',
    'First Measurement Approved', 'Revisit Req-First Measurement',
    'Design Approved After First Meaurement',
    'First Measurement / EPT /Production Drawing / Mood Board 3D / PDI',
    'EPT', 'Production Drawing', 'Mood Board / 3D',
    'Request Appliances from Client', 'Appliances Details', 'Schedule Meeting for Finishes',
    'Preparation of Electrical and Plumbing Drawings', 'EP DWG', 'EP Marking', 'EP Verification',
    'Request for Electric and Plumbing Marking', 'Align Visit for Electrical / Plumbering',
    'Electric/Plumbing Marking Aligned', 'Electric/Plumbing Marking Done',
    'Electric/Plumbing Checking Done', 'Request for Electric Plumbing Checking',
    'Prep. of Sign-off & Production Drawing', 'Final DWG', 'Stone Dwg', 'Wall cladding',
    'Sent for Design Approval', 'Design Approval', 'Verification',
    'Handover to Factory', 'Create MPP', 'Material Procurement', 'Precourement',
    'Prepare PDI', 'PDI', 'PDI Done', 'PDI Verifiction', 'Align PDI', 'Request Visit for PDI',
    'Send PDI Drawings to Factory', 'Create Production Set', 'Start Production',
    'Sent for PDI payment Approval', 'PDI Payment Done', 'Site Approved for Dispatch',
    'Request for Site Visit', 'Site Follow up', 'Site Follow up Done',
    'First Dipatch Done', 'Full Dispatch', 'Split Dispatch',
    'Sent for Second Dispatch Approval', 'Second Dispatch Approved', 'Second Dispatch Done',
    'Start First Installation Process', 'First Installation Done',
    'Start Second Installation Process', 'Second Installation Done',
    'Handover to Installation Team', 'Final Handover', 'Complete', 'Added Post Handover Payment',
    'Complaint Raised', 'Complaint Closed',
    'Raise Final Complaint', 'Complaint Material Dispatched'] }
];

const RANK_OF = new Map(STAGE_RANKS.flatMap(({ rank, stages }) =>
  stages.map((stage) => [stage.trim().toLowerCase(), rank])));
// Unlisted stage: "in design", the claim that costs nothing.
const UNKNOWN_RANK = 1;
export const rankOf = (stage) => RANK_OF.get(String(stage ?? '').trim().toLowerCase()) ?? UNKNOWN_RANK;

// The stages that mean the order is sitting in a revision RIGHT NOW. An order that once carried a
// revision and has moved off one of these has had that revision delivered — that is the whole
// difference between the "Revision requested" and "Revision done" cards.
const REVISION_STAGES = new Set([
  'revision required', 'revision for 3d drawing', 'design revision after site measurement',
  'revised design discussion', 'revision modd board', 'design dis-approved',
  'revisit req-first measurement'
]);

const QUERY_STAGE = 'query to sm';

// The limit the business works to. The revision card says how many orders went past it.
export const REVISION_LIMIT = 3;

const clean = (value) => String(value ?? '').trim();
// Zoho writes an unset picklist as the literal "-None-", which is not a value.
const set = (value) => Boolean(clean(value)) && clean(value) !== '-None-';
const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------------------
// Area and money
// ---------------------------------------------------------------------------
// Sqaure_Feet is the CRM's own misspelling of the field labelled "Area (Sqft)". It is filled on 11% of
// the module, so Cabinet_Area_Sqft carries it where that box is blank; where both exist they are the
// same number on 283 of 331 orders, so cabinet area is the same measure keyed into a different box
// rather than a component of it. Hence "else", never "plus". Area is kept on the record for the
// popup's own column; no card on this funnel is measured in it.
// AREA, AND HOW MUCH TO TRUST IT.
//
// The handoff is explicit that only the Post_* fields are ACTUAL production area and that
// everything else is an estimate. Counted live across 7,629 orders: post 88, revision 191, design
// 2,018, order-level Sqaure_Feet 706, nothing at all 5,227. This board used to print
// "Sqaure_Feet else Cabinet_Area_Sqft" under a column headed "Area (sq ft)" — 2,344 orders, not
// one of them an actual. The number is kept, because an estimate is better than a blank, but its
// tier travels with it so the popup can say which it is.
const AREA_TIERS = [
  ['actual', (deal) => num(deal.Post_Cabinet_Area_Sqft) + num(deal.Post_Backsplash_Area_Sqft) + num(deal.Post_Countertop_Area_Sqft)],
  ['revision', (deal) => num(deal.Revision_Cabinet_Area_Sqft) + num(deal.Revision_Backsplash_Area_Sqft) + num(deal.Revision_Countertop_Area_Sqft)],
  ['design', (deal) => num(deal.Cabinet_Area_Sqft) + num(deal.Backsplash_Area_Sqft) + num(deal.Countertop_Area_Sqft)],
  ['order', (deal) => num(deal.Sqaure_Feet)]
];

function areaWithTier(deal) {
  for (const [tier, measure] of AREA_TIERS) {
    const value = measure(deal);
    if (value > 0) return { area: value, tier };
  }
  return { area: 0, tier: 'missing' };
}

const areaOf = (deal) => areaWithTier(deal).area;

// Deals.Amount is empty on all 7,591 records in the module, which is why this board used to carry no
// rupee figure at all. "Value" is the one that is filled — on 35% of orders overall and on 125 of the
// 139 booked in the last quarter — and it is in LAKHS, the same scale the Sales funnel reads
// Total_Opportunity_Value on (sampled: 25, 8.86, 16.83, 15 against orders of that size). It fills as
// the order is booked, which is exactly why Order booked is the only card on this chain given money.
export const LAKH = 1e5;
const amountOf = (deal) => num(deal.Value) * LAKH;

// Whole and part days between two Zoho stamps, or null when either is missing. A NEGATIVE gap is
// also null: one order a month carries a Send For Approval Date earlier than its own Created Time,
// which is a keying error, not a design turned round before it was asked for, and averaging it in
// would drag the figure down with a number that cannot happen.
function daysBetween(from, to) {
  if (!from || !to) return null;
  const gap = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return Number.isFinite(gap) && gap >= 0 ? gap : null;
}

// ---------------------------------------------------------------------------
// Which orders this board is about
// ---------------------------------------------------------------------------
// A "new request from sales" is read off the design fields, never off Stage alone. The CRM was loaded
// with legacy orders that sit at Final Handover carrying no designer, no design date and no design
// presentation — 1,332 of the 1,991 most recent orders. A stage-based test would sweep all of them onto
// a design board they never passed through, and would make the funnel widen at the bottom.
//
// Design_Required_on and Expected_Design_Date are in the test on purpose: they are what sales fills
// when it hands the order over, so an order still waiting for a designer counts as a request. Without
// them the "Designer assignment pending" card could never be anything but empty.
const isDesignRequest = (deal) =>
  set(deal.Designer_Name) || set(deal.Design_Required_on) || set(deal.Expected_Design_Date)
  || set(deal.Send_For_Approval_Date) || set(deal.Design_Presentation)
  || set(deal.Design_Approved_Date) || set(deal.Number_of_Design_Revisions)
  || rankOf(deal.Stage) === 1;

// Staff test orders. The Sales funnel's isRealRecord reads Full_Name, which Deals do not have — theirs
// is Deal_Name — so it passes every deal through. 66 test orders are in the module; this is the field
// that actually filters them.
// SUNROOOF IS NOT PART OF THIS DASHBOARD. It is a separate product line the team does not review
// here, so its orders are dropped at the source rather than filtered card by card. The CRM spells it
// Sunrooof, Sunroof, SUNROOOF and occasionally "Sun Roof", so the pattern is relaxed about the
// spacing and the number of o's. It is tested against BOTH the order name and the product type:
// 550 orders carry it in the name and 560 in the type, and those two sets are not the same.
//
// This removes 562 of 7,719 orders, about 7%. Every board that reads orders comes through the filter
// below, which is why this only has to be said once.
const SUNROOOF = /sun\s*ro+f/i;

export const isRealDeal = (deal) => !/\btest\b/i.test(deal?.Deal_Name ?? '')
  && !SUNROOOF.test(`${deal?.Deal_Name ?? ''} ${deal?.Product_Type ?? ''}`);

// ---------------------------------------------------------------------------
// The stage ledger
// ---------------------------------------------------------------------------
// Every card below used to read Deals.Stage, a SNAPSHOT of where the order stands now. That loses
// any order which passed through a stage and moved on: an order that was sent for approval and is
// now booked stopped counting as "sent for approval". DealHistory fixes it — it holds one dated row
// per stage the order has ever been in — so each flag below becomes "did this order EVER reach it".
//
// The history is applied as a UNION with the old field-and-stage test, never as a replacement. A
// card can therefore only go UP when the ledger sees something the snapshot missed, and an order
// whose history has not been loaded still counts exactly as it did before. That is the safe
// direction: this board must never report fewer orders than it can prove.
const stagesFor = (key) => new Set(
  (DEAL_PRE_DESIGN_STEPS.find((step) => step.key === key)?.stages ?? [])
    .map((stage) => stage.trim().toLowerCase()));

const SENT_STAGES = stagesFor('sentForApproval');
const REVISION_LEDGER_STAGES = stagesFor('revisionRequested');
const BOOKED_STAGES = stagesFor('orderBooked');
const HANDOVER_STAGES = stagesFor('handover');
const ASSIGNED_STAGES = stagesFor('designerAssigned');
const QUERY_STAGES = stagesFor('queryToSm');
const PENDING_STAGES = stagesFor('assignmentPending');
const UNDER_DESIGN_STAGES = stagesFor('underDesign');

/**
 * One order's history, reduced to what the cards ask of it.
 * `null` when the ledger holds nothing for this order, which puts every flag back on the old rule.
 */
function pastOf(entry) {
  if (!entry?.entries?.length) return null;
  const reached = new Set();
  const enteredAt = new Map();
  let leftRevision = false;
  for (const step of entry.entries) {
    reached.add(step.stageKey);
    if (!enteredAt.has(step.stageKey)) enteredAt.set(step.stageKey, step.enteredAt);
    // A revision the order has actually come out of, rather than one it is still sitting in.
    if (REVISION_LEDGER_STAGES.has(step.stageKey) && step.movedTo) leftRevision = true;
  }
  const current = entry.entries.at(-1);
  return {
    reached,
    enteredAt,
    leftRevision,
    firstAt: entry.entries[0]?.enteredAt ?? null,
    currentKey: current && !current.movedTo ? current.stageKey : null,
    // When the order arrived at the stage it is on now. This is what "time in status" measures, and
    // it exists only on the ledger — the Deal itself records no per-stage entry date.
    currentSince: current && !current.movedTo ? (current.enteredAt ?? null) : null,
    any: (stages) => [...stages].some((stage) => reached.has(stage))
  };
}

/** The earliest date the order entered any stage in `stages`, or null. */
function firstEntryTo(past, stages) {
  if (!past) return null;
  const dates = [...stages].map((stage) => past.enteredAt.get(stage)).filter(Boolean).sort();
  return dates[0] ?? null;
}

// Whole days from a stamp to NOW. For an elapsed figure that is still running.
const daysSoFar = (from) => spanDays(from, Date.now());

// Whole days BETWEEN two stamps. Null when either end is missing - which is the point: an order that
// has not been booked has no time-to-close, and defaulting the missing end to `now` silently turned
// that into "days since created" on all 318 orders when only 1 was actually booked.
const daysBetweenStamps = (from, to) => (from && to ? spanDays(from, Date.parse(to)) : null);

function spanDays(from, end) {
  if (!from) return null;
  const days = (end - Date.parse(from)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 ? Math.round(days * 10) / 10 : null;
}

// WHOLE MINUTES since a stamp. Minutes rather than hours because the tables render time in status as
// "1 day + 6h 49m", and an hours-only figure cannot produce the minutes - it was showing "1d 6h" and
// rounding away up to 59 minutes of a number people use to decide what to chase.
function minutesSince(stamp) {
  if (!stamp) return null;
  const minutes = (Date.now() - Date.parse(stamp)) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : null;
}

// Days from the order's first appearance to the first time it was sent for approval, off the ledger.
// Replaces Created_Time -> Send_For_Approval_Date, which is only filled on a minority of orders.
function ledgerDesignDays(past) {
  if (!past?.firstAt) return null;
  const sent = [...SENT_STAGES].map((stage) => past.enteredAt.get(stage)).filter(Boolean).sort()[0];
  if (!sent) return null;
  const days = (Date.parse(sent) - Date.parse(past.firstAt)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 ? days : null;
}

// One order, flattened so the frontend never sees a Zoho field name.
function toRecord(deal, history, managers) {
  const rank = rankOf(deal.Stage);
  const city = canonicalCityName(deal.city);
  // Canonicalised first: 20 stages in this org store a value different from their label, and
  // Deals.Stage does return the stored form for some of them ("PDI" for "PDI Done").
  const stage = canonicalStage(deal.Stage);
  const stageKey = stage.toLowerCase();
  // What this order has ever been through. Null when the ledger has nothing for it.
  const past = pastOf(history?.get(String(deal.id ?? '')));
  const ever = (stages) => Boolean(past?.any(stages));
  const area = areaOf(deal);
  const amount = amountOf(deal);
  const revisions = num(deal.Number_of_Design_Revisions);
  // Handover out of design. Handover_Date is the customer handover at the very end of the pipeline
  // (1,814 of the 1,851 that carry it sit at Final Handover), so it proves the order left design too.
  // STRICT MEMBERSHIP: a card holds the orders sitting at ITS stage right now, and nothing else.
  // `at()` is the only test the stage cards use.
  //
  // The previous rule was "ever reached this stage", off the ledger, which measured flow correctly
  // but meant a card named after a stage was full of orders that had moved past it — "Designer
  // assigned" opened 297 rows of which 231 read Sent for Approval. The customer asked for the card
  // to match its own name, so reaching a stage no longer counts; being on it does.
  const at = (stages) => stages.has(stageKey);
  const handedOver = at(HANDOVER_STAGES);
  const sentForApproval = at(SENT_STAGES);
  // A revision is being worked right now. The count and reason boxes are NOT part of this any more:
  // they persist forever once written, so an order revised in June and long since booked would have
  // stayed on the card. They still drive "Revision done" below, which is what they are evidence of.
  const revisionAsked = at(REVISION_LEDGER_STAGES);
  return {
    id: String(deal.id ?? ''),
    name: deal.Deal_Name ?? 'Unnamed order',
    cityRaw: clean(deal.city),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    // One person, one name — the CRM holds Atif / Atif Hussain, Rishab / Rishabh / Rishabh
    // Butar and so on as separate picklist values.
    designer: canonicalDesigner(deal.Designer_Name),
    owner: deal.Owner?.name ?? '',
    // The SM, from the qualified lead this order came from. NOT the order owner — the two name
    // different people on 53% of orders. Blank where the order has no linked lead.
    sm: managerOf(deal, managers).name,
    smSource: managerOf(deal, managers).source,
    stage,
    rank,
    // `value` stays the floor area, which is what the popup's "Area (sq ft)" column reads. `amount` is
    // the rupee figure, and only the Order booked card totals it.
    value: area,
    hasArea: area > 0,
    // 'actual' only where the Post_* production fields are filled; everything else is an estimate
    // and the popup labels it as one.
    areaTier: areaWithTier(deal).tier,
    amount,
    amountLabel: amount > 0 ? inr(amount) : '',
    revisions,
    hasRevisions: set(deal.Number_of_Design_Revisions) && revisions > 0,
    // The two figures the Pre-efficiency board averages. Both are null where Zoho has nothing to
    // average, never 0 — a blank revision box means "not recorded", and counting it as no revisions
    // would halve the average across the 86% of orders that simply never had the box filled.
    // The ledger's own measurement first, because it is recorded on every order that reached the
    // stage; the date-field subtraction is the fallback for orders with no history loaded.
    designDays: ledgerDesignDays(past) ?? daysBetween(deal.Created_Time, deal.Send_For_Approval_Date),
    revisionsRecorded: set(deal.Number_of_Design_Revisions) ? revisions : null,
    query: clean(deal.Requirements_For_SM),
    designSentOn: deal.Send_For_Approval_Date ?? null,
    designPresentation: clean(deal.Design_Presentation),
    designRequiredOn: deal.Design_Required_on ?? null,
    expectedDesignDate: deal.Expected_Design_Date ?? null,
    designApprovedOn: deal.Design_Approved_Date ?? null,
    handoverOn: deal.Handover_Date ?? null,
    createdAt: deal.Created_Time ?? null,
    // TIME IN STATUS, in whole hours, from the dated stage ledger. Null rather than 0 where the
    // ledger holds no history for the order, so "not recorded" never reads as "arrived just now".
    minutesInStatus: minutesSince(past?.currentSince),
    statusSince: past?.currentSince ?? null,

    // ---- The per-card columns ------------------------------------------------------------------
    // Product_Type, which the tables show on every card and the Installation board's split reads.
    product: clean(deal.Product_Type),
    // The revision detail. Zoho keeps the SM's reason and the design team's reason in two separate
    // fields, and until now neither was shown anywhere on this board.
    revisionType: clean(deal.Revision_Type),
    reasonSm: clean(deal.Reason_for_Design_Revision1),
    reasonDesign: clean(deal.Reason_for_Design_Revision2),
    // Why the order ran late. There is no such field in the CRM, so this is empty on every order
    // until one is created - the column says so rather than showing a blank with no explanation.
    delayReason: clean(deal.Delay_Reason),

    // Stage-entry dates. All of them come off the ledger, because the Deal itself records no date
    // for entering a stage - only Created_Time, Send_For_Approval_Date and a few approvals.
    assignedOn: firstEntryTo(past, ASSIGNED_STAGES),
    raisedOn: firstEntryTo(past, QUERY_STAGES),
    revisionAskedOn: firstEntryTo(past, REVISION_LEDGER_STAGES),
    bookedOn: firstEntryTo(past, BOOKED_STAGES),

    // Elapsed figures the cards quote. Each is null where its inputs are missing, never 0.
    daysWaiting: daysSoFar(past?.currentSince ?? deal.Created_Time),
    daysLate: daysSoFar(deal.Expected_Design_Date),
    timeToClose: daysBetweenStamps(deal.Created_Time, firstEntryTo(past, BOOKED_STAGES)),
    turnaroundDays: daysBetweenStamps(firstEntryTo(past, REVISION_LEDGER_STAGES), deal.Send_For_Approval_Date),
    // The card tests. Every one of them is now "is the order ON this stage", so a card can only ever
    // contain the stage it is named after.
    request: isDesignRequest(deal),
    // THE ASSIGNMENT PAIR, and the one place this board steps outside strict stage membership.
    //
    // As a stage, "waiting for a designer" is Form Filled — and that is empty, because 288 of the
    // 304 requests passed through it and none stayed; orders leave it the same day. But 16 orders
    // genuinely have no Designer_Name on them, and 13 of those are sitting at a stage called
    // "Designer Assigned" with nobody actually named. That is the number worth showing, so pending
    // counts the field as well as the stage.
    //
    // The two must stay exclusive or those 13 would appear on both cards, so "assigned" now needs a
    // real designer as well as the stage. It reads 33 rather than 46 for that reason, and the 13 it
    // gives up are a CRM gap, not lost work.
    assignmentPending: at(PENDING_STAGES) || !set(deal.Designer_Name),
    designerAssigned: at(ASSIGNED_STAGES) && set(deal.Designer_Name),
    underDesign: at(UNDER_DESIGN_STAGES),
    queryToSm: at(QUERY_STAGES),
    sentForApproval,
    revisionAsked,
    // The one card with no stage of its own — Zoho has no "revision done" value. It is an order that
    // CARRIES a revision (the count, type or either reason box, which are written once and kept) and
    // is not sitting on a revision stage now. Derived, and the card says so.
    revisionDone: (revisions > 0 || set(deal.Revision_Type)
        || set(deal.Reason_for_Design_Revision1) || set(deal.Reason_for_Design_Revision2))
      && !at(REVISION_LEDGER_STAGES),
    booked: at(BOOKED_STAGES),
    handedOver
  };
}

// ---------------------------------------------------------------------------
// Cards — the house shape: { key, label, count, ids, byCity, previous?, note? }
// Money (`value` / `valueLabel`) is added only where `money` is asked for, so a card that is a pure
// count never carries a rupee figure a tooltip could print as "₹0".
// `byCity` is on every card: three rows, DEL / HYD / OTHER, always all three even when one is empty.
// The rows partition the card, so they sum back to its count.
// ---------------------------------------------------------------------------
function card(records, extra = {}, previous = null, money = false) {
  const { note, ...rest } = extra;
  const sum = (list) => list.reduce((total, record) => total + record.amount, 0);
  const trend = previous
    ? { previous: previous.length, ...(money ? { previousValue: sum(previous) } : {}) }
    : {};
  return {
    ...rest,
    count: records.length,
    ids: records.map((record) => record.id),
    ...(money ? { value: sum(records), valueLabel: inr(sum(records)) } : {}),
    ...trend,
    ...(note ? { note } : {})
  };
}

const sliceOf = (records, test) => (records ? records.filter(test) : null);

// A card with its Delhi / Hyderabad / Others rows under it. The rows partition the card, so the three
// counts sum back to its own — and the three amounts to its money, on the one card that carries any.
function cityCard(records, extra = {}, previous = null, money = false) {
  const inBucket = (key) => (record) => record.cityKey === key;
  return {
    ...card(records, extra, previous, money),
    byCity: cityRows(records, (mine, row) =>
      card(mine, row, sliceOf(previous, inBucket(row.key)), money))
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
// Pre-efficiency — the two averages under the funnel
// ---------------------------------------------------------------------------
// A different shape from the cards above, and deliberately so: those count orders, these AVERAGE a
// number over the orders that carry one. So the card reports two counts, not one — `count` is how
// many orders the average is actually made of and `of` is how many were in the period — because an
// average of 2.5 days means something different over 222 orders than over 3.
//
// A record with nothing to average contributes NOTHING; it is not averaged in as a zero. That is the
// whole reason `designDays` and `revisionsRecorded` are null rather than 0 on the record.
function metricCard(records, previous, { key, label, unit, of: valueOf, figure, note = null }) {
  const build = (list, extra = {}) => {
    const measured = list.filter((record) => valueOf(record) != null);
    const value = measured.length
      ? measured.reduce((total, record) => total + valueOf(record), 0) / measured.length
      : null;
    return {
      ...extra,
      value,
      // Pre-rounded here so the card, its city cells, its tooltip and its "vs last period" line can
      // never disagree about the same number by rounding it twice in two places.
      figure: value == null ? null : figure(value),
      valueLabel: value == null ? null : `${figure(value)} ${unit}`,
      count: measured.length,
      ids: measured.map((record) => record.id)
    };
  };
  const inBucket = (bucket) => (record) => record.cityKey === bucket;
  const now = build(records);
  const then = previous ? build(previous) : null;
  return {
    key,
    label,
    unit,
    ...now,
    of: records.length,
    ...(then && then.value != null
      ? { previous: then.value, previousFigure: then.figure, previousCount: then.count }
      : {}),
    ...(note ? { note } : {}),
    byCity: cityRows(records, (mine, row) => ({
      ...build(mine, row),
      of: mine.length,
      ...(previous ? { previous: build(previous.filter(inBucket(row.key))).value } : {})
    }))
  };
}

const oneDecimal = (value) => value.toFixed(1);

// ---------------------------------------------------------------------------
// Revisions requested vs done — the third Pre-efficiency card
// ---------------------------------------------------------------------------
// Not an average like the two beside it, and not a count like the funnel cards above: a pair of
// counts and the share between them. It answers the one question the funnel's two revision cards
// put side by side but never actually join up — of the revisions asked for, how many have been
// actioned, and how many are still open.
//
// The denominator is REQUESTED, not the cohort, because that is the only honest one here: a revision
// cannot be done unless it was asked for, so `done` is a strict subset of `asked` and the share is a
// real proportion. Against the whole cohort it would read as "14% of orders", which is a different
// fact wearing the same percentage sign.
function comparisonCard(asked, done, askedBefore, doneBefore, { key, label }) {
  const build = (requested, finished, extra = {}) => {
    const open = Math.max(requested.length - finished.length, 0);
    const value = requested.length ? finished.length / requested.length : null;
    return {
      ...extra,
      requested: requested.length,
      done: finished.length,
      open,
      value,
      figure: value == null ? null : `${Math.round(value * 100)}%`,
      // `count` and `ids` keep the house card shape, so a click opens the orders the card is about:
      // the ones a revision was asked for on.
      count: requested.length,
      ids: requested.map((record) => record.id)
    };
  };
  const inBucket = (bucket) => (record) => record.cityKey === bucket;
  const then = askedBefore ? build(askedBefore, doneBefore ?? []) : null;
  return {
    key,
    label,
    unit: 'actioned',
    ...build(asked, done),
    ...(then && then.value != null ? { previous: then.value, previousFigure: then.figure } : {}),
    byCity: cityRows(asked, (mine, row) => build(mine, done.filter(inBucket(row.key)), row))
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
  'Deal_Name', 'Owner', 'Opportunity_Name', 'Stage', 'city', 'Created_Time',
  'Sqaure_Feet', 'Cabinet_Area_Sqft', 'Backsplash_Area_Sqft', 'Countertop_Area_Sqft',
  'Post_Cabinet_Area_Sqft', 'Post_Backsplash_Area_Sqft', 'Post_Countertop_Area_Sqft',
  'Revision_Cabinet_Area_Sqft', 'Revision_Backsplash_Area_Sqft', 'Revision_Countertop_Area_Sqft',
  'Value',
  'Designer_Name', 'Design_Required_on', 'Expected_Design_Date', 'Design_Approved_Date',
  'Design_Presentation', 'Send_For_Approval_Date', 'Requirements_For_SM',
  'Number_of_Design_Revisions', 'Revision_Type',
  'Reason_for_Design_Revision1', 'Reason_for_Design_Revision2', 'Handover_Date',
  'Product_Type',
  // Delay_Reason DOES NOT EXIST IN ZOHO YET. Asked for so the Order booked column is plumbed and
  // fills itself the day the field is created; Zoho answers an unknown field name by leaving it out
  // of the row rather than failing the read (probed against the live org).
  'Delay_Reason'
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
 * @param history the DealHistory index from indexByRecord(); every card falls back to the old
 *                field-and-stage rule for an order the ledger has nothing for, so a failed or
 *                partial history read degrades the numbers rather than breaking the board
 * @param notice  set when Zoho could not be read: the same shape comes back, with zeros
 */

// ---------------------------------------------------------------------------------------------
// "Sent for approval" — the one card on this board that is dated by a STAGE, not by creation
// ---------------------------------------------------------------------------------------------
// Every other card here asks "which orders CREATED in this period are sitting on my stage now".
// This one asks the question the business actually wants, and the one the validated MIS definition
// uses: "how many designs went out to a client in this month".
//
// The difference is not cosmetic:
//
//   PERIOD   the month an order FIRST entered "Sent for Approval", read from the stage history.
//            Not Created_Time - an order created in June and sent in September belongs to
//            September, and under the old rule it was not counted at all because the board only
//            fetched orders created inside the window.
//   BASE     Designer_Name is set. A design cannot be sent by nobody.
//   STAGE    "Sent for Approval" alone. The old card also counted "Sent to Client (First Design)",
//            "Price Discussion" and "Design Dis-Approved" - the last two are not a design going
//            out, they are what happens afterwards.
//   SOURCE   the ledger's EARLIEST entry, never Send_For_Approval_Date. Measured across the module:
//            the two disagree on the MONTH for 430 of 2,392 orders (18%), and every disagreement
//            has the ledger earlier - because the field is overwritten each time a design is
//            re-sent, so it holds the LATEST send while the card needs the first.
//
// WHAT THIS COSTS. The card no longer partitions the requests card, so it carries no share: its
// orders are dated by a different clock from the cards either side of it and a percentage between
// the two would be meaningless. That is a real loss and it is why no other card has been moved to
// this basis without being asked for.
//
// If the whole module or the full history cannot be read, the card falls back to the old
// creation-dated behaviour rather than showing nothing, and says so on its face.

const SENT_STAGE = 'sent for approval';

function sentForApprovalCard({ tf, allDeals, fullHistory, managers, selected, fallback }) {
  const label = 'Sent for approval';

  // Without the whole module or a full history there is no way to date this card honestly.
  if (!allDeals?.length || !fullHistory) {
    return {
      card: cityCard(fallback.records, {
        key: 'sentForApproval',
        label,
        share: fallback.of(fallback.records),
        note: 'Dated by creation, not by when the design went out: the full order history could not '
          + 'be read for this response.'
      }, fallback.previous),
      dated: false
    };
  }

  const firstSentAt = (record) => {
    const entry = fullHistory.get(String(record.id));
    if (!entry?.entries?.length) return null;
    return entry.entries
      .filter((step) => clean(canonicalStage(step.stage)).toLowerCase() === SENT_STAGE)
      .map((step) => step.enteredAt)
      .filter(Boolean)
      .sort()[0] ?? null;
  };

  const universe = allDeals.filter(isRealDeal).map((deal) => toRecord(deal, fullHistory, managers));
  applyCityMerge([universe]);

  const withDesigner = universe.filter((record) => record.designer);
  const dated = withDesigner
    .map((record) => ({ ...record, sentOn: firstSentAt(record) }))
    .filter((record) => record.sentOn);

  const inPeriod = dated.filter((record) => tf.matches(record.sentOn) && selected.matches(record));
  const inPrevious = tf.previousStart
    ? dated.filter((record) => tf.previousMatches(record.sentOn) && selected.matches(record))
    : null;

  // How many the old rule would have missed: orders sent this period but created before the window.
  const missedByCreation = inPeriod.filter((record) => !tf.matches(record.createdAt)).length;

  return {
    records: inPeriod,
    card: cityCard(inPeriod, {
      key: 'sentForApproval',
      label,
      // NO SHARE, deliberately: this card is dated by when the design went out and the cards either
      // side of it by when the order was created, so a percentage between them compares two clocks.
      note: missedByCreation
        ? `Counted by the month the design first went out, from the stage history. `
          + `${missedByCreation.toLocaleString('en-IN')} of these were created before this period and `
          + 'were missed entirely by the old creation-dated card.'
        : 'Counted by the month the design first went out, from the stage history, not by when the order was created.'
    }, inPrevious),
    dated: true,
    missedByCreation
  };
}

// ---------------------------------------------------------------------------
// DATED STAGE CARDS — the fix for the wrong date axis
// ---------------------------------------------------------------------------
// Every card on this chain used to be cut from the orders CREATED in the period, then tested against
// a snapshot of Deals.Stage. That attributes an event to the month the order was created rather than
// the month the event happened, and it loses any order whose work happened later than its creation.
//
// MEASURED against the stage ledger, September 2026:
//
//   card                 ledger says entered   the creation-dated card showed
//   Revision requested                  308                               0
//   Query to SM                          82                              11
//   Under design                         29                               0
//
// Those are not rounding differences - the old rule was answering a different question. So each card
// now counts the orders that ENTERED one of its own stages inside the period, read from DealHistory,
// and carries the live queue beside it as `sitting`. The card's NAME and KEY are unchanged; only what
// feeds it changes.
//
// `entered` is the headline (`count`), because a flow figure is comparable across boards and responds
// to the period buttons. `sitting` answers "and how many are there right now", which is the question a
// queue board needs and the one the old snapshot rule was accidentally half-answering.
//
// Without the whole module or a full history there is nothing to date against, so the card falls back
// to the old creation-dated set and says so on its face rather than showing a confident zero.
const stagesForStep = (key) => {
  const step = DEAL_PRE_DESIGN_STEPS.find((candidate) => candidate.key === key);
  return (step?.stages ?? []).map((stage) => clean(stage).toLowerCase());
};

/** Every date this order entered one of `stages`, oldest first. */
function entriesInto(fullHistory, id, stages) {
  const entry = fullHistory?.get(String(id));
  if (!entry?.entries?.length || !stages.length) return [];
  const wanted = new Set(stages);
  return entry.entries
    .filter((step) => wanted.has(clean(canonicalStage(step.stage)).toLowerCase()))
    .map((step) => step.enteredAt)
    .filter(Boolean)
    .sort();
}

function datedStageCard({ key, label, tf, universe, selected, fullHistory, fallback, extra = {}, money = false, remember = null }) {
  const stages = stagesForStep(key);
  if (!universe?.length || !fullHistory || !stages.length) {
    return cityCard(fallback.records, {
      key,
      label,
      share: fallback.share ?? null,
      ...extra,
      dated: false,
      note: [extra.note, 'Dated by creation, not by when the order reached this stage: the full order '
        + 'history could not be read for this response.'].filter(Boolean).join(' ')
    }, fallback.previous, money);
  }

  // An order counts if it entered the stage AT ANY POINT in the period, and it counts ONCE however
  // many times it entered. Those are two separate decisions and both matter:
  //
  //   counting every entry       inflates the card - September has 308 entries into a revision stage
  //                              but only 206 orders, because an order can be sent back three times
  //   counting the FIRST entry   deflates it to 142, and silently drops exactly the orders that are
  //   only                       the problem: a repeat offender first revised in July is invisible in
  //                              September, which is the month someone needs to act on it
  //
  // So: distinct orders with at least one entry inside the window. 206 for September, which is the
  // number the question "how many orders were sent back for revision this month" actually asks for.
  const dated = universe
    .map((record) => ({ record, at: entriesInto(fullHistory, record.id, stages) }))
    .filter((row) => row.at.length && selected.matches(row.record));

  const inPeriod = dated.filter((row) => row.at.some((at) => tf.matches(at))).map((row) => row.record);
  const inPrevious = tf.previousStart
    ? dated.filter((row) => row.at.some((at) => tf.previousMatches(at))).map((row) => row.record)
    : null;
  // The live queue: where orders stand right now, whatever period is selected.
  const stageSet = new Set(stages);
  const sitting = universe.filter((record) =>
    selected.matches(record) && stageSet.has(clean(record.stage).toLowerCase())).length;
  // What the old creation-dated rule would have thrown away.
  const missedByCreation = inPeriod.filter((record) => !tf.matches(record.createdAt)).length;

  // EVERY ID A CARD QUOTES MUST RESOLVE AGAINST `records`, which is what the popup reads. These cards
  // are cut from the whole module, not from the creation-scoped cohort `records` used to carry - so an
  // order worked on this period but created earlier counted on the card and then vanished from its own
  // popup. Measured before the fix: "Revision requested" showed 180 and opened 51.
  remember?.(inPeriod);
  return {
    ...cityCard(inPeriod, { key, label, ...extra, dated: true }, inPrevious, money),
    sitting,
    missedByCreation
  };
}

export function buildPreDesignBoard({ tf, deals = [], city, history = null, managers = null, notice = null, allDeals = null, fullHistory = null }) {
  const all = (deals ?? []).filter(isRealDeal).map((deal) => toRecord(deal, history, managers));
  const created = all.filter((record) => record.createdAt && tf.matches(record.createdAt));
  const createdBefore = all.filter((record) => record.createdAt && tf.previousMatches(record.createdAt));
  applyCityMerge([created, createdBefore]);

  const selected = resolveCity(city, created);
  const only = (list) => list.filter(selected.matches);
  const arrived = only(created);
  const arrivedBefore = only(createdBefore);
  // The cohort every card cuts: the orders sales sent to design. The cards never re-filter it, so each
  // one is a subset of this.
  // "None" is Zoho's empty stage, not a step in the process, so an order parked on it is not a design
  // request and is kept off the board entirely rather than swelling the head of the chain.
  const isStaged = (record) => clean(record.stage).toLowerCase() !== EMPTY_STAGE;
  const cohort = arrived.filter((record) => record.request && isStaged(record));
  const before = arrivedBefore.filter((record) => record.request && isStaged(record));
  const cohortIds = new Set(cohort.map((record) => record.id));
  const cut = (test) => [cohort.filter(test), before.filter(test)];

  const [assigned, assignedBefore] = cut((record) => record.designerAssigned);
  const [pending, pendingBefore] = cut((record) => record.assignmentPending);
  const [query, queryBefore] = cut((record) => record.queryToSm);
  const [design, designBefore] = cut((record) => record.underDesign);
  const [approval, approvalBefore] = cut((record) => record.sentForApproval);
  const [asked, askedBefore] = cut((record) => record.revisionAsked);
  const [done, doneBefore] = cut((record) => record.revisionDone);
  const [booked, bookedBefore] = cut((record) => record.booked);
  const [handover, handoverBefore] = cut((record) => record.handedOver);

  const comparisonLabel = previousLabelOf(tf.kind, tf.previousLabel ?? null);
  // Every share on the chain is of the same denominator: the requests card. Stated once here so no
  // card can quietly pick a different one.
  const of = (list) => share(list.length, cohort.length);

  // Orders that arrived already past design — imported straight into post-design or Final Handover
  // with no design field on them. They are not work design failed to pick up, so they are named rather
  // than left inside the gap between "created" and "requests". Nil in a normal month; 1,300-odd in the
  // quarter the CRM was loaded.
  const imported = arrived.filter((record) => !record.request && record.rank >= 4).length;
  // ORDERS WITH NO STAGE SET. "None" is Zoho's empty stage and the blueprint's entry state at once:
  // 2,575 orders across the module sit on it, a third of everything. They are still kept off every
  // card - an order nobody has set a stage on has not reached a step - but the count is published
  // here and in `coverage` so the gap is visible instead of silently swallowing a third of the module.
  const unstaged = arrived.filter((record) => !isStaged(record)).length;
  const unstagedModule = (allDeals ?? []).filter(isRealDeal)
    .filter((deal) => clean(canonicalStage(deal.Stage)).toLowerCase() === EMPTY_STAGE).length;
  const overLimit = asked.filter((record) => record.revisions > REVISION_LIMIT).length;
  const withAmount = booked.filter((record) => record.amount > 0).length;
  // THE UNIVERSE the dated cards are cut from: every real order in the module, not just the ones
  // created in this period. That is the whole point - an order created in July whose designer was
  // assigned in September belongs to September's "Designer assigned", and the creation-scoped cohort
  // could never see it.
  const universe = (allDeals ?? []).filter(isRealDeal).map((deal) => toRecord(deal, fullHistory, managers));
  applyCityMerge([universe]);
  // Everything the dated cards point at, so `records` below can resolve every id they quote.
  const datedRecords = new Map();
  const rememberDated = (records) => { for (const record of records) datedRecords.set(record.id, record); };
  const datedCard = (key, label, fallbackRecords, fallbackPrevious, extra = {}, money = false) => datedStageCard({
    key, label, tf, universe, selected, fullHistory, money, extra, remember: rememberDated,
    fallback: { records: fallbackRecords, previous: fallbackPrevious, share: of(fallbackRecords) }
  });

  // The dated "Sent for approval" card, built before the rest so its note can be quoted below.
  const sentApproval = sentForApprovalCard({ tf, allDeals, fullHistory, managers, selected, fallback: { records: approval, previous: approvalBefore, of } });
  rememberDated(sentApproval.records ?? []);

  // How much of the cohort each Pre-efficiency average is actually made of — said on the card, so an
  // average over three orders can never be read as an average over the month.
  const measuredDays = cohort.filter((record) => record.designDays != null).length;
  const measuredRevisions = cohort.filter((record) => record.revisionsRecorded != null).length;

  return {
    meta: {
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      city: selected.key,
      comparison: { start: tf.previousStart ?? null, end: tf.previousEnd ?? null, label: comparisonLabel, available: Boolean(tf.previousStart) },
      // What the board could and could not measure, so the caveats are data rather than prose in the
      // component. Order booked and Handover are cohort positions: an order created this week has not
      // had time to reach them, so a short period reads near zero by construction, not by fault.
      coverage: {
        arrived: arrived.length,
        orders: cohort.length,
        importedPastDesign: imported,
        unstagedThisPeriod: unstaged,
        unstagedModule,
        unstagedNote: 'Orders whose Stage is "None" are on no card. The blueprint treats None as its entry '
          + 'state, so these have entered the process but have not reached a step; the count is published rather '
          + 'than the orders being counted somewhere they do not belong.',
        withRevisionCount: cohort.filter((record) => record.hasRevisions).length,
        withDesignTime: measuredDays,
        bookedWithValue: withAmount,
        moneyField: 'Deals.Value, in lakhs — the only rupee field filled in the module; Amount is empty on every record',
        cohortRule: 'Orders created in the period carrying a design field (designer, design date, design presentation, revision count) or sitting at a design stage',
        stageSource: history
          ? 'DealHistory — each card counts the DISTINCT orders that entered one of its stages inside the '
            + 'period, counted once however many times they entered, plus the live queue beside it'
          : 'Deals.Stage snapshot only — the stage ledger could not be read, so the cards fall back to '
            + 'counting by the month the order was created, which undercounts every one of them',
        // Of the cohort this board is about, not of every order fetched across both windows.
        ordersWithHistory: history ? cohort.filter((record) => history.has(record.id)).length : 0,
        withSalesManager: cohort.filter((record) => record.sm).length,
        smSource: 'Contacts.Sales_Manager on the qualified lead the order came from. The Orders module has no sales-manager field; the order owner is a different person on 53% of orders and is not used for this.',
        cohortNote: 'Legacy orders imported straight into Final Handover carry no design field and are left out',
        // THESE TWO NOTES USED TO CLAIM A PARTITION. They no longer can, and saying so is the point.
        // Every card except "Total new requests from sales" now counts orders that ENTERED its stage
        // during the period, drawn from the whole module - so a card legitimately exceeds the requests
        // card whenever work was done this month on orders created earlier, which is most months. The
        // old pair arithmetic only held because every card was cut from the same creation-scoped list,
        // and that is exactly the behaviour that reported 0 revisions in a month with 206.
        pairNote: 'The cards no longer add back to the requests card. Requests counts orders that ARRIVED '
          + 'this period; every other card counts orders that ENTERED its stage this period, whenever the '
          + 'order was created. A card above the requests figure means work was done on older orders.',
        tailNote: 'Each card carries two figures: how many orders entered that stage in the period, and '
          + 'how many are sitting there right now. The second ignores the period by design.'
      },
      notice
    },
    filters: { cities: cityFilters(created.filter((record) => record.request)) },
    // Every card ships with the formula that produced it, generated from the same journey config the
    // counting used - so "Show Formula" cannot fall out of step with the code the way a hand-written
    // copy would.
    preDesign: attachPreDesignFormulas({
      previousLabel: comparisonLabel,
      // 1 — the head of the chain: how many requests sales sent to design.
      requests: cityCard(cohort, {
        key: 'requests',
        label: 'Total new requests from sales',
        note: imported
          ? `${imported.toLocaleString('en-IN')} more orders created in this period arrived already past design, as imported records, and are not counted here`
          : null
      }, before),
      // 2 and 3 — the first pair, which partitions the requests card.
      designerAssigned: datedCard('designerAssigned', 'Designer assigned', assigned, assignedBefore),
      assignmentPending: datedCard('assignmentPending', 'Designer assignment pending', pending, pendingBefore, {
        note: unstaged
          ? `${unstaged.toLocaleString('en-IN')} further orders have no stage set in Zoho at all and are on no card`
          : null
      }),
      // 4 and 5 — the second pair, which partitions it again.
      underDesign: datedCard('underDesign', 'Under design', design, designBefore),
      queryToSm: datedCard('queryToSm', 'Query to SM', query, queryBefore),
      // 6 to 10 — the single chain the two pairs feed into.
      // SENT FOR APPROVAL IS DATED DIFFERENTLY FROM EVERY OTHER CARD HERE, and deliberately.
      // See sentForApprovalCard() for why, and for what it gives up in exchange.
      sentForApproval: sentApproval.card,
      revisionRequested: datedCard('revisionRequested', 'Revision requested', asked, askedBefore, {
        note: overLimit
          ? `${overLimit.toLocaleString('en-IN')} past the ${REVISION_LIMIT}-revision limit`
          : null
      }),
      // This card reads the same as the one before it whenever no order is parked on a revision stage
      // — which is the truth, not a fault, so it says so rather than leaving two equal figures side by
      // side with no explanation.
      revisionDone: cityCard(done, {
        key: 'revisionDone',
        label: 'Revision done',
        share: of(done),
        note: asked.length
          ? (asked.length > done.length
            ? `${(asked.length - done.length).toLocaleString('en-IN')} still open in a revision stage`
            : 'Every revision asked for in this period has been actioned')
          : null
      }, doneBefore),
      // The one card with money on it.
      orderBooked: datedCard('orderBooked', 'Order booked', booked, bookedBefore, {
        note: booked.length && withAmount < booked.length
          ? `Value recorded on ${withAmount.toLocaleString('en-IN')} of ${booked.length.toLocaleString('en-IN')} booked orders`
          : null
      }, true),
      handover: datedCard('handover', 'Handover to design', handover, handoverBefore, {
        note: 'These are the same orders the Post Design board shows on its "Handover" card: this is '
          + 'the handoff between the two boards, so the two figures must never be added together.'
      })
    }, tf, Boolean(history)),
    // The two averages under the funnel. Same cohort, same city buckets, different arithmetic.
    preEfficiency: {
      previousLabel: comparisonLabel,
      freshDesign: metricCard(cohort, before, {
        key: 'freshDesign',
        label: 'Average time to fresh design',
        unit: 'days',
        of: (record) => record.designDays,
        figure: oneDecimal,
        note: cohort.length
          ? `Averaged over the ${measuredDays.toLocaleString('en-IN')} of ${cohort.length.toLocaleString('en-IN')} requests that carry a Send For Approval Date`
          : null
      }),
      // The comparison card: of the revisions asked for, how many are actioned and how many are open.
      revisionTurnaround: comparisonCard(asked, done, askedBefore, doneBefore, {
        key: 'revisionTurnaround',
        label: 'Revisions requested vs done'
      }),
      revisions: metricCard(cohort, before, {
        key: 'revisions',
        label: 'Average revisions per order',
        unit: 'per order',
        of: (record) => record.revisionsRecorded,
        figure: oneDecimal,
        note: cohort.length
          ? `Averaged over the ${measuredRevisions.toLocaleString('en-IN')} of ${cohort.length.toLocaleString('en-IN')} requests where the revision box is filled; a blank one is unknown, not zero`
          : null
      })
    },
    // The design cohort, which is what every card's `ids` point into. The internal signals the cards
    // were cut on are dropped; the frontend gets the flat order only.
    // The cohort, plus every order a dated card points at that the cohort does not already hold.
    records: [...cohort, ...[...datedRecords.values()].filter((record) => !cohortIds.has(record.id))].map(({
      cityNameKey, rank, hasArea, hasRevisions, request, designerAssigned: _da, queryToSm: _q,
      assignmentPending: _ap, underDesign: _ud,
      sentForApproval: _sa, revisionAsked: _ra, revisionDone: _rd, booked: _bk, handedOver,
      revisionsRecorded: _rr, ...record
    }) => record)
  };
}
