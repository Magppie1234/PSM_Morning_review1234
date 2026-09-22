import { useState } from 'react';

// Status series, stacked bottom-up in this order so green never touches red (validated for colour-blind separation).
export const SERIES = [
  { key: 'done', label: 'Done', color: '#138a4f' },
  { key: 'upcoming', label: 'Upcoming', color: '#3b6fd8' },
  { key: 'missed', label: 'Missed', color: '#d0503f' }
];

export const statusOf = (row) => (row.stage === 'Done' ? 'done' : row.missed ? 'missed' : 'upcoming');

const DAY_MS = 86_400_000;
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// Opens the detail popup: a clicked coloured segment narrows the list to that status.
function select(onSelect, title, rows, event) {
  const status = event?.target?.dataset?.status;
  const series = SERIES.find((item) => item.key === status);
  onSelect?.({
    title: series ? `${title} · ${series.label}` : title,
    subtitle: series ? `${series.label} only` : 'all statuses',
    rows: series ? rows.filter((row) => statusOf(row) === status) : rows
  });
}

function countBy(rows) {
  const counts = { done: 0, upcoming: 0, missed: 0 };
  rows.forEach((row) => { counts[statusOf(row)] += 1; });
  return { ...counts, total: rows.length };
}

// Whole-number axis: a 1/2/5 step giving about four gridlines, and a max that is a multiple of it.
function axisTicks(value) {
  const rough = Math.max(1, value / 4);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
  const max = Math.max(step, Math.ceil(value / step) * step);
  return Array.from({ length: max / step + 1 }, (_, index) => index * step);
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="ams-tip" style={{ left: `${tip.x}%` }} role="status">
      <strong>{tip.title}</strong>
      {SERIES.map((series) => (
        <span key={series.key}><i style={{ background: series.color }} aria-hidden="true" />{series.label}<b>{tip.counts[series.key]}</b></span>
      ))}
      <span className="ams-tip-total">Total<b>{tip.counts.total}</b></span>
      <em className="ams-tip-hint">Click to see these services</em>
    </div>
  );
}

export function Legend() {
  return (
    <div className="ams-legend" aria-label="Legend">
      {SERIES.map((series) => (
        <span key={series.key}><i style={{ background: series.color }} aria-hidden="true" />{series.label}</span>
      ))}
    </div>
  );
}

