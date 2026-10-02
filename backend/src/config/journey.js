// THE JOURNEY MAP — the one place a Zoho stage value is given a meaning.
//
// Before this file, the same decision was made in three places that disagreed with each other:
// salesFunnel.js (STAGES, from Contacts.Client_Status), preDesignBoard.js (STAGE_RANKS, a cumulative
// ranking of Deals.Stage) and postDesignFunnel.js (STAGE_MAP, a flat partition of the same picklist).
// A stage could therefore mean one thing on the Sales board and another on the Design board, which is
// a large part of why the boards never reconciled.
//
// Everything here is keyed to the customer's own journey diagram, whose five numbered rows are:
//   1 Lead management & sales          -> Leads, then Contacts
//   2 Payment, post-design & factory   -> Deals
//   3 Factory planning & procurement   -> Deals
//   4 Production, inspection, payment  -> Deals
//   5 Dispatch, installation, AMS      -> Deals, Visit_Module, AMS_Complaints
//
// Every stage listed below was taken from a LIVE CENSUS of the stage ledgers on 2026-09-28, not from
// the picklist definitions — a picklist value nobody has ever used is noise, and a value in use that
// is missing from the picklist (there are several) would otherwise be dropped silently.
//
// ---------------------------------------------------------------------------
// WHAT IS AND IS NOT DATED — read this before moving a card onto the ledger
// ---------------------------------------------------------------------------
// Zoho's history trackers follow specific FIELDS, not modules. Verified:
//
//   Lead_Status_History        follows Leads.Lead_Status          -> Pre Sales is fully dateable
//   Opportunity_Stage_History  follows Contacts.Stage             -> only the "Status" ladder
//   DealHistory                follows Deals.Stage, Designer_Name,
//                              Product_Type, both revision reasons -> Design is fully dateable
//
// CONTACTS.CLIENT_STATUS IS NOT TRACKED BY ANYTHING. That is the field the Sales board's S1-S6
// ladder is built from, so those six cards cannot be dated and must stay snapshot-based until either
// the CRM starts tracking that field or the ladder is re-based onto Contacts.Stage. The three Sales
// cards that exist in BOTH ladders — Principally Closed, Order Booked, Handover To Post Design — are
// in Contacts.Stage and therefore can be dated today.

// ---------------------------------------------------------------------------
// 1 · Leads — the Pre Sales board
// ---------------------------------------------------------------------------
// Only eight statuses are in use, and they partition cleanly. Keys match the existing card ids in
// frontend/src/components/presales/LeadFlow.jsx; the card LABELS are unchanged.
export const LEAD_STEPS = [
  { key: 'notContacted', label: 'Not contacted', stages: ['Not Contacted Yet'] },
  { key: 'notResponding', label: 'Not responding', stages: ['No Response/ Call Back Later'] },
  { key: 'drawingAwaited', label: 'Qualified drawing awaited', stages: ['Qualified/ Drawings Awiated'] },
  // "Will buy in Future" is the follow-up bucket's other half, and the AI escalation sits here too:
  // it means a human has to look at the lead, which is a follow-up, not a rejection.
  { key: 'followUp', label: 'Under follow-up', stages: ['Under Follow Up', 'Will buy in Future', 'Human Intervention Required(AI)'] },
  { key: 'dropped', label: 'Dropped / dead', stages: ['Not Interested', 'Junk Lead'] }
];

// "Contacted" is not a status of its own — it is everything that has moved off "Not Contacted Yet".
// On the ledger that is a real, dated event: the record's first entry into any other status.
export const LEAD_NOT_CONTACTED = 'Not Contacted Yet';

// ---------------------------------------------------------------------------
// 2 · Contacts — the Sales board (journey row 1)
// ---------------------------------------------------------------------------
// Contacts.Stage, which the CRM labels "Status". This ladder IS the diagram's row 1, box for box.
export const CONTACT_STEPS = [
  { key: 'opportunity', label: 'Assigned to PSM', diagram: 'Assigned to PSM', stages: ['Opportunity Receieved', 'Raw Quote'] },
  { key: 'validated', label: 'Validated by SM', diagram: 'ASM assigns Sales Manager', stages: ['Validated By SM'] },
  { key: 'designForm', label: 'Design form', diagram: 'Design form', stages: ['Design Form Filled'] },
  { key: 'designDiscussion', label: 'Design discussion', diagram: 'Design discussion', stages: ['Design Discussion', 'Revised Design Discussion', 'Revised Design Discussion1', '3D Drawing Approved'] },
  { key: 'priceDiscussion', label: 'Price discussion', diagram: 'Price discussion', stages: ['Price Discussion', 'Approve/Disapprove Quote'] },
  { key: 'principal', label: 'S6 Principally Closed', diagram: 'Principally closed', stages: ['Principally Closed'] },
  { key: 'closed', label: 'Order Booked', diagram: 'Closure', stages: ['Order Booked'] },
  { key: 'handover', label: 'Handover to design', diagram: '-> row 2', stages: ['Handover To Post Design'] }
];

