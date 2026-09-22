import { localDayKey } from './timeUtils.js';

// The universal reporting periods and the period each one is compared with:
//   daily      yesterday                     vs the day before
//   weekly     last full week, Mon → Sun    vs the week before it
//   monthly    this month, 1st → today       vs the same days of last month
//   quarterly  this quarter, 1st → today     vs the same days of last quarter
//   custom     any from → to (≤ 366 days)    vs the equal-length window just before it
// Encoded as a string so every endpoint takes one `timeframe` query value: "custom:2026-09-01:2026-09-15".

export const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'custom'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366;

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);
export const addDays = (iso, days) => {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
};
const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 86_400_000);
const monthStart = (iso, shift = 0) => {
  const date = utc(iso);
  return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + shift, 1)));
};
const minIso = (a, b) => (a < b ? a : b);

function label(start, end) {
  const fmt = (iso, withMonth) => utc(iso).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', ...(withMonth ? { month: 'short' } : {}) });
  const full = (iso) => utc(iso).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  if (start === end) return full(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`;
}

// Same elapsed length as the current window, starting at `prevStart` and never running past `prevLimit`.
function matchingPrevious(start, end, prevStart, prevLimit) {
  return { prevStart, prevEnd: minIso(addDays(prevStart, daysBetween(start, end)), prevLimit) };
}

export function parsePeriod(timeframe = 'daily', now = new Date()) {
  const today = localDayKey(now);
  const yesterday = addDays(today, -1);
  const [kind, from, to] = String(timeframe || 'daily').toLowerCase().split(':');

  if (kind === 'weekly') {
    const thisMonday = addDays(today, -((utc(today).getUTCDay() + 6) % 7));
    const start = addDays(thisMonday, -7);
    const end = addDays(thisMonday, -1);
    return { kind, start, end, prevStart: addDays(start, -7), prevEnd: addDays(end, -7), name: 'Last week', shortLabel: 'Last week' };
  }
  if (kind === 'monthly') {
    const start = monthStart(today);
    const prev = matchingPrevious(start, today, monthStart(today, -1), addDays(start, -1));
    return { kind, start, end: today, ...prev, name: 'Month to date', shortLabel: 'This month' };
  }
  if (kind === 'quarterly') {
    const month = utc(today).getUTCMonth();
    const start = monthStart(today, -(month % 3));
    const prev = matchingPrevious(start, today, monthStart(start, -3), addDays(start, -1));
    return { kind, start, end: today, ...prev, name: 'Quarter to date', shortLabel: 'This quarter' };
  }
  if (kind === 'custom' && ISO.test(from ?? '') && ISO.test(to ?? '')) {
    const start = from <= to ? from : to;
    const end = minIso(from <= to ? to : from, today);
    const span = daysBetween(start, end);
    if (span >= 0 && span < MAX_CUSTOM_DAYS) {
      return { kind, start, end, prevStart: addDays(start, -(span + 1)), prevEnd: addDays(start, -1), name: 'Custom range', shortLabel: 'Custom' };
    }
  }
  // Daily is the default, and the fallback for anything unrecognised.
  return { kind: 'daily', start: yesterday, end: yesterday, prevStart: addDays(yesterday, -1), prevEnd: addDays(yesterday, -1), name: 'Yesterday', shortLabel: 'Yesterday' };
}

// The window object every mapper consumes (same shape as the older day windows).
export function getPeriodWindow(timeframe, now = new Date()) {
  const period = parsePeriod(timeframe, now);
  const inRange = (from, to) => (dateStr) => {
    if (!dateStr || Number.isNaN(Date.parse(dateStr))) return false;
    const key = localDayKey(dateStr);
    return key >= from && key <= to;
  };
  const timeframeValue = period.kind === 'custom' ? `custom:${period.start}:${period.end}` : period.kind;
  return {
    timeframe: timeframeValue,
    kind: period.kind,
    start: period.start,
    end: period.end,
    previousStart: period.prevStart,
    previousEnd: period.prevEnd,
    single: period.start === period.end,
    shortLabel: period.shortLabel,
    reportLabel: `${period.name} · ${label(period.start, period.end)}`,
    previousLabel: label(period.prevStart, period.prevEnd),
    matches: inRange(period.start, period.end),
    previousMatches: inRange(period.prevStart, period.prevEnd),
    options: []
  };
}
