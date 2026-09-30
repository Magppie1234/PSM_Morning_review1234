import { X } from 'lucide-react';
import { useMemo, useState } from 'react';

// The dispatch detail table, ported from the :5520 mockup's drawer.
//
// Everything the mockup showed is here — the three stats, the due-window pills, the sortable
// columns, the ✓ / Pending gates, the mono identifier columns, the "Past due" pill and the footer
// line — with one difference that runs through all of it: the mockup generated its dates and this
// reads Zoho.
//
// WHERE THE DATES COME FROM. Zoho's own gate fields are empty across the whole module
// (Production_Drawing_Signoff_done, PDI_Visit_done, Ready_For_Dispatch_done: zero rows). The dates
// in the sign-off, PDI, Finance and Installation columns are therefore the date each order ENTERED
// that stage, taken from DealHistory, which is a real event with a real timestamp. A gate the order
// has not reached prints "Pending", exactly as the mockup did.
//
// WHAT CANNOT BE FILLED. The mockup's UID and MPP columns have no field in Zoho — only MRP does
// (MRP_No, filled on 29% of orders). Rather than drop the columns or invent numbers, they use the
// mockup's own treatment for a missing identifier: "Missing" in red. That is the honest reading and
// it doubles as a worklist for whoever maintains the CRM.

const nice = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};
const money = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(amount >= 1e8 ? 1 : 2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// A gate: a green tick and a date once passed, a muted "Pending" until then.
const Gate = ({ on }) => (on
  ? <span className="dx-yn y">✓ {nice(on)}</span>
  : <span className="dx-yn n">Pending</span>);

// An identifier Zoho may not hold. Red "Missing" is the mockup's own treatment and is deliberate:
// these are the numbers the factory and transport quote, so a blank one is a real problem.
const Id = ({ value, absent = 'Missing' }) => (value
  ? <span>{value}</span>
  : <span className="dx-miss">{absent}</span>);

// THE DUE WINDOW THE MOCKUP SHOWED DOES NOT EXIST IN ZOHO, and this is the one place the port
// departs from it deliberately.
//
// The mockup coloured every row by how close its dispatch date was — Past due, This week, This
// month — which needs a PLANNED date. Zoho's Dispatch_Date is not one. Measured across the 1,836
// orders that carry it: the dates run from 2017 to 3 September 2026, NONE is in the future, and
// 1,812 of them sit at a dispatched-or-later stage. It records when an order WENT, not when it is
// due. The only candidate deadlines are Expected_Dispatch_Date (33 orders) and
// Tentative_Dispatch_Date (4), which are far too thin to build a column on.
//
// Reading it as a deadline anyway would have stamped "Past due" on all 1,836 — including orders
// dispatched and installed years ago. So the column keeps its place and its styling and reports
// what the field actually says: whether the order has gone out yet. The genuine gap the planner
// needs is the other side of it — the booked orders with no dispatch date at all.
const DISPATCH_PILL = {
  gone: ['pos', 'Dispatched'],
  waiting: ['cau', 'Not dispatched']
};

const COLUMNS = [
  {
    id: 'order',
    head: 'Order',
    sort: (row) => row.name,
    cell: (row) => (
      <div className="dx-who">
        <strong>{row.name}</strong>
        <small>{[row.product, row.city, row.amountLabel].filter(Boolean).join(' · ') || 'No details recorded'}</small>
      </div>
    )
  },
  { id: 'designer', head: 'Designer', sort: (row) => row.designer, cell: (row) => <Id value={row.designer} absent="Unassigned" /> },
  // No Zoho field exists for either of these — see the note at the top of this file.
  { id: 'uid', head: 'UID', mono: true, sort: () => null, cell: () => <Id value={null} /> },
  { id: 'mpp', head: 'MPP', mono: true, sort: () => null, cell: () => <Id value={null} /> },
  { id: 'mrp', head: 'MRP', mono: true, sort: (row) => row.mrp, cell: (row) => <Id value={row.mrp} /> },
  { id: 'signoff', head: 'Production sign-off', sub: 'entered stage', sort: (row) => timeOf(row.signoffOn), cell: (row) => <Gate on={row.signoffOn} /> },
  { id: 'pdi', head: 'PDI approved', sort: (row) => timeOf(row.pdiOn), cell: (row) => <Gate on={row.pdiOn} /> },
  { id: 'finance', head: 'Finance', sort: (row) => timeOf(row.financeOn), cell: (row) => <Gate on={row.financeOn} /> },
  { id: 'install', head: 'Installation', sort: (row) => timeOf(row.installOn), cell: (row) => <Gate on={row.installOn} /> },
  {
    id: 'due',
    head: 'Dispatch date',
    sub: 'Zoho Dispatch Date',
    sort: (row) => timeOf(row.dispatchOn),
    cell: (row) => (row.dispatchOn
      ? <div className="dx-due"><span>{nice(row.dispatchOn)}</span><small>set</small></div>
      : <span className="dx-yn n">Not set</span>)
  },
  {
    id: 'window',
    head: 'Dispatch',
    sub: 'has it gone out',
    sort: (row) => (row.dispatchOn ? 0 : 1),
    cell: (row) => {
      const [tone, label] = DISPATCH_PILL[row.dispatchOn ? 'gone' : 'waiting'];
      return <span className={`dx-pill ${tone}`}>{label}</span>;
    }
  }
];

const timeOf = (iso) => (iso ? Date.parse(iso) || null : null);

// The mockup's four due-window pills, repointed at the one thing the dispatch date can honestly
// answer. Same group, same interaction, truthful labels.
const PERIODS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'gone', label: 'Dispatched', match: (row) => Boolean(row.dispatchOn) },
  { key: 'waiting', label: 'Not dispatched', match: (row) => !row.dispatchOn },
  { key: 'nomrp', label: 'No MRP number', match: (row) => !row.mrp }
];

