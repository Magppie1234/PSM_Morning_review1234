import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCallback } from 'react';
// The Delhi / Hyderabad / Others cells, shared with the Pre Sales and the two Sales funnels
// so the split reads the same on every card of every board.
import { CityCells } from '../presales/LeadFlow.jsx';
import { Formula, FormulaPanel } from '../formula/FormulaPanel.jsx';

// The Design board's pre-design funnel, drawn as the PSM board's Funnel: one connected line of cards
// with elbow wires, rendering LeadFlow's own .lf- markup and classes exactly as the Sales board's
// Sales performance section does. Nothing in leadflow.css is forked; pre-design.css only adds the
// column count, the count figure and the per-card note.
//
//   Total new requests ─┬─ Designer assigned ──────────┬─ Under design ─┬─ Sent for ─ Revision ─ Revision ─ Order ─ Handover
//        from sales     └─ Designer assignment pending ┴─ Query to SM ──┘  approval   requested    done     booked  to design
//
// Two of the columns hold a PAIR of cards joined by the bracket rail, and each pair PARTITIONS the
// card before it: every request is either assigned to a designer or waiting for one, and every
// request either had a query raised to the sales manager or did not. Either pair therefore adds back
// to the requests card, which is what the bracket means and why both halves carry a share.
//
// EVERY CARD IS A COUNT OF ORDERS. Only "Order booked" also shows rupees, and that is deliberate:
// Deals.Amount is empty on all 7,591 records in the module, and Deals.Value — the field that is
// filled — fills as the order is booked. Putting money on any earlier card would print ₹0 for work
// that is real. The board used to be measured in square feet throughout; that figure now lives in
// the popup's own column, where a blank is visible as a blank.
//
// One thing to know if you are reading the numbers rather than this file: this is a COHORT. Every
// card counts orders CREATED in the selected period and says where they stand today, so "Order
// booked" and "Handover to design" read near zero on a short period — an order raised this month has
// not had time to get there. That is the honest shape, and it is the same convention as the Sales
// board's S1–S5 ladder.
//
// Every figure comes from the API as-is. The only derived numbers are the shares, which the API sends
// on each card (`share`) against the one denominator named below.

// `better` says which direction of change is good news, so the delta's colour follows meaning.
// Assignment pending and Query to SM are the two cards where MORE is worse: both are work sitting
// still. Revision requested is the same — nobody wants more revisions asked for.
const TONES = {
  requests: { tone: 'ink', better: 'up' },
  designerAssigned: { tone: 'blue', better: 'up' },
  assignmentPending: { tone: 'amber', better: 'down' },
  underDesign: { tone: 'green', better: 'up' },
  queryToSm: { tone: 'red', better: 'down' },
  sentForApproval: { tone: 'teal', better: 'up' },
  revisionRequested: { tone: 'amber', better: 'down' },
  revisionDone: { tone: 'green', better: 'up' },
  orderBooked: { tone: 'violet', better: 'up' },
  handover: { tone: 'teal', better: 'up' }
};

// What each card claims, in the words of the Zoho field behind it. These are tooltips and spoken
// text, never decoration: the whole chain is built out of a snapshot Stage picklist plus a handful of
// sparsely filled boxes, so a card that does not say what it read cannot be checked.
const ABOUT = {
  requests: 'Orders created in this period that sales sent to design: the order carries a designer, a '
    + 'design date, a design presentation or a revision count, or its stage shows design work under way. '
    + 'Legacy orders imported straight into post-design carry none of those and are left out.',
  designerAssigned: 'Designer Name is filled on the order in Zoho.',
  assignmentPending: 'Sales has sent the request in but no Designer Name is on the order yet.',
  underDesign: 'A request with no query raised to the sales manager — the work sits with design. '
    + 'This card and Query to SM split the requests card between them.',
  queryToSm: 'The "Query to SM" box on the order is filled, or the order is parked at the Query to SM '
    + 'stage: design went back to the sales manager for something.',
  sentForApproval: 'A design has gone out: a Send For Approval Date or a Design Presentation on the '
    + 'order, or a stage at "Sent for Approval" or past it.',
  revisionRequested: 'A revision was asked for: a revision count, a revision type, a reason for '
    + 'revision, or the order sitting on a revision stage. Four signals, because none of them on its '
    + 'own is filled often enough to trust.',
  revisionDone: 'The order carried a revision, is no longer sitting on a revision stage, and has since '
    + 'gone back out or been approved.',
  orderBooked: 'Stage at "Order Booked" or past it. The rupee figure is Deals.Value, which fills as the '
    + 'order is booked — the only money field filled anywhere in the module.',
  handover: 'The order has left design for post-design — stage at "Assign Post - Designer" or beyond, '
    + 'or a Handover Date set.'
};

const pct = (value) => `${(value * 100).toFixed(1)}%`;
// The wire label's form. The shared gutter in leadflow.css is sized for the widest figure this rule can
// produce, so the redundant trailing ".0" has to go — "100%", never "100.0%".
const shortPct = (value) => pct(value).replace(/\.0%$/, '%');

