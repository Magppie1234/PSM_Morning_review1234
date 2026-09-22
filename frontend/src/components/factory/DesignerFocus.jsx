import { ArrowRight, Check, ChevronDown, Clock3, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

const DUE_ORDER = { missed: 0, today: 1, upcoming: 2, none: 3, done: 4 };
const shortDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

function MeetingClock({ startedAt }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <span className={`fs-clock${seconds >= 300 ? ' over' : ''}`}><Clock3 size={13} aria-hidden="true" />{label}</span>;
}

function DueBadge({ query }) {
  const text = {
    missed: `Missed · was due ${shortDate(query.dueDate)}`,
    today: 'Due today',
    upcoming: `Due ${shortDate(query.dueDate)}`,
    done: 'Closed',
    none: 'No due date'
  }[query.due];
  return <span className={`fs-due ${query.due}`}>{text}</span>;
}

function QueryRow({ query, today, onSave, busy }) {
  const [open, setOpen] = useState(false);
  const done = query.status === 'done';
  return (
    <li className={`fs-query${done ? ' is-done' : ''}`}>
      <div className="fs-query-main">
        <button type="button" className="fs-query-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <ChevronDown size={15} className="ps-chev" aria-hidden="true" />
          <span className="fs-query-copy">
            <span className="fs-query-title">
              <strong>MPP {query.mpp}</strong>
              <span>{query.client} · {query.product}</span>
              {query.isNew && <span className="fs-new">New</span>}
            </span>
            <span className="fs-query-issue">{query.issue1 || query.issue2}</span>
          </span>
        </button>
        <div className="fs-query-side">
          {query.due !== 'none' && <DueBadge query={query} />}
          <label className="fs-date">
            <span>Due</span>
            <input
              type="date"
              min={today}
              value={query.dueDate ?? ''}
              disabled={busy || done}
              onChange={(event) => onSave([query.key], { dueDate: event.target.value || null })}
            />
          </label>
          <button type="button" className="fs-mini" disabled={busy} onClick={() => onSave([query.key], { status: done ? 'open' : 'done' })}>
            {done ? <><RotateCcw size={13} aria-hidden="true" /> Reopen</> : <><Check size={13} aria-hidden="true" /> Mark closed</>}
          </button>
        </div>
      </div>

      <div className={`fs-query-more${open ? ' open' : ''}`} inert={!open}>
        <div>
          <dl className="fs-facts">
            <div><dt>Factory concern</dt><dd>{query.issue1 || '—'}</dd></div>
            <div><dt>Follow-up question</dt><dd>{query.issue2 || '—'}</dd></div>
            <div><dt>Issue type</dt><dd>{query.categoryLabel} · {query.severity}</dd></div>
            <div><dt>Logged</dt><dd>{query.loggedOn ? `${shortDate(query.loggedOn)} · ${query.ageDays} days ago` : 'Not recorded'}{query.coDesigners.length ? ` · with ${query.coDesigners.join(', ')}` : ''}</dd></div>
          </dl>
        </div>
      </div>

    </li>
  );
}

export function DesignerFocus({ designer, queries, position, total, today, meetingStartedAt, focusStartedAt, onSave, onNext, busy }) {
  if (!designer) return null;
  const sorted = [...queries].sort(
    (a, b) => DUE_ORDER[a.due] - DUE_ORDER[b.due] || (a.severity === 'Critical' ? -1 : 1) - (b.severity === 'Critical' ? -1 : 1) || (b.ageDays ?? 0) - (a.ageDays ?? 0)
  );
  const openKeys = queries.filter((query) => query.status !== 'done').map((query) => query.key);

  return (
    <section className="ps-panel fs-focus" aria-labelledby="fs-focus-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="fs-focus-title">Now discussing: {designer.name}</h2>
          <p>{position} of {total} · {designer.open} open · {designer.critical} critical</p>
        </div>
        {meetingStartedAt && <MeetingClock startedAt={focusStartedAt} key={focusStartedAt} />}
      </header>

      <ul className="fs-queries">
        {sorted.map((query) => (
          <QueryRow query={query} today={today} onSave={onSave} busy={busy} key={query.key} />
        ))}
      </ul>

      <footer className="fs-focus-foot">
        <button type="button" className="fs-mini" disabled={busy || !openKeys.length || designer.discussedToday} onClick={() => onSave(openKeys, { discussed: true })}>
          <Check size={13} aria-hidden="true" /> {designer.discussedToday ? 'Discussed today' : 'Mark discussed'}
        </button>
        <button type="button" className="fs-primary" disabled={busy} onClick={onNext}>
          {position < total ? 'Next designer' : 'Back to first'} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
