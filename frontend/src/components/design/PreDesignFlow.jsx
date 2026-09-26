import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCallback } from 'react';
// The Delhi / Hyderabad / Others cells, shared with the Pre Sales and the two Sales funnels
// so the split reads the same on every card of every board.
import { CityCells } from '../presales/LeadFlow.jsx';

// The Design board's pre-design funnel, drawn as the PSM board's Funnel: one connected line of cards
// with elbow wires, rendering LeadFlow's own .lf- markup and classes exactly as the Sales board's
// Sales performance section does. Nothing in leadflow.css is forked; pre-design.css only adds the
// column count, the city rows, the revision rows and the per-card note.
//
//   Sent in for design  →  First fresh design  →  Revisions  →  Booked  →  Handed over
//
// The measure on every card is SQUARE FEET, not rupees: Deals.Amount is empty on all 7,591 records in
// the module, and square feet is what the customer asked for. `valueLabel` arrives from the API
// already worded ("26,747 sq ft") and is printed as given, never re-formatted here.
//
// Two things to know if you are reading the numbers rather than this file:
//
//   · This is a COHORT. Every card counts orders CREATED in the selected period and says where they
//     stand today. "Booked" and "Handed over" therefore read near zero on a short period — an order
//     raised this month has not had time to get there. That is the honest shape, not a bug, and it is
//     the same convention as the Sales board's S1–S5 ladder.
//
//   · "Revisions" is not a funnel step that the others flow through. It counts the orders whose
//     Number of Design Revisions is filled in Zoho — 9% of the module — and shows how those are spread
//     against the three-revision limit. Its rows are a distribution, not attrition, so no share rides
//     its wire; the card's own note says on how many orders the field is recorded.
//
// Every figure comes from the API as-is. The only derived numbers are the shares, which the API sends
// on the cards that have an honest denominator (`share`), and the bucket widths inside Revisions.

// `better` says which direction of change is good news, so the delta's colour follows meaning.
const TONES = {
  intake: { tone: 'blue', better: 'up' },
  firstDesign: { tone: 'green', better: 'up' },
  revisions: { tone: 'amber', better: 'down' },
  booked: { tone: 'violet', better: 'up' },
  handover: { tone: 'teal', better: 'up' }
};

const pct = (value) => `${(value * 100).toFixed(1)}%`;
// The wire label's form. The shared gutter in leadflow.css is sized for the widest figure this rule can
// produce, so the redundant trailing ".0" has to go — "100%", never "100.0%".
const shortPct = (value) => pct(value).replace(/\.0%$/, '%');

// THE DENOMINATOR, and it is the same one for every share on this chain.
//
// The intake card carries two figures (274 leads · 224 sent to design), so "share of what" has to be
// stated rather than assumed. Every share here is of the orders SENT TO DESIGN — the 224 — because
// that is the set the funnel is about: first design, booked and handed over are each a strict subset
// of it, so the figure is a real proportion of a real set.
//
// Sharing against everything that arrived (the 274) was the alternative, and is rejected: it would mix
// in orders design never received, and on the quarter 1,823 of those arrived already past design as
// legacy imports. Against 4,497 instead of 1,478, "Booked" would read 12.8% rather than 38.8% — the
// same orders, a figure three times smaller, and design marked down for work it never had.
const SHARE_BASIS = 'of orders sent to design';

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
 * One card on the line.
 * `about` is a standing caveat about what the card counts; `node.note` is the figure-specific caveat
 * the API sends with the data. Both are on the card's tooltip and in its spoken name, so a screen
 * reader is never told less than the screen says. A card with no orders keeps its shape and its place
 * in the tab order but opens nothing.
 */
