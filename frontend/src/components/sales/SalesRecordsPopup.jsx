import { CalendarDays, PieChart, Table2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SortSelect, SortTh, TableSearch, amountOf, timeOf, useTableTools } from '../tableTools.jsx';
import { Donut, slicesFrom } from './SalesRecordsChart.jsx';
import { WeeklyView } from './WeeklyView.jsx';
import { crmRecordUrl } from '../../config/crm.js';

// The records behind a card on the Lead generation / Sales performance sections. Same popup shell as the
// PSM board (full screen on a phone, Escape closes), the same Table / Pie chart switch opening on the
// chart, and the same search and sortable columns.
//
// The two closure cards get a table of their own — different columns, different filters, different
// charts — because they are read as an order list rather than a lead list. Every other card keeps the
// columns it had.
const PAGE = 25;
const NA = <span className="lf-na">NA</span>;
const show = (value) => (value === null || value === undefined || value === '' || value === '—' ? NA : value);
const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : null);

const text = (value) => (typeof value === 'string' ? value.trim() : value ? String(value) : '');

const clientCell = (row) => (
  <a className="lf-record-link" href={crmRecordUrl('Contacts', row.id)} target="_blank" rel="noopener noreferrer" title="Open this record in Zoho CRM">
    {row.name}
  </a>
);

// `city` is the canonical name the backend folds every spelling into; `cityRaw` is what the CRM actually
// holds. When they differ, the original is on the cell's tooltip so nothing is hidden from anyone
// checking a record against Zoho.
const cityCell = (row) => {
  const city = text(row.city);
  if (!city) return NA;
  const raw = text(row.cityRaw);
  return raw && raw !== city ? <span title={`Entered in Zoho as “${raw}”`}>{city}</span> : city;
};

// [heading, cell, hint, value to sort by]. A column with no fourth entry cannot be sorted.
const COLUMNS = [
  ['Client', clientCell, 'Opens the qualified lead in Zoho CRM', (row) => row.name],
  ['City', cityCell, 'City on the qualified lead, with the CRM’s own spelling on hover where it differs', (row) => row.city],
  ['PSM', (row) => show(row.psm), 'Sales Manager field: the PSM who qualified the lead', (row) => row.psm],
  ['Sales person', (row) => show(row.owner), 'Record owner in Zoho', (row) => row.owner],
  ['Source', (row) => show(row.source), 'Lead Source in Zoho', (row) => row.source],
  ['Current stage', (row) => (
    <span className="lt-stack">
      <span>{show(row.stage)}</span>
      {row.stageKey && <small>{row.stageKey}</small>}
    </span>
  ), 'Current Stage (Client Status) in Zoho', (row) => row.stageKey ?? row.stage],
  ['Value', (row) => show(row.valueLabel), 'Value in Zoho: Total Opportunity Value, or BD Value when that is empty', (row) => amountOf(row.value)],
  ['Created', (row) => show(stamp(row.createdAt)), 'When the qualified lead was created in Zoho (IST)', (row) => timeOf(row.createdAt)],
  ['Closed on', (row) => show(stamp(row.closedOn)), 'Actual Closure Date in Zoho', (row) => timeOf(row.closedOn)]
];

// ---- The closure cards -------------------------------------------------------------------------
// These four fields are newer than the rest of the payload, so each falls back to what the record
// already carried rather than rendering an empty cell.
const personOf = (row) => text(row.salesPerson) || text(row.owner);
const productOf = (row) => text(row.product);
const statusOf = (row) => text(row.status) || text(row.stage);
// Blank on roughly three records in four, so it says so rather than reading as a missing cell.
const productCell = (row) => productOf(row) || <span className="lf-na">Not recorded</span>;

const CLOSURE_COLUMNS = [
  ['Client name', clientCell, 'Opens the record in Zoho CRM', (row) => row.name],
  ['Salesperson assigned', (row) => show(personOf(row)), 'Record owner in Zoho', (row) => personOf(row)],
  ['Product', productCell, 'Product Requirement in Zoho, or Product Type when that is empty', (row) => productOf(row)],
  ['Status', (row) => show(statusOf(row)), 'Stage in Zoho, which the CRM labels Status', (row) => statusOf(row)],
  ['Value', (row) => show(row.valueLabel), 'Value in Zoho: Total Opportunity Value, or BD Value when that is empty', (row) => amountOf(row.value)],
  ['Estimated closure date', (row) => show(stamp(row.estClosureDate)), 'Estimated closure date in Zoho', (row) => timeOf(row.estClosureDate)]
];

