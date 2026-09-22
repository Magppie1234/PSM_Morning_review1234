// Splits raw leads into the funnel shown on the Pre Sales board:
//   Raw leads → Contacted | Not contacted
//   Contacted → Qualified, drawing awaited | Under follow-up | Not responding | Dropped / dead
//   → PSM qualified (drawing awaited, plus leads already past it: drawing received or converted)
//   → Sales qualified → Closed, which come from Zoho Contacts (see contactStages.js)
// Every lead lands in exactly one bucket; the 'qualified' bucket (past drawing awaited) has no card of its own
// and is counted straight into PSM qualified.

const AWAITING_DRAWINGS = /^qualified\s*\/\s*drawings?\s*aw/i; // Zoho spells it "Awiated"
const QUALIFIED = /^qualified\s*\/|drawing received|create opportunity|make opportunity|convert/i;
const DROPPED = /junk|not interested|lost lead|not qualified/i;
const NOT_RESPONDING = /no response|not responding|attempted to contact|call back later|\bcold\b/i;
const NOT_CONTACTED = /not contacted/i;

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

function node(leads, previous, raw, valueOf) {
  return {
    count: leads.length,
    value: leads.reduce((total, lead) => total + valueOf(lead), 0),
    share: raw ? leads.length / raw : 0,
    previous: previous.length,
    ids: leads.map((lead) => String(lead.id))
  };
}

// `current` and `previous` are raw Zoho leads already limited to their windows.
// `valueOf(lead)` is the lead's ₹ value. Sales qualified and Closed are added by contactStages.js.
export function buildLeadFlow(current, previous, previousLabel, valueOf = () => 0) {
  const pick = (list, keys) => list.filter((lead) => keys.includes(flowBucket(lead)));
  const raw = current.length;
  const add = (key, keys, filter = () => true) => {
    nodes[key] = node(pick(current, keys).filter(filter), pick(previous, keys).filter(filter), raw, valueOf);
  };
  const nodes = {};
  add('raw', [...CONTACTED_LEAVES, 'notContacted']);
  add('contacted', CONTACTED_LEAVES);
  add('notContacted', ['notContacted']);
  CONTACTED_LEAVES.forEach((key) => add(key, [key]));
  add('qualifiedTotal', QUALIFIED_LEAVES);

  const statuses = {};
  current.forEach((lead) => {
    const bucket = flowBucket(lead);
    const status = lead.Lead_Status ?? 'Status not recorded';
    statuses[bucket] = statuses[bucket] ?? {};
    statuses[bucket][status] = (statuses[bucket][status] ?? 0) + 1;
  });
  return { previousLabel, nodes, statuses };
}
