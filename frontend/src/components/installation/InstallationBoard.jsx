import { Info, Truck } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { PeriodFilter } from '../PeriodFilter.jsx';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { InstallationVisits } from './InstallationVisits.jsx';
import { MissingItems } from './MissingItems.jsx';
import { OrdersInInstallation } from './OrdersInInstallation.jsx';
import { NA, shortDate } from './shared.jsx';

export function InstallationBoard({ timeframe, onTimeframe }) {
  const { data, error, loading } = useDashboard({ timeframe }, '/api/installation-dashboard');

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return <div className="screen-message error">{error || 'Installation data could not be loaded.'}<span>Make sure the backend is running on port 4010.</span></div>;
  }

  const { meta } = data;

  return (
    <div className={`ps in${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Installation review</h1>
          <p className="ps-sub">
            <span>{meta.reportLabel}</span>
            <span>Missing items, visits and orders on site</span>
            <span className="ps-source live"><i aria-hidden="true" />Live from Zoho CRM</span>
          </p>
        </div>
        <div className="ps-controls">
          <PeriodFilter value={timeframe} onChange={onTimeframe} />
        </div>
      </header>

      {(meta.lastVisitRecorded || meta.olderOpenVisits > 0) && (
        <p className="fs-promise quiet">
          <Info size={15} aria-hidden="true" />
          {meta.lastVisitRecorded && `The last installation visit in Zoho is dated ${shortDate(meta.lastVisitRecorded)}.`}
          {meta.olderOpenVisits > 0 && ` ${meta.olderOpenVisits.toLocaleString('en-IN')} older visits (since ${shortDate(meta.olderOpenSince)}) are still marked open.`}
        </p>
      )}

      <section className="dp-kpis in-kpis" aria-label="Installation summary">
        {data.kpis.map((kpi) => (
          <div className={`dp-kpi ${kpi.tone}`} key={kpi.key}>
            <span>{kpi.label}</span>
            <strong>{kpi.value === null ? NA : kpi.value}</strong>
            <em>{kpi.note}</em>
          </div>
        ))}
      </section>

      <div className="in-stack">
        <MissingItems missing={data.missing} recordedEver={meta.itemsRecordedEver} />
        <InstallationVisits visits={data.visits} />
        <OrdersInInstallation orders={data.orders} />

        <section className="ps-panel" aria-labelledby="in-holds-title">
          <header className="ps-panel-head">
            <div>
              <h2 id="in-holds-title"><Truck size={15} aria-hidden="true" /> Dispatch holds from the installation team · {data.holds.length}</h2>
              <p>From the dispatch sheet</p>
            </div>
          </header>
          <ul className="in-holds">
            {data.holds.length === 0 && <li className="in-empty">NA · No holds recorded.</li>}
            {data.holds.map((hold) => (
              <li key={hold.id}>
                <strong>{hold.location} · {hold.client}</strong>
                <span>MRP {hold.mrpNo} · planned {shortDate(hold.plannedDate) ?? 'NA'} · {/^\d{4}/.test(hold.actualDate) ? `left ${shortDate(hold.actualDate)}` : 'still held'}</span>
                <span className="in-reason">{hold.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
