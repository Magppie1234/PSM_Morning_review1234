import { CalendarRange } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// The universal period filter: Daily | Weekly | Monthly | Quarterly | Custom.
// Values match the backend: "daily", "weekly", "monthly", "quarterly", "custom:YYYY-MM-DD:YYYY-MM-DD".
const BUTTONS = [
  { value: 'daily', label: 'Daily', hint: 'Yesterday vs the day before' },
  { value: 'weekly', label: 'Weekly', hint: 'Last full week (Monday to Sunday) vs the week before' },
  { value: 'monthly', label: 'Monthly', hint: 'This month to date vs the same days last month' },
  { value: 'quarterly', label: 'Quarterly', hint: 'This quarter to date vs the same days last quarter' }
];
const MAX_DAYS = 366;

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const spanDays = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

function validate(from, to) {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (to > todayIso()) return 'The end date cannot be in the future.';
  if (spanDays(from, to) >= MAX_DAYS) return 'Choose a range of one year or less.';
  return '';
}

export function PeriodFilter({ value = 'daily', onChange }) {
  const isCustom = value.startsWith('custom');
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
