import { CalendarCheck } from 'lucide-react';
import { Chips, isEmpty, NA, show, showDate } from './shared.jsx';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const sqFt = (row) => (row.sqFtInstalled === null && row.targetSqFt === null ? NA : `${row.sqFtInstalled ?? 'NA'} / ${row.targetSqFt ?? 'NA'}`);

export function InstallationVisits({ visits }) {
  return (
    <section className="ps-panel" aria-labelledby="in-visits-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="in-visits-title"><CalendarCheck size={15} aria-hidden="true" /> Installation visits</h2>
          <p>Visits dated in this period, by installation manager</p>
        </div>
      </header>

      <div className="in-summary-row">
        <span>Tasks: <Chips items={visits.tasks} empty={NA} /></span>
      </div>

      <div className="ps-scroll">
        <table className="ps-table in-table">
          <thead>
            <tr>
              <th scope="col">Installation manager</th>
              <th scope="col" className="num">Planned</th>
              <th scope="col" className="num">Done</th>
              <th scope="col" className="num">Not closed</th>
              <th scope="col" className="num">Mandays</th>
              <th scope="col" className="num">Team members</th>
              <th scope="col">Main task</th>
              <th scope="col">Sq ft installed / target</th>
              <th scope="col" className="num">Hours lost</th>
              <th scope="col" className="num">Labour cost</th>
            </tr>
          </thead>
          <tbody>
            {visits.byManager.length === 0 && (
              <tr className="in-static"><td colSpan={10} className="in-empty">NA · No installation visits recorded in this period.</td></tr>
            )}
            {visits.byManager.map((row) => (
              <tr key={row.name} className="in-static">
                <th scope="row">{row.name}</th>
                <td className="num">{row.planned}</td>
                <td className="num">{row.done}</td>
                <td className={`num${row.overdueOpen ? ' ps-danger-text' : ''}`}>{row.overdueOpen}</td>
                <td className="num">{row.mandays}</td>
                <td className="num">{row.teamMembers}</td>
                <td>{show(row.topTask)}</td>
                <td>{sqFt(row)}</td>
                <td className="num">{show(row.hoursLost)}</td>
                <td className="num">{isEmpty(row.labourCost) ? NA : `₹${inr.format(row.labourCost)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visits.list.length > 0 && (
        <div className="ps-scroll in-sub">
          <table className="ps-table in-table">
            <thead>
              <tr>
                <th scope="col">Visit date</th>
                <th scope="col">Client</th>
                <th scope="col">City</th>
                <th scope="col">Task</th>
                <th scope="col">Manager</th>
                <th scope="col">Team</th>
                <th scope="col">Stage</th>
                <th scope="col">Done on</th>
              </tr>
            </thead>
            <tbody>
              {visits.list.map((visit) => (
                <tr key={visit.id} className="in-static">
                  <td>{showDate(visit.date)}</td>
                  <td className="in-wrap">{show(visit.client)}</td>
                  <td>{show(visit.city)}</td>
                  <td>{show(visit.task)}</td>
                  <td>{show(visit.manager)}</td>
                  <td className="in-wrap">{visit.team.length ? visit.team.join(', ') : NA}</td>
                  <td><span className={`ps-status ${visit.stage === 'Done' ? 'success' : 'warning'}`}><i aria-hidden="true" />{show(visit.stage)}</span></td>
                  <td>{showDate(visit.doneOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
