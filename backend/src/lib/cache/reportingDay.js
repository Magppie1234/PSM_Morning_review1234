// Calendar boundaries must follow the reporting timezone, including DST where configured.
const formatters = new Map();
export function reportingDay(timestamp, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }));
  return formatters.get(timeZone).format(new Date(timestamp));
}
const boundaries = new Map();
export function nextReportingDayAt(timestamp, timeZone) {
  const day = reportingDay(timestamp, timeZone);
  const key = `${timeZone}:${day}`;
  if (boundaries.has(key)) return boundaries.get(key);
  let low = Math.floor(timestamp), high = low + 36 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (reportingDay(middle, timeZone) === day) low = middle;
    else high = middle;
  }
  boundaries.set(key, high);
  if (boundaries.size > 32) boundaries.delete(boundaries.keys().next().value);
  return high;
}
