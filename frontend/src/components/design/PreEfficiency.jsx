import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCallback } from 'react';
// The Delhi / Hyderabad / Others cells, shared with every funnel on every board. Here they print an
// average rather than a count, which is what figureOf / saidOf are for.
import { CityCells } from '../presales/LeadFlow.jsx';

// Pre-efficiency: the two averages under the pre-design funnel.
//
//   Average time to fresh design   ·   Average revisions per order
//
// A different animal from the cards above them, and the difference matters when reading it. Those
// COUNT orders; these AVERAGE a number over the orders that carry one. So each card reports two
// figures, not one — the average itself, and how many orders it was actually taken over — because
// "2.6 days" over 224 orders and "2.6 days" over 3 are not the same claim, and only one of them is
// worth acting on.
//
// An order with nothing recorded contributes NOTHING to an average here; it is not folded in as a
// zero. That is deliberate and it is the whole reason the second card reads 1.2 rather than 0.2:
// the revision box is filled on 37 of 271 requests, and a blank box in Zoho means "nobody wrote a
// number", not "there were no revisions". Averaging the blanks in as zeros would say design revises
// almost nothing, which is false. The card states its base instead.
//
// Both cards carry the DEL / HYD / Others split, the same strip every other card on the board uses.

// `better` says which direction is good news, so a delta's colour follows meaning. Both of these
// are "down is better": a faster first design and fewer revisions are the point of the board.
const CARDS = [
  {
    key: 'freshDesign',
    tone: 'teal',
    better: 'down',
    about: 'Measured from when the order was created in Zoho to its Send For Approval Date — the '
      + 'first design going out. Orders with no approval date yet are not in the average. One order '
      + 'a month carries an approval date earlier than its own creation date, which is a keying '
      + 'error rather than a design turned round before it was asked for, and is left out.'
  },
  {
    key: 'revisions',
    tone: 'amber',
    better: 'down',
    about: 'The average of Number of Design Revisions across the orders where that box is filled. A '
      + 'blank box is unknown, not zero, so a blank order is left out of the average rather than '
      + 'counted as having had none.'
  },
  {
    key: 'revisionTurnaround',
    tone: 'green',
    // The one card on this board where UP is the good direction: a higher share actioned is better,
    // where a faster time and fewer revisions are better by being lower.
    better: 'up',
    comparison: true,
    about: 'Of the revisions asked for in this period, the share that have been actioned — the order '
      + 'is no longer sitting on a revision stage and has gone back out or been approved. The '
      + 'denominator is the revisions REQUESTED, not every order, because a revision cannot be done '
      + 'unless it was asked for.'
  }
];

const plural = (count, word) => `${count.toLocaleString('en-IN')} ${word}${count === 1 ? '' : 's'}`;

