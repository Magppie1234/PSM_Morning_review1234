import { SortTh, amountOf, useTableTools } from '../tableTools.jsx';

const RANK = { danger: 0, warning: 1, success: 2 };

// Any column can be sorted; until one is picked the table keeps its own "needs attention first" order.
const FIELDS = {
  owner: (row) => row.owner,
  deals: (row) => row.deals,
  architectDeals: (row) => row.architectDeals ?? 0,
  design: (row) => row.design ?? 0,
  approval: (row) => row.approval ?? 0,
  price: (row) => row.price ?? 0,
  won: (row) => row.won ?? 0,
  value: (row) => amountOf(row.value),
  overdue: (row) => row.overdue,
  status: (row) => RANK[row.tone] ?? 3
};

export function SalesTeamTable({ rows = [], onOwner, onDetail }) {
  const sorted = [...rows].sort(
    (a, b) => (RANK[a.tone] ?? 3) - (RANK[b.tone] ?? 3) || b.overdue - a.overdue || b.deals - a.deals
  );
  const tools = useTableTools(sorted, { fields: FIELDS });
  const select = (name) => {
    onOwner(name);
    onDetail(`${name}'s records are filtered below`);
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-head">
        <div>
          <h2>Sales closer performance</h2>
          <p>Sorted by who needs attention first</p>
        </div>
        <button type="button" className="ps-link" onClick={() => onOwner('All Sales Reps')}>View all</button>
      </header>
      <div className="ps-scroll">
        <table className="ps-table">
          <thead>
            <tr>
              <SortTh tools={tools} field="owner">Sales rep</SortTh>
              <SortTh tools={tools} field="deals" className="num">Deals</SortTh>
              <SortTh tools={tools} field="architectDeals" className="num">Architect</SortTh>
              <SortTh tools={tools} field="design" className="num">In design</SortTh>
              <SortTh tools={tools} field="approval" className="num">In approval</SortTh>
              <SortTh tools={tools} field="price" className="num">Price disc.</SortTh>
              <SortTh tools={tools} field="won" className="num">Won</SortTh>
              <SortTh tools={tools} field="value" className="num">Pipeline value</SortTh>
              <SortTh tools={tools} field="overdue" className="num">Overdue</SortTh>
              <SortTh tools={tools} field="status">Status</SortTh>
            </tr>
          </thead>
          <tbody>
            {tools.rows.map((row) => (
              <tr key={row.owner} onClick={() => select(row.owner)}>
                <th scope="row">
                  <button
                    type="button"
                    className="ps-name"
                    onClick={(event) => {
                      event.stopPropagation();
                      select(row.owner);
                    }}
                  >
                    {row.owner}
                  </button>
                </th>
                <td className="num">{row.deals}</td>
                <td className="num">{row.architectDeals ?? 0}</td>
                <td className="num">{row.design ?? 0}</td>
                <td className="num">{row.approval ?? 0}</td>
                <td className="num">{row.price ?? 0}</td>
                <td className="num">{row.won ?? 0}</td>
                <td className="num"><strong>{row.value}</strong></td>
                <td className={`num${row.overdue > 0 ? ' ps-danger-text' : ''}`}>{row.overdue}</td>
                <td>
                  <span className={`ps-status ${row.tone}`}>
                    <i aria-hidden="true" />
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
