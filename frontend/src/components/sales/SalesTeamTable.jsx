const RANK = { danger: 0, warning: 1, success: 2 };

export function SalesTeamTable({ rows = [], onOwner, onDetail }) {
  const sorted = [...rows].sort(
    (a, b) => (RANK[a.tone] ?? 3) - (RANK[b.tone] ?? 3) || b.overdue - a.overdue || b.deals - a.deals
  );
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
              <th scope="col">Sales rep</th>
              <th scope="col" className="num">Deals</th>
              <th scope="col" className="num">Architect</th>
              <th scope="col" className="num">In design</th>
              <th scope="col" className="num">In approval</th>
              <th scope="col" className="num">Price disc.</th>
              <th scope="col" className="num">Won</th>
              <th scope="col" className="num">Pipeline value</th>
              <th scope="col" className="num">Overdue</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
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
