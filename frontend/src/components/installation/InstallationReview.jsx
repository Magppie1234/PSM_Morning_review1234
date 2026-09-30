import { Info, X } from 'lucide-react';
import { Fragment, useCallback, useState } from 'react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { SalesRecordsPopup } from '../sales/SalesRecordsPopup.jsx';

// The Installation board:
//
//   Incoming project → Site readiness → Installation started → Installation due → Handover
//
// drawn with the same card and connector treatment as the Dispatch board, so the two operations
// boards read identically. Three of the five cards carry a three-up strip, which is the customer's
// own breakdown for each: days running, due window, and city.
//
// THE ORDER SPLIT sits ABOVE the funnel rather than in it, because it is a filter on everything
// rather than a stage: choosing Kitchen narrows all five cards and their sub-cards at once.
//
// What the CRM does and does not hold for installation is on the "i" panel, but two things are
// worth knowing while reading the board: Est. Handover Date is filled on 129 of 7,645 orders, so
// "Installation due" only ever sees those; and Final Handover holds 1,910 orders that are mostly a
// legacy import rather than recent completions.

const TONES = {
  blue: ['#4f46e5', ''],
  teal: ['#0f8a8a', ''],
  violet: ['#5f52a8', '#f6f5fc'],
  amber: ['#9a6b1f', ''],
  green: ['#2f7a5a', '#f4faf7']
};

