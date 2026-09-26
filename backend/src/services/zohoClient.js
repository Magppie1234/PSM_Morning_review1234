import { nextReportingDayAt } from '../lib/cache/reportingDay.js';
import { config } from '../config/env.js';
import { readJson, removeFile, writeJson } from '../lib/dataStore.js';
import { LEAD_WINDOW_DAYS } from './timeUtils.js';
import { ReadCache, readContext, withReadContext, recordSourceRead, recordReadFailure } from '../lib/cache/readCache.js';

const MAX_PAGES = 40;

let cachedToken = null;
// Runtime files in DATA_DIR: the current access token, and the last good lead / deal lists (used as a
// fallback when Zoho can't be reached).
const TOKEN_FILE = '.zoho_token.json';
const DEALS_CACHE_FILE = '.deals_cache.json';
const LEADS_CACHE_FILE = '.leads_cache.json';

// Reuse successful source reads for 30 minutes; concurrent readers share one request.
const apiCache = new ReadCache({ expiresAtLimit: (timestamp) => nextReportingDayAt(timestamp, config.zoho.timezone) });

function loadTokenFromDisk() {
  const saved = readJson(TOKEN_FILE);
  return saved?.expiresAt > Date.now() + 60_000 ? saved : null;
}

const saveTokenToDisk = (tokenObj) => writeJson(TOKEN_FILE, tokenObj);
const loadJsonCache = (name) => readJson(name);
const saveJsonCache = (name, data) => writeJson(name, data);

let pendingRefresh = null;

// Parallel requests share one refresh, so a burst never trips Zoho's token-refresh limit.
export async function getZohoAccessToken() {
  if (!cachedToken) {
    cachedToken = loadTokenFromDisk();
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  pendingRefresh ??= refreshAccessToken().finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

async function refreshAccessToken() {
  const body = new URLSearchParams({
    refresh_token: config.zoho.refreshToken,
    client_id: config.zoho.clientId,
    client_secret: config.zoho.clientSecret,
    grant_type: 'refresh_token'
  });
  
  const response = await fetch(`${config.zoho.accountsUrl}/oauth/v2/token`, { method: 'POST', body });
  const payload = await response.json();
  
  if (!response.ok || !payload.access_token) {
    if (cachedToken?.value) return cachedToken.value;
    throw new Error(`Zoho token refresh failed: ${payload.error_description || payload.error || response.status}`);
  }
  
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000
  };
  saveTokenToDisk(cachedToken);
  return cachedToken.value;
}

// Zoho keeps a limited number of live access tokens per refresh token, so another app on the same
// credentials can revoke ours before it expires. Drop the saved token so the next call mints a fresh one.
function forgetToken(staleValue) {
  if (cachedToken?.value !== staleValue) return; // another request already replaced it
  cachedToken = null;
  removeFile(TOKEN_FILE);
}

// Kept for administrative callers; board refresh uses request-scoped bypass instead.
export function clearApiCache() { apiCache.clear(); }

export async function zohoGet(path, query = {}) {
  const parameters = new URLSearchParams();
  Object.entries(query).filter(([, value]) => value !== undefined && value !== '').forEach(([key, value]) => parameters.set(key, value));
  parameters.sort();
  const cacheKey = path + '?' + parameters;
  try {
    const entry = await apiCache.get(cacheKey, async () => {
      async function read(retried = false) {
        const token = await getZohoAccessToken();
        const url = new URL(path, config.zoho.apiDomain + '/crm/v8/');
        url.search = parameters.toString();
        const response = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
        const payload = response.status === 204 ? { data: [], info: { more_records: false } } : await response.json();
        if (response.status === 401 && payload.code === 'INVALID_TOKEN' && !retried) {
          forgetToken(token);
          return read(true);
        }
        if (!response.ok) throw new Error('Zoho request failed: ' + (payload.code ?? response.status));
        return payload;
      }
      return read();
    }, { force: readContext()?.force });
    recordSourceRead(entry.fetchedAt);
    return entry.data;
  } catch (error) {
    recordReadFailure();
    throw error;
  }
}

export async function getLeadFieldMetadata() {
  const payload = await zohoGet('settings/fields', { module: config.zoho.leadsModule });
  return (payload.fields ?? []).map(({ api_name, display_label, data_type }) => ({ api_name, display_label, data_type }));
}

// Pages through a module newest-first until it passes the cutoff: an ISO date (fetch from that day,
// with a day of timezone margin) or, if omitted, the default 7-day window.
// `timeField` is the date the window is measured on (Lead Status History only has Modified_Time).
async function getRecordsInWindow(module, fields, since, timeField = 'Created_Time', extra = {}) {
  const cutoff = since
    ? Date.parse(`${since}T00:00:00Z`) - 86_400_000
    : Date.now() - (LEAD_WINDOW_DAYS + 2) * 86_400_000;
  const data = [];
  let pageToken;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // Zoho serves only the first 2,000 records by page number; beyond that it needs the page token.
    const paging = pageToken ? { page_token: pageToken } : { page };
    const payload = await zohoGet(module, { fields, per_page: 200, ...paging, sort_by: timeField, sort_order: 'desc', ...extra });
    const rows = payload.data ?? [];
    data.push(...rows);
    const oldest = rows.at(-1)?.[timeField];
    if (!payload.info?.more_records || !oldest || Date.parse(oldest) < cutoff) break;
    pageToken = payload.info?.next_page_token;
    if (page >= 10 && !pageToken) break;
  }
  return data.filter((record) => Date.parse(record[timeField]) >= cutoff);
}

