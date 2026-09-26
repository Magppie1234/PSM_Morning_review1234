import { useCallback, useMemo } from 'react';
import { crmRecordUrl } from '../../config/crm.js';

// The Sales board's weekly view: the opportunities in play, split into Monday-start week blocks that
// sit side by side and scroll sideways, the way the customer's mock-up draws them. Each block is headed
// with its date range and lists one row per opportunity with four things — client, value, stage, and the
// follow-up with its next action.
//
// Three facts about the data shape everything here, and all three come from the API, not from this file:
//
//   1. `weekKey` is keyed on the FOLLOW-UP date, not on when the lead was created — which is what makes
//      a red date mean anything. An opportunity with no follow-up booked therefore belongs to no week at
//      all. Measured on the live CRM (month to date) only 105 of 310 opportunities in play carry one, so
//      two records in three would simply vanish if this view rendered the week list and nothing else.
//      They get a block of their own, headed with its count, because an opportunity nobody has booked a
//      follow-up for is exactly what this board exists to surface.
//   2. `weeks` covers the selected period, but a follow-up can fall either side of it — some are overdue
//      as far back as December 2025. Those get an Overdue block before the weeks and a Later block after
//      them, so they read as "before this period" and "after it" rather than as ordinary weeks. If the
//      API ever sends those buckets inside `weeks` itself, the records land in them and these two blocks
//      fall away on their own: nothing is drawn twice either way.
//   3. `records` is the whole period universe, closed and dead opportunities included. This view is
//      "what's in play", so it drops `closed` and `DEAD` and says so on the face of the band.
//
// Every remaining record is drawn exactly once, and the band states the real coverage rather than
// letting a mostly-empty column read as a broken view.

const CRORE = 1e7;

// Today in IST, as a YYYY-MM-DD key — the same day boundary the backend uses, so "overdue" here and
// "overdue" on the funnel mean the same thing. en-CA is the locale that spells a date that way.
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// A YYYY-MM-DD day, read as UTC so it never shifts a day in the reader's own timezone.
const dayLabel = (iso, withYear = false) => (iso
  ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {})
  })
  : null);

// `createdAt` is a full Zoho timestamp, so it is read in IST rather than as a bare day.
const stamp = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
  : null);

// Crores to two decimals, as the mock-up shows them. The ₹ wording elsewhere on the board (MandateBar,
// the funnel cards) switches unit at a lakh; this column is fixed to crores so the figures line up
// vertically down a week and can be compared at a glance, which is the whole point of the column.
const crore = (value) => (Number.isFinite(value) ? value : 0) / CRORE;
const cr = (value) => crore(value).toFixed(2);

// S1…S5 reuse the Sales performance ladder exactly — same five greens, same dark ink — so a stage means
// the same colour wherever it is drawn on this board. See sales-performance.css for the measured
// contrast behind them. S6, Closed and Dead are not rungs on that ladder, so they take the funnel's own
// tones for those nodes (teal, violet, grey) rather than a sixth green that would imply one.
const STAGE_TONE = {
  S1: 's1', S2: 's2', S3: 's3', S4: 's4', S5: 's5', S6: 's6', closed: 'closed', DEAD: 'dead'
};

// "S4" is the key the API sends; the customer writes and says "S-4".
const stageName = (key) => (/^S\d$/.test(key ?? '') ? `S-${key.slice(1)}` : key);

// What's in play: everything except the two outcomes. A closed or dead opportunity can still carry a
// follow-up date in Zoho, and rendering it here would put settled business on a board about live work.
const IN_PLAY = (record) => record.stageKey !== 'closed' && record.stageKey !== 'DEAD';

// The API decides overdue server-side, in Asia/Kolkata, so every viewer sees the same red whatever
// timezone their laptop is in. The local comparison is only a fallback for a payload sent before that
// field existed, and agrees with it on the same day boundary.
const isOverdue = (record, today) => (typeof record.followUpOverdue === 'boolean'
  ? record.followUpOverdue
  : Boolean(record.followUpDate) && record.followUpDate < today);

