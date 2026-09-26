import { useEffect, useRef, useState } from 'react';
import { PieChart, Table2, RefreshCw, X } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard.js';
import { Donut, slicesFrom } from './sales/SalesRecordsChart.jsx';
import { crmRecordUrl } from '../config/crm.js';
import '../styles/post-design.css';
import '../styles/pdi-review.css';
import { DataFreshness } from '../shared/data/DataFreshness.jsx';

const COMMON = [['client', 'Client Name'], ['designer', 'Designer Assigned'], ['verification', 'PDI Verification'],
  ['paymentDone', 'Payment Done'], ['orders', 'Number of Orders'], ['revisions', 'Revision Count'],
  ['pendingDays', 'Days Pending'], ['firstMeasurement', 'First Measurement'], ['designApproval', 'Design Approval'],
  ['designerOrders', 'Designer’s Orders'], ['pdiStatus', 'PDI Status'], ['pdiVisitDone', 'PDI Visit Done'],
  ['pdiExpected', 'Expected PDI'], ['pdiAligned', 'Aligned PDI'], ['product', 'Product'], ['floor', 'Floor'],
  ['area', 'Cabinet Area (sq ft)'], ['height', 'Ceiling Height (mm)'], ['surveyor', 'Site Surveyor'], ['owner', 'Owner']];
const show = value => {
  if (value == null || value === '') return '—';
  return typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value)
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : value;
};
const tally = (rows, key) => [...rows.reduce((map, r) => { const v = r[key] || 'Not recorded'; map.set(v, (map.get(v) || 0) + 1); return map; }, new Map())];

