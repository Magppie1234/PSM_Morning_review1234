// Empty Zoho fields read "NA" everywhere on the installation dashboard.
export const NA = <span className="in-na">NA</span>;

export const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);
export const show = (value) => (isEmpty(value) ? NA : value);
export const shortDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : null);
export const showDate = (iso) => show(shortDate(iso));

export function Chips({ items, empty }) {
  if (!items?.length) return <span className="in-chips-empty">{empty}</span>;
  return (
    <span className="in-chips">
      {items.map((item) => <span className="in-chip" key={item.name}>{item.name} <strong>{item.count}</strong></span>)}
    </span>
  );
}
