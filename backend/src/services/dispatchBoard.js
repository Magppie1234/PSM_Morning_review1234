import { canonicalStage } from '../config/crmNames.js';
import {
  CITY_BUCKETS, CITY_KEYS, OTHER_CITY_KEY, canonicalCityName, cityBucketOf,
  cityNameKeyOf, cityNameLabelOf, cityRows, mergeCityNames
} from '../config/salesFunnel.js';
import {
  COMPLAINT_AGING_DAYS, COMPLAINT_PRIORITIES, COMPLAINT_SOURCES, COMPLAINT_STAGES,
  COMPLAINT_STATUSES, DISPATCH_VIEWS, DISPATCHED, FINANCE_APPROVED, INSTALLED,
  PDI_APPROVED, PRODUCTION_SIGNOFF
} from '../config/dispatchViews.js';
import { isRealDeal, LAKH, rankOf } from './preDesignBoard.js';
import { inr } from './salesFunnelBoard.js';
import { enteredDuring } from './stageLedger.js';
import { getAllDeals } from './dealsModule.js';
import { zohoGet } from './zohoClient.js';

// The Dispatch board: Planner, Scheduler, Tracker and Complaints, ported from the :5520 mockup and
// wired to Zoho. Which card means what, and which four cards the CRM cannot answer, is all declared
// in config/dispatchViews.js — this file only fills them.
//
// Same two figures as the post-design board, for the same reason: FLOW is how many orders entered a
// stage during the period (the headline, driven by the period buttons) and STOCK is how many sit
// there now. Both come off DealHistory; the dedicated dispatch date fields are empty.

