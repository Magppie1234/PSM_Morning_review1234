import { RefreshCw } from 'lucide-react';
import { Formula, FormulaButton, FormulaPanel, useFormulaToggle, useShowFormula } from '../formula/FormulaPanel.jsx';
import { lazy, Suspense, useState } from 'react';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { RefreshButton } from '../../shared/ui/RefreshButton.jsx';
const EfficiencyMargin = lazy(() => import('../../features/sales/efficiency/EfficiencyMargin.jsx').then(module => ({ default: module.EfficiencyMargin })));
const IndiaHeatMap = lazy(() => import('../IndiaHeatMap.jsx'));
import { LeadGeneration } from './LeadGeneration.jsx';
import { SalesPerformance } from './SalesPerformance.jsx';
import { SalesFilters } from './SalesFilters.jsx';
import { SalesRecordsPopup } from './SalesRecordsPopup.jsx';
import { WeeklyView } from './WeeklyView.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';

const timeOf = (date) => date?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// The board's three views. The first two share one endpoint; efficiency reads its own, and only while it
// is on screen, because its twelve-month series is the heaviest read on the board.
const SECTIONS = [
  { id: 'lead-generation', label: 'Lead generation' },
  { id: 'sales-performance', label: 'Sales performance' },
  { id: 'weekly', label: 'Weekly view' },
  { id: 'efficiency', label: 'Efficiency margin' }
];


/**
 * The Show Formula button, reading the one switch the app shell owns. Boards that draw their own
 * header use this rather than threading the switch down through props.
 */
function FormulaToggle() {
  const on = useShowFormula();
  const toggle = useFormulaToggle();
  return <FormulaButton on={on} onToggle={toggle} />;
}

// The formulas on one section's cards. They sit either directly on the group (incoming, closed,
// overdue and so on) or inside its `stages` array (the S1-S6 ladder), so both are walked.
function collectFormulas(group) {
  if (!group || typeof group !== 'object') return [];
  const out = [];
  for (const value of Object.values(group)) {
    if (Array.isArray(value)) value.forEach((entry) => entry?.formula && out.push(entry.formula));
    else if (value && typeof value === 'object' && value.formula) out.push(value.formula);
  }
  return out;
}

export function SalesBoard() {
  const [section, setSection] = useState('lead-generation');
  const [city, setCity] = useState('all');
  const [period, setPeriod] = useState('monthly');
  const [card, setCard] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const isEfficiency = section === 'efficiency';
  const funnel = useDashboard({ timeframe: period, city }, '/api/sales-funnel', !isEfficiency);
  const efficiency = useDashboard({ timeframe: period, city }, '/api/sales-efficiency', isEfficiency);
  const active = isEfficiency ? efficiency : funnel;
  const { error, loading, refreshing, stale, fetchedAt, refresh } = active;
  const data = active.data ?? {};
  const busy = loading || refreshing;
  const meta = data.meta ?? {};
  const [periodName, range] = (meta.reportLabel ?? '').split(' · ');

  return (
    <div className={`ps${refreshing ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>Sales Monitoring Review</h1>
          <p className="ps-sub">
            <span>{range ?? periodName}</span>
            <span>Lead generation and the closing pipeline</span>
            <span className={`ps-source ${stale ? 'demo' : 'live'}`}>
              <i aria-hidden="true" />
              {stale ? 'Saved data · refresh needed' : 'Zoho CRM'}{fetchedAt ? ` · updated ${timeOf(fetchedAt)}` : ''} · 30-minute refresh
            </span>
            {busy && <span className="ps-refreshing" role="status"><RefreshCw size={13} aria-hidden="true" /> Updating</span>}
          </p>
        </div>
        <div className="ps-controls">
          <FormulaToggle />
          <RefreshButton
            onRefresh={refresh}
            loading={busy}
          />
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
        {error && <p className="sb-notice" role="alert">{error}</p>}
        {!active.data && loading && <BoardSkeleton />}

        {/* Show Formula. The entries are sent by the API alongside the cards, generated from the same
            STAGES table the counting used, so this cannot describe a rule the numbers did not follow.
            Each section shows its own cards' formulas rather than all of them at once. */}
        <FormulaPanel title={section === 'lead-generation' ? 'Lead generation' : 'Sales performance'}>
          {collectFormulas(section === 'lead-generation' ? data.leadGeneration : data.salesPerformance)
            .map((entry, index) => <Formula entry={entry} compact key={`${entry.title}-${index}`} />)}
        </FormulaPanel>

        <div className={`sb-section${(isEfficiency ? efficiency.loading : loading) ? ' is-loading' : ''}`}>
          {active.data && section === 'lead-generation' && <LeadGeneration data={data.leadGeneration} loading={loading} onOpen={setCard} />}
          {active.data && section === 'sales-performance' && <SalesPerformance data={data.salesPerformance} loading={loading} onOpen={setCard} />}
          {active.data && section === 'weekly' && (
            <WeeklyView
              weeks={data.weeks ?? []}
              records={data.records ?? []}
              loading={loading}
              onOpen={(record) => setCard({ id: `wk-${record.id}`, label: record.name, ids: [String(record.id)] })}
            />
          )}
          {isEfficiency && (efficiency.data
            ? (
              <Suspense fallback={<p role="status">Opening efficiency view…</p>}>
                <EfficiencyMargin data={efficiency.data} loading={efficiency.loading} />
                <button type="button" className="ps-list-toggle" aria-expanded={showMap} onClick={() => setShowMap(value => !value)}>{showMap ? 'Hide city map' : 'Show city map'}</button>
                {showMap && <IndiaHeatMap
                  points={efficiency.data.regions?.byCity ?? []}
                  loading={efficiency.loading}
                  title="Demand by city"
                />}
              </Suspense>
            )
            : null)}
        </div>

        {/* `weeks` gives the popup its third view; a board without weeks simply has no Weekly option. */}
        {card && <SalesRecordsPopup card={card} records={data.records ?? []} weeks={data.weeks ?? []} onClose={() => setCard(null)} />}
      </div>
    </div>
  );
}

