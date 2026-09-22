const shortDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : iso);
const TONE = { danger: 'danger', warning: 'warning', blue: 'info', success: 'success' };

export function MaterialTat({ tat }) {
  const { summary, records } = tat;
  return (
    <>
      <section className="fs-stats" aria-label="Material turnaround summary">
        <div className="fs-stat"><span>Tracked requisitions</span><strong>{summary.totalTracked}</strong></div>
        <div className="fs-stat"><span>Average turnaround</span><strong>{summary.avgTat} d</strong></div>
        <div className="fs-stat"><span>Longest</span><strong>{summary.maxTat} d</strong></div>
        <div className="fs-stat"><span>Over 90 days</span><strong className="ps-danger-text">{summary.slabs[0]?.count ?? 0}</strong></div>
      </section>

      <div className="fs-slabs">
        {summary.slabs.map((slab) => (
          <span className={`ps-status ${TONE[slab.tone] ?? ''}`} key={slab.label}>
            <i aria-hidden="true" />
            {slab.label}: {slab.count} ({slab.percentage}%)
          </span>
        ))}
      </div>

      <section className="ps-panel">
        <header className="ps-panel-head">
          <div>
            <h2>Slowest material receipts</h2>
            <p>CHI trustee requisitions received in this period, longest first</p>
          </div>
        </header>
        <div className="ps-scroll">
          <table className="ps-table">
            <thead>
              <tr>
                <th scope="col">Trustee / project</th>
                <th scope="col">Raised</th>
                <th scope="col">Received</th>
                <th scope="col" className="num">Days</th>
                <th scope="col">Band</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr className="fs-static-row"><td colSpan={5} className="ps-empty fs-empty-cell">No material receipts recorded in this period.</td></tr>
              )}
              {records.map((record) => (
                <tr key={record.id} className="fs-static-row">
                  <th scope="row">{record.trustee}</th>
                  <td>{shortDate(record.raisedDate)}</td>
                  <td>{shortDate(record.receivedDate)}</td>
                  <td className={`num${record.materialTatDays >= 90 ? ' ps-danger-text' : ''}`}>{record.materialTatDays}</td>
                  <td><span className={`ps-status ${TONE[record.slabTone] ?? ''}`}><i aria-hidden="true" />{record.slab}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
