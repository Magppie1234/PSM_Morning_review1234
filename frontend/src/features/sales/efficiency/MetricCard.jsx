import { ArrowUpRight } from 'lucide-react';
import { formatMetric, metricUnit, unavailable } from './format.js';

export function MetricCard({ metric, comparison, onOpen }) {
  const out = unavailable(metric);
  const previous = Number.isFinite(metric.previous) && comparison?.available !== false;
  return <button className="em-summary-card" type="button" onClick={onOpen} aria-haspopup="dialog">
    <span className="em-summary-label">{metric.label}<ArrowUpRight size={15} aria-hidden="true" /></span>
    <span className={`em-summary-value${out ? ' is-unavailable' : ''}`}>
      {out ? 'Not recorded' : metric.valueLabel ?? formatMetric(metric)}<small>{out ? '' : metricUnit(metric)}</small>
    </span>
    <span className="em-summary-context">{out ? 'View missing data details' : previous ? `Previous: ${metric.previousLabel ?? formatMetric(metric, metric.previous)} ${metricUnit(metric)}` : 'No previous comparison'}</span>
    {metric.sample?.label && <span className="em-summary-sample">{metric.sample.label}</span>}
  </button>;
}

export function MiniBars({ rows, format, label }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <span className="em-summary-empty">No recorded values in this period</span>;
  return <span className="em-mini-bars" role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${format(r.value)}`).join('; ')}`}>
    {rows.map((r, i) => <span className="em-mini-row" key={r.key ?? r.name}>
      <span className="em-mini-label">{r.name}</span><strong>{format(r.value)}</strong>
      <span className="em-mini-track"><span style={{ width: `${r.value / max * 100}%` }} className={i ? 'is-secondary' : ''} /></span>
    </span>)}
  </span>;
}
