import { useId, useState } from 'react';

/* The SVG plots for the Efficiency margin section — donut, ring gauge, area+line and heat grid.
 * Split from efficiencyCharts.jsx so every file stays under the project's 500-line limit. Nothing
 * here knows what a metric means; it only knows how to draw one.
 *
 * Palette, validated with the dataviz script against this board's white surface:
 *   categorical, fixed order   blue #3b6fd8 · amber #b7791f · violet #6d4fd8 · green #138a4f · red #d0503f
 *                              (all adjacent pairs pass: worst normal-vision ΔE 26.8, all >= 3:1)
 *   ordinal blue ramp          #9db4ee → #3b6fd8 → #23408a  (monotone L, ΔL >= 0.06, light end 2.06:1)
 *   tail / de-emphasis         grey #8a8f98 — not an identity slot, so its low chroma is deliberate
 * Hues are assigned in that fixed order and never cycled; a sixth category folds into the grey tail.
 */

export const SERIES = ['#3b6fd8', '#b7791f', '#6d4fd8', '#138a4f', '#d0503f'];
export const TAIL = '#8a8f98';
export const RAMP = ['#9db4ee', '#3b6fd8', '#23408a'];
const SURFACE = '#ffffff';

/* ── donut ──────────────────────────────────────────────────────────────────────────────────── */

/* Part-to-whole where one slice dominates — a donut shows that dominance in one glance in a way a
 * column of bars does not. Segments are separated by a real 2px gap in the surface colour rather than
 * a stroke, so no data-weight ink is added. The legend carries name + share, so hue is never the only
 * channel, and the centre holds the total rather than a decorative label. */
