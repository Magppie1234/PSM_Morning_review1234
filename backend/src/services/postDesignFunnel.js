import { canonicalStage } from '../config/crmNames.js';
import {
  CITY_BUCKETS, CITY_KEYS, OTHER_CITY_KEY, canonicalCityName, cityBucketOf,
  cityNameKeyOf, cityNameLabelOf, cityRows, mergeCityNames
} from '../config/salesFunnel.js';
import { inr } from './salesFunnelBoard.js';
import { isRealDeal, LAKH } from './preDesignBoard.js';
import { enteredDuring, sittingAt } from './stageLedger.js';
import { isTerminalStage, postDesignLifeOf, sqftTierOf, START_STAGE, summarise } from './postDesignModel.js';
import { attachPostDesignFormulas } from '../config/cardFormula.js';
import { getAllDeals } from './dealsModule.js';

// The Post Design queue on the Design board: where every order that has left design currently sits.
//
//   Handover → First visit → EP prep → EP approval → EP marking visits → Production prep → PDI
//   → Payment pending → Sent to factory
//
// Most cards carry sub-cards — requested / planned / done, or pending / approved — and those
// PARTITION the card above them: an order sits at exactly one stage, so it lands in exactly one
// sub-card, and the sub-cards add back to the card. The nine cards likewise partition the whole
// queue, so every figure on this board reconciles to one total.
//
// ---------------------------------------------------------------------------
// FLOW AND STOCK — what each card counts, and why there are two figures
// ---------------------------------------------------------------------------
// This board used to be a pure snapshot. Deals.Stage says where an order is NOW and carries no date,
// and the dedicated milestone fields Zoho models for this workflow (Measurement_open/received/done,
// EPT_Marking_*, PDI_Visit_*, Hand_over_*, Production_Drawing_Signoff_*) are EMPTY on all 7,626
// orders in the module. So there was nothing to filter a period on, and the board showed a live
// queue with the period buttons doing nothing.
//
// DealHistory fixes that. It holds one dated row per stage an order has ever been in, so every card
// now carries both:
//
//   FLOW  (the headline)  orders that ENTERED this stage during the selected period
//   STOCK (the second)    orders sitting at it right now, whatever period is selected
//
// The difference is large and it is the whole reason the boards disagreed. Measured for September:
// "Handover to Post Design" had 28 orders ENTER it, while 0 are sitting there and 122 are parked one
// stage later at "Assign Post - Designer". The old board could only ever show the stock figures, so
// real work was invisible — 17 first measurements were completed in September against a stock of 1.
//
// Flow leads because it is what the period buttons control and what compares across boards. Stock
// stays on the card because "what is on our desk right now" is what a standup needs, and for the two
// cards whose title IS a state of being stuck — Payment pending, and anything named "pending" — it
// is the more honest headline of the two.
//
// Each card's sub-cards partition the card on BOTH bases: an order enters one stage at a time, and
// sits at one stage at a time.

