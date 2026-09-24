import { PSM_NAMES } from './roster.js';

// Every rule behind the Sales board's "Lead generation" and "Sales performance" sections, in one place,
// so one edit here changes every card. Qualified leads live in Zoho Contacts (UI label "Qualified Leads");
// the field names below are that module's API names.

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const lower = (value) => clean(value).toLowerCase();

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------
// Contacts.City is free text, mixed case, and blank on roughly one record in six. (City_Name is always
// empty, so it is ignored.) The business reads the board as Delhi / Hyderabad / everything else, so each
// bucket carries the spellings and the satellite towns its team actually sells into.
// Matching is case-insensitive and trim-safe, exact first, then on a whole word, so "South Delhi" and
// "Gurgaon, Haryana" still land in DEL.
export const CITY_BUCKETS = [
  { key: 'DEL', label: 'Delhi (DEL)', aliases: ['delhi', 'new delhi', 'delhi ncr', 'gurgaon', 'gurugram', 'noida', 'ghaziabad', 'faridabad'] },
  { key: 'HYD', label: 'Hyderabad (HYD)', aliases: ['hyderabad', 'secunderabad'] },
  // Everything that matches neither bucket, including a blank city, falls here.
  { key: 'OTHER', label: 'Others', aliases: [] }
];

export const OTHER_CITY_KEY = 'OTHER';
export const CITY_KEYS = CITY_BUCKETS.map((bucket) => bucket.key);
export const cityLabelOf = (key) => CITY_BUCKETS.find((bucket) => bucket.key === key)?.label ?? 'Others';

// One whole-word pattern per bucket, built from the alias list above so there is nothing else to edit.
const CITY_PATTERNS = CITY_BUCKETS
  .filter((bucket) => bucket.aliases.length)
  .map((bucket) => ({ key: bucket.key, exact: new Set(bucket.aliases), word: new RegExp(`\\b(${bucket.aliases.join('|')})\\b`, 'i') }));

export function cityBucketOf(city) {
  const value = lower(city);
  if (!value) return OTHER_CITY_KEY;
  return CITY_PATTERNS.find((bucket) => bucket.exact.has(value) || bucket.word.test(value))?.key ?? OTHER_CITY_KEY;
}

// The key a single city name is listed under inside "Others", and the label shown for it. Spellings vary
// in the CRM ("banglore", "Bangalore"), so the key is the normalised name and the label is title case.
export const CITY_NOT_RECORDED = 'unknown';
export const cityNameKeyOf = (city) => lower(city) || CITY_NOT_RECORDED;
export const cityNameLabelOf = (city) =>
  clean(city).replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) || 'City not recorded';

// ---------------------------------------------------------------------------
// One spelling per city
// ---------------------------------------------------------------------------
// City is free text, so the same place arrives spelled several ways and the dropdown fills up with
// duplicates. Two steps fix that: tidy each value on its own (below), then merge the near-misses across
// the whole batch (mergeCityNames). The raw value is kept on every record as `cityRaw`.
// The DEL / HYD / OTHER bucketing reads the TIDIED name, so a lead typed "Hydrabad" or "Gurgoan" counts
// under Hyderabad or Gurgaon instead of dropping into Others — the same principle as folding it to one
// entry in the dropdown. Add a spelling to CITY_ALIASES and nothing else needs touching.
//
// NOT attempted here: mapping a locality to its city (Pitampura, Punjabi Bagh, GK-1, Noida sector 44 are
// all really Delhi or Gurgaon). That is a much larger judgement call, it would move records between the
// DEL / HYD / OTHER buckets, and nobody has asked for it.