const clean = (value) => String(value ?? '').trim();
const set = (value) => Boolean(clean(value)) && clean(value) !== '-None-';
const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const lower = (value) => clean(value).toLowerCase();
const daysSince = (date) => {
  if (!date) return null;
  const days = (Date.now() - Date.parse(date)) / 86_400_000;
  return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : null;
};
const daysBetween = (from, to) => {
  if (!from || !to) return null;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 ? days : null;
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
// Shared with the Post Design queue — one pass over the module serves both boards. See dealsModule.js.
export const getDispatchDeals = getAllDeals;

const MAX_PAGES = 45;

function toOrder(deal) {
  const city = canonicalCityName(deal.city);
  const amount = num(deal.Value) * LAKH;
  return {
    id: String(deal.id ?? ''),
    name: deal.Deal_Name ?? 'Unnamed order',
    cityRaw: clean(deal.city),
    city,
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    designer: set(deal.Designer_Name) ? clean(deal.Designer_Name) : '',
    owner: deal.Owner?.name ?? '',
    stage: canonicalStage(deal.Stage),
    stageKey: lower(canonicalStage(deal.Stage)),
    product: set(deal.Product_Type) ? clean(deal.Product_Type) : '',
    // The two order identifiers the mockup's table shows. MRP is real (29% filled); the mockup's
    // UID and MPP columns have no Zoho field behind them and are left out rather than faked.
    mrp: set(deal.MRP_No) ? clean(deal.MRP_No) : '',
    dispatchOn: deal.Dispatch_Date ?? null,
    installStartOn: deal.Actual_installation_start_date ?? null,
    installationManager: set(deal.Installation_Managers) ? clean(deal.Installation_Managers) : '',
    amount,
    amountLabel: amount > 0 ? inr(amount) : '',
    createdAt: deal.Created_Time ?? null
  };
}

// ---------------------------------------------------------------------------
// Milestone dates, off the stage ledger
// ---------------------------------------------------------------------------
// The detail table wants a date against each gate — production sign-off, PDI approved, finance,
// installation — and Zoho's own fields for all four are empty (Production_Drawing_Signoff_done,
// PDI_Visit_done, Ready_For_Dispatch_done: zero rows across the module). DealHistory has them: the
// first time an order entered the stage IS the date that gate was passed.
//
// A gate the order has never reached comes back null, which the table prints as "Pending" — the
// mockup's own wording — and never as a guessed date.
const firstEntry = (entry, stages) => {
  if (!entry?.entries?.length) return null;
  const want = new Set(stages.map(lower));
  const hit = entry.entries.find((step) => want.has(step.stageKey) && step.enteredAt);
  return hit?.enteredAt ?? null;
};

function milestonesOf(entry) {
  return {
    signoffOn: firstEntry(entry, PRODUCTION_SIGNOFF),
    pdiOn: firstEntry(entry, PDI_APPROVED),
    financeOn: firstEntry(entry, FINANCE_APPROVED),
    installOn: firstEntry(entry, INSTALLED),
    dispatchedOn: firstEntry(entry, DISPATCHED)
  };
}

// The due window, measured against the order's Dispatch Date. The mockup coloured every row by this
// and it is the one deadline Zoho actually records (24% of orders carry it).
function windowOf(due) {
  if (!due) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const when = Date.parse(due);
  if (!Number.isFinite(when)) return null;
  if (when < today) return 'past';
  const days = (when - today) / 86_400_000;
  if (days <= 7) return 'week';
  if (new Date(when).getMonth() === now.getMonth() && new Date(when).getFullYear() === now.getFullYear()) return 'month';
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const after = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  if (when >= next.getTime() && when < after.getTime()) return 'next';
  return 'later';
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
const sumOf = (records) => records.reduce((total, record) => total + (Number(record.amount) || 0), 0);

// The DUE strip under every card, exactly as the mockup draws it: this week, this month, next
// month, and how many are already past.
//
// The mockup's basis is the order's dispatch date, and that is what is used here — Deals.Dispatch_Date.
// Be aware of what that means on live data: the field records when an order WENT OUT, not when it is
// due to, and all 1,836 that carry one are in the past (2017 to 3 Sep 2026, none in the future). So
// This week / This month / Next month read zero and everything with a date lands in `past`. The
// strip is faithful to the design and to the data at the same time; filling it needs a planned
// dispatch date, which Zoho does not currently keep.
function dueWindow(records) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekEnd = today + 7 * 86_400_000;
  const month = now.getMonth();
  const year = now.getFullYear();
  const next = new Date(year, month + 1, 1);
  const after = new Date(year, month + 2, 1);
  const counts = { week: 0, month: 0, next: 0, past: 0, none: 0 };
  for (const record of records) {
    const due = record.dispatchOn ? Date.parse(record.dispatchOn) : null;
    if (!Number.isFinite(due)) { counts.none += 1; continue; }
    if (due < today) { counts.past += 1; continue; }
    if (due <= weekEnd) counts.week += 1;
    const when = new Date(due);
    if (when.getMonth() === month && when.getFullYear() === year) counts.month += 1;
    else if (due >= next.getTime() && due < after.getTime()) counts.next += 1;
  }
  return counts;
}

const card = (records, extra = {}) => {
  const value = sumOf(records);
  return {
    ...extra,
    count: records.length,
    // The funnel cards print the money beside the count, so it travels with every card and with
    // every city row rather than being fetched separately.
    value,
    valueLabel: value > 0 ? inr(value) : '',
    ids: records.map((record) => record.id),
    due: dueWindow(records),
    byCity: cityRows(records, (mine, row) => ({
      ...row, count: mine.length, value: sumOf(mine), ids: mine.map((r) => r.id)
    }))
  };
};

function resolveCity(requested, records) {
  const asked = clean(requested);
  if (!asked || /^all$/i.test(asked)) return { key: 'all', matches: () => true };
  const bucket = CITY_KEYS.find((key) => key.toLowerCase() === asked.toLowerCase());
  if (bucket) return { key: bucket, matches: (record) => record.cityKey === bucket };
  const name = cityNameKeyOf(asked);
  if (records.some((record) => record.cityNameKey === name)) {
    return { key: name, matches: (record) => record.cityNameKey === name };
  }
  return { key: 'all', matches: () => true };
}

function cityFilters(records) {
  const options = new Map();
  records.filter((record) => record.cityKey === OTHER_CITY_KEY).forEach((record) => {
    const entry = options.get(record.cityNameKey)
      ?? { key: record.cityNameKey, label: cityNameLabelOf(record.city), count: 0 };
    entry.count += 1;
    options.set(record.cityNameKey, entry);
  });
  return CITY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: records.filter((record) => record.cityKey === bucket.key).length,
    ...(bucket.key === OTHER_CITY_KEY
      ? { options: [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }
      : {})
  }));
}

function applyCityMerge(records) {
  const counts = new Map();
  records.forEach((record) => counts.set(record.city, (counts.get(record.city) ?? 0) + 1));
  const merged = mergeCityNames(counts);
  if (!merged.size) return;
  records.forEach((record) => {
    const winner = merged.get(record.city);
    if (!winner) return;
    record.city = winner;
    record.cityNameKey = cityNameKeyOf(winner);
    record.cityKey = cityBucketOf(winner);
  });
}

/**
 * One card, with both figures.
 *
 * A card the CRM cannot answer (`available: false`) comes back at zero carrying its reason, so the
 * board can show it greyed with an explanation instead of a bare 0 that reads as "none happened".
 */
