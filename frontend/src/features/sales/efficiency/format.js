export const count = (value) => Number.isFinite(value) ? value.toLocaleString('en-IN') : '—';
export const decimal = (value) => Number.isFinite(value) ? Number(value.toFixed(1)).toLocaleString('en-IN') : '—';
export function inr(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e7) return `₹${decimal(value / 1e7)} Cr`;
  if (Math.abs(value) >= 1e5) return `₹${decimal(value / 1e5)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
export const unavailable = (metric) => metric?.available === false || !Number.isFinite(metric?.value);
export const formatMetric = (metric, value = metric.value) => metric.unit === 'inr' ? inr(value) : metric.unit === 'per-working-day' && Number.isFinite(value) ? Number(value.toFixed(2)).toLocaleString('en-IN') : decimal(value);
export const metricUnit = (metric) => metric.unit === 'days' ? 'days' : metric.unit === 'per-working-day' ? '/ working day' : '';
export const money = (row) => row.valueLabel ?? inr(row.value);
export const total = (rows = [], field = 'value') => rows.reduce((sum, row) => sum + (Number.isFinite(row[field]) ? row[field] : 0), 0);
export function ranked(rows, nameField, keep = 4) {
  const sorted = rows.filter((r) => Number.isFinite(r.value) && r.value > 0).sort((a, b) => b.value - a.value);
  const result = sorted.slice(0, keep).map((r) => ({ ...r, name: r[nameField] }));
  if (sorted.length > keep) result.push({ key: '__remaining', name: `Other ${sorted.length - keep} categories`, value: total(sorted.slice(keep)) });
  return result;
}

