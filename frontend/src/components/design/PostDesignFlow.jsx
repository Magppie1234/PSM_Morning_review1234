import { Info, X } from 'lucide-react';
import { useCallback, useState } from 'react';
// The Delhi / Hyderabad / Others cells, shared with the Pre Sales, Sales and pre-design funnels
// so the split reads the same on every card of every board.
import { CityCells } from '../presales/LeadFlow.jsx';

// The Post Design queue on the Design board, drawn as the same connected chain of cards the other
// three funnels use — LeadFlow's own .lf- markup and classes, nothing in leadflow.css forked.
//
//   Handover → First visit → EP prep → EP approval → EP marking visits → Production prep → PDI
//   → Payment pending → Sent to factory
//
// THIS IS A PARTITION, NOT A FUNNEL, and that is the one thing to understand before reading it. An
// order sits at exactly one Zoho stage, so it appears on exactly one card and in exactly one of that
// card's sub-cards. The nine cards add back to the whole queue; each card's sub-cards add back to
// the card. Nothing converts into anything.
//
// That is why there are NO percentages on the arrows here, unlike the pre-design funnel. On a funnel
// a figure on the wire means "this share got through". On a partition it would mean nothing at all —
// "Handover 301 → 5% → First visit 15" would invite the reader to conclude that 95% of handovers are
// lost, when the truth is that 301 orders are sitting at handover right now. Each card instead
// carries its share OF THE QUEUE inside it, which is the only honest denominator for a partition.
//
// The board is also NOT filtered by the period buttons above it. Every post-design date field in
// Zoho is empty, so there is nothing to filter on and Stage carries no date — the info panel spells
// this out with the evidence. See the long note at the top of backend/src/services/postDesignFunnel.js.

// `tone` follows the chain, and the two cards that mean "something is waiting" take the warning
// colours: an order parked at handover or at payment is a queue, not progress.
const TONES = {
  handover: 'blue',
  firstVisit: 'teal',
  epPrep: 'violet',
  epApproval: 'green',
  epMarking: 'teal',
  productionPrep: 'violet',
  pdi: 'green',
  payment: 'amber',
  factory: 'ink'
};

const plural = (count, word) => `${count.toLocaleString('en-IN')} ${word}${count === 1 ? '' : 's'}`;
const pct = (value) => `${(value * 100).toFixed(1)}%`.replace(/\.0%$/, '%');

/**
 * One sub-card: Requested / Planned / Done, or Pending / Approved. A sibling of the card button
 * rather than a child of it, because nested buttons are invalid HTML. The row opens the same popup
 * the card does, narrowed to its own orders.
 */
function SubRow({ row, group, groupId, onOpen }) {
  const count = row?.count ?? 0;
  const empty = count === 0;
  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: `${groupId}-${row.key}`, label: `${group} · ${row.label}`, ids: row?.ids ?? [] });
  }, [empty, onOpen, row, group, groupId]);

  return (
    <li>
      <button
        type="button"
        className={`po-row${empty ? ' po-empty' : ''}`}
        onClick={click}
        aria-disabled={empty || undefined}
        aria-label={empty
          ? `${group} · ${row.label}: no orders`
          : `Open the ${plural(count, 'order')} in ${group} · ${row.label}`}
        title={empty ? `${row.label}\nNo orders here` : `${row.label}\nClick to see the orders`}
      >
        <span className="po-row-name">{row.label}</span>
        <strong>{count.toLocaleString('en-IN')}</strong>
      </button>
    </li>
  );
}

/**
 * One card on the chain, carrying BOTH figures.
 *
 * FLOW is the headline: how many orders entered this stage during the selected period, off
 * DealHistory. STOCK is the second figure: how many sit there right now, whatever period is chosen.
 * They answer different questions — "what moved" against "what is on our desk" — and the board shows
 * both rather than leaving the reader to guess which one a bare number is.
 *
 * `unit` is "visit" on the three visit milestones, so the card reads "22 visits" rather than the
 * generic "22 orders" — the bracket the customer asked for on First visit.
 */
