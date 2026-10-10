import { useEffect, useMemo, useRef, useState } from 'react';
import { SortTh, TableSearch, useTableTools } from './tableTools.jsx';
import { HBars } from './charts/MiniCharts.jsx';
import { crmRecordUrl } from '../config/crm.js';
import { TatCell } from './presales/leadTiming.jsx';

const stamp = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded';

// THE GRAPH OPENS FIRST, and the list is a click away.
//
// A metric covering four hundred leads opens as four hundred rows, and the first question is never
// "what is row 1" - it is "who, what state, and how late". Those are three groupings of the same
// rows, so the panel answers them before it hands over the records.
//
// Every chart here is counted from the rows the metric was actually built from, so the breakdown and
// the list can never disagree: they are the same array, grouped two different ways. The charts reuse
// HBars and the six-colour palette, so a colour means on this panel what it means on the board behind it.
const VIEWS = [{ id: 'chart', label: 'Graph' }, { id: 'list', label: 'List' }];

/** Count rows by a key, biggest first, with blanks collected rather than dropped. */
function groupBy(rows, keyOf, blank = 'Not recorded') {
  const counts = new Map();
  for (const row of rows) {
    const key = String(keyOf(row) ?? '').trim() || blank;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/**
 * TAT as four outcomes rather than a number. "7.4 hours" on its own says nothing; whether it beat the
 * twelve-hour bar is the whole point, and a lead nobody has reached yet is a different thing again
 * from one reached late - so it gets its own bar instead of being averaged away.
 */
function tatOutcomes(rows) {
  const out = { 'Contacted within 12h': 0, 'Contacted late': 0, 'Awaiting contact': 0, 'Not verifiable': 0 };
  for (const row of rows) {
    const tat = row.tat;
    if (!tat || tat.state === 'unknown') out['Not verifiable'] += 1;
    else if (tat.state === 'late' || tat.state === 'overdue') out['Contacted late'] += 1;
    else if (tat.contactedAt) out['Contacted within 12h'] += 1;
    else out['Awaiting contact'] += 1;
  }
  return Object.entries(out).filter(([, value]) => value > 0).map(([label, value]) => ({ label, value }));
}

/** Rows per calendar day, oldest first - a date axis is the one place rank order would mislead. */
function byDay(rows) {
  const counts = new Map();
  for (const row of rows) {
    const at = Date.parse(row.created);
    if (!Number.isFinite(at)) continue;
    const key = new Date(at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function Breakdown({ title, note, rows, tone, restTone }) {
  if (!rows.length) return null;
  return (
    <section className="an-breakdown" aria-label={title}>
      <h3>{title}</h3>
      {note && <p className="an-note">{note}</p>}
      <HBars rows={rows} tone={tone} restTone={restTone} />
    </section>
  );
}
export function AnalyticsDetails({ selection, onClose }) {
  const dialog = useRef(null);
  const [limit, setLimit] = useState(50);
  // The graph opens first. The list is one click away and keeps its own search and sorting.
  const [view, setView] = useState('chart');
  const tools = useTableTools(selection.rows ?? [], {
    fields: { name: (row) => row.name, owner: (row) => row.owner, created: (row) => Date.parse(row.created), status: (row) => row.status, detail: (row) => row.detail, tat: (row) => row.tat?.hours },
    search: (row) => [row.name, row.id, row.owner, row.status, row.detail].filter(Boolean).join(' ')
  });
  useEffect(() => setLimit(50), [tools.query]);
  const rows = selection.rows ?? [];
  const hasTat = rows.some((row) => row.tat);
  // Counted from the rows the metric was built from, so the charts and the list can never disagree.
  const charts = useMemo(() => ({
    owners: groupBy(rows, (row) => row.owner),
    statuses: groupBy(rows, (row) => row.status),
    tat: hasTat ? tatOutcomes(rows) : [],
    days: byDay(rows)
  }), [rows, hasTat]);
  useEffect(() => {
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.current.querySelectorAll('button, input, a[href], select')].filter((node) => !node.disabled);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); trigger?.focus(); };
  }, [onClose]);
  return <div className="lf-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialog} className="lf-detail tone-blue" role="dialog" aria-modal="true" aria-label={selection.label}>
      <header className="lf-detail-head"><div><h3>{selection.label}</h3><p>{selection.detail}</p></div>
        <button type="button" className="lf-detail-close" onClick={onClose} aria-label="Close details">×</button>
      </header>
      <div className="an-evidence-tools">
        <div className="an-views" role="tablist" aria-label="How to show these records">
          {VIEWS.map((entry) => (
            <button type="button" key={entry.id} role="tab" aria-selected={view === entry.id} onClick={() => setView(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
        {view === 'list' && <TableSearch tools={tools} label="Search records" />}
        <span>{view === 'list' ? `${tools.shown} of ${tools.total} records` : `${rows.length} record${rows.length === 1 ? '' : 's'}`}</span>
      </div>

      {view === 'chart' && (rows.length
        ? <div className="an-breakdowns an-detail-charts">
            <Breakdown title="By PSM / owner" note="Who the records in this figure belong to." rows={charts.owners} />
            <Breakdown title="By status" note="Where these records stand in Zoho right now." rows={charts.statuses} tone="c2" restTone="c2" />
            {charts.tat.length > 0 && (
              <Breakdown title="Turnaround against the 12-hour bar"
                note="A lead nobody has reached yet is counted apart from one reached late."
                rows={charts.tat} tone="c4" restTone="c6" />
            )}
            {charts.days.length > 1 && (
              <Breakdown title="By day created" note="Oldest first." rows={charts.days} tone="c3" restTone="c3" />
            )}
          </div>
        : <p className="an-note">{selection.unavailable ? 'Source data is unavailable; this metric cannot be verified.' : 'No records behind this figure.'}</p>)}
      {view === 'list' && <div className="ps-scroll"><table className="ps-table"><thead><tr>
        <SortTh tools={tools} field="name">Record</SortTh><SortTh tools={tools} field="owner">PSM / owner</SortTh>
        <SortTh tools={tools} field="created">Created / activity time (IST)</SortTh><SortTh tools={tools} field="status">Status</SortTh>
        <SortTh tools={tools} field="detail">Calculation evidence</SortTh>{hasTat && <SortTh tools={tools} field="tat">TAT<small className="tat-sub">contacted within 12 hours</small></SortTh>}
      </tr></thead><tbody>{tools.rows.slice(0, limit).map((row, index) => <tr key={`${row.module}-${row.id}-${index}`}>
        <td>{row.id ? <a href={crmRecordUrl(row.module || 'Leads', row.id)} target="_blank" rel="noopener noreferrer">{row.name}</a> : row.name}<small className="tat-sub">{row.module} · {row.id}</small></td>
        <td>{row.owner || 'Not recorded'}</td><td>{stamp(row.created)}</td><td>{row.status}</td><td>{row.detail || '—'}</td>
        {hasTat && <td>{row.tat ? <TatCell tat={row.tat} /> : '—'}</td>}
      </tr>)}</tbody></table>{tools.rows.length > limit && <button type="button" className="ps-link" onClick={() => setLimit((value) => value + 50)}>Show more records ({limit} of {tools.rows.length})</button>}{!tools.total && <p className="an-note">{selection.unavailable ? 'Source data is unavailable; this metric cannot be verified.' : 'No matching records in this selection.'}</p>}</div>}
    </section>
  </div>;
}