export function Donut({ segments, centreValue, centreLabel, size = 132, thickness = 20, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0);
  if (!total) return <p className="em-empty">Nothing to show for this period.</p>;

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2;
  let acc = 0;

  return (
    <div className="em-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg) => {
            const frac = (seg.value || 0) / total;
            const dash = Math.max(0.5, frac * c - gap);
            const node = (
              <circle key={seg.key} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={seg.color} strokeWidth={hover === seg.key ? thickness + 3 : thickness}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc * c}
                className="em-arc" onPointerEnter={() => setHover(seg.key)} onPointerLeave={() => setHover(null)} />
            );
            acc += frac;
            return node;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 2} className="em-donut-v" textAnchor="middle">
          {hover ? segments.find((s) => s.key === hover)?.valueLabel ?? centreValue : centreValue}
        </text>
        <text x={size / 2} y={size / 2 + 13} className="em-donut-l" textAnchor="middle">
          {hover ? segments.find((s) => s.key === hover)?.name ?? centreLabel : centreLabel}
        </text>
      </svg>
      <ul className="em-legend">
        {segments.map((seg) => (
          <li key={seg.key} onPointerEnter={() => setHover(seg.key)} onPointerLeave={() => setHover(null)}>
            <i style={{ background: seg.color }} aria-hidden="true" />
            <span>{seg.name}</span>
            <strong>{Math.round(((seg.value || 0) / total) * 100)}%</strong>
            <em>{seg.valueLabel}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── ring gauge ─────────────────────────────────────────────────────────────────────────────── */

/* One figure in a ring, with the period before it as a faint outer track.
 *
 * A ring needs a denominator, and a rate like "12.7 leads a day" has no natural maximum — so the
 * denominator here is stated rather than invented: the ring is scaled to whichever of the two periods
 * is larger, and `scaleNote` prints that. The reader is comparing two arcs, not reading a percentage
 * of some unstated target. `max` overrides it where the metric really does have a ceiling.
 * An `empty` ring is the no-data state: hatched, greyed, with the words in the middle. */
export function RingGauge({
  value, previous, max, centre, label, color = SERIES[0], size = 118, thickness = 12,
  empty = false, ariaLabel, scaleNote
}) {
  const hatchId = useId().replace(/\W/g, '');
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const top = max ?? Math.max(value || 0, previous || 0, 1);
  const frac = empty ? 0 : Math.min(1, (value || 0) / top);
  const prevFrac = Number.isFinite(previous) ? Math.min(1, previous / top) : null;

  return (
    <div className={`em-ring${empty ? ' is-empty' : ''}`} title={scaleNote || undefined}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
        <defs>
          <pattern id={`h${hatchId}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#f1f2f5" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#c9ccd4" strokeWidth="2.5" />
          </pattern>
        </defs>
        {/* the track — hatched when there is nothing to measure, so the gap reads as a gap */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
          stroke={empty ? `url(#h${hatchId})` : '#eef0f4'} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {/* the period before, as a thin faint arc outside the main one */}
          {prevFrac !== null && !empty && (
            <circle cx={size / 2} cy={size / 2} r={r + thickness / 2 + 3} fill="none" stroke={color}
              strokeWidth="2" strokeOpacity="0.32" strokeLinecap="round"
              strokeDasharray={`${prevFrac * 2 * Math.PI * (r + thickness / 2 + 3)} ${2 * Math.PI * (r + thickness / 2 + 3)}`} />
          )}
          {!empty && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
              strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} className="em-arc" />
          )}
        </g>
        <text x={size / 2} y={size / 2 + (label ? -1 : 5)} className={`em-ring-v${empty ? ' is-empty' : ''}`} textAnchor="middle">{centre}</text>
        {label && <text x={size / 2} y={size / 2 + 14} className="em-ring-l" textAnchor="middle">{label}</text>}
      </svg>
    </div>
  );
}

/* ── area + line ────────────────────────────────────────────────────────────────────────────── */

const W = 560;
const H = 150;
const PAD = { t: 10, r: 8, b: 20, l: 8 };

const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');

/* Leads as a gradient area, orders won as a line over it.
 *
 * ONE y-axis, shared. That is legal precisely because both series are counts of records — this is not
 * a dual-axis chart, which would invent a correlation by scaling two different quantities to fit.
 * Orders won therefore sits low against leads, which is the truth: we win a small fraction of what we
 * take in. Rupees are a different quantity and get their own panel. */
export function AreaLine({ points, areaKey, lineKey, areaName, lineName, formatArea, formatLine, hideBulk = false }) {
  const gid = useId().replace(/\W/g, '');
  const [hover, setHover] = useState(null);
  if (points.length < 2) return <p className="em-empty">Not enough history yet.</p>;

  const shown = (p) => !(hideBulk && p.bulk);
  const top = Math.max(...points.filter(shown).map((p) => Math.max(p[areaKey] || 0, p[lineKey] || 0)), 1);
  const x = (i) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v || 0) / top) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;

  /* Hidden months break the line rather than closing the gap: the run is split into segments wherever
     a month is left out, so the chart never draws a straight line across data it is not showing. */
  const runs = (key) => {
    const out = [];
    let run = [];
    points.forEach((p, i) => {
      if (shown(p) && Number.isFinite(p[key])) run.push({ x: x(i), y: y(p[key]) });
      else { if (run.length) out.push(run); run = []; }
    });
    if (run.length) out.push(run);
    return out;
  };
  // A month left alone between two hidden ones cannot be a line, so it is drawn as a dot rather than
  // dropped — hiding the imports must not quietly lose the months either side of them.
  const split = (key) => { const all = runs(key); return { lines: all.filter((r) => r.length > 1), dots: all.filter((r) => r.length === 1).map((r) => r[0]) }; };
  const area = split(areaKey);
  const lineRunsAll = split(lineKey);
  const areaRuns = area.lines;
  const lineRuns = lineRunsAll.lines;

  return (
    <div className="em-al">
      <p className="em-panel-h">
        <span className="em-keys">
          <b><i style={{ background: SERIES[0] }} aria-hidden="true" />{areaName}</b>
          <b><i style={{ background: SERIES[1] }} aria-hidden="true" />{lineName}</b>
        </span>
        {hover && (
          <span className="em-panel-read">
            <strong>{formatArea(hover[areaKey])}</strong> {areaName.toLowerCase()} ·{' '}
            <strong>{formatLine(hover[lineKey])}</strong> {lineName.toLowerCase()} · {hover.label}
          </span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="em-plot" role="img"
        aria-label={`${areaName} and ${lineName} by month, both counts on one scale. Full figures in the table below.`}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity="0.28" />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PAD.l} y1={base} x2={W - PAD.r} y2={base} className="em-axis" />
        {areaRuns.map((run, i) => (
          <path key={`a${i}`} d={`${pathOf(run)}L${run[run.length - 1].x},${base}L${run[0].x},${base}Z`} fill={`url(#g${gid})`} />
        ))}
        {areaRuns.map((run, i) => (
          <path key={`al${i}`} d={pathOf(run)} fill="none" stroke={SERIES[0]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {lineRuns.map((run, i) => (
          <path key={`l${i}`} d={pathOf(run)} fill="none" stroke={SERIES[1]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {area.dots.map((p, i) => <circle key={`ad${i}`} cx={p.x} cy={p.y} r="3.5" fill={SERIES[0]} stroke={SURFACE} strokeWidth="2" />)}
        {lineRunsAll.dots.map((p, i) => <circle key={`ld${i}`} cx={p.x} cy={p.y} r="3.5" fill={SERIES[1]} stroke={SURFACE} strokeWidth="2" />)}
        {/* every third month is named, so the shape can be read against the calendar without crowding */}
        {points.map((p, i) => (i % 3 === 0 || i === points.length - 1
          ? <text key={`t${p.month}`} x={x(i)} y={H - 6} className={`em-xlab${p.bulk ? ' is-bulk' : ''}`} textAnchor="middle">{String(p.label).split(' ')[0]}</text>
          : null))}
        {points.map((p, i) => (
          <g key={p.month} tabIndex={0} className="em-pt"
            onPointerEnter={() => setHover(p)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(p)} onBlur={() => setHover(null)}
            aria-label={shown(p)
              ? `${p.label}: ${formatArea(p[areaKey])} ${areaName}, ${formatLine(p[lineKey])} ${lineName}`
              : `${p.label}: hidden, an import month`}>
            {/* the whole column is the hit target, so nobody aims at a 4px dot */}
            <rect x={x(i) - (W / points.length) / 2} y="0" width={W / points.length} height={H} fill="transparent" />
            {hover?.month === p.month && <line x1={x(i)} y1={PAD.t} x2={x(i)} y2={base} className="em-cross" />}
            {hover?.month === p.month && shown(p) && (
              <>
                <circle cx={x(i)} cy={y(p[areaKey])} r="4" fill={SERIES[0]} stroke={SURFACE} strokeWidth="2" />
                <circle cx={x(i)} cy={y(p[lineKey])} r="4" fill={SERIES[1]} stroke={SURFACE} strokeWidth="2" />
              </>
            )}
            {p.bulk && <circle cx={x(i)} cy={PAD.t - 4} r="3" className="em-bulkdot" />}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── heat grid ──────────────────────────────────────────────────────────────────────────────── */

/* A matrix of months against measures, each ROW scaled to its own maximum.
 *
 * Per-row scaling is the honest choice, not a convenience: leads run in the hundreds and orders won in
 * the tens, so one shared scale would leave three rows uniformly pale and show nothing. Each row
 * therefore answers "which months were this row's big ones", and never "is this row bigger than that
 * one" — the row label says what it is scaled against. Colour is one hue, light to dark, because this
 * encodes magnitude, not identity. */
export function HeatGrid({ rows, columns, marks, hidden }) {
  const [hover, setHover] = useState(null);
  const hiddenAt = (i) => hidden?.has(columns[i].key);
  if (!rows.length) return null;
  return (
    <div className="em-heat">
      <div className="em-heat-grid" style={{ gridTemplateColumns: `minmax(84px, auto) repeat(${columns.length}, minmax(0, 1fr))` }}>
        <span />
        {columns.map((col, i) => <span key={col.key} className={`em-heat-col${marks?.has(col.key) ? ' is-bulk' : ''}`}>{col.short}</span>)}
        {rows.map((row) => {
          // Hidden months are left out of the row's maximum as well as its cells — otherwise an import
          // month keeps setting the scale and every real month stays the same pale shade.
          const top = Math.max(...row.values.filter((v, i) => !hiddenAt(i)).map((v) => v || 0), 1);
          return (
            <Fragmentish key={row.key}>
              <span className="em-heat-row">{row.name}</span>
              {row.values.map((value, i) => {
                const out = hiddenAt(i);
                const frac = out ? 0 : Math.min(1, (value || 0) / top);
                const on = hover && hover.r === row.key && hover.c === columns[i].key;
                return (
                  <button type="button" key={columns[i].key} className={`em-heat-cell${on ? ' is-on' : ''}${out ? ' is-out' : ''}`}
                    style={{ '--f': frac }} title={out ? `${columns[i].name}: hidden, an import month` : `${row.name}, ${columns[i].name}: ${row.format(value)}`}
                    onPointerEnter={() => setHover({ r: row.key, c: columns[i].key, value, row, col: columns[i] })}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ r: row.key, c: columns[i].key, value, row, col: columns[i] })}
                    onBlur={() => setHover(null)}>
                    <span className="em-sr">{out ? `${columns[i].name}: hidden, an import month` : `${row.name}, ${columns[i].name}: ${row.format(value)}`}</span>
                  </button>
                );
              })}
            </Fragmentish>
          );
        })}
      </div>
      <p className="em-heat-foot">
        <span className="em-heat-key" aria-hidden="true">
          <i style={{ '--f': 0.12 }} /><i style={{ '--f': 0.4 }} /><i style={{ '--f': 0.7 }} /><i style={{ '--f': 1 }} />
        </span>
        Light to dark within each row
        {hover && <em><strong>{hover.row.format(hover.value)}</strong> {hover.row.name.toLowerCase()} · {hover.col.name}</em>}
      </p>
    </div>
  );
}

// A keyed fragment, so each heat row's cells stay direct children of the one grid.
function Fragmentish({ children }) { return <>{children}</>; }