export async function getRecentLeads(since) {
  const module = config.zoho.leadsModule;
  const fields = [
    'Owner', 'Company', 'Full_Name', 'First_Name', 'Last_Name', 'Lead_Source', 'Lead_Status',
    'Created_Time', 'Modified_Time', 'Last_Activity_Time', 'City', 'Lead_Type', 'Lead_Ratings',
    'Product_Requirement', 'Next_Follow_UP_Date', 'Follow_Up_Date_Time', 'Oppourtunity_Value',
    'Client_Budget_In_Lakhs', 'Converted__s', 'Converted_Date_Time', 'Lead_Assigned_Date', 'Project_Stage',
    'Architect_Name', 'Architect_Firm', 'Architect_No', 'Working_with_an_Architect_Interior_Designer',
    'Client_Status1', 'Converted_Deal', 'Created_By', 'Modified_By', 'Reason_for_Cold', 'Dead_Reason'
  ].join(',');
  try {
    // `since` is the start of the comparison period, so the lead flow can compare with it.
    // Zoho hides converted leads from the list unless asked; they are the ones that reached an
    // opportunity, so the funnel needs them (as the Executive Command Centre does).
    const recent = await getRecordsInWindow(module, fields, since, 'Created_Time', { converted: 'both' });
    if (recent.length) saveJsonCache(LEADS_CACHE_FILE, recent);
    return recent;
  } catch (err) {
    const cached = loadJsonCache(LEADS_CACHE_FILE);
    if (cached?.length) return cached;
    throw err;
  }
}

// Qualified opportunities: Contacts created since `since`, with the PSM (Sales_Manager) and the
// opportunity value in lakhs. These feed the PSM mandate progress bar.
export async function getRecentContacts(since) {
  return getRecordsInWindow('Contacts', CONTACT_FIELDS, since);
}

