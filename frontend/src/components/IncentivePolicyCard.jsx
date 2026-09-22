import { Award, Info, ShieldCheck, X } from 'lucide-react';
import { calculatePreSalesIncentive, calculateSalesIncentive } from '../data/incentiveCalc.js';
import { getPersonPolicy } from '../data/incentivePolicies.js';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (value) => `₹${inr.format(Math.round(value))}`;
const lakh = (value) => `₹${(value / 100000).toFixed(1)}L`;
const DEFAULT_TARGETS = { AVP: 90000000, SM: 30000000, ASM: 15000000 };

export function IncentivePolicyCard({ personName, mode = 'pre-sales', performanceRow = null, deals = [], periodLabel = '', onClose }) {
  if (!personName || personName === 'All PSM' || personName === 'All Sales Reps') return null;

  const policy = getPersonPolicy(personName, mode);
  const isSales = policy.isSales;
  const monthlyTarget = policy.target ?? DEFAULT_TARGETS[policy.role] ?? DEFAULT_TARGETS.SM;
  const result = isSales
    ? calculateSalesIncentive({ row: performanceRow ?? {}, deals, personName, monthlyTarget })
    : calculatePreSalesIncentive(performanceRow ?? {});
  const gateText = isSales ? '25% of the monthly target' : '25 qualified leads';

  return (
    <section className="ps-panel ic" aria-labelledby="ic-title">
      <header className="ps-panel-head">
        <div className="ic-title">
          <span className="ic-badge" aria-hidden="true"><Award size={17} /></span>
          <div>
            <h2 id="ic-title">{personName} · incentive earned</h2>
            <p>{policy.title} · {policy.details.policyName}</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="ic-close" onClick={onClose} aria-label="Close incentive view">
            <X size={16} />
          </button>
        )}
      </header>

      <div className="ic-hero">
        <div>
          <span className="ic-label">Incentive earned</span>
          <strong className={`ic-total${result.total > 0 ? ' earned' : ''}`}>{rupees(result.total)}</strong>
          <span className="ic-note">
            {isSales
              ? `${result.wonCount} won of ${result.opportunities} opportunities · ${lakh(result.realization)} won order value`
              : `${result.qualified} qualified leads · ${result.bookings} converted to bookings`}
          </span>
        </div>

        <div>
          <div className="ic-progress-head">
            <span className="ic-label">Target achievement · {result.progress}%</span>
            <span className="ic-note">{policy.targetText}</span>
          </div>
          <div className="ic-bar" role="img" aria-label={`${result.progress}% of target; eligibility starts at ${gateText}`}>
            <i style={{ width: `${Math.min(100, result.progress)}%` }} className={result.eligible ? 'ok' : ''} />
            <b style={{ left: '25%' }} aria-hidden="true" />
          </div>
          <span className={`ic-gate${result.eligible ? ' ok' : ''}`}>
            {result.eligible ? `Eligibility reached (${gateText})` : `Below the eligibility gate of ${gateText}, so nothing is payable yet`}
          </span>
        </div>
      </div>

      <div className="ic-streams">
        {result.streams.map((stream) => (
          <div className="ic-stream" key={stream.key}>
            <div className="ic-stream-head">
              <span>{stream.title}</span>
              <em>{stream.tag}</em>
            </div>
            <strong className={stream.amount === null ? 'na' : ''}>{stream.amount === null ? 'NA' : rupees(stream.amount)}</strong>
            <p>{stream.detail}</p>
          </div>
        ))}
      </div>

      <footer className="ic-foot">
        <span><ShieldCheck size={14} aria-hidden="true" /> Calculated from Zoho CRM under {policy.details.policyName}. Streams marked NA have no data in Zoho.</span>
        <span><Info size={14} aria-hidden="true" /> Uses {periodLabel ? `${periodLabel} ` : 'the selected period’s '}data against a monthly target, so it is a partial view of the month.</span>
      </footer>
    </section>
  );
}
