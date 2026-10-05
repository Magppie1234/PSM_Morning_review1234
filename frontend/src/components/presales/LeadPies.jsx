import { useState } from 'react';
import { AGE_BUCKETS, ageBucket, statusAge } from './leadTiming.jsx';

// Chart view of a lead table: two donuts, by PSM and by time in status. Clicking a slice or legend row
// narrows the table to it. Colours: each PSM keeps a fixed hue (validated as a ring, see dataviz palette);
// ages use the status colours, always with a text label beside them.
const PSM_COLORS = { Deepak: '#2a78d6', Ishita: '#eb6834', Sowmya: '#1baf7a', Sparshan: '#eda100' };
const OTHER = '#8a8f98';
const AGE_COLORS = { fresh: '#0ca30c', day: '#fab219', late: '#d03b3b' };
const REASON_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8b5cf6', '#d03b3b', '#64748b'];
const reasonOf = (lead) => String(lead.reason ?? '').trim() || 'No reason recorded in Zoho';
const R = 62;
const WIDTH = 22;

function arc(start, end) {
  const point = (angle, radius) => [80 + radius * Math.sin(angle), 80 - radius * Math.cos(angle)];
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(start, R);
  const [x2, y2] = point(end, R);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

function Donut({ title, slices, total, focus, onPick, reasons = false }) {
  const [hover, setHover] = useState(null);
  let angle = 0;
  const shown = hover ?? slices.find((slice) => slice.key === focus);
  const ends = [];
  slices.reduce((sum, slice) => {
    ends.push(((sum + slice.count) / total) * Math.PI * 2);
    return sum + slice.count;
  }, 0);
  return (
    <figure className={`lp-chart${reasons ? ' lp-reasons' : ''}`}>
      <figcaption>{title}</figcaption>
      <div className="lp-body">
        <svg viewBox="0 0 160 160" role="img" aria-label={`${title}: ${slices.map((slice) => `${slice.label} ${slice.count}`).join(', ')}`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line-soft)" strokeWidth={WIDTH} />
          {slices.map((slice) => {
            const sweep = (slice.count / total) * Math.PI * 2;
            const start = angle;
            angle += sweep;
            const whole = sweep >= Math.PI * 2 - 0.0001;
            return (
              <path
                key={slice.key}
                d={whole ? `${arc(0, Math.PI)} ${arc(Math.PI, Math.PI * 2 - 0.0001)}` : arc(start, angle)}
                fill="none"
                stroke={slice.color}
                strokeWidth={hover?.key === slice.key || focus === slice.key ? WIDTH + 6 : WIDTH}
                className="lp-slice"
                onMouseEnter={() => setHover(slice)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(slice.key)}
              >
                <title>{`${slice.label}: ${slice.count} (${Math.round((slice.count / total) * 100)}%)`}</title>
              </path>
            );
          })}
          {/* 2px surface gaps between slices */}
          {slices.length > 1 && ends.map((end) => {
            const at = (radius) => [80 + radius * Math.sin(end), 80 - radius * Math.cos(end)];
            const [x1, y1] = at(R - WIDTH / 2 - 4);
            const [x2, y2] = at(R + WIDTH / 2 + 4);
            return <line key={end} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--surface)" strokeWidth="2" pointerEvents="none" />;
          })}
          <text x="80" y="76" textAnchor="middle" className="lp-center-num">{shown ? shown.count : total}</text>
          <text x="80" y="94" textAnchor="middle" className="lp-center-label">{shown && !reasons ? shown.label : 'leads'}</text>
        </svg>
        <ul className="lp-legend">
          {slices.map((slice) => (
            <li key={slice.key}>
              <button type="button" aria-pressed={focus === slice.key} onClick={() => onPick(slice.key)}
                onMouseEnter={() => setHover(slice)} onMouseLeave={() => setHover(null)}>
                <i style={{ background: slice.color }} aria-hidden="true" />
                <span>{slice.label}</span>
                <b>{slice.count}</b>
                <em>{Math.round((slice.count / total) * 100)}%</em>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function LeadPies({ leads, focus, onFocus, showReasons = false }) {
  if (!leads.length) return <p className="lf-detail-empty">No leads to chart for this selection.</p>;
  const byPsm = new Map();
  leads.forEach((lead) => byPsm.set(lead.psm ?? 'Unassigned', (byPsm.get(lead.psm ?? 'Unassigned') ?? 0) + 1));
  const psmSlices = [...byPsm].sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ key: name, label: name, count, color: PSM_COLORS[name] ?? OTHER }));
  const ageSlices = AGE_BUCKETS
    .map((bucket) => ({ key: bucket.key, label: bucket.label, color: AGE_COLORS[bucket.key], count: leads.filter((lead) => ageBucket(statusAge(lead)) === bucket.key).length }))
    .filter((slice) => slice.count);
  const pick = (type) => (key) => onFocus(focus?.type === type && focus.key === key ? null : { type, key });
  const byReason = new Map();
  if (showReasons) leads.forEach((lead) => {
    const reason = reasonOf(lead);
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  });
  const reasonSlices = [...byReason].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count], index) => ({ key: reason, label: reason, count, color: REASON_COLORS[index % REASON_COLORS.length] }));

  return (
    <div className="lp">
      <Donut title="By PSM" slices={psmSlices} total={leads.length} focus={focus?.type === 'psm' ? focus.key : null} onPick={pick('psm')} />
      <Donut title="By time in status" slices={ageSlices} total={leads.length} focus={focus?.type === 'age' ? focus.key : null} onPick={pick('age')} />
      {showReasons && <Donut title="By reason for dropping" slices={reasonSlices} total={leads.length}
        focus={focus?.type === 'reason' ? focus.key : null} onPick={pick('reason')} reasons />}
      <p className="lp-hint">Click a slice or a row to see those leads in the table.</p>
    </div>
  );
}

export const matchesFocus = (lead, focus) => !focus
  || (focus.type === 'psm' ? (lead.psm ?? 'Unassigned') === focus.key
    : focus.type === 'reason' ? reasonOf(lead) === focus.key : ageBucket(statusAge(lead)) === focus.key);

export const focusLabel = (focus) => (focus?.type === 'age' ? AGE_BUCKETS.find((bucket) => bucket.key === focus.key)?.label : focus?.key);
