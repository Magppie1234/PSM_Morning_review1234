// SMALL CHARTS, hand-written SVG, no charting library.
//
// Everything here is a few dozen lines of arithmetic and one <svg>. A library would be 50-200 kB on a
// board that draws eleven tiny charts, none of which needs zooming, brushing, tooltips-with-crosshairs
// or an animation engine. The trade is real: no pan/zoom, no stacked-area maths, no automatic axis
// nicing beyond what is written here. If this board ever needs those, swap it then - not before.
//
// THE PALETTE IS SIX COLOURS AND THAT IS THE WHOLE LIST. Every chart on PSM health draws from
// --an-c1 … --an-c6 in analytics.css and nothing else: no per-chart hues, no rainbow categorical
// scales, no gradients. A chart that needs a seventh colour is a chart that is trying to say too much,
// and the fix is to split it rather than to widen the palette.
//
//   c1 blue    the main series - the thing being measured
//   c2 sky     the same series, lighter: remainders, secondary bars, "of total"
//   c3 teal    good - connected, qualified, done
//   c4 amber   attention - not configured, overdue, ageing
//   c5 rose    loss - dropped, lost, dead
//   c6 slate   neutral - tracks, axes, grid, "no data"
//
// Accessibility: colour is never the only channel. Every chart carries its figure as text beside it,
// and each <svg> has a role and an aria-label describing what it shows, so a screen reader gets the
// number rather than "graphic".

