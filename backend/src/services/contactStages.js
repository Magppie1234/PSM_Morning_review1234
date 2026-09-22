// The funnel's last two stages come from Zoho Contacts (qualified opportunities), exactly as the
// Executive Command Centre counts them:
//   Sales qualified  Contacts created in the period whose Sales_Manager (the PSM) is in scope
//   Closed           Contacts with Client Status "Closed", dated by Actual_Closure_Date
// Test records (a name containing the word "test") are left out, as there.
const LAKH = 1e5;
const psmOf = (contact) => contact.Sales_Manager?.name ?? '';
const isRealRecord = (contact) => !/\btest\b/i.test(contact.Full_Name ?? '');
const valueOf = (contact) => (Number(contact.Total_Opportunity_Value) || 0) * LAKH;
const closedOn = (contact) => contact.Actual_Closure_Date ?? null;

// Validation stage, from Client Status: blank or "Not Yet Validated" means the SM has not validated it yet.
const DONE = /^(dead|closed)$/i;
export const isPendingValidation = (contact) =>
  !DONE.test(contact.Client_Status ?? '') && (!contact.Client_Status || /not\s*yet\s*validated/i.test(contact.Client_Status));

function stage(current, previous, raw, extra = {}) {
  return {
    count: current.length,
    share: raw ? current.length / raw : 0,
    previous: previous.length,
    value: current.reduce((total, contact) => total + valueOf(contact), 0),
    ids: current.map((contact) => String(contact.id)),
    ...extra
  };
}

// `contacts` were created since the comparison period began; `closed` are all Closed contacts.
// `inScope(name)` says whether a PSM is in view; `raw` is the funnel's raw lead count, for "% of raw".
export function buildContactStages({ tf, contacts, closed, inScope, raw }) {
  const mine = (list) => (list ?? []).filter((contact) => isRealRecord(contact) && inScope(psmOf(contact)));
  const opened = mine(contacts);
  const done = mine(closed);
  const salesNow = opened.filter((contact) => tf.matches(contact.Created_Time));
  const closedNow = done.filter((contact) => closedOn(contact) && tf.matches(closedOn(contact)));
  return {
    available: contacts !== null,
    nodes: {
      toSm: stage(salesNow, opened.filter((contact) => tf.previousMatches(contact.Created_Time)), raw, {
        pending: salesNow.filter(isPendingValidation).length
      }),
      closed: stage(closedNow, done.filter((contact) => closedOn(contact) && tf.previousMatches(closedOn(contact))), raw)
    },
    records: [...salesNow, ...closedNow.filter((contact) => !salesNow.includes(contact))]
  };
}
