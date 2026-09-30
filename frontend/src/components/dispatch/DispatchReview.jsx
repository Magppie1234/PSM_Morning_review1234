import { Info, X } from 'lucide-react';
import { Fragment, useCallback, useState } from 'react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { SalesRecordsPopup } from '../sales/SalesRecordsPopup.jsx';
import { DispatchRecords } from './DispatchRecords.jsx';

// The Dispatch board, ported from the mockup in docs/mockups/index.html card for card.
//
// This is a faithful port, not an interpretation: the card template, its class structure, the SVG
// connectors between columns, the DUE strip and the column layouts are the mockup's own. What
// changed is the source — the mockup ran on 110 generated orders, this reads Zoho — and the shell,
// since the mockup brought its own sidebar and this sits inside the app.
//
// TWO PLACES THE DATA SHOWS THROUGH THE DESIGN, both stated rather than hidden:
//
//   · The DUE strip (This week / This month / Next month) reads Deals.Dispatch_Date, which is the
//     basis the mockup uses. Every dispatch date Zoho holds is in the PAST — the field records when
//     an order went out, not when it is due — so the three chips read zero. The strip is drawn as
//     designed; filling it needs a planned dispatch date the CRM does not keep.
//   · Four cards have no source at all (Vehicle held, Overdue orders, Installation approved, and the
//     complaints department analysis). They keep their place and say why.

// The mockup's own card colours. `tint` is the soft background its branch cards carry.
const TONES = {
  ink: ['#33405c', ''],
  blue: ['#4f46e5', ''],
  teal: ['#0f8a8a', ''],
  green: ['#2f7a5a', '#f4faf7'],
  amber: ['#9a6b1f', ''],
  red: ['#b03b30', ''],
  violet: ['#5f52a8', '#f6f5fc']
};

