import { RefreshButton } from '../../shared/ui/RefreshButton.jsx';
import { ChevronDown, Lock, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IncentivePolicyCard } from '../IncentivePolicyCard.jsx';
import { PsmLeadList } from '../PsmLeadList.jsx';
import { ActionRow } from './ActionRow.jsx';
import { BoardSkeleton } from './BoardSkeleton.jsx';
import { LeadFlow } from './LeadFlow.jsx';
import { MandateBar } from './MandateBar.jsx';
import { MondayRoster } from './MondayRoster.jsx';
import { TeamTable } from './TeamTable.jsx';
import { PeriodFilter } from '../PeriodFilter.jsx';
import { PreSalesAnalytics } from '../AnalyticsPanel.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';
import IndiaHeatMap from '../IndiaHeatMap.jsx';
import { Formula, FormulaButton, FormulaPanel, useFormulaToggle, useShowFormula } from '../formula/FormulaPanel.jsx';
import { conversionFormula, mandateFormula, riskFormulas, rotaFormula, teamFormula } from '../formula/formulas.js';

const ALL_PSM = 'All PSM';

// THE BOARD'S TWO VIEWS, in the same pattern and with the same markup as the Sales board's tab bar
// (.sb-tabs, styled in sales-sections.css and already imported globally).
//
// The split is by WHAT THE NUMBER IS FOR, not by where it came from:
//   Morning review  what the team acts on in the stand-up - the roster, the mandate, the lead flow,
//                   what needs action today, per-PSM performance and a PSM's own lead list.
//   PSM health      the analysis nobody acts on in the meeting - conversion, response and calling
//                   effort, per-PSM activity, the efficiency margin, and where the leads came from.
const SECTIONS = [
  { id: 'morning-review', label: 'Morning review' },
  { id: 'psm-health', label: 'PSM health' }
];
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
// The freshness stamp carries its DATE as well as its time. "updated 10:27 am" on its own is
// ambiguous the moment a tab is left open overnight or a saved payload is served — it reads as this
// morning whether the data is an hour or a week old.
const timeOf = (date) => date && [
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
].join(', ');

export { RefreshButton } from '../../shared/ui/RefreshButton.jsx';
/** Today, as the team writes it: "Tue, 30 Sept 2026". Always IST, whatever the browser is set to. */
const todayLabel = () => new Date().toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  // en-IN renders "Wed, 30 Sept, 2026" - the comma before the year is noise, and the team writes it
  // without. The weekday's own comma is kept.
}).replace(/,\s*(\d{4})$/, ' $1');


export function PreSalesBoard({ state, timeframe, onTimeframe, psm, onPsm, selectedDetail, onDetail, onOpen }) {
  const { data, error, loading, refreshing, stale, fetchedAt, refresh } = state;
  const [section, setSection] = useState(SECTIONS[0].id);
  const isHealth = section === 'psm-health';
  // The twelve-month trend is only read while PSM health is on screen. It is a second endpoint, and
  // the stand-up opens on Morning review - paying for it on every load would cost every user a read
  // that most of them never look at.
  const trend = useDashboard({ timeframe, psm }, '/api/presales-trend', Boolean(data) && isHealth);
  // The switch itself now lives in the app shell so every board shares it; this board reads it
  // from the context and keeps its own button, which sits in its own header rather than the
  // shared BoardHeader.
  const showFormula = useShowFormula();
  // TODAY, in the header. Ticked every minute rather than read once, because this board is left open
  // all day and frequently overnight - a date that silently goes stale is the exact problem the
  // dated freshness stamp below it was added to solve.
  const [today, setToday] = useState(() => todayLabel());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayLabel()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const toggleFormula = useFormulaToggle();

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
    <div className={`ps${loading ? ' is-refreshing' : ''}`}>
      <header className="ps-head">
        <div>
          <h1>PSM Monitoring Review</h1>
          <p className="ps-sub">
            {/* The period range used to sit here. It is dropped: the period buttons to the right
                already say which period is selected, and the date that matters on this line is when
                the data was last read, which the source stamp below now carries. */}
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

        <div className="ps-right">
          <p className="ps-today" aria-label={`Today is ${today}`}>{today}</p>
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
        </div>
      </header>

      <div className="sb-tabs" role="tablist" aria-label="PSM views">
        {SECTIONS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            role="tab"
            aria-selected={section === entry.id}
            onClick={() => setSection(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {meta.notice && <p className="ps-notice">{meta.notice}</p>}
      {error && <p className="ps-notice" role="alert">{error} Showing the last loaded data.</p>}

      {selectedDetail && (
        <div className="ps-detail" role="status">
          <strong>{selectedDetail}</strong>
          <button type="button" onClick={() => onDetail('')} aria-label="Dismiss filter notice"><X size={15} /></button>
        </div>
      )}

      <div className="ps-body">
        {/* ---- MORNING REVIEW ---------------------------------------------------------------- */}
        {!isHealth && <>
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
          <TeamTable leads={data.leads ?? []} rows={data.performance ?? []} onPsm={onPsm} onDetail={onDetail} />
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

        </>}

        {/* ---- PSM HEALTH ------------------------------------------------------------------- */}
        {/* Everything here answers "how is pre-sales doing", not "what do we do this morning". The
            analytics panel carries conversion, health, PSM activity and the efficiency margin; the
            map and the conversion formula are the same kind of question, so they moved here with it
            rather than being left behind on a board they no longer belonged to. */}
        {isHealth && <>
        <PreSalesAnalytics analytics={data.analytics} trend={trend} />

        {/* The chevron conversion funnel used to sit here. It said the same thing as the card flow on
            Morning review, in a second visual language, so it was removed rather than kept twice. */}
        <FormulaPanel title="Lead conversion funnel"><Formula entry={conversionFormula} /></FormulaPanel>

        {/* Raw leads carry no closure outcome, so the map offers lead generation only and says why. */}
        <IndiaHeatMap points={leadPoints(data.leads)} title="Where the leads came from" />
        </>}
      </div>
    </div>
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

