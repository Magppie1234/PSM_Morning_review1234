import { buildContactStages } from './contactStages.js';
import { buildLeadFlow } from './leadFlow.js';
import { buildMandate } from './mandate.js';
import { PSM_NAMES } from '../config/roster.js';
import { withAllPsms } from './teamRows.js';
import { dayOffset, getTimeframeFilter, localDayKey } from './timeUtils.js';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const dayKey = (date) => String(date ?? '').slice(0, 10);
const leadName = (lead) => lead.Company || lead.Full_Name || [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ') || 'Unnamed lead';
const leadValue = (lead) => Number(lead.Oppourtunity_Value ?? lead.Client_Budget_In_Lakhs ?? 0) * 100_000;
const money = (value) => value ? `₹${inr.format(value / 100_000)}L` : '—';
const idsOf = (items) => items.map((item) => String(item.lead.id));
const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');

// Zoho Lead_Status values (the CRM spells "Awaited" as "Awiated").
const QUALIFIED_STATUS = /^qualified\s*\/|drawing received/i; // excludes "Not Qualified" and "Pre-Qualified"
const AWAITING_DRAWINGS_STATUS = /^qualified\s*\/\s*drawings?\s*aw/i;
const DRAWING_RECEIVED_STATUS = /drawing received/i;
const BOOKED_DEAL_STAGE = /order booked|closed won/i;
const STALE_DAYS = 7;
// Sources where the client reached Magppie first (not ads, data lists, referrals or exhibitions).
// Office hours are 9:30 am – 6:30 pm IST; a lead created outside them (evening or overnight) is after hours.
const OFFICE_START = 9 * 60 + 30;
const OFFICE_END = 18 * 60 + 30;
const IST_OFFSET_MIN = 330;
function isAfterHours(dateStr) {
  const time = Date.parse(dateStr ?? '');
  if (Number.isNaN(time)) return false;
  const minutes = Math.floor((time / 60_000 + IST_OFFSET_MIN) % 1440);
  return minutes < OFFICE_START || minutes >= OFFICE_END;
}
const arrivalTime = (dateStr) => {
  const time = Date.parse(dateStr ?? '');
  return Number.isNaN(time) ? null : new Date(time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
};
const CLIENT_REACH_SOURCE = /website|whatsapp|chatbot|^chat$|direct instagram|ivr|walk.?in|scanner|repeat/i;

// Raw leads are the leads owned by the PSM team, converted or not — the same cohort the Executive
// Command Centre uses, so the two dashboards agree.
const isPsmLead = (lead) => PSM_NAMES.has(lead.Owner?.name ?? '');

function isArchitectLead(lead) {
  return /architect|designer/i.test(lead.Lead_Source ?? '') ||
    Boolean(lead.Architect_Name && String(lead.Architect_Name).trim()) ||
    Boolean(lead.Architect_Firm && String(lead.Architect_Firm).trim()) ||
    /yes/i.test(lead.Working_with_an_Architect_Interior_Designer ?? '');
}

function classify(lead, dealStages, todayKey) {
  const rawStatus = String(lead.Lead_Status ?? '');
  const status = rawStatus.toLowerCase();
  const excluded = /junk|not interested/.test(status);
  const enabled = lead.Converted__s === true;
  // Converted leads are opportunities already, even when Zoho still says "Not Contacted Yet".
  const missed = /not contacted/.test(status) && !enabled;
  const qualified = QUALIFIED_STATUS.test(rawStatus);
  const contacted = !excluded && !missed;
  const overdue = /follow up/.test(status) && Boolean(lead.Next_Follow_UP_Date) && dayKey(lead.Next_Follow_UP_Date) < todayKey;
  const ageing = dayOffset(lead.Created_Time) ?? 0;
  const booked = enabled && BOOKED_DEAL_STAGE.test(dealStages.get(String(lead.Converted_Deal?.id)) ?? '');
  const hotPending = /hot/i.test(lead.Client_Status1 ?? '') && !qualified && !excluded && !enabled;
  return {
    lead,
    status,
    excluded,
    missed,
    contacted,
    qualified,
    overdue,
    ageing,
    enabled,
    booked,
    hotPending,
    drawingReceived: DRAWING_RECEIVED_STATUS.test(rawStatus),
    qualifiedStale: qualified && ageing >= STALE_DAYS,
    drawingRisk: AWAITING_DRAWINGS_STATUS.test(rawStatus) && ageing >= STALE_DAYS,
    isArchitect: isArchitectLead(lead),
    afterHours: isAfterHours(lead.Created_Time),
    clientReach: CLIENT_REACH_SOURCE.test(String(lead.Lead_Source ?? '').trim()),
    value: leadValue(lead)
  };
}

function riskFor(item) {
  if (item.missed) return { risk: 'No first contact recorded', action: 'Assign first contact today', priority: 'High' };
  if (item.hotPending) return { risk: 'Hot lead not yet qualified', action: 'Call hot lead today', priority: 'High' };
  if (item.overdue) return { risk: 'Follow-up date has passed', action: 'Complete overdue follow-up', priority: 'High' };
  return { risk: 'Qualified lead awaiting drawing progress', action: 'Review drawing status with PSM', priority: 'Medium' };
}

export function buildDashboardFromLeads(leads, selectedPsm = 'All PSM', timeframe = 'daily', dealStages = new Map(), contacts = null, statusHistory = [], calls = [], closedContacts = []) {
  const tf = getTimeframeFilter(timeframe);
  // Last real call on each lead (made, received or missed; scheduled future calls are not contact),
  // plus how many calls the PSM placed (attempts; policy allows up to 15 per lead).
  const lastCall = new Map();
  const nowMs = Date.now();
  calls.forEach((call) => {
    const leadId = call.What_Id?.id ?? call.Who_Id?.id;
    const at = call.Call_Start_Time ?? call.Created_Time;
    if (!leadId || !at || Date.parse(at) > nowMs || /scheduled/i.test(`${call.Outgoing_Call_Status ?? ''} ${call.Subject ?? ''}`)) return;
    const entry = lastCall.get(leadId) ?? { count: 0, attempts: 0 };
    entry.count += 1;
    entry.attempts += Number(call.Call_Type === 'Outbound'); // attempts = calls the PSM placed
    if (!entry.at || entry.at < at) Object.assign(entry, { at, type: call.Call_Type ?? null, seconds: call.Call_Duration_in_seconds ?? 0, by: call.Owner?.name ?? null });
    lastCall.set(leadId, entry);
  });
  // Latest time each lead moved into each status, from Lead Status History.
  const enteredStatus = new Map();
  statusHistory.forEach((entry) => {
    const key = `${entry.Full_Name?.id}|${entry.Lead_Status}`;
    const at = entry.Modified_Time ?? entry.Created_Time;
    if (at && (!enteredStatus.has(key) || enteredStatus.get(key) < at)) enteredStatus.set(key, at);
  });
  const reportLabel = tf.reportLabel;
  const todayKey = localDayKey(new Date());

  // PSM-owned leads (including converted ones) created in the selected window
  const magppie = leads.filter(isPsmLead);
  const items = magppie
    .filter((lead) => tf.matches(lead.Created_Time))
    .map((lead) => classify(lead, dealStages, todayKey));

  const allActive = items.filter((item) => !item.excluded);

  const byOwner = new Map();
  allActive.forEach((item) => {
    const psm = item.lead.Owner?.name ?? 'Unassigned';
    const row = byOwner.get(psm) ?? { psm, leads: 0, architectLeads: 0, clientReach: 0, inHours: 0, afterHours: 0, contacted: 0, qualified: 0, enabled: 0, bookings: 0, value: 0, missed: 0, hot: 0 };
    row.leads += 1;
    row.architectLeads += Number(item.isArchitect);
    row.clientReach += Number(item.clientReach);
    row.afterHours += Number(item.afterHours);
    row.inHours += Number(!item.afterHours);
    row.contacted += Number(item.contacted);
    row.qualified += Number(item.qualified);
    row.enabled += Number(item.enabled);
    row.bookings += Number(item.booked);
    row.value += item.value;
    row.missed += Number(item.missed);
    row.hot += Number(item.hotPending);
    byOwner.set(psm, row);
  });

  // Every PSM stays selectable even in a period where they have no leads.
  const allPsms = ['All PSM', ...[...new Set([...byOwner.keys(), ...PSM_NAMES])].sort()];

  const isSpecificPsm = selectedPsm && selectedPsm !== 'All PSM';
  const active = isSpecificPsm
    ? allActive.filter((item) => (item.lead.Owner?.name ?? 'Unassigned') === selectedPsm)
    : allActive;

  // Raw leads include junk and not-interested ones, so the flow cards can show where every lead went.
  const ownedBy = (lead) => !isSpecificPsm || (lead.Owner?.name ?? 'Unassigned') === selectedPsm;
  const rawItems = items.filter((item) => ownedBy(item.lead));
  const flow = buildLeadFlow(
    rawItems.map((item) => item.lead),
    magppie.filter((lead) => tf.previousMatches(lead.Created_Time) && ownedBy(lead)),
    tf.previousLabel,
    leadValue
  );
  // Sales qualified and Closed come from Contacts (qualified opportunities), not from lead statuses.
  const contactStages = buildContactStages({
    tf,
    contacts,
    closed: closedContacts,
    inScope: (name) => (isSpecificPsm ? name === selectedPsm : PSM_NAMES.has(name)),
    raw: rawItems.length
  });
  Object.assign(flow.nodes, contactStages.nodes);
  flow.contactsAvailable = contactStages.available;
  const mandate = buildMandate({
    tf,
    contacts,
    selectedPsm: isSpecificPsm ? selectedPsm : ''
  });

  const total = active.length;
  const architectItems = active.filter((item) => item.isArchitect);
  const contactedItems = active.filter((item) => item.contacted);
  const qualifiedItems = active.filter((item) => item.qualified);
  const enabledItems = active.filter((item) => item.enabled);
  const bookedItems = active.filter((item) => item.booked);
  const architectCount = architectItems.length;
  const contacted = contactedItems.length;
  const qualified = qualifiedItems.length;
  const enabled = enabledItems.length;
  const booked = bookedItems.length;
  const drawingReceived = active.filter((item) => item.drawingReceived).length;
  const missed = active.filter((item) => item.missed);
  const overdue = active.filter((item) => item.overdue);
  const hotPending = active.filter((item) => item.hotPending);
  const qualifiedStale = active.filter((item) => item.qualifiedStale);
  const drawingRisk = active.filter((item) => item.drawingRisk);
  const value = active.reduce((totalValue, item) => totalValue + item.value, 0);

  const seen = new Set();
  const decisionItems = [...missed, ...hotPending, ...overdue, ...drawingRisk]
    .filter((item) => !seen.has(item.lead.id) && seen.add(item.lead.id))
    .slice(0, 20);

  const performanceRows = withAllPsms(
    isSpecificPsm ? [...byOwner.values()].filter((row) => row.psm === selectedPsm) : [...byOwner.values()],
    [...byOwner.values()],
    tf,
    isSpecificPsm ? selectedPsm : '',
    items.filter((item) => item.excluded).reduce((counts, item) => {
      const owner = item.lead.Owner?.name ?? 'Unassigned';
      return counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }, new Map())
  );

  const tfSuffix = `(${tf.shortLabel})`;

  return {
    meta: {
      isDemo: false,
      reportLabel,
      timeframe: tf.timeframe,
      // Exact dates of the period and its comparison window, shown in the Show Formula panels.
      start: tf.start,
      end: tf.end,
      previousStart: tf.previousStart,
      previousEnd: tf.previousEnd,
      previousLabel: tf.previousLabel,
      mappingNotice: isSpecificPsm ? `Showing ${reportLabel} metrics for PSM: ${selectedPsm}` : `${reportLabel} · leads owned by the PSM team, including converted`
    },
    filters: {
      timeframe: tf.timeframe,
      timeframeOptions: tf.options,
      psms: allPsms,
      cities: ['All City', 'Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai'],
      products: ['All Product', 'Modular Kitchen', 'Wardrobe', 'Complete Interior'],
      leadSources: ['All Lead source', 'Architect', 'Walk-in', 'Website', 'Referral', 'Campaign']
    },
    kpis: [
      { label: `Raw leads ${tfSuffix}`, value: String(rawItems.length), tone: 'blue', icon: 'users', recordIds: idsOf(rawItems) },
      { label: 'Leads by Architect', value: String(architectCount), subtext: `${total ? pct(architectCount, total) : '0%'} of received`, tone: 'blue', icon: 'ruler', recordIds: idsOf(architectItems) },
      { label: 'Contacted', value: String(contacted), subtext: total ? `${pct(contacted, total)} of leads` : '—', tone: 'blue', icon: 'phone', recordIds: idsOf(contactedItems) },
      { label: 'Qualified', value: String(qualified), subtext: contacted ? `${pct(qualified, contacted)} of contacted` : '—', tone: 'blue', icon: 'target', recordIds: idsOf(qualifiedItems) },
      { label: 'Enabled', value: String(enabled), subtext: 'Converted to deal', tone: 'blue', icon: 'file', recordIds: idsOf(enabledItems) },
      { label: 'Bookings', value: String(booked), subtext: 'Booked or won', tone: 'blue', icon: 'calendar', recordIds: idsOf(bookedItems) },
      { label: 'Business value', value: money(value), tone: 'blue', icon: 'rupee' }
    ],
    risks: [
      // recordIds lets the detail view list exactly the leads behind each count.
      { label: 'Missed leads', value: String(missed.length), tone: 'danger', icon: 'alert', recordIds: idsOf(missed) },
      { label: 'Overdue follow-ups', value: String(overdue.length), tone: 'warning', icon: 'clock', recordIds: idsOf(overdue) },
      { label: 'Hot leads pending', value: String(hotPending.length), tone: 'danger', icon: 'flame', recordIds: idsOf(hotPending) },
      { label: 'Qualified 7+ days', value: String(qualifiedStale.length), tone: 'warning', icon: 'clock', recordIds: idsOf(qualifiedStale) },
      { label: 'Drawings delayed', value: String(drawingRisk.length), tone: 'warning', icon: 'file', recordIds: idsOf(drawingRisk) }
    ],
    performance: performanceRows.map((row) => ({
      ...row,
      value: money(row.value),
      status: row.zeroReason ? 'No leads' : row.missed > 0 ? 'Watch' : 'On track',
      tone: row.zeroReason ? 'neutral' : row.missed > 0 ? 'warning' : 'success'
    })),
    leads: rawItems.map((item) => ({
      id: item.lead.id,
      name: leadName(item.lead),
      psm: item.lead.Owner?.name ?? 'Unassigned',
      status: item.lead.Lead_Status ?? 'Status not recorded',
      city: item.lead.City ?? 'City not recorded',
      source: item.lead.Lead_Source || null, // left empty in Zoho → shown as NA, not guessed
      architect: item.lead.Architect_Name || item.lead.Architect_Firm || (item.isArchitect ? 'Architect / Designer' : '—'),
      product: item.lead.Product_Requirement ?? 'Product not recorded',
      created: item.lead.Created_Time ? localDayKey(item.lead.Created_Time) : null,
      arrivedAt: arrivalTime(item.lead.Created_Time),
      createdAt: item.lead.Created_Time ?? null,
      lastContact: lastCall.get(String(item.lead.id)) ?? null,
      // In the current status since its latest history entry; a lead never moved is in it since creation.
      statusSince: enteredStatus.get(`${item.lead.id}|${item.lead.Lead_Status}`) ?? item.lead.Created_Time ?? null,
      modifiedAt: item.lead.Modified_Time ?? null,
      modifiedBy: item.lead.Modified_By?.name ?? null,
      afterHours: item.afterHours,
      followUp: item.lead.Next_Follow_UP_Date ?? 'Not scheduled',
      createdBy: item.lead.Created_By?.name ?? null,
      reason: item.lead.Reason_for_Cold || item.lead.Dead_Reason || null,
      assigned: item.lead.Lead_Assigned_Date ? dayKey(item.lead.Lead_Assigned_Date) : null,
      clientReach: item.clientReach,
      value: money(item.value)
    })),
    decisions: decisionItems.map((item) => ({
      lead: leadName(item.lead),
      id: `${item.lead.id} · ${item.lead.City ?? 'City not recorded'}`,
      psm: item.lead.Owner?.name ?? 'Unassigned',
      ageing: `${item.ageing} days`,
      ...riskFor(item)
    })),
    flow,
    // Qualified opportunities (Zoho Contacts) behind the Sales qualified and Closed cards.
    opportunities: contactStages.records.map((contact) => ({
      id: contact.id,
      kind: 'opportunity',
      name: contact.Full_Name || 'Unnamed opportunity',
      psm: contact.Sales_Manager?.name ?? 'Unassigned',
      status: contact.Client_Status || 'Not yet validated',
      source: contact.Lead_Source || null,
      value: money((Number(contact.Total_Opportunity_Value) || 0) * 100_000),
      created: contact.Created_Time ? localDayKey(contact.Created_Time) : null,
      createdAt: contact.Created_Time ?? null,
      statusSince: contact.Created_Time ?? null,
      afterHours: isAfterHours(contact.Created_Time),
      arrivedAt: arrivalTime(contact.Created_Time),
      modifiedAt: contact.Modified_Time ?? null,
      modifiedBy: contact.Modified_By?.name ?? null,
      closedOn: contact.Actual_Closure_Date ?? null,
      lastContact: lastCall.get(String(contact.id)) ?? null
    })),
    mandate,
    funnel: [
      { label: `Total Leads ${tfSuffix}`, value: total, conversion: '100%', icon: 'users' },
      { label: 'Contacted', value: contacted, conversion: pct(contacted, total), basis: 'of leads', icon: 'phone' },
      { label: 'Qualified', value: qualified, conversion: pct(qualified, contacted), basis: 'of contacted', icon: 'target' },
      { label: 'Enabled', value: enabled, conversion: pct(enabled, qualified), basis: 'of qualified', icon: 'file' },
      { label: 'Drawing Received', value: drawingReceived, conversion: pct(drawingReceived, qualified), basis: 'of qualified', icon: 'drawing' },
      { label: 'Booked', value: booked, conversion: pct(booked, enabled), basis: 'of enabled', icon: 'calendar' }
    ]
  };
}