export function DueByDay({ rows, start, end, onSelect }) {
  const [tip, setTip] = useState(null);
  const days = [];
  for (let time = Date.parse(`${start}T00:00:00Z`); time <= Date.parse(`${end}T00:00:00Z`); time += DAY_MS) {
    const iso = new Date(time).toISOString().slice(0, 10);
    const dayRows = rows.filter((row) => row.amsDate === iso);
    days.push({ iso, rows: dayRows, counts: countBy(dayRows) });
  }
  const ticks = axisTicks(Math.max(1, ...days.map((day) => day.counts.total)));
  const max = ticks.at(-1);

  return (
    <figure className="ams-chart" onMouseLeave={() => setTip(null)}>
      <figcaption className="ams-chart-title">AMS due by day</figcaption>
      <div className="ams-plot">
        <div className="ams-axis" aria-hidden="true">
          {[...ticks].reverse().map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <div className="ams-grid">
          {ticks.slice(1).map((tick) => <i key={tick} style={{ bottom: `${(tick / max) * 100}%` }} aria-hidden="true" />)}
          <div className="ams-columns">
            {days.map((day, index) => (
              <button
                type="button"
                className="ams-column"
                key={day.iso}
                aria-label={`${dayLabel(day.iso)}: ${day.counts.total} due, ${day.counts.done} done, ${day.counts.missed} missed, ${day.counts.upcoming} upcoming`}
                onMouseEnter={() => setTip({ x: ((index + 0.5) / days.length) * 100, title: dayLabel(day.iso), counts: day.counts })}
                onFocus={() => setTip({ x: ((index + 0.5) / days.length) * 100, title: dayLabel(day.iso), counts: day.counts })}
                onClick={(event) => day.counts.total && select(onSelect, `AMS due ${dayLabel(day.iso)}`, day.rows, event)}
                disabled={!day.counts.total}
              >
                <span className="ams-stack" style={{ height: `${(day.counts.total / max) * 100}%` }}>
                  {day.counts.total > 0 && <em className="ams-total">{day.counts.total}</em>}
                  {SERIES.map((series) => day.counts[series.key] > 0 && (
                    <i key={series.key} data-status={series.key} style={{ flexGrow: day.counts[series.key], background: series.color }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <Tooltip tip={tip} />
        </div>
      </div>
      <div className="ams-xlabels" aria-hidden="true">
        {days.map((day) => <span key={day.iso}>{dayLabel(day.iso).replace(/,?\s\w+$/, '')}</span>)}
      </div>
    </figure>
  );
}

export function DueByCity({ rows, limit = 7, onSelect }) {
  const [tip, setTip] = useState(null);
  const byCity = new Map();
  rows.forEach((row) => {
    const city = row.city ?? 'Not recorded';
    byCity.set(city, [...(byCity.get(city) ?? []), row]);
  });
  let cities = [...byCity].map(([name, list]) => ({ name, rows: list, counts: countBy(list) })).sort((a, b) => b.counts.total - a.counts.total);
  if (cities.length > limit) {
    const rest = cities.slice(limit - 1);
    const restRows = rest.flatMap((city) => city.rows);
    cities = [...cities.slice(0, limit - 1), { name: `Other (${rest.length} cities)`, rows: restRows, counts: countBy(restRows) }];
  }
  const max = Math.max(1, ...cities.map((city) => city.counts.total));

  return (
    <figure className="ams-chart" onMouseLeave={() => setTip(null)}>
      <figcaption className="ams-chart-title">Where it is due</figcaption>
      <div className="ams-hbars">
        {cities.map((city, index) => (
          <button
            type="button"
            className="ams-hbar"
            key={city.name}
            aria-label={`${city.name}: ${city.counts.total} due, ${city.counts.done} done, ${city.counts.missed} missed`}
            onMouseEnter={() => setTip({ x: 50, y: index, title: city.name, counts: city.counts })}
            onFocus={() => setTip({ x: 50, y: index, title: city.name, counts: city.counts })}
            onClick={(event) => select(onSelect, `AMS due in ${city.name}`, city.rows, event)}
          >
            <span className="ams-hbar-label">{city.name}</span>
            <span className="ams-hbar-track">
              <span className="ams-hbar-fill" style={{ width: `${(city.counts.total / max) * 100}%` }}>
                {SERIES.map((series) => city.counts[series.key] > 0 && (
                  <i key={series.key} data-status={series.key} style={{ flexGrow: city.counts[series.key], background: series.color }} />
                ))}
              </span>
              <em>{city.counts.total}</em>
            </span>
          </button>
        ))}
        {cities.length === 0 && <p className="ams-empty">No AMS due in this period.</p>}
      </div>
      {tip && (
        <div className="ams-tip ams-tip-side" style={{ top: `${tip.y * 34 + 40}px` }} role="status">
          <strong>{tip.title}</strong>
          {SERIES.map((series) => (
            <span key={series.key}><i style={{ background: series.color }} aria-hidden="true" />{series.label}<b>{tip.counts[series.key]}</b></span>
          ))}
          <em className="ams-tip-hint">Click to see these services</em>
        </div>
      )}
    </figure>
  );
}

export function DoneRate({ rows, onSelect }) {
  const counts = countBy(rows);
  const rate = counts.total ? Math.round((counts.done / counts.total) * 100) : null;
  return (
    <div className="ams-rate">
      <span>Completion rate</span>
      <strong className={rate === null ? 'na' : rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'}>{rate === null ? 'NA' : `${rate}%`}</strong>
      <em>{counts.done} of {counts.total} due services done</em>
      <div className="ams-rate-bar" aria-hidden="true">
        {SERIES.map((series) => counts[series.key] > 0 && <i key={series.key} style={{ flexGrow: counts[series.key], background: series.color }} />)}
      </div>
      <div className="ams-rate-split">
        {SERIES.map((series) => (
          <button
            type="button"
            key={series.key}
            disabled={!counts[series.key]}
            onClick={() => onSelect?.({ title: `${series.label} AMS services`, subtitle: 'in this period', rows: rows.filter((row) => statusOf(row) === series.key) })}
          >
            <i style={{ background: series.color }} aria-hidden="true" />{series.label} <b>{counts[series.key]}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