// ---------------------------------------------------------------------------
// THE STAGE MAP — every post-design stage, and the card and sub-card it belongs to
// ---------------------------------------------------------------------------
// Keys are lowercased Zoho picklist values, matched exactly. A stage that is not listed here is not
// in post-design (or has already left it), and the order is simply not on this board — nothing is
// guessed by pattern, because a pattern match is what swept 1,910 legacy "Final Handover" imports
// onto the design boards in the first place.
const STAGE_MAP = {
  // 1 · Handover — the order has arrived from design and is being picked up.
  'handover to post design': ['handover', null],
  'assign post - designer': ['handover', null],
  'pd approvals': ['handover', null],

  // 2 · First visit — the site measurement visit.
  'request for site visit': ['firstVisit', 'requested'],
  'revisit req-first measurement': ['firstVisit', 'requested'],
  'align first measurement': ['firstVisit', 'planned'],
  'first measurement': ['firstVisit', 'planned'],
  'first measurement done': ['firstVisit', 'done'],
  'first measurement approved': ['firstVisit', 'done'],
  'design approved after first meaurement': ['firstVisit', 'done'],
  'first measurement / ept /production drawing / mood board 3d / pdi': ['firstVisit', 'done'],

  // 3 · EP prep — drawing up the electrical and plumbing set.
  'preparation of electrical and plumbing drawings': ['epPrep', 'requested'],
  ept: ['epPrep', 'planned'],
  'ep dwg': ['epPrep', 'done'],

  // 4 · EP approval — two states only, as specified: pending, then approved.
  'request for electric plumbing checking': ['epApproval', 'pending'],
  'ep verification': ['epApproval', 'approved'],
  'electric/plumbing checking done': ['epApproval', 'approved'],

  // 5 · EP marking visits — the one milestone whose three Zoho stages map cleanly onto
  // requested / planned / done without any interpretation.
  'request for electric and plumbing marking': ['epMarking', 'requested'],
  'align visit for electrical / plumbering': ['epMarking', 'planned'],
  'electric/plumbing marking aligned': ['epMarking', 'planned'],
  'ep marking': ['epMarking', 'planned'],
  'electric/plumbing marking done': ['epMarking', 'done'],

  // 6 · Production prep — plus the sign-off, which the customer asked for as a fourth sub-card.
  'prep. of sign-off & production drawing': ['productionPrep', 'requested'],
  'production drawing': ['productionPrep', 'planned'],
  'final dwg': ['productionPrep', 'planned'],
  'stone dwg': ['productionPrep', 'planned'],
  'mood board / 3d': ['productionPrep', 'planned'],
  'create mpp': ['productionPrep', 'planned'],
  'create production set': ['productionPrep', 'done'],
  'start production': ['productionPrep', 'done'],
  'material procurement': ['productionPrep', 'done'],
  precourement: ['productionPrep', 'done'],
  'sent for design approval': ['productionPrep', 'signoff'],
  'design approval': ['productionPrep', 'signoff'],
  verification: ['productionPrep', 'signoff'],

  // 7 · PDI.
  'request visit for pdi': ['pdi', 'requested'],
  'prepare pdi': ['pdi', 'requested'],
  'align pdi': ['pdi', 'planned'],
  pdi: ['pdi', 'done'],
  'pdi done': ['pdi', 'done'],
  'pdi verifiction': ['pdi', 'done'],

  // 8 · Payment pending. The detailed rule is still to come from the customer; until then the two
  // states the stages actually distinguish are all this claims.
  'sent for pdi payment approval': ['payment', 'pending'],
  'payment awaited': ['payment', 'pending'],
  'payment approvals': ['payment', 'pending'],
  'approval from accounts': ['payment', 'pending'],
  'pdi payment done': ['payment', 'done'],

  // 9 · Sent to factory — the last rung before the order leaves post-design for dispatch.
  'handover to factory': ['factory', null],
  'send pdi drawings to factory': ['factory', null]
};

// Post-design stages that are real work but are not one of the nine cards: appliances, finishes and
// cladding sit between EP and production and the customer did not ask for them. They are counted so
// the nine cards plus this figure reconcile to the whole queue, rather than quietly going missing.
const OTHER_POST_DESIGN = new Set([
  'request appliances from client', 'appliances details', 'schedule meeting for finishes',
  'wall cladding', 'sample request'
]);

// The chain, in order, with the sub-cards each one shows. `of` is what a sub-card is called on the
// card, which is not always requested / planned / done — EP approval and Payment have two states
// with their own names.
export const POST_CARDS = [
  { key: 'handover', label: 'Handover', subs: [] },
  { key: 'firstVisit', label: 'First visit', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested' },
    { key: 'planned', label: 'Planned' },
    { key: 'done', label: 'Done' }] },
  { key: 'epPrep', label: 'EP prep', subs: [
    { key: 'requested', label: 'Requested' },
    { key: 'planned', label: 'Planned' },
    { key: 'done', label: 'Done' }] },
  { key: 'epApproval', label: 'EP approval', subs: [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' }] },
  { key: 'epMarking', label: 'EP marking visits', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested' },
    { key: 'planned', label: 'Planned' },
    { key: 'done', label: 'Done' }] },
  { key: 'productionPrep', label: 'Production prep', subs: [
    { key: 'requested', label: 'Requested' },
    { key: 'planned', label: 'Planned' },
    { key: 'done', label: 'Done' },
    { key: 'signoff', label: 'Sign-off' }] },
  { key: 'pdi', label: 'PDI', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested' },
    { key: 'planned', label: 'Planned' },
    { key: 'done', label: 'Done' }] },
  { key: 'payment', label: 'Payment pending', subs: [
    { key: 'pending', label: 'Pending' },
    { key: 'done', label: 'Done' }] },
  { key: 'factory', label: 'Sent to factory', subs: [] }
];

