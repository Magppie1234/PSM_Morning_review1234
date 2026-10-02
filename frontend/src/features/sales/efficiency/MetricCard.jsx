import { ArrowUpRight } from 'lucide-react';
import { Spark } from '../../../components/charts/MiniCharts.jsx';
import { formatMetric, metricUnit, unavailable } from './format.js';

// WHICH TWELVE-MONTH SERIES BELONGS TO WHICH CARD. Only four of the eight metrics have a monthly
// series behind them; the other four (both time-to-close figures, average order value, average
// discount) are period aggregates with nothing to plot, and they stay as plain figures. Drawing a
// shape for them would mean inventing one.
const SERIES_FOR = {
  leadRate: (month) => month.leads,
  qualificationRate: (month) => month.qualified,
  closureRate: (month) => month.closed,
  averageOrderValue: (month) => month.closedValue
};

/**
 * ONE CARD, AND WHY IT IS STILL A CARD AND NOT A CHART.
 *
 * This section's design is deliberate and documented in DESIGN.md: "eight shallow metric cards and
 * three short ranking panels replace the long chart wall", with the real charts and tables behind a
 * click. Adding a wall of inline charts here would undo that on purpose.
 *
 * So the chart added here is the smallest one that earns its place: a sparkline of the card's own
 * twelve-month series, which answers "is this normal or unusual" at a glance - the one question the
 * bare figure plus "Previous: x" cannot answer, because two points cannot show a trend. The detail
 * modal still owns the full chart and its table.
 */
export function MetricCard({ metric, comparison, onOpen, months = [] }) {
  const out = unavailable(metric);
  const previous = Number.isFinite(metric.previous) && comparison?.available !== false;
  // Direction is carried by a word as well as the shape, because a sparkline alone is not readable
  // to a screen reader and colour alone is not an accessible channel.
  const change = previous && Number.isFinite(metric.value) && metric.previous !== 0
    ? ((metric.value - metric.previous) / Math.abs(metric.previous)) * 100
    : null;
  const pick = SERIES_FOR[metric.key];
  const values = pick && months.length
    ? months.filter((month) => month?.available !== false).map(pick).filter((value) => Number.isFinite(Number(value)))
    : [];

  return <button className="em-summary-card" type="button" onClick={onOpen} aria-haspopup="dialog">
    <span className="em-summary-label">{metric.label}<ArrowUpRight size={15} aria-hidden="true" /></span>
    <span className={`em-summary-value${out ? ' is-unavailable' : ''}`}>
      {out ? 'Not recorded' : metric.valueLabel ?? formatMetric(metric)}<small>{out ? '' : metricUnit(metric)}</small>
    </span>
    {values.length > 1 && (
      <span className="em-summary-spark">
        <Spark values={values} tone={change != null && change < 0 ? 'c5' : 'c3'} height={30}
          label={`${metric.label}: ${values.length} months to ${formatMetric(metric)}`} />
      </span>
    )}
    <span className="em-summary-context">
      {out
        ? 'View missing data details'
        : previous
          ? <>Previous: {metric.previousLabel ?? formatMetric(metric, metric.previous)} {metricUnit(metric)}
            {change != null && <em className={`em-delta ${change < 0 ? 'is-down' : 'is-up'}`}>
              {change < 0 ? '↓' : '↑'} {Math.abs(change).toFixed(0)}%
            </em>}</>
          : 'No previous comparison'}
    </span>
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
