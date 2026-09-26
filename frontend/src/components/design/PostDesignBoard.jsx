import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard.js';
import '../../styles/post-design.css';
import { DataFreshness } from '../../shared/data/DataFreshness.jsx';

const COMMON = [['client', 'Client Name'], ['designer', 'Designer Assigned'], ['orders', 'Number of Orders'],
  ['revisions', 'Revision Count'], ['pendingDays', 'Days Pending'], ['firstMeasurement', 'First Measurement'],
  ['designApproval', 'Design Approval'], ['designerOrders', 'Designer’s Orders']];
const EXTRA = {
  approval: [['measurementPerson', 'Site Measurement Person']],
  ep: [['epMarking', 'EP Marking'], ['epChecking', 'EP Checking'], ['appliancesReceived', 'Appliances Received'], ['applianceList', 'Appliance List']],
  moodboard: [['moodboardStatus', 'Moodboard Status'], ['moodboardSignoff', 'Moodboard Sign-off']],
  signout: [['productionStatus', 'Production Drawing'], ['productionSignoff', 'PD Sign-off'], ['paymentEvidence', 'Payment Evidence']],
  pdi: [['pdiStatus', 'PDI Status'], ['pdiExpected', 'Expected PDI'], ['pdiAligned', 'Aligned PDI'], ['pdiDone', 'PDI Completed']]
};
function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value)) {
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return value;
}

