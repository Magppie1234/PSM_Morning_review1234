import { ArrivalTime, arrivalDate } from './leadArrival.jsx';
import { SortSelect, SortTh, TableSearch, amountOf, timeOf, useTableTools } from './tableTools.jsx';

// Every column can be sorted; the search box matches any of the text on the row.
const leadFields = {
  name: (item) => item.name,
  created: (item) => timeOf(item.created),
  time: (item) => timeOf(item.created),
  city: (item) => item.city,
  status: (item) => item.status,
  product: (item) => item.product,
  architect: (item) => item.architect ?? item.source,
  followUp: (item) => item.followUp,
  value: (item) => amountOf(item.value)
};
const dealFields = {
  name: (item) => item.name,
  stage: (item) => item.stage,
  product: (item) => item.product,
  architect: (item) => item.architect,
  followUp: (item) => item.followUp,
  value: (item) => amountOf(item.value)
};
// Column names for the phone's sort menu, where the headings are hidden.
const LEAD_SORT = [
  ['name', 'Lead'], ['created', 'Came on'], ['city', 'City'], ['status', 'Status'],
  ['product', 'Product'], ['architect', 'Architect / Source'], ['followUp', 'Follow-up'], ['value', 'Value']
];
const DEAL_SORT = [
  ['name', 'Deal / Project'], ['stage', 'Stage'], ['product', 'Product'],
  ['architect', 'Architect'], ['followUp', 'Follow-up'], ['value', 'Pipeline value']
];
const searchText = (item) =>
  [item.name, item.id, item.city, item.status, item.stage, item.product, item.architect, item.source, item.followUp, item.value]
    .filter(Boolean)
    .join(' ');

export function PsmLeadList({ psm, leads = [], deals = [], onClear, mode = 'pre-sales' }) {
  const isSales = mode === 'sales';
  const items = isSales ? deals : leads;
  const title = isSales ? `${psm}'s Active Deals` : `${psm}'s Leads`;
  const subtitle = isSales ? 'All live CRM opportunities and design projects' : "All live CRM leads in the selected period";
  const clearText = isSales ? 'Back to all Sales Reps' : 'Back to all PSMs';
  const tools = useTableTools(items, { fields: isSales ? dealFields : leadFields, search: searchText });

  return (
    <section className="panel selected-leads">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="tt-bar">
          <TableSearch
            tools={tools}
            label={`Search ${psm}'s ${isSales ? 'deals' : 'leads'}`}
            placeholder={isSales ? 'Search deals…' : 'Search name, city, status…'}
          />
          <SortSelect tools={tools} options={isSales ? DEAL_SORT : LEAD_SORT} />
          <button type="button" onClick={onClear}>{clearText}</button>
        </div>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            {isSales ? (
              <tr>
                <SortTh tools={tools} field="name">Deal / Project</SortTh>
                <SortTh tools={tools} field="stage">Stage</SortTh>
                <SortTh tools={tools} field="product">Product</SortTh>
                <SortTh tools={tools} field="architect">Architect</SortTh>
                <SortTh tools={tools} field="followUp">Follow-up</SortTh>
                <SortTh tools={tools} field="value">Pipeline Value</SortTh>
              </tr>
            ) : (
              <tr>
                <SortTh tools={tools} field="name">Lead</SortTh>
                <SortTh tools={tools} field="created">Came on</SortTh>
                <SortTh tools={tools} field="time">Time</SortTh>
                <SortTh tools={tools} field="city">City</SortTh>
                <SortTh tools={tools} field="status">Status</SortTh>
                <SortTh tools={tools} field="product">Product</SortTh>
                <SortTh tools={tools} field="architect">Architect / Source</SortTh>
                <SortTh tools={tools} field="followUp">Follow-up</SortTh>
                <SortTh tools={tools} field="value">Value</SortTh>
              </tr>
            )}
          </thead>
          <tbody>
            {tools.rows.length ? (
              tools.rows.map((item) => (
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
                  {tools.total
                    ? `No ${isSales ? 'deals' : 'leads'} match “${tools.query.trim()}”.`
                    : `No ${isSales ? 'deals' : 'leads'} found for ${psm}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
