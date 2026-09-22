import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { GroupedQueue } from '../presales/GroupedQueue.jsx';
import { SummaryStrip } from '../presales/SummaryStrip.jsx';

// Pre Sales metrics read as a pipeline; the Sales figures sit beside them as context.
const TOP_LEVEL = /^(raw leads|contacted|qualified)/i;

// Senior decisions from both Pre Sales and Sales, grouped by the issue behind them.
export function DecisionQueueBoard({ preSales, sales, onOpen }) {
  if (!preSales.data && !sales.data) {
    if (preSales.loading || sales.loading) return <BoardSkeleton />;
    return <div className="screen-message error">{preSales.error || sales.error || 'Decision data could not be loaded.'}<span>Make sure the backend is running on port 4010.</span></div>;
  }

  const kpis = [
    ...(preSales.data?.kpis ?? []).filter((item) => /^(raw leads|contacted|qualified)/i.test(item.label)),
    ...(sales.data?.kpis ?? []).filter((item) => /^(active opportunities|sent for approval|active pipeline value)/i.test(item.label))
  ];
  const period = preSales.data?.meta?.reportLabel ?? sales.data?.meta?.reportLabel ?? '';
  const total = (preSales.data?.decisions?.length ?? 0) + (sales.data?.decisions?.length ?? 0);

  return (
    <div className={`ps${preSales.loading || sales.loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Senior Decision Queue</h1>
          <p className="ps-sub">
            <span>{period}</span>
            <span>{total} leads and orders need a senior decision</span>
            <span className="ps-source live"><i aria-hidden="true" />Live from Zoho CRM</span>
          </p>
        </div>
      </header>

      <div className="ps-body">
        <SummaryStrip kpis={kpis} onOpen={onOpen} flow={TOP_LEVEL} />
        <div className="ps-split dq-split">
          <GroupedQueue rows={preSales.data?.decisions ?? []} onOpen={onOpen} title="Pre Sales leads" />
          <GroupedQueue rows={sales.data?.decisions ?? []} onOpen={onOpen} title="Sales orders" />
        </div>
      </div>
    </div>
  );
}