function buildCard(definition, { orders, byId, history, tf, matches }) {
  const { key, label, tone, sub, stages, field, all, available, why } = definition;
  if (available === false) {
    return {
      key, label, tone, sub, available: false, why, count: 0, sitting: 0, ids: [],
      due: { week: 0, month: 0, next: 0, past: 0, none: 0 },
      byCity: cityRows([], (mine, row) => ({ ...row, count: 0, ids: [] }))
    };
  }

  const pick = () => {
    // The whole population, which is already the booked orders — see buildDispatchBoard.
    if (all) return orders;
    if (field === 'dispatchOn') return orders.filter((order) => order.dispatchOn);
    if (field === '!dispatchOn') return orders.filter((order) => !order.dispatchOn);
    const wanted = new Set((stages ?? []).map(lower));
    return orders.filter((order) => wanted.has(order.stageKey));
  };
  const stock = pick();

  // FLOW. Only stage-based cards have one — "assigned orders" is a field test, not an event, so it
  // has no dated equivalent and is honestly reported as a stock figure.
  let flow = null;
  let before = null;
  if (history && tf && stages?.length) {
    const pickFlow = (previous) => enteredDuring(history, stages, tf, { previous })
      .map((hit) => byId.get(hit.id))
      .filter((order) => order && matches(order));
    flow = pickFlow(false);
    before = pickFlow(true);
  }

  return {
    ...card(flow ?? stock, { key, label, tone, sub }),
    basis: flow ? 'entered' : 'sitting',
    sitting: stock.length,
    // The funnel's "vs last period" line. Only flow cards have an honest comparison: a stock figure
    // is today's queue and there is no stored yesterday to set it against.
    ...(before ? { previous: before.length } : {}),
    available: true
  };
}

// ---------------------------------------------------------------------------
// Complaints — AMS_Complaints
// ---------------------------------------------------------------------------
const COMPLAINT_FIELDS = [
  'Name', 'Record_Type', 'Complaint_From', 'Raised_By_Installation', 'Status', 'Stage',
  'Complaint_ID', 'Complaint_Date', 'AMS_Date', 'AMS_Completed_Date', 'Priority',
  'Client_Name', 'Client_Address_City', 'Order_Names', 'Total_Cost', 'Created_Time'
].join(',');

export async function getComplaints() {
  const rows = [];
  let pageToken;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 10 && !pageToken) break;
    const payload = await zohoGet('AMS_Complaints', {
      fields: COMPLAINT_FIELDS, per_page: 200, sort_by: 'Created_Time', sort_order: 'desc',
      ...(page > 10 ? { page_token: pageToken } : { page })
    });
    rows.push(...(payload.data ?? []));
    pageToken = payload.info?.next_page_token;
    if (!payload.info?.more_records) break;
  }
  return rows;
}

function toTicket(row) {
  const city = canonicalCityName(row.Client_Address_City);
  // Complaint_Date is the complaint's own date; AMS records carry AMS_Date instead. Created_Time is
  // the last resort so a ticket is never undated, which would silently drop it from every period.
  const raisedOn = row.Complaint_Date ?? row.AMS_Date ?? row.Created_Time ?? null;
  const closedOn = row.AMS_Completed_Date ?? null;
  return {
    id: String(row.id ?? ''),
    name: row.Client_Name?.name ?? (clean(row.Name) || 'Unnamed'),
    ref: clean(row.Complaint_ID),
    type: clean(row.Record_Type),
    // Where it came IN from. NOT who caused it — the mockup's "at fault by department" has no field
    // in Zoho, and calling this fault would be inventing an accusation.
    source: clean(row.Complaint_From),
    raisedBy: clean(row.Raised_By_Installation),
    status: clean(row.Status),
    stage: clean(row.Stage),
    priority: clean(row.Priority),
    city,
    cityRaw: clean(row.Client_Address_City),
    cityKey: cityBucketOf(city),
    cityNameKey: cityNameKeyOf(city),
    orders: clean(row.Order_Names),
    cost: num(row.Total_Cost),
    raisedOn,
    closedOn,
    // Completed per the Status picklist, which is what the team actually maintains.
    done: /^(completed|qa done)$/i.test(clean(row.Status)),
    daysOpen: closedOn ? daysBetween(raisedOn, closedOn) : daysSince(raisedOn)
  };
}