// City, Owner, Stage ("Status"), Amount ("BD Value"), Est_Closoure_Date ("Est. Closure Date", the CRM's
// own spelling) and the two product fields are read for the Sales board's lead generation and sales
// performance sections; the boards that do not need them simply ignore them.
// Created_By is read for the Efficiency section: five bulk imports by the company account account for
// 46% of the module, and two of them are service entries rather than leads. Identifying them needs the
// creating account, not the owner, which changes on reassignment. Every other board ignores the field.
// Next_Follow_UP_Date ("Follow Up Date") is the follow-up the team actually fills; Next_Follow_Up_Date1
// is a newer datetime field almost nobody uses, so it is read only as a fallback. Last_Note carries the
// free-text next action. All three feed the weekly view.
const CONTACT_FIELDS = 'Full_Name,Sales_Manager,Owner,Created_By,City,Stage,Amount,Total_Opportunity_Value,Client_Status,Lead_Source,Created_Time,Modified_Time,Modified_By,Actual_Closure_Date,Est_Closoure_Date,Product_Requirement,Product_Type,Next_Follow_UP_Date,Next_Follow_Up_Date1,Last_Note';

// Same window as getRecordsInWindow, but the first ten pages go out a few at a time instead of one
// after another. Zoho serves pages 1-10 by page number and only needs the page token beyond that, so
// those ten requests are independent; measured against the live CRM this takes a 12-month Contacts read
// from 6.8s to 5.0s, and it is the same set of requests either way.
// PAGE_BURST is deliberately small: every other board reads Zoho strictly sequentially, and a wide
// burst here would eat the org's shared concurrency budget and slow those boards down instead.
// Used by the Efficiency section, whose 12-month trend needs the whole module on every load.
const PAGE_BURST = 4;

async function getRecordsInWindowFast(module, fields, since, maxPages = 40) {
  const cutoff = Date.parse(`${since}T00:00:00Z`) - 86_400_000;
  const base = { fields, per_page: 200, sort_by: 'Created_Time', sort_order: 'desc' };
  const rows = [];
  // Newest first, so a page that ends older than the window is the last one worth asking for.
  const done = (payload) => {
    const oldest = payload?.data?.at(-1)?.Created_Time;
    return !payload?.info?.more_records || !oldest || Date.parse(oldest) < cutoff;
  };
  let finished = false;
  let token;
  for (let start = 1; start <= 10 && !finished; start += PAGE_BURST) {
    const size = Math.min(PAGE_BURST, 11 - start);
    const batch = await Promise.all(Array.from({ length: size }, (_, index) => zohoGet(module, { ...base, page: start + index })));
    batch.forEach((payload) => rows.push(...(payload.data ?? [])));
    finished = done(batch.at(-1));
    // Only page 10 carries a usable token; earlier batches set it and are overwritten by the next one.
    token = batch.at(-1)?.info?.next_page_token;
  }
  for (let page = 11; page <= maxPages && !finished && token; page += 1) {
    const payload = await zohoGet(module, { ...base, page_token: token });
    rows.push(...(payload.data ?? []));
    finished = done(payload);
    token = payload.info?.next_page_token;
  }
  // The parallel pages can overlap if a record is created mid-read, so ids are de-duplicated.
  const seen = new Set();
  return rows.filter((record) => Date.parse(record.Created_Time) >= cutoff && !seen.has(record.id) && seen.add(record.id));
}

// Cache assembled windows too: Zoho pagination tokens change between reads.
async function getCachedWindow(module, fields, since) {
  const entry = await apiCache.get('window:' + module + ':' + fields + ':' + since, async () => {
    const state = { force: readContext()?.force, fetchedAt: Date.now(), degraded: false };
    const records = await withReadContext(state, () => getRecordsInWindowFast(module, fields, since));
    return { records, fetchedAt: state.fetchedAt };
  }, { force: readContext()?.force }).catch((error) => { recordReadFailure(); throw error; });
  entry.expiresAt = Math.min(entry.expiresAt, entry.data.fetchedAt + 30 * 60 * 1000);
  recordSourceRead(entry.data.fetchedAt);
  return entry.data.records;
}

// The two reads behind /api/sales-efficiency. Contacts always go back 12 months because the section's
// trend series does; Deals only back to the start of the comparison window, which is all they are used for.
export const getEfficiencyContacts = (since) => getCachedWindow('Contacts', CONTACT_FIELDS, since);