// Extends the existing navy-and-white operational dashboard. Connected milestone cards lead
// into a click-to-open order dialog; the supplied image governs styling, never the data.
export function PostDesignBoard({ timeframe }) {
  const state = useDashboard({ timeframe }, '/api/post-design-dashboard');
  const [stage, setStage] = useState('approval');
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [open]);
  const openStage = (key, filter = 'all') => { setStage(key); setStatus(filter); setOpen(true); };
  const [designer, setDesigner] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [oldest, setOldest] = useState(true);
  const records = state.data?.records ?? [];
  const stages = state.data?.stages ?? [];
  const designers = [...new Set(records.map(r => r.designer || 'Unassigned'))].sort();
  const filtered = useMemo(() => records.filter(r => (designer === 'all' || (r.designer || 'Unassigned') === designer)
    && `${r.client} ${r.order ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [records, designer, query]);
  const rows = filtered.filter(r => status === 'all' || r.milestones[stage].status === status)
    .sort((a, b) => {
      const av = a.milestones[stage].pendingDays, bv = b.milestones[stage].pendingDays;
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return oldest ? bv - av : av - bv;
    });
  const selected = stages.find(s => s.key === stage);
  const columns = [...COMMON.slice(0, 2), ['milestoneStatus', 'Milestone Status'], ...EXTRA[stage], ...COMMON.slice(2)];

  if (state.loading) return <div className="post-feedback" role="status">Loading Post Design orders from Zoho…</div>;
  if (state.error && !state.data) return <div className="post-feedback" role="alert"><h2>Post Design couldn’t load</h2>
    <p>Retry the Zoho connection or choose a shorter reporting period.</p><button onClick={state.refresh}>Try again</button></div>;

  return <section className="post-board" aria-label="Post Design">
    <header className="post-heading"><div><h2>Post Design</h2><p>From design approval to production readiness.</p></div>
      <button className="post-refresh" onClick={state.refresh} disabled={state.refreshing}><RefreshCw size={15} /> {state.refreshing ? 'Refreshing…' : 'Refresh'}</button></header>
    <DataFreshness state={state} />
    <div className="post-toolbar">
      <label className="post-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search client or order</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client or order" /></label>
      <label>Designer<select value={designer} onChange={e => setDesigner(e.target.value)}><option value="all">All designers</option>
        {designers.map(d => <option key={d}>{d}</option>)}</select></label>
      <span className="post-scope">{filtered.length.toLocaleString('en-IN')} orders · {state.data?.meta.reportLabel}</span>
    </div>
    <p className="post-context">Orders created in this period, handed over from Pre Design. Select a stage to review its table.</p>
    <section className="lf pd-lf pd-cols-5" aria-label="Post Design stages">
      <h2 className="lf-title">Post-design funnel</h2>
      {stages.map((s, i) => {
        const complete = filtered.filter(r => r.milestones[s.key].done).length;
        const pending = filtered.filter(r => r.milestones[s.key].status === 'Pending').length;
        const unknown = filtered.length - complete - pending;
        const tones = ['blue', 'green', 'amber', 'violet', 'teal'];
        return <div className="lf-c" key={s.key}>
          <div className={`lf-node ${i ? 'has-in' : ''} ${i < stages.length - 1 ? 'has-out' : ''}`}>
            <i className="lf-w in-h" aria-hidden="true" /><i className="lf-w in-v" aria-hidden="true" />
            <button type="button" className={`lf-card lf-card-top lf-${i === 0 ? 'lg' : 'md'} tone-${tones[i]}`}
              aria-haspopup="dialog" title="Click to see the orders" onClick={() => openStage(s.key)}>
              <span className="lf-label"><i aria-hidden="true" />{s.label}</span>
              <span className="lf-figures"><strong>{complete.toLocaleString('en-IN')}</strong><span className="pd-orders">complete</span></span>
              <span className="lf-share" aria-hidden="true"><b style={{ width: `${filtered.length ? complete / filtered.length * 100 : 0}%` }} /></span>
              <span className="pd-card-note">{s.note}</span>
            </button>
            <div className="lf-cities">
              <ul className="lf-cities-row" aria-label={`${s.label} milestone status`}>
                {[[complete, 'Complete'], [pending, 'Pending'], [unknown, 'Not recorded']].map(([count, label]) =>
                  <li key={label}><button type="button" className="lf-city" onClick={() => openStage(s.key, label)}
                    aria-haspopup="dialog" aria-label={`${s.label}: ${count} ${label.toLowerCase()} orders`}>
                    <strong>{count}</strong><b>{label}</b>
                  </button></li>)}
              </ul>
            </div>
            <i className="lf-w out-h" aria-hidden="true" /><i className="lf-w out-v" aria-hidden="true" />
          </div>
        </div>;
      })}
    </section>
    {open && <dialog ref={dialogRef} className="lf-detail post-dialog" aria-labelledby="post-table-title"
      onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
      } }}>
    <section className="post-records" id="post-records" aria-labelledby="post-table-title">
      <header className="post-table-head lf-detail-head"><div><h3 id="post-table-title">{selected?.label}</h3>
        <p aria-live="polite">{rows.length} {rows.length === 1 ? 'order' : 'orders'} · {selected?.note}</p></div>
        <label>Milestone status<select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option><option>Pending</option><option>Complete</option><option>Not recorded</option>
        </select></label>
        <button type="button" className="lf-detail-close" aria-label="Close details" onClick={() => setOpen(false)} autoFocus><X size={16} /></button>
      </header>
      {stage === 'ep' && <p className="post-notice">{state.data.meta.appliances}</p>}
      {stage === 'signout' && <p className="post-notice">Payment is due at PD Sign Out. {state.data.meta.payment}</p>}
      <div className="post-table-scroll" role="region" aria-label={`${selected?.label} orders table, scroll for more columns`} tabIndex={0}>
        <table><caption className="sr-only">{selected?.label} order details</caption><thead><tr>
          {columns.map(([key, label]) => <th key={key} scope="col" aria-sort={key === 'pendingDays' ? (oldest ? 'descending' : 'ascending') : undefined}>
            {key === 'pendingDays' ? <button onClick={() => setOldest(!oldest)}>{label} {oldest ? '↓' : '↑'}</button> : label}</th>)}
        </tr></thead><tbody>
          {rows.map(r => <tr key={r.id}>{columns.map(([key]) => key === 'client'
            ? <th key={key} scope="row">{r.client}<small>{r.order !== r.client ? r.order : ''}</small><small title={`Zoho order ${r.id}`}>Order …{r.id.slice(-8)}</small></th>
            : key === 'milestoneStatus' ? <td key={key}><span className={`post-status ${r.milestones[stage].status === 'Complete' ? 'complete' : ''}`}>{r.milestones[stage].status}</span></td>
            : <td key={key}>{display(key === 'pendingDays' ? r.milestones[stage].pendingDays : r[key])}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="post-empty"><strong>No orders in this view</strong>
            <p>{records.length ? 'Try another designer, search, or milestone status.' : 'Choose a wider reporting period to see orders handed over to Post Design.'}</p>
            {(query || designer !== 'all' || status !== 'all') && <button onClick={() => { setQuery(''); setDesigner('all'); setStatus('all'); }}>Clear filters</button>}</td></tr>}
        </tbody></table>
      </div>
      <footer className="post-table-foot">One row per order. Order totals cover the selected period. A dash means no verified value.</footer>
    </section>
    </dialog>}
    <details className="post-definitions"><summary>How these figures are counted</summary>
      <p>{state.data.meta.scope}</p><p>{state.data.meta.counts}</p><p>{state.data.meta.pending}</p>
      <p>Complete requires a recorded milestone completion date or explicit completion status. Pending means an opening date or activity status is recorded. Other milestones are shown as Not recorded. Pending days stays blank if the opening date is missing.</p>
    </details>
  </section>;
}
