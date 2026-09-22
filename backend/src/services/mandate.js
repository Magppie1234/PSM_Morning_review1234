import { PSM_MONTHLY_TARGETS } from '../config/psmTargets.js';
import { PSM_NAMES } from '../config/roster.js';
import { localDayKey } from './timeUtils.js';

// PSM target progress, measured like the PSM Leaderboard in the Executive Command Centre:
//   achieved  Σ Total_Opportunity_Value (₹ lakhs) of Zoho Contacts — qualified opportunities — created in the
//             period whose Sales_Manager is a PSM, counting only months that have an approved target
//   target    each PSM's monthly target. Monthly and Quarterly use the whole month's target (as the leaderboard
//             does); Daily and Custom share a month's target out by the days of it they cover.
const LAKH = 1e5;
const DAY = 86_400_000;
const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);
const days = (from, to) => Math.round((utc(to) - utc(from)) / DAY) + 1;
const maxIso = (a, b) => (a > b ? a : b);
const minIso = (a, b) => (a < b ? a : b);
const monthEnd = (month) => {
  const date = utc(`${month}-01`);
  return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
};
const monthsBetween = (from, to) => {
  const months = [];
  for (let date = utc(`${from.slice(0, 7)}-01`); toIso(date) <= to; date.setUTCMonth(date.getUTCMonth() + 1)) months.push(toIso(date).slice(0, 7));
  return months;
};
// Working days after today (Sundays are not PSM working days), as the PSM Leaderboard counts them.
function workingDaysLeft(today, end) {
  let count = 0;
  const date = utc(today);
  for (date.setUTCDate(date.getUTCDate() + 1); toIso(date) <= end; date.setUTCDate(date.getUTCDate() + 1)) if (date.getUTCDay() !== 0) count += 1;
  return count;
}

// `contacts` are Zoho Contacts created since the period start (null when Zoho could not be read).
export function buildMandate({ tf, contacts, selectedPsm, now = new Date() }) {
  const whole = tf.kind === 'monthly' || tf.kind === 'quarterly';
  const months = monthsBetween(tf.start, tf.end).map((month) => {
    const targets = PSM_MONTHLY_TARGETS[month] ?? null;
    const from = maxIso(tf.start, `${month}-01`);
    const to = minIso(tf.end, monthEnd(month));
    return { month, targets, from, to, share: whole ? 1 : days(from, to) / days(`${month}-01`, monthEnd(month)) };
  });
  const targeted = months.filter((month) => month.targets);
  const missing = months.filter((month) => !month.targets).map((month) => month.month);

  const team = [...new Set(targeted.flatMap((month) => Object.keys(month.targets)))].filter((name) => PSM_NAMES.has(name)).sort();
  const psms = selectedPsm ? [selectedPsm].filter((name) => PSM_NAMES.has(name)) : team;
  if (selectedPsm && !PSM_NAMES.has(selectedPsm)) return null;
  if (!targeted.length || !psms.length) return { available: contacts !== null, noTarget: true, missing, psms };

  const psmOf = (contact) => contact.Sales_Manager?.name ?? '';
  const counted = (contacts ?? []).filter((contact) => {
    if (!psms.includes(psmOf(contact)) || !contact.Created_Time) return false;
    const day = localDayKey(contact.Created_Time);
    return targeted.some((month) => day >= month.from && day <= month.to);
  });
  const valueOf = (list) => list.reduce((total, contact) => total + (Number(contact.Total_Opportunity_Value) || 0) * LAKH, 0);
  const targetOf = (name) => targeted.reduce((total, month) => total + (month.targets[name] ?? 0) * month.share, 0);

  const byPsm = psms.map((name) => {
    const own = counted.filter((contact) => psmOf(contact) === name);
    // `monthly` is the PSM's written monthly target for the latest month in view, shown beside the bar.
    return { name, achieved: valueOf(own), opportunities: own.length, target: targetOf(name), monthly: targeted.at(-1).targets[name] ?? null };
  }).sort((a, b) => (b.target ? b.achieved / b.target : -1) - (a.target ? a.achieved / a.target : -1) || a.name.localeCompare(b.name));

  const achieved = valueOf(counted);
  const target = byPsm.reduce((total, row) => total + row.target, 0);
  // Recovery pace, only while the period's last month is still running.
  const today = localDayKey(now);
  const lastEnd = monthEnd(months.at(-1).month);
  const daysLeft = whole && today < lastEnd ? workingDaysLeft(today, lastEnd) : 0;

  return {
    available: contacts !== null,
    kind: tf.kind,
    whole,
    months: targeted.map((month) => month.month),
    missing,
    psms,
    achieved,
    opportunities: counted.length,
    // Opportunities with no Total_Opportunity_Value in Zoho add ₹0, so achievement is understated until filled.
    unvalued: counted.filter((contact) => !(Number(contact.Total_Opportunity_Value) > 0)).length,
    target,
    daysLeft,
    neededPerDay: daysLeft ? Math.max(0, target - achieved) / daysLeft : 0,
    byPsm
  };
}
