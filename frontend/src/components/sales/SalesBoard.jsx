import { RefreshCw, X } from 'lucide-react';
import { PeriodFilter } from '../PeriodFilter.jsx';
import { IncentivePolicyCard } from '../IncentivePolicyCard.jsx';
import { PsmLeadList } from '../PsmLeadList.jsx';
import { ActionRow } from '../presales/ActionRow.jsx';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { GroupedQueue } from '../presales/GroupedQueue.jsx';
import { PreSalesFunnel } from '../presales/PreSalesFunnel.jsx';
import { SummaryStrip } from '../presales/SummaryStrip.jsx';
import { SalesTeamTable } from './SalesTeamTable.jsx';

const ALL_REPS = 'All Sales Reps';
const FLOW = /^(active opportunities|in design|sent for approval|price discussion)/i;
const timeOf = (date) => date?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function SalesBoard({ state, timeframe, onTimeframe, owner, onOwner, selectedDetail, onDetail, onOpen }) {
  const { data, error, loading, fetchedAt } = state;

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return (
      <div className="screen-message error">
        {error || 'Sales data could not be loaded.'}
        <span>Make sure the backend is running on port 4010.</span>
      </div>
    );
  }

  const meta = data.meta ?? {};
  const [periodName, range] = (meta.reportLabel ?? '').split(' · ');
  const selectedOwner = owner !== ALL_REPS ? owner : '';
  const clearOwner = () => {
    onOwner(ALL_REPS);
    onDetail('');
  };

  return (
    <div className={`ps${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Sales Morning Review</h1>
          <p className="ps-sub">
            <span>{range ?? periodName}</span>
            <span>Active pipeline, design progress, approvals and bookings</span>
            {meta.isDemo ? (
              <span className="ps-source demo">Demo data · CRM integration pending</span>
            ) : (
              <span className="ps-source live">
                <i aria-hidden="true" />
                Live from Zoho CRM{fetchedAt ? ` · updated ${timeOf(fetchedAt)}` : ''}
              </span>
            )}
            {loading && <span className="ps-refreshing" role="status"><RefreshCw size={13} aria-hidden="true" /> Updating</span>}
          </p>
        </div>
        <div className="ps-controls">
          <PeriodFilter value={timeframe} onChange={onTimeframe} />
          <label className="ps-select">
            <select aria-label="Sales rep" value={owner} onChange={(event) => onOwner(event.target.value)}>
              {(data.filters?.owners ?? [ALL_REPS]).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {meta.notice && <p className="ps-notice">{meta.notice}</p>}

      {selectedDetail && (
        <div className="ps-detail" role="status">
          <strong>{selectedDetail}</strong>
          <button type="button" onClick={() => onDetail('')} aria-label="Dismiss filter notice"><X size={15} /></button>
        </div>
      )}

      <div className="ps-body">
        <SummaryStrip kpis={data.kpis ?? []} onOpen={onOpen} flow={FLOW} />
        <ActionRow risks={data.risks ?? []} onOpen={onOpen} />

        <div className="ps-split">
          <SalesTeamTable rows={data.performance ?? []} onOwner={onOwner} onDetail={onDetail} />
          <GroupedQueue rows={data.decisions ?? []} onOpen={onOpen} />
        </div>

        {selectedOwner && (
          <>
            <PsmLeadList psm={selectedOwner} leads={data.leads ?? []} deals={data.deals ?? []} mode="sales" onClear={clearOwner} />
            <div className="ps-incentive">
              <IncentivePolicyCard
                personName={selectedOwner}
                mode="sales"
                performanceRow={data.performance?.[0] || null}
                leads={data.leads || []}
                deals={data.deals || []}
                periodLabel={(periodName ?? '').toLowerCase()}
                onClose={() => onOwner(ALL_REPS)}
              />
            </div>
          </>
        )}

        <PreSalesFunnel stages={data.funnel ?? []} periodName={periodName} onOpen={onOpen} title="Pipeline conversion" detailLabel="Pipeline Conversion details" />
      </div>
    </div>
  );
}