// THE DENOMINATOR, and it is the same one for every share on this chain: the requests card. Both
// pairs partition it, and every later card is a subset of it, so each share is a real proportion of a
// real set and the eight figures can be compared with each other.
const SHARE_BASIS = 'of new requests';

// Indian grouping throughout, so "1,397 orders" on one card cannot sit beside "4,497 leads" on another
// in a different notation.
const plural = (count, word) => `${count.toLocaleString('en-IN')} ${word}${count === 1 ? '' : 's'}`;

// The "vs last period" line, worded and coloured the same way the PSM funnel words it. A card with no
// comparison in the payload simply goes without one rather than showing an invented zero.
function Delta({ node, better, previousLabel }) {
  if (node?.previous === undefined || !previousLabel) return null;
  const count = node.count ?? 0;
  if (!node.previous && !count) return <span className="lf-delta flat">No orders in either period</span>;
  if (!node.previous) return <span className="lf-delta flat"><Minus size={13} aria-hidden="true" />None in {previousLabel}</span>;
  const change = (count - node.previous) / node.previous;
  const direction = change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat';
  const tone = direction === 'flat' || better === 'neutral' ? 'flat' : direction === better ? 'good' : 'bad';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`lf-delta ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {direction === 'flat' ? 'No change' : pct(Math.abs(change))} vs {previousLabel} ({node.previous.toLocaleString('en-IN')})
    </span>
  );
}

// The four wires LeadFlow draws around every card; the column type decides which show.
// `share` puts the short figure on the incoming wire, so the eye reads arrow → figure → card — the
// shared `lf-wire-labels` treatment in leadflow.css, opted into on the section. It is decoration and
// aria-hidden; the long form with its basis stays inside the card, where leadflow visually hides it
// while the wire label is on and shows it again below the breakpoint. Never forked here.
function Node({ wires = 'has-in has-out', share, children }) {
  return (
    <div className={`lf-node ${wires}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      {share != null && <b className="lf-wire-share" aria-hidden="true">{shortPct(share)}</b>}
      {children}
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

/**
 * One card on the line: a count of orders, and on Order booked the rupee total beside it.
 * `node.note` is the figure-specific caveat the API sends with the data; ABOUT[id] is the standing
 * one about what the card counts. Both are on the tooltip and in the spoken name, so a screen reader
 * is never told less than the screen says. A card with no orders keeps its shape and its place in the
 * tab order but opens nothing.
 */
function FlowCard({ node, id, label, tone, better, size = 'md', extra = '', previousLabel, onOpen }) {
  const count = node?.count ?? 0;
  const empty = count === 0;
  const note = node?.note;
  const about = ABOUT[id];
  // Money rides along only where the API sent it, which is the Order booked card and its city rows —
  // and only when the card has something in it. A card with no orders printing "₹0" reads as a
  // booked order worth nothing, rather than as no booked orders.
  const money = count > 0 ? node?.valueLabel ?? null : null;
  // The long form, basis and all. It goes in three places on purpose: inside .lf-figures (where
  // leadflow visually hides it while the wire label is showing, so it stays in the accessible name
  // and returns as the visible copy below the breakpoint), in the tooltip, and in the explicit
  // aria-label — which overrides content, so without it the share would be lost to a screen reader.
  const shareText = !empty && node?.share != null ? `${pct(node.share)} ${SHARE_BASIS}` : null;
  // The live queue, sent by the API on every dated card. Absent on the cards that have no stage of
  // their own (requests, revision done), and absent entirely if the stage ledger could not be read.
  const sitting = typeof node?.sitting === 'number' ? node.sitting : null;
  const ariaLabel = [
    empty ? `${label}: no orders in this period` : `Open the ${plural(count, 'order')} in ${label}`,
    money && !empty ? `worth ${money}` : null,
    sitting != null ? `${plural(sitting, 'order')} sitting here now` : null,
    shareText,
    note
  ].filter(Boolean).join('. ');
  const title = [label, shareText, about, note, empty ? 'No orders in this period' : 'Click to see the orders']
    .filter(Boolean).join('\n');

  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id, label, ids: node?.ids ?? [] });
  }, [empty, onOpen, id, label, node]);

  return (
    <button
      type="button"
      className={`lf-card lf-${size} tone-${tone}${extra ? ` ${extra}` : ''}${empty ? ' pd-empty' : ''}`}
      onClick={click}
      aria-disabled={empty || undefined}
      aria-label={ariaLabel}
      title={title}
    >
      <span className="lf-label"><i aria-hidden="true" />{label}</span>
      <span className="lf-figures">
        {/* The count leads on every card, because every card is a count of orders. */}
        <strong className="pd-fade" key={count}>{count.toLocaleString('en-IN')}</strong>
        <span className="pd-orders">{count === 1 ? 'order' : 'orders'}</span>
        {/* The one exception on the chain: money, and only where the API sent it. */}
        {money && <em className="pd-money">{money}</em>}
        {/* Required by the lf-wire-labels contract and not a duplicate of the wire label: leadflow
            visually hides this copy (it stays in the accessible name) while the label is on, and
            shows it here once the wires go. Exactly one of the two is ever visible. */}
        {shareText && <em className="lf-inline-share">{shareText}</em>}
        {/* THE SECOND FIGURE. The count above is flow: orders that entered this stage during the
            selected period. This is stock: how many are sitting on the stage right now, whatever
            period is chosen. Both are needed - flow says what happened, stock says what is waiting -
            and they are deliberately different numbers, so the label says which is which. */}
        {sitting != null && <em className="pd-sitting">{sitting.toLocaleString('en-IN')} here now</em>}
      </span>
      {!empty && node?.share != null && (
        <span className="lf-share" aria-hidden="true"><b style={{ width: `${Math.max(node.share * 100, 2)}%` }} /></span>
      )}
      <Delta node={node} better={better} previousLabel={previousLabel} />
    </button>
  );
}

