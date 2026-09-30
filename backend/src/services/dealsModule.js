import { zohoGet } from './zohoClient.js';

// ONE READ OF THE ORDERS MODULE, SHARED.
//
// The Post Design queue and the Dispatch board both need every order in Zoho, and until this file
// existed they each fetched the module separately — 7,687 records over 39 pages, twice, with two
// different field lists and therefore two different cache keys. Measured: 12.6s and 11.9s, for the
// same rows. Whichever board you opened second paid full price again.
//
// The fix is one function with the UNION of both field sets, so both boards hit the same cache
// entry and the second one is free. Adding a field here costs every caller a little payload; it is
// still far cheaper than a second pass over the module.
//
// PAGING. Zoho serves the first 2,000 records by page number and everything after that by an opaque
// page token, which has to be walked in order. So the first ten pages go out in parallel — they are
// independent URLs — and only the tail is sequential. On this module that turns 39 round trips into
// 1 burst plus 29, which is where most of the saving comes from.
const FIELDS = [
  // Identity and routing, wanted by both boards
  'Deal_Name', 'Owner', 'Stage', 'city', 'Created_Time', 'Value',
  'Designer_Name', 'Product_Type',
  // Post Design
  'Sqaure_Feet', 'Cabinet_Area_Sqft', 'Send_For_Approval_Date', 'Number_of_Design_Revisions',
  // Dispatch
  'MRP_No', 'Dispatch_Date',
  // Installation. Est_Handover_Date is the only due date the CRM keeps for installation, and it was
  // missing here — which made the "Installation due" card read zero for every order rather than for
  // the 129 that carry one. A field absent from this list is not a blank field, it is an unasked
  // question, so check here first when a card is unexpectedly empty.
  'Installation_Managers', 'Actual_installation_start_date', 'Est_Handover_Date', 'Handover_Date',
  'Site_Measurement_Person',
  // Site_Not_Ready_Reason DOES NOT EXIST IN ZOHO YET. It is asked for anyway because Zoho answers an
  // unknown field name by leaving it out of the row rather than failing the request (probed against
  // the live org), so the column is plumbed now and fills itself the day the field is created. If
  // that behaviour ever changes, this is the line that will take every board down with it.
  'Site_Not_Ready_Reason'
].join(',');

// Zoho's own ceiling on page-number paging: 10 pages of 200.
const PAGE_LIMIT = 10;
const PER_PAGE = 200;
const MAX_TOKEN_PAGES = 45;

/**
 * Every order in the module, with the fields both boards need.
 *
 * Cached by zohoGet per page, so a second caller inside the cache window pays nothing. The reads
 * are deliberately issued through zohoGet rather than fetched directly, so the shared token, the
 * retry on an expired token and the 30-minute cache all apply unchanged.
 */
export async function getAllDeals() {
  const base = { fields: FIELDS, per_page: PER_PAGE, sort_by: 'Created_Time', sort_order: 'desc' };

  // The first ten pages are independent URLs, so they go together.
  const firstTen = await Promise.all(
    Array.from({ length: PAGE_LIMIT }, (_, index) => zohoGet('Deals', { ...base, page: index + 1 }))
  );
  const rows = firstTen.flatMap((payload) => payload.data ?? []);
  const last = firstTen.at(-1);
  if (!last?.info?.more_records) return dedupe(rows);

  // Past 2,000 records the token chain is sequential; there is no way around that.
  let token = last.info?.next_page_token;
  for (let page = 0; page < MAX_TOKEN_PAGES && token; page += 1) {
    const payload = await zohoGet('Deals', { ...base, page_token: token });
    rows.push(...(payload.data ?? []));
    if (!payload.info?.more_records) break;
    token = payload.info?.next_page_token;
  }
  return dedupe(rows);
}

// The ten parallel pages can overlap if a record is created mid-read, which would otherwise show up
// as an order counted twice on a card.
function dedupe(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = String(row?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
