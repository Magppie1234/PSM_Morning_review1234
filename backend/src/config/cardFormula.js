import { DEAL_POST_DESIGN_STEPS, DEAL_PRE_DESIGN_STEPS } from './journey.js';

// THE FORMULA EACH CARD SHIPS WITH.
//
// "Show Formula" used to be a Pre Sales feature: its formulas were hand-written in the frontend and
// had to be kept in step with the backend by hand. That does not scale past one board, and a formula
// that has drifted from the code is worse than none - it tells you confidently how a number was
// built, wrongly.
//
// So the formula is BUILT FROM THE SAME CONFIG THAT COMPUTES THE NUMBER. A card's stage list is read
// out of journey.js, which is the list the card counted with; add a stage there and the formula says
// so without anyone remembering to update it. The frontend renders what it is given.
//
// Each entry is the shape the Formula component already expects:
//   { title, summary, module, filters: [{label, api, module, op, value}], fields: [...], crm: [...] }

const ORDERS = 'Orders (Deals)';
const HISTORY = 'Deal History (DealHistory)';

/** A field reference: Zoho's own display name, its API name, and the module it lives in. */
const f = (label, api, module = ORDERS) => ({ label, api, module });
/** A filter: a field plus the condition applied to it. */
const c = (field, op, value) => ({ ...field, op, value });

const F = {
  name: f('Deal Name', 'Deal_Name'),
  stage: f('Stage', 'Stage'),
  created: f('Created Time', 'Created_Time'),
  designer: f('Designer Name', 'Designer_Name'),
  product: f('Product Type', 'Product_Type'),
  value: f('Value (₹ Lacs)', 'Value'),
  city: f('City', 'city'),
  revisions: f('Number of Design Revisions', 'Number_of_Design_Revisions'),
  revisionType: f('Revision Type', 'Revision_Type'),
  reasonSm: f('Reason for Design Revision (SM)', 'Reason_for_Design_Revision1'),
  reasonDesign: f('Reason for Design Revision', 'Reason_for_Design_Revision2'),
  sentOn: f('Send For Approval Date', 'Send_For_Approval_Date'),
  requiredOn: f('Design Required on', 'Design_Required_on'),
  expected: f('Expected Design Date', 'Expected_Design_Date'),
  query: f('Requirements For SM', 'Requirements_For_SM'),
  presentation: f('Design Presentation', 'Design_Presentation'),
  handover: f('Handover Date', 'Handover_Date'),
  hStage: f('Stage', 'Stage', HISTORY),
  hEntered: f('Modified Time (entered the stage)', 'Modified_Time', HISTORY),
  hMovedTo: f('Moved To', 'Moved_To__s', HISTORY)
};

// Two filters every card on this board carries, because they define its population rather than its
// stage. Stated on each card rather than once at the top: someone rebuilding a single card in Zoho
// needs the whole filter, not a cross-reference.
const EXCLUSIONS = [
  c(F.name, 'does not contain', 'test  (staff test orders, 66 in the module)'),
  c(F.product, 'is not', 'Sunrooof / SUNROOOF  (a separate product line, 562 orders, excluded from this dashboard)')
];

const period = (tf) => `between ${tf?.start ?? '(period start)'} and ${tf?.end ?? '(period end)'} (IST)`;

const quote = (stages) => stages.map((stage) => `"${stage}"`).join(', ');

const BASE_STEPS = (tf) => [
  'Open Orders in Zoho CRM.',
  `Filter: Created Time ${period(tf)}.`,
  'Filter: Deal Name does not contain "test".',
  'Filter: Product Type is not Sunrooof.'
];

// The cohort rule, which is the head of the chain and is not a stage test at all.
const COHORT_SUMMARY = 'Every design request that arrived in the period: an order created in the '
  + 'period that either carries a design field (designer, design required/expected date, design '
  + 'presentation, approval date or a revision count) or is sitting at a design stage. Legacy orders '
  + 'imported straight into Final Handover carry none of those and are left out.';

