import { resolveSalesManager } from '../config/crmNames.js';
import { zohoGet } from './zohoClient.js';

// WHO THE SM IS, PER ORDER.
//
// The Orders module has no sales-manager field at all — its only person fields are Owner ("Order
// Owner") and Designer Name. The SM lives one hop away, on the qualified lead the order came from:
// Contacts.Sales_Manager, reached through Deals.Opportunity_Name.
//
// The hop is not optional. Measured on 431 linked orders, Contacts.Sales_Manager and Deals.Owner
// name DIFFERENT people on 228 of them — 53%. Using the order owner as a stand-in would attribute
// half the board to the wrong person, so the join is done properly.
//
// 99% of orders carry the link (2,959 of 2,987 when last counted); the remainder come back with no
// SM and are shown as "Not recorded" rather than being dropped or guessed at.

const PER_PAGE = 200;
const PAGE_LIMIT = 10;
const MAX_TOKEN_PAGES = 40;

/**
 * Every qualified lead's SM, keyed by contact id.
 *
 * Only two fields are asked for, so this is a cheap read even across the whole module, and it goes
 * through zohoGet so the shared token and the 30-minute cache apply. The first ten pages are
 * independent URLs and go out together; only the token-chained tail is sequential.
 *
 * @returns {Promise<Map<string, {psm: string, owner: string}>>} contact id -> its two person fields
 */
export async function getSalesManagersByContact() {
  // Both person fields: the PSM is the first choice and the client's own owner is the fallback.
  const base = { fields: 'Sales_Manager,Owner', per_page: PER_PAGE, sort_by: 'Created_Time', sort_order: 'desc' };
  const rows = [];

  const firstTen = await Promise.all(
    Array.from({ length: PAGE_LIMIT }, (_, index) => zohoGet('Contacts', { ...base, page: index + 1 }))
  );
  firstTen.forEach((payload) => rows.push(...(payload.data ?? [])));
  const last = firstTen.at(-1);
  let token = last?.info?.more_records ? last.info?.next_page_token : null;
  for (let page = 0; page < MAX_TOKEN_PAGES && token; page += 1) {
    const payload = await zohoGet('Contacts', { ...base, page_token: token });
    rows.push(...(payload.data ?? []));
    if (!payload.info?.more_records) break;
    token = payload.info?.next_page_token;
  }

  const managers = new Map();
  for (const row of rows) {
    const id = String(row?.id ?? '');
    if (!id) continue;
    managers.set(id, { psm: row?.Sales_Manager?.name ?? '', owner: row?.Owner?.name ?? '' });
  }
  return managers;
}

/**
 * The SM for one order, through the four-source order from the handoff: the client's PSM, then the
 * client's sales person, then the order owner, then unassigned — skipping the integration user at
 * every step. Returns the name and which source produced it, so the board can report the mix.
 */
export const managerOf = (deal, managers) => {
  const contactId = deal?.Opportunity_Name?.id;
  const client = contactId && managers ? managers.get(String(contactId)) : null;
  return resolveSalesManager(client, deal?.Owner?.name);
};
