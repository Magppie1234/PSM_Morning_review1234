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
// there is FLOOR AREA IN SQUARE FEET, not rupees — the Deals module carries no amount at all — so it is
// never given a ₹ sign.
const REVISION_LIMIT = 3; // the limit PreDesignFlow measures orders against
const notRecorded = <span className="lf-na">Not recorded</span>;
const told = (value) => (value === null || value === undefined || value === '' ? notRecorded : value);
const designerOf = (row) => text(row.designer);
const areaOf = (row) => {
  const area = Number(row?.value);
  return Number.isFinite(area) && area > 0 ? area : null;
};
const areaCell = (row) => {
  const area = areaOf(row);
  return area === null ? notRecorded : `${area.toLocaleString('en-IN')} sq ft`;
};
const revisionsOf = (row) => (Number.isFinite(Number(row?.revisions)) ? Number(row.revisions) : null);
const revisionBandOf = (row) => {
  const count = revisionsOf(row);
  if (count === null) return 'unknown';
  if (count <= 0) return 'none';
  return count > REVISION_LIMIT ? 'over' : 'within';
};

const DESIGN_COLUMNS = [
  ['Project / client', (row) => (
    <a className="lf-record-link" href={crmRecordUrl('Deals', row.id)} target="_blank" rel="noopener noreferrer" title="Open this order in Zoho CRM">
      {row.name}
    </a>
  ), 'Opens the order in Zoho CRM', (row) => row.name],
  ['Designer', (row) => told(designerOf(row)), 'Designer assigned to the order in Zoho', designerOf],
  ['Sales person', (row) => told(text(row.owner)), 'Record owner in Zoho', (row) => row.owner],
  ['Area (sq ft)', areaCell, 'Floor area on the order in Zoho. The Deals module holds no rupee amount, so the design board measures in square feet', areaOf],
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
  // The Design board's orders. Measured in square feet throughout — no rupee figure exists for them.
  design: {
    columns: DESIGN_COLUMNS,
    search: (row) => [row.name, row.id, row.designer, row.owner, row.stage, row.city].filter(Boolean).join(' '),
    placeholder: 'Search project, designer, sales person…',
    searchLabel: 'Search project, designer, sales person, stage and city',
    filters: [
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
    chart: ['stage', 'designer', 'revisions']
  }
};
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
  const isDesign = isDesignRecords(records);
  const isClosure = !isDesign && isClosureCard(card.id);
  const table = isDesign ? TABLES.design : isClosure ? TABLES.closure : TABLES.lead;

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
              {isDesign ? 'Orders in Zoho CRM behind this card, measured in square feet'
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
