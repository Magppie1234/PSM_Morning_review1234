import { RefreshButton } from '../../shared/ui/RefreshButton.jsx';
import { ChevronDown, Lock, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { IncentivePolicyCard } from '../IncentivePolicyCard.jsx';
import { PsmLeadList } from '../PsmLeadList.jsx';
import { ActionRow } from './ActionRow.jsx';
import { BoardSkeleton } from './BoardSkeleton.jsx';
import { LeadFlow } from './LeadFlow.jsx';
import { MandateBar } from './MandateBar.jsx';
import { MondayRoster } from './MondayRoster.jsx';
import { TeamTable } from './TeamTable.jsx';
import { PeriodFilter } from '../PeriodFilter.jsx';
import IndiaHeatMap from '../IndiaHeatMap.jsx';
import { Formula, FormulaButton, FormulaPanel, FormulaProvider, useFormulaSwitch } from '../formula/FormulaPanel.jsx';
import { conversionFormula, mandateFormula, riskFormulas, rotaFormula, teamFormula } from '../formula/formulas.js';

const ALL_PSM = 'All PSM';
const isPending = (item) => item?.value === '—';

// A PSM's full lead list is long, so it stays closed until asked for (and closes again when the PSM changes).
function LeadListToggle({ psm, leads, children }) {
  const [open, setOpen] = useState({ psm: '', value: false });
  const isOpen = open.psm === psm && open.value;
  const count = leads.filter((lead) => lead.psm === psm).length;
  return (
    <>
      <button type="button" className="ps-list-toggle" aria-expanded={isOpen} onClick={() => setOpen({ psm, value: !isOpen })}>
        <ChevronDown size={15} aria-hidden="true" />
        {isOpen ? `Hide ${psm}'s leads` : `Show ${psm}'s leads (${count})`}
      </button>
      {isOpen && children}
    </>
  );
}
const timeOf = (date) => date?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export { RefreshButton } from '../../shared/ui/RefreshButton.jsx';
export function PreSalesBoard({ state, timeframe, onTimeframe, psm, onPsm, selectedDetail, onDetail, onOpen }) {
  const { data, error, loading, refreshing, stale, fetchedAt, refresh } = state;
  const [showFormula, toggleFormula] = useFormulaSwitch();

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return (
      <div className="screen-message error">
        {error || 'Dashboard data could not be loaded.'}
        <span>Make sure the backend is running on port 4010.</span>
        <RefreshButton onRefresh={refresh} loading={loading} />
      </div>
    );
  }

  const meta = data.meta ?? {};
  // Dates the Show Formula panels quote, so a filter can be copied straight into Zoho.
  const formulaCtx = { start: meta.start, end: meta.end, previousStart: meta.previousStart, previousEnd: meta.previousEnd, previousLabel: meta.previousLabel };
  const [periodName, range] = (meta.reportLabel ?? '').split(' · ');
  const kpis = data.kpis ?? [];
  const risks = data.risks ?? [];
  const pending = [...kpis, ...risks].filter(isPending);
  const selectedPsm = psm !== ALL_PSM ? psm : '';
  const clearPsm = () => {
    onPsm(ALL_PSM);
    onDetail('');
  };

  return (
    <FormulaProvider value={showFormula}>
    <div className={`ps${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>PSM Monitoring Review</h1>
          <p className="ps-sub">
            <span>{range ?? periodName}</span>
            <span title="Leads owned by Deepak, Ishita, Sowmya and Sparshan, including converted ones">PSM team leads, incl. converted</span>
            {meta.isDemo ? (
              <span className="ps-source demo">Demo data · CRM integration pending</span>
            ) : (
              <span className="ps-source live">
                <i aria-hidden="true" />
                {stale ? 'Saved data · refresh needed' : 'Zoho CRM'}{fetchedAt ? ` · updated ${timeOf(fetchedAt)}` : ''} · 30-minute refresh
              </span>
            )}
            {refreshing && (
              <span className="ps-refreshing" role="status">
                <RefreshCw size={13} aria-hidden="true" /> Updating
              </span>
            )}
          </p>
        </div>

        <div className="ps-controls">
          <PeriodFilter value={timeframe} onChange={onTimeframe} />
          <RefreshButton onRefresh={refresh} loading={loading || refreshing} />
          <FormulaButton on={showFormula} onToggle={toggleFormula} />
          <label className="ps-select">
            <select aria-label="PSM" value={psm} onChange={(event) => onPsm(event.target.value)}>
              {(data.filters?.psms ?? [ALL_PSM]).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ps-locked"
            aria-disabled="true"
            title="City, product and lead source filters unlock once those CRM fields are mapped"
          >
            <Lock size={13} aria-hidden="true" />
            More filters
          </button>
        </div>
      </header>

      {meta.notice && <p className="ps-notice">{meta.notice}</p>}
      {error && <p className="ps-notice" role="alert">{error} Showing the last loaded data.</p>}

      {selectedDetail && (
        <div className="ps-detail" role="status">
          <strong>{selectedDetail}</strong>
          <button type="button" onClick={() => onDetail('')} aria-label="Dismiss filter notice"><X size={15} /></button>
        </div>
      )}

      <div className="ps-body">
        <MondayRoster />
        <FormulaPanel title="Monday roster"><Formula entry={rotaFormula} compact /></FormulaPanel>
        <MandateBar mandate={data.mandate} period={range ?? periodName} />
        <FormulaPanel title="PSM Mandate Progress"><Formula entry={mandateFormula(formulaCtx, data.mandate)} /></FormulaPanel>
        <LeadFlow flow={data.flow} leads={data.leads ?? []} opportunities={data.opportunities ?? []} formulaCtx={formulaCtx}>
          <ActionRow risks={risks.filter((item) => !isPending(item))} onOpen={onOpen} />
          <FormulaPanel title="Needs action today">
            <div className="fx-grid">
              {Object.entries(riskFormulas(formulaCtx)).map(([label, entry]) => (
                <Formula entry={{ title: label, module: 'Raw Leads (Leads)', ...entry }} compact key={label} />
              ))}
            </div>
          </FormulaPanel>
        </LeadFlow>

        {pending.length > 0 && (
          <p className="ps-pending ps-pending-line">
            <Lock size={14} aria-hidden="true" />
            <span>Awaiting CRM field mapping:</span>
            {pending.map((item) => (
              <button type="button" className="ps-pending-chip" onClick={() => onOpen(item)} key={item.label}>{item.label}</button>
            ))}
          </p>
        )}

        {/* The Senior decision queue used to sit beside this table. It is off every board now; the same
            leads are reachable from the funnel cards and the Needs action row. */}
        <div className="ps-split ps-split-one">
          <TeamTable rows={data.performance ?? []} onPsm={onPsm} onDetail={onDetail} />
        </div>
        <FormulaPanel title="PSM performance">
          <Formula entry={teamFormula} />
        </FormulaPanel>

        {selectedPsm && (
          <>
            <LeadListToggle psm={selectedPsm} leads={data.leads ?? []}>
              <PsmLeadList psm={selectedPsm} leads={data.leads ?? []} deals={data.deals ?? []} mode="pre-sales" onClear={clearPsm} />
            </LeadListToggle>
            <div className="ps-incentive">
              <IncentivePolicyCard
                personName={selectedPsm}
                mode="pre-sales"
                performanceRow={data.performance?.[0] || null}
                leads={data.leads || []}
                deals={data.deals || []}
                periodLabel={(periodName ?? '').toLowerCase()}
                onClose={() => onPsm(ALL_PSM)}
              />
            </div>
          </>
        )}

        {/* The chevron conversion funnel used to sit here. It said the same thing as the card flow above,
            in a second visual language, so it was removed rather than kept in two places. */}
        <FormulaPanel title="Lead conversion funnel"><Formula entry={conversionFormula} /></FormulaPanel>

        {/* Raw leads carry no closure outcome, so the map offers lead generation only and says why. */}
        <IndiaHeatMap points={leadPoints(data.leads)} title="Where the leads came from" />
      </div>
    </div>
    </FormulaProvider>
  );
}

// One entry per city for the map, counted from the period's raw leads. The map folds spelling variants
// together itself, so the city is passed through exactly as Zoho holds it.
function leadPoints(leads = []) {
  const counts = new Map();
  leads.forEach((lead) => {
    const city = (lead.city ?? '').trim();
    if (!city || /not recorded/i.test(city)) return;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  });
  return [...counts].map(([city, count]) => ({ city, leads: count }));
}

