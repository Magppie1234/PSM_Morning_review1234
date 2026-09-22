import { UsersRound } from 'lucide-react';
import { Chips, NA, show, showDate } from '../installation/shared.jsx';

const titleCase = (name) => name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AmsVisits({ visits }) {
  return (
    <section className="ps-panel" aria-labelledby="ams-visits-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="ams-visits-title"><UsersRound size={15} aria-hidden="true" /> Service visits by team</h2>
          <p>AMS visits scheduled, made or completed in this period</p>
        </div>
      </header>

      <div className="in-summary-row">
        <span>Products inspected: <Chips items={visits.productsInspected} empty={NA} /></span>
      </div>

      <div className="ps-scroll">
        <table className="ps-table in-table ams-stack-table">
          <thead>
            <tr>
              <th scope="col">Team member</th>
              <th scope="col" className="num">Visits</th>
              <th scope="col" className="num">Done</th>
              <th scope="col" className="num">Follow-ups</th>
              <th scope="col" className="num">Products</th>
              <th scope="col" className="num">Client paid</th>
              <th scope="col" className="num">Company paid</th>
              <th scope="col" className="num">Unpaid</th>
            </tr>
          </thead>
          <tbody>
            {visits.byMember.length === 0 && (
              <tr className="in-static"><td colSpan={8} className="in-empty">NA · No AMS visits in this period.</td></tr>
            )}
            {visits.byMember.map((row) => (
              <tr key={row.name} className="in-static">
                <th scope="row" data-label="Team member">{titleCase(row.name)}</th>
                <td data-label="Visits" className="num">{row.visits}</td>
                <td data-label="Done" className="num">{row.done}</td>
                <td data-label="Follow-ups" className="num">{row.followUps}</td>
                <td data-label="Products" className="num">{show(row.products)}</td>
                <td data-label="Client paid" className="num">{show(row.clientPaid)}</td>
                <td data-label="Company paid" className="num">{show(row.companyPaid)}</td>
                <td data-label="Unpaid" className="num">{show(row.unpaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visits.rows.length > 0 && (
        <div className="ps-scroll in-sub">
          <table className="ps-table in-table ams-stack-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">City</th>
                <th scope="col">Purpose</th>
                <th scope="col">Quarter</th>
                <th scope="col">Scheduled</th>
                <th scope="col">Visited</th>
                <th scope="col">Done</th>
                <th scope="col">Team</th>
                <th scope="col">Products</th>
                <th scope="col">Payment</th>
              </tr>
            </thead>
            <tbody>
              {visits.rows.map((visit) => (
                <tr key={visit.id} className="in-static">
                  <th scope="row" data-label="Client" className="in-wrap">{show(visit.client)}</th>
                  <td data-label="City">{show(visit.city)}</td>
                  <td data-label="Purpose">{show(visit.purpose)}</td>
                  <td data-label="Quarter">{show(visit.quarter)}</td>
                  <td data-label="Scheduled">{showDate(visit.scheduledOn)}</td>
                  <td data-label="Visited">{showDate(visit.visitedOn)}</td>
                  <td data-label="Done">{showDate(visit.doneOn)}</td>
                  <td data-label="Team" className="in-wrap">{visit.team.length ? visit.team.map(titleCase).join(', ') : NA}</td>
                  <td data-label="Products">{visit.products.length ? visit.products.join(', ') : NA}</td>
                  <td data-label="Payment">{show(visit.payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
