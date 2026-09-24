import { SortSelect, SortTh, amountOf, useTableTools } from '../tableTools.jsx';

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
// Column names shown beside each value when the table turns into cards on phones.
const LABELS = { leads: 'Leads', inHours: 'Arrived 9:30–6:30', afterHours: 'Arrived after hours', architectLeads: 'Architect', clientReach: 'Client reach', missed: 'Missed' };

function Num({ row, field, className = '', title }) {
  const value = row[field] ?? 0;
  if (value !== 0) return <td className={`num ${className}`.trim()} title={title} data-label={LABELS[field]}>{value}</td>;
  return (
    <td className="num" data-label={LABELS[field]}>
      <span className="ps-zero" title={zeroReason(field, row)} tabIndex={0} aria-label={`0. ${zeroReason(field, row)}`}>0</span>
    </td>
  );
}

// Any column can be sorted; until one is picked the table keeps its own "needs attention first" order.
const FIELDS = {
  psm: (row) => row.psm,
  leads: (row) => row.leads,
  inHours: (row) => row.inHours,
  afterHours: (row) => row.afterHours,
  contacted: (row) => row.contacted,
  qualified: (row) => row.qualified,
  architectLeads: (row) => row.architectLeads,
  clientReach: (row) => row.clientReach,
  value: (row) => amountOf(row.value),
  missed: (row) => row.missed,
  status: (row) => RANK[row.tone] ?? 3
};
// Column names for the phone's sort menu, where the headings are hidden.
const SORT_OPTIONS = [
  ['psm', 'PSM'], ['leads', 'Leads'], ['inHours', 'Arrived 9:30–6:30'], ['afterHours', 'Arrived after hours'],
  ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['architectLeads', 'Architect'],
  ['clientReach', 'Client reach'], ['value', 'Value'], ['missed', 'Missed'], ['status', 'Status']
];

export function TeamTable({ rows = [], onPsm, onDetail }) {
  const sorted = [...rows].sort(
    (a, b) => (RANK[a.tone] ?? 3) - (RANK[b.tone] ?? 3) || b.missed - a.missed || b.leads - a.leads
  );
  const tools = useTableTools(sorted, { fields: FIELDS });
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
        <div className="tt-bar">
          <SortSelect tools={tools} options={SORT_OPTIONS} />
          <button type="button" className="ps-link" onClick={() => onPsm('All PSM')}>View all</button>
        </div>
      </header>
      <div className="ps-scroll">
        <table className="ps-table ps-team-table">
          <thead>
            <tr>
              <SortTh tools={tools} field="psm" rowSpan={2}>PSM</SortTh>
              <SortTh tools={tools} field="leads" rowSpan={2} className="num">Leads</SortTh>
              <th scope="colgroup" colSpan={2} className="ps-th-group" title="When the lead was created in Zoho (IST). Office hours are 9:30 am – 6:30 pm.">Lead arrival</th>
              <SortTh tools={tools} field="contacted" rowSpan={2}>Contacted</SortTh>
              <SortTh tools={tools} field="qualified" rowSpan={2}>Qualified</SortTh>
              <SortTh tools={tools} field="architectLeads" rowSpan={2} className="num">Architect</SortTh>
              <SortTh tools={tools} field="clientReach" rowSpan={2} className="num" title={CLIENT_REACH_HINT}>Client reach</SortTh>
              <SortTh tools={tools} field="value" rowSpan={2} className="num">Value</SortTh>
              <SortTh tools={tools} field="missed" rowSpan={2} className="num">Missed</SortTh>
              <SortTh tools={tools} field="status" rowSpan={2}>Status</SortTh>
            </tr>
            <tr>
              <SortTh tools={tools} field="inHours" className="num ps-th-sub">9:30–6:30</SortTh>
              <SortTh tools={tools} field="afterHours" className="num ps-th-sub" title="Created after 6:30 pm or before 9:30 am">After hours</SortTh>
            </tr>
          </thead>
          <tbody>
            {tools.rows.map((row) => (
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
                <td data-label="Contacted"><Rate value={row.contacted} base={row.leads} of="leads" reason={zeroReason('contacted', row)} /></td>
                <td data-label="Qualified"><Rate value={row.qualified} base={row.contacted} of="contacted" reason={zeroReason('qualified', row)} /></td>
                <Num row={row} field="architectLeads" />
                <Num row={row} field="clientReach" title={`${row.clientReach} of ${row.leads} leads came to us first`} />
                <td className="num" title={row.zeroReason} data-label="Value"><strong>{row.value}</strong></td>
                <Num row={row} field="missed" className="ps-danger-text" />
                <td className="ps-td-status" data-label="Status">
                  <span className={`ps-status ${row.tone}`} title={row.zeroReason}>
                    <i aria-hidden="true" />
                    {row.status}
                  </span>
                </td>
                {/* Phones have no hover, so the card spells out why a PSM has no leads. */}
                {row.zeroReason && <td className="ps-zero-note">{row.zeroReason}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
