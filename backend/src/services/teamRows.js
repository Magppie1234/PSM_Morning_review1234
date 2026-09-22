import { addDays } from './periods.js';
import { PSM_NAMES, mondayRota } from '../config/roster.js';

// Every PSM gets a row in the performance table, even with no leads in the period, so nobody silently
// disappears. A PSM with no leads carries `zeroReason`: a short, factual note built only from what we know
// (the Monday rota and who received the period's leads instead).
const EMPTY = { leads: 0, architectLeads: 0, clientReach: 0, inHours: 0, afterHours: 0, contacted: 0, qualified: 0, enabled: 0, bookings: 0, value: 0, missed: 0, hot: 0 };

function offMondays(name, start, end) {
  const days = [];
  for (let day = start; day <= end && days.length < 60; day = addDays(day, 1)) {
    if (mondayRota(day)?.off.includes(name)) days.push(day);
  }
  return days;
}

function reasonFor(name, rows, tf, excluded = 0) {
  const range = tf.reportLabel.split(' · ').at(-1);
  if (excluded) return `${name} was assigned ${excluded} lead${excluded === 1 ? '' : 's'} in ${range}, but ${excluded === 1 ? 'it is' : 'all are'} marked junk or not interested, so none count here.`;
  const off = offMondays(name, tf.start, tf.end);
  if (tf.start === tf.end && off.length) return `${name} was on the alternate-Monday off (${range}), so no leads were assigned.`;
  const others = rows.filter((row) => row.leads > 0).sort((a, b) => b.leads - a.leads);
  const went = others.length
    ? ` They went to ${others.map((row) => `${row.psm} (${row.leads})`).join(', ')}.`
    : ' No new leads came in for anyone.';
  const rota = off.length ? ` ${off.length === 1 ? 'One day' : `${off.length} days`} in this period ${off.length === 1 ? 'was' : 'were'} ${name}'s rota Monday off.` : '';
  return `No new leads were assigned to ${name} in Zoho for ${range}.${went}${rota}`;
}

// `shown` are the rows in view (already scoped to the selected PSM); `everyone` are all owners with leads,
// used to say who received the leads instead. `selectedPsm` is '' for the whole team. `excludedByOwner`
// counts each owner's junk / not-interested leads, which the table leaves out.
export function withAllPsms(shown, everyone, tf, selectedPsm, excludedByOwner = new Map()) {
  const names = selectedPsm ? [selectedPsm].filter((name) => PSM_NAMES.has(name)) : [...PSM_NAMES];
  const missing = names.filter((name) => !shown.some((row) => row.psm === name));
  return [...shown, ...missing.map((name) => ({ ...EMPTY, psm: name, zeroReason: reasonFor(name, everyone, tf, excludedByOwner.get(name) ?? 0) }))];
}
