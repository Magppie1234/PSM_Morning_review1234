// Lead generation section of the Sales board.
//
// Built on the PSM board's funnel markup (LeadFlow.jsx / leadflow.css) so the two boards read as one
// product: .lf grid, .lf-c columns, .lf-node wires, .lf-card buttons, .lf-share bars and .lf-delta
// trends. Only the things the funnel has no equivalent for — the four-column track and the "By source"
// group heading — carry lg- classes of their own. The DEL / HYD / Others cells under a card are the
// shared <CityCells> / .lf-cities piece, used by all four funnels on the three boards.
//
//   1 INCOMING FROM PSM ──┐                  ┌── 3 PSM QUALIFIED ──┐                ┌─ ARCHITECT
//     (+ city cells)      ├─► bracket ──────►┤                     ├─► 5 QUALIFIED ─┤  WALK-INS
//   2 SELF-GENERATED RAW ─┘                  └── 4 SELF-QUALIFIED ─┘  (+ city cells)│  REFERRALS
//     (+ city cells)                                                                │  AD GLOBAL
//   The two intake cards are not joined to each other; they fan into the pair of    └─ OTHER SOURCES
//   qualified cards, which merge back into the qualified total, which fans out by source.
//
// Every figure comes from the API (`leadGeneration`). The only derived values are the share lines and
// the trend percentages, each a ratio of two numbers the API sent. A card with no `previous` shows no
// trend at all — a missing comparison is not a fall to zero.
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
// The Delhi / Hyderabad / Others cells, shared with the Pre Sales, Sales performance and
// pre-design funnels so the split reads the same on every card of every board.
import { CityCells } from '../presales/LeadFlow.jsx';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COUNT_UP_MS = 420;

// The count-up is a nicety; the figure is not. When the browser will not animate, the real number is
// rendered straight away rather than a remembered one.
//
// A hidden document is the important case: browsers stop requestAnimationFrame entirely for a tab that
// is not being painted, so a board left on a background tab (or behind another window) would otherwise
// sit on the old count while the rest of the card had already re-rendered with new data.
const canCountUp = () =>
  typeof requestAnimationFrame === 'function' &&
  typeof performance !== 'undefined' &&
  !(typeof document !== 'undefined' && document.visibilityState === 'hidden') &&
  !prefersReducedMotion();

/**
 * Counts from the figure on screen up (or down) to `target` whenever `target` changes — a new period, a
 * city filter, a refresh.
 *
 * The prop is the source of truth, in three layers, because getting this wrong puts a number on the
 * board that contradicts the rows underneath it:
 *   1. `goal` records which value the frames are heading for. A render whose target is not that value
 *      shows the real number, never the last frame of a superseded animation.
 *   2. a timer settles the figure even if no animation frame ever arrives.
 *   3. if the browser cannot animate at all, the prop is rendered as-is.
 */
