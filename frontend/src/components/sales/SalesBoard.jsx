import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { RefreshButton } from '../presales/PreSalesBoard.jsx';
import { LeadGeneration } from './LeadGeneration.jsx';
import { SalesPerformance } from './SalesPerformance.jsx';
import { SalesFilters } from './SalesFilters.jsx';
import { SalesRecordsPopup } from './SalesRecordsPopup.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';

const timeOf = (date) => date?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// The board's two views. Both read the same endpoint and share the city and period filter below the tabs.
const SECTIONS = [
  { id: 'lead-generation', label: 'Lead generation' },
  { id: 'sales-performance', label: 'Sales performance' }
];

export function SalesBoard() {
  const [section, setSection] = useState('lead-generation');
  const [city, setCity] = useState('all');
  const [period, setPeriod] = useState('monthly');
  const [card, setCard] = useState(null);
  const { data, error, loading, fetchedAt, refresh } = useDashboard({ timeframe: period, city }, '/api/sales-funnel');

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return (
      <div className="screen-message error">
        {error || 'Sales data could not be loaded.'}
        <span>Make sure the backend is running on port 4010.</span>
        <RefreshButton onRefresh={refresh} loading={loading} />
      </div>
    );
  }

  const meta = data.meta ?? {};
  const [periodName, range] = (meta.reportLabel ?? '').split(' · ');

  return (
    <div className={`ps${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Sales Monitoring Review</h1>
          <p className="ps-sub">
            <span>{range ?? periodName}</span>
            <span>Lead generation and the closing pipeline</span>
            <span className="ps-source live">
              <i aria-hidden="true" />
              Live from Zoho CRM{fetchedAt ? ` · updated ${timeOf(fetchedAt)}` : ''}
            </span>
            {loading && <span className="ps-refreshing" role="status"><RefreshCw size={13} aria-hidden="true" /> Updating</span>}
          </p>
        </div>
        <div className="ps-controls">
          <RefreshButton onRefresh={refresh} loading={loading} />
        </div>
      </header>

      <div className="sb-tabs" role="tablist" aria-label="Sales views">
        {SECTIONS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            role="tab"
            aria-selected={section === entry.id}
            onClick={() => { setSection(entry.id); setCard(null); }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="ps-body">
        <SalesFilters
          cities={data.filters?.cities ?? []}
          city={city}
          onCity={setCity}
          timeframe={period}
          onTimeframe={setPeriod}
        />

        {meta.notice && <p className="sb-notice">{meta.notice}</p>}

        <div className={`sb-section${loading ? ' is-loading' : ''}`}>
          {section === 'lead-generation' ? (
            <LeadGeneration data={data.leadGeneration} loading={loading} onOpen={setCard} />
          ) : (
            <SalesPerformance data={data.salesPerformance} loading={loading} onOpen={setCard} />
          )}
        </div>

        {card && <SalesRecordsPopup card={card} records={data.records ?? []} onClose={() => setCard(null)} />}
      </div>
    </div>
  );
}