/**
 * @param {object}   props.card    { id, label, ids } from the card that was clicked
 * @param {string}   [props.view]  the sub-tab's name, shown in the subtitle
 * @param {string}   [props.sub]   the card's own one-line description
 * @param {Array}    props.records every dispatch order the board shipped
 * @param {Function} props.onClose
 */
export function DispatchRecords({ card, view, sub, records, onClose }) {
  const [period, setPeriod] = useState('all');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);

  const mine = useMemo(() => {
    const wanted = new Set(card?.ids ?? []);
    return (records ?? []).filter((row) => wanted.has(row.id));
  }, [card, records]);

  const shown = useMemo(() => {
    const rule = PERIODS.find((entry) => entry.key === period) ?? PERIODS[0];
    const rows = mine.filter(rule.match);
    const column = COLUMNS.find((entry) => entry.id === sortCol);
    if (!column || !sortDir) return rows;
    const sorted = [...rows].sort((a, b) => {
      const left = column.sort(a);
      const right = column.sort(b);
      // Blanks always last, whichever way the column is sorted — a missing value is not "smallest".
      if (left === null || left === undefined || left === '') return 1;
      if (right === null || right === undefined || right === '') return -1;
      if (left === right) return 0;
      return (left > right ? 1 : -1) * (sortDir === 'asc' ? 1 : -1);
    });
    return sorted;
  }, [mine, period, sortCol, sortDir]);

  const value = shown.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  // The mockup's third stat was "Past due", which needs a deadline Zoho does not keep. This is the
  // real gap in the same slot: booked orders with no dispatch date on them at all.
  const waiting = shown.filter((row) => !row.dispatchOn).length;

  const clickSort = (id) => {
    if (sortCol !== id) { setSortCol(id); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortCol(null); setSortDir(null);
  };

  return (
    <div className="dx-back" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="dx" role="dialog" aria-modal="true" aria-label={card?.label}>
        <header className="dx-head">
          <div className="dx-title">
            <h3><i aria-hidden="true" />{card?.label}</h3>
            <p>{[view, sub].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className="dx-x" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="dx-bar">
          <div className="dx-stats">
            <span><strong>{shown.length.toLocaleString('en-IN')}</strong><small>Orders</small></span>
            <span><strong>{money(value)}</strong><small>Value</small></span>
            <span className={waiting ? 'is-late' : undefined}>
              <strong>{waiting.toLocaleString('en-IN')}</strong><small>No dispatch date</small>
            </span>
          </div>
          <div className="dx-tabs" role="group" aria-label="Due period">
            {PERIODS.map((entry) => {
              const count = mine.filter(entry.match).length;
              return (
                <button
                  type="button"
                  key={entry.key}
                  className={period === entry.key ? 'on' : undefined}
                  aria-pressed={period === entry.key}
                  onClick={() => setPeriod(entry.key)}
                >
                  {entry.label}<span className="n">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="dx-sortnote" aria-live="polite">
          {sortCol && sortDir
            ? <>Sorted by <b>{COLUMNS.find((c) => c.id === sortCol)?.head}</b> · {sortDir === 'asc' ? 'increasing ▲' : 'decreasing ▼'}
                <button type="button" className="dx-lnk" onClick={() => { setSortCol(null); setSortDir(null); }}>Reset</button></>
            : 'Click any column heading to sort ▲ increasing / ▼ decreasing'}
        </p>

        <div className="dx-tbl">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const on = sortCol === column.id && sortDir;
                  return (
                    <th key={column.id} className="dx-sortable" aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => clickSort(column.id)}>
                        <span>{column.head}{column.sub && <small>{column.sub}</small>}</span>
                        <span className="dx-ar">{on ? (sortDir === 'asc' ? <b>▲</b> : <b>▼</b>) : <span className="dx-ar0">▲▼</span>}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  {COLUMNS.map((column) => (
                    <td key={column.id} className={column.mono ? 'dx-idc' : undefined}>{column.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="dx-empty">No orders in this window.</p>}
        </div>

        <footer className="dx-foot">
          {shown.length.toLocaleString('en-IN')} order{shown.length === 1 ? '' : 's'} · {money(value)}
          {period !== 'all' && <> · {PERIODS.find((e) => e.key === period)?.label.toLowerCase()}</>}
          {' '}· as of {nice(new Date().toISOString())}
        </footer>
      </section>
    </div>
  );
}
