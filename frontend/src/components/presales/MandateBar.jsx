// Progress line: ₹ value of qualified opportunities (Zoho Contacts) against the PSMs' approved monthly
// targets, with each PSM's progress beside it. All figures come from the API.
const CRORE = 1e7;
const LAKH = 1e5;

const trim = (value, digits) => Number(value.toFixed(digits)).toLocaleString('en-IN');
export const inr = (value) => {
  if (value >= CRORE) return `₹${trim(value / CRORE, value >= 10 * CRORE ? 1 : 2)} Cr`;
  if (value >= LAKH) return `₹${trim(value / LAKH, 1)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// `whole` is true when the period's target is the full month (or quarter) target itself.
function PsmBars({ rows, whole }) {
  return (
    <ul className="mb-psms" aria-label="Mandate progress by PSM">
      {rows.map((row) => {
        const share = row.target ? Math.round((row.achieved / row.target) * 100) : null;
        const tone = share >= 100 ? 'ok' : share >= 50 ? 'mid' : 'low';
        return (
          <li key={row.name} title={`${row.name}: ${inr(row.achieved)} from ${row.opportunities} qualified opportunit${row.opportunities === 1 ? 'y' : 'ies'}${row.target ? ` of ${inr(row.target)} target` : ''}`}>
            <span className="mb-psm-name">
              {row.name}
              <small>{row.target ? `${inr(row.achieved)} of ${inr(row.target)}` : 'No target set'}</small>
              {!whole && row.monthly && <small>Monthly target {inr(row.monthly)}</small>}
            </span>
            <span className="mb-psm-track" aria-hidden="true"><b className={tone} style={{ width: `${share === null ? 0 : Math.min(100, share)}%` }} /></span>
            <span className="mb-psm-pct">{share === null ? inr(row.achieved) : `${share}%`}</span>
          </li>
        );
      })}
    </ul>
  );
}

const monthName = (month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' });
const TARGET_NAME = { monthly: 'Monthly target', quarterly: 'Quarter target' };

function Empty({ children }) {
  return (
    <section className="mb" aria-label="PSM mandate progress">
      <div className="mb-main">
        <h2 className="mb-title">PSM Mandate Progress</h2>
        <p className="mb-na">{children}</p>
      </div>
    </section>
  );
}

export function MandateBar({ mandate, period }) {
  if (!mandate) return <Empty>NA · The selected person is not on the PSM team.</Empty>;
  if (!mandate.available) return <Empty>NA · Qualified opportunities (Zoho Contacts) could not be loaded. Refresh to try again.</Empty>;
  if (mandate.noTarget) {
    return <Empty>NA · No approved PSM target for {mandate.missing.map(monthName).join(', ') || 'this period'}. Add it in backend/src/config/psmTargets.js.</Empty>;
  }

  const { achieved, opportunities, psms, byPsm, target: pace, daysLeft, neededPerDay, missing } = mandate;
  const targetName = mandate.whole ? TARGET_NAME[mandate.kind] ?? 'Target' : 'Target · pro-rated';
  const done = pace ? Math.min(1, achieved / pace) : 0;
  const donePct = Math.round(done * 100);
  const realPct = pace ? Math.round((achieved / pace) * 100) : 0;
  const ahead = achieved - pace;
  const at = `${done * 100}%`;
  const labelAt = `${clamp(done * 100, 6, 84)}%`;

  return (
    <section className="mb" aria-label="PSM mandate progress">
      <div className="mb-main">
        <h2 className="mb-title">PSM Mandate Progress</h2>
        <p className="mb-sub">
          {period} · {psms.length} PSM{psms.length === 1 ? '' : 's'} · {inr(achieved)} from {opportunities} qualified opportunit{opportunities === 1 ? 'y' : 'ies'}
          {daysLeft > 0 && achieved < pace && ` · ${inr(neededPerDay)} needed per working day, ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
          {missing.length > 0 && ` · no target for ${missing.map(monthName).join(', ')}, not counted`}
          {mandate.unvalued > 0 && (
            <span className="mb-warn" title="These opportunities add ₹0 until their value is entered in Zoho, so the achieved figure is understated">
              {' · '}{mandate.unvalued} of {opportunities} have no value in Zoho
            </span>
          )}
        </p>

          <div className="mb-line" role="meter" aria-valuemin={0} aria-valuemax={Math.round(pace)} aria-valuenow={Math.round(achieved)}
            aria-label={`${inr(achieved)} of ${inr(pace)} ${targetName.toLowerCase()}, ${donePct}% achieved`}>
            <div className="mb-top" aria-hidden="true">
              {done < 0.9 && (
                <span className="mb-tag achieved" style={{ left: labelAt }}>
                  <strong>{inr(achieved)}</strong>
                  <em>Achieved till date</em>
                </span>
              )}
              <span className={`mb-tag target${done >= 0.9 ? ' merged' : ''}`}>
                <strong>{done >= 0.9 ? `${inr(achieved)} / ${inr(pace)}` : inr(pace)}</strong>
                <em>{targetName}</em>
              </span>
            </div>

            <div className="mb-track" aria-hidden="true">
              <b className="mb-fill" style={{ width: at }} />
              <i className="mb-dot start" />
              <i className="mb-dot now" style={{ left: at }} />
              <i className="mb-dot end" />
              <i className="mb-guide" style={{ left: at }} />
              <i className="mb-guide" style={{ left: '100%' }} />
            </div>

            <div className="mb-bottom" aria-hidden="true">
              <span className="mb-zero">₹0</span>
              {done >= 0.12 && (
                <span className="mb-seg done" style={{ left: `max(${(done * 100) / 2}%, 76px)` }}>
                  <strong>{realPct}%</strong><em>Target completed{ahead > 0 ? ` · ${inr(ahead)} ahead` : ''}</em>
                </span>
              )}
              {done <= 0.88 && (
                <span className="mb-seg left" style={{ left: `${(done * 100 + 100) / 2}%` }}>
                  <strong>{100 - donePct}%</strong><em>Remaining · {inr(Math.max(0, pace - achieved))}</em>
                </span>
              )}
            </div>
          </div>
      </div>

      <PsmBars rows={byPsm} whole={mandate.whole} />
    </section>
  );
}