const tally = (rows, keyOf, order) => {
  const counts = new Map();
  for (const row of rows) {
    const key = keyOf(row) || 'Not recorded';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = (order ?? []).map((key) => ({ key, count: counts.get(key) ?? 0 }));
  const extra = [...counts].filter(([key]) => !(order ?? []).includes(key))
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return [...known, ...extra].filter((row) => row.count > 0 || (order ?? []).includes(row.key));
};

function buildComplaints(rows, tf, matches) {
  const all = rows.map(toTicket).filter(matches);
  applyCityMerge(all);
  const complaints = all.filter((ticket) => !/^ams$/i.test(ticket.type));
  const raised = complaints.filter((ticket) => ticket.raisedOn && tf.matches(ticket.raisedOn));
  const raisedBefore = complaints.filter((ticket) => ticket.raisedOn && tf.previousMatches(ticket.raisedOn));
  // CLOSURE IS THE STATUS, NOT THE DATE. AMS_Completed_Date is filled on 1 of the 3,388 rows in the
  // module, so a date-based test reported every complaint as open forever — including the 48 marked
  // Completed. Status is the only signal that is actually maintained, and it carries no date, so
  // "closed" is a live count and cannot be filtered by period.
  const closed = complaints.filter((ticket) => ticket.done);
  const openNow = complaints.filter((ticket) => !ticket.done);
  const aging = openNow.filter((ticket) => (ticket.daysOpen ?? 0) >= COMPLAINT_AGING_DAYS);
  // Time to resolve needs both ends. With one completion date in the whole module there is nothing
  // to average, so the figure says so rather than reporting a mean of one.
  const resolveDays = complaints.filter((t) => t.done && t.closedOn)
    .map((ticket) => daysBetween(ticket.raisedOn, ticket.closedOn)).filter((days) => days !== null);
  const average = resolveDays.length >= 5
    ? resolveDays.reduce((sum, days) => sum + days, 0) / resolveDays.length
    : null;

  return {
    cards: [
      { key: 'raised', label: 'Complaints raised', tone: 'blue', sub: 'Raised in this period', ...card(raised), previous: raisedBefore.length },
      { key: 'closed', label: 'Closed', tone: 'green', sub: 'Marked Completed in Zoho, whenever raised', ...card(closed), basis: 'sitting' },
      { key: 'open', label: 'Still open', tone: 'amber', sub: 'Not yet Completed, whenever raised', ...card(openNow), basis: 'sitting' },
      {
        key: 'aging',
        label: 'Aging alerts',
        tone: 'red',
        sub: `Open ${COMPLAINT_AGING_DAYS} days or more`,
        ...card(aging),
        basis: 'sitting'
      }
    ],
    average: {
      key: 'resolve',
      label: 'Avg days to resolve',
      value: average,
      figure: average === null ? null : average.toFixed(1),
      unit: 'days',
      count: resolveDays.length,
      of: closed.length,
      available: average !== null,
      note: average === null
        ? `Not measurable: only ${resolveDays.length} of the ${closed.length.toLocaleString('en-IN')} closed complaints carry a completion date. Zoho's AMS/Complaint Completed Date is filled on 1 record in the whole module.`
        : `Averaged over the ${resolveDays.length.toLocaleString('en-IN')} of ${closed.length.toLocaleString('en-IN')} closed complaints that carry both dates`
    },
    breakdown: {
      status: tally(openNow, (t) => t.status, COMPLAINT_STATUSES),
      stage: tally(openNow, (t) => t.stage, COMPLAINT_STAGES),
      priority: tally(openNow, (t) => t.priority, COMPLAINT_PRIORITIES),
      source: tally(raised, (t) => t.source, COMPLAINT_SOURCES)
    },
    coverage: {
      tickets: complaints.length,
      amsVisits: all.length - complaints.length,
      agingDays: COMPLAINT_AGING_DAYS,
      moduleNote: 'AMS_Complaints holds both AMS visits and complaints. Of its 3,388 rows only 124 '
        + 'are complaints; the rest are AMS visits and belong to the AMS board, so they are excluded here.',
      unavailable: [
        'Closure has no date. AMS/Complaint Completed Date is filled on 1 of 3,388 rows, so Closed and Still open are live counts off the Status field and cannot be filtered by period.',
        'Department routing (Design / Factory / Installation / Services) is not modelled in Zoho.',
        'The per-hop SLA table has no source — there is no field recording a hand-off between teams.',
        '"At fault by department" is not recorded. Complaint From says where a complaint came in from, not who caused it, and is shown as "Raised from".'
      ]
    },
    records: complaints.map(({ cityNameKey, ...ticket }) => ({ ...ticket, board: 'complaints' }))
  };
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
/**
 * @param deals       every Zoho Deal
 * @param complaints  every AMS_Complaints row
 * @param tf          the selected period
 * @param city        all | DEL | HYD | OTHER | one city's name
 * @param history     the DealHistory index from indexByRecord(), for the flow figures
 */
export function buildDispatchBoard({ deals = [], complaints = [], tf, city, history = null, notice = null }) {
  // THE POPULATION: booked orders only. A dispatch board is about orders that exist to be made and
  // delivered, and rank 3 is Order Booked with 4 past it. Scoping here rather than per card is what
  // makes the cards reconcile — with the whole module in scope, "assigned" plus "unassigned" summed
  // to 7,618 under a "Total orders" card reading 2,746, and the popup was shipping every record in
  // the CRM.
  const booked = (deals ?? []).filter(isRealDeal).map(toOrder).filter((order) => rankOf(order.stage) >= 3);
  applyCityMerge(booked);
  const selected = resolveCity(city, booked);
  const inView = booked.filter(selected.matches);
  const byId = new Map(booked.map((order) => [order.id, order]));
  const context = { orders: inView, byId, history, tf, matches: selected.matches };

  const views = DISPATCH_VIEWS.map((view) => {
    const cards = view.cards.map((definition) => buildCard(definition, context));
    // A SHARE IS ONLY SHOWN WHERE IT IS REALLY A PROPORTION.
    //
    // The mockup put "% of total orders" on every Planner card and "% of pdi approved" on every
    // Scheduler card, and on its generated data that worked because each stage was a strict subset
    // of the one before. On live Zoho it is not: these cards count orders that ENTERED a stage in
    // the period, and an order can enter "Finance approved" this month having passed PDI months
    // ago. Dividing anyway produced 200%, 233% and 235% — a percentage larger than its own whole.
    //
    // So the denominator is tested rather than assumed: the share appears only when the card's
    // orders are genuinely contained in the base card's. Where they are not, the card goes without
    // a share and without a bar, which is the honest reading — the two stages are sequential, not
    // nested, and there is no whole for the part to be of.
    const baseIds = new Set(cards[0]?.ids ?? []);
    const base = cards[0]?.count ?? 0;
    return {
      key: view.key,
      name: view.name,
      desc: view.desc,
      baseLabel: view.cards[0]?.label ?? '',
      columns: view.columns ?? view.cards.map((entry) => [entry.key]),
      cards: cards.map((entry) => {
        const nested = base > 0 && entry.available !== false
          && (entry.ids ?? []).every((id) => baseIds.has(id));
        return { ...entry, share: nested ? entry.count / base : null };
      })
    };
  });

  const ticketView = buildComplaints(complaints, tf, () => true);
  // Every order any card points at, so a popup always has rows behind the ids it was given.
  const referenced = new Set(views.flatMap((view) => view.cards.flatMap((entry) => entry.ids ?? [])));

  return {
    meta: {
      reportLabel: tf?.reportLabel ?? null,
      // What the cards' "vs" line is measured against, worded by the period the same way the other
      // boards word it.
      previousLabel: tf?.previousLabel ?? null,
      city: selected.key,
      periodApplies: Boolean(history && tf),
      coverage: {
        orders: inView.length,
        populationRule: 'Booked orders only (Zoho Stage at Order Booked or past it). Raw quotes, live leads and dead records are not on this board.',
        stageSource: history
          ? 'DealHistory — each card leads with the orders that entered its stage in the period, and keeps the live count beside it'
          : 'Deals.Stage snapshot only — the stage ledger could not be read',
        emptyFields: [
          'Est_PDI_Date / Expected_PDI_date / Aligned_PDI_date', 'Handover_to_Factory',
          'Est_Dispatch_Factory_Date', 'Ready_For_Dispatch_open / received / done',
          'Dispatch_open / received / done', 'Installation_open / received / done',
          'Installation_done', 'PDI_Done', 'PDI_Status', 'Production_Drawing_Status'
        ],
        filled: [
          { field: 'MRP_No', filled: 2172 },
          { field: 'Dispatch_Date', filled: 1850 },
          { field: 'Designer_Name', filled: 3231 },
          { field: 'Value', filled: 5173 }
        ],
        checkedOrders: 7618,
        unavailableCards: DISPATCH_VIEWS
          .flatMap((view) => view.cards.filter((entry) => entry.available === false)
            .map((entry) => ({ view: view.name, card: entry.label, why: entry.why })))
      },
      complaints: ticketView.coverage,
      notice
    },
    filters: { cities: cityFilters(booked) },
    views,
    complaints: ticketView,
    records: inView.filter((order) => referenced.has(order.id))
      .map(({ cityNameKey, stageKey, ...order }) => ({
        ...order,
        board: 'dispatch',
        ...milestonesOf(history?.get(order.id)),
        window: windowOf(order.dispatchOn)
      }))
  };
}