function useCountUp(target) {
  const safe = Number.isFinite(target) ? target : 0;
  const [anim, setAnim] = useState({ goal: safe, value: safe });
  const startRef = useRef(safe);

  // Re-aim during render (React's "adjust state when a prop changes" pattern) so the first paint after a
  // change is already counting from the old figure instead of flashing the new one.
  if (anim.goal !== safe) {
    startRef.current = canCountUp() ? anim.value : safe;
    setAnim({ goal: safe, value: startRef.current });
  }

  useEffect(() => {
    // Returning the same object makes React bail out, so settling twice costs nothing.
    const settle = () =>
      setAnim((cur) => (cur.goal === safe && cur.value === safe ? cur : { goal: safe, value: safe }));
    const from = startRef.current;
    if (from === safe || !canCountUp()) {
      settle();
      return undefined;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now) => {
      const t = Math.min(1, (now - started) / COUNT_UP_MS);
      if (t >= 1) {
        settle();
        return;
      }
      const eased = 1 - (1 - t) ** 3; // ease-out: fast first, settles gently
      setAnim({ goal: safe, value: Math.round(from + (safe - from) * eased) });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Timers keep firing when requestAnimationFrame does not, so the figure always lands.
    const watchdog = setTimeout(settle, COUNT_UP_MS + 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
    };
  }, [safe]);

  // An interrupted or never-started animation can only leave the current prop on screen.
  return anim.goal === safe ? anim.value : safe;
}

function CountUp({ value }) {
  return <strong>{useCountUp(value)}</strong>;
}

const plural = (count) => (count === 1 ? 'lead' : 'leads');
const pct = (share) => `${(share * 100).toFixed(1)}%`;
// Short form for the wire label, where every pixel is fought for between the bracket rail and the card:
// a trailing ".0" carries no information, and dropping it keeps "100.0%" — the widest figure a share can
// produce — from crowding the rail. The card and the tooltip keep the full form, so the two never
// disagree about the value. Copied from LeadFlow.jsx, which owns the shared treatment.
const shortPct = (share) => pct(share).replace(/\.0%$/, '%');

// Share of a parent count, or null when there is no honest denominator.
const shareOf = (count, total) => (total > 0 ? (count ?? 0) / total : null);

/**
 * The card's movement against the period before it, matching the PSM funnel's Delta exactly so the two
 * boards say the same thing the same way.
 *
 * Returns null when the API sent no `previous` — that card simply cannot be compared, and showing a
 * fall to zero would be a lie. `previous === 0` is a real comparison and does get a line.
 */
const trendOf = (node, previousLabel) => {
  const previous = node?.previous;
  if (previous === null || previous === undefined) return null;
  const count = node.count ?? 0;
  if (!previous) {
    return count
      ? { direction: 'flat', tone: 'flat', label: `None in ${previousLabel}`, spoken: `none in ${previousLabel}` }
      : { direction: 'flat', tone: 'flat', label: 'No leads in either period', spoken: 'no leads in either period' };
  }
  const change = (count - previous) / previous;
  const direction = change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat';
  const size = `${Math.abs(change * 100).toFixed(0)}%`;
  // Every card here counts leads, so more is better and the tone follows the direction.
  return {
    direction,
    tone: direction === 'flat' ? 'flat' : direction === 'up' ? 'good' : 'bad',
    label: `${direction === 'flat' ? 'No change' : size} vs ${previousLabel} (${previous})`,
    spoken: direction === 'flat' ? `no change from ${previous} in ${previousLabel}` : `${direction} ${size} from ${previous} in ${previousLabel}`
  };
};

function Delta({ trend }) {
  if (!trend) return null;
  const Icon = trend.direction === 'up' ? ArrowUpRight : trend.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`lf-delta ${trend.tone}`}>
      <Icon size={13} aria-hidden="true" />
      {trend.label}
    </span>
  );
}

// Spoken description of a card, used for aria-label and the hover title. The money value and the trend are
// spoken even where the layout shows only a count, so nothing the API sent is lost to a screen reader.
const describe = (label, node, shareText, trend) => {
  const count = node?.count ?? 0;
  const tail = [shareText, trend?.spoken, node?.note].filter(Boolean).join(', ');
  if (!count) return `Open ${label}: no leads${tail ? `. ${tail}` : ''}`;
  const money = node?.valueLabel ? `, worth ${node.valueLabel}` : '';
  return `Open ${label}: ${count} ${plural(count)}${money}${tail ? `, ${tail}` : ''}`;
};

/**
 * One funnel card. Mirrors FlowCard in LeadFlow.jsx: the four wire elements wrap the button, and the
 * column's bracket classes decide which of them actually show.
 *
 * `cities` (optional) is the card's DEL / HYD / Others split. The cells are real buttons, so they sit
 * just below the card button inside the same .lf-node and are merged into it visually — a button
 * cannot be nested inside another button. <CityCells> renders nothing when there is no split.
 */