function FlowCard({ node, id, label, about, tone, better, size = 'md', extra = '', previousLabel, onOpen }) {
  const count = node?.count ?? 0;
  const empty = count === 0;
  const note = node?.note;
  // The long form, basis and all. It goes in three places on purpose: inside .lf-figures (where
  // leadflow visually hides it while the wire label is showing, so it stays in the accessible name
  // and returns as the visible copy below the breakpoint), in the tooltip, and in the explicit
  // aria-label — which overrides content, so without it the share would be lost to a screen reader.
  const shareText = !empty && node?.share != null ? `${pct(node.share)} ${SHARE_BASIS}` : null;
  // The intake card is the only one the API sends a `total` with: everything that arrived in the
  // period, against how much of it reached design. Every other card has one figure, so the bracket
  // follows the payload rather than the card's identity.
  const both = node?.total != null;
  const bracketText = both
    ? `${node.total.toLocaleString('en-IN')} leads, ${count.toLocaleString('en-IN')} sent to design`
    : plural(count, 'order');
  const ariaLabel = [
    empty
      ? both
        ? `${label}: ${node.total.toLocaleString('en-IN')} leads arrived, none sent to design in this period`
        : `${label}: no orders in this period`
      : `Open the ${bracketText} in ${label}, ${node.valueLabel}`,
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
        {/* Square feet leads, because that is the measure the customer asked to see, and the count
            follows it in brackets — which on the intake card is the pair they asked for:
            "26,747 sq ft (274 leads · 224 sent to design)". */}
        <strong className="pd-fade" key={node?.valueLabel}>{node?.valueLabel ?? '0 sq ft'}</strong>
        <span className="pd-orders">
          {both
            ? <>({node.total.toLocaleString('en-IN')} leads <i aria-hidden="true">·</i> <b>{count.toLocaleString('en-IN')} sent to design</b>)</>
            : <>({plural(count, 'order')})</>}
        </span>
        {/* Required by the lf-wire-labels contract and not a duplicate of the wire label: leadflow
            visually hides this copy (it stays in the accessible name) while the label is on, and
            shows it here once the wires go. Exactly one of the two is ever visible. */}
        {shareText && <em className="lf-inline-share">{shareText}</em>}
      </span>
      {!empty && node?.share != null && (
        <span className="lf-share" aria-hidden="true"><b style={{ width: `${Math.max(node.share * 100, 2)}%` }} /></span>
      )}
      <Delta node={node} better={better} previousLabel={previousLabel} />
      {note && <span className="pd-card-note">{note}</span>}
    </button>
  );
}

// A card carrying a city split squares off its bottom, so the shared .lf-cities strip below it merges
// into the same shape.
const topOf = (node) => (node?.byCity?.length ? ' lf-card-top' : '');

// One revision bucket, sitting under the Revisions card. A sibling of the card button rather than a
// child of it — nested buttons are invalid HTML. `meter` draws the bucket's share of the orders that
// record a revision count, which is how the spread is read at a glance.
//
// The three CITY rows used to be drawn with this too. They are now the shared compact three-up strip
// (<CityCells> / .lf-cities in leadflow.css), which every card of every funnel uses; the revision
// spread stays here because it is a distribution against a limit, not a city split, and it needs the
// meter and the over-limit colour that go with that.
function SubRow({ row, group, groupId, meter = false, onOpen }) {
  const count = row?.count ?? 0;
  const empty = count === 0;
  // City rows carry the same pair as the intake card above them, so a row reads "51 of 54" and the
  // three rows still add up to both bracket figures. Revision buckets have no `total` and show one.
  const total = row?.total;
  const counted = total != null
    ? `${count.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} sent to design`
    : plural(count, 'order');
  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: `${groupId}-${row.key}`, label: `${group} · ${row.label}`, ids: row?.ids ?? [] });
  }, [empty, onOpen, row, group, groupId]);

  return (
    <li>
      <button
        type="button"
        className={`pd-row${empty ? ' pd-empty' : ''}${row?.pastLimit ? ' pd-over' : ''}`}
        onClick={click}
        aria-disabled={empty || undefined}
        aria-label={
          empty
            ? total
              ? `${group} · ${row.label}: ${total.toLocaleString('en-IN')} leads, none sent to design`
              : `${group} · ${row.label}: no orders in this period`
            : `Open the ${counted} in ${group} · ${row.label}, ${row.valueLabel}`
        }
        title={empty ? `${row.label}\nNo orders in this period` : `${row.label}\nClick to see the orders`}
      >
        <span className="pd-row-name">{row.label}</span>
        <span className="pd-row-count">
          <strong>{count.toLocaleString('en-IN')}</strong>
          {total != null && <em>of {total.toLocaleString('en-IN')}</em>}
        </span>
        {empty
          ? <span className="lf-delta flat">None</span>
          : <span className="lf-inline-value pd-fade" key={row.valueLabel}>{row.valueLabel}</span>}
        {meter && (
          <span className="pd-meter" aria-hidden="true">
            <b style={{ width: `${Math.max((row?.share ?? 0) * 100, count ? 3 : 0)}%` }} />
          </span>
        )}
      </button>
    </li>
  );
}