// A card carrying a city split squares off its bottom, so the shared .lf-cities strip below it merges
// into the same shape.
const topOf = (node) => (node?.byCity?.length ? 'lf-card-top' : '');

/**
 * The pre-design funnel on the Design board.
 *
 * @param {object}   props.data           the `preDesign` object from GET /api/pre-design-funnel
 * @param {string}   [props.previousLabel] what the deltas are measured against; defaults to
 *                                        `data.previousLabel`, which the API words for the period
 * @param {boolean}  [props.loading]      true while the API is being re-read — the numbers already on
 *                                        screen stay put and dim, never a spinner, never an unmount
 * @param {Function} [props.onOpen]       called with { id, label, ids } to open the orders popup,
 *                                        the same contract SalesPerformance uses
 */
export function PreDesignFlow({ data, previousLabel, loading, onOpen }) {
  if (!data?.requests) return null;
  const since = previousLabel ?? data.previousLabel ?? null;

  // One card, with its city strip under it. Every column on this flow is built from this, so a card
  // cannot pick up a different treatment by being written out twice.
  const cell = (id, wires, size = 'md') => {
    const node = data[id];
    if (!node) return null;
    return (
      <Node wires={wires} share={node.count ? node.share : null} key={id}>
        <FlowCard
          node={node}
          id={id}
          label={node.label}
          tone={TONES[id].tone}
          better={TONES[id].better}
          size={size}
          extra={topOf(node)}
          previousLabel={since}
          onOpen={onOpen}
        />
        <CityCells cities={node.byCity} groupId={id} groupLabel={node.label} unit="order" onOpen={onOpen} />
      </Node>
    );
  };

  return (
    <section
      // The wire labels take the STANDARD tier, not the dense one: this flow narrows the shared
      // gutter to 44px (see pre-design.css), so it does not need the dense tier's 1400px floor to
      // pay for it — the labels come on at 1181px with every other funnel's.
      className={`lf pd-lf lf-wire-labels${loading ? ' is-stale' : ''}`}
      aria-labelledby="pd-title"
      aria-busy={loading || undefined}
    >
      <h2 id="pd-title" className="lf-title">Pre-design funnel</h2>

      {/* Show Formula. Each card's formula is sent by the API, generated from the same stage config
          the counting used, so this panel cannot describe a rule the numbers did not follow. */}
      <FormulaPanel title="Pre-design funnel">
        {Object.values(data)
          .filter((node) => node && node.formula)
          .map((node) => <Formula entry={node.formula} compact key={node.key} />)}
      </FormulaPanel>

      {/* Eight columns, all on screen: the width comes out of the gutter and the card padding, not
          out of a scrollbar. The measurements are in pre-design.css. */}
      <div className="pd-track">
        {/* 1 · the head of the chain: how many requests sales sent in. */}
        <div className="lf-c">{cell('requests', 'has-out', 'lg')}</div>

        {/* 2 · assigned or waiting — the pair partitions the card before it, which is what the
               bracket rail between them says. */}
        <div className="lf-c lf-bracket-in lf-bracket-out">
          {cell('designerAssigned', 'has-in has-out', 'sm')}
          {cell('assignmentPending', 'has-in has-out', 'sm')}
        </div>

        {/* 3 · with design, or back with the sales manager — the same partition again. */}
        <div className="lf-c lf-bracket-in lf-bracket-out">
          {cell('underDesign', 'has-in has-out', 'sm')}
          {cell('queryToSm', 'has-in has-out', 'sm')}
        </div>

        {/* 4 to 8 · the single chain both pairs feed into. */}
        <div className="lf-c">{cell('sentForApproval', 'has-in has-out')}</div>
        <div className="lf-c">{cell('revisionRequested', 'has-in has-out')}</div>
        <div className="lf-c">{cell('revisionDone', 'has-in has-out')}</div>
        <div className="lf-c">{cell('orderBooked', 'has-in has-out')}</div>
        <div className="lf-c">{cell('handover', 'has-in')}</div>
      </div>

    </section>
  );
}