const plural = (count, word) => `${count.toLocaleString('en-IN')} ${word}${count === 1 ? '' : 's'}`;
const money = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(amount >= 1e8 ? 1 : 2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

/** One card, with its three-up breakdown where it has one. */
function Card({ card, largest, isFirst, onOpen }) {
  const [colour, tint] = TONES[card.tone] ?? TONES.blue;
  const count = card.count ?? 0;
  // NO PERCENTAGE ON THIS BOARD, deliberately. The five cards are five different stages and an
  // order sits at one of them, so none contains another and there is no whole for a part to be of.
  // Dividing by the first card produced "11,470% of incoming" on Handover — a percentage larger
  // than its own denominator, which is the tell that the denominator was wrong. The money is shown
  // instead, on every card, because that is a real figure for each.
  const beside = card.valueLabel || (isFirst ? money(card.value) : null);
  // The bar is scale only — this card against the biggest on the board — and is hidden from
  // assistive tech because it makes no claim.
  const width = largest ? Math.max((count / largest) * 100, count ? 2 : 0) : 0;
  const open = (ids, label) => { if (ids?.length) onOpen?.({ id: card.key, label, ids }); };

  return (
    <div
      className={`dm-stat${isFirst ? ' big' : ''}${count ? '' : ' is-empty'}`}
      style={{ '--c': colour, ...(tint ? { '--ct': tint } : {}) }}
      role="button"
      tabIndex={0}
      onClick={() => open(card.ids, card.label)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(card.ids, card.label); } }}
      aria-label={`${card.label}: ${plural(count, 'order')}`}
      title={[card.label, card.sub, card.note, count ? 'Click to see the orders' : 'No orders here'].filter(Boolean).join('\n')}
    >
      <span className="dm-k"><i aria-hidden="true" />{card.label}</span>
      {card.sub && <span className="dm-note2">{card.sub}</span>}
      <span className="dm-v"><b>{count.toLocaleString('en-IN')}</b>{beside && <span>{beside}</span>}</span>
      <span className="dm-bar" aria-hidden="true"><i style={{ width: `${width}%` }} /></span>
      {card.subs?.length > 0 && (
        <>
          <span className="dm-wins-l">{card.key === 'handover' ? 'By city' : card.key === 'due' ? 'Due' : 'Running for'}</span>
          <div className="dm-wins">
            {card.subs.map((sub) => (
              <span
                key={sub.key}
                className="dm-win"
                role="button"
                tabIndex={0}
                onClick={(event) => { event.stopPropagation(); open(sub.ids, `${card.label} · ${sub.label}`); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); open(sub.ids, `${card.label} · ${sub.label}`); }
                }}
                aria-label={`${card.label}, ${sub.label}: ${sub.count}`}
              >
                <b>{(sub.count ?? 0).toLocaleString('en-IN')}</b><span>{sub.label}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {/* A caveat the API sends with the figure — what the card could not measure and why. */}
      {card.note && <span className="dm-why">{card.note}</span>}
    </div>
  );
}

/** The connector between columns, the same geometry the Dispatch funnel uses. */
function Conn() {
  return (
    <div className="dm-conn" aria-hidden="true">
      <svg viewBox="0 0 36 100" preserveAspectRatio="none">
        <path d="M0 50 H36" fill="none" stroke="#c3cad8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function InfoPanel({ coverage, onClose }) {
  if (!coverage) return null;
  return (
    <div className="dr-info" role="region" aria-label="Where these numbers come from">
      <button type="button" className="dr-info-close" onClick={onClose} aria-label="Close this panel">
        <X size={15} aria-hidden="true" />
      </button>
      <h3>Where these numbers come from</h3>
      <p>{coverage.ageSource}</p>
      <p>{coverage.handoverNote}</p>
      <p>These installation fields are <strong>thinly filled</strong>, so a card built on one sees only those orders:</p>
      <ul className="dr-info-fields">
        {(coverage.thinFields ?? []).map((entry) => (
          <li key={entry.field}><code>{entry.field}</code> — {entry.filled.toLocaleString('en-IN')} of {coverage.ofAll?.toLocaleString('en-IN')}</li>
        ))}
      </ul>
      <p>and these are <strong>empty on every order</strong>:</p>
      <ul className="dr-info-fields">
        {(coverage.emptyFields ?? []).map((field) => <li key={field}><code>{field}</code></li>)}
      </ul>
    </div>
  );
}

/**
 * @param {string} props.timeframe the board's period, from the shared header
 */
export function InstallationReview({ timeframe }) {
  const [split, setSplit] = useState('all');
  const [card, setCard] = useState(null);
  const [info, setInfo] = useState(false);
  const onOpen = useCallback((picked) => setCard(picked), []);
  const { data, error, loading } = useDashboard({ timeframe, split }, '/api/installation-board');

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return <p className="ps-error">{error ?? 'Installation data could not be loaded.'}</p>;
  }

  const cards = data.installation?.cards ?? [];
  const largest = Math.max(1, ...cards.map((entry) => entry.count ?? 0));

  return (
    <section className={`dr${loading ? ' is-stale' : ''}`} aria-busy={loading || undefined}>
      {/* THE ORDER SPLIT, above the funnel. It filters every card at once, which is why it is not a
          card itself — putting it in the chain would imply orders flow through it. */}
      <div className="in-split" role="group" aria-label="Order split">
        <span className="in-split-label">Order split</span>
        <div className="in-split-buttons">
          {(data.filters?.splits ?? []).map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={split === entry.key ? 'on' : undefined}
              aria-pressed={split === entry.key}
              onClick={() => setSplit(entry.key)}
            >
              {entry.label}<span className="n">{entry.count.toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dr-head">
        <h2 className="dr-title">Installation funnel</h2>
        <button
          type="button"
          className={`dr-info-btn${info ? ' is-on' : ''}`}
          onClick={() => setInfo((open) => !open)}
          aria-expanded={info}
          aria-label="Where these numbers come from"
          title="Where these numbers come from"
        >
          <Info size={15} aria-hidden="true" />
        </button>
        <p className="dr-desc">
          Incoming project → site readiness → installation started → due → handover.
          Showing <strong>{data.meta?.splitLabel}</strong> — {data.meta?.coverage?.orders?.toLocaleString('en-IN')} orders.
        </p>
      </div>

      {info && <InfoPanel coverage={data.meta?.coverage} onClose={() => setInfo(false)} />}

      {/* `in-flow` lets this funnel shrink to the column instead of scrolling sideways. The Dispatch
          board keeps the fixed card width it was matched to, so the class is on this board only. */}
      <div className="dm-flow in-flow" aria-label="Installation funnel">
        {cards.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 && <Conn />}
            <div className="dm-fcol">
              <div className="dm-cell">
                <Card card={entry} largest={largest} isFirst={index === 0} onOpen={onOpen} />
              </div>
            </div>
          </Fragment>
        ))}
      </div>

      {card && (
        <SalesRecordsPopup card={card} records={data.records ?? []} onClose={() => setCard(null)} />
      )}

      <p className="dr-note">
        Click a card, or one of its three figures, to see the orders. The <strong>order split</strong>{' '}
        above narrows every card at once. Each card is a <strong>separate stage</strong> and an order
        sits at one of them, so the cards do not add up to each other and carry no percentage — the
        bar is scale only. <strong>Installation started</strong> is broken down by how
        long each job has been running, from the dated stage history; <strong>Installation due</strong>{' '}
        by Est. Handover Date, which only 129 orders carry; and <strong>Handover</strong> by city.
      </p>
    </section>
  );
}
