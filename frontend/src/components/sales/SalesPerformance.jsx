import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Sales performance, drawn as the PSM board's Funnel: one connected line of cards with
// elbow wires, reusing LeadFlow's own .lf- markup and classes. This single-chain layout
// is the one the customer reviewed and approved.
//
//   Est. closure  →  Overdue orders  →  S1…S5 (bracketed)  →  S6  →  Closed  →  Handover
//
// The first card (`estClosure`) counts deals whose estimated closure date falls in the
// selected period, so its wording changes with the period. It arrives in the node's own
// `label` and is rendered as given, never hard-coded. `closed` near the end is a wholly
// different figure — actual banked closures — and the API deliberately retired the old
// `closures` key so a forecast can never be drawn in its place.
//
// Watch the windows: `estClosure` spans the WHOLE period, including estimated dates that
// have already passed, while every other card counts to date. That is stated on the
// card's tooltip because the chain otherwise implies one continuous window.
//
// One thing to know if you are reading these numbers rather than this file: `Overdue
// orders` deliberately ignores the period filter, and S1–S5 are a cohort (where the
// period's intake stands today) while `Closed` is period activity (what was banked,
// whenever the lead arrived). Drawn as one line the chain implies they follow from each
// other. That is the approved design; each card's tooltip says what it actually counts,
// and the API's `note` field is the hook for putting a caveat on the card face itself.
//
// Every figure comes from the API as-is. The one derived number is each S-card's share of
// S1–S5, a presentation aid, not a CRM figure — there is no previous-period number in this
// payload, so the funnel's "vs last period" delta is deliberately absent. Zeroes at S5, S6
// and Handover are genuine, not a bug: a lead takes months to reach those rungs.
//
// The customer talks in S1–S6, but Zoho has no such field: the backend maps those labels
// onto the "Current Stage" picklist. So every stage card prints the real Zoho stage name
// under its S-label and names the field in its tooltip.

const ZOHO_FIELD = 'Current Stage in Zoho';
const COUNT_MS = 420;

// The three cards that continue the line after the ladder. `stage` marks the ones that
// still correspond to a Zoho Current Stage value; Order Booked and Handover are outcomes.
// "Order Booked" is the customer's wording for the `closed` node — the Zoho value behind
// it is still "Closed", which is what the record list shows, so do not rename the key.
const TAIL = [
  { prop: 'principal', label: 'Principal (S6)', tone: 'teal', stage: true },
  { prop: 'closed', label: 'Order Booked', tone: 'violet', stage: false },
  { prop: 'handover', label: 'Handover to design', tone: 'blue', stage: false }
];

const pct = (value) => `${(value * 100).toFixed(1)}%`;

