import { useEffect, useRef, useState } from 'react';

export function TrendChart({ rows, format, label }) {
  const container = useRef(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const height = 230;
  const left = 66;
  const right = width - 18;
  const top = 30;
  const bottom = height - 38;
  const valid = rows.filter((r) => Number.isFinite(r.value));
  const max = Math.max(...valid.map((r) => r.value), 1);
  const x = (index) => left + index / Math.max(1, rows.length - 1) * (right - left);
  const y = (value) => bottom - value / max * (bottom - top);
  let drawing = false;
  const path = rows.map((r, i) => {
    if (!Number.isFinite(r.value)) { drawing = false; return ''; }
    const point = `${drawing ? 'L' : 'M'}${x(i)},${y(r.value)}`;
    drawing = true;
    return point;
  }).join(' ');
  const step = Math.max(1, Math.ceil((rows.length - 1) / 3));
  return <div ref={container} className="em-trend">
    {!valid.length ? <p>No recorded values to chart.</p> : <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} by month. ${valid.map((r) => `${r.name}: ${format(r.value)}`).join('; ')}`}>
      <text x={left} y="15" className="em-trend-label">{label}</text>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={right} y1={y(max * fraction)} y2={y(max * fraction)} className="em-trend-grid" /><text x={left - 8} y={y(max * fraction) + 4} textAnchor="end" className="em-trend-label">{format(max * fraction)}</text></g>)}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {rows.map((r, i) => <g key={r.key}>
        {Number.isFinite(r.value) && <circle cx={x(i)} cy={y(r.value)} r="3" fill="var(--accent)"><title>{r.name}: {format(r.value)}</title></circle>}
        {(i % step === 0 || i === rows.length - 1) && <text x={x(i)} y={bottom + 22} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} className="em-trend-label">{r.name}</text>}
      </g>)}
    </svg>}
  </div>;
}
