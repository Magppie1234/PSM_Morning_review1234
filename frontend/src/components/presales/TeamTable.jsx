const RANK = { danger: 0, warning: 1, success: 2, neutral: 3 };
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Below this many leads a percentage says more about luck than performance, so it is greyed out.
const MIN_BASE = 5;

function Rate({ value, base, of, reason }) {
  const percent = pct(value, base);
  const thin = base < MIN_BASE;
  const title = value === 0 && reason ? reason : thin ? `Only ${base} ${of}; too few for a reliable rate` : `${value} of ${base} ${of}`;
  return (
    <span className="ps-rate" title={title}>
      <span className={`ps-rate-num${value === 0 && reason ? ' ps-zero' : ''}`}>{value}</span>
      <span className={`ps-rate-pct${thin ? ' thin' : ''}`}>{base ? `${percent}% of ${of}` : '—'}</span>
    </span>
  );
}

// Client reach counts leads the client started: website, WhatsApp, Instagram or chat, IVR calls, walk-ins,
// QR scans and repeat clients. Ads, data lists, referrals and exhibitions are not counted.
const CLIENT_REACH_HINT = 'Leads where the client reached out first: website, WhatsApp, Instagram / chat, IVR call, walk-in, QR scan or repeat client';

// Why a cell is zero. A PSM with no leads carries the API's reason; otherwise each column explains itself.
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
function zeroReason(key, row) {
  if (row.zeroReason) return row.zeroReason;
  const leads = plural(row.leads, 'lead');
  return {
    inHours: `All ${leads} arrived outside office hours (after 6:30 pm or before 9:30 am).`,
    afterHours: `All ${leads} arrived during office hours (9:30 am – 6:30 pm).`,
    contacted: `None of the ${leads} has a first contact recorded in Zoho yet.`,
    qualified: row.contacted ? `None of the ${plural(row.contacted, 'contacted lead')} is qualified yet.` : 'No lead has been contacted yet, so none can be qualified.',
    architectLeads: `None of the ${leads} came through an architect or designer.`,
    clientReach: `None of the ${leads} came from the client first; they came from ads or other sources.`,
    missed: `Every one of the ${leads} has had a first contact.`
  }[key];
}

// A number cell whose zero shows its reason on hover (and on keyboard focus).
function Num({ row, field, className = '', title }) {
  const value = row[field] ?? 0;
  if (value !== 0) return <td className={`num ${className}`.trim()} title={title}>{value}</td>;
  return (
    <td className="num">
      <span className="ps-zero" title={zeroReason(field, row)} tabIndex={0} aria-label={`0. ${zeroReason(field, row)}`}>0</span>
    </td>
  );
}

export function TeamTable({ rows = [], onPsm, onDetail }) {
  const sorted = [...rows].sort(
    (a, b) => (RANK[a.tone] ?? 3) - (RANK[b.tone] ?? 3) || b.missed - a.missed || b.leads - a.leads
  );
  const select = (name) => {
    onPsm(name);
    onDetail(`${name}'s records are filtered below`);
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-head">
        <div>
          <h2>PSM performance</h2>
          <p>Sorted by who needs attention first</p>
        </div>
        <button type="button" className="ps-link" onClick={() => onPsm('All PSM')}>View all</button>
      </header>
      <div className="ps-scroll">
        <table className="ps-table">
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>PSM</th>
              <th scope="col" rowSpan={2} className="num">Leads</th>
              <th scope="colgroup" colSpan={2} className="ps-th-group" title="When the lead was created in Zoho (IST). Office hours are 9:30 am – 6:30 pm.">Lead arrival</th>
              <th scope="col" rowSpan={2}>Contacted</th>
              <th scope="col" rowSpan={2}>Qualified</th>
              <th scope="col" rowSpan={2} className="num">Architect</th>
              <th scope="col" rowSpan={2} className="num" title={CLIENT_REACH_HINT}>Client reach</th>
              <th scope="col" rowSpan={2} className="num">Value</th>
              <th scope="col" rowSpan={2} className="num">Missed</th>
              <th scope="col" rowSpan={2}>Status</th>
            </tr>
            <tr>
              <th scope="col" className="num ps-th-sub">9:30–6:30</th>
              <th scope="col" className="num ps-th-sub" title="Created after 6:30 pm or before 9:30 am">After hours</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.psm} onClick={() => select(row.psm)}>
                <th scope="row">
                  <button
                    type="button"
                    className="ps-name"
                    onClick={(event) => {
                      event.stopPropagation();
                      select(row.psm);
                    }}
                  >
                    {row.psm}
                  </button>
                </th>
                <Num row={row} field="leads" />
                <Num row={row} field="inHours" />
                <Num row={row} field="afterHours" className="ps-warn-text" title={`${row.afterHours} of ${row.leads} leads arrived after 6:30 pm or before 9:30 am`} />
                <td><Rate value={row.contacted} base={row.leads} of="leads" reason={zeroReason('contacted', row)} /></td>
                <td><Rate value={row.qualified} base={row.contacted} of="contacted" reason={zeroReason('qualified', row)} /></td>
                <Num row={row} field="architectLeads" />
                <Num row={row} field="clientReach" title={`${row.clientReach} of ${row.leads} leads came to us first`} />
                <td className="num" title={row.zeroReason}><strong>{row.value}</strong></td>
                <Num row={row} field="missed" className="ps-danger-text" />
                <td>
                  <span className={`ps-status ${row.tone}`} title={row.zeroReason}>
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