function usePrefersReducedMotion() {
  const query = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [reduced, setReduced] = useState(query);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// Layout effect on the client so the first animated frame is painted in the same commit as
// the new props (no flash of the final figure); plain effect on the server, where there is
// no layout pass. Vite renders client-side only, so this is really just harness-safe.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Counts roll from the old figure to the new one when the period, city or filter changes,
// so a refresh reads as movement rather than a silent swap.
//
// The prop is the source of truth, always. `frame` is tagged with the target it belongs to,
// so a value left over from a previous target is never rendered — if the animation cannot
// run (reduced motion, no rAF, hidden tab) or is interrupted mid-flight, the hook falls
// straight back to the live prop. A stale number can therefore never sit on screen above
// city rows that have already updated.
function useCountUp(target) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(null);
  // The figure currently on screen, so an interrupted roll picks up where the eye left off.
  const onScreenRef = useRef(target);

  useBeforePaint(() => {
    const from = onScreenRef.current;
    const canAnimate =
      !reduced &&
      from !== target &&
      typeof window !== 'undefined' &&
      !!window.requestAnimationFrame &&
      (typeof document === 'undefined' || document.visibilityState === 'visible');

    if (!canAnimate) {
      onScreenRef.current = target;
      setFrame(null);
      return undefined;
    }

    let raf = 0;
    let startedAt = 0;
    let live = true;
    let ticked = false;
    // Landing always means "show the prop", never the figure we were heading to.
    const land = () => {
      if (!live) return;
      live = false;
      onScreenRef.current = target;
      setFrame(null);
    };
    const step = (now) => {
      if (!live) return;
      ticked = true;
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / COUNT_MS);
      if (progress >= 1) {
        land();
        return;
      }
      const value = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      onScreenRef.current = value;
      setFrame({ value, target });
      raf = window.requestAnimationFrame(step);
    };

    setFrame({ value: from, target });
    raf = window.requestAnimationFrame(step);
    // Two watchdogs, because a rolling figure must never outlive its data:
    // if the first frame never arrives (rAF throttled behind our back) give up almost at
    // once, and cap the whole roll in case frames stop arriving part-way through.
    const firstFrame = window.setTimeout(() => { if (!ticked) land(); }, 120);
    const wholeRoll = window.setTimeout(land, COUNT_MS + 150);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(firstFrame);
      window.clearTimeout(wholeRoll);
      // Interrupted by newer data: drop this roll, keep the figure the eye is on as the
      // next starting point, and render the prop until the next roll takes over.
      live = false;
      setFrame(null);
    };
  }, [target, reduced]);

  return frame && frame.target === target ? frame.value : target;
}

// The funnel's figure line: count, money beside it, and an optional honest share line.
function Figures({ count, valueLabel, shareText }) {
  const shown = useCountUp(count ?? 0);
  return (
    <span className="lf-figures">
      <strong>{shown.toLocaleString('en-IN')}</strong>
      {count ? (
        // keyed on the label so a changed value re-runs the fade
        <span className="lf-inline-value sp-fade" key={valueLabel} title="Total opportunity value in Zoho">{valueLabel}</span>
      ) : null}
      {/* The share normally rides the wire; this copy only shows once the wires are
          hidden at 1180px and below. CSS picks one, never both. */}
      {count && shareText ? <em className="sp-inline-share">{shareText}</em> : null}
    </span>
  );
}

// The four wires LeadFlow draws around every card; the column type decides which show.
// `onWire` rides the incoming horizontal wire, so the eye reads arrow → figure → card.
// It is decoration: aria-hidden, with the same figure spelled out in the card's own
// aria-label. Below 1180px leadflow hides the wires, and the CSS moves this back inside
// the card so the figure never disappears with them.
function Node({ wires = 'has-in has-out', onWire, children }) {
  return (
    <div className={`lf-node ${wires}`}>
      <i className="lf-w in-h" aria-hidden="true" />
      <i className="lf-w in-v" aria-hidden="true" />
      {onWire && <b className="sp-wire-share" aria-hidden="true">{onWire}</b>}
      {children}
      <i className="lf-w out-h" aria-hidden="true" />
      <i className="lf-w out-v" aria-hidden="true" />
    </div>
  );
}

