import { useId, useState } from 'react';
import { SERIES, TAIL } from './efficiencyPlots.jsx';

/* The small primitives for the Efficiency margin section: formatters, the KPI tile and its sparkline
 * and delta pill, the bullet gauge, the lollipop chart, the share bar and the table twin. The bigger
 * SVG plots live in efficiencyPlots.jsx; the view itself in EfficiencyMargin.jsx. Three files so each
 * stays under the project's 500-line limit.
 *
 * Provenance is shown as a MARK, not a sentence: a thin sample gets a dotted underline and a tooltip,
 * no data gets a hatched fill. The section is read at a glance, so prose is the thing being cut.
 */

/* ── formatting ─────────────────────────────────────────────────────────────────────────────── */

const CRORE = 1e7;
const LAKH = 1e5;
const trim = (value, digits) => Number(value.toFixed(digits)).toLocaleString('en-IN');

// Same ₹ wording as the mandate bar and the funnel API. A fallback only: a `valueLabel` from the API
// wins wherever it is sent, so the backend owns the wording.
export function inr(value) {
  const amount = Number.isFinite(value) ? value : 0;
  if (amount >= CRORE) return `₹${trim(amount / CRORE, amount >= 10 * CRORE ? 1 : 2)} Cr`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH, 1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export const count = (value) => (Number.isFinite(value) ? value.toLocaleString('en-IN') : '—');
export const rate = (value) => (Number.isFinite(value) ? trim(value, 1) : '—');
export const days = (value) => (Number.isFinite(value) ? trim(value, value < 10 ? 1 : 0) : '—');
// The API's `share` is already a percentage (90.9, not 0.909), so this never scales.
export const pct = (value) => (Number.isFinite(value) ? `${trim(value, value < 10 ? 1 : 0)}%` : '—');
export const money = (node, key = 'value') =>
  node?.[`${key}Label`] ?? (Number.isFinite(node?.[key]) ? inr(node[key]) : '—');

/* Long tails are folded, never drawn — the payload carries ~390 cities and 11 product types, and past
   the top few a chart stops comparing and becomes a decorated list. The full list stays in the table. */
export function foldTail(rows, keep, otherLabel) {
  const sorted = [...rows].sort((a, b) => (b.value || 0) - (a.value || 0));
  if (sorted.length <= keep + 1) return sorted;
  const tail = sorted.slice(keep);
  const value = tail.reduce((total, row) => total + (row.value || 0), 0);
  return [...sorted.slice(0, keep),
    { key: '__other__', name: `${otherLabel} (${tail.length})`, value, valueLabel: inr(value), muted: true }];
}

/* ── table twin ─────────────────────────────────────────────────────────────────────────────── */

/* Every chart's text alternative is the same table: a row header first, values after. One component,
   so all of them stay identical in markup and voice and no value is ever hover-only. */
export function DataTable({ caption, head, rows, className }) {
  return (
    <table className={className}>
      <caption className="em-sr">{caption}</caption>
      <thead><tr>{head.map((cell) => <th scope="col" key={cell}>{cell}</th>)}</tr></thead>
      <tbody>
        {rows.map(([key, header, ...cells]) => (
          <tr key={key}>
            <th scope="row">{header}</th>
            {cells.map((cell, index) => <td key={index}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── provenance marks ───────────────────────────────────────────────────────────────────────── */

/* A thin sample is a mark, not a paragraph: a dotted underline carrying the API's own sentence in a
   tooltip and in the accessible name. The figure stays legible; the caveat stays available. */
export function Sample({ sample }) {
  if (!sample?.label) return null;
  // Nothing is shown when the figure rests on every record in scope — a mark that is always there is
  // not a mark. It appears only when some of the records are missing the field, and turns amber when
  // fewer than a quarter of them carry it.
  const partial = sample.of > 0 && sample.count < sample.of;
  if (!partial) return null;
  const thin = sample.count / sample.of < 0.25;
  return (
    <span className={`em-prov${thin ? ' is-thin' : ''}`} title={sample.label}>
      <abbr aria-label={sample.label}>{count(sample.count)} of {count(sample.of)}</abbr>
    </span>
  );
}

/* Signed change against the period before, as a coloured pill. Direction rides on the arrow glyph and
   the sign as well as the colour, so it never depends on hue alone. `tone` is decided by the caller,
   because only it knows whether up is good for this metric. */
export function DeltaPill({ now, previous, tone, format = rate }) {
  if (!Number.isFinite(now) || !Number.isFinite(previous) || previous === 0) return null;
  const diff = now - previous;
  const share = Math.round(Math.abs(diff / previous) * 100);
  if (diff === 0 || share === 0) return <span className="em-pill is-flat">No change</span>;
  return (
    <span className={`em-pill is-${tone}`} title={`${format(previous)} before`}>
      <span aria-hidden="true">{diff > 0 ? '▲' : '▼'}</span>
      {share}%<span className="em-sr">{diff > 0 ? ' higher' : ' lower'} than the period before</span>
    </span>
  );
}

/* ── sparkline ──────────────────────────────────────────────────────────────────────────────── */

/* Twelve points of context under a headline figure. The line is the de-emphasis grey and only the
   final point — the period the figure describes — wears the accent, per the stat-tile contract. */
export function Sparkline({ values, width = 128, height = 30, color = SERIES[0], marks }) {
  const gid = useId().replace(/\W/g, '');
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const top = Math.max(...pts, 1);
  const low = Math.min(...pts, 0);
  const span = top - low || 1;
  const x = (i) => (i / (values.length - 1)) * width;
  const y = (v) => height - 2 - ((v - low) / span) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v || 0)}`).join('');
  const last = values.length - 1;
  return (
    <svg className="em-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`s${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${x(last)},${height}L0,${height}Z`} fill={`url(#s${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {/* an import month gets a dot on the line, so a spike is never read as trading */}
      {marks?.map((isBulk, i) => (isBulk ? <circle key={i} cx={x(i)} cy={y(values[i] || 0)} r="2.4" className="em-bulkdot" /> : null))}
      <circle cx={x(last)} cy={y(values[last] || 0)} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/* ── KPI tile ───────────────────────────────────────────────────────────────────────────────── */

/* Label, big figure, delta pill, sparkline — the reference dashboards' opening move, and the right
   form for a single headline number with history behind it. */
export function KpiTile({ label, value, unit, pill, spark, prov }) {
  return (
    <div className="em-kpi">
      <p className="em-kpi-h">{label}</p>
      <p className="em-kpi-v">{value}{unit ? <small> {unit}</small> : null}</p>
      <div className="em-kpi-foot">{pill}{prov}</div>
      {spark}
    </div>
  );
}

/* ── bullet gauge ───────────────────────────────────────────────────────────────────────────── */

/* This period as a bar, the period before as a tick on the same scale. Reads as "how far, against
   where we were" without a sentence — the right form for a duration, which has no natural maximum
   but does have a previous value worth hitting. */
export function Bullet({ value, previous, format, color = SERIES[0], tone }) {
  if (!Number.isFinite(value)) return null;
  const top = Math.max(value, previous || 0) * 1.15 || 1;
  return (
    <div className="em-bullet">
      <span className="em-bullet-track">
        <b style={{ width: `${(value / top) * 100}%`, background: color }} />
        {Number.isFinite(previous) && (
          <i className="em-bullet-tick" style={{ left: `${(previous / top) * 100}%` }}
            title={`${format(previous)} in the period before`} />
        )}
      </span>
      {Number.isFinite(previous) && (
        <span className={`em-bullet-was${tone ? ` is-${tone}` : ''}`}>was {format(previous)}</span>
      )}
    </div>
  );
}

/* ── lollipop ───────────────────────────────────────────────────────────────────────────────── */

/* A dot on a thin stem. Same information a bar carries, a fraction of the ink — which is what keeps a
   list of cities from reading as another bar chart. The dot is the data-end, >= 8px so it is a real
   hover target, and each row is its own 44px hit area. */
export function Lollipop({ rows, label }) {
  const [hover, setHover] = useState(null);
  if (!rows.length) return <p className="em-empty">Nothing sold in this period.</p>;
  const top = Math.max(...rows.map((row) => row.value || 0), 1);
  return (
    <ul className="em-pops" aria-label={label}>
      {rows.map((row) => {
        const at = Math.max(2, ((row.value || 0) / top) * 100);
        return (
          <li key={row.key} onPointerEnter={() => setHover(row.key)} onPointerLeave={() => setHover(null)}>
            <span className="em-pop-name" title={row.name}>{row.name}</span>
            <span className="em-pop-track">
              <i className="em-pop-stem" style={{ width: `${at}%`, background: row.muted ? TAIL : SERIES[0] }} />
              <b className={`em-pop-dot${hover === row.key ? ' is-on' : ''}`}
                style={{ left: `${at}%`, background: row.muted ? TAIL : SERIES[0] }} />
            </span>
            <span className="em-pop-val">{row.valueLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── 100% share bar ─────────────────────────────────────────────────────────────────────────── */

/* Part-to-whole across the three city buckets. A 2px surface gap separates segments (never a border),
   and the legend names each with its share, so hue is never the only channel. */
export function ShareBar({ segments }) {
  const sum = segments.reduce((acc, seg) => acc + (seg.value || 0), 0);
  if (!sum) return <p className="em-empty">Nothing closed in this period.</p>;
  return (
    <div className="em-shareblock">
      <div className="em-share" role="img"
        aria-label={`Share of value: ${segments.map((seg) => `${seg.name} ${pct(((seg.value || 0) / sum) * 100)}`).join(', ')}`}>
        {segments.map((seg) => (
          <b key={seg.key} className="em-seg" style={{ flexGrow: Math.max(0.001, seg.value || 0), background: seg.color }} />
        ))}
      </div>
      <ul className="em-legend">
        {segments.map((seg) => (
          <li key={seg.key}>
            <i style={{ background: seg.color }} aria-hidden="true" />
            <span>{seg.name}</span>
            <strong>{pct(((seg.value || 0) / sum) * 100)}</strong>
            <em>{seg.valueLabel}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── bulk-import rule ───────────────────────────────────────────────────────────────────────── */

/* Which months are data entry rather than trading. The API sends no per-month flag, so this is DERIVED
   from the series on screen by one stated rule — intake at or above 3x the median month. Nothing is
   invented: the rule is printed under the chart, flagged months are marked rather than removed, and an
   API-sent `bulk` flag wins over it. Without this, a 12-month trend shows data entry, not sales. */
export const BULK_MULTIPLE = 3;
export function markBulk(months) {
  const intake = months.map((row) => row.leads).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (intake.length < 4) return months.map((row) => ({ ...row, bulk: Boolean(row.bulk) }));
  const mid = intake.length >> 1;
  const median = intake.length % 2 ? intake[mid] : (intake[mid - 1] + intake[mid]) / 2;
  return months.map((row) => ({ ...row, bulk: row.bulk ?? (Number.isFinite(row.leads) && row.leads >= median * BULK_MULTIPLE) }));
}

export const bulkMonthKeys = (months) => new Set(markBulk(months).filter((row) => row.bulk).map((row) => row.month));