// The change against the previous period. An average has no "none in the last period" case the way
// a count does — either there was an average or there was not — so a missing one simply goes
// without a delta instead of showing an invented zero.
function Delta({ node, better, previousLabel }) {
  if (node?.previous == null || node.value == null || !previousLabel) return null;
  if (!node.previous) return null;
  const change = (node.value - node.previous) / node.previous;
  const direction = change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat';
  const tone = direction === 'flat' ? 'flat' : direction === better ? 'good' : 'bad';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`lf-delta ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {direction === 'flat' ? 'No change' : `${Math.abs(change * 100).toFixed(1)}%`} vs {previousLabel}{' '}
      ({node.previousFigure}{node.unit === 'actioned' ? '' : ` ${node.unit}`})
    </span>
  );
}

/**
 * The comparison card: revisions requested against revisions done.
 *
 * A different shape from the two beside it — a pair of counts and the share between them, not an
 * average — so it gets its own component rather than being bent into MetricCard. What it adds to
 * the funnel above is the join: the funnel shows 45 requested and 42 done as two separate cards and
 * leaves the reader to do the subtraction. This card does it, and names the 3 still open, which is
 * the number anyone running design actually wants.
 */
function ComparisonCard({ node, tone, better, about, previousLabel, onOpen }) {
  const empty = node?.value == null;
  const requested = node?.requested ?? 0;
  const done = node?.done ?? 0;
  const open = node?.open ?? 0;
  const said = empty
    ? `${node.label}: no revisions were asked for in this period`
    : `${node.label}: ${node.figure} actioned, ${done} of ${requested}, ${open} still open`;

  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: node.key, label: node.label, ids: node?.ids ?? [] });
  }, [empty, onOpen, node]);

  return (
    <div className="pe-cell">
      <button
        type="button"
        className={`lf-card lf-md tone-${tone} lf-card-top${empty ? ' pe-empty' : ''}`}
        onClick={click}
        aria-disabled={empty || undefined}
        aria-label={empty ? said : `Open the orders behind ${said}`}
        title={[node.label, about, empty ? 'No revisions asked for' : 'Click to see the orders']
          .filter(Boolean).join('\n')}
      >
        <span className="lf-label"><i aria-hidden="true" />{node.label}</span>
        <span className="lf-figures">
          {empty
            ? <strong className="pe-none">—</strong>
            : <>
                <strong className="pe-fade" key={node.figure}>{node.figure}</strong>
                <span className="pe-unit">actioned</span>
              </>}
        </span>
        {/* The two counts the share is made of, and the gap between them. The gap is the point of
            the card, so it is the one part that takes a colour when it is not zero. */}
        <span className="pe-base">
          {empty
            ? <>No revisions asked for in this period</>
            : <>
                <strong>{done.toLocaleString('en-IN')}</strong> of {requested.toLocaleString('en-IN')} actioned
                {open > 0
                  ? <> · <b className="pe-open">{open.toLocaleString('en-IN')} still open</b></>
                  : <> · <b className="pe-clear">none open</b></>}
              </>}
        </span>
        <Delta node={node} better={better} previousLabel={previousLabel} />
      </button>
      <CityCells
        cities={node.byCity}
        groupId={node.key}
        groupLabel={node.label}
        onOpen={onOpen}
        figureOf={(city) => city.figure ?? '—'}
        saidOf={(city) => (city.figure == null
          ? 'no revisions asked for'
          : `${city.figure} actioned, ${city.done} of ${city.requested}`)}
      />
    </div>
  );
}

/** One average, with its base, its trend and its three city cells. */
function MetricCard({ node, tone, better, about, previousLabel, onOpen }) {
  const empty = node?.value == null;
  const measured = node?.count ?? 0;
  const of = node?.of ?? 0;
  const said = empty
    ? `${node.label}: nothing recorded to average in this period`
    : `${node.label}: ${node.figure} ${node.unit}, averaged over ${plural(measured, 'order')} of ${of}`;

  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: node.key, label: node.label, ids: node?.ids ?? [] });
  }, [empty, onOpen, node]);

  return (
    <div className="pe-cell">
      <button
        type="button"
        className={`lf-card lf-md tone-${tone} lf-card-top${empty ? ' pe-empty' : ''}`}
        onClick={click}
        aria-disabled={empty || undefined}
        aria-label={empty ? said : `Open the orders behind ${said}`}
        title={[node.label, about, node.note, empty ? 'Nothing recorded to average' : 'Click to see the orders']
          .filter(Boolean).join('\n')}
      >
        <span className="lf-label"><i aria-hidden="true" />{node.label}</span>
        <span className="lf-figures">
          {empty
            ? <strong className="pe-none">—</strong>
            : <>
                <strong className="pe-fade" key={node.figure}>{node.figure}</strong>
                <span className="pe-unit">{node.unit}</span>
              </>}
        </span>
        {/* The base. Never optional: an average without the count behind it is a number with no
            weight, and on this board the two bases are 224 and 37 — different enough that reading
            one card like the other would be a mistake. */}
        <span className="pe-base">
          {empty
            ? <>Not recorded on any of the {plural(of, 'request')}</>
            : <>Averaged over <strong>{measured.toLocaleString('en-IN')}</strong> of {of.toLocaleString('en-IN')} requests</>}
        </span>
        <Delta node={node} better={better} previousLabel={previousLabel} />
      </button>
      <CityCells
        cities={node.byCity}
        groupId={node.key}
        groupLabel={node.label}
        onOpen={onOpen}
        // The cell prints the city's own average, not how many orders it was taken over — the count
        // would be a different quantity in the same place the other boards print a count.
        figureOf={(city) => city.figure ?? '—'}
        saidOf={(city) => (city.figure == null
          ? 'nothing recorded to average'
          : `${city.figure} ${node.unit}, over ${plural(city.count ?? 0, 'order')}`)}
      />
    </div>
  );
}

/**
 * The Pre-efficiency board, under the pre-design funnel.
 *
 * @param {object}   props.data            the `preEfficiency` object from GET /api/pre-design-funnel
 * @param {string}   [props.previousLabel] what the deltas are measured against; defaults to
 *                                         `data.previousLabel`, which the API words for the period
 * @param {boolean}  [props.loading]       true while the API is being re-read — the numbers already
 *                                         on screen stay put and dim, never a spinner
 * @param {Function} [props.onOpen]        called with { id, label, ids } to open the orders popup,
 *                                         the same contract the funnel above it uses
 */
export function PreEfficiency({ data, previousLabel, loading, onOpen }) {
  if (!data?.freshDesign) return null;
  const since = previousLabel ?? data.previousLabel ?? null;

  return (
    <section
      className={`lf pe-lf${loading ? ' is-stale' : ''}`}
      aria-labelledby="pe-title"
      aria-busy={loading || undefined}
    >
      <div className="pe-head">
        <h2 id="pe-title" className="lf-title">Pre-efficiency</h2>
        <p className="pe-sub">
          How fast the first design goes out, and how many revisions it takes.
        </p>
      </div>

      <div className="pe-track">
        {CARDS.map(({ key, tone, better, about, comparison }) => {
          if (!data[key]) return null;
          const Card = comparison ? ComparisonCard : MetricCard;
          return (
            <Card
              node={data[key]}
              tone={tone}
              better={better}
              about={about}
              previousLabel={since}
              onOpen={onOpen}
              key={key}
            />
          );
        })}
      </div>

    </section>
  );
}