const COHORT_FIELDS = [F.created, F.designer, F.requiredOn, F.expected, F.presentation, F.revisions, F.stage];

// Cards whose summary needs saying in words rather than derived from a stage list.
const NOTES = {
  requests: COHORT_SUMMARY,
  revisionDone: 'Zoho has no "revision done" stage, so this one is DERIVED: an order that carries a '
    + 'revision (a revision count above zero, a revision type, or either revision-reason field) and '
    + 'is no longer sitting on a revision stage. It is the nearest honest reading, not a stage test.',
  assignmentPending: 'Orders at the Form Filled stage, PLUS orders at a later stage with no Designer '
    + 'Name set in Zoho - 13 orders sit at a stage called "Designer Assigned" with nobody named on '
    + 'them, and they are genuinely still waiting. The two cards stay exclusive: Designer assigned '
    + 'requires a real name as well as the stage.'
};

const EXTRA_FIELDS = {
  requests: COHORT_FIELDS,
  orderBooked: [F.stage, F.value, F.created],
  revisionRequested: [F.stage, F.revisions, F.revisionType, F.reasonSm, F.reasonDesign],
  revisionDone: [F.revisions, F.revisionType, F.reasonSm, F.reasonDesign, F.stage],
  sentForApproval: [F.stage, F.sentOn, F.presentation],
  queryToSm: [F.stage, F.query],
  underDesign: [F.stage, F.expected, F.requiredOn],
  designerAssigned: [F.stage, F.designer],
  assignmentPending: [F.stage, F.designer, F.requiredOn],
  handover: [F.stage, F.handover]
};

/**
 * The formula for one pre-design card, built from its own entry in journey.js.
 *
 * @param {string} key  the card key, e.g. 'designerAssigned'
 * @param {object} tf   the timeframe, for the dates quoted in the filters
 * @param {boolean} hasHistory  whether the stage ledger was read for this response - it changes what
 *                              the card actually counted, so it changes what the formula may claim
 */
export function preDesignFormula(key, tf, hasHistory = false) {
  const step = DEAL_PRE_DESIGN_STEPS.find((entry) => entry.key === key);
  if (!step) return null;

  const stageFilter = step.stages.length
    ? [c(F.stage, 'is one of', quote(step.stages))]
    : [];

  const summary = NOTES[key]
    ?? `Orders sitting at ${step.stages.length === 1 ? 'the stage' : 'any of the stages'} `
      + `${quote(step.stages)}. A card contains only the stages it is named after - nothing is `
      + 'counted cumulatively, so an order appears on exactly one stage card.';

  // The ledger changes what "on this stage" means, so the formula says which reading produced the
  // number rather than describing a rule the response did not use.
  const ledgerNote = hasHistory
    ? 'Dates and time-in-status come from Deal History, which holds one dated row per stage an order '
      + 'has been in. The count itself is the order\'s CURRENT stage.'
    : 'The stage ledger could not be read for this response, so dates and time-in-status are blank '
      + 'and the count is the Stage field alone.';

  return {
    title: step.label,
    summary,
    module: ORDERS,
    filters: [c(F.created, 'is', period(tf)), ...stageFilter, ...EXCLUSIONS],
    fields: uniqueFields([F.name, F.city, ...(EXTRA_FIELDS[key] ?? [F.stage]), ...(hasHistory ? [F.hStage, F.hEntered, F.hMovedTo] : [])]),
    crm: [
      ...BASE_STEPS(tf),
      ...(step.stages.length ? [`Filter: Stage is one of ${quote(step.stages)}.`] : []),
      ...(key === 'requests' ? ['Filter: any of Designer Name, Design Required on, Expected Design Date, Design Presentation, Design Approved Date or Number of Design Revisions is set - or Stage is a design stage.'] : []),
      ...(key === 'revisionDone' ? ['Filter: Number of Design Revisions > 0 OR Revision Type is set OR either Reason for Design Revision is set.', 'Then exclude anything still sitting on a revision stage.'] : []),
      ...(key === 'assignmentPending' ? ['Also include: Stage is any later stage AND Designer Name is empty.'] : []),
      ledgerNote
    ]
  };
}