const EFFICIENCY_DEAL_FIELDS = 'Deal_Name,Created_Time,Stage,Product_Type,Number_of_Design_Revisions,Value,Total_Amount,Actual_Closure_Date,city';
export const getEfficiencyDeals = (since) => getCachedWindow('Deals', EFFICIENCY_DEAL_FIELDS, since);

// Every Contact whose Client Status is Closed (closures are dated by Actual_Closure_Date, not creation).
export async function getClosedContacts() {
  return getAllRecords('Contacts', CONTACT_FIELDS, { criteria: '(Client_Status:equals:Closed)', maxPages: 10 });
}

// The day the Contacts module starts. One record, so it costs almost nothing. It lets the boards tell
// "nothing happened in that period" apart from "the CRM did not hold anything yet", instead of drawing a
// comparison against an empty window as if it were growth.
export async function getEarliestContactDate() {
  const payload = await zohoGet('Contacts', { fields: 'Created_Time', per_page: 1, sort_by: 'Created_Time', sort_order: 'asc' });
  const earliest = payload.data?.[0]?.Created_Time;
  return earliest ? String(earliest).slice(0, 10) : null;
}

// Contacts with an Est. Closure Date in the given range, for the Sales board's estimate and overdue cards.
// Their estimate can be years older than the reporting period — an overdue deal stays overdue however long
// ago its date passed — so this cannot be a slice of the created-in-period list and is read on its own.
export async function getEstimateContacts(from, to) {
  const criteria = `((Est_Closoure_Date:greater_equal:${from})and(Est_Closoure_Date:less_equal:${to}))`;
  return getAllRecords('Contacts', CONTACT_FIELDS, { criteria, maxPages: 15 });
}