// One card on the line. `hint` is the real Zoho stage name, printed under the label.
// A card with no records keeps its shape and its place in the tab order but opens nothing.
function FlowCard({ node, id, label, hint, about, tone, size = 'md', extra = '', share, onOpen }) {
  const count = node?.count ?? 0;
  const empty = count === 0;
  const spoken = [label, hint].filter(Boolean).join(' · ');
  // Any card may carry a caveat from the API (e.g. how many of its records have no
  // Current Stage set). It is on the face of the card, so it belongs in the spoken name
  // too — an explicit aria-label would otherwise hide it from a screen reader.
  const note = node?.note;
  // The share is drawn on the wire, which is decoration — so the full wording lives here
  // and in the tooltip, and nothing is lost when the visible label is shortened or hidden.
  const shareText = !empty && share != null ? `${pct(share)} of S1–S5` : null;
  const ariaLabel = [
    empty
      ? `${spoken}: no records in this period`
      : `Open the ${count} ${count === 1 ? 'record' : 'records'} in ${spoken}, worth ${node.valueLabel}`,
    shareText,
    note
  ]
    .filter(Boolean)
    .join('. ');
  // `about` is a standing caveat about what the card counts (e.g. that it ignores the
  // period filter); `note` is a figure-specific caveat the API sends with the data.
  const title = [spoken, hint ? ZOHO_FIELD : null, shareText, about, note, empty ? 'No records in this period' : 'Click to see the records']
    .filter(Boolean)
    .join('\n');

  // `spoken` carries the Zoho stage name into the popup's title too, so a records list
  // opened from S2 is headed "S2 · Only Validated", never a bare S-number.
  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id, label: spoken, ids: node?.ids ?? [] });
  }, [empty, onOpen, id, spoken, node]);

  return (
    <button
      type="button"
      className={`lf-card lf-${size}${tone ? ` tone-${tone}` : ''}${extra ? ` ${extra}` : ''}${empty ? ' sp-empty' : ''}`}
      onClick={click}
      aria-disabled={empty || undefined}
      aria-label={ariaLabel}
      title={title}
    >
      <span className="lf-label"><i aria-hidden="true" />{label}</span>
      {hint && <span className="sp-name">{hint}</span>}
      <Figures count={count} valueLabel={node?.valueLabel} shareText={shareText} />
      {!empty && share != null && (
        <span className="lf-share" aria-hidden="true"><b style={{ width: `${Math.max(share * 100, 2)}%` }} /></span>
      )}
      {empty && <span className="lf-delta flat">None in this period</span>}
      {note && <span className="sp-card-note">{note}</span>}
    </button>
  );
}

// Delhi / Hyderabad / Others, sitting under their card as part of the same block. They
// are siblings of the card button, not children of it — nested buttons are invalid.
// `group` is the parent card's own label, so the rows say what they are a breakdown of
// without this component needing to know what the card currently counts.
function CityRow({ city, group, groupId, onOpen }) {
  const count = city?.count ?? 0;
  const empty = count === 0;
  const click = useCallback(() => {
    if (empty) return;
    onOpen?.({ id: `${groupId}-${city.key}`, label: `${group} · ${city.label}`, ids: city?.ids ?? [] });
  }, [empty, onOpen, city, group, groupId]);

  return (
    <li>
      <button
        type="button"
        className={`sp-city${empty ? ' sp-empty' : ''}`}
        onClick={click}
        aria-disabled={empty || undefined}
        aria-label={
          empty
            ? `${group} · ${city.label}: no records in this period`
            : `Open the ${count} ${count === 1 ? 'record' : 'records'} in ${group} · ${city.label}, worth ${city.valueLabel}`
        }
        title={empty ? `${city.label}\nNo records in this period` : `${city.label}\nClick to see the records`}
      >
        <span className="sp-city-name">{city.label}</span>
        <strong>{count.toLocaleString('en-IN')}</strong>
        {empty
          ? <span className="lf-delta flat">None in this period</span>
          : <span className="lf-inline-value sp-fade" key={city.valueLabel}>{city.valueLabel}</span>}
      </button>
    </li>
  );
}

/**
 * Sales performance section of the Sales board, drawn as one connected funnel.
 *
 * @param {object}   props.data     the `salesPerformance` object from the API
 * @param {boolean}  props.loading  true while the API is being re-read — the numbers
 *                                  already on screen stay put and dim, never a spinner
 * @param {Function} props.onOpen   called with { id, label, ids } to open the records popup
 */