function FlowCard({ node, share, onOpen }) {
  const count = node?.count ?? 0;
  const empty = count === 0;
  const unit = node?.unit ?? 'order';
  const flow = node?.basis !== 'sitting';
  const sitting = node?.sitting ?? 0;
  const shareText = !empty && share != null
    ? `${pct(share)} of the ${flow ? 'period' : 'queue'}`
    : null;
  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: node.key, label: node.label, ids: node?.ids ?? [] });
  }, [empty, onOpen, node]);

  return (
    <button
      type="button"
      className={`lf-card lf-md tone-${TONES[node.key]} lf-card-top${empty ? ' po-empty' : ''}`}
      onClick={click}
      aria-disabled={empty || undefined}
      aria-label={empty
        ? `${node.label}: no orders on this stage`
        : `Open ${node.label}: ${plural(count, unit)} on this stage${shareText ? `, ${shareText}` : ''}`}
      title={[
        node.label,
        `${plural(count, unit)} on this stage right now`,
        // `entered` used to live here, from the period-flow version of this card. The board was
        // then made strictly current-stage, the variable went, and this line kept referencing it —
        // which threw "entered is not defined" and blanked the whole Post Design board on render.
        sitting !== count ? `${plural(sitting, 'order')} sitting there now` : null,
        shareText,
        empty ? 'Nothing on this stage' : 'Click to see the orders'
      ].filter(Boolean).join('\n')}
    >
      <span className="lf-label"><i aria-hidden="true" />{node.label}</span>
      <span className="lf-figures">
        <strong className="po-fade" key={count}>{count.toLocaleString('en-IN')}</strong>
        <span className="po-unit">{count === 1 ? unit : `${unit}s`}</span>
      </span>
      {/* Which of the two figures the headline is. Said on every card, because a number that moves
          with the period buttons and one that does not must never look alike. */}
      <em className="po-basis">{flow ? 'entered this period' : 'sitting now'}</em>
      {sitting !== count && (
        <span className="po-stock"><b>{sitting.toLocaleString('en-IN')}</b> sitting here now</span>
      )}
      {shareText && <em className="po-share">{shareText}</em>}
    </button>
  );
}

/**
 * The "i" panel. Everything on it is data the API sends on `meta.coverage` — nothing is written into
 * the component — so it stays true if the CRM starts being filled in. It exists because the board
 * reads mostly empty and the reason is a CRM-hygiene problem, not a dashboard problem: this is the
 * page to put in front of whoever owns that.
 */
function InfoPanel({ coverage, onClose }) {
  if (!coverage) return null;
  return (
    <div className="po-info" role="region" aria-label="Where these numbers come from">
      <button type="button" className="po-info-close" onClick={onClose} aria-label="Close this panel">
        <X size={15} aria-hidden="true" />
      </button>
      <h3>Where these numbers come from</h3>
      <p>
        Every card here is read off <strong>Stage</strong> in Zoho — {coverage.source}.
      </p>
      <p>
        Zoho already models this workflow properly: each milestone has an{' '}
        <strong>open / received / done</strong> triplet, which is exactly the requested / planned /
        done split on these cards, with dates attached. Checked across{' '}
        <strong>all {coverage.checkedOrders?.toLocaleString('en-IN')} orders</strong> in the module,
        back to {coverage.checkedSince}, <strong>every one of those fields is empty</strong>:
      </p>
      <ul className="po-info-fields">
        {(coverage.emptyFields ?? []).map((field) => <li key={field}><code>{field}</code></li>)}
      </ul>
      {(coverage.partial ?? []).length > 0 && (
        <p className="po-info-partial">
          Barely filled:{' '}
          {coverage.partial.map((entry, index) => (
            <span key={entry.field}>
              {index > 0 && ', '}<code>{entry.field}</code> ({entry.filled})
            </span>
          ))}.
        </p>
      )}
      <p><strong>What that means for this board</strong></p>
      <ul className="po-info-points">
        <li>{coverage.periodNote}</li>
        <li>{coverage.partitionNote}</li>
        <li>
          {coverage.otherNote} There {coverage.otherPostDesign === 1 ? 'is' : 'are'}{' '}
          <strong>{(coverage.otherPostDesign ?? 0).toLocaleString('en-IN')}</strong> of those right now.
        </li>
        <li>
          Once the team starts filling the milestone fields, every card can move onto real dates and
          the period buttons start working — no rebuild, just a change of source per card.
        </li>
      </ul>
    </div>
  );
}

