// Lead generation section of the Sales board.
//
// Built on the PSM board's funnel markup (LeadFlow.jsx / leadflow.css) so the two boards read as one
// product: .lf grid, .lf-c columns, .lf-node wires, .lf-card buttons and .lf-share bars. Only the few
// things the funnel has no equivalent for — the four-column track, the city rows that live inside the
// first two cards, and the "By source" group heading — carry lg- classes of their own.
//
//   INCOMING ──► QUALIFICATION ──┬─► PSM QUALIFIED  ─┬─► ARCHITECT / WALK-INS / REFERRALS
//   (+ city rows)  (+ city rows)  └─► SELF QUALIFIED ─┘   / AD GLOBAL / OTHER SOURCES
//
// Every figure comes from the API (`leadGeneration`); the only derived values are the share lines,
// which are plain ratios of two numbers the API sent. There is no previous-period figure in this
// payload, so the funnel's "vs last period" delta is deliberately absent.
import { useEffect, useRef, useState } from 'react';

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
 * Counts from the figure on screen up (or down) to `target` whenever `target` changes — a new period,
 * a city filter, a refresh.
 *
 * The prop is the source of truth, in three layers, because getting this wrong puts a number on the
 * board that contradicts the rows underneath it:
 *   1. `goal` records which value the frames are heading for. A render whose target is not that value
 *      shows the real number, never the last frame of a superseded animation.
 *   2. a timer settles the figure even if no animation frame ever arrives — requestAnimationFrame is
 *      throttled to a standstill in a hidden or occluded tab, and relying on it alone once left the
 *      old count sitting above freshly filtered city rows.
 *   3. if the browser cannot animate at all, the prop is rendered as-is.
 */