export function PdiDashboard({ timeframe = 'daily' }) {
  const state = useDashboard({ timeframe }, '/api/pdi-dashboard');
  const [card, setCard] = useState(null);
  const [view, setView] = useState('table');
  const [query, setQuery] = useState('');
  const [designer, setDesigner] = useState('all');
  const [filter, setFilter] = useState('all');
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!card || !dialogRef.current) return undefined;
    const dialog = dialogRef.current, prior = document.activeElement, overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; prior?.focus(); };
  }, [card]);
  const records = state.data?.records ?? [];
  const all = records.filter(r => designer === 'all' || (r.designer || 'Unassigned') === designer);
  const verified = all.filter(r => r.verified);
  const ready = all.filter(r => r.dispatchStatus === 'Ready for Dispatch').length;
  const pending = all.filter(r => r.dispatchStatus === 'Pending').length;
  const dispatched = all.filter(r => r.dispatchStatus === 'Dispatched').length;
  const base = (card === 'verification' ? verified : all).filter(r => `${r.client} ${r.order} ${r.id}`.toLowerCase().includes(query.toLowerCase().trim()));
  const chartKey = card === 'verification' ? 'paymentDone' : 'dispatchStatus';
  const breakdown = tally(base, chartKey);
  const rows = base.filter(r => filter === 'all' || r[chartKey] === filter);
  const title = card === 'verification' ? 'PDI Verification Done' : 'Ready for Dispatch or Pending';
  const columns = card === 'dispatch'
    ? [...COMMON.slice(0, 4), ['dispatchStatus', 'Dispatch Status'], ['dispatchReason', 'Reason Dispatch Is Pending'],
      ['dispatchExpected', 'Expected Dispatch'], ['dispatchReadyOn', 'Ready on'], ['remarks', 'CRM Remarks'], ...COMMON.slice(4)] : COMMON;
  const open = (key, status = 'all') => { setCard(key); setFilter(status); setQuery(''); setView('table'); };
  if (state.loading) return <div className="post-feedback" role="status">Loading PDI verification and dispatch data…</div>;
  if (state.error && !state.data) return <div className="post-feedback" role="alert"><p>PDI data could not be loaded from Zoho.</p><button onClick={state.refresh}>Try again</button></div>;
  return <section className="post-board pdi-review" aria-label="PDI and Site Review">
    <div className="post-toolbar">
      <label>Designer<select value={designer} onChange={e => setDesigner(e.target.value)}><option value="all">All designers</option>
        {[...new Set(records.map(r => r.designer || 'Unassigned'))].sort().map(d => <option key={d}>{d}</option>)}</select></label>
      <span className="post-scope">{all.length} orders · {state.data.meta.reportLabel}</span>
      <button className="post-refresh" onClick={state.refresh} disabled={state.refreshing}><RefreshCw size={15} />{state.refreshing ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <DataFreshness state={state} />
    <p className="post-context">{state.data.meta.scope} Select a card to open its table or chart.</p>
    {state.data.meta.paymentUnavailable && <p className="post-notice" role="status">Payment milestones could not be read. Payment status is marked Unavailable; refresh to retry.</p>}
    <section className="lf pdi-review-flow" aria-label="PDI review cards">
      <div className="lf-c"><div className="lf-node has-out">
        <button className="lf-card lf-lg tone-blue" aria-haspopup="dialog" onClick={() => open('verification')}>
          <span className="lf-label"><i aria-hidden="true" />PDI Verification Done</span>
          <span className="lf-figures"><strong>{verified.length}</strong><span className="pd-orders">orders</span></span>
          <span className="pd-card-note">Verified approval · payment status inside</span>
        </button><i className="lf-w out-h" aria-hidden="true" /></div></div>
      <div className="lf-c"><div className="lf-node has-in"><i className="lf-w in-h" aria-hidden="true" />
        <button className="lf-card lf-lg lf-card-top tone-teal" aria-haspopup="dialog" onClick={() => open('dispatch')}>
          <span className="lf-label"><i aria-hidden="true" />Ready for Dispatch or Pending</span>
          <span className="lf-figures"><strong>{ready}</strong><span className="pd-orders">ready · {pending} pending</span></span>
          <span className="pd-card-note">Readiness and reasons for pending orders</span>
        </button>
        <div className="lf-cities"><ul className="lf-cities-row">
          {[[ready, 'Ready for Dispatch', 'Ready'], [pending, 'Pending', 'Pending'], [dispatched, 'Dispatched', 'Dispatched']].map(([n, status, label]) =>
            <li key={status}><button className="lf-city" aria-label={`${n} ${status} orders`} onClick={() => open('dispatch', status)}><strong>{n}</strong><b>{label}</b></button></li>)}
        </ul></div>
      </div></div>
    </section>
    <details className="post-definitions"><summary>How PDI, payment and dispatch are mapped</summary>
      <p>{state.data.meta.mapping}</p><p>{state.data.meta.dispatch}</p><p>{state.data.meta.counts}</p>
    </details>
    {card && <dialog ref={dialogRef} className="lf-detail post-dialog pdi-dialog" aria-labelledby="pdi-dialog-title" onCancel={() => setCard(null)}>
      <header className="lf-detail-head"><div><h3 id="pdi-dialog-title">{title}<span>{rows.length}</span></h3><p>{state.data.meta.reportLabel} · one row per order</p></div>
        <button className="lf-detail-close" aria-label="Close details" onClick={() => setCard(null)} autoFocus><X size={16} /></button></header>
      <div className="pdi-dialog-tools">
        <div className="pdi-view-switch" aria-label="Record view"><button aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={16} />Table view</button>
          <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}><PieChart size={16} />Chart view</button></div>
        <label><span className="sr-only">Search orders</span><input aria-label="Search orders" placeholder="Search client or order" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>{card === 'verification' ? 'Payment' : 'Dispatch'}<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>
          {[...new Set((card === 'verification' ? verified : all).map(r => r[chartKey]))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <p className="post-notice">{card === 'verification' ? 'Payment Done refers to the PDI Approval milestone, not the full order value.' : 'Pending reasons describe recorded blockers or missing readiness evidence. General CRM remarks are shown separately.'}</p>
      {view === 'table' ? <div className="post-table-scroll" tabIndex={0} role="region" aria-label={`${title} table`}>
        <table><caption className="sr-only">{title}</caption><thead><tr>{columns.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>{columns.map(([key]) => key === 'client'
            ? <th scope="row" key={key}><a href={crmRecordUrl('Deals', r.id)} target="_blank" rel="noreferrer">{r.client}</a><small>{r.order}</small><small>Order …{r.id.slice(-8)}</small></th>
            : <td key={key} className={key === 'dispatchReason' || key === 'remarks' ? 'pdi-reason' : ''} title={key === 'paymentDone' ? r.paymentBasis : undefined}>{show(r[key])}</td>)}</tr>)}
            {!rows.length && <tr><td className="post-empty" colSpan={columns.length}><strong>No orders in this view</strong><p>Try another status, designer, or a wider reporting period.</p>
              {(filter !== 'all' || query) && <button onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button>}</td></tr>}
          </tbody></table>
      </div> : <div className="pdi-chart-view">
        {base.length ? <><Donut title={card === 'verification' ? 'PDI payment status' : 'Dispatch readiness'} total={base.length}
          slices={slicesFrom([['all', 'All', base.length], ...breakdown.map(([label, count]) => [label, label, count])], 'Not recorded')}
          focus={filter} onPick={value => setFilter(filter === value ? 'all' : value)} />
          <p>{filter === 'all' ? `${base.length} orders in this chart.` : `${rows.length} orders selected: ${filter}.`} Select a segment, then Table view to inspect its orders.</p></>
          : <p>No orders to chart. Try another reporting period or clear the search.</p>}
      </div>}
      <footer className="post-table-foot">Order counts cover the selected period. A dash means no recorded value.</footer>
    </dialog>}
  </section>;
}
