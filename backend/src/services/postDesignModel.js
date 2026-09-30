import { canonicalStage } from '../config/crmNames.js';

// THE POST-DESIGN MODEL, from Magppie-PostDesign-Dashboard/DATA-MAPPING-LOGIC.md (29 Sep 2026).
//
// That dashboard was built against this same Zoho org and its numbers pass twelve reconciliation
// checks before it is allowed to publish, so where its rules and this codebase disagreed, its rules
// win. This file is those rules; the board's own look is unchanged.
//
// What it adds that the stage cards cannot say on their own:
//
//   COHORT   an order counts once it has EVER entered a post-design stage — 875 orders, not the
//            ~500 sitting on one today. The rest have finished and left, and leaving them out made
//            every average a survey of unfinished work only.
//   START    the first "Assign Post - Designer" visit. Where there is none, the first post-design
//            stage the order entered, flagged `inferred` — never hidden.
//   END      the first TERMINAL stage entered at or after the start. "PDI Payment Done or beyond"
//            counts, because orders move past it within hours and an exact match would miss most.
//   TAT      end − start, from exact timestamps, for completed orders ONLY. An open order's running
//            time is reported separately and is never averaged in with it.

export const START_STAGE = 'Assign Post - Designer';
export const END_STAGE = 'PDI Payment Done';
export const SIGNOFF_STAGE = 'Prep. of Sign-off & Production Drawing';
export const HOLD_STAGE = 'Hold';

// Post-design proper is CRM sequence 18 to 35. Stages added to the process later sit outside that
// block and are listed by name, as are the newer parallel flow and Hold — all per the handoff's
// stage taxonomy. Sequence numbers are learned from the org at startup; this is the fallback.
const CORE_SEQ = [18, 35];

const SUPPORTING = [
  'Electric/Plumbing Marking Aligned', 'Electric/Plumbing Marking Done',
  'Electric/Plumbing Checking Done', 'Request for Electric Plumbing Checking',
  'Request for Electric and Plumbing Marking', 'Align Visit for Electrical / Plumbering',
  'Site Follow up', 'Site Follow up Done', 'Request for Site Visit', 'Align PDI',
  'Request Visit for PDI', 'PDI Done', 'PDI Verifiction', 'EP DWG', 'EP Marking', 'EP Verification',
  'Final DWG', 'Stone Dwg', 'Wall cladding', 'Precourement', 'PD Approvals',
  'Approval from Accounts', 'Appliances Details', 'Revisit Req-First Measurement',
  'Design Approved After First Meaurement', 'First Measurement', 'EPT', 'Production Drawing',
  'Mood Board / 3D', 'PDI', 'First Measurement / EPT /Production Drawing / Mood Board 3D / PDI'
];

// The newer parallel pipeline, plus Hold — which IS a post-design state here. 72 orders in the
// validated cohort reach post-design through Hold and nothing else, so excluding it loses them.
// "Handover to Post Design" is the literal entry point and belongs here — it was missing, and the
// 35 orders that separated this cohort from the validated one had touched no other post-design
// stage. The board's own stage cards already counted it under Handover, so the model was the odd
// one out.
const NEW_FLOW = [
  'Handover to Post Design', 'Verification', 'Design Approval', 'Sent for Design Approval', HOLD_STAGE
];

// TERMINAL means "PDI Payment Done OR BEYOND", and beyond is by the CRM's own sequence number, not
// by a hand-written list. Getting this wrong is easy and costly: "Sent for PDI payment Approval"
// (seq 33) and "Site Approved for Dispatch" (seq 34) sit BEFORE PDI Payment Done (seq 35) and are
// still inside post-design. Listing them as terminal closed 48 orders early and pulled the
// completed count to 231 against the validated 183.
//
// Learned from the org at startup; this list is the fallback and covers the stages that sit past
// the end of the numbered block.
const TERMINAL_FALLBACK = [
  END_STAGE, 'First Dipatch Done', 'Full Dispatch', 'Split Dispatch',
  'Sent for Second Dispatch Approval', 'Second Dispatch Approved', 'Second Dispatch Done',
  'Handover to Installation Team', 'Start First Installation Process', 'First Installation Done',
  'Start Second Installation Process', 'Second Installation Done', 'Final Handover', 'Complete',
  'Added Post Handover Payment', 'Raise Final Complaint', 'Complaint Material Dispatched',
  'Complaint Raised', 'Complaint Closed'
];

const lower = (value) => String(value ?? '').trim().toLowerCase();
const asSet = (list) => new Set(list.map(lower));

const SUPPORTING_SET = asSet(SUPPORTING);
const NEW_FLOW_SET = asSet(NEW_FLOW);
let TERMINAL_SET = asSet(TERMINAL_FALLBACK);

// Learned from the org's Stage picklist so the 18–35 block is the CRM's own numbering rather than
// a copy of it that can drift.
let coreByName = new Set();

/** @param {Array} pickListValues the Stage field's pick_list_values */
export function learnStageSequence(pickListValues = []) {
  const core = new Set();
  const endSeq = pickListValues
    .filter((value) => lower(value?.display_value) === lower(END_STAGE))
    .map((value) => Number(value?.sequence_number))
    .find(Number.isFinite);

  const terminal = new Set(TERMINAL_FALLBACK.map(lower));
  for (const value of pickListValues) {
    const seq = Number(value?.sequence_number);
    const label = String(value?.display_value ?? '').trim();
    if (!label || !Number.isFinite(seq)) continue;
    if (seq >= CORE_SEQ[0] && seq <= CORE_SEQ[1]) core.add(lower(label));
  }
  // TERMINAL IS NOT DERIVED FROM THE SEQUENCE NUMBER, and this is worth stating because it looks
  // like it should be. The picklist was extended twice, so a high number means "added later", not
  // "later in the process": Query to SM is seq 53, Form Filled 57, Modd Board 77 and Hold 84, all
  // of them plainly before the end. Taking seq >= 35 as terminal marked 549 orders complete against
  // the validated 183. The named list above is the authority.
  void endSeq;
  coreByName = core;
  TERMINAL_SET = terminal;
  return core.size;
}