function useCountUp(target) {
  const safe = Number.isFinite(target) ? target : 0;
  const [anim, setAnim] = useState({ goal: safe, value: safe });
  const startRef = useRef(safe);

  // Re-aim during render (React's "adjust state when a prop changes" pattern) so the first paint after
  // a change is already counting from the old figure instead of flashing the new one.
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

// Share of a parent count, or null when there is no honest denominator.
const shareOf = (count, total) => (total > 0 ? (count ?? 0) / total : null);

// Spoken description of a card, used for aria-label and the hover title. The money value is spoken even
// on the cards that deliberately show only a count, so nothing the API sent is lost to a screen reader.
const describe = (label, node, shareText) => {
  const count = node?.count ?? 0;
  const note = node?.note ? `. ${node.note}` : '';
  if (!count) return `Open ${label}: no leads${note}`;
  const money = node?.valueLabel ? `, worth ${node.valueLabel}` : '';
  return `Open ${label}: ${count} ${plural(count)}${money}${shareText ? `, ${shareText}` : ''}${note}`;
};

/**
 * One funnel card. Mirrors FlowCard in LeadFlow.jsx: the four wire elements wrap the button, and the
 * column's bracket classes decide which of them actually show.
 *
 * `rows` (optional) are the city breakdown rows that belong to the card. They are real buttons, so they
 * sit just below the card button inside the same .lf-node and are merged into it visually — a button
 * cannot be nested inside another button.
 */
function FlowCard({ id, label, node, tone, size, wires, share, shareSuffix, withValue, rows, onOpen }) {
  const count = node?.count ?? 0;
  const shareText = share === null || share === undefined ? '' : `${pct(share)} of ${shareSuffix}`;
  const spoken = describe(label, node, shareText);
  const hasRows = Array.isArray(rows) && rows.length > 0;

  return (
    <div className={`lf-node ${wires}${hasRows ? ' lg-node-rows' : ''}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      <button
        type="button"
        className={`lf-card lf-${size} tone-${tone}${count ? '' : ' lg-zero'}`}
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
          {count ? shareText && <em>{shareText}</em> : <em className="lg-none">No leads</em>}
        </span>
        {count > 0 && shareText && (
          <span className="lf-share" aria-hidden="true">
            <b style={{ width: `${Math.max(share * 100, 2)}%` }} />
          </span>
        )}
        {/* The API may attach a caveat to any card — e.g. why a count is smaller than it used to be. */}
        {node?.note && <small className="lg-note">{node.note}</small>}
      </button>
      {hasRows && (
        <ul className="lg-rows">
          {rows.map((city) => (
            <CityRow key={city.key} groupId={id} groupLabel={label} city={city} onOpen={onOpen} />
          ))}
        </ul>
      )}
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

// One city row inside the Incoming / Qualification card. Count only by design — the card it belongs to
// shows no money either; the ₹ value rides in the label so a screen reader still gets it.
function CityRow({ groupId, groupLabel, city, onOpen }) {
  const label = `${groupLabel} · ${city.label}`;
  const spoken = describe(label, city, '');
  return (
    <li>
      <button
        type="button"
        className={`lg-row${city.count ? '' : ' lg-zero'}`}
        onClick={() => onOpen({ id: `${groupId}-${city.key}`, label, ids: city.ids ?? [] })}
        aria-label={spoken}
        title={spoken}
      >
        <span className="lg-row-label">{city.label}</span>
        {city.count ? (
          <strong className="lg-row-figure lg-flip" key={city.count}>{city.count}</strong>
        ) : (
          <span className="lg-none">No leads</span>
        )}
      </button>
    </li>
  );
}

// Tone per card, so the breakdowns read apart at a glance. The .tone-* classes come from leadflow.css.
// "Other sources" stays neutral so the four named sources still read first.
const SOURCE_TONES = { architect: 'violet', walkin: 'amber', referral: 'teal', adglobal: 'blue', other: 'grey' };
const QUALIFIED_BY_TONES = { psm: 'green', self: 'teal' };

/**
 * Lead generation board section.
 *
 * @param {object}   props.data     the API's `leadGeneration` object: incoming, qualified, qualifiedBy
 *                                  and bySource. Any card may carry a `note` string, shown under its
 *                                  figures.
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
  // `incoming` is the whole intake for the period, so it is the denominator for Qualification's share.
  const incomingCount = incoming.count ?? 0;
  const qualifiedCount = qualified.count ?? 0;

  return (
    <section
      className={`lf lg-flow${loading ? ' lg-loading' : ''}`}
      aria-labelledby="lg-title"
      aria-busy={loading || undefined}
    >
      <h2 className="lf-title" id="lg-title">Lead generation</h2>

      {/* 1. Top of the funnel — no share line, exactly like Raw leads on the PSM board. */}
      <div className="lf-c">
        <FlowCard
          id="incoming"
          label="Incoming leads from PSM"
          node={incoming}
          tone="ink"
          size="lg"
          wires="has-out"
          rows={incoming.byCity ?? []}
          onOpen={open}
        />
      </div>

      {/* 2. Qualification, with the same three city rows inside it. */}
      <div className="lf-c">
        <FlowCard
          id="qualified"
          label="Qualification"
          node={qualified}
          tone="blue"
          size="md"
          wires="has-in has-out"
          share={shareOf(qualifiedCount, incomingCount)}
          shareSuffix="incoming"
          rows={qualified.byCity ?? []}
          onOpen={open}
        />
      </div>

      {/* 3. Who qualified them — a cut of the qualified leads, so it brackets off Qualification and
             closes back up again to carry the same set on to the source column. */}
      <section className="lf-c lf-bracket-in lf-bracket-out lg-c-breakdown" aria-labelledby="lg-qualifiedby-h">
        <h3 className="lg-sr" id="lg-qualifiedby-h">Qualified by</h3>
        {qualifiedBy.map((row) => (
          <FlowCard
            key={row.key}
            id={`qualified-by-${row.key}`}
            label={row.label}
            node={row}
            tone={QUALIFIED_BY_TONES[row.key] ?? 'grey'}
            size="sm"
            wires="has-in has-out"
            share={shareOf(row.count, qualifiedCount)}
            shareSuffix="qualified"
            onOpen={open}
          />
        ))}
      </section>

      {/* 4. The other cut of the same qualified leads: where they came from. These keep their ₹ value,
             and the five of them account for the whole qualified count. */}
      <section className="lf-c lf-bracket-in lg-c-breakdown lg-c-source" aria-labelledby="lg-source-h">
        <h3 className="lg-group-h" id="lg-source-h">By source</h3>
        {bySource.map((row) => (
          <FlowCard
            key={row.key}
            id={`source-${row.key}`}
            label={row.label}
            node={row}
            tone={SOURCE_TONES[row.key] ?? 'grey'}
            size="sm"
            wires="has-in"
            share={shareOf(row.count, qualifiedCount)}
            shareSuffix="qualified"
            withValue
            onOpen={open}
          />
        ))}
      </section>
    </section>
  );
}