const plural = (count, word) => `${count.toLocaleString('en-IN')} ${word}${count === 1 ? '' : 's'}`;
const money = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(amount >= 1e8 ? 1 : 2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

/** The comparison line, in the mockup's wording: "↗ 7% vs 15 Sep 26 (14)". */
function Delta({ node, previousLabel }) {
  if (node?.previous === undefined || !previousLabel) return null;
  const count = node.count ?? 0;
  if (!node.previous) return <span className="dm-cmp">New</span>;
  const change = Math.round((Math.abs(count - node.previous) / node.previous) * 100);
  const up = count >= node.previous;
  const tone = change === 0 ? '' : up ? ' good' : ' bad';
  return (
    <span className={`dm-cmp${tone}`}>
      {up ? '↗' : '↘'} {change}% vs {previousLabel} ({node.previous.toLocaleString('en-IN')})
    </span>
  );
}

/**
 * One card, on the mockup's template: label, the figure with money or the share beside it, the bar,
 * the comparison, then the DUE strip. The first card of a view is the big one.
 */
function DispatchCard({ card, baseLabel, isFirst, isTracker, previousLabel, onOpen }) {
  const missing = card.available === false;
  const count = card.count ?? 0;
  const due = card.due ?? {};
  const [colour, tint] = TONES[card.tone] ?? TONES.ink;
  const share = card.share;
  // Money on the first card of a view, the share on the rest — the mockup's own rule.
  const beside = isFirst && !isTracker
    ? money(card.value)
    : (share != null ? `${(share * 100).toFixed(1)}% of ${String(baseLabel ?? '').toLowerCase()}` : null);

  const open = () => { if (count) onOpen?.({ id: card.key, label: card.label, ids: card.ids ?? [], sub: card.sub }); };

  if (missing) {
    return (
      <div className="dm-stat is-missing" style={{ '--c': colour }}>
        <span className="dm-k"><i aria-hidden="true" />{card.label}</span>
        <span className="dm-none">Not recorded</span>
        <span className="dm-why">{card.why}</span>
      </div>
    );
  }

  return (
    <div
      className={`dm-stat${isFirst ? ' big' : ''}${count ? '' : ' is-empty'}`}
      style={{ '--c': colour, ...(tint ? { '--ct': tint } : {}) }}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}
      aria-label={`${card.label}: ${plural(count, 'order')}${beside ? `, ${beside}` : ''}`}
      title={[card.label, card.sub, beside, count ? 'Click to see the orders' : 'No orders here']
        .filter(Boolean).join('\n')}
    >
      <span className="dm-k"><i aria-hidden="true" />{card.label}</span>
      {card.sub && <span className="dm-note2">{card.sub}</span>}
      <span className="dm-v"><b>{count.toLocaleString('en-IN')}</b>{beside && <span>{beside}</span>}</span>
      <span className="dm-bar"><i style={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }} /></span>
      <Delta node={card} previousLabel={previousLabel} />
      {!card.noWins && (
        <>
          <span className="dm-wins-l">Due</span>
          <div className="dm-wins">
            {[['week', 'This week'], ['month', 'This month'], ['next', 'Next month']].map(([key, label]) => (
              <span
                key={key}
                className={`dm-win${key === 'week' ? ' wk' : ''}`}
                aria-label={`${card.label}, due ${label.toLowerCase()}: ${due[key] ?? 0}`}
              >
                <b>{(due[key] ?? 0).toLocaleString('en-IN')}</b><span>{label}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The connector between two columns, redrawn from the mockup's connSvg: a stub out of every card on
 * the left, one vertical rail, and a stub into every card on the right. It is what makes a branch
 * read as a branch instead of as unrelated cards stacked up.
 */
function Conn({ left, right }) {
  const ys = (n) => Array.from({ length: n }, (_, index) => ((index + 0.5) / n) * 100);
  const from = ys(left);
  const to = ys(right);
  const all = [...from, ...to];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const path = `${from.map((y) => `M0 ${y} H18`).join(' ')} M18 ${lo} V${hi} ${to.map((y) => `M18 ${y} H36`).join(' ')}`;
  return (
    <div className="dm-conn" aria-hidden="true">
      <svg viewBox="0 0 36 100" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="#c3cad8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** A view: columns of cards with the connectors between them, in the mockup's own layout. */
function Funnel({ view, previousLabel, onOpen }) {
  const byKey = new Map((view?.cards ?? []).map((card) => [card.key, card]));
  const columns = (view?.columns ?? [])
    .map((keys) => keys.map((key) => byKey.get(key)).filter(Boolean))
    .filter((column) => column.length);
  if (!columns.length) return null;
  const isTracker = view.key === 'tracker';

  return (
    <div className="dm-flow" aria-label={`${view.name} funnel`}>
      {columns.map((column, index) => (
        <Fragment key={column.map((card) => card.key).join('-')}>
          {index > 0 && <Conn left={columns[index - 1].length} right={column.length} />}
          <div className="dm-fcol">
            {column.map((card) => (
              <div className="dm-cell" key={card.key}>
                <DispatchCard
                  card={card}
                  baseLabel={view.baseLabel}
                  isFirst={index === 0 && column.length === 1}
                  isTracker={isTracker}
                  previousLabel={previousLabel}
                  onOpen={onOpen}
                />
              </div>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** The complaints view's status, stage and priority splits. */
function Split({ title, rows, total }) {
  if (!rows?.length) return null;
  return (
    <div className="dr-split">
      <h4>{title}</h4>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <span className="dr-split-name">{row.key}</span>
            <span className="dr-split-bar" aria-hidden="true">
              <b style={{ width: `${total ? Math.max((row.count / total) * 100, row.count ? 2 : 0) : 0}%` }} />
            </span>
            <strong>{row.count.toLocaleString('en-IN')}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The "i" panel: everything comes from meta.coverage, so it stays true as the CRM is filled in. */
function InfoPanel({ coverage, complaints, onClose }) {
  if (!coverage) return null;
  return (
    <div className="dr-info" role="region" aria-label="Where these numbers come from">
      <button type="button" className="dr-info-close" onClick={onClose} aria-label="Close this panel">
        <X size={15} aria-hidden="true" />
      </button>
      <h3>Where these numbers come from</h3>
      <p>{coverage.populationRule}</p>
      <p>{coverage.stageSource}</p>
      <p>
        The <strong>Due</strong> strip on each card reads Zoho&rsquo;s <code>Dispatch_Date</code>, which is
        the basis the original design uses. Every dispatch date in the CRM is in the past — the field
        records when an order <em>went out</em>, not when it is due — so the three chips read zero
        until a planned dispatch date exists.
      </p>
      <p>
        Checked across all <strong>{coverage.checkedOrders?.toLocaleString('en-IN')}</strong> orders,
        these dispatch fields are <strong>filled</strong>:
      </p>
      <ul className="dr-info-fields">
        {(coverage.filled ?? []).map((entry) => (
          <li key={entry.field}><code>{entry.field}</code> — {entry.filled.toLocaleString('en-IN')}</li>
        ))}
      </ul>
      <p>and these are <strong>empty on every order</strong>, which is why the board reads stages rather than dates:</p>
      <ul className="dr-info-fields">
        {(coverage.emptyFields ?? []).map((field) => <li key={field}><code>{field}</code></li>)}
      </ul>
      {(coverage.unavailableCards ?? []).length > 0 && (
        <>
          <p><strong>Cards the CRM cannot answer</strong></p>
          <ul className="dr-info-points">
            {coverage.unavailableCards.map((entry) => (
              <li key={`${entry.view}-${entry.card}`}><strong>{entry.view} · {entry.card}</strong> — {entry.why}</li>
            ))}
          </ul>
        </>
      )}
      {complaints && (
        <>
          <p><strong>Complaints</strong></p>
          <p>{complaints.moduleNote}</p>
          <ul className="dr-info-points">
            {(complaints.unavailable ?? []).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/** The complaints sub-tab: four cards, an average, and the breakdowns. */
function Complaints({ data, onOpen }) {
  if (!data) return null;
  const openTotal = data.cards.find((card) => card.key === 'open')?.count ?? 0;
  const raisedTotal = data.cards.find((card) => card.key === 'raised')?.count ?? 0;
  return (
    <>
      <div className="dm-grid">
        {data.cards.map((card) => (
          <DispatchCard card={{ ...card, noWins: true }} baseLabel="complaints raised" onOpen={onOpen} key={card.key} />
        ))}
        <div className={`dm-stat${data.average.available ? '' : ' is-missing'}`} style={{ '--c': TONES.violet[0] }}>
          <span className="dm-k"><i aria-hidden="true" />{data.average.label}</span>
          {data.average.available
            ? <span className="dm-v"><b>{data.average.figure}</b><span>{data.average.unit}</span></span>
            : <span className="dm-none">Not measurable</span>}
          <span className="dm-why">{data.average.note}</span>
        </div>
      </div>
      <div className="dr-splits">
        <Split title="Open complaints by status" rows={data.breakdown.status} total={openTotal} />
        <Split title="Open complaints by stage" rows={data.breakdown.stage} total={openTotal} />
        <Split title="Open complaints by priority" rows={data.breakdown.priority} total={openTotal} />
        <Split title="Raised from" rows={data.breakdown.source} total={raisedTotal} />
      </div>
    </>
  );
}

const TABS = [
  { key: 'planner', label: 'Dispatch Planner' },
  { key: 'scheduler', label: 'Dispatch Scheduler' },
  { key: 'tracker', label: 'Dispatch Tracker' },
  { key: 'complaints', label: 'Complaints' }
];

/**
 * @param {string} props.timeframe the board's period, from the shared header
 */
export function DispatchReview({ timeframe }) {
  // The popup lives here rather than in the parent: orders and complaints are two different record
  // sets, and only this component knows which tab is open.
  const [card, setCard] = useState(null);
  const onOpen = useCallback((picked) => setCard(picked), []);
  // The Tracker is the view people live in, so it opens first — the mockup's own default.
  const [tab, setTab] = useState('tracker');
  const [info, setInfo] = useState(false);
  const { data, error, loading } = useDashboard({ timeframe }, '/api/dispatch-board');

  if (!data) {
    if (loading) return <BoardSkeleton />;
    return <p className="ps-error">{error ?? 'Dispatch data could not be loaded.'}</p>;
  }

  const view = data.views?.find((entry) => entry.key === tab);
  const isComplaints = tab === 'complaints';

  return (
    <section className={`dr${loading ? ' is-stale' : ''}`} aria-busy={loading || undefined}>
      <nav className="design-sections" aria-label="Dispatch views">
        {TABS.map((entry) => (
          <button key={entry.key} aria-pressed={tab === entry.key} onClick={() => setTab(entry.key)}>
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="dr-head">
        <h2 className="dr-title">{isComplaints ? 'Complaints' : `${view?.name} funnel`}</h2>
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
          {isComplaints
            ? `${data.complaints.coverage.tickets.toLocaleString('en-IN')} complaints in Zoho. The `
              + `${data.complaints.coverage.amsVisits.toLocaleString('en-IN')} AMS visits in the same module belong to the AMS board and are left out.`
            : view?.desc}
        </p>
      </div>

      {info && <InfoPanel coverage={data.meta?.coverage} complaints={data.meta?.complaints} onClose={() => setInfo(false)} />}

      {isComplaints
        ? <Complaints data={data.complaints} onOpen={onOpen} />
        : <Funnel view={view} previousLabel={data.meta?.previousLabel} onOpen={onOpen} />}

      {card && (isComplaints
        ? <SalesRecordsPopup card={card} records={data.complaints?.records ?? []} onClose={() => setCard(null)} />
        : (
          <DispatchRecords
            card={card}
            view={view?.name}
            sub={card.sub}
            records={data.records ?? []}
            onClose={() => setCard(null)}
          />
        ))}

    </section>
  );
}