// A card with its sub-rows fused into one block: the card loses its bottom corners and the list picks
// them up, so the seam reads as a divider inside a single card rather than as two cards.
function Block({ rows, group, groupId, meter, onOpen, children }) {
  return (
    <div className="pd-stack">
      {children}
      <ul className="pd-rows" aria-label={`${group} broken down`}>
        {rows.map((row) => (
          <SubRow row={row} group={group} groupId={groupId} meter={meter} onOpen={onOpen} key={row.key} />
        ))}
      </ul>
    </div>
  );
}

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
  if (!data) return null;
  const { intake, firstDesign, revisions, booked, handover } = data;
  if (!intake) return null;
  const since = previousLabel ?? data.previousLabel ?? null;
  const cities = intake.byCity ?? [];
  const buckets = revisions?.buckets ?? [];
  const limit = revisions?.limit ?? 3;
  const over = revisions?.overLimit ?? 0;
  // Counted rather than fixed, so the chain still fills the row while a node is missing mid-deploy.
  const tail = [
    { prop: 'booked', node: booked, about: 'Where this period’s orders stand today, read off the order Stage in Zoho. An order raised recently will not have reached it yet.' },
    { prop: 'handover', node: handover, about: 'The order has left design for post-design — Stage at "Assign Post - Designer" or beyond, or a Handover Date set.' }
  ].filter((entry) => entry.node);
  // Intake, first design, revisions, then the tail: five with a whole payload. Counted rather than
  // fixed so the chain still fills the row while a node is missing mid-deploy.
  const columns = 3 + tail.length;
  // Shared wire labels, standard tier. `lf-wire-labels-dense` is for six columns or more and would
  // push this flow's floor from 1181px up to 1400px for no reason — five columns pay for the gutter
  // comfortably at 1181 (measured below). It is derived from the count rather than hard-coded, so a
  // sixth card would move this flow to the dense tier on its own.
  const wireLabels = `lf-wire-labels${columns >= 6 ? ' lf-wire-labels-dense' : ''}`;

  return (
    <section
      className={`lf pd-lf ${wireLabels} pd-cols-${columns}${loading ? ' is-stale' : ''}`}
      aria-labelledby="pd-title"
      aria-busy={loading || undefined}
    >
      <h2 id="pd-title" className="lf-title">Pre-design funnel</h2>

      {/* 1 · the headline: square feet sent in for design, with the order count, and the three city
             cells fused underneath it as part of the same block. */}
      <div className="lf-c">
        <Node wires="has-out">
          <FlowCard
            node={intake}
            id="intake"
            label={intake.label}
            about={'The bracket is everything that arrived in this period, then how much of it was sent in for '
                + 'design. A "lead" here is one Zoho order (Deals) — one per room or product line — created in the '
                + 'period; "sent to design" are the ones carrying a design field, a designer, a design date, a '
                + 'design presentation or a revision count. The square feet, the city rows and every card after '
                + 'this one count only the ones sent to design. Square feet is Area (Sqft), falling back to '
                + 'Cabinet Area (Sqft) where that box is blank.'}
            tone={TONES.intake.tone}
            better={TONES.intake.better}
            size="lg"
            extra={topOf(intake).trim()}
            previousLabel={since}
            onOpen={onOpen}
          />
          <CityCells cities={cities} groupId="intake" groupLabel={intake.label} unit="order" onOpen={onOpen} />
        </Node>
      </div>

      {/* 2 · the first design produced for the order */}
      <div className="lf-c">
        <Node share={firstDesign?.count ? firstDesign.share : null}>
          <FlowCard
            node={firstDesign}
            id="firstDesign"
            label={firstDesign?.label ?? 'First fresh design'}
            about={'The first design has gone out: a Send For Approval Date or a Design Presentation on the order, '
              + 'or a Stage that is past the drawing board.'}
            tone={TONES.firstDesign.tone}
            better={TONES.firstDesign.better}
            extra={topOf(firstDesign).trim()}
            previousLabel={since}
            onOpen={onOpen}
          />
          <CityCells
            cities={firstDesign?.byCity}
            groupId="firstDesign"
            groupLabel={firstDesign?.label ?? 'First fresh design'}
            unit="order"
            onOpen={onOpen}
          />
        </Node>
      </div>

      {/* 3 · revisions, spread against the limit.

             DELIBERATELY NO WIRE LABEL, and the one place this flow does not take the shared
             treatment. Revisions is not a rung of the chain: 229 of 1,478 is how many orders have
             Number of Design Revisions FILLED IN ZOHO, not how many were revised. It shares the
             chain's denominator but not its meaning, and "15.5%" sitting on the wire in the same
             visual language as "94.5% of orders sent to design" would be read as "15.5% were
             revised", which is false. The contract requires one basis along the whole chain, so the
             honest move is to leave this wire bare rather than to put a second basis on it. The
             figure is still on the card, worded as coverage, in the API's own note. */}
      {/* The one card on the three boards that does NOT take the shared city strip: it already carries
          a three-row breakdown of its own, and that one is the point of the card. A second three-way
          split under it would be two distributions of the same 229 orders stacked on one card, in two
          different visual languages, on a card that is not a rung of the chain to begin with. */}
      <div className="lf-c">
        <Node>
          <Block rows={buckets} group={revisions?.label ?? 'Revisions'} groupId="revisions" meter onOpen={onOpen}>
            <FlowCard
              node={revisions}
              id="revisions"
              label={`${revisions?.label ?? 'Revisions'} · max ${limit}`}
              about={`Magppie allows ${limit} design revisions. The rows below show how the orders that record a `
                + 'revision count are spread against that limit. Number of Design Revisions is filled on a small '
                + 'share of orders in Zoho, so a blank one is unknown, not zero.'}
              tone={TONES.revisions.tone}
              better={TONES.revisions.better}
              previousLabel={since}
              onOpen={onOpen}
            />
          </Block>
        </Node>
        <p className={`pd-limit${over ? ' pd-limit-over' : ''}`}>
          {revisions?.count
            ? <>{over
                ? <><strong>{plural(over, 'order')}</strong> past the {limit}-revision limit</>
                : <>All {revisions.count.toLocaleString('en-IN')} within the {limit}-revision limit</>}</>
            : <>No revision counts recorded in this period</>}
        </p>
      </div>

      {/* 4, 5 · Booked → Handed over */}
      {tail.map(({ prop, node, about }, index) => (
        <div className="lf-c" key={prop}>
          <Node
            wires={index === tail.length - 1 ? 'has-in' : 'has-in has-out'}
            share={node.count ? node.share : null}
          >
            <FlowCard
              node={node}
              id={prop}
              label={node.label}
              about={about}
              tone={TONES[prop].tone}
              better={TONES[prop].better}
              extra={topOf(node).trim()}
              previousLabel={since}
              onOpen={onOpen}
            />
            <CityCells cities={node.byCity} groupId={prop} groupLabel={node.label} unit="order" onOpen={onOpen} />
          </Node>
        </div>
      ))}

      <p className="pd-note">
        The first bracket is everything that <strong>arrived</strong> in the period; the second is how much of it was{' '}
        <strong>sent in for design</strong>, and that is what the square feet, the city rows and every card after it
        count. Every card counts orders <strong>created</strong> in the selected period and shows where they stand
        today, so <strong>Booked</strong> and <strong>Handed over</strong> stay low on a short period — a new order
        has not reached them yet. Square feet come from <strong>Area (Sqft)</strong> on the order, and from{' '}
        <strong>Cabinet Area (Sqft)</strong> where that box is blank; orders with neither are counted but add no area.
      </p>
    </section>
  );
}
