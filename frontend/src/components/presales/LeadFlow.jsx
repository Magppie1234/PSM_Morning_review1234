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
// Short form for the wire label, where every pixel is fought for between the bracket rail
// and the card: a trailing ".0" carries no information, and dropping it keeps "100.0%" —
// the widest figure a share can produce — from crowding the rail. The card and the tooltip
// keep the full form, so the two never disagree about the value.
const shortPct = (value) => pct(value).replace(/\.0%$/, '%');

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

// ---- DEL / HYD / Others -------------------------------------------------------------
// The one implementation of the city split, rendered by all four funnels so the treatment
// cannot drift between boards. The look lives in .lf-cities in leadflow.css.
//
// A card is a <button>, so these cells cannot be nested inside it: the caller renders this
// strip as a sibling of the card inside the same .lf-node and puts `lf-card-top` on the
// card, which squares off its bottom and lends its border to the strip as the seam.
const CITY_TAGS = { delhi: 'DEL', del: 'DEL', hyderabad: 'HYD', hyd: 'HYD', other: 'OTH', others: 'OTH' };

// Three letters, because that is what the cell is wide enough to hold — see the note on
// .lf-cities in leadflow.css. The full label is never dropped, only moved to the tooltip
// and the spoken name.
const cityTag = (city) =>
  CITY_TAGS[String(city.key ?? '').toLowerCase()]
  || String(city.label ?? '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  || '—';

// The figure as the CELL prints it, which is not how the rest of the board prints numbers.
// A third of a small card is 26px of usable width at 1181px, so the Indian grouping comma is
// dropped (it costs a whole glyph and says nothing a reader of a 4-digit count needs) and
// five figures or more round to thousands. Four glyphs is the ceiling either way, which is
// what the step-down in .lf-city[data-len] is sized against. The exact, grouped figure is
// always in the tooltip and the spoken name — see `said` below — so nothing is lost.
const cellFigure = (count) => (count < 10000 ? String(count) : `${Math.round(count / 1000)}k`);

/**
 * The card's Delhi / Hyderabad / Others split, three cells under the figure.
 *
 * @param {Array}    props.cities      the API's `byCity`: [{ key, label, count, valueLabel, ids }]
 * @param {string}   props.groupId     the parent card's id, so a cell's id is unique on the board
 * @param {string}   props.groupLabel  the parent card's label, so a cell says what it is a split of
 * @param {string}   [props.unit]      what a record is called here — lead, order, record
 * @param {Function} [props.onOpen]    the funnel's own onOpen({ id, label, ids }) contract
 *
 * Renders nothing at all when the card arrives without a `byCity`, rather than three zeros.
 */
export function CityCells({ cities, groupId, groupLabel, unit = 'record', onOpen }) {
  if (!Array.isArray(cities) || cities.length === 0) return null;
  return (
    <div className="lf-cities">
      <span className="lf-cities-h" aria-hidden="true">By city</span>
      <ul className="lf-cities-row" aria-label={`${groupLabel} by city`}>
        {cities.map((city) => {
          const count = city.count ?? 0;
          const figure = cellFigure(count);
          const label = `${groupLabel} · ${city.label}`;
          // The money (or square feet) and the count are spoken even though the cell shows
          // only the figure, so a screen reader is never told less than the board knows.
          const said = [
            count ? `${count.toLocaleString('en-IN')} ${unit}${count === 1 ? '' : 's'}` : `no ${unit}s`,
            city.valueLabel
          ].filter(Boolean).join(', ');
          return (
            <li key={city.key}>
              <button
                type="button"
                className={`lf-city${count ? '' : ' is-zero'}`}
                // A third of a small card holds two glyphs at full size; longer figures step
                // down a notch rather than overflow. See .lf-city[data-len] in leadflow.css.
                data-len={Math.min(figure.length, 4)}
                onClick={() => count && onOpen?.({ id: `${groupId}-${city.key}`, label, ids: city.ids ?? [] })}
                aria-disabled={count ? undefined : true}
                aria-label={count ? `Open ${label}: ${said}` : `${label}: ${said}`}
                title={`${city.label}\n${said}${count ? '\nClick to see the records' : ''}`}
              >
                <strong>{figure}</strong>
                <b aria-hidden="true">{cityTag(city)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const statusTitle = (flow, id) => {
  const statuses = Object.entries(flow.statuses[id] ?? {}).map(([status, count]) => `${status}: ${count}`).join('\n');
  return statuses ? `Zoho statuses in this group:\n${statuses}` : undefined;
};

// The route a lead takes when everything goes right: arrived, contacted, qualified, handed to sales, closed.
// Those wires are drawn in the accent colour so the intended path reads at a glance against the branches.
const MAIN_PATH = new Set(['raw', 'contacted', 'drawingAwaited', 'qualifiedTotal', 'toSm', 'closed']);

// One card in the line. `wires` says which connectors it draws: into it from the left, out of it to the right.
function FlowCard({ id, node, flow, onSelect, onSelectCity, selected, size = 'md', wires = '' }) {
  const card = CARDS[id];
  const cities = node.byCity;
  const hasCities = Array.isArray(cities) && cities.length > 0;
  // Everything except the first card is a share of raw. The short form rides the wire that
  // points at the card; the long form stays in the card (visually hidden on desktop) and in
  // the tooltip, so the basis is never ambiguous. See lf-wire-share in leadflow.css.
  const shareText = id === 'raw' ? null : `${pct(node.share)} of raw`;
  const title = [card.label, card.hint, shareText, statusTitle(flow, id), 'Click to see the records below']
    .filter(Boolean)
    .join('\n\n');
  return (
    <div className={`lf-node ${wires}${MAIN_PATH.has(id) ? ' lf-main' : ''}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      {shareText && <b className="lf-wire-share" aria-hidden="true">{shortPct(node.share)}</b>}
      <button
        type="button"
        className={`lf-card lf-${size} tone-${card.tone}${PIPELINE.includes(id) ? ' lf-key' : ''}${hasCities ? ' lf-card-top' : ''}${selected ? ' is-selected' : ''}`}
        onClick={() => onSelect(id)}
        aria-expanded={selected}
        title={title}
      >
        <span className="lf-label"><i aria-hidden="true" />{card.label}</span>
        <span className="lf-figures">
          <strong>{node.count}</strong>
          {VALUED.has(id) && <span className="lf-inline-value" title="Total opportunity value in Zoho">({node.value ? inr(node.value) : '₹0'})</span>}
          {shareText && <em className="lf-inline-share">{shareText}</em>}
        </span>
        {id === 'toSm' && (
          <span className="lf-pending" title="Opportunities whose Client Status is blank or Not Yet Validated">
            {node.pending ?? 0} pending validation{node.pending === 1 ? '' : 's'}
          </span>
        )}
        {id !== 'raw' && <span className="lf-share" aria-hidden="true"><b style={{ width: `${Math.max(node.share * 100, node.count ? 2 : 0)}%` }} /></span>}
        <Delta node={node} better={card.better} previousLabel={flow.previousLabel} />
      </button>
      <CityCells
        cities={cities}
        groupId={id}
        groupLabel={card.label}
        unit={CONTACT_CARDS.has(id) ? 'opportunity' : 'lead'}
        onOpen={(pick) => onSelectCity(id, pick)}
      />
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

// `children` render straight under the funnel (e.g. Needs action today). A clicked card opens in a popup.
// `formulaCtx` carries the period's dates for the Show Formula panels.
export function LeadFlow({ flow, leads = [], opportunities = [], formulaCtx, children }) {
  // What the popup is showing: `key` is what a second click closes, `cardId` is which card's
  // columns and formula to use (a city cell keeps its parent card's), and `node` is the set of
  // records — the card's own, or the city bucket's.
  const [selected, setSelected] = useState(null);
  const close = useCallback(() => setSelected(null), []);
  if (!flow?.nodes) return null;
  const { nodes } = flow;
  const select = (id) =>
    setSelected((current) => (current?.key === id ? null : { key: id, cardId: id, label: CARDS[id].label, node: nodes[id] }));
  // A city cell opens the same popup, narrowed to the ids the backend sent for that bucket.
  // The bucket is the count, so the popup's "n of m" counts the city and not the whole card.
  const selectCity = (cardId, pick) =>
    setSelected((current) => (current?.key === pick.id
      ? null
      : { key: pick.id, cardId, label: pick.label, node: { ...nodes[cardId], ids: pick.ids, count: pick.ids.length } }));
  const card = (id, wires, size) => nodes[id] && (
    <FlowCard
      id={id}
      node={nodes[id]}
      flow={flow}
      onSelect={select}
      onSelectCity={selectCity}
      selected={selected?.key === id}
      wires={wires}
      size={size}
      key={id}
    />
  );
  const formulas = formulaCtx ? funnelFormulas(formulaCtx) : {};

  return (
    <>
      {/* Six columns, so the wire labels use the dense tier — see lf-wire-share in
          leadflow.css. Below its floor the shares drop back inside the cards. */}
      <section className="lf lf-wire-labels lf-wire-labels-dense" aria-labelledby="lf-title">
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
      {selected && (
        // Keyed on the selection, so moving from the card to one of its city cells (or between
        // cells) remounts the popup and resets its search, sort and source filter — those are
        // keyed on card.id inside, which a city cell deliberately does not change.
        <FlowDetails
          key={selected.key}
          card={{ ...CARDS[selected.cardId], id: selected.cardId, label: selected.label }}
          node={selected.node}
          leads={CONTACT_CARDS.has(selected.cardId) ? opportunities : leads}
          onClose={close}
          formula={formulas[selected.cardId]}
        />
      )}
    </>
  );
}
