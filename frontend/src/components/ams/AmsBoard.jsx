import { Info } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { PeriodFilter } from '../PeriodFilter.jsx';
import { NA } from '../installation/shared.jsx';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { AmsSchedule } from './AmsSchedule.jsx';
import { AmsVisits } from './AmsVisits.jsx';

export function AmsBoard({ timeframe, onTimeframe }) {
  const { data, error, loading } = useDashboard({ timeframe }, '/api/ams-dashboard');

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return <div className="screen-message error">{error || 'AMS data could not be loaded.'}<span>Make sure the backend is running on port 4010.</span></div>;
  }

  const { meta } = data;

  return (
    <div className={`ps in${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>AMS review</h1>
          <p className="ps-sub">
            <span>{meta.reportLabel}</span>
            <span>Annual maintenance services due, done and missed</span>
            <span className="ps-source live"><i aria-hidden="true" />Live from Zoho CRM</span>
          </p>
        </div>
        <div className="ps-controls">
          <PeriodFilter value={timeframe} onChange={onTimeframe} />
        </div>
      </header>

      {meta.olderPlanned > 0 && (
        <p className="fs-promise quiet">
          <Info size={15} aria-hidden="true" />
          {meta.olderPlanned.toLocaleString('en-IN')}{meta.olderPlannedCapped ? '+' : ''} older AMS services dated before this period are still marked Planned in Zoho.
        </p>
      )}

      <section className="dp-kpis in-kpis" aria-label="AMS summary">
        {data.kpis.map((kpi) => (
          <div className={`dp-kpi ${kpi.tone}`} key={kpi.key}>
            <span>{kpi.label}</span>
            <strong>{kpi.value === null ? NA : kpi.value}</strong>
            <em>{kpi.note}</em>
          </div>
        ))}
      </section>

      <div className="in-stack">
        <AmsSchedule schedule={data.schedule} start={meta.start} end={meta.end} />
        <AmsVisits visits={data.visits} />
      </div>
    </div>
  );
}
