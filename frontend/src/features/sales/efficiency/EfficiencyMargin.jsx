import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import { MetricCard, MiniBars } from './MetricCard.jsx';
import { count, inr, ranked, total } from './format.js';
const EfficiencyDetails = lazy(() => import('./EfficiencyDetails.jsx'));

/* Operate: concise review first, source-aware detail on demand. Existing navy/white and Manrope
   remain authoritative. Eight shallow metric cards and three short ranking panels replace the long
   chart wall. Clicking protects focus for chart/table inspection; no inferred conversion or profit.
   FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md */
export function EfficiencyMargin({ data, loading = false }) {
  const [selection, setSelection] = useState(null);
  const trigger = useRef(null);
  const openDetail = (event, next) => { trigger.current = event.currentTarget; setSelection(next); };
  if (!data) return null;
  const { meta = {}, metrics = [], products = {}, regions = {}, series = {} } = data;
  const months = series.months ?? [];
  const summaries = [
    { key: 'products', label: 'Orders created · product mix', value: inr(total(products.rows)), caption: 'Recorded order value · all stages', rows: ranked(products.rows ?? [], 'label', 3), format: inr },
    { key: 'regions', label: 'Closed value · by city', value: inr(total(regions.byBucket)), caption: 'Contacts closed in the selected period', rows: ranked(regions.byBucket ?? [], 'label', 3), format: inr },
    { key: 'months', label: 'Twelve-month activity', value: count(total(months, 'closed')), caption: 'Closed contacts across the displayed months', rows: months.slice(-4).map((m) => ({ key: m.month, name: m.label ?? m.month, value: m.closed })), format: count }
  ];
  return <section className="em em-compact" aria-labelledby="em-title" aria-busy={loading}>
    <div className="em-heading"><div><h2 id="em-title">Efficiency margin</h2><p>Review the essentials. Select a card for the calculation and breakdown.</p></div><span>{loading ? 'Updating…' : meta.reportLabel}</span></div>
    {meta.amsDetected > 0 && <p className="em-warn"><AlertTriangle size={15} aria-hidden="true" />{count(meta.amsDetected)} service / installation records {meta.excludeAmsRecords ? 'excluded' : 'included'} in these results.</p>}
    <div className="em-metric-grid">{metrics.map((metric) => <MetricCard key={metric.key} metric={metric} comparison={meta.comparison} onOpen={(event) => openDetail(event, { type: 'metric', key: metric.key })} />)}</div>
    <div className="em-breakdown-grid">{summaries.map((item) => <button className="em-breakdown" key={item.key} type="button" onClick={(event) => openDetail(event, { type: item.key })} aria-haspopup="dialog">
      <span className="em-summary-label">{item.label}<ArrowUpRight size={15} aria-hidden="true" /></span><span className="em-breakdown-total">{item.value}</span><span className="em-summary-context">{item.caption}</span>
      <MiniBars rows={item.rows} format={item.format} label={item.label} /><span className="em-open-detail">View chart & table</span>
    </button>)}</div>
    {selection && <Suspense fallback={<p role="status">Opening detail…</p>}><EfficiencyDetails key={`${selection.type}-${selection.key ?? ''}`} selection={selection} data={data} returnFocus={trigger.current} onClose={() => setSelection(null)} /></Suspense>}
  </section>;
}