export function SalesPerformance({ data, loading, onOpen }) {
  if (!data) return null;
  // `estClosure` is a forecast; `closed` is actual revenue. The API retired the old
  // `closures` key on purpose, so anything still reading it gets undefined rather than
  // quietly drawing a forecast where banked money used to be. Do not add a fallback to
  // `closures` here — that would reinstate the exact confusion the rename prevents.
  const { estClosure, overdue, stages = [], principal, closed, handover } = data;
  const cities = estClosure?.byCity ?? [];
  const nodes = { principal, closed, handover };
  const tail = TAIL.filter(({ prop }) => nodes[prop]);
  // Denominator for the share line: the five open stages, nothing else.
  const openTotal = stages.reduce((sum, stage) => sum + (stage.count ?? 0), 0);
  // The API supplies the wording, because it changes with the period ("this month" /
  // "this week" / "last week"). Never hard-coded here.
  const estLabel = estClosure?.label || 'Est. closure for this period';
  // Columns: [est-closure + overdue stacked], the ladder, then the tail. Counted rather
  // than fixed so the chain still fills the row while the payload is mid-flight.
  const columns = 2 + tail.length;

  return (
    <section
      className={`lf sp-lf sp-cols-${columns}${loading ? ' is-stale' : ''}`}
      aria-labelledby="sp-title"
      aria-busy={loading || undefined}
    >
      <h2 id="sp-title" className="lf-title">Sales performance</h2>

      {/* 1 · the two period cards, stacked in one column and fanning out together into the
             ladder — the way the PSM board stacks Contacted / Not contacted. */}
      <div className="lf-c lf-bracket-out sp-c-source">
        <Node wires="has-out">
          <div className="sp-stack">
            <FlowCard
              node={estClosure}
              id="estClosure"
              label={estLabel}
              about={
                'A forecast, not banked revenue, and it spans the FULL period — estimated dates '
                + 'that have already passed as well as those still to come. Every other card here '
                + 'counts to date, so the two are not the same window.'
              }
              tone="green"
              size="lg"
              extra="sp-card-top"
              onOpen={onOpen}
            />
            <ul className="sp-cities" aria-label={`${estLabel} by city`}>
              {cities.map((city) => (
                <CityRow city={city} group={estLabel} groupId="estClosure" onOpen={onOpen} key={city.key} />
              ))}
            </ul>
          </div>
        </Node>

        {/* Overdue sits under the est-closure card in the same column. Rendered only once
            the API sends the node, so the chain does not break mid-deploy. */}
        {overdue && (
          <Node wires="has-out">
            <FlowCard
              node={overdue}
              id="overdue"
              label={overdue.label || 'Overdue orders'}
              about="Counts every open deal whose estimated closure date has passed, whichever period is selected."
              tone="amber"
              onOpen={onOpen}
            />
          </Node>
        )}
      </div>

      {/* 2 · the ladder: S1 lightest → S5 darkest. Each card's share of S1–S5 rides the
             wire pointing at it, so the eye reads arrow → figure → card. */}
      <div className="lf-c lf-c-outcomes lf-bracket-in lf-bracket-out">
        {stages.map((stage) => {
          const share = openTotal ? (stage.count ?? 0) / openTotal : null;
          return (
            <Node onWire={stage.count && share != null ? pct(share) : null} key={stage.key}>
              <FlowCard
                node={stage}
                id={stage.key}
                label={stage.short || stage.key}
                hint={stage.label}
                tone="green"
                size="sm"
                extra={`sp-stage sp-${(stage.short || stage.key || '').toLowerCase()}`}
                share={share}
                onOpen={onOpen}
              />
            </Node>
          );
        })}
      </div>

      {/* 3, 4, 5 · Principal (S6) → Order Booked → Handover to design */}
      {tail.map(({ prop, label, tone, stage }, index) => (
        <div className="lf-c" key={prop}>
          <Node wires={index === tail.length - 1 ? 'has-in' : 'has-in has-out'}>
            <FlowCard
              node={nodes[prop]}
              id={nodes[prop].key ?? prop}
              label={label}
              hint={stage ? nodes[prop].label : undefined}
              tone={tone}
              size="md"
              onOpen={onOpen}
            />
          </Node>
        </div>
      ))}

      <p className="sp-note">
        S1–S6 are Magppie labels for the <strong>Current Stage</strong> picklist in Zoho — there is no S-number field in the CRM.
        The Zoho stage name is printed on every stage card.
      </p>
    </section>
  );
}