const clean = (value) => String(value ?? '').trim();
const set = (value) => Boolean(clean(value)) && clean(value) !== '-None-';
const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

// Canonicalised first: Deals.Stage returns a stored value rather than the label for some stages.
const placeOf = (stage) => STAGE_MAP[canonicalStage(stage).toLowerCase()] ?? null;

// When an order arrived at the stage it is on now, and how long it has been there. This is the
// column a queue board actually needs — "303 sitting at Handover" only means something once you can
// see that some of them have been there 40 days — and it is only available because of the ledger.
function timingOf(entry) {
  const current = entry?.entries?.at(-1);
  if (!current?.enteredAt) return { enteredAt: null, daysHere: null };
  const days = (Date.now() - Date.parse(current.enteredAt)) / 86_400_000;
  return { enteredAt: current.enteredAt, daysHere: Number.isFinite(days) ? Math.max(0, Math.floor(days)) : null };
}

// The stages a card (or one of its sub-cards) owns, read back out of STAGE_MAP so the flow figures
// and the stock figures can never be built from two different stage lists.
const STAGES_BY_CARD = new Map();
const STAGES_BY_SUB = new Map();
for (const [stage, [card, sub]] of Object.entries(STAGE_MAP)) {
  if (!STAGES_BY_CARD.has(card)) STAGES_BY_CARD.set(card, []);
  STAGES_BY_CARD.get(card).push(stage);
  if (sub) {
    const key = `${card}|${sub}`;
    if (!STAGES_BY_SUB.has(key)) STAGES_BY_SUB.set(key, []);
    STAGES_BY_SUB.get(key).push(stage);
  }
}
const stagesOfCard = (card) => STAGES_BY_CARD.get(card) ?? [];
const stagesOfSub = (card, sub) => STAGES_BY_SUB.get(`${card}|${sub}`) ?? [];

/**
 * The card's sub-cards, each holding the orders whose furthest point in this card during the period
 * was that sub. Declared sub order is the ladder, so the last sub an order appears in wins.
 *
 * Falls back to the stock split (one order, one stage) whenever the ledger is not available.
 */
function subsPartitioned(subs, cardKey, flow, stock, flowFor) {
  const bySub = new Map(subs.map((sub) => [sub.key, []]));
  // Each order sits at one stage, so it lands in exactly one sub-card and the subs partition the
  // card — no ladder walking needed now that the card is its stage rather than a period of movement.
  for (const record of stock) if (bySub.has(record.sub)) bySub.get(record.sub).push(record);
  return subs.map((sub) => cityCard(bySub.get(sub.key), {
    key: sub.key,
    label: sub.label,
    basis: 'sitting',
    entered: flowFor(stagesOfSub(cardKey, sub.key))?.length ?? null,
    sitting: bySub.get(sub.key).length
  }));
}

// One order, flattened to the same shape the Design board's popup already reads — the popup tells
// the two design boards apart by the presence of `designer`, so the field set has to match.
function toRecord(deal) {
  const [card, sub] = placeOf(deal.Stage) ?? [null, null];
  const city = canonicalCityName(deal.city);
  const area = num(deal.Sqaure_Feet) > 0 ? num(deal.Sqaure_Feet) : num(deal.Cabinet_Area_Sqft);
  const amount = num(deal.Value) * LAKH;
  return {
    id: String(deal.id ?? ''),
    name: deal.Deal_Name ?? 'Unnamed order',
    cityRaw: clean(deal.city),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    designer: set(deal.Designer_Name) ? clean(deal.Designer_Name) : '',
    owner: deal.Owner?.name ?? '',
    stage: canonicalStage(deal.Stage),
    value: area,
    amount,
    amountLabel: amount > 0 ? inr(amount) : '',
    revisions: num(deal.Number_of_Design_Revisions),
    designSentOn: deal.Send_For_Approval_Date ?? null,
    createdAt: deal.Created_Time ?? null,
    card,
    sub
  };
}

