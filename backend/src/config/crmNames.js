// NAME AND STAGE NORMALISATION, taken from the two handoff packs dated 29 September 2026
// (Magppie-PostDesign-Dashboard and Magppie-Designer-MIS-handoff). Those two dashboards were built
// against the same Zoho org, validated against it, and their DATA-MAPPING-LOGIC.md files are the
// authority for everything in this file. Where their rules and this codebase disagreed, they win.

// ---------------------------------------------------------------------------
// Designers — one person, one name
// ---------------------------------------------------------------------------
// The CRM's Designer Name picklist holds the same person under several spellings, and counted live
// the split is severe: Atif 54 / Atif Hussain 256, Vishal 60 / Vishal Dubey 236, Rishabh 49 /
// Rishab 49 / Rishabh Butar 198, Pravalika 6 / Pravallika 46, Jyoti Sharma 53 / Jyoti 198.
// Without this map a designer's work is scattered across two or three slices of the same chart and
// every per-designer average is wrong.
//
// Straight from Magppie-PostDesign-Dashboard/config.json → designerAliases.
const DESIGNER_ALIASES = {
  atif: 'Atif Hussain',
  vishal: 'Vishal Dubey',
  rishab: 'Rishabh Butar',
  rishabh: 'Rishabh Butar',
  'rishab butar': 'Rishabh Butar',
  pravalika: 'Pravallika',
  'jyoti sharma': 'Jyoti',
  'anubha g': 'Anubha',
  'pinki zoho': 'Pinki'
};

const clean = (value) => String(value ?? '').trim();

/** The designer's canonical name. Blank and "-None-" come back as ''. */
export function canonicalDesigner(name) {
  const value = clean(name);
  if (!value || value === '-None-') return '';
  return DESIGNER_ALIASES[value.toLowerCase()] ?? value;
}

// Hidden or inactive designers. The Designer MIS drops their orders outright; this board keeps the
// orders — they are real work and dropping them would make the funnel stop reconciling — but the
// list is here so a designer breakdown can leave them out if that is ever wanted.
export const INACTIVE_DESIGNERS = new Set(['Kavita', 'Nishtha', 'Saif']);

// ---------------------------------------------------------------------------
// The sales manager — four sources, in order
// ---------------------------------------------------------------------------
// The Orders module has no sales-manager field, so the SM is resolved off the linked client, with
// two fallbacks. Measured on their own 875-order cohort the fallbacks carry most of the weight:
// Client PSM 219, Client Sales Person 471, Order Owner 185 — so stopping at the first source, as
// this board did, left roughly three quarters of orders unattributed.
//
// The integration user owns most of the imported records and is never a real manager, so it is
// skipped at every step rather than being allowed to win.
export const INTEGRATION_USER = 'Magppie Living Private Limited';

/**
 * @param {{psm?: string, owner?: string}} client the linked contact's Sales_Manager and Owner
 * @param {string} orderOwner Deals.Owner
 * @returns {{name: string, source: string}} '' and 'unassigned' when nothing resolves
 */
export function resolveSalesManager(client, orderOwner) {
  const usable = (value) => {
    const name = clean(value);
    return name && name !== INTEGRATION_USER ? name : '';
  };
  const psm = usable(client?.psm);
  if (psm) return { name: psm, source: 'Client PSM' };
  const owner = usable(client?.owner);
  if (owner) return { name: owner, source: 'Client Sales Person' };
  const order = usable(orderOwner);
  if (order) return { name: order, source: 'Order Owner' };
  return { name: '', source: 'unassigned' };
}

// ---------------------------------------------------------------------------
// Stage values — the label is not always what is stored
// ---------------------------------------------------------------------------
// Twenty stages in this org store an `actual_value` different from the label users see, and the
// handoff calls this out as the trap that produces wrong numbers: "Designer Assigned" is stored as
// "Closed Lost to Competition" and "Order Booked" as "Closure". The records API normally returns
// the label — but not always. Checked live, "PDI" (the stored form of "PDI Done") does come back
// from Deals.Stage.
//
// So every stage value is pushed through this map before it is matched. It is built once from the
// picklist at startup; STORED_STAGE_FALLBACK covers the cases that matter if that read ever fails.
const STORED_STAGE_FALLBACK = {
  'closed lost to competition': 'Designer Assigned',
  closure: 'Order Booked',
  'assign designer': 'None',
  'electric/plumbing checking': 'Electric/Plumbing Marking Aligned',
  pdi: 'PDI Done',
  'requirement from sm': 'Query to SM',
  'mood board selection(client) request': 'Modd Board Selection(Client) Request',
  'mood board selection approved': 'Modd Board Selection Approved'
};

let storedToLabel = new Map(Object.entries(STORED_STAGE_FALLBACK));

/**
 * Teach the mapper the org's real picklist. Called once at startup with the Stage field's
 * pick_list_values; anything it cannot read leaves the fallback above in place.
 */
export function learnStageValues(pickListValues = []) {
  const map = new Map(Object.entries(STORED_STAGE_FALLBACK));
  for (const value of pickListValues) {
    const stored = clean(value?.actual_value);
    const label = clean(value?.display_value);
    if (stored && label && stored !== label) map.set(stored.toLowerCase(), label);
  }
  storedToLabel = map;
  return map.size;
}

/** The display label for a stage, whichever form Zoho returned. */
export function canonicalStage(stage) {
  const value = clean(stage);
  if (!value) return '';
  return storedToLabel.get(value.toLowerCase()) ?? value;
}
