import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FlowDetails } from './FlowDetails.jsx';
import { Formula, FormulaPanel } from '../formula/FormulaPanel.jsx';
import { inr } from './MandateBar.jsx';
import { comparisonNote, funnelFormulas } from '../formula/formulas.js';

// Card definitions. `better` says which direction of change is good news, so colour follows meaning.
// `hint` is the Zoho status (or rule) behind the card, shown under its label.
const CARDS = {
  raw: { label: 'Raw leads', tone: 'ink', better: 'up' },
  contacted: { label: 'Contacted', tone: 'blue', better: 'up' },
  notContacted: { label: 'Not contacted', tone: 'red', better: 'down' },
  drawingAwaited: { label: 'Qualified drawing awaited', tone: 'violet', better: 'up', hint: 'Qualified / Drawings Awaited' },
  followUp: { label: 'Under follow-up', tone: 'teal', better: 'neutral', hint: 'Under follow-up · will buy in future' },
  notResponding: { label: 'Not responding', tone: 'amber', better: 'down', hint: 'No response / call back later' },
  dropped: { label: 'Dropped / dead', tone: 'grey', better: 'down', hint: 'Not interested · junk' },
  qualifiedTotal: { label: 'PSM qualified', tone: 'green', better: 'up', hint: 'Drawing awaited, plus leads already past it (drawing received or converted)' },
  toSm: { label: 'Sales qualified', tone: 'blue', better: 'up', hint: 'Qualified opportunities (Zoho Contacts) created in the period under a PSM' },
  closed: { label: 'Closed', tone: 'violet', better: 'up', hint: 'Opportunities with Client Status "Closed", by Actual Closure Date' }
};
// The four outcomes of a contacted lead, then the qualified pipeline left to right.
const OUTCOMES = ['drawingAwaited', 'followUp', 'notResponding', 'dropped'];
const PIPELINE = ['qualifiedTotal', 'toSm', 'closed'];
// Sales qualified and Closed are counted from opportunities, so their ₹ value sits beside the count.
const VALUED = new Set(['toSm', 'closed']);
const CONTACT_CARDS = VALUED;

const pct = (value) => `${(value * 100).toFixed(1)}%`;

function Delta({ node, better, previousLabel }) {
  if (!node.previous && !node.count) return <span className="lf-delta flat">No leads in either period</span>;
  if (!node.previous) return <span className="lf-delta flat"><Minus size={13} aria-hidden="true" />None in {previousLabel}</span>;
  const change = (node.count - node.previous) / node.previous;
  const direction = change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat';
  const tone = direction === 'flat' || better === 'neutral' ? 'flat' : direction === better ? 'good' : 'bad';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`lf-delta ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {direction === 'flat' ? 'No change' : `${Math.abs(change * 100).toFixed(0)}%`} vs {previousLabel} ({node.previous})
    </span>
  );
}

const statusTitle = (flow, id) => {
  const statuses = Object.entries(flow.statuses[id] ?? {}).map(([status, count]) => `${status}: ${count}`).join('\n');
  return statuses ? `Zoho statuses in this group:\n${statuses}` : undefined;
};

// One card in the line. `wires` says which connectors it draws: into it from the left, out of it to the right.
function FlowCard({ id, node, flow, onSelect, selected, size = 'md', wires = '' }) {
  const card = CARDS[id];
  const title = [card.label, card.hint, statusTitle(flow, id), 'Click to see the records below'].filter(Boolean).join('\n\n');
  return (
    <div className={`lf-node ${wires}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      <button
        type="button"
        className={`lf-card lf-${size} tone-${card.tone}${PIPELINE.includes(id) ? ' lf-key' : ''}${selected ? ' is-selected' : ''}`}
        onClick={() => onSelect(id)}
        aria-expanded={selected}
        title={title}
      >
        <span className="lf-label"><i aria-hidden="true" />{card.label}</span>
        <span className="lf-figures">
          <strong>{node.count}</strong>
          {VALUED.has(id) && <span className="lf-inline-value" title="Total opportunity value in Zoho">({node.value ? inr(node.value) : '₹0'})</span>}
          {id !== 'raw' && <em>{pct(node.share)} of raw</em>}
        </span>
        {id === 'toSm' && (
          <span className="lf-pending" title="Opportunities whose Client Status is blank or Not Yet Validated">
            {node.pending ?? 0} pending validation{node.pending === 1 ? '' : 's'}
          </span>
        )}
        {id !== 'raw' && <span className="lf-share" aria-hidden="true"><b style={{ width: `${Math.max(node.share * 100, node.count ? 2 : 0)}%` }} /></span>}
        <Delta node={node} better={card.better} previousLabel={flow.previousLabel} />
      </button>
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

// `children` render straight under the funnel (e.g. Needs action today). A clicked card opens in a popup.
// `formulaCtx` carries the period's dates for the Show Formula panels.
export function LeadFlow({ flow, leads = [], opportunities = [], formulaCtx, children }) {
  const [selected, setSelected] = useState(null);
  const close = useCallback(() => setSelected(null), []);
  if (!flow?.nodes) return null;
  const { nodes } = flow;
  const select = (id) => setSelected((current) => (current === id ? null : id));
  const card = (id, wires, size) => nodes[id] && (
    <FlowCard id={id} node={nodes[id]} flow={flow} onSelect={select} selected={selected === id} wires={wires} size={size} key={id} />
  );
  const open = selected && nodes[selected];
  const formulas = formulaCtx ? funnelFormulas(formulaCtx) : {};

  return (
    <>
      <section className="lf" aria-labelledby="lf-title">
        <h2 id="lf-title" className="lf-title">Funnel</h2>
        <div className="lf-c">{card('raw', 'has-out', 'lg')}</div>
        <div className="lf-c lf-bracket-in">
          {card('contacted', 'has-in has-out')}
          {card('notContacted', 'has-in')}
        </div>
        <div className="lf-c lf-c-outcomes lf-bracket-in lf-bracket-out">
          {OUTCOMES.map((id) => card(id, 'has-in has-out', 'sm'))}
        </div>
        <div className="lf-c">{card('qualifiedTotal', 'has-in has-out')}</div>
        <div className="lf-c">{card('toSm', 'has-in has-out')}</div>
        <div className="lf-c">{card('closed', 'has-in')}</div>
      </section>
      {formulaCtx && (
        <FormulaPanel title="Funnel">
          <p className="fx-note">{comparisonNote(formulaCtx)} Click any card to see its records; the popup shows its column formulas.</p>
          <div className="fx-grid">
            {['raw', 'contacted', 'notContacted', ...OUTCOMES, ...PIPELINE].map((id) => <Formula entry={formulas[id]} compact key={id} />)}
          </div>
        </FormulaPanel>
      )}
      {children}
      {open && (
        <FlowDetails
          card={{ id: selected, ...CARDS[selected] }}
          node={nodes[selected]}
          leads={CONTACT_CARDS.has(selected) ? opportunities : leads}
          onClose={close}
          formula={formulas[selected]}
        />
      )}
    </>
  );
}