/**
 * The post-design queue.
 *
 * @param {object}   props.data      the `postDesign` object from GET /api/post-design-funnel
 * @param {object}   [props.coverage] `meta.coverage`, which is what the info panel renders
 * @param {boolean}  [props.loading] true while the API is being re-read — the numbers already on
 *                                   screen stay put and dim, never a spinner, never an unmount
 * @param {Function} [props.onOpen]  called with { id, label, ids } to open the orders popup,
 *                                   the same contract the other funnels use
 */
export function PostDesignFlow({ data, coverage, loading, onOpen }) {
  const [info, setInfo] = useState(false);
  const cards = data?.cards ?? [];
  if (!cards.length) return null;
  // The denominator for every share: the period's total movement, summed from the cards themselves
  // so it can never disagree with what is on screen. The queue total is tracked beside it because
  // the header still reports it — they are different numbers and both are wanted.
  const moved = cards.reduce((total, entry) => total + (entry.count ?? 0), 0);
  const queue = cards.reduce((total, entry) => total + (entry.sitting ?? 0), 0);

  return (
    <>
      <section
        className={`lf po-lf${loading ? ' is-stale' : ''}`}
        aria-labelledby="po-title"
        aria-busy={loading || undefined}
      >
        <div className="po-head">
          <h2 id="po-title" className="lf-title">Post-design queue</h2>
          <button
            type="button"
            className={`po-info-btn${info ? ' is-on' : ''}`}
            onClick={() => setInfo((open) => !open)}
            aria-expanded={info}
            aria-label="Where these numbers come from"
            title="Where these numbers come from"
          >
            <Info size={15} aria-hidden="true" />
          </button>
          <p className="po-sub">
            <strong>{moved.toLocaleString('en-IN')}</strong> orders moved through post-design in this
            period · <strong>{queue.toLocaleString('en-IN')}</strong> sitting in the queue right now.
          </p>
        </div>

        {info && <InfoPanel coverage={coverage} onClose={() => setInfo(false)} />}

        {/* Nine columns, all on screen. Affordable here because this board carries no wire labels,
            so the gutter only has to hold a plain elbow — see post-design-queue.css. */}
        <div className="po-track">
          {cards.map((node, index) => (
            <div className="lf-c" key={node.key}>
              <div className={`lf-node ${index === 0 ? 'has-out' : index === cards.length - 1 ? 'has-in' : 'has-in has-out'}`}>
                <i className="lf-w in-h" aria-hidden="true" />
                <i className="lf-w in-v" aria-hidden="true" />
                <FlowCard node={node} share={moved ? node.count / moved : null} onOpen={onOpen} />
                {node.subs?.length > 0 && (
                  <ul className="po-rows" aria-label={`${node.label} broken down`}>
                    {node.subs.map((row) => (
                      <SubRow row={row} group={node.label} groupId={node.key} onOpen={onOpen} key={row.key} />
                    ))}
                  </ul>
                )}
                <CityCells
                  cities={node.byCity}
                  groupId={node.key}
                  groupLabel={node.label}
                  unit={node.unit ?? 'order'}
                  onOpen={onOpen}
                />
                <i className="lf-w out-h" aria-hidden="true" />
                <i className="lf-w out-v" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

        <p className="po-note">
          The big figure on each card is how many orders <strong>entered</strong> that stage in the
          selected period; the figure under it is how many are <strong>sitting there right now</strong>,
          whatever period is chosen. The two are different questions and rarely match — 35 orders
          reached Handover this period while 303 are parked there. Each order is credited to the
          furthest sub-card it reached, so the sub-cards add back to their card and the nine cards add
          back to the {moved.toLocaleString('en-IN')} that moved. Nothing converts into anything, which
          is why there are no percentages on the arrows. Press <strong>i</strong> above for where the
          numbers come from and what Zoho is still not recording.
        </p>
      </section>
    </>
  );
}