const NS = 'http://www.w3.org/2000/svg';
const clamp = (value, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

/** A ratio as a percentage, or null when the denominator makes it meaningless. */
export const pct = (part, whole) => (whole > 0 ? clamp((part / whole) * 100) : null);

/** "6 / 34" -> { part: 6, whole: 34 }. The API sends denominators in this shape on most metrics. */
export function parseSample(sample) {
  const match = /^\s*([\d,.]+)\s*\/\s*([\d,.]+)\s*$/.exec(String(sample ?? ''));
  if (!match) return null;
  const part = Number(match[1].replace(/,/g, ''));
  const whole = Number(match[2].replace(/,/g, ''));
  return Number.isFinite(part) && Number.isFinite(whole) && whole > 0 ? { part, whole } : null;
}

/* ── Ring ─────────────────────────────────────────────────────────────────────────────────────── */
/** A donut showing one share. Used wherever a metric has a real denominator. */
export function Ring({ value, label, tone = 'c1', size = 64, stroke = 7 }) {
  const share = num(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = share == null ? 0 : (clamp(share) / 100) * circumference;
  return (
    <svg className="mc" width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns={NS}
      role="img" aria-label={label ?? `${share ?? 0}%`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--an-track)" strokeWidth={stroke} />
      {share != null && share > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={`var(--an-${tone})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

/* ── Gauge ────────────────────────────────────────────────────────────────────────────────────── */
/** A half-circle for a metric with no denominator. Shows an empty arc when the value is unset. */
export function Gauge({ value, label, tone = 'c1', width = 92 }) {
  const share = num(value);
  const height = width / 2 + 6;
  const radius = (width - 12) / 2;
  const cx = width / 2;
  const cy = height - 4;
  const arc = (from, to) => {
    const point = (deg) => [cx + radius * Math.cos(Math.PI * (1 + deg / 100)), cy + radius * Math.sin(Math.PI * (1 + deg / 100))];
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };
  return (
    <svg className="mc" width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns={NS}
      role="img" aria-label={label ?? (share == null ? 'Not configured' : `${share}%`)}>
      <path d={arc(0, 100)} fill="none" stroke="var(--an-track)" strokeWidth="7" strokeLinecap="round" />
      {share != null && share > 0 && (
        <path d={arc(0, clamp(share))} fill="none" stroke={`var(--an-${tone})`} strokeWidth="7" strokeLinecap="round" />
      )}
    </svg>
  );
}

/* ── Bullet ───────────────────────────────────────────────────────────────────────────────────── */
/** Progress against a target. The target tick is what separates this from a plain bar. */
export function Bullet({ value, target = null, label, tone = 'c1' }) {
  const share = num(value);
  const mark = num(target);
  return (
    <svg className="mc mc-bar mc-bar-tall" viewBox="0 0 200 14" preserveAspectRatio="none" xmlns={NS}
      role="img" aria-label={label ?? (share == null ? 'No target set' : `${share}% of target`)}>
      <rect x="0" y="4" width="200" height="6" rx="3" fill="var(--an-track)" />
      {share != null && share > 0 && (
        <rect x="0" y="4" width={(clamp(share) / 100) * 200} height="6" rx="3" fill={`var(--an-${tone})`} />
      )}
      {mark != null && <rect x={(clamp(mark) / 100) * 200 - 1} y="0" width="2" height="14" rx="1" fill="var(--an-c4)" />}
    </svg>
  );
}

/* ── Waffle ───────────────────────────────────────────────────────────────────────────────────── */
/**
 * `part` of `whole` as filled squares. Reads as a count in a way a bar cannot: 30 of 60 untouched
 * leads is thirty things, and the grid shows thirty things.
 */
export function Waffle({ part, whole, label, tone = 'c1', columns = 12, cell = 9, gap = 3 }) {
  const total = Math.max(0, Math.round(num(whole) ?? 0));
  if (!total) return null;
  // Above ~120 squares the grid stops reading as countable, so one square starts representing several.
  const squares = Math.min(total, 120);
  const scale = squares / total;
  const filled = Math.round(Math.max(0, Math.round(num(part) ?? 0)) * scale);
  const rows = Math.ceil(squares / columns);
  const width = columns * (cell + gap) - gap;
  const height = rows * (cell + gap) - gap;
  return (
    <svg className="mc" width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns={NS}
      role="img" aria-label={label ?? `${part} of ${whole}`}>
      {Array.from({ length: squares }, (_, index) => (
        <rect
          key={index}
          x={(index % columns) * (cell + gap)}
          y={Math.floor(index / columns) * (cell + gap)}
          width={cell} height={cell} rx="2"
          fill={index < filled ? `var(--an-${tone})` : 'var(--an-track)'}
        />
      ))}
    </svg>
  );
}

/* ── Split bar ────────────────────────────────────────────────────────────────────────────────── */
/** One bar cut into a measured part and its remainder. */
export function SplitBar({ part, whole, label, tone = 'c1' }) {
  const share = pct(num(part) ?? 0, num(whole) ?? 0);
  return (
    <svg className="mc mc-bar" viewBox="0 0 200 10" preserveAspectRatio="none" xmlns={NS}
      role="img" aria-label={label ?? `${part} of ${whole}`}>
      <rect x="0" y="0" width="200" height="10" rx="5" fill="var(--an-track)" />
      {share != null && share > 0 && <rect x="0" y="0" width={(share / 100) * 200} height="10" rx="5" fill={`var(--an-${tone})`} />}
    </svg>
  );
}

/* ── Horizontal bars ──────────────────────────────────────────────────────────────────────────── */
/**
 * A ranked list. `rows` is [{ label, value, note }]; the longest bar sets the scale, and the leader
 * is drawn in the solid tone while the rest take the lighter one, so rank reads before the numbers do.
 */
export function HBars({ rows = [], tone = 'c1', restTone = 'c2', suffix = '', empty = 'No data available' }) {
  const data = rows.filter((row) => row && Number.isFinite(Number(row.value)));
  if (!data.length) return <p className="an-none">{empty}</p>;
  const max = Math.max(1, ...data.map((row) => Number(row.value)));
  return (
    <ul className="mc-rows">
      {data.map((row, index) => (
        <li key={row.label}>
          <span className="mc-name" title={row.label}>{row.label}</span>
          <span className="mc-track">
            <span
              className="mc-fill"
              style={{ width: `${clamp((Number(row.value) / max) * 100, 1)}%`, background: `var(--an-${index === 0 ? tone : restTone})` }}
            />
          </span>
          <b className="mc-value">{fmt(row.value)}{suffix}</b>
          {row.note && <small className="mc-note">{row.note}</small>}
        </li>
      ))}
    </ul>
  );
}

/* ── Lollipop ─────────────────────────────────────────────────────────────────────────────────── */
/** Same data as a bar row, drawn as stem + dot. Used where the value is a quantity, not a share. */
export function Lollipop({ rows = [], tone = 'c3', suffix = '', empty = 'No data available' }) {
  const data = rows.filter((row) => row && Number.isFinite(Number(row.value)));
  if (!data.length) return <p className="an-none">{empty}</p>;
  const max = Math.max(1, ...data.map((row) => Number(row.value)));
  return (
    <ul className="mc-rows mc-pops">
      {data.map((row) => {
        const at = clamp((Number(row.value) / max) * 100, 0);
        return (
          <li key={row.label}>
            <span className="mc-name" title={row.label}>{row.label}</span>
            <span className="mc-track">
              <span className="mc-stem" style={{ width: `${at}%` }} />
              <span className="mc-dot" style={{ left: `${at}%`, background: `var(--an-${tone})` }} />
            </span>
            <b className="mc-value">{fmt(row.value)}{suffix}</b>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Combo: columns + line on two axes ────────────────────────────────────────────────────────── */
/**
 * Volume as columns, rate as a line. The two belong together and have different units, which is the
 * one case where a second axis earns its keep: 1,024 leads and 32% cannot share a scale.
 */
export function Combo({ rows = [], width = 900, height = 220, empty = 'No data available' }) {
  const data = (rows ?? []).filter(Boolean);
  if (!data.length) return <p className="an-none">{empty}</p>;
  const pad = { top: 18, right: 38, bottom: 26, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxCount = Math.max(1, ...data.map((row) => Number(row.count) || 0));
  const maxRate = Math.max(1, ...data.map((row) => Number(row.rate) || 0));
  const step = plotW / data.length;
  const barW = Math.max(6, step * 0.5);
  const x = (index) => pad.left + index * step + step / 2;
  const yCount = (value) => pad.top + plotH - (value / maxCount) * plotH;
  const yRate = (value) => pad.top + plotH - (value / maxRate) * plotH;
  const line = data.map((row, index) => `${index ? 'L' : 'M'} ${x(index)} ${yRate(Number(row.rate) || 0)}`).join(' ');

  return (
    <svg className="mc-combo" viewBox={`0 0 ${width} ${height}`} xmlns={NS} role="img"
      aria-label={`Leads created and qualification rate across ${data.length} months`}>
      {[0, 0.25, 0.5, 0.75, 1].map((at) => (
        <line key={at} x1={pad.left} x2={width - pad.right} y1={pad.top + plotH * at} y2={pad.top + plotH * at}
          stroke="var(--an-grid)" strokeWidth="1" />
      ))}
      {data.map((row, index) => {
        const value = Number(row.count) || 0;
        return (
          <rect key={`b${row.label}`} x={x(index) - barW / 2} y={yCount(value)} width={barW}
            height={Math.max(0, pad.top + plotH - yCount(value))} rx="3" fill="var(--an-c2)" />
        );
      })}
      <path d={line} fill="none" stroke="var(--an-c1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((row, index) => (
        <circle key={`d${row.label}`} cx={x(index)} cy={yRate(Number(row.rate) || 0)} r="3.5"
          fill="var(--an-surface)" stroke="var(--an-c1)" strokeWidth="2" />
      ))}
      {data.map((row, index) => (
        <text key={`t${row.label}`} x={x(index)} y={height - 8} textAnchor="middle" className="mc-axis">
          {monthLabel(row.label, index === 0 || monthLabel(row.label) === 'Jan')}
        </text>
      ))}
      <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" className="mc-axis">{fmt(maxCount)}</text>
      <text x={width - pad.right + 6} y={pad.top + 4} textAnchor="start" className="mc-axis">{fmt(maxRate)}%</text>
    </svg>
  );
}

/* ── Sparkline ────────────────────────────────────────────────────────────────────────────────── */
/** A shape, not a readable series: it says "rising" or "flat", and the number beside it says how much. */
export function Spark({ values = [], width = 180, height = 44, tone = 'c1', label }) {
  const data = (values ?? []).map(num).filter((value) => value != null);
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const x = (index) => (index / (data.length - 1)) * width;
  const y = (value) => height - 3 - ((value - min) / span) * (height - 6);
  const line = data.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
  return (
    <svg className="mc mc-wide" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" xmlns={NS}
      role="img" aria-label={label ?? 'Trend'}>
      <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`var(--an-${tone})`} opacity="0.1" />
      <path d={line} fill="none" stroke={`var(--an-${tone})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Scatter ──────────────────────────────────────────────────────────────────────────────────── */
/**
 * Two measures against each other, one dot per person. Answers "is effort turning into outcome".
 *
 * WHAT THE LABELS ARE FOR. Four unlabelled dots on two unlabelled axes is a picture of nothing: you
 * can see there is spread and you cannot see who is where, or whether 200 talk minutes is a lot. So
 * every dot carries its name, both axes carry their range, and the two median lines cut the plot into
 * quadrants - which is the thing the question actually asks. A dot right of the vertical median is
 * calling more than half the team; above the horizontal median it is also qualifying more than half.
 * Bottom-right is the one that matters: lots of calling, little to show for it.
 */
export function Scatter({ rows = [], xLabel, yLabel, width = 300, height = 230, empty = 'No data available' }) {
  const data = (rows ?? []).filter((row) => Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y)));
  if (!data.length) return <p className="an-none">{empty}</p>;
  const pad = { top: 14, right: 16, bottom: 34, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  // The axes start at zero: a scatter of rates that starts at the lowest value exaggerates small gaps.
  const maxX = Math.max(1, ...data.map((row) => Number(row.x)));
  const maxY = Math.max(1, ...data.map((row) => Number(row.y)));
  const at = (row) => ({
    cx: pad.left + (Number(row.x) / maxX) * plotW,
    cy: pad.top + plotH - (Number(row.y) / maxY) * plotH
  });
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const midX = pad.left + (median(data.map((row) => Number(row.x))) / maxX) * plotW;
  const midY = pad.top + plotH - (median(data.map((row) => Number(row.y))) / maxY) * plotH;

  return (
    <svg className="mc-scatter" viewBox={`0 0 ${width} ${height}`} xmlns={NS} role="img"
      aria-label={`${yLabel} against ${xLabel} for ${data.length} people. ${data.map((row) => `${row.label}: ${fmt(row.x)} ${xLabel}, ${fmt(row.y)} ${yLabel}`).join('. ')}`}>
      {/* Median guides, so each dot can be read as above or below the team's middle. */}
      <line x1={midX} x2={midX} y1={pad.top} y2={pad.top + plotH} stroke="var(--an-c6)" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />
      <line x1={pad.left} x2={width - pad.right} y1={midY} y2={midY} stroke="var(--an-c6)" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="var(--an-grid)" />
      <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--an-grid)" />

      {data.map((row) => {
        const { cx, cy } = at(row);
        // Labels flip to the left of the dot near the right edge so they never run off the plot.
        const flip = cx > pad.left + plotW * 0.62;
        return (
          <g key={row.label}>
            <circle cx={cx} cy={cy} r="5" fill="var(--an-c1)" opacity="0.9">
              <title>{`${row.label}: ${fmt(row.x)} ${xLabel}, ${fmt(row.y)} ${yLabel}`}</title>
            </circle>
            <text x={flip ? cx - 8 : cx + 8} y={cy + 3.5} textAnchor={flip ? 'end' : 'start'} className="mc-point">
              {row.label}
            </text>
          </g>
        );
      })}

      {/* Axis ranges. Without them "far right" has no magnitude. */}
      <text x={pad.left} y={pad.top + plotH + 14} textAnchor="start" className="mc-axis">0</text>
      <text x={width - pad.right} y={pad.top + plotH + 14} textAnchor="end" className="mc-axis">{fmt(maxX)}</text>
      <text x={pad.left - 6} y={pad.top + plotH + 3} textAnchor="end" className="mc-axis">0</text>
      <text x={pad.left - 6} y={pad.top + 8} textAnchor="end" className="mc-axis">{fmt(maxY)}</text>
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" className="mc-axis">{xLabel}</text>
      <text x={11} y={pad.top + plotH / 2} textAnchor="middle" className="mc-axis"
        transform={`rotate(-90 11 ${pad.top + plotH / 2})`}>{yLabel}</text>
    </svg>
  );
}

/**
 * "2025-11" -> "Nov", and "Nov 25" at the year boundary so a twelve-month axis says which year it
 * crossed into. Bare month numbers ("11", "12", "01") are unreadable as an axis.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(label, withYear = false) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(label ?? ''));
  if (!match) return String(label ?? '').slice(-3);
  const name = MONTHS[Number(match[2]) - 1] ?? match[2];
  return withYear ? `${name} ${match[1].slice(2)}` : name;
}

/** Indian digit grouping, one decimal at most — the format every figure on this board already uses. */
export function fmt(value) {
  const number = num(value);
  return number == null ? '—' : number.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}
