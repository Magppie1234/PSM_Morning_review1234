import { useState } from 'react';

// The donut chart behind every Sales records popup.
//
// Lifted from the PSM board's LeadPies.jsx so the two boards speak one chart language: same geometry,
// same .lp- classes from leadflow.css, same hover, same click-a-slice-to-filter. What differs is where
// the slices come from — SalesRecordsPopup hands each breakdown the options of one of its own filter
// dropdowns, so the chart and the list cannot disagree about a count.
//
// It lives in its own file only to keep SalesRecordsPopup.jsx under the 500-line limit; nothing else
// imports it.

const SLICE_COLORS = ['#3b6fd8', '#138a4f', '#6d4fd8', '#b7791f', '#0f8a8a', '#d0503f'];
const GREY = '#8a8f98';
const TAIL = '\u0001'; // the folded "Everything else" slice; not a value anything can be filtered by
const MAX_SLICES = 7;
const R = 62;
const WIDTH = 22;

const arc = (start, end) => {
  const point = (angle, radius) => [80 + radius * Math.sin(angle), 80 - radius * Math.cos(angle)];
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(start, R);
  const [x2, y2] = point(end, R);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
};

// Dropdown options → slices: drop the "All …" head and the empties, biggest first, and fold a long tail
// into one "Everything else" so a donut never turns into confetti. "Not recorded" always reads grey.
export const slicesFrom = (options, blankKey) => {
  const entries = options.slice(1).filter(([, , count]) => count > 0).sort((a, b) => b[2] - a[2]);
  const colour = (key, index) => (key === blankKey ? GREY : SLICE_COLORS[index % SLICE_COLORS.length]);
  if (entries.length <= MAX_SLICES) {
    return entries.map(([key, label, count], index) => ({ key, label, count, color: colour(key, index) }));
  }
  const head = entries.slice(0, MAX_SLICES - 1);
  const tail = entries.slice(MAX_SLICES - 1);
  return [
    ...head.map(([key, label, count], index) => ({ key, label, count, color: colour(key, index) })),
    {
      key: TAIL,
      label: `Everything else (${tail.length})`,
      count: tail.reduce((sum, [, , count]) => sum + count, 0),
      color: GREY,
      folded: tail.map(([, label]) => label).join(', ')
    }
  ];
};

export function Donut({ title, slices, total, focus, onPick }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? slices.find((slice) => slice.key === focus);
  let angle = 0;
  const ends = [];
  slices.reduce((sum, slice) => {
    ends.push(((sum + slice.count) / total) * Math.PI * 2);
    return sum + slice.count;
  }, 0);
  const share = (count) => Math.round((count / total) * 100);

  return (
    <figure className="lp-chart">
      <figcaption>{title}</figcaption>
      <div className="lp-body">
        <svg viewBox="0 0 160 160" role="img" aria-label={`${title}: ${slices.map((slice) => `${slice.label} ${slice.count}`).join(', ')}`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line-soft)" strokeWidth={WIDTH} />
          {slices.map((slice) => {
            const sweep = (slice.count / total) * Math.PI * 2;
            const start = angle;
            angle += sweep;
            const whole = sweep >= Math.PI * 2 - 0.0001;
            const pickable = slice.key !== TAIL;
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
                onClick={pickable ? () => onPick(slice.key) : undefined}
                style={pickable ? undefined : { cursor: 'default' }}
              >
                <title>{`${slice.label}: ${slice.count} (${share(slice.count)}%)${slice.folded ? `\n${slice.folded}` : ''}`}</title>
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
          <text x="80" y="94" textAnchor="middle" className="lp-center-label">{shown ? shown.label : 'records'}</text>
        </svg>
        <ul className="lp-legend">
          {slices.map((slice) => (
            <li key={slice.key}>
              <button
                type="button"
                disabled={slice.key === TAIL}
                title={slice.folded || undefined}
                aria-pressed={slice.key === TAIL ? undefined : focus === slice.key}
                onClick={() => onPick(slice.key)}
                onMouseEnter={() => setHover(slice)}
                onMouseLeave={() => setHover(null)}
              >
                <i style={{ background: slice.color }} aria-hidden="true" />
                <span>{slice.label}</span>
                <b>{slice.count}</b>
                <em>{share(slice.count)}%</em>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
