import { Info } from 'lucide-react';
import { useState } from 'react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { ReadinessTable } from './ReadinessTable.jsx';
import { TransportCard } from './TransportCard.jsx';

const VIEWS = [
  { key: 'focus', label: 'Overdue and this week', match: (order) => order.bucket === 'overdue' || order.bucket === 'week' },
  { key: 'noDate', label: 'No dispatch date', match: (order) => order.bucket === 'none' },
  { key: 'all', label: 'All heading to dispatch', match: () => true }
];

const GATES = [
  { key: 'site', label: 'Site ready', hint: '1st dispatch: site approved · 2nd: installation done' },
  { key: 'finance', label: 'Payment done', hint: 'PDI payment done, or all payment milestones paid' },
  { key: 'production', label: 'Production ready', hint: '"Ready For Dispatch" set in Zoho' }
];

function GateSummary({ gates, total }) {
  return (
    <div className="dp-gates">
      {GATES.map((item) => {
        const counts = gates[item.key];
        return (
          <div className="dp-gate" key={item.key} title={item.hint}>
            <span className="dp-gate-label">{item.label}</span>
            <strong>{counts.done}<small> of {total}</small></strong>
            <span className="dp-gate-bar" aria-hidden="true">
              {['done', 'waiting', 'pending', 'no', 'unknown'].map((state) => (
                counts[state] ? <i className={state} style={{ flexGrow: counts[state] }} key={state} /> : null
              ))}
            </span>
            <span className="dp-gate-note">
              {[counts.waiting && `${counts.waiting} awaiting approval`, counts.no && `${counts.no} not ready`, counts.unknown && `${counts.unknown} not recorded`].filter(Boolean).join(' · ') || 'All clear'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DispatchBoard() {
  const { data, error, loading } = useDashboard({}, '/api/dispatch-dashboard');
  const [view, setView] = useState('focus');
  const [kpiFilter, setKpiFilter] = useState(null);

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return <div className="screen-message error">{error || 'Dispatch data could not be loaded.'}<span>Make sure the backend is running on port 4010.</span></div>;
  }

  const activeKpi = data.kpis.find((kpi) => kpi.key === kpiFilter);
  const current = VIEWS.find((item) => item.key === view);
  const rows = activeKpi ? data.orders.filter((order) => activeKpi.ids.includes(order.id)) : data.orders.filter(current.match);

  return (
    <div className={`ps dp${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Dispatch review</h1>
          <p className="ps-sub">
            <span>{data.meta.windowLabel}</span>
            <span>{data.orders.length} orders heading to dispatch</span>
            <span className="ps-source live"><i aria-hidden="true" />Live from Zoho CRM</span>
          </p>
        </div>
      </header>

      <section className="dp-kpis" aria-label="Critical cases">
        {data.kpis.map((kpi) => (
          <button
            type="button"
            key={kpi.key}
            className={`dp-kpi ${kpi.tone}${kpiFilter === kpi.key ? ' active' : ''}`}
            aria-pressed={kpiFilter === kpi.key}
            disabled={!kpi.ids.length}
            onClick={() => setKpiFilter(kpiFilter === kpi.key ? null : kpi.key)}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <em>{kpi.note}</em>
          </button>
        ))}
      </section>

      <div className="dp-layout">
        <section className="ps-panel" aria-labelledby="dp-ready-title">
          <header className="ps-panel-head dp-ready-head">
            <div>
              <h2 id="dp-ready-title">Production and dispatch readiness</h2>
              <p>An order is ready to dispatch when site, payment and production are all green</p>
            </div>
          </header>
          <GateSummary gates={data.gates} total={data.orders.length} />

          <div className="dp-views">
            {activeKpi ? (
              <span className="dp-filter">
                Showing: {activeKpi.label} ({rows.length})
                <button type="button" className="ps-link" onClick={() => setKpiFilter(null)}>Clear</button>
              </span>
            ) : (
              <div className="fs-switch" role="group" aria-label="Orders to show">
                {VIEWS.map((item) => (
                  <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => setView(item.key)}>
                    {item.label} · {data.orders.filter(item.match).length}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ReadinessTable
            key={`${view}-${kpiFilter}`}
            orders={rows}
            emptyText={view === 'focus' ? 'No dispatches are overdue or planned for the next 7 days.' : 'No orders in this list.'}
          />

          <p className="dp-gap">
            <Info size={14} aria-hidden="true" />
            Lights come from each order's Zoho stage. Hover a light to see its source. Production shows "Not recorded" until the factory sets "Ready For Dispatch" in Zoho
            {data.meta.paymentMilestonesInUse ? '.' : ', and payment milestones are not in use for these orders yet.'}
          </p>
        </section>

        <TransportCard transport={data.transport} />
      </div>
    </div>
  );
}
