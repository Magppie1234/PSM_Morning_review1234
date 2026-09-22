import { config } from '../config/env.js';
import { readJson, removeFile, writeJson } from '../lib/dataStore.js';
import { LEAD_WINDOW_DAYS } from './timeUtils.js';

const MAX_PAGES = 40;

let cachedToken = null;
// Runtime files in DATA_DIR: the current access token, and the last good lead / deal lists (used as a
// fallback when Zoho can't be reached).
const TOKEN_FILE = '.zoho_token.json';
const DEALS_CACHE_FILE = '.deals_cache.json';
const LEADS_CACHE_FILE = '.leads_cache.json';

// In-memory cache for 60 seconds
const apiCache = new Map();
const CACHE_TTL_MS = 60_000;

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

export async function zohoGet(path, query = {}, retried = false) {
  const cacheKey = `${path}?${new URLSearchParams(query).toString()}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const token = await getZohoAccessToken();
  const url = new URL(path, `${config.zoho.apiDomain}/crm/v8/`);
  Object.entries(query).filter(([, value]) => value !== undefined && value !== '').forEach(([key, value]) => url.searchParams.set(key, value));
  
  const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const payload = await response.json();

  if (response.status === 401 && payload.code === 'INVALID_TOKEN' && !retried) {
    forgetToken(token);
    return zohoGet(path, query, true);
  }
  
  if (!response.ok) {
    if (cached?.data) {
      return cached.data;
    }
    throw new Error(`Zoho request failed: ${payload.code ?? response.status}`);
  }

  apiCache.set(cacheKey, {
    data: payload,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return payload;
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

const CONTACT_FIELDS = 'Full_Name,Sales_Manager,Total_Opportunity_Value,Client_Status,Lead_Source,Created_Time,Modified_Time,Modified_By,Actual_Closure_Date';

// Every Contact whose Client Status is Closed (closures are dated by Actual_Closure_Date, not creation).
export async function getClosedContacts() {
  return getAllRecords('Contacts', CONTACT_FIELDS, { criteria: '(Client_Status:equals:Closed)', maxPages: 10 });
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
