import { Building2, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// The filter bar the Lead generation and Sales performance sections share: one city choice and one period.
// Delhi and Hyderabad get a button each because the team works those two markets daily; every other city
// sits behind the Others menu, which can also be narrowed to a single city.
const ALL = 'all';
const OTHER = 'OTHER';
const PERIODS = [
  { value: 'this-week', label: 'This week', hint: 'Monday to today' },
  { value: 'monthly', label: 'This month', hint: 'The 1st to today' }
];

function OthersMenu({ bucket, city, onCity }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const options = bucket?.options ?? [];
  // The menu names the chosen city once one is picked, so the bar always says what is on screen.
  const chosen = options.find((option) => option.key === city);
  const active = city === OTHER || Boolean(chosen);

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

  const choose = (value) => {
    setOpen(false);
    onCity(value);
  };

  return (
    <div className="sf-others" ref={rootRef}>
      {/* Clicking Others filters to every other city at once and opens the menu, so narrowing to a single
          city is a refinement rather than the only way to use it. */}
      <button
        type="button"
        className={`sf-btn${active ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (!active) onCity(OTHER);
          setOpen((was) => !was);
        }}
      >
        {chosen ? chosen.label : 'Others'}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="sf-menu" role="menu">
          <button type="button" role="menuitem" className={city === OTHER ? 'is-on' : ''} onClick={() => choose(OTHER)}>
            All other cities
          </button>
          {options.length === 0 && <p className="sf-menu-empty">No other cities in this period.</p>}
          {options.map((option) => (
            <button type="button" role="menuitem" key={option.key} className={city === option.key ? 'is-on' : ''} onClick={() => choose(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The bar carries no counts. It filters two sections that count different populations — lead generation
// counts the period's intake, sales performance counts estimates, overdue deals and closures — so one
// number beside a city name would contradict whichever section is on screen. The cards do the counting.
export function SalesFilters({ cities = [], city = ALL, onCity, timeframe = 'monthly', onTimeframe }) {
  const bucketOf = (key) => cities.find((entry) => entry.key === key);
  const button = (key, label) => (
    <button type="button" className={`sf-btn${city === key ? ' is-on' : ''}`} aria-pressed={city === key} onClick={() => onCity(key)}>
      {label}
    </button>
  );

  return (
    <div className="sf-bar">
      <div className="sf-group" role="group" aria-label="City">
        <Building2 size={14} aria-hidden="true" className="sf-icon" />
        {button(ALL, 'All cities')}
        {button('DEL', 'Delhi (DEL)')}
        {button('HYD', 'Hyderabad (HYD)')}
        <OthersMenu bucket={bucketOf(OTHER)} city={city} onCity={onCity} />
      </div>

      <div className="sf-group" role="group" aria-label="Period">
        {PERIODS.map((period) => (
          <button
            type="button"
            key={period.value}
            className={`sf-btn${timeframe === period.value ? ' is-on' : ''}`}
            aria-pressed={timeframe === period.value}
            title={period.hint}
            onClick={() => onTimeframe(period.value)}
          >
            {period.label}
          </button>
        ))}
      </div>
    </div>
  );
}