// Ownership history of one lead from its Zoho Timeline: every owner change (newest first) with who made it
// and when, plus the first assignment on arrival.
export async function getLeadOwnerChanges(id) {
  const payload = await zohoGet(`Leads/${id}/__timeline`, { per_page: 100 });
  const events = payload.__timeline ?? [];
  const changes = events
    .flatMap((event) => (event.field_history ?? [])
      .filter((field) => field.api_name === 'Owner')
      .map((field) => ({ from: field._value?.old ?? null, to: field._value?.new ?? null, by: event.done_by?.name ?? null, at: event.audited_time ?? null })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const first = events.filter((event) => event.action === 'owner_assigned').sort((a, b) => String(a.audited_time).localeCompare(String(b.audited_time)))[0];
  return { changes, assigned: first ? { by: first.done_by?.name ?? null, at: first.audited_time ?? null } : null };
}

// Lead status changes recorded since `since` (Zoho's Lead Status History module), newest first.
export async function getRecentStatusHistory(since) {
  return getRecordsInWindow('Lead_Status_History', 'Full_Name,Lead_Status,Modified_Time', since, 'Modified_Time');
}

// Call logs created since `since` (calls made, received or missed, and calls scheduled for later).
export async function getRecentCalls(since) {
  return getRecordsInWindow('Calls', 'Call_Start_Time,Call_Type,Call_Duration_in_seconds,Outgoing_Call_Status,Subject,What_Id,Who_Id,Owner,Created_Time', since);
}

// Stage of each deal a lead was converted into, keyed by deal id (Zoho accepts 100 ids per call).
export async function getDealStages(ids = []) {
  const stages = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const payload = await zohoGet('Deals', { ids: ids.slice(index, index + 100).join(','), fields: 'Stage' });
    (payload.data ?? []).forEach((deal) => stages.set(String(deal.id), deal.Stage ?? ''));
  }
  return stages;
}

export async function getRecentDeals(since) {
  const fields = [
    'Deal_Name', 'Owner', 'Stage', 'Amount', 'Total_Amount', 'Closing_Date', 'Created_Time',
    'Modified_Time', 'Lead_Source', 'Architect_Name', 'Architect_Firm', 'Client_Status',
    'Project_Stage', 'Next_Follow_UP_Date', 'Product_Type', 'Actual_Closure_Date',
    'Designer_Name', 'Number_of_Design_Revisions', 'Expected_Design_Date', 'Design_Approved_Date', 'Design_Required_on',
    'Cabinet_Area_Sqft', 'Countertop_Area_Sqft', 'Backsplash_Area_Sqft', 'Finished_Kitchen_Ceiling_Height', 'Kitche_Height',
    'Kitchen_Type', 'Floor', 'Room_Area_Name', 'Gas_Arrangement',
    'Site_Measurement_Person', 'Site_Incharge_Name', 'Site_Incharge_Mobile',
    'Any_special_appliances', 'Signed_Appliances_List', 'Form_Filled_Date_Time', 'Send_For_Approval_Date',
    'Est_Handover_Date', 'Handover_Date', 'Expected_Dispatch_Date'
  ].join(',');
  try {
    const data = await getRecordsInWindow('Deals', fields, since);
    if (data.length) saveJsonCache(DEALS_CACHE_FILE, data);
    return data;
  } catch (err) {
    const cached = loadJsonCache(DEALS_CACHE_FILE);
    if (cached?.length) return cached;
    throw err;
  }
}

// Deals currently sitting in any of the given stages (one search per stage, a few at a time).
export async function getDealsInStages(stages, fields) {
  const deals = [];
  const searchStage = async (stage) => {
    for (let page = 1; page <= 5; page += 1) {
      let payload;
      try {
        payload = await zohoGet('Deals/search', { criteria: `(Stage:equals:${stage})`, fields, per_page: 200, page });
      } catch (error) {
        // Zoho answers "no matches" with an empty 204 body.
        if (/JSON/.test(error.message)) return;
        throw error;
      }
      deals.push(...(payload.data ?? []));
      if (!payload.info?.more_records) return;
    }
  };
  for (let index = 0; index < stages.length; index += 6) {
    await Promise.all(stages.slice(index, index + 6).map(searchStage));
  }
  return deals;
}

// Payment milestone status per order id, from the Payment Milestones module and its order links.
export async function getPaymentStatusByOrder() {
  const readAll = async (module, fields) => {
    const rows = [];
    for (let page = 1; page <= 10; page += 1) {
      let payload;
      try {
        payload = await zohoGet(module, { fields, per_page: 200, page });
      } catch (error) {
        if (/JSON/.test(error.message)) break;
        throw error;
      }
      rows.push(...(payload.data ?? []));
      if (!payload.info?.more_records) break;
    }
    return rows;
  };
  const [links, milestones] = await Promise.all([
    readAll('Payment_M_X_Orders', 'Orders,Payment_Milestones'),
    readAll('Payment_Milestones', 'Payment_Status')
  ]);
  const statusById = new Map(milestones.map((row) => [String(row.id), row.Payment_Status ?? '']));
  const byOrder = new Map();
  links.forEach((link) => {
    const orderId = link.Orders?.id;
    const milestoneId = link.Payment_Milestones?.id;
    if (!orderId || !milestoneId) return;
    const entry = byOrder.get(String(orderId)) ?? { total: 0, paid: 0 };
    entry.total += 1;
    if (/^paid/i.test(statusById.get(String(milestoneId)) ?? '')) entry.paid += 1;
    byOrder.set(String(orderId), entry);
  });
  return byOrder;
}

// Every record of a module (or of a search when criteria is given), up to maxPages of 200.
export async function getAllRecords(module, fields, { criteria, maxPages = 10 } = {}) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    let payload;
    try {
      payload = criteria
        ? await zohoGet(`${module}/search`, { criteria, fields, per_page: 200, page })
        : await zohoGet(module, { fields, per_page: 200, page });
    } catch (error) {
      if (/JSON/.test(error.message)) break;
      throw error;
    }
    rows.push(...(payload.data ?? []));
    if (!payload.info?.more_records) break;
  }
  return rows;
}