/**
 * Attaches a formula to every card on an object keyed by card key, in place, and returns it.
 * Used by the board builders so no card can ship without one.
 */
export function attachPreDesignFormulas(cards, tf, hasHistory = false) {
  for (const [key, card] of Object.entries(cards)) {
    if (!card || typeof card !== 'object' || !card.key) continue;
    const formula = preDesignFormula(key, tf, hasHistory);
    if (formula) card.formula = formula;
  }
  return cards;
}

/**
 * A formula for a card that is not one of the journey steps - the Pre-efficiency averages and the
 * other boards' cards, which are described where they are built rather than by a stage list.
 */
export function formulaOf({ title, summary, module = ORDERS, filters = [], fields = [], crm = [] }, tf) {
  return {
    title,
    summary,
    module,
    filters: [c(F.created, 'is', period(tf)), ...filters, ...EXCLUSIONS],
    fields: fields.length ? fields : [F.name, F.stage],
    crm: [...BASE_STEPS(tf), ...crm]
  };
}

export { F as FORMULA_FIELDS, c as formulaFilter, ORDERS, HISTORY };

// ---------------------------------------------------------------------------------------------
// The Sales board
// ---------------------------------------------------------------------------------------------
// Its cards read Qualified Leads (Contacts), not Orders, and its S1-S6 ladder reads one picklist
// field rather than a dated stage history. That last point matters enough to repeat on every rung:
// unlike every other board here, Client_Status is NOT tracked by a history module, so those six
// cards are a snapshot of where a record stands NOW and cannot be dated.

const CONTACTS = 'Qualified Leads (Contacts)';
const cf = (label, api) => ({ label, api, module: CONTACTS });

// Opportunity_Stage_History - the contact-side stage ledger. Distinct from DealHistory above, which
// tracks orders; this one tracks Contacts.Stage and is what dates S6 and Handover to design.
const OPP_HISTORY = 'Opportunity Stage History';
const H = {
  stage: { label: 'Stage', api: 'Stage', module: OPP_HISTORY },
  entered: { label: 'Modified Time (entered the stage)', api: 'Modified_Time', module: OPP_HISTORY }
};

const C = {
  name: cf('Full Name', 'Full_Name'),
  psm: cf('Sales Manager', 'Sales_Manager'),
  owner: cf('Contact Owner', 'Owner'),
  created: cf('Created Time', 'Created_Time'),
  status: cf('Current Stage', 'Client_Status'),
  value: cf('Value (₹ Lacs)', 'Total_Opportunity_Value'),
  city: cf('City', 'City'),
  source: cf('Lead Source', 'Lead_Source'),
  product: cf('Product Type', 'Product_Type'),
  estClosure: cf('Est. Closure Date', 'Est_Closoure_Date'),
  actualClosure: cf('Actual Closure Date', 'Actual_Closure_Date')
};

const CONTACT_EXCLUSIONS = [
  c(C.name, 'does not contain', 'test  (staff test records)'),
  c(C.product, 'is not', 'Sunrooof  (also checked on Product Requirement; excluded from this dashboard)')
];

const CONTACT_STEPS = (tf) => [
  'Open Qualified Leads (Contacts) in Zoho CRM.',
  `Filter: Created Time ${period(tf)}.`,
  'Filter: Full Name does not contain "test".',
  'Filter: Product Type / Product Requirement is not Sunrooof.'
];

// The one caveat every ladder rung carries.
const SNAPSHOT_NOTE = 'Current Stage (Client_Status) is a SNAPSHOT: no Zoho history module tracks it, '
  + 'so this card is where records stand today and cannot be filtered by when they reached the rung. '
  + 'Every other board on this dashboard is dated; this one is not.';