// ---------------------------------------------------------------------------
// Cards — the house shape the other three funnels use, so the frontend renders them identically.
// ---------------------------------------------------------------------------
function card(records, extra = {}) {
  return { ...extra, count: records.length, ids: records.map((record) => record.id) };
}

function cityCard(records, extra = {}) {
  return { ...card(records, extra), byCity: cityRows(records, (mine, row) => card(mine, row)) };
}

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

// One spelling per city across everything in view, same rule as the other three funnels.
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

// ---------------------------------------------------------------------------
// The Zoho read
// ---------------------------------------------------------------------------
// The whole module, because this is a queue and not a period: an order raised in March can be at PDI
// today. Paged past Zoho's 2,000-record page-number ceiling with the page token, the same way the
// pre-design read does.
// The orders come from the shared module read in dealsModule.js — the Dispatch board needs the same
// 7,687 rows, and fetching them once instead of twice is where this board's cold load went from
// 12.6s to nothing when Dispatch has already loaded.
export const getPostDesignQueue = getAllDeals;

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
/**
 * @param deals   every Zoho Deal (the queue is not a period, so the whole module is read)
 * @param city    all | DEL | HYD | OTHER | one city's name
 * @param tf      the selected period — used ONLY to echo its label back, never to filter; see the
 *                note at the top of this file
 * @param notice  set when Zoho could not be read: the same shape comes back, with zeros
 */

// ---------------------------------------------------------------------------------------------
// The blueprint cohort
// ---------------------------------------------------------------------------------------------
/**
 * Orders BETWEEN the blueprint's two post-design markers: they have entered START_STAGE
 * ("Assign Post - Designer") and have not yet reached END_STAGE ("PDI Payment Done") or anything
 * past it.
 *
 * "Or anything past it" matters: 34 of the orders that have started post design moved straight from
 * a dispatch or installation stage without the PDI payment stage ever being set, and an exact match
 * on END_STAGE would hold them in the queue forever.
 *
 * With no history the cohort cannot be established, so the old stage-membership rule is used and
 * meta.coverage says so - a board that silently emptied itself would be worse than one that is
 * honestly approximate.
 */
function postDesignCohort(records, history, { includeCompleted = false } = {}) {
  if (!history) return records;
  const startKey = clean(canonicalStage(START_STAGE)).toLowerCase();
  return records.filter((record) => {
    const entry = history.get(String(record.id));
    const steps = entry?.entries ?? [];
    if (!steps.length) return false;
    const startedAt = steps
      .filter((step) => clean(canonicalStage(step.stage)).toLowerCase() === startKey)
      .map((step) => step.enteredAt)
      .filter(Boolean)
      .sort()[0];
    if (!startedAt) return false;
    // `includeCompleted` is what separates the board's two figures, and the distinction is real:
    //
    //   SITTING  must be in-flight. An order that has finished post design is not in the queue.
    //   ENTERED  must NOT be. An order that entered Handover in September and finished in September
    //            genuinely did move through post design that month, and dropping it would undercount
    //            exactly the orders that moved fastest.
    if (includeCompleted) return true;
    const finished = steps.some((step) => isTerminalStage(step.stage)
      && step.enteredAt && Date.parse(step.enteredAt) >= Date.parse(startedAt));
    return !finished;
  });
}