// Spellings that tidying alone cannot reach, because they differ too early in the word for the merge
// rule to touch them safely. Keys are lowercase; values are the spelling to display.
export const CITY_ALIASES = {
  // Same city, official name vs the one the business uses. Gurgaon and Bangalore win on frequency here.
  bengaluru: 'Bangalore',
  bangaluru: 'Bangalore',
  gurugram: 'Gurgaon',
  // Delhi, written several ways.
  'new delhi': 'Delhi',
  'delhi ncr': 'Delhi',
  ncr: 'Delhi',
  'sauth delhi': 'South Delhi',
  // Misspellings whose first letters differ, so the fuzzy pass will not join them.
  lakhnow: 'Lucknow',
  muradabad: 'Moradabad',
  kalkatta: 'Kolkata',
  calcutta: 'Kolkata',
  bhatinda: 'Bathinda',
  kerela: 'Kerala',
  // Vizag and its long form.
  vizag: 'Visakhapatnam',
  vishakhapatnam: 'Visakhapatnam',
  vishakapatnam: 'Visakhapatnam',
  vishakapatanam: 'Visakhapatnam',
  baroda: 'Vadodara',
  vadodra: 'Vadodara',
  mysuru: 'Mysore',
  trivandrum: 'Thiruvananthapuram'
};

// A trailing state is dropped so "Guntur. Andhra Pradesh" and "guntur" become one entry. Delhi is not in
// this list on purpose: it is a city as often as a region here, and "Kirti Nagar, Delhi" would otherwise
// lose the only clue it carries.
const STATE_SUFFIXES = [
  'andhra pradesh', 'andra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chattisgarh', 'chhattisgarh',
  'chatishgad', 'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'karnatka',
  'kerala', 'kerela', 'madhya pradesh', 'mp', 'maharashtra', 'maharastra', 'odisha', 'orissa', 'punjab',
  'panjab', 'rajasthan', 'tamil nadu', 'tamilnadu', 'telangana', 'uttar pradesh', 'up', 'uttarakhand',
  'utrakhand', 'uttrakhand', 'west bengal'
];
const STATE_SUFFIX_MATCH = new RegExp(`[\\s,.]+(?:${STATE_SUFFIXES.join('|')})$`, 'i');

// Tidy one value on its own: collapse spacing, drop stray punctuation, drop a trailing state, title-case,
// then apply the alias table. Deterministic, so it does not depend on what else is in the batch.
export function canonicalCityName(city) {
  const tidied = clean(city).replace(/^[\s,.\-/]+|[\s,.\-/]+$/g, '');
  if (!tidied) return '';
  const withoutState = tidied.replace(STATE_SUFFIX_MATCH, '').trim() || tidied;
  // Lowercase first, so "BANGLORE" and "HYDERABAD" come out as ordinary words rather than staying shouty
  // and winning the merge below on frequency.
  const titled = withoutState.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return CITY_ALIASES[titled.toLowerCase()] ?? titled;
}

// How far the fuzzy pass may go. Every threshold here was set by testing against the live data, and each
// one is carrying a real example:
//   prefix       Raipur and Jaipur are ONE edit apart and are different cities, as are Karnal and
//                Kurnool. Requiring the first two characters to agree is what keeps them apart.
//   maxDistance  one edit, counting a swapped pair of letters as one (Gurgoan / Gurgaon, Ahemdabad /
//                Ahmedabad). At two it merges Raichur into Raipur and Rajkori into Rajkot, which are
//                different places. The cost is that a rare two-edit misspelling is left alone; add it
//                to CITY_ALIASES above if it matters.
//   sameDigits   a name containing a number only merges with one carrying the same number. Without this
//                Noida Sector 44 swallows Sector 50, and GK - 1 swallows GK - 2.
//   minWinner    a spelling must appear at least this often before it may absorb another, so two rare
//                names (Bhiwani and Bhiwadi, one edit apart) are never merged into each other.
//   maxLoserShare  the absorbed spelling must be clearly the rarer one. Two names that are both common
//                are left alone, which is the customer's instruction and the safer way to be wrong.
export const CITY_MERGE = { prefix: 2, maxDistance: 1, minWinner: 3, maxLoserShare: 0.5 };