// ---- The pre-design cards ----------------------------------------------------------------------
// The Design board opens its cards in this same popup, and its records are a different animal: `value`
// there is FLOOR AREA IN SQUARE FEET, so it is never given a ₹ sign. The rupee figure rides separately
// on `amount` (Deals.Value, the one money field Zoho fills on an order), which is why the two get
// their own columns rather than sharing one.
const REVISION_LIMIT = 3; // the limit PreDesignFlow measures orders against
const notRecorded = <span className="lf-na">Not recorded</span>;
const told = (value) => (value === null || value === undefined || value === '' ? notRecorded : value);
const designerOf = (row) => text(row.designer);
const areaOf = (row) => {
  const area = Number(row?.value);
  return Number.isFinite(area) && area > 0 ? area : null;
};
// Only the Post_* production fields are ACTUAL area — 88 orders of 7,629. Everything else is an
// estimate, and the tier is shown beside the figure so a design estimate is never read as a
// measured one. The rule and the tiers come from the 29 Sep handoff pack.
const AREA_TIER_LABEL = {
  actual: 'actual',
  post: 'actual',
  revision: 'revision estimate',
  design: 'design estimate',
  order: 'order estimate'
};
const areaCell = (row) => {
  const area = areaOf(row);
  if (area === null) return notRecorded;
  const tier = AREA_TIER_LABEL[row?.areaTier];
  return (
    <span className="sr-area">
      {area.toLocaleString('en-IN')} sq ft
      {tier && <small className={row.areaTier === 'actual' ? 'is-actual' : undefined}>{tier}</small>}
    </span>
  );
};
// Deals.Value, already worded by the API. It fills as the order is booked, so it is blank on most of
// the chain — said as "Not recorded" rather than as ₹0, which would read as a free order.
const orderValueOf = (row) => {
  const amount = Number(row?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
const revisionsOf = (row) => (Number.isFinite(Number(row?.revisions)) ? Number(row.revisions) : null);
const revisionBandOf = (row) => {
  const count = revisionsOf(row);
  if (count === null) return 'unknown';
  if (count <= 0) return 'none';
  return count > REVISION_LIMIT ? 'over' : 'within';
};

// The SM on the order's qualified lead. Not the order owner — Zoho names a different person in
// each on 53% of orders — so the two are shown as separate columns and never conflated.
const smOf = (row) => text(row.sm);

const DESIGN_COLUMNS = [
  ['Project / client', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('Deals', row.id)} target="_blank" rel="noopener noreferrer" title="Open this order in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the order in Zoho CRM', (row) => row.name],
  ['SM', (row) => told(smOf(row)), 'Sales Manager on the qualified lead this order came from (Contacts.Sales_Manager). The Orders module has no SM field of its own.', smOf],
  ['Designer', (row) => told(designerOf(row)), 'Designer assigned to the order in Zoho', designerOf],
  ['Sales person', (row) => told(text(row.owner)), 'Order Owner in Zoho — a different person from the SM on about half of orders', (row) => row.owner],
  ['Area (sq ft)', areaCell, 'Floor area. Only the post-production fields are actual — everything else is an estimate, and the tier is shown under the figure.', areaOf],
  ['Order value', (row) => told(row.amountLabel || null), 'Value on the order in Zoho, in lakhs. It fills as the order is booked, so it is blank earlier in the funnel', orderValueOf],
  ['Stage', (row) => told(text(row.stage)), 'Stage of the order in Zoho', (row) => row.stage],
  ['Revisions', (row) => told(revisionsOf(row)), `Design revisions logged against the order; the limit is ${REVISION_LIMIT}`, revisionsOf],
  ['Design sent on', (row) => told(stamp(row.designSentOn)), 'When the design was sent to the client (IST)', (row) => timeOf(row.designSentOn)]
];

// Which table a card gets.
//
// Closure cards are the estimates for this period, the orders already past their estimated date, and the
// city rows under either — those hold the same records as the card above, so they open the same columns.
// SalesPerformance builds a city row's id as `${groupId}-${city.key}`, so matching the id or that one
// separator covers both without catching `closed`, `principal` or the S1–S5 stages.
const CLOSURE_CARDS = ['estClosure', 'overdue'];
const isClosureCard = (id = '') => CLOSURE_CARDS.some((key) => id === key || id.startsWith(`${key}-`));

// Pre-design cards are `intake`, `firstDesign`, `revisions`, `booked` and `handover` (plus `intake-*` and
// `revisions-*` sub-rows) — but `handover` is ALSO a card id on Sales performance, so the id alone cannot
// tell the two boards apart. The records can: only the Design board's carry a `designer` field.
const isDesignRecords = (records) => records.some((row) => row && row.designer !== undefined);

const sortFieldsOf = (columns) => Object.fromEntries(columns.filter((column) => column[3]).map((column) => [column[0], column[3]]));
const sortOptionsOf = (columns) => columns.filter((column) => column[3]).map((column) => [column[0], column[0]]);
// ---- Filters -----------------------------------------------------------------------------------
// Two kinds, and both tables are described with them rather than either branch hard-coding its bar:
//   list — one entry per value present in the rows, each counted
//   band — a fixed set of choices decided by a predicate (only Value needs this)
const ALL = 'all';
const NONE = '\u0000'; // option key for "Not recorded", which is a real choice rather than the absence of one
const VALUE_BREAK = 2_000_000; // ₹20 L

const list = (key, label, allLabel, valueOf) => ({ kind: 'list', key, label, allLabel, valueOf });
const band = (key, label, allLabel, bandOf, options) => ({ kind: 'band', key, label, allLabel, bandOf, options });

const rupeesOf = (row) => {
  const amount = Number(row?.value);
  return Number.isFinite(amount) ? amount : 0;
};
// Exactly two bands, as asked. A record with no value recorded cannot be called a big deal, so it sits
// with the small ones — and the option label says so in as many words.
const valueBandOf = (row) => (rupeesOf(row) > VALUE_BREAK ? 'high' : 'low');

// The ladder code is what the team uses day to day and what the card labels on Sales performance say, so
// the dropdown lists S1…S6; DEAD and closed carry a readable label of their own on the record.
const stageOf = (row) => {
  const key = text(row.stageKey);
  if (!key) return text(row.stage);
  return /^s\d$/i.test(key) ? key.toUpperCase() : text(row.stage) || key;
};

const TABLES = {
  // The search stays broad here — a dropdown cannot cover a client's name, and the columns it matches are
  // the ones the placeholder names.
  lead: {
    columns: COLUMNS,
    search: (row) => [row.name, row.id, row.city, row.psm, row.owner, row.source, row.stage, row.valueLabel].filter(Boolean).join(' '),
    placeholder: 'Search client, city, PSM, source, stage…',
    searchLabel: 'Search client, city, PSM, source and stage',
    filters: [
      list('psm', 'PSM', 'All PSMs', (row) => text(row.psm)),
      list('owner', 'Sales person', 'All salespeople', (row) => text(row.owner)),
      list('stage', 'Current stage', 'All stages', stageOf),
      list('source', 'Source', 'All sources', (row) => text(row.source)),
      list('city', 'City', 'All cities', (row) => text(row.city))
    ],
    // What is actually in a lead card: where the leads have got to, where they came from, who holds them.
    chart: ['stage', 'source', 'psm']
  },
  // Product, status, salesperson and value each have a control of their own, so the box is left to do one
  // job: find a client.
  closure: {
    columns: CLOSURE_COLUMNS,
    search: (row) => [row.name, row.id].filter(Boolean).join(' '),
    placeholder: 'Search client name…',
    searchLabel: 'Filter by client name',
    filters: [
      band('value', 'Value', 'All values', valueBandOf, [
        ['high', 'Above ₹20 L'],
        ['low', '₹20 L or below, incl. not recorded']
      ]),
      list('product', 'Product', 'All products', productOf),
      list('person', 'Salesperson', 'All salespeople', personOf)
    ],
    // What is actually in a closure card: whose orders, what they are for, how big they are.
    chart: ['person', 'product', 'value']
  },
  // The Design board's orders: counted per card, with the floor area and the order value beside each.
  design: {
    columns: DESIGN_COLUMNS,
    search: (row) => [row.name, row.id, row.designer, row.owner, row.stage, row.city, row.amountLabel].filter(Boolean).join(' '),
    placeholder: 'Search project, designer, sales person…',
    searchLabel: 'Search project, designer, sales person, stage and city',
    filters: [
      list('sm', 'SM', 'All SMs', smOf),
      list('designer', 'Designer', 'All designers', designerOf),
      list('stage', 'Stage', 'All stages', (row) => text(row.stage)),
      list('city', 'City', 'All cities', (row) => text(row.city)),
      band('revisions', 'Revisions', 'Any number of revisions', revisionBandOf, [
        ['none', 'No revisions yet'],
        ['within', `1 to ${REVISION_LIMIT}`],
        ['over', `Over the ${REVISION_LIMIT}-revision limit`],
        ['unknown', 'Not recorded']
      ])
    ],
    // SM first: the customer asked for a pie of SMs on every pre-design card, and the pie view
    // draws one donut per dimension listed here.
    chart: ['sm', 'stage', 'designer', 'revisions']
  }
};
// ---------------------------------------------------------------------------
// POST-DESIGN — one column set per card, instead of one for the whole board
// ---------------------------------------------------------------------------
// Every post-design card used to open TABLES.design: Project, Designer, Sales person, Area, Order
// value, Stage, Revisions, Design sent on. Two of those columns are pre-design milestones that mean
// nothing once an order has left design — Revisions is a design metric and Design sent on is the
// first-design date — and Order value is blank on most of the board. So a Payment pending card
// listed revision counts and an EP approval card listed floor area, while neither showed the one
// thing a queue board is for: how long each order has been stuck.
//
// These five columns are on EVERY post-design card, because they are what the board is about:
// which order, where, what stage it is on, when it got there, and how long it has sat.
const postBase = [
  ['Project / client', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('Deals', row.id)} target="_blank" rel="noopener noreferrer" title="Open this order in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the order in Zoho CRM', (row) => row.name],
  ['City', (row) => told(text(row.city)), 'City on the order in Zoho', (row) => row.city],
  ['Stage', (row) => told(text(row.stage)), 'The order’s current stage in Zoho', (row) => row.stage],
  ['Entered stage', (row) => told(stamp(row.enteredAt)), 'When the order moved onto its current stage, from the Zoho stage history', (row) => timeOf(row.enteredAt)],
  ['Days here', (row) => (Number.isFinite(Number(row.daysHere))
    ? <span className={Number(row.daysHere) >= 30 ? 'sr-stale' : undefined}>{Number(row.daysHere).toLocaleString('en-IN')}</span>
    : notRecorded),
  'How long it has been on that stage. 30 days or more is marked.', (row) => (Number.isFinite(Number(row.daysHere)) ? Number(row.daysHere) : null)]
];

// What each card adds on top, and nothing more. The rule: a column earns its place only if the
// card’s own title is about it.
const designerCol = ['Designer', (row) => told(designerOf(row)), 'Designer on the order in Zoho', designerOf];
const ownerCol = ['Sales person', (row) => told(text(row.owner)), 'Record owner in Zoho', (row) => row.owner];
const areaCol = ['Area (sq ft)', areaCell, 'Floor area on the order: Area (Sqft), falling back to Cabinet Area (Sqft)', areaOf];
const valueCol = ['Order value', (row) => told(row.amountLabel || null), 'Value on the order in Zoho, in lakhs', orderValueOf];

const smCol = ['SM', (row) => told(smOf(row)), 'Sales Manager on the qualified lead this order came from', smOf];

const POST_EXTRAS = {
  // Who picked the order up, and who owns it — a handover queue is a question about people.
  handover: [designerCol, ownerCol],
  firstVisit: [designerCol],
  epPrep: [designerCol],
  epApproval: [designerCol],
  epMarking: [designerCol],
  // Production needs to know how much there is to make, and what it is worth.
  productionPrep: [areaCol, valueCol],
  pdi: [areaCol],
  // The one card that is entirely about money.
  payment: [valueCol, ownerCol],
  factory: [areaCol, valueCol]
};

// A city cell is `${cardKey}-DEL`, a sub-card `${cardKey}-done`; both keep the card’s columns.
const postCardKey = (id = '') => String(id).split('-')[0];
const isPostDesignRecords = (records) => records.some((row) => row && row.board === 'post-design');

const POST_TABLES = Object.fromEntries(Object.entries(POST_EXTRAS).map(([key, extras]) => [key, {
  columns: [...postBase, ...extras],
  search: (row) => [row.name, row.id, row.city, row.stage, row.designer, row.owner].filter(Boolean).join(' '),
  placeholder: 'Search project, city, stage, designer…',
  searchLabel: 'Search project, city, stage, designer and sales person',
  filters: [
    list('stage', 'Stage', 'All stages', (row) => text(row.stage)),
    list('city', 'City', 'All cities', (row) => text(row.city)),
    band('aging', 'Waiting', 'Any time on stage', (row) => {
      const days = Number(row?.daysHere);
      if (!Number.isFinite(days)) return 'unknown';
      if (days >= 30) return 'over30';
      if (days >= 7) return 'over7';
      return 'fresh';
    }, [
      ['fresh', 'Under a week'],
      ['over7', '7 days or more'],
      ['over30', '30 days or more'],
      ['unknown', 'Not recorded']
    ])
  ],
  chart: ['stage', 'city', 'aging']
}]));

// ---------------------------------------------------------------------------
// DISPATCH — orders, and complaints, each with the columns its own board is about
// ---------------------------------------------------------------------------
// Two record shapes arrive from /api/dispatch-board and they are nothing like each other: orders
// carry a stage and an MRP number, complaints carry a status and an age. Both are tagged with
// `board` so neither falls through to the leads table.
const DISPATCH_COLUMNS = [
  ['Order', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('Deals', row.id)} target="_blank" rel="noopener noreferrer" title="Open this order in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the order in Zoho CRM', (row) => row.name],
  // 29% filled, and the number the factory and transport actually quote.
  ['MRP No', (row) => told(text(row.mrp)), 'MRP number on the order in Zoho', (row) => row.mrp],
  ['City', (row) => told(text(row.city)), 'City on the order in Zoho', (row) => row.city],
  ['Stage', (row) => told(text(row.stage)), 'Current stage in Zoho', (row) => row.stage],
  ['Dispatch date', (row) => told(stamp(row.dispatchOn)), 'Dispatch Date in Zoho. Blank means the order is unassigned.', (row) => timeOf(row.dispatchOn)],
  ['Designer', (row) => told(text(row.designer)), 'Designer on the order', (row) => row.designer],
  ['Order value', (row) => told(row.amountLabel || null), 'Value on the order in Zoho, in lakhs', (row) => (Number(row?.amount) > 0 ? Number(row.amount) : null)]
];

const daysOpenOf = (row) => (Number.isFinite(Number(row?.daysOpen)) ? Number(row.daysOpen) : null);

const COMPLAINT_COLUMNS = [
  ['Client', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('AMS_Complaints', row.id)} target="_blank" rel="noopener noreferrer" title="Open this complaint in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the complaint in Zoho CRM', (row) => row.name],
  ['Complaint ID', (row) => told(text(row.ref)), 'Complaint ID in Zoho', (row) => row.ref],
  ['City', (row) => told(text(row.city)), 'Client city on the complaint', (row) => row.city],
  ['Priority', (row) => told(text(row.priority)), 'Priority in Zoho', (row) => row.priority],
  ['Status', (row) => told(text(row.status)), 'Status in Zoho. Completed and QA Done count as closed — the completion DATE is filled on one record in the whole module, so status is the only usable signal.', (row) => row.status],
  ['Stage', (row) => told(text(row.stage)), 'Stage in Zoho', (row) => row.stage],
  ['Raised on', (row) => told(stamp(row.raisedOn)), 'Complaint Date in Zoho', (row) => timeOf(row.raisedOn)],
  ['Days open', (row) => (daysOpenOf(row) === null
    ? notRecorded
    : <span className={daysOpenOf(row) >= 7 && !row.done ? 'sr-stale' : undefined}>{daysOpenOf(row).toLocaleString('en-IN')}</span>),
  'Days since it was raised. Seven days or more, still open, is marked.', daysOpenOf],
  ['Orders', (row) => told(text(row.orders)), 'Orders named on the complaint', (row) => row.orders]
];

const isDispatchRecords = (records) => records.some((row) => row && row.board === 'dispatch');
const isComplaintRecords = (records) => records.some((row) => row && row.board === 'complaints');

TABLES.dispatch = {
  columns: DISPATCH_COLUMNS,
  search: (row) => [row.name, row.id, row.mrp, row.city, row.stage, row.designer].filter(Boolean).join(' '),
  placeholder: 'Search order, MRP, city, stage, designer…',
  searchLabel: 'Search order, MRP number, city, stage and designer',
  filters: [
    list('stage', 'Stage', 'All stages', (row) => text(row.stage)),
    list('city', 'City', 'All cities', (row) => text(row.city)),
    list('designer', 'Designer', 'All designers', (row) => text(row.designer)),
    band('dispatch', 'Dispatch date', 'Assigned or not', (row) => (row?.dispatchOn ? 'set' : 'none'), [
      ['set', 'Dispatch date set'],
      ['none', 'No dispatch date']
    ])
  ],
  chart: ['stage', 'city', 'designer']
};

// ---- Installation ------------------------------------------------------------------------------
// The Installation board had no table of its own, so its records fell through to TABLES.lead and
// opened with PSM, Source and Lead value — none of which an order at an installation stage has. These
// are the columns its five cards are actually about.
const daysOnStageOf = (row) => (Number.isFinite(Number(row?.daysOnStage)) ? Number(row.daysOnStage) : null);

const INSTALLATION_COLUMNS = [
  ['Project / client', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('Deals', row.id)} target="_blank" rel="noopener noreferrer" title="Open this order in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the order in Zoho CRM', (row) => row.name],
  // THE COLUMN THIS TABLE WAS ASKED FOR. It reads Deals.Site_Not_Ready_Reason, which does not exist
  // in the CRM yet — so until it is created the column is empty on every row, and its tooltip says
  // why rather than leaving the reader to wonder whether nobody has filled it in.
  ['Site not ready reason', (row) => told(text(row.notReadyReason)), 'Why the site was not ready to install. Reads Deals.Site_Not_Ready_Reason — a field that does not exist in Zoho yet, so it is blank on every order until it is created.', (row) => row.notReadyReason],
  ['Stage', (row) => told(text(row.stage)), 'Stage of the order in Zoho', (row) => row.stage],
  ['Days on stage', (row) => (daysOnStageOf(row) === null
    ? notRecorded
    : <span className={daysOnStageOf(row) >= 5 ? 'sr-stale' : undefined}>{daysOnStageOf(row).toLocaleString('en-IN')}</span>),
  'How long the order has sat on its current stage, from the dated stage ledger. Five days or more is marked.', daysOnStageOf],
  ['Installation manager', (row) => told(text(row.manager)), 'Installation Managers on the order. Filled on 276 of 7,645 orders.', (row) => row.manager],
  ['City', (row) => told(text(row.city)), 'Client city on the order', (row) => row.city],
  ['Product', (row) => told(text(row.product)), 'Product Type — what the order split filter reads', (row) => row.product],
  ['Due (est. handover)', (row) => told(stamp(row.dueOn)), 'Est. Handover Date in Zoho. Filled on 129 of 7,645 orders.', (row) => timeOf(row.dueOn)],
  ['Order value', (row) => told(row.amountLabel || null), 'Value on the order in Zoho, in lakhs', (row) => (Number(row?.amount) > 0 ? Number(row.amount) : null)]
];

const isInstallationRecords = (records) => records.some((row) => row && row.board === 'installation');

TABLES.installation = {
  columns: INSTALLATION_COLUMNS,
  search: (row) => [row.name, row.id, row.city, row.stage, row.manager, row.product, row.notReadyReason].filter(Boolean).join(' '),
  placeholder: 'Search order, city, stage, manager, reason…',
  searchLabel: 'Search order, city, stage, installation manager, product and site not ready reason',
  filters: [
    list('stage', 'Stage', 'All stages', (row) => text(row.stage)),
    // Grouping by reason is the whole point of the column: it turns a list of sentences into
    // "41 waiting on civil work". It only earns its place once the field carries values, so the
    // dropdown is dropped entirely while every row is blank rather than offering one empty choice.
    list('reason', 'Site not ready reason', 'All reasons', (row) => text(row.notReadyReason)),
    list('city', 'City', 'All cities', (row) => text(row.city)),
    list('manager', 'Installation manager', 'All managers', (row) => text(row.manager)),
    list('product', 'Product', 'All products', (row) => text(row.product))
  ],
  chart: ['reason', 'stage', 'city', 'manager']
};

TABLES.complaints = {
  columns: COMPLAINT_COLUMNS,
  search: (row) => [row.name, row.ref, row.city, row.status, row.stage, row.priority, row.orders].filter(Boolean).join(' '),
  placeholder: 'Search client, complaint ID, city, status…',
  searchLabel: 'Search client, complaint ID, city, status, stage and priority',
  filters: [
    list('status', 'Status', 'All statuses', (row) => text(row.status)),
    list('priority', 'Priority', 'All priorities', (row) => text(row.priority)),
    list('city', 'City', 'All cities', (row) => text(row.city)),
    band('age', 'Open for', 'Any age', (row) => {
      const days = daysOpenOf(row);
      if (days === null) return 'unknown';
      if (days >= 30) return 'over30';
      if (days >= 7) return 'over7';
      return 'fresh';
    }, [
      ['fresh', 'Under a week'],
      ['over7', '7 days or more'],
      ['over30', '30 days or more'],
      ['unknown', 'Not recorded']
    ])
  ],
  chart: ['status', 'priority', 'city']
};

Object.values(POST_TABLES).forEach((entry) => {
  entry.fields = sortFieldsOf(entry.columns);
  entry.options = sortOptionsOf(entry.columns);
  entry.cleared = Object.fromEntries(entry.filters.map((filter) => [filter.key, ALL]));
});
Object.values(TABLES).forEach((entry) => {
  entry.fields = sortFieldsOf(entry.columns);
  entry.options = sortOptionsOf(entry.columns);
  entry.cleared = Object.fromEntries(entry.filters.map((filter) => [filter.key, ALL]));
});

const keyOf = (value) => value || NONE;
const valueIn = (filter, row) => (filter.kind === 'band' ? filter.bandOf(row) : keyOf(filter.valueOf(row)));
const passes = (row, filters, defs) => defs.every((filter) => {
  const chosen = filters[filter.key] ?? ALL;
  return chosen === ALL || valueIn(filter, row) === chosen;
});

// Options for one dropdown, counted over the rows the *other* filters leave — so each count is the number
// of rows that choosing it would actually show. The current choice is always listed, even at zero, so it
// can be seen and undone.
const optionsFor = (filter, rows, selected) => {
  const head = [ALL, filter.allLabel, rows.length];
  if (filter.kind === 'band') {
    return [head, ...filter.options.map(([key, label]) => [key, label, rows.filter((row) => filter.bandOf(row) === key).length])];
  }
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyOf(filter.valueOf(row));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  if (selected !== ALL && !counts.has(selected)) counts.set(selected, 0);
  const named = [...counts.entries()]
    .filter(([key]) => key !== NONE)
    .sort((a, b) => a[0].localeCompare(b[0], 'en-IN', { numeric: true, sensitivity: 'base' }))
    // The value doubles as the label: these are the names themselves.
    .map(([key, count]) => [key, key, count]);
  const blank = counts.get(NONE);
  return [head, ...named, ...(blank === undefined ? [] : [[NONE, 'Not recorded', blank]])];
};

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <label className="sr-filter" htmlFor={id}>
      <span className="sr-filter-label">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, name, count]) => (
          <option value={key} key={key}>{count === undefined ? name : `${name} (${count})`}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * The records behind a card, as a list, a chart or a week-by-week board.
 *
 * @param {object}   props.card     { id, label, ids } from whichever board was clicked
 * @param {Array}    props.records  that board's flat `records` array
 * @param {Array}   [props.weeks]   the payload's top-level `weeks`, for the Weekly view. A board that
 *                                  sends none simply has no Weekly option.
 * @param {Function} props.onClose  called when the popup should close
 */
export function SalesRecordsPopup({ card, records = [], weeks = [], onClose }) {
  // Post-design is asked first: its records carry `board`, so a card id that also exists on the
  // pre-design board (both have a `handover`) cannot pick up the wrong table.
  const isPost = isPostDesignRecords(records);
  const isComplaint = !isPost && isComplaintRecords(records);
  const isDispatch = !isPost && !isComplaint && isDispatchRecords(records);
  // Installation is asked before design and lead: its records carry no `designer`, so without this
  // they fell all the way through to TABLES.lead and opened with PSM and Source columns.
  const isInstall = !isPost && !isComplaint && !isDispatch && isInstallationRecords(records);
  const isDesign = !isPost && !isComplaint && !isDispatch && !isInstall && isDesignRecords(records);
  const isClosure = !isPost && !isComplaint && !isDispatch && !isInstall && !isDesign && isClosureCard(card.id);
  const table = isPost
    ? (POST_TABLES[postCardKey(card.id)] ?? POST_TABLES.handover)
    : isComplaint ? TABLES.complaints
      : isDispatch ? TABLES.dispatch
        : isInstall ? TABLES.installation
          : isDesign ? TABLES.design : isClosure ? TABLES.closure : TABLES.lead;

  const [shown, setShown] = useState(PAGE);
  const [filters, setFilters] = useState(table.cleared);
  // Every card opens on its chart; the list is one click away, and a clicked slice opens it filtered.
  const [view, setView] = useState('chart');
  const closeRef = useRef(null);

  const ids = useMemo(() => new Set(card.ids ?? []), [card.ids]);
  const inCard = useMemo(() => records.filter((row) => ids.has(String(row.id))), [records, ids]);
  const tools = useTableTools(inCard, { fields: table.fields, search: table.search });

  // Popup behaviour: Escape closes, the page behind does not scroll, focus starts on the close button.
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // A new card starts clean and on its chart: nothing is remembered between cards, and no sort is
  // carried over from a table with other columns.
  const { setSort } = tools;
  const cleared = table.cleared;
  useEffect(() => {
    setFilters(cleared);
    setSort(null);
    setView('chart');
  }, [card.id, cleared, setSort]);

  // The search, the filters, or a new card all start again at the first page of rows.
  useEffect(() => setShown(PAGE), [card.id, tools.query, filters]);

  // `tools.rows` is already searched and sorted; the filters narrow it further and keep that order.
  const searched = tools.rows;
  const visible = searched.filter((row) => passes(row, filters, table.filters));
  const rows = visible.slice(0, shown);
  const remaining = visible.length - rows.length;
  const narrowed = table.filters.some((filter) => (filters[filter.key] ?? ALL) !== ALL);

  // Each dropdown is counted over the rows the other filters leave.
  const optionsOf = (filter) =>
    optionsFor(filter, searched.filter((row) => passes(row, { ...filters, [filter.key]: ALL }, table.filters)), filters[filter.key] ?? ALL);

  const clearAll = () => {
    setFilters(cleared);
    tools.setQuery('');
  };

  // One breakdown per chart key, its slices taken straight from that filter's own dropdown options.
  //
  // A breakdown with a single category is dropped: a full ring labelled "S1" on the S1 card only repeats
  // what was clicked to get here, and costs a third of the chart. The remaining breakdowns are what give
  // the card its shape.
  const breakdowns = (table.chart ?? []).map((key) => {
    const filter = table.filters.find((entry) => entry.key === key);
    const options = optionsOf(filter);
    // NONE is passed through so the "Not recorded" slice always reads grey rather than taking a hue.
    return { filter, total: options[0][2], slices: slicesFrom(options, NONE) };
  }).filter((entry) => entry.total > 0 && entry.slices.length > 1);

  // When nothing on this card can vary there is no chart to show, so it opens on its list instead. This
  // is per card — the toggle still defaults to the chart everywhere else. Weekly needs the payload's
  // `weeks`, which only the Sales board sends, so elsewhere that option is simply absent.
  const canChart = breakdowns.length > 0;
  const canWeekly = weeks.length > 0;
  const fallback = canChart ? 'chart' : 'table';
  const activeView = (view === 'chart' && !canChart) || (view === 'weekly' && !canWeekly) ? fallback : view;

  // Clicking a slice is the same act as choosing that value in the dropdown above it, so the chart is a
  // way into the list rather than a second, parallel notion of what is selected.
  const pickSlice = (key) => (sliceKey) => {
    const already = (filters[key] ?? ALL) === sliceKey;
    setFilters((current) => ({ ...current, [key]: already ? ALL : sliceKey }));
    if (!already) setView('table');
  };

  return (
    <div className="lf-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="lf-detail tone-blue" role="dialog" aria-modal="true" aria-label={`${card.label} records`}>
        <header className="lf-detail-head">
          <div>
            <h3>
              <i aria-hidden="true" />
              {card.label} <span>{visible.length === tools.total ? tools.total : `${visible.length} of ${tools.total}`}</span>
            </h3>
            <p>
              {isComplaint ? 'Complaints in Zoho CRM behind this card'
                : isDispatch ? 'Orders in Zoho CRM behind this card'
                : isPost ? 'Orders in Zoho CRM behind this card, with how long each has been on its stage'
                : isDesign ? 'Orders in Zoho CRM behind this card'
                : isClosure ? 'Orders in Zoho CRM behind this card'
                  : 'Qualified leads in Zoho CRM behind this card'}
            </p>
          </div>
          <div className="lf-detail-actions">
            <SortSelect tools={tools} options={table.options} className="lf-detail-sort" />
            <button type="button" ref={closeRef} className="lf-detail-close" onClick={onClose} aria-label="Close details">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* One bar per table, built from that table's own filters. Six controls on the lead table, so the
            bar wraps onto a second row rather than squeezing each one. */}
        <div className={`sr-filters${table.filters.length > 3 ? ' sr-wide' : ''}`} role="group" aria-label="Filter these records">
          {/* The search box counts the rows left after every filter, not just after the search. */}
          <TableSearch
            tools={{ ...tools, shown: visible.length }}
            label={table.searchLabel}
            placeholder={table.placeholder}
            className="sr-search"
          />
          {table.filters.map((filter) => (
            <FilterSelect
              key={filter.key}
              id={`sr-${filter.key}`}
              label={filter.label}
              value={filters[filter.key] ?? ALL}
              onChange={(next) => setFilters((current) => ({ ...current, [filter.key]: next }))}
              options={optionsOf(filter)}
            />
          ))}
          {(narrowed || tools.query.trim()) && (
            <button type="button" className="sr-clear" onClick={clearAll}>Clear filters</button>
          )}
          <div className="fs-switch sr-view" role="group" aria-label="View">
            <button type="button" aria-pressed={activeView === 'table'} onClick={() => setView('table')}>
              <Table2 size={13} aria-hidden="true" /> List
            </button>
            <button
              type="button"
              aria-pressed={activeView === 'chart'}
              disabled={!canChart}
              title={canChart ? undefined : 'Nothing on this card varies enough to chart'}
              onClick={() => setView('chart')}
            >
              <PieChart size={13} aria-hidden="true" /> Pie chart
            </button>
            {canWeekly && (
              <button type="button" aria-pressed={activeView === 'weekly'} onClick={() => setView('weekly')}>
                <CalendarDays size={13} aria-hidden="true" /> Weekly
              </button>
            )}
          </div>
        </div>

        {activeView === 'weekly' ? (
          // The same records, filed by follow-up week. WeeklyView reads the whole card's set rather than
          // the filtered one: its own band states what it covers, and filtering it twice would make that
          // statement wrong.
          <WeeklyView weeks={weeks} records={inCard} />
        ) : activeView === 'chart' ? (
          <div className="lp">
            {breakdowns.map(({ filter, slices, total }) => (
              <Donut
                key={filter.key}
                title={filter.label}
                slices={slices}
                total={total}
                focus={filters[filter.key] ?? null}
                onPick={pickSlice(filter.key)}
              />
            ))}
            <p className="lp-hint">Click a slice or a row to see those records in the table.</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="lf-detail-empty">
            {tools.total === 0
              ? 'No records in this card for the selected period and city.'
              : 'No records match the current filters.'}
          </p>
        ) : (
          <div className="lf-detail-body">
            <table className="ps-table lf-detail-table ams-stack-table">
              <thead>
                <tr>
                  {table.columns.map(([label, , title, sortValue]) => (sortValue
                    ? <SortTh tools={tools} field={label} key={label} title={title}>{label}</SortTh>
                    : <th scope="col" key={label} title={title}>{label}</th>))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="in-static">
                    {table.columns.map(([label, render]) => <td key={label} data-label={label}>{render(row)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'table' && remaining > 0 && (
          <button type="button" className="dp-more" onClick={() => setShown((count) => count + PAGE)}>
            Show {Math.min(PAGE, remaining)} more of {remaining}
          </button>
        )}
      </section>
    </div>
  );
}