function FlowCard({ id, label, node, tone, size, wires, share, shareSuffix, withValue, cities, previousLabel, onOpen }) {
  const count = node?.count ?? 0;
  const hasShare = count > 0 && share !== null && share !== undefined;
  // One flag drives the wire label, the in-card copy and the spoken name, so the three cannot drift: a
  // wire label without its in-card counterpart would lose the figure below the breakpoint and to a
  // screen reader. An empty card says "No leads" instead of "0.0% of …", so it shows neither.
  const shareText = hasShare ? `${pct(share)} of ${shareSuffix}` : '';
  // A card may name its own comparison period; otherwise the section's one is used.
  const trend = trendOf(node, node?.previousLabel || previousLabel);
  const spoken = describe(label, node, shareText, trend);
  const hasCities = Array.isArray(cities) && cities.length > 0;

  return (
    <div className={`lf-node ${wires}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      {/* The short figure rides the wire that points at this card; the long form below stays in the card
          (visually hidden while the label is up) and in the tooltip, so the basis is never ambiguous.
          Only the cards with an incoming wire carry a share, so the two never appear apart. */}
      {shareText && <b className="lf-wire-share" aria-hidden="true">{shortPct(share)}</b>}
      <button
        type="button"
        className={`lf-card lf-${size} tone-${tone}${hasCities ? ' lf-card-top' : ''}${count ? '' : ' lg-zero'}`}
        onClick={() => onOpen({ id, label, ids: node?.ids ?? [] })}
        aria-label={spoken}
        title={spoken}
      >
        <span className="lf-label"><i aria-hidden="true" />{label}</span>
        <span className="lf-figures">
          {size === 'sm' ? (
            <strong className="lg-flip" key={count}>{count}</strong>
          ) : (
            <CountUp value={count} />
          )}
          {withValue && (
            <span className="lf-inline-value lg-flip" key={node?.valueLabel ?? 'none'}>
              {count ? (node?.valueLabel ?? '—') : '₹0'}
            </span>
          )}
          {count ? shareText && <em className="lf-inline-share">{shareText}</em> : <em className="lg-none">No leads</em>}
        </span>
        {hasShare && (
          <span className="lf-share" aria-hidden="true">
            <b style={{ width: `${Math.max(share * 100, 2)}%` }} />
          </span>
        )}
        <Delta trend={trend} />
        {/* The API may attach a caveat to any card — e.g. why a count reads lower than expected. */}
        {node?.note && <small className="lg-note">{node.note}</small>}
      </button>
      <CityCells cities={cities} groupId={id} groupLabel={label} unit="lead" onOpen={onOpen} />
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

// Tone per card, so the breakdowns read apart at a glance. The .tone-* classes come from leadflow.css.
// The self-generated pair shares a tone, so the eye follows raw → qualified down that side of the funnel.
// "Other sources" stays neutral so the four named sources still read first.
const SOURCE_TONES = { architect: 'violet', walkin: 'amber', referral: 'teal', adglobal: 'blue', other: 'grey' };
const QUALIFIED_BY_TONES = { psm: 'green', self: 'teal' };

/**
 * Lead generation board section.
 *
 * @param {object}   props.data     the API's `leadGeneration` object: incoming, selfRaw, qualified,
 *                                  qualifiedBy and bySource. Any card may carry `previous` (and
 *                                  `previousValue`) for its trend, and a `note` shown under its figures.
 *                                  `previousLabel` names the period being compared against.
 * @param {boolean}  props.loading  true while the API is being re-read — numbers stay put and dim
 * @param {function} props.onOpen   called with { id, label, ids } to open the records popup
 */
export function LeadGeneration({ data, loading = false, onOpen }) {
  if (!data) return null;
  const open = typeof onOpen === 'function' ? onOpen : () => {};
  const incoming = data.incoming ?? {};
  const qualified = data.qualified ?? {};
  const qualifiedBy = data.qualifiedBy ?? [];
  const bySource = data.bySource ?? [];
  // Rendered only when the API sends it, so the board is correct either side of the backend change.
  const selfRaw = data.selfRaw;
  // Whatever the payload calls the period it is comparing against — Yesterday, last month, last quarter.
  // Never hard-coded to a month; without one there is nothing honest to compare against.
  const previousLabel = data.previousLabel ?? 'the previous period';
  const qualifiedCount = qualified.count ?? 0;
  // Both intake cards together are what Qualified is drawn from, so they are its denominator.
  const intake = (incoming.count ?? 0) + (selfRaw?.count ?? 0);

  // `key` is pulled out rather than spread, which React treats as a mistake inside a props object.
  const card = ({ key, ...props }) => <FlowCard key={key} previousLabel={previousLabel} onOpen={open} {...props} />;

  return (
    // Four columns, so the wire labels take the standard tier — the dense one is for six or more.
    // See lf-wire-share in leadflow.css, which owns the treatment.
    <section
      className={`lf lg-flow lf-wire-labels${loading ? ' lg-loading' : ''}`}
      aria-labelledby="lg-title"
      aria-busy={loading || undefined}
    >
      <h2 className="lf-title" id="lg-title">Lead generation</h2>

      {/* 1 + 2 · where the period's leads came from. The two are not joined to each other; the column's
          bracket is what carries them together into the qualified pair. Neither shows a share — together
          they are the whole intake. */}
      <section className="lf-c lf-bracket-out" aria-labelledby="lg-intake-h">
        <h3 className="lg-sr" id="lg-intake-h">Raw leads</h3>
        {card({
          id: 'incoming', label: incoming.label || 'Incoming leads from PSM', node: incoming,
          tone: 'ink', size: 'lg', wires: 'has-out', cities: incoming.byCity
        })}
        {selfRaw && card({
          id: 'self-raw', label: selfRaw.label || 'Self-generated raw leads', node: selfRaw,
          tone: 'teal', size: 'md', wires: 'has-out', cities: selfRaw.byCity
        })}
      </section>

      {/* 3 + 4 · who qualified them. Fed by the intake bracket, and closed back up again by this
          column's own bracket so the pair leaves as the single line that feeds Qualified. */}
      <section className="lf-c lf-bracket-in lf-bracket-out lg-c-breakdown" aria-labelledby="lg-qualifiedby-h">
        <h3 className="lg-sr" id="lg-qualifiedby-h">Qualified by</h3>
        {qualifiedBy.map((row) => card({
          key: row.key, id: `qualified-by-${row.key}`, label: row.label, node: row,
          tone: QUALIFIED_BY_TONES[row.key] ?? 'grey', size: 'sm', wires: 'has-in has-out',
          share: shareOf(row.count, qualifiedCount), shareSuffix: 'qualified', cities: row.byCity
        }))}
      </section>

      {/* 5 · the qualified total the pair merges into, with its own city rows. */}
      <div className="lf-c">
        {card({
          id: 'qualified', label: qualified.label || 'Qualified', node: qualified,
          tone: 'blue', size: 'md', wires: 'has-in has-out', cities: qualified.byCity,
          share: shareOf(qualifiedCount, intake), shareSuffix: 'all raw leads'
        })}
      </div>

      {/* Branching off Qualified: where those leads came from. These keep their ₹ value, and the five of
          them account for the whole qualified count. */}
      <section className="lf-c lf-bracket-in lg-c-breakdown lg-c-source" aria-labelledby="lg-source-h">
        <h3 className="lg-group-h" id="lg-source-h">By source</h3>
        {bySource.map((row) => card({
          key: row.key, id: `source-${row.key}`, label: row.label, node: row,
          tone: SOURCE_TONES[row.key] ?? 'grey', size: 'sm', wires: 'has-in',
          share: shareOf(row.count, qualifiedCount), shareSuffix: 'qualified', withValue: true,
          cities: row.byCity
        }))}
      </section>
    </section>
  );
}