const compareKey = (name) => lower(name).replace(/[^a-z0-9]/g, '');
const digitsOf = (key) => (key.match(/\d+/g) ?? []).join('-');

// Damerau-Levenshtein: like the usual edit distance, but two letters typed the wrong way round count as
// one mistake, which is how most of these misspellings actually happen.
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > CITY_MERGE.maxDistance) return CITY_MERGE.maxDistance + 1;
  const rows = [[...Array(b.length + 1).keys()]];
  for (let i = 1; i <= a.length; i += 1) {
    rows[i] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/**
 * Works out which spellings should fold into which, given how often each one appears.
 * `counts` is a Map of display name to how many records carry it; the result maps a spelling that
 * should be replaced to the spelling to show instead. Names not in the result stay as they are.
 */
export function mergeCityNames(counts) {
  // Commonest first, so the spelling people actually use becomes the one that absorbs the others.
  const ordered = [...counts.entries()]
    .filter(([name]) => name)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const merged = new Map();
  const winners = [];
  ordered.forEach(([name, count]) => {
    const key = compareKey(name);
    if (!key) return;
    const digits = digitsOf(key);
    const winner = winners.find((candidate) => {
      // Same letters and same numbers, differing only in spacing or punctuation ("Gk - 1" and "Gk 1").
      // That is the same place by definition, so it merges whatever the frequencies look like.
      if (candidate.key === key) return true;
      return candidate.key.slice(0, CITY_MERGE.prefix) === key.slice(0, CITY_MERGE.prefix)
        && candidate.digits === digits
        && candidate.count >= CITY_MERGE.minWinner
        && count <= candidate.count * CITY_MERGE.maxLoserShare
        && editDistance(candidate.key, key) <= CITY_MERGE.maxDistance;
    });
    if (winner) merged.set(name, winner.name);
    else winners.push({ name, key, digits, count });
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Lead sources
// ---------------------------------------------------------------------------
// Contacts.Lead_Source is a picklist with more than thirty live values. The board shows only the four
// channels the sales team is measured on; everything else is summed into "Other sources".
export const SOURCE_BUCKETS = [
  { key: 'architect', label: 'Architect', values: ['architect', 'arch. data'] },
  { key: 'walkin', label: 'Walk-ins', values: ['walk in'] },
  { key: 'referral', label: 'Referrals', values: ['referral', 'employee referral', 'external referral', 'employee reference', "sunrooof's referral form"] },
  { key: 'adglobal', label: 'Ad global', values: ['adglobal new', 'adglobal old'] }
];

export const OTHER_SOURCE = { key: 'other', label: 'Other sources' };
export const sourceLabelOf = (key) =>
  SOURCE_BUCKETS.find((bucket) => bucket.key === key)?.label ?? OTHER_SOURCE.label;

const SOURCE_LOOKUP = new Map(SOURCE_BUCKETS.flatMap((bucket) => bucket.values.map((value) => [value, bucket.key])));

export const sourceBucketOf = (source) => SOURCE_LOOKUP.get(lower(source)) ?? OTHER_SOURCE.key;

// ---------------------------------------------------------------------------
// Who qualified the lead
// ---------------------------------------------------------------------------
// Read straight off Contacts.Sales_Manager (UI label "PSM"): the field is filled on every record, but
// only some hold one of the four real PSMs and the rest hold the sales person's own name, which is the
// CRM's way of saying nobody from the PSM team handed this lead over.
// This replaces an earlier rule that guessed from the lead source. A September audit showed the two
// disagree on 39 of 72 qualified records, and the source rule counted 245 of 245 leads as PSM work when
// the PSM field says 149 — so the field is used directly and nothing is inferred.
// Display order is PSM first, then self.
export const QUALIFIED_BY = [
  { key: 'psm', label: 'PSM qualified' },
  { key: 'self', label: 'Self qualified' }
];

export const qualifiedByLabelOf = (key) =>
  QUALIFIED_BY.find((entry) => entry.key === key)?.label ?? QUALIFIED_BY[0].label;

// `psmName` is Contacts.Sales_Manager.name. PSM_NAMES is the single roster the whole API shares, so a
// change of team is made there and not here.
export const qualifiedByOf = (psmName) => (PSM_NAMES.has(clean(psmName)) ? 'psm' : 'self');

// ---------------------------------------------------------------------------
// The S1 to S6 ladder
// ---------------------------------------------------------------------------
// THE CUSTOMER STILL HAS TO CONFIRM THIS MAPPING. They asked for stages "S1 to S5 plus S6 = principal",
// but no S1..S6 field exists anywhere in their Zoho (every module, field label and picklist was checked).
// Contacts.Client_Status (UI label "Current Stage") is the only ladder that fits, and its sixth step is
// literally "Principally Closed". Change the rows below and every card on the board follows.
export const STAGES = [
  // Most of S1 is records with no Current Stage at all rather than one actively marked "Not Yet
  // Validated", so the label says both and the card carries a note with the split for the current filter.
  { key: 'S1', short: 'S1', label: 'Not Yet Validated or not set', match: /^$|not\s*yet\s*validated/i },
  { key: 'S2', short: 'S2', label: 'Only Validated', match: /^only\s*validated/i },
  { key: 'S3', short: 'S3', label: 'Validated But Design Open', match: /validated\s*but\s*design\s*open/i },
  { key: 'S4', short: 'S4', label: 'Design Open + Price Open', match: /design\s*open\s*\+?\s*price\s*open/i },
  { key: 'S5', short: 'S5', label: 'Design Closed + Price Open', match: /design\s*closed\s*\+?\s*price\s*open/i },
  { key: 'S6', short: 'S6', label: 'Principally Closed', match: /principal/i }
];

// The ladder's last step, and the one bucket that leaves it. Both are tested before the ladder so that
// "Closed" is never read as the tail of "Design Closed + Price Open".
export const CLOSED_STAGE = { key: 'closed', label: 'Closed', match: /^closed$/i };
// What the board calls that card. The Zoho value stays "Closed" above, so a record's own stage still
// reads as the CRM has it; only the card is named the way the sales team talks about it.
export const CLOSED_CARD_LABEL = 'Order Booked';
export const DEAD_STAGE = { key: 'DEAD', label: 'Dead', match: /^dead$/i };

// S1 to S5 get a card each, S6 stands alone as "principal", and the first five are the open pipeline.
export const LADDER_STAGES = STAGES.slice(0, 5);
export const PRINCIPAL_STAGE = STAGES[5];

export function stageKeyOf(clientStatus) {
  const value = clean(clientStatus);
  if (DEAD_STAGE.match.test(value)) return DEAD_STAGE.key;
  if (CLOSED_STAGE.match.test(value)) return CLOSED_STAGE.key;
  // A blank Current Stage is common (over half the records) and means the same as "Not Yet Validated",
  // which is what S1 matches on an empty string. An unrecognised value lands there too, so no record is lost.
  return STAGES.find((stage) => stage.match.test(value))?.key ?? 'S1';
}

export function stageLabelOf(key) {
  if (key === DEAD_STAGE.key) return DEAD_STAGE.label;
  if (key === CLOSED_STAGE.key) return CLOSED_STAGE.label;
  return STAGES.find((stage) => stage.key === key)?.label ?? STAGES[0].label;
}

// Whether Current Stage is actually filled in. S1 absorbs both the blank and the "Not Yet Validated"
// records, and the board reports how many of each so the card cannot be read as more certainty than
// the CRM holds.
export const hasStageSet = (clientStatus) => Boolean(clean(clientStatus));

// A lead is "qualified" once it is past S1, and not dead.
export const isQualifiedStage = (key) => key !== 'S1' && key !== DEAD_STAGE.key;
// Open pipeline: still on the ladder, neither closed nor dead.
export const isOpenStage = (key) => key !== CLOSED_STAGE.key && key !== DEAD_STAGE.key;

// ---------------------------------------------------------------------------
// Est. Closure Date
// ---------------------------------------------------------------------------
// Contacts.Est_Closoure_Date (UI label "Est. Closure Date") — the CRM's own spelling, typo included.
// Two cards read it, and neither can be built from the leads created in the period: of the 207 records
// carrying a September estimate, only 12 were created in September. So it gets its own Zoho read, and
// this is where that read starts. The oldest estimate in the data is 2024, so this is effectively "all".
export const EST_CLOSURE_FLOOR = '2000-01-01';

// The card names the period it is showing, so it never says "month" while a week is on screen.
const EST_CLOSURE_PERIOD = {
  daily: 'yesterday',
  'this-week': 'this week',
  weekly: 'last week',
  monthly: 'this month',
  quarterly: 'this quarter'
};
// A custom range and the older day windows have no natural name, so they fall back to "this period".
export const estClosureLabelOf = (kind) => `Est. closure for ${EST_CLOSURE_PERIOD[kind] ?? 'this period'}`;
export const OVERDUE_LABEL = 'Overdue orders';

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------
// Product_Requirement is a multiselect and Product_Type a picklist; both are blank on most records
// (roughly 75% and 79%), so an empty product is normal and the UI shows "Not recorded" for it.
// The customer asked for Sunrooof to be left out of the product column. The CRM spells it Sunrooof,
// Sunroof and SUNROOOF, so the pattern is relaxed about how many o's it has — but only that entry is
// dropped, never the record itself.
const SUNROOOF = /sun\s*ro+f/i;

export function productOf(contact) {
  const requirement = Array.isArray(contact?.Product_Requirement)
    ? contact.Product_Requirement
    : String(contact?.Product_Requirement ?? '').split(';');
  const chosen = requirement.some((entry) => clean(entry)) ? requirement : [contact?.Product_Type];
  const parts = chosen.map(clean).filter(Boolean).filter((entry) => !SUNROOOF.test(entry));
  return [...new Set(parts)].join(' + ');
}

// ---------------------------------------------------------------------------
// Handover
// ---------------------------------------------------------------------------
// Read off Contacts.Stage (UI label "Status", the process steps). The customer said handover is really
// marked when the 50% payment is done, but that payment field has not been identified in Zoho yet, so
// this status value is the stand-in until it is.
export const HANDOVER_MATCH = /handover\s*to\s*post\s*design/i;
export const HANDOVER_LABEL = 'Handover to design';

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
// Total_Opportunity_Value is the formula field "Value(₹ Lacs)" and only fills once Sales_Person_s_Value
// is entered, so roughly a third of live records have none. Amount ("BD Value") is filled on nearly every
// record and, checked against live data, is on the same lakh scale (medians 18 and 20) despite its name.
// Both are therefore multiplied by a lakh; flip AMOUNT_IN_LAKHS to false if the CRM ever switches Amount
// to rupees.
export const LAKH = 1e5;
export const AMOUNT_IN_LAKHS = true;

export function valueOf(contact) {
  const opportunity = Number(contact?.Total_Opportunity_Value);
  if (Number.isFinite(opportunity) && opportunity > 0) return opportunity * LAKH;
  const amount = Number(contact?.Amount);
  if (Number.isFinite(amount) && amount > 0) return amount * (AMOUNT_IN_LAKHS ? LAKH : 1);
  return 0;
}

// Records whose name contains the word "test" are staff experiments, left out here exactly as
// services/contactStages.js leaves them out of the Pre Sales funnel.
export const isRealRecord = (contact) => !/\btest\b/i.test(contact?.Full_Name ?? '');
