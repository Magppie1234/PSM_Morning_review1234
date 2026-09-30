import { OTHER_CITY_KEY, cityRows } from '../config/salesFunnel.js';

// Splits raw leads into the funnel shown on the Pre Sales board:
//   Raw leads → Contacted | Not contacted
//   Contacted → Qualified, drawing awaited | Under follow-up | Not responding | Dropped / dead
//   → PSM qualified (drawing awaited, plus leads already past it: drawing received or converted)
//   → Sales qualified → Closed, which come from Zoho Contacts (see contactStages.js)
// Every lead lands in exactly one bucket; the 'qualified' bucket (past drawing awaited) has no card of its own
// and is counted straight into PSM qualified.
// Every node carries { count, value, share, previous, ids, byCity }. `byCity` is three rows —
// DEL / HYD / OTHER — always all three even when one is empty, each { key, label, count, value,
// valueLabel, ids }; they partition the node, so they sum back to its count and its value.

const AWAITING_DRAWINGS = /^qualified\s*\/\s*drawings?\s*aw/i; // Zoho spells it "Awiated"
const QUALIFIED = /^qualified\s*\/|drawing received|create opportunity|make opportunity|convert/i;
const DROPPED = /junk|not interested|lost lead|not qualified/i;
const NOT_RESPONDING = /no response|not responding|attempted to contact|call back later|\bcold\b/i;
const NOT_CONTACTED = /not contacted/i;

/**
 * Does this Lead_Status value mean the lead was qualified?
 *
 * Exported because the PSM qualified card is no longer answered from the CURRENT status alone — see
 * `everQualified` below — and leadMapper.js has to ask the same question of every status a lead has
 * ever held, out of Lead_Status_History.
 */
export const isQualifiedStatus = (status) => {
  const value = String(status ?? '');
  return AWAITING_DRAWINGS.test(value) || QUALIFIED.test(value);
};

export function flowBucket(lead) {
  const status = String(lead.Lead_Status ?? '');
  // A converted lead became an opportunity, so it is qualified even if its old status was never updated.
  if (lead.Converted__s === true) return 'qualified';
  if (NOT_CONTACTED.test(status)) return 'notContacted';
  if (AWAITING_DRAWINGS.test(status)) return 'drawingAwaited';
  if (QUALIFIED.test(status)) return 'qualified';
  if (DROPPED.test(status)) return 'dropped';
  if (NOT_RESPONDING.test(status)) return 'notResponding';
  return 'followUp';
}

const CONTACTED_LEAVES = ['qualified', 'drawingAwaited', 'followUp', 'notResponding', 'dropped'];
const QUALIFIED_LEAVES = ['qualified', 'drawingAwaited'];

function node(leads, previous, raw, { valueOf, labelOf, cityKeyOf }) {
  const total = (list) => list.reduce((sum, lead) => sum + valueOf(lead), 0);
  const ids = (list) => list.map((lead) => String(lead.id));
  return {
    count: leads.length,
    value: total(leads),
    share: raw ? leads.length / raw : 0,
    previous: previous.length,
    ids: ids(leads),
    // Delhi / Hyderabad / Others, always all three even when one is empty, because the card under this
    // node draws three numbers whatever the data holds. They partition the node, so they sum back to
    // its own count and value. Leads carry a free-text City and most recent ones carry none at all,
    // so a large Others row here is the CRM's data-entry gap, not a sales fact.
    byCity: cityRows(leads, (mine, row) => ({ ...row, count: mine.length, value: total(mine), valueLabel: labelOf(total(mine)), ids: ids(mine) }), cityKeyOf)
  };
}

/**
 * `current` and `previous` are raw Zoho leads already limited to their windows.
 * `valueOf(lead)` is the lead's ₹ value, `labelOf(value)` writes it the way the board does, and
 * `cityKeyOf(lead)` gives the lead's DEL / HYD / OTHER bucket — decided by the caller, across every
 * lead and contact in view at once, so both halves of the funnel bucket the same spellings the same way.
 * Sales qualified and Closed are added by contactStages.js.
 */
export function buildLeadFlow(current, previous, previousLabel, options = {}) {
  const shape = {
    valueOf: () => 0,
    labelOf: () => '—',
    cityKeyOf: () => OTHER_CITY_KEY,
    // Did this lead EVER reach a qualified status, per Lead_Status_History? Defaults to "no history
    // available", which falls the card back to its old current-status-only behaviour rather than
    // silently reporting a smaller number.
    everQualified: () => false,
    ...options
  };
  const pick = (list, keys) => list.filter((lead) => keys.includes(flowBucket(lead)));
  const raw = current.length;
  const add = (key, keys, filter = () => true) => {
    nodes[key] = node(pick(current, keys).filter(filter), pick(previous, keys).filter(filter), raw, shape);
  };
  const nodes = {};
  add('raw', [...CONTACTED_LEAVES, 'notContacted']);
  add('contacted', CONTACTED_LEAVES);
  add('notContacted', ['notContacted']);
  CONTACTED_LEAVES.forEach((key) => add(key, [key]));

  // PSM QUALIFIED — the one card on this funnel that is NOT a snapshot of where leads sit now.
  //
  // The four outcome cards above are a partition: a lead is in exactly one of them, and they sum
  // back to Contacted, which is what the bracket between them means. That partition is correct and
  // is left alone.
  //
  // "PSM qualified" is a different question — how many leads the PSM got as far as qualifying — and
  // asking it of the current status undercounts, because a lead that qualified and later went to
  // "Not Interested" now sits in `dropped` and disappears from it. Measured on September's 1,192
  // leads: 255 by current status, 278 by history. Twenty-three qualified leads were not being
  // credited, fourteen of them because the client later went cold, which does not un-qualify the
  // work the PSM did.
  //
  // So this card is the union of "sitting at a qualified status now" and "ever entered one", from
  // Lead_Status_History. It is deliberately NOT part of the partition above and may overlap it.
  const everQualified = (list) => list.filter((lead) =>
    QUALIFIED_LEAVES.includes(flowBucket(lead)) || shape.everQualified(lead));
  nodes.qualifiedTotal = node(everQualified(current), everQualified(previous), raw, shape);

  const statuses = {};
  current.forEach((lead) => {
    const bucket = flowBucket(lead);
    const status = lead.Lead_Status ?? 'Status not recorded';
    statuses[bucket] = statuses[bucket] ?? {};
    statuses[bucket][status] = (statuses[bucket][status] ?? 0) + 1;
  });
  return { previousLabel, nodes, statuses };
}