export function buildPostDesignFunnel({ deals = [], city, tf = null, history = null, notice = null }) {
  const all = (deals ?? []).filter(isRealDeal).map(toRecord);
  // The index the FLOW figures look orders up in. Built from the orders that have STARTED post
  // design, completed or not - not from every order in the module, which is what let the entered
  // figures count orders that had never begun post design.
  const byId = new Map(postDesignCohort(all, history, { includeCompleted: true })
    .map((record) => [record.id, record]));
  // The queue: everything sitting at one of the nine cards' stages right now.
  // "None" is Zoho's empty stage and maps to no card, so it never reaches the queue — but say it
  // here too, so a future STAGE_MAP entry cannot quietly put it on one.
  // THE COHORT IS THE BLUEPRINT'S POST-DESIGN BLOCK, not "anything sitting on a post-design-looking
  // stage". The Orders blueprint starts post design at "Assign Post - Designer" and ends it at
  // "PDI Payment Done", so an order belongs here when it has ENTERED the first and not yet reached
  // the second.
  //
  // The old rule was stage membership alone, which counted 494 orders against the 328 that have
  // actually started post design - 166 of them had never entered "Assign Post - Designer" at all.
  // They sit on a stage that also appears in post design (Sent for Approval, Order Booked, Designer
  // Assigned) while still being somewhere else entirely in their life.
  //
  // WHY NOT THE SEQUENCE NUMBERS. The picklist numbers those two stages 18 and 35, so "between 18
  // and 35" looks like the obvious test - and it is wrong. The picklist was extended twice after
  // that block was numbered, so 34 genuinely post-design stages sit outside it: every EP marking
  // stage, most of First visit, most of PDI. Taking the numeric range would have emptied those
  // cards. The dated history is the only thing that can say where an order actually is.
  const inPostDesign = postDesignCohort(all, history);
  const queue = inPostDesign.filter((record) => record.card && clean(record.stage).toLowerCase() !== 'none');
  applyCityMerge(queue);

  const selected = resolveCity(city, queue);
  const inView = queue.filter(selected.matches);

  const other = all.filter((record) => !record.card
    && OTHER_POST_DESIGN.has(clean(record.stage).toLowerCase())).length;

  // FLOW — orders that entered a set of stages during the period, as this board's own records so the
  // popup, the city rows and the card all read the same shape. An order the Deals read did not
  // return (created outside the window the orders call covers) is dropped rather than half-built.
  // How many orders entered these stages during the period. A secondary figure now, not the card's
  // own population — see the note on the card below.
  const flowFor = (stages, { previous = false } = {}) => {
    if (!history || !tf || !stages.length) return null;
    const found = enteredDuring(history, stages, tf, { previous })
      .map((hit) => byId.get(hit.id))
      .filter((record) => record && selected.matches(record));
    if (!previous) flowRecords.push(...found);
    return found;
  };

  // Everything any card counted, so `records` below can cover the flow ids as well as the queue.
  const flowRecords = [];
  const cards = POST_CARDS.map(({ key, label, unit, subs }) => {
    const stock = inView.filter((record) => record.card === key);
    const stages = stagesOfCard(key);
    const flow = flowFor(stages);
    const flowBefore = flowFor(stages, { previous: true });
    return {
      // The headline is FLOW where the ledger can supply it; the card keeps its stock figure beside
      // it either way. `basis` tells the frontend which of the two it is looking at.
      // THE CARD IS THE STAGE. Its orders are the ones sitting on it now, which is the only reading
      // under which every row in the popup says what the card says.
      //
      // The period figure did lead here, and it was the honest way to show movement — but combined
      // with stage purity it collapsed: "entered this period AND still on the stage" is a narrow
      // intersection and most cards fell to zero. So the queue leads and the period figure rides
      // alongside as `entered`, which keeps the period buttons meaningful without a card ever
      // holding a stage it is not named after.
      ...cityCard(stock, {
        key,
        label,
        ...(unit ? { unit } : {}),
        basis: 'sitting',
        entered: flow ? flow.length : null,
        sitting: stock.length,
        ...(flowBefore ? { previous: flowBefore.length } : {})
      }),
      // THE SUB-CARDS MUST PARTITION THE CARD, and on flow that needs care. An order can pass through
      // requested, planned AND done inside one month, so counting each sub independently would list
      // it three times and the subs would sum to twice the card — which is what the first cut of this
      // did (First visit: 44 across subs against a card of 22).
      //
      // So each order is credited to the FURTHEST sub it reached in the period, which is both a true
      // partition and the more useful reading: "of the 22 first visits worked this month, 18 got all
      // the way to done". Stock needs none of this — an order sits at exactly one stage.
      subs: subsPartitioned(subs, key, flow, stock, flowFor)
    };
  });

  // THE COHORT AND ITS TAT, to the handoff's model. The stage cards above are unchanged — they
  // still show where work sits today — and this is the wider truth beside them: every order that
  // has EVER entered post-design, how long it took, and how many are still running.
  const lives = [];
  if (history) {
    for (const [id, entry] of history) {
      const life = postDesignLifeOf(entry);
      if (!life) continue;
      const order = byId.get(id);
      if (order && !selected.matches(order)) continue;
      lives.push(life);
    }
  }
  const model = history ? summarise(lives) : null;

  return {
    meta: {
      // Echoed so the header still reads sensibly; the board itself is not filtered by it.
      reportLabel: tf?.reportLabel ?? null,
      city: selected.key,
      // True once the ledger is loaded: the cards' headline figures are then driven by the period.
      periodApplies: Boolean(history && tf),
      coverage: {
        queue: inView.length,
        cohortRule: history
          ? 'Orders between the two post-design markers on the Orders blueprint: they have entered "Assign Post - Designer" and have not yet reached "PDI Payment Done" or any stage past it.'
          : 'The stage history could not be read, so the board falls back to stage membership alone and counts orders that may never have started post design.',
        cohortDated: Boolean(history),
        otherPostDesign: other,
        // The evidence behind the info panel, as data rather than prose in the component.
        source: 'Deals.Stage — the only post-design signal filled in the CRM',
        emptyFields: [
          'Hand_over_open / received / done', 'Measurement_open / received / done',
          'EPT_Signoff_open / received / done', 'EPT_Verification_open / received / done',
          'EPT_Marking_open / received / done', 'Production_Drawing_Signoff_open / received / done',
          'PDI_Visit_open / received / done', 'Requested_Visit_Date', 'Handover_to_Factory'
        ],
        checkedOrders: 7626,
        checkedSince: '2025-09-24',
        partial: [
          { field: 'Aligned_Visit_Date', filled: 7 },
          { field: 'PDI_Status', filled: 1 },
          { field: 'First_Measurement_Status', filled: 1 },
          { field: 'Production_Drawing_Status', filled: 1 }
        ],
        periodNote: history
          ? 'Each card leads with how many orders ENTERED its stage in the selected period, read from '
            + 'DealHistory, and keeps the number sitting there right now beside it. The dedicated '
            + 'milestone date fields are still empty, so the stage ledger is what makes this possible.'
          : 'The stage ledger could not be read, so the cards fall back to a live queue and the period '
            + 'buttons above do not filter them.',
        partitionNote: 'An order sits at exactly one stage, so the nine cards partition the queue and '
          + 'each card’s sub-cards partition the card.',
        modelNote: 'The cohort, start, end, TAT and status follow the validated Post-Design handoff '
          + '(29 Sep 2026): an order counts once it has ever entered a post-design stage, the start is '
          + 'its first "Assign Post - Designer" or the first post-design stage it reached, and the end '
          + 'is the first terminal stage at or after that. Completed TAT and open running time are '
          + 'never averaged together.',
        otherNote: 'Appliances, finishes and cladding are post-design work but are not one of the nine '
          + 'cards, so they are counted here instead of being dropped.'
      },
      notice
    },
    filters: { cities: cityFilters(queue) },
    // Every card ships with the formula that produced it, generated from the same
    // DEAL_POST_DESIGN_STEPS table the counting used.
    postDesign: { cards: attachPostDesignFormulas(cards, tf, Boolean(history)) },
    // The cohort's own figures, beside the stage cards rather than instead of them.
    model,
    // Every order any card points at — the live queue AND the orders that entered a stage during the
    // period and have since moved past post-design entirely. Building this from the queue alone left
    // 22% of the flow cards' ids with no row behind them, so a card of 22 opened a table of 12.
    records: [...new Map([...inView, ...flowRecords].map((record) => [record.id, record])).values()]
      .map(({ cityNameKey, card: _c, sub: _s, ...record }) => ({
        ...record,
        // Lets the popup tell a post-design row from a pre-design one, so each card can be given the
        // columns its own title is about rather than one table shared by every card on the board.
        board: 'post-design',
        ...timingOf(history?.get(record.id))
      }))
  };
}