/** Is this stage part of post-design at all? */
export function isPostDesignStage(stage) {
  const key = lower(canonicalStage(stage));
  if (!key) return false;
  return coreByName.has(key) || SUPPORTING_SET.has(key) || NEW_FLOW_SET.has(key);
}

export const isTerminalStage = (stage) => TERMINAL_SET.has(lower(canonicalStage(stage)));

const DAY = 86_400_000;
const daysBetween = (from, to) => {
  const span = (Date.parse(to) - Date.parse(from)) / DAY;
  return Number.isFinite(span) && span >= 0 ? span : null;
};

/**
 * One order's post-design life, from its stage-ledger history.
 *
 * @param {{entries: Array}} entry the record's history, oldest first and already de-duplicated
 * @returns {null|object} null when the order never entered post-design — it is not in the cohort
 */
export function postDesignLifeOf(entry, now = Date.now()) {
  const visits = entry?.entries ?? [];
  if (!visits.length) return null;

  // START. The explicit hand-off if there is one, otherwise the first post-design stage reached.
  const explicit = visits.find((visit) => lower(canonicalStage(visit.stage)) === lower(START_STAGE));
  const firstPost = visits.find((visit) => isPostDesignStage(visit.stage));
  if (!firstPost) return null;
  const start = explicit ?? firstPost;
  const startTier = explicit ? 'explicit' : 'inferred';

  // END. The first terminal stage entered at or after the start, so an order that touched a
  // dispatch stage before it reached post-design is not called complete by it.
  const startAt = Date.parse(start.enteredAt);
  const end = visits.find((visit) => isTerminalStage(visit.stage)
    && visit.enteredAt && Date.parse(visit.enteredAt) >= startAt);

  const current = visits.at(-1);
  const onHold = lower(canonicalStage(current?.stage)) === lower(HOLD_STAGE);

  return {
    startOn: start.enteredAt ?? null,
    startTier,
    endOn: end?.enteredAt ?? null,
    endStage: end ? canonicalStage(end.stage) : null,
    completed: Boolean(end),
    // Completed TAT and open running time are deliberately two different fields. The handoff's
    // rule, and one of its twelve validation checks, is that they are never averaged together.
    tat: end ? daysBetween(start.enteredAt, end.enteredAt) : null,
    openTat: end ? null : daysBetween(start.enteredAt, new Date(now).toISOString()),
    status: end ? 'Completed' : (onHold ? 'On Hold' : 'Open'),
    // Did the order reach the sign-off stage? The sq-ft tier needs this to call an area `actual`.
    reachedSignoff: visits.some((visit) => lower(canonicalStage(visit.stage)) === lower(SIGNOFF_STAGE)),
    stage: canonicalStage(current?.stage),
    stageEntry: current?.enteredAt ?? null
  };
}

/**
 * The sq-ft confidence tier. First rule that matches wins, and only `actual` and `post` are a real
 * measured area — everything below them is an estimate.
 *
 * Counted live across 7,629 orders: post 88, revision 191, design 2,018, order 706, nothing 5,227.
 */
export function sqftTierOf(deal, reachedSignoff) {
  const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
  const post = num(deal.Post_Cabinet_Area_Sqft) + num(deal.Post_Backsplash_Area_Sqft) + num(deal.Post_Countertop_Area_Sqft);
  if (post > 0) return { sqft: post, tier: reachedSignoff ? 'actual' : 'post' };
  const revision = num(deal.Revision_Cabinet_Area_Sqft) + num(deal.Revision_Backsplash_Area_Sqft) + num(deal.Revision_Countertop_Area_Sqft);
  if (revision > 0) return { sqft: revision, tier: 'revision' };
  const design = num(deal.Cabinet_Area_Sqft) + num(deal.Backsplash_Area_Sqft) + num(deal.Countertop_Area_Sqft);
  if (design > 0) return { sqft: design, tier: 'design' };
  const order = num(deal.Sqaure_Feet);
  if (order > 0) return { sqft: order, tier: 'order' };
  return { sqft: 0, tier: 'missing' };
}

/** A percentile of a sorted-able list, used for the TAT thresholds. */
export function percentile(values, p) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/**
 * The cohort's headline numbers. Thresholds come from the data — the warning level is the P75 of
 * completed TATs and the critical level the P90 — because the handoff invented no targets and
 * neither should this.
 */
export function summarise(lives) {
  const completed = lives.filter((life) => life.completed);
  const tats = completed.map((life) => life.tat).filter((value) => Number.isFinite(value));
  const open = lives.filter((life) => life.status === 'Open');
  const hold = lives.filter((life) => life.status === 'On Hold');
  const openTats = lives.filter((life) => !life.completed).map((life) => life.openTat).filter(Number.isFinite);
  const mean = (list) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null);
  return {
    cohort: lives.length,
    completed: completed.length,
    open: open.length,
    onHold: hold.length,
    startExplicit: lives.filter((life) => life.startTier === 'explicit').length,
    startInferred: lives.filter((life) => life.startTier === 'inferred').length,
    // Completed only. Never mixed with the open running times below.
    tatMean: mean(tats),
    tatMedian: percentile(tats, 50),
    tatWarn: percentile(tats, 75),
    tatCritical: percentile(tats, 90),
    tatMeasured: tats.length,
    openMean: mean(openTats),
    openMeasured: openTats.length
  };
}