// Side states — not rungs of the ladder, so a card built on them is a state and not a step.
export const CONTACT_SIDE = {
  followUp: ['Under Follow Up'],
  onHold: ['On Hold'],
  dead: ['Dead']
};

// The S1-S6 ladder, kept on Contacts.Client_Status because nothing tracks that field. Left here so
// the snapshot rule lives beside the dated ones rather than hidden in salesFunnel.js, and so the
// contrast is visible: these have no `stages` because they are regexes over a snapshot, not events.
export const CLIENT_STATUS_IS_UNTRACKED = true;

// ---------------------------------------------------------------------------
// 3 · Deals — the Design boards (journey rows 2 to 5)
// ---------------------------------------------------------------------------
// Deals.Stage. Pre Design is row 2 up to the factory handover; Post Design is the rest of row 2 plus
// rows 3 to 5. Keys and labels match the cards already on screen — nothing is renamed.
// STRICT STAGE MEMBERSHIP. Each card holds the orders whose CURRENT stage is one of its own, and
// nothing else — open "Designer assignment pending" and every row says Form Filled.
//
// This replaces an earlier "ever reached this stage" rule. That rule counted an order that passed
// through a stage and moved on, which is the right way to measure flow but made the popups read
// wrong: "Designer assigned" opened 297 orders of which 231 were sitting at Sent for Approval. A
// card named after a stage holds that stage.
//
// "None" is absent from every card below. It is Zoho's empty stage — an order nobody has set a
// stage on — not a step in the process, so it belongs on no card.
export const DEAL_PRE_DESIGN_STEPS = [
  // The head of the chain is the cohort itself rather than a stage: every design request that
  // arrived in the period. `cohort` marks it, because it is the one card that is not a stage test.
  { key: 'requests', label: 'Total new requests from sales', cohort: true, stages: [] },
  // The form is in and nobody has been put on it yet.
  { key: 'assignmentPending', label: 'Designer assignment pending', stages: ['Form Filled'] },
  { key: 'designerAssigned', label: 'Designer assigned', stages: ['Designer Assigned'] },
  // Drawing work proper, once a designer has picked it up.
  { key: 'underDesign', label: 'Under design', stages: [
    'Design Discussion', 'Modd Board', 'Modd Board Selection(Client) Request',
    'Modd Board Selection Approved', 'Preparation of 3D Drawings', '3D Drawings Approved',
    'Sample Request', 'Under Follow Up Design'] },
  { key: 'queryToSm', label: 'Query to SM', stages: ['Query to SM'] },
  { key: 'sentForApproval', label: 'Sent for approval', stages: [
    'Sent for Approval', 'Sent to Client (First Design)', 'Price Discussion', 'Design Dis-Approved'] },
  { key: 'revisionRequested', label: 'Revision requested', stages: [
    'Revision Required', 'Revision For 3D Drawing', 'Design Revision After Site Measurement',
    'Revised Design Discussion', 'Revision Modd Board'] },
  // The one card with no stage of its own: Zoho records no "revision done" value. It is the orders
  // that CARRY a revision count and are no longer sitting on a revision stage — the nearest honest
  // reading, and the card says so.
  { key: 'revisionDone', label: 'Revision done', derived: true, stages: [] },
  // "Payment Approvals" USED TO BE HERE AS WELL as on post-design's "Payment pending", so its orders
  // were counted on both boards. The blueprint settles which is which:
  //   Payment Awaited  -> Order Booked              pre-booking, so it belongs here
  //   PD Approvals -> Payment Approvals -> Handover to Factory   post-design, so it belongs there
  // "Closed Won" is kept although it has never been used in 28,025 history rows, because it is a
  // standard Zoho value that would start appearing the moment anyone selected it.
  { key: 'orderBooked', label: 'Order booked', stages: [
    'Order Booked', 'Closed Won', 'Payment Awaited'] },
  { key: 'handover', label: 'Handover to design', stages: [
    'Handover to Post Design', 'Assign Post - Designer'] }
];

// Zoho's empty stage. Never a card, and never part of a board's population.
export const EMPTY_STAGE = 'none';

// Stages that mean the order stopped rather than progressed. Never counted as a milestone.
export const DEAL_OUT_OF_PLAY = [
  'Raw Quote', 'Ringing No Response', 'Call Back Later', 'Will Visit Showroom',
  'Under Follow Up', 'Not Interested', 'Closed Lost', 'Stalled', 'Hold'
];

