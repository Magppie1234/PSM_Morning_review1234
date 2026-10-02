import { CalendarRange } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// The universal period filter: Daily | Weekly | Monthly | Quarterly | Custom.
// Values match the backend: "daily", "weekly", "monthly", "quarterly", "custom:YYYY-MM-DD:YYYY-MM-DD".
const BUTTONS = [
  { value: 'daily', label: 'Daily', hint: 'Yesterday vs the day before' },
  { value: 'weekly', label: 'Weekly', hint: 'Last full week (Monday to Sunday) vs the week before' },
  { value: 'monthly', label: 'Monthly', hint: 'This month to date vs the same days last month' },
  // LAST MONTH is a whole finished month, which is a different question from Monthly: Monthly is
  // this month so far against the same days last month, and it moves every day. Last month stops
  // moving once the month ends, which is what you want when reporting on a closed period.
  { value: 'last-month', label: 'Last month', hint: 'All of last month vs all of the month before' },
  { value: 'quarterly', label: 'Quarterly', hint: 'This quarter to date vs the same days last quarter' }
];
const MAX_DAYS = 366;
// How far back the month picker offers. Two years is well past anything the boards hold.
const MONTHS_OFFERED = 24;

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const spanDays = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

function validate(from, to) {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (to > todayIso()) return 'The end date cannot be in the future.';
  if (spanDays(from, to) >= MAX_DAYS) return 'Choose a range of one year or less.';
  return '';
}

/** The last `MONTHS_OFFERED` months, newest first, as { value: "2026-09", label: "September 2026" }. */
function monthOptions() {
  const now = new Date();
  return Array.from({ length: MONTHS_OFFERED }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    return {
      value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    };
  });
}

export function PeriodFilter({ value = 'daily', onChange }) {
  const isCustom = value.startsWith('custom');
  // "month:2026-09" — a single month the user picked, which is its own control rather than a button.
  const isMonth = value.startsWith('month:');
  const pickedMonth = isMonth ? value.slice('month:'.length) : '';
  const [, currentFrom = '', currentTo = ''] = isCustom ? value.split(':') : [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: currentFrom, to: currentTo });
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !rootRef.current?.contains(event.target))) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('mousedown', close);
    };
  }, [open]);

  const apply = () => {
    const problem = validate(draft.from, draft.to);
    setError(problem);
    if (problem) return;
    onChange(`custom:${draft.from}:${draft.to}`);
    setOpen(false);
  };

  return (
    <div className="pf" ref={rootRef}>
      <div className="pf-group" role="group" aria-label="Reporting period">
        {BUTTONS.map((button) => (
          <button
            type="button"
            key={button.value}
            aria-pressed={value === button.value}
            title={button.hint}
            onClick={() => { setOpen(false); onChange(button.value); }}
          >
            {button.label}
          </button>
        ))}
        {/* PICK A MONTH. A select rather than another button: twenty-four months cannot be a button
            each, and the one you want is a named thing rather than a date range to compose. */}
        <label className={`pf-month${isMonth ? ' on' : ''}`}>
          <span className="pf-month-sr">Pick a month</span>
          <select
            aria-label="Pick a month"
            value={pickedMonth}
            onChange={(event) => {
              setOpen(false);
              if (event.target.value) onChange(`month:${event.target.value}`);
            }}
          >
            <option value="">Pick a month…</option>
            {monthOptions().map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={isCustom}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Pick your own dates; compared with the same number of days just before"
          onClick={() => { setDraft({ from: currentFrom, to: currentTo }); setError(''); setOpen((state) => !state); }}
        >
          <CalendarRange size={14} aria-hidden="true" />
          Custom
        </button>
      </div>

      {open && (
        <div className="pf-pop" role="dialog" aria-label="Custom date range">
          <label>
            <span>From</span>
            <input type="date" value={draft.from} max={todayIso()} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setError(''); }} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={draft.to} max={todayIso()} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setError(''); }} />
          </label>
          {error && <p className="pf-error" role="alert">{error}</p>}
          <p className="pf-note">Compared with the same number of days just before.</p>
          <div className="pf-actions">
            <button type="button" className="pf-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="pf-apply" onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
