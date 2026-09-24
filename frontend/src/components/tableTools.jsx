import { ArrowDown, ArrowUp, ArrowUpDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

// Search box and click-to-sort column headers, shared by the record tables. A table says which of its
// columns can be sorted (`fields`) and what text a row is searched on (`search`); the cells stay with the
// table itself. Nothing is sent to the server: both the search and the sort work on the rows already loaded.

const isBlank = (value) => value === null || value === undefined || value === '' || value === '—';
const collator = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' });

// "₹15L", "₹1.2 Cr" or "12 / 15" as a number to sort by. Lakhs and crores are put on one scale so a
// column holding both still sorts correctly. Text with no number in it sorts as text.
export function amountOf(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '');
  const found = text.match(/-?[\d,]*\.?\d+/);
  if (!found) return null;
  const amount = Number(found[0].replace(/,/g, ''));
  if (Number.isNaN(amount)) return null;
  return /\bcr/i.test(text) ? amount * 100 : amount;
}

// Timestamps sort by the moment they name, not by how they read.
export const timeOf = (iso) => (iso ? Date.parse(iso) || null : null);

const compare = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b)));

export function useTableTools(rows, { fields = {}, search, initial = null } = {}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initial);

  const needle = query.trim().toLowerCase();
  const found = useMemo(
    () => (!needle || !search ? rows : rows.filter((row) => String(search(row) ?? '').toLowerCase().includes(needle))),
    [rows, needle, search]
  );

  const sorted = useMemo(() => {
    const valueOf = sort ? fields[sort.field] : null;
    if (!valueOf) return found;
    const direction = sort.dir === 'desc' ? -1 : 1;
    return [...found].sort((a, b) => {
      const [left, right] = [valueOf(a), valueOf(b)];
      // Blank cells stay at the bottom whichever way the column is sorted.
      if (isBlank(left) || isBlank(right)) return isBlank(left) ? (isBlank(right) ? 0 : 1) : -1;
      return direction * compare(left, right);
    });
    // `fields` is written inline by each table, so it is compared by its sort key rather than by identity.
  }, [found, sort]);

  // First click sorts a column, a second click reverses it, a third puts the table back in its own order.
  const sortBy = (field) =>
    setSort((current) => {
      if (current?.field !== field) return { field, dir: 'asc' };
      return current.dir === 'asc' ? { field, dir: 'desc' } : null;
    });

  return { rows: sorted, query, setQuery, sort, setSort, sortBy, total: rows.length, shown: sorted.length };
}

// Filters the rows as it is typed. `label` names what is being searched, for screen readers.
export function TableSearch({ tools, label = 'Search this table', placeholder = 'Search…', className = '' }) {
  const typing = tools.query.trim().length > 0;
  return (
    <div className={`tt-search${typing ? ' is-active' : ''} ${className}`.trim()}>
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        value={tools.query}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => tools.setQuery(event.target.value)}
      />
      {typing && (
        <>
          <span className="tt-count" role="status">{tools.shown} of {tools.total}</span>
          <button type="button" className="tt-clear" onClick={() => tools.setQuery('')} aria-label="Clear search">
            <X size={13} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

// On a phone each row becomes a card and the headings are hidden, so sorting moves into this menu.
// `options` is the list of [field, label] pairs to offer, in the order the columns appear.
export function SortSelect({ tools, options, className = '' }) {
  const value = tools.sort ? `${tools.sort.field}|${tools.sort.dir}` : '';
  const pick = (next) => {
    const [field, dir] = next.split('|');
    tools.setSort(field ? { field, dir } : null);
  };
  return (
    <label className={`tt-sort-select${className ? ` ${className}` : ''}`}>
      <ArrowUpDown size={14} aria-hidden="true" />
      <select aria-label="Sort rows" value={value} onChange={(event) => pick(event.target.value)}>
        <option value="">Sort: default order</option>
        {options.flatMap(([field, label]) => [
          <option key={`${field}-asc`} value={`${field}|asc`}>{label} ↑</option>,
          <option key={`${field}-desc`} value={`${field}|desc`}>{label} ↓</option>
        ])}
      </select>
    </label>
  );
}

const ARROW = { asc: ArrowUp, desc: ArrowDown };
const SORTED = { asc: 'ascending', desc: 'descending' };

// A column heading that sorts the table when clicked.
export function SortTh({ tools, field, children, className = '', title, ...rest }) {
  const active = tools.sort?.field === field;
  const direction = active ? tools.sort.dir : null;
  const Arrow = ARROW[direction] ?? ChevronsUpDown;
  return (
    <th
      scope="col"
      className={`tt-th${active ? ' tt-sorted' : ''}${className ? ` ${className}` : ''}`}
      aria-sort={active ? SORTED[direction] : 'none'}
      title={title}
      {...rest}
    >
      <button type="button" className="tt-sort" onClick={() => tools.sortBy(field)}>
        <span>{children}</span>
        <Arrow className="tt-arrow" size={12} aria-hidden="true" />
      </button>
    </th>
  );
}