// A field listed twice renders twice and, because the Formula component keys its tags by module +
// API name, React then sees two children with the same key. Sales Manager is in the base list AND in
// a couple of the card specs, so the list is de-duplicated rather than each spec being trimmed.
const uniqueFields = (fields) => {
  const seen = new Set();
  return fields.filter((field) => {
    const id = `${field.module}.${field.api}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

// `dated: true` means the card is NOT scoped by Created Time. Three cards on this board are dated by
// something real - Order Booked by Actual Closure Date, Principally Closed and Handover to design by
// when the contact entered the stage - and printing a Created Time filter on them was simply false:
// the one order on Order Booked was created in November 2025 and the panel claimed a filter of
// "created between 1 and 2 October 2026". A formula that does not match the code is worse than none.
function salesFormula({ title, summary, filters = [], fields = [], crm = [], dated = false }, tf) {
  const steps = CONTACT_STEPS(tf);
  return {
    title,
    summary,
    module: CONTACTS,
    filters: [...(dated ? [] : [c(C.created, 'is', period(tf))]), ...filters, ...CONTACT_EXCLUSIONS],
    fields: uniqueFields([C.name, C.psm, C.city, ...fields]),
    // steps[1] is the Created Time line; a dated card drops it and states its own rule instead.
    crm: [...(dated ? steps.filter((step) => !step.startsWith('Filter: Created Time')) : steps), ...crm]
  };
}

/** S6, which unlike S1-S5 is dated: Contacts.Stage is tracked by Opportunity_Stage_History. */
export function principalFormula(stage, tf) {
  return salesFormula({
    title: `${stage.short ?? stage.key} · ${stage.label}`,
    summary: 'Qualified leads that ENTERED "Principally Closed" during the period, counted once each '
      + 'from Opportunity Stage History, with the number sitting there right now beside it. This card '
      + 'reads Contacts.Stage, which Zoho tracks - unlike the S1-S5 rungs, which read Client_Status and '
      + 'cannot be dated at all.',
    dated: true,
    filters: [
      c(H.stage, 'is', `"${stage.label}"`),
      c(H.entered, 'is', period(tf))
    ],
    fields: [C.status, C.value, C.estClosure],
    crm: [
      'Open Opportunity Stage History in Zoho CRM.',
      `Filter: Stage is "${stage.label}".`,
      `Filter: Modified Time (the moment the contact entered the stage) ${period(tf)}.`,
      'Count each contact once, however many times it entered.',
      'The second figure is a separate query: the contacts whose Stage is this one right now, which '
        + 'deliberately does not move when the period does.'
    ]
  }, tf);
}

/** The six ladder rungs, built from the same STAGES table the cards were counted with. */
export function ladderFormula(stage, tf) {
  const isS1 = stage.key === 'S1';
  return salesFormula({
    title: `${stage.short ?? stage.key} · ${stage.label}`,
    summary: `Open qualified leads whose Current Stage reads "${stage.label}". `
      + (isS1 ? 'Only leads actually marked "Not Yet Validated" are here. Leads with no Current Stage set are NOT on this rung — they are on no rung, and the card says how many. '
        : '')
      + SNAPSHOT_NOTE,
    filters: [c(C.status, 'is', `"${stage.label}"`)],
    fields: [C.status, C.value, C.estClosure],
    crm: [
      `Filter: Current Stage is "${stage.label}".`,
      'Exclude anything already Closed or Dead: both are tested before the ladder, so "Closed" is never read as the tail of "Design Closed + Price Open".'
    ]
  }, tf);
}

/** Every non-ladder Sales card, described where it is built rather than by a stage list. */
export const SALES_CARD_SPECS = {
  incoming: {
    title: 'Incoming leads from PSM',
    summary: 'Qualified leads created in the period whose Sales Manager field names a PSM, which are the ones the PSM team handed over.',
    filters: [c(C.psm, 'is one of', 'the PSM team')],
    fields: [C.psm, C.created, C.value],
    crm: ['Filter: Sales Manager is one of the PSM team.']
  },
  selfRaw: {
    title: 'Self-generated raw leads',
    summary: 'The rest of the intake: qualified leads a salesperson brought in themselves, so the Sales Manager field does not name a PSM. Together with the card above, the two cover the intake exactly.',
    filters: [c(C.psm, 'is not one of', 'the PSM team')],
    fields: [C.psm, C.created, C.source],
    crm: ['Filter: Sales Manager is NOT one of the PSM team.']
  },
  qualified: {
    title: 'Qualified',
    summary: 'The qualified part of the whole intake, so both cards above feed it. It is then cut two ways: by who qualified it, and by where it came from.',
    fields: [C.status, C.source, C.value],
    crm: ['No extra filter: every record in the Contacts module is a qualified lead.']
  },
  estClosure: {
    title: 'Est. closure for this period',
    summary: 'Open qualified leads whose Est. Closure Date falls inside the period. This is what the team EXPECTS to close, which is not the same set as what actually closed.',
    filters: [c(C.estClosure, 'is', 'inside the period'), c(C.status, 'is not', 'Closed or Dead')],
    fields: [C.estClosure, C.value, C.status],
    crm: ['Filter: Est. Closure Date is inside the period.', 'Exclude Closed and Dead.']
  },
  overdue: {
    title: 'Overdue orders',
    summary: 'Everything still open whose Est. Closure Date is already in the past. NOT period-filtered: an estimate that has passed stays passed whichever period you pick, so there is no honest "last period" figure to compare it against.',
    filters: [c(C.estClosure, 'is before', 'today'), c(C.status, 'is not', 'Closed or Dead')],
    fields: [C.estClosure, C.value, C.status],
    crm: ['Filter: Est. Closure Date is before today.', 'Exclude Closed and Dead.', 'Do NOT filter by Created Time: this card is deliberately not period-scoped.']
  },
  closed: {
    title: 'Order Booked',
    summary: 'What actually closed in the period, dated by Actual Closure Date rather than by Current Stage. The Zoho value is "Closed"; only the card is named the way the sales team talks about it.',
    dated: true,
    filters: [c(C.actualClosure, 'is', 'inside the period'), c(C.status, 'is', 'Closed')],
    fields: [C.actualClosure, C.value, C.status],
    crm: ['Filter: Current Stage is "Closed".', 'Filter: Actual Closure Date is inside the period.',
      'NOT filtered by Created Time: a lead booked this month may have arrived a year ago.']
  },
  handover: {
    title: 'Handover to design',
    summary: 'Qualified leads that ENTERED "Handover To Post Design" during the period, from Opportunity '
      + 'Stage History, with the number sitting there right now beside it. Counted in CLIENTS, not orders: '
      + 'one client averages 2.12 orders, which is why this figure and the Design board intake can never be equal.',
    dated: true,
    filters: [c(H.stage, 'is', '"Handover To Post Design"'), c(H.entered, 'is', 'inside the period')],
    fields: [C.status, C.value],
    crm: ['Open Opportunity Stage History in Zoho CRM.',
      'Filter: Stage is "Handover To Post Design".',
      'Filter: Modified Time (when the contact entered the stage) is inside the period.',
      'NOT filtered by Created Time: a lead handed over this month may have arrived months earlier.',
      'Note the unit: this card counts clients, the Design board counts orders.']
  }
};

/** Attaches formulas to the Sales board's two card groups, in place. */
export function attachSalesFormulas(board, tf, ladderStages = []) {
  const { leadGeneration, salesPerformance } = board ?? {};
  for (const [key, spec] of Object.entries(SALES_CARD_SPECS)) {
    const card = leadGeneration?.[key] ?? salesPerformance?.[key];
    if (card && typeof card === 'object') card.formula = salesFormula(spec, tf);
  }
  // The ladder, plus S6, from the same table the cards were counted with.
  (salesPerformance?.stages ?? []).forEach((card) => {
    const stage = ladderStages.find((entry) => entry.key === card.key);
    if (stage) card.formula = ladderFormula(stage, tf);
  });
  const s6 = ladderStages.find((entry) => entry.key === 'S6');
  // S6 gets its own dated formula, not the snapshot one the S1-S5 rungs carry.
  if (salesPerformance?.principal && s6) salesPerformance.principal.formula = principalFormula(s6, tf);
  return board;
}

// ---------------------------------------------------------------------------------------------
// The Post Design queue
// ---------------------------------------------------------------------------------------------
// Built from DEAL_POST_DESIGN_STEPS, the same table the cards were counted with, so a stage added
// there shows up here without anyone remembering.
//
// This board carries TWO figures per card and they answer different questions, so each formula says
// which is which:
//   ENTERED   the big number - orders that reached the stage during the period, from Deal History.
//   SITTING   the small one - orders parked there right now, whatever period is selected.
// They rarely match: 35 orders reached Handover this period while 303 are parked there.

/** Every stage a post-design step owns, its sub-cards included. */
function stagesOfStep(step) {
  return [...(step.stages ?? []), ...(step.subs ?? []).flatMap((sub) => sub.stages ?? [])];
}

const SUB_NOTE = 'Each order is credited to the FURTHEST sub-card it reached, so the sub-cards add '
  + 'back to their card rather than double-counting an order that passed through all three.';

const VISIT_NOTE = 'Counted in VISITS, not orders: one order can need several site visits, and the '
  + 'card is about the visits.';

/** The formula for one post-design card. */
export function postDesignFormula(step, tf, hasHistory = true) {
  const stages = stagesOfStep(step);
  const isVisit = step.unit === 'visit';

  const summary = `Orders that ENTERED ${step.label} during the period - any of the stages `
    + `${quote(stages)}. The figure under it is how many are sitting there right now, which is a `
    + 'different question and is not period-filtered.'
    + (step.subs?.length ? ` ${SUB_NOTE}` : '')
    + (isVisit ? ` ${VISIT_NOTE}` : '');

  return {
    title: step.label,
    summary,
    module: HISTORY,
    filters: [
      c(F.hStage, 'is one of', quote(stages)),
      c(F.hEntered, 'is', period(tf)),
      c(F.name, 'does not contain', 'test  (staff test orders)'),
      c(F.product, 'is not', 'Sunrooof  (excluded from this dashboard)')
    ],
    fields: [F.name, F.hStage, F.hEntered, F.hMovedTo, F.stage, F.designer, F.city],
    crm: [
      'Open Deal History in Zoho CRM (the field-tracking module behind Orders).',
      `Filter: Stage is one of ${quote(stages)}.`,
      `Filter: Modified Time - which on this module is when the order ENTERED the stage - ${period(tf)}.`,
      'Count the distinct orders. That is the big figure on the card.',
      'For the figure underneath, take the same stage list but filter Moved To is empty, with no date filter: those are the orders sitting there now.',
      ...(step.subs?.length ? [`Sub-cards: ${step.subs.map((sub) => `${sub.label} = ${quote(sub.stages ?? [])}`).join('; ')}.`, SUB_NOTE] : []),
      ...(hasHistory ? [] : ['The stage ledger could not be read for this response, so the card fell back to the Stage snapshot and shows only what is sitting there now.'])
    ]
  };
}

/** Attaches a formula to every post-design card, in place. */
export function attachPostDesignFormulas(cards, tf, hasHistory = true) {
  const list = Array.isArray(cards) ? cards : Object.values(cards ?? {});
  for (const card of list) {
    if (!card || typeof card !== 'object' || !card.key) continue;
    const step = DEAL_POST_DESIGN_STEPS.find((entry) => entry.key === card.key);
    if (step) card.formula = postDesignFormula(step, tf, hasHistory);
  }
  return cards;
}
