import { config } from '../config/env.js';
import { getPeriodWindow } from './periods.js';

// Every dashboard shares one window. The universal periods (daily / monthly / quarterly / custom)
// come from periods.js; the older "7d" and "dN" day windows are still understood for old links.
export function getTimeframeFilter(timeframe = 'daily') {
  const value = String(timeframe || 'daily').toLowerCase();
  if (value === '7d' || value === 'yesterday' || /^d[1-7]$/.test(value)) return getLeadDayWindow(value);
  return getPeriodWindow(value);
}

// Calendar days in the dashboard timezone: "Last 7 days" is the 7 full days before
// today, and each single-day option is exactly one of those days, so the day totals add up to the week.
const DAY_MS = 86_400_000;
export const LEAD_WINDOW_DAYS = 7;
const timeZone = () => config.zoho.timezone;

export function localDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}

export function dayOffset(dateStr, now = new Date()) {
  if (!dateStr || Number.isNaN(Date.parse(dateStr))) return null;
  return Math.round((Date.parse(localDayKey(now)) - Date.parse(localDayKey(dateStr))) / DAY_MS);
}

export function getLeadDayWindow(timeframe = 'daily', now = new Date()) {
  const dateOf = (days) => new Date(now.getTime() - days * DAY_MS);
  const dayLabel = (days) => new Intl.DateTimeFormat('en-IN', { timeZone: timeZone(), weekday: 'short', day: 'numeric', month: 'short' }).format(dateOf(days));
  const shortDate = (days) => new Intl.DateTimeFormat('en-IN', { timeZone: timeZone(), day: 'numeric', month: 'short' }).format(dateOf(days));
  const valueFor = (days) => (days === 1 ? 'yesterday' : `d${days}`);
  const nameFor = (days) => (days === 1 ? 'Yesterday' : `${days} days ago`);

  const options = [
    { value: '7d', label: `Last 7 days · ${shortDate(LEAD_WINDOW_DAYS)} – ${shortDate(1)}` },
    ...Array.from({ length: LEAD_WINDOW_DAYS }, (_, index) => ({ value: valueFor(index + 1), label: `${nameFor(index + 1)} · ${dayLabel(index + 1)}` }))
  ];

  const tf = String(timeframe || '7d').toLowerCase();
  const single = tf === 'yesterday' ? 1 : Number(/^d([1-7])$/.exec(tf)?.[1] ?? 0);

  if (single) {
    return {
      start: localDayKey(dateOf(single)),
      end: localDayKey(dateOf(single)),
      timeframe: valueFor(single),
      single: true,
      shortLabel: single === 1 ? 'Yesterday' : shortDate(single),
      reportLabel: `${nameFor(single)} · ${dayLabel(single)}`,
      matches: (dateStr) => dayOffset(dateStr, now) === single,
      // The comparison window is the day before the selected one.
      previousLabel: 'previous day',
      previousMatches: (dateStr) => dayOffset(dateStr, now) === single + 1,
      options
    };
  }

  return {
    start: localDayKey(dateOf(LEAD_WINDOW_DAYS)),
    end: localDayKey(dateOf(1)),
    timeframe: '7d',
    single: false,
    shortLabel: '7 Days',
    reportLabel: `Last 7 Days · ${shortDate(LEAD_WINDOW_DAYS)} – ${shortDate(1)}`,
    matches: (dateStr) => {
      const offset = dayOffset(dateStr, now);
      return offset !== null && offset >= 1 && offset <= LEAD_WINDOW_DAYS;
    },
    // The comparison window is the 7 days before this one.
    previousLabel: 'previous 7 days',
    previousMatches: (dateStr) => {
      const offset = dayOffset(dateStr, now);
      return offset !== null && offset > LEAD_WINDOW_DAYS && offset <= LEAD_WINDOW_DAYS * 2;
    },
    options
  };
}
