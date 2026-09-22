import { ChevronDown, Lock, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { IncentivePolicyCard } from '../IncentivePolicyCard.jsx';
import { PsmLeadList } from '../PsmLeadList.jsx';
import { ActionRow } from './ActionRow.jsx';
import { BoardSkeleton } from './BoardSkeleton.jsx';
import { PreSalesFunnel } from './PreSalesFunnel.jsx';
import { GroupedQueue } from './GroupedQueue.jsx';
import { LeadFlow } from './LeadFlow.jsx';
import { MandateBar } from './MandateBar.jsx';
import { MondayRoster } from './MondayRoster.jsx';
import { TeamTable } from './TeamTable.jsx';
import { PeriodFilter } from '../PeriodFilter.jsx';
import { Formula, FormulaButton, FormulaPanel, FormulaProvider, useFormulaSwitch } from '../formula/FormulaPanel.jsx';
import { conversionFormula, mandateFormula, queueFormula, riskFormulas, rotaFormula, teamFormula } from '../formula/formulas.js';

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

export function PreSalesBoard({ state, timeframe, onTimeframe, psm, onPsm, selectedDetail, onDetail, onOpen }) {
  const { data, error, loading, fetchedAt } = state;
  const [showFormula, toggleFormula] = useFormulaSwitch();

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return (
      <div className="screen-message error">
        {error || 'Dashboard data could not be loaded.'}
        <span>Make sure the backend is running on port 4010.</span>
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
          <h1>PSM Morning Review</h1>
          <p className="ps-sub">
            <span>{range ?? periodName}</span>
            <span title="Leads owned by Deepak, Ishita, Sowmya and Sparshan, including converted ones">PSM team leads, incl. converted</span>
            {meta.isDemo ? (
              <span className="ps-source demo">Demo data · CRM integration pending</span>
            ) : (
              <span className="ps-source live">
                <i aria-hidden="true" />
                Live from Zoho CRM{fetchedAt ? ` · updated ${timeOf(fetchedAt)}` : ''}
              </span>
            )}
            {loading && (
              <span className="ps-refreshing" role="status">
                <RefreshCw size={13} aria-hidden="true" /> Updating
              </span>
            )}
          </p>
        </div>

        <div className="ps-controls">
          <PeriodFilter value={timeframe} onChange={onTimeframe} />
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

        <div className="ps-split">
          <TeamTable rows={data.performance ?? []} onPsm={onPsm} onDetail={onDetail} />
          <GroupedQueue rows={data.decisions ?? []} onOpen={onOpen} />
        </div>
        <FormulaPanel title="PSM performance and decision queue">
          <Formula entry={teamFormula} />
          <Formula entry={queueFormula} compact />
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

        <PreSalesFunnel stages={data.funnel ?? []} periodName={periodName} onOpen={onOpen} />
        <FormulaPanel title="Lead conversion funnel"><Formula entry={conversionFormula} /></FormulaPanel>
      </div>
    </div>
    </FormulaProvider>
  );
}