// Post Design — the nine cards already on the board, with their sub-cards. Same keys, same labels.
export const DEAL_POST_DESIGN_STEPS = [
  { key: 'handover', label: 'Handover', subs: [], stages: ['Handover to Post Design', 'Assign Post - Designer', 'PD Approvals'] },
  { key: 'firstVisit', label: 'First visit', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested', stages: ['Request for Site Visit', 'Revisit Req-First Measurement'] },
    { key: 'planned', label: 'Planned', stages: ['Align First Measurement', 'First Measurement'] },
    { key: 'done', label: 'Done', stages: ['First Measurement Done', 'First Measurement Approved', 'Design Approved After First Meaurement', 'First Measurement / EPT /Production Drawing / Mood Board 3D / PDI'] }] },
  // EP prep · Planned CANNOT FILL, and this is the honest record of why rather than a silent zero.
  // Its only stage value is "EPT", which appears 0 times in 28,025 DealHistory rows: it is a state of
  // the "Post Design" blueprint, which is INACTIVE. The active "Order Stages" blueprint goes straight
  // from Preparation of Electrical and Plumbing Drawings to Request for Electric and Plumbing Marking
  // with nothing between, so there is no real state for this sub-step to count. The value is kept so
  // the card starts working by itself if that blueprint is ever activated.
  { key: 'epPrep', label: 'EP prep', subs: [
    { key: 'requested', label: 'Requested', stages: ['Preparation of Electrical and Plumbing Drawings'] },
    { key: 'planned', label: 'Planned', stages: ['EPT'] },
    { key: 'done', label: 'Done', stages: ['EP DWG'] }] },
  { key: 'epApproval', label: 'EP approval', subs: [
    { key: 'pending', label: 'Pending', stages: ['Request for Electric Plumbing Checking'] },
    { key: 'approved', label: 'Approved', stages: ['EP Verification', 'Electric/Plumbing Checking Done'] }] },
  { key: 'epMarking', label: 'EP marking visits', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested', stages: ['Request for Electric and Plumbing Marking'] },
    { key: 'planned', label: 'Planned', stages: ['Align Visit for Electrical / Plumbering', 'Electric/Plumbing Marking Aligned', 'EP Marking'] },
    { key: 'done', label: 'Done', stages: ['Electric/Plumbing Marking Done'] }] },
  { key: 'productionPrep', label: 'Production prep', subs: [
    { key: 'requested', label: 'Requested', stages: ['Prep. of Sign-off & Production Drawing'] },
    { key: 'planned', label: 'Planned', stages: ['Production Drawing', 'Final DWG', 'Stone Dwg', 'Mood Board / 3D', 'Create MPP'] },
    { key: 'done', label: 'Done', stages: ['Create Production Set', 'Start Production', 'Material Procurement', 'Precourement'] },
    { key: 'signoff', label: 'Sign-off', stages: ['Sent for Design Approval', 'Design Approval', 'Verification'] }] },
  { key: 'pdi', label: 'PDI', unit: 'visit', subs: [
    { key: 'requested', label: 'Requested', stages: ['Request Visit for PDI', 'Prepare PDI'] },
    { key: 'planned', label: 'Planned', stages: ['Align PDI'] },
    { key: 'done', label: 'Done', stages: ['PDI', 'PDI Done', 'PDI Verifiction'] }] },
  // "Payment Awaited" is NOT here: the blueprint routes it straight to Order Booked, which makes it a
  // pre-booking state and pre-design's "Order booked" card its home. Keeping it on both cards counted
  // the same 7 orders twice across two boards.
  { key: 'payment', label: 'Payment pending', subs: [
    { key: 'pending', label: 'Pending', stages: ['Sent for PDI payment Approval', 'Payment Approvals', 'Approval from Accounts'] },
    { key: 'done', label: 'Done', stages: ['PDI Payment Done'] }] },
  { key: 'factory', label: 'Sent to factory', subs: [], stages: ['Handover to Factory', 'Send PDI Drawings to Factory'] }
];

// Post-design work that is not one of the nine cards. Counted so the board still reconciles.
export const DEAL_POST_DESIGN_OTHER = [
  'Request Appliances from Client', 'Appliances Details', 'Schedule Meeting for Finishes',
  'Wall cladding', 'Sample Request'
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
const lower = (value) => String(value ?? '').trim().toLowerCase();

/** Every stage a step owns, sub-cards included, lowercased for matching. */
export function stagesOf(step) {
  const own = step.stages ?? [];
  const subs = (step.subs ?? []).flatMap((sub) => sub.stages ?? []);
  return [...own, ...subs].map(lower);
}

/** stage -> step key, for a list of steps. Built once per board rather than searched per record. */
export function stageIndexOf(steps) {
  const index = new Map();
  for (const step of steps) {
    for (const stage of step.stages ?? []) index.set(lower(stage), { step: step.key, sub: null });
    for (const sub of step.subs ?? []) {
      for (const stage of sub.stages ?? []) index.set(lower(stage), { step: step.key, sub: sub.key });
    }
  }
  return index;
}
