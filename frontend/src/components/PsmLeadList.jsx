import { ArrivalTime, arrivalDate } from './leadArrival.jsx';

export function PsmLeadList({ psm, leads = [], deals = [], onClear, mode = 'pre-sales' }) {
  const isSales = mode === 'sales';
  const items = isSales ? deals : leads;
  const title = isSales ? `${psm}'s Active Deals` : `${psm}'s Leads`;
  const subtitle = isSales ? 'All live CRM opportunities and design projects' : "All live CRM leads in the selected period";
  const clearText = isSales ? 'Back to all Sales Reps' : 'Back to all PSMs';

  return (
    <section className="panel selected-leads">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" onClick={onClear}>{clearText}</button>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            {isSales ? (
              <tr>
                <th>Deal / Project</th>
                <th>Stage</th>
                <th>Product</th>
                <th>Architect</th>
                <th>Follow-up</th>
                <th>Pipeline Value</th>
              </tr>
            ) : (
              <tr>
                <th>Lead</th>
                <th>Came on</th>
                <th>Time</th>
                <th>City</th>
                <th>Status</th>
                <th>Product</th>
                <th>Architect / Source</th>
                <th>Follow-up</th>
                <th>Value</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <strong>{item.name}</strong>
                    <span>{item.id}</span>
                  </th>
                  {isSales ? (
                    <>
                      <td><span className="priority medium">{item.stage}</span></td>
                      <td>{item.product}</td>
                      <td>{item.architect ?? '—'}</td>
                      <td>{item.followUp}</td>
                      <td><strong>{item.value}</strong></td>
                    </>
                  ) : (
                    <>
                      <td>{arrivalDate(item.created)}</td>
                      <td><ArrivalTime lead={item} /></td>
                      <td>{item.city}</td>
                      <td>{item.status}</td>
                      <td>{item.product}</td>
                      <td>{item.architect ?? item.source}</td>
                      <td>{item.followUp}</td>
                      <td><strong>{item.value}</strong></td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-leads" colSpan={isSales ? 6 : 9}>
                  No {isSales ? 'deals' : 'leads'} found for {psm}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

