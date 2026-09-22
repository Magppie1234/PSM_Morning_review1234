import { PackageX } from 'lucide-react';
import { Chips, NA, show, showDate } from './shared.jsx';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (value) => (value === null || value === undefined ? NA : `₹${inr.format(value)}`);
const costBreakdown = (item) => `Item cost ${item.itemCost === null ? 'NA' : `₹${inr.format(item.itemCost)}`} + handling charge ${item.handlingCharge === null ? 'NA' : `₹${inr.format(item.handlingCharge)}`}`;

export function MissingItems({ missing, recordedEver }) {
  return (
    <section className="ps-panel" aria-labelledby="in-missing-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="in-missing-title"><PackageX size={15} aria-hidden="true" /> Missing and damaged items</h2>
          <p>Items reported against complaints, with the department responsible</p>
        </div>
      </header>

      <div className="in-summary-row">
        <span>By department: <Chips items={missing.byDepartment} empty={NA} /></span>
        <span>Extra cost incurred by mishandling: <strong>{rupees(missing.extraCostTotal)}</strong></span>
        <span>Installation complaints in this period: <strong>{missing.complaints.total}</strong> <Chips items={missing.complaints.byStage} empty="" /></span>
      </div>

      <div className="ps-scroll">
        <table className="ps-table in-table">
          <thead>
            <tr>
              <th scope="col">Reported</th>
              <th scope="col">Client</th>
              <th scope="col">Item issue</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col">Size</th>
              <th scope="col">MRP no.</th>
              <th scope="col">Department</th>
              <th scope="col">Case</th>
              <th scope="col">Factory remark</th>
              <th scope="col" className="num">Extra cost incurred by mishandling</th>
              <th scope="col">Complaint stage</th>
              <th scope="col">Raised by</th>
            </tr>
          </thead>
          <tbody>
            {missing.items.length === 0 && (
              <tr className="in-static">
                <td colSpan={12} className="in-empty">
                  {recordedEver ? 'No missing items reported in this period.' : 'NA · Missing items are not being recorded in Zoho yet.'}
                </td>
              </tr>
            )}
            {missing.items.map((item) => (
              <tr key={item.id} className="in-static">
                <td>{showDate(item.reportedOn)}</td>
                <td>{show(item.client)}</td>
                <td className="in-wrap">{show(item.issue)}</td>
                <td className="num">{show(item.qty)}</td>
                <td>{show(item.size)}</td>
                <td>{show(item.mrp)}</td>
                <td>{show(item.department)}</td>
                <td>{show(item.caseType)}</td>
                <td className="in-wrap">{show(item.factoryRemark)}</td>
                <td className="num" title={costBreakdown(item)}>{rupees(item.extraCost)}</td>
                <td>{show(item.complaintStage)}</td>
                <td>{show(item.raisedBy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