// One opportunity. The name opens the records popup when the board passes `onOpen`, and falls back to
// the Zoho record itself when it does not — either way it is one control, 44px tall, with a real
// accessible name.
function Row({ record, today, onOpen }) {
  const open = useCallback(() => onOpen?.(record), [onOpen, record]);

  const followUp = record.followUpDate;
  const overdue = isOverdue(record, today);
  const action = (record.nextAction ?? '').trim();
  const tone = STAGE_TONE[record.stageKey] ?? 'unset';
  const stageLabel = record.stage || 'Stage not set in Zoho';
  const chip = `${stageName(record.stageKey) || 'Stage not set'}${record.stage ? ` · ${record.stage}` : ''}`;
  const zero = !record.value;
  const spoken = [
    record.name,
    `${cr(record.value)} crore`,
    chip,
    record.salesPerson,
    followUp ? `follow-up ${dayLabel(followUp, true)}${overdue ? ', overdue' : ''}` : 'no follow-up set'
  ].filter(Boolean).join(', ');

  return (
    <li className="wk-row">
      <div className="wk-cell wk-c-name">
        {onOpen
          ? (
            <button type="button" className="wk-name" onClick={open} aria-label={`Open ${spoken}`} title={record.name}>
              {record.name}
            </button>
          )
          : (
            <a
              className="wk-name"
              href={crmRecordUrl('Contacts', record.id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${spoken} in Zoho CRM`}
              title={`${record.name}\nOpens this qualified lead in Zoho CRM`}
            >
              {record.name}
            </a>
          )}
        <span className="wk-sub" title="When the qualified lead was created in Zoho (IST)">
          {stamp(record.createdAt) ?? 'Created date not recorded'}
        </span>
      </div>

      <div className={`wk-cell wk-c-value${zero ? ' is-zero' : ''}`}>
        <b title={zero ? 'Adds ₹0 until the value is entered in Zoho' : record.valueLabel}>{cr(record.value)}</b>
        {/* The unit lives in the column heading on a wide screen; on a phone the headings are gone, so
            it rides the figure instead. CSS shows one or the other, never both. */}
        <i className="wk-unit" aria-hidden="true">₹Cr</i>
      </div>

      <div className="wk-cell wk-c-stage">
        <span className={`wk-chip wk-${tone}`} title={`Current Stage (Client Status) in Zoho: ${stageLabel}`}>
          <b>{stageName(record.stageKey) || 'Stage not set'}</b>
          {record.stage && <span>{record.stage}</span>}
        </span>
        <span className="wk-sub" title="Record owner in Zoho">{record.salesPerson || record.owner || 'Owner not set'}</span>
      </div>

      <div className="wk-cell wk-c-follow">
        {followUp
          ? (
            <span className={`wk-date${overdue ? ' is-overdue' : ''}`} title={`Follow Up Date in Zoho: ${dayLabel(followUp, true)}`}>
              {dayLabel(followUp)}
              {overdue && <em> · overdue</em>}
            </span>
          )
          : <span className="wk-date is-empty">No follow-up set</span>}
        {action
          ? <span className="wk-action" title={action}>{action}</span>
          : <span className="wk-action is-empty">No next action noted</span>}
      </div>
    </li>
  );
}

// One week block: the date-range band, the four column headings, then the rows. An empty week keeps its
// full block and says it is empty — the customer asked for the gaps to stay visible.
function Week({ column, today, onOpen }) {
  const { label, rows, value, overdue, note, emptyText, kind } = column;
  return (
    <section className={`wk-week wk-k-${kind}`} aria-labelledby={`wk-h-${column.key}`}>
      <header className="wk-head">
        <h3 id={`wk-h-${column.key}`}>{label}</h3>
        <p className="wk-meta">
          <span>{rows.length === 1 ? '1 opportunity' : `${rows.length} opportunities`}</span>
          {rows.length > 0 && <span className="wk-sum">₹{cr(value)} Cr</span>}
          {overdue > 0 && <span className="wk-overdue">{overdue} overdue</span>}
        </p>
        {note && <p className="wk-note">{note}</p>}
      </header>

      {rows.length > 0 && (
        <div className="wk-cols" aria-hidden="true">
          <span className="wk-cell wk-c-name">Opportunity / client</span>
          <span className="wk-cell wk-c-value">Value (₹Cr)</span>
          <span className="wk-cell wk-c-stage">Probability / owner</span>
          <span className="wk-cell wk-c-follow">Follow-up date / next action</span>
        </div>
      )}

      {rows.length > 0
        ? (
          <ul className="wk-rows">
            {rows.map((record) => <Row record={record} today={today} onOpen={onOpen} key={record.id} />)}
          </ul>
        )
        : <p className="wk-empty">{emptyText}</p>}
    </section>
  );
}

/**
 * The weekly view of the Sales board: the opportunities in play, week by week.
 *
 * @param {Array}    props.weeks    the API's ordered `weeks`: [{ weekKey, label, start, end }].
 *                                  Rendered in the order given, empty ones included.
 * @param {Array}    props.records  the API's `records` — the same flat rows every other section reads.
 *                                  Each is filed by its own `weekKey`, which the backend derives from
 *                                  the follow-up date and leaves null when none is booked.
 * @param {boolean}  props.loading  true while the API is being re-read: the rows already on screen stay
 *                                  put and dim, never a spinner, so a click still lands where aimed.
 * @param {Function} props.onOpen   called with the whole record when a name is clicked. Omit it and the
 *                                  name becomes a Zoho CRM link instead.
 */
export function WeeklyView({ weeks = [], records = [], loading = false, onOpen }) {
  const today = todayKey();

  const { columns, booked, withAction, total, settled } = useMemo(() => {
    const play = records.filter(IN_PLAY);
    const listed = new Map(weeks.map((week) => [week.weekKey, []]));
    const first = weeks[0]?.weekKey ?? '';
    const last = weeks[weeks.length - 1]?.weekKey ?? '';
    const before = [];
    const after = [];
    const unbooked = [];

    for (const record of play) {
      const bucket = record.weekKey ? listed.get(record.weekKey) : null;
      if (bucket) bucket.push(record);
      else if (!record.weekKey) unbooked.push(record);
      else if (last && record.weekKey > last) after.push(record);
      else before.push(record);
    }

    // Inside a week, the nearest follow-up first; ties go to the bigger deal.
    const byDate = (a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? '') || b.value - a.value;
    const byValue = (a, b) => b.value - a.value;

    const build = (key, label, rows, kind, extra = {}) => ({
      key,
      label,
      rows,
      kind,
      value: rows.reduce((sum, record) => sum + (record.value ?? 0), 0),
      overdue: rows.filter((record) => isOverdue(record, today)).length,
      ...extra
    });

    // Overdue before the period · the weeks themselves · Later · never booked. Read left to right that
    // is one timeline with the unscheduled pile at the end of it.
    const built = [];
    if (before.length) {
      built.push(build('overdue', 'Overdue', before.sort(byDate), 'overdue', {
        note: `Follow-up was due before ${dayLabel(first, true) ?? 'this period'}.`
      }));
    }
    built.push(...weeks.map((week) => build(
      week.weekKey,
      week.label,
      (listed.get(week.weekKey) ?? []).sort(byDate),
      'week',
      { emptyText: 'No follow-up is booked in this week.' }
    )));
    if (after.length) {
      built.push(build('later', 'Later', after.sort(byDate), 'later', {
        note: `Follow-up booked after ${dayLabel(weeks[weeks.length - 1]?.end, true) ?? 'this period'}.`
      }));
    }
    if (unbooked.length) {
      built.push(build('unbooked', 'No follow-up booked', unbooked.sort(byValue), 'unbooked', {
        note: 'No Follow Up Date in Zoho, so these belong to no week. Biggest first.'
      }));
    }

    return {
      columns: built,
      booked: play.filter((record) => record.followUpDate).length,
      withAction: play.filter((record) => (record.nextAction ?? '').trim()).length,
      total: play.length,
      settled: records.length - play.length
    };
  }, [weeks, records, today]);

  const share = (count) => (total ? `${Math.round((count / total) * 100)}%` : '0%');

  return (
    <section className={`wk${loading ? ' is-stale' : ''}`} aria-labelledby="wk-title" aria-busy={loading || undefined}>
      <div className="wk-band">
        <h2 id="wk-title">Week by week</h2>
        <p className="wk-band-sub">
          Opportunities in play, filed by their follow-up week. Weeks run Monday to Sunday.
          {settled > 0 && ` ${settled.toLocaleString('en-IN')} closed or dead in this period are left out.`}
        </p>
        {/* The coverage line is measured off this payload, every time. Both fields are thinly filled in
            the CRM, and saying so on the face of the view is the difference between "sparse data" and
            "the board is broken". */}
        <p className="wk-coverage">
          <span>
            Follow-up date set on <b>{booked.toLocaleString('en-IN')}</b> of {total.toLocaleString('en-IN')} ({share(booked)})
          </span>
          <span>
            Next action written on <b>{withAction.toLocaleString('en-IN')}</b> of {total.toLocaleString('en-IN')} ({share(withAction)})
          </span>
        </p>
      </div>

      {columns.length === 0
        ? <p className="wk-empty wk-empty-all">No weeks in this period yet.</p>
        : (
          // A sideways-scrolling region has to be reachable from the keyboard on its own, because the
          // rows inside it may all be off-screen. Below 780px the CSS stacks the weeks and there is
          // nothing to scroll, but the region keeps its name either way.
          <div className="wk-scroll" role="region" tabIndex={0} aria-label="Weeks — scroll sideways to see more">
            <div className="wk-track">
              {columns.map((column) => <Week column={column} today={today} onOpen={onOpen} key={column.key} />)}
            </div>
          </div>
        )}
    </section>
  );
}
