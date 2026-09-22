import { BarChart3, CalendarClock, Table2 } from 'lucide-react';
import { useState } from 'react';
import { show, showDate } from '../installation/shared.jsx';
import { DoneRate, DueByCity, DueByDay, Legend } from './AmsCharts.jsx';
import { AmsDetailModal } from './AmsDetailModal.jsx';

const PAGE = 25;
const ALL = '';
const NOT_RECORDED = '__none__';

// Options with counts, built from the rows so every value (not only the top few) can be picked.
function optionsFor(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[key] ?? NOT_RECORDED;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function Filter({ label, allLabel, value, onChange, options }) {
  return (
    <label className="ps-select ams-filter">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={!options.length}>
        <option value={ALL}>{allLabel}</option>
        {options.map(([option, count]) => (
          <option key={option} value={option}>{option === NOT_RECORDED ? 'Not recorded' : option} ({count})</option>
        ))}
      </select>
    </label>
  );
}

export function AmsSchedule({ schedule, start, end }) {
  const [view, setView] = useState('charts');
  const [detail, setDetail] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [stage, setStage] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [reason, setReason] = useState(ALL);

  const matches = (row, key, value) => value === ALL || (row[key] ?? NOT_RECORDED) === value;
  const rows = schedule.rows.filter((row) => matches(row, 'stage', stage) && matches(row, 'city', city) && matches(row, 'remarks', reason));
  const filtered = stage !== ALL || city !== ALL || reason !== ALL;
  const update = (setter) => (value) => {
    setter(value);
    setShown(PAGE);
  };

  return (
    <section className="ps-panel" aria-labelledby="ams-schedule-title">
      <header className="ps-panel-head ams-head">
        <div>
          <h2 id="ams-schedule-title"><CalendarClock size={15} aria-hidden="true" /> AMS due in this period</h2>
          <p>
            {filtered ? `Showing ${rows.length} of ${schedule.rows.length} services` : 'Every service whose AMS date falls in the period, and whether it was done'}
          </p>
        </div>
        <div className="ams-filters">
          <Filter label="Stage" allLabel="All stages" value={stage} onChange={update(setStage)} options={optionsFor(schedule.rows, 'stage')} />
          <Filter label="City" allLabel="All cities" value={city} onChange={update(setCity)} options={optionsFor(schedule.rows, 'city')} />
          <Filter label="Reason not done" allLabel="All reasons" value={reason} onChange={update(setReason)} options={optionsFor(schedule.rows, 'remarks')} />
          <div className="fs-switch" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'charts'} onClick={() => setView('charts')}><BarChart3 size={13} aria-hidden="true" /> Charts</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={13} aria-hidden="true" /> Table</button>
          </div>
          {filtered && (
            <button type="button" className="ps-link" onClick={() => { setStage(ALL); setCity(ALL); setReason(ALL); setShown(PAGE); }}>
              Clear
            </button>
          )}
        </div>
      </header>

      {view === 'charts' ? (
        <div className="ams-charts">
          <Legend />
          <div className="ams-chart-grid">
            <DoneRate rows={rows} onSelect={setDetail} />
            <DueByDay rows={rows} start={start} end={end} onSelect={setDetail} />
            <DueByCity rows={rows} onSelect={setDetail} />
          </div>
        </div>
      ) : (
        <>
          <div className="ps-scroll">
            <table className="ps-table in-table ams-stack-table">
              <thead>
                <tr>
                  <th scope="col">AMS date</th>
                  <th scope="col">Client</th>
                  <th scope="col">City</th>
                  <th scope="col">Order</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Reason not done</th>
                  <th scope="col">Completed on</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className="in-static">
                    <td colSpan={7} className="in-empty">{filtered ? 'No services match these filters.' : 'NA · No AMS due in this period.'}</td>
                  </tr>
                )}
                {rows.slice(0, shown).map((row) => (
                  <tr key={row.id} className="in-static">
                    <td data-label="AMS date">{showDate(row.amsDate)}</td>
                    <th scope="row" data-label="Client" className="in-wrap">{show(row.client)}</th>
                    <td data-label="City">{show(row.city)}</td>
                    <td data-label="Order" className="in-wrap" title={row.order ?? undefined}><span className="in-clamp">{show(row.order)}</span></td>
                    <td data-label="Stage">
                      <span className={`ps-status ${row.stage === 'Done' ? 'success' : row.missed ? 'danger' : 'warning'}`}>
                        <i aria-hidden="true" />
                        {row.stage === 'Done' ? 'Done' : row.missed ? 'Missed' : show(row.stage)}
                      </span>
                    </td>
                    <td data-label="Reason not done" className="in-wrap">{show(row.remarks)}</td>
                    <td data-label="Completed on">{showDate(row.completedOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown && (
            <button type="button" className="dp-more" onClick={() => setShown((count) => count + PAGE)}>
              Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
            </button>
          )}
        </>
      )}
      {detail && <AmsDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </section>
  );
}
