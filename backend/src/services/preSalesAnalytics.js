import { isQualifiedStatus } from './leadFlow.js';
import { PSM_NAMES } from '../config/roster.js';
import { isSunrooof } from '../config/salesFunnel.js';

const linkedId = (row, ids) => [row?.What_Id?.id, row?.Who_Id?.id, row?.Parent_Id?.id]
  .map(String).find((id) => ids.has(id)) ?? '';
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const rate = (part, total) => total ? 100 * part / total : null;
const metric = (key, label, value, unit, detail, sample = null) => ({ key, label, value, unit, detail, sample });
const group = (rows, keyOf) => [...rows.reduce((map, row) => {
  const key = String(keyOf(row) || 'Not recorded');
  const entry = map.get(key) ?? { label: key, count: 0 };
  entry.count += 1;
  map.set(key, entry);
  return map;
}, new Map()).values()].sort((a, b) => b.count - a.count);

export function buildPreSalesTrend(leads, tf, selectedPsm = 'All PSM') {
  const start = new Date(`${tf.end}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 11, 1);
  const from = start.toISOString().slice(0, 10);
  const inScope = (row) => (selectedPsm && selectedPsm !== 'All PSM'
    ? row.Owner?.name === selectedPsm : PSM_NAMES.has(row.Owner?.name ?? '')) &&
    !isSunrooof(row) && !/test/i.test(String(row.Company ?? row.Full_Name ?? '')) &&
    row.Created_Time && String(row.Created_Time).slice(0, 10) >= from &&
    String(row.Created_Time).slice(0, 10) <= tf.end;
  const byMonth = new Map();
  for (const row of leads.filter(inScope)) {
    const month = String(row.Created_Time).slice(0, 7);
    const item = byMonth.get(month) ?? { count: 0, qualified: 0 };
    item.count += 1;
    item.qualified += Number(row.Converted__s === true || isQualifiedStatus(row.Lead_Status));
    byMonth.set(month, item);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + index);
    const label = date.toISOString().slice(0, 7);
    const item = byMonth.get(label) ?? { count: 0, qualified: 0 };
    return { label, ...item, rate: rate(item.qualified, item.count) };
  });
}

// One reporting cohort for both the PSM and Pre-Sales views. A converted lead is qualified even if
// its Lead_Status was never updated; a lead that later left a qualified state retains its credit.
export function buildPreSalesAnalytics({ leads, contacts, history, calls, tasks, mandate, tf, selectedPsm }) {
  const owner = (row) => row.Owner?.name ?? '';
  const inPsm = (name) => selectedPsm ? name === selectedPsm : PSM_NAMES.has(name);
  const cohort = leads.filter((row) => inPsm(owner(row)) && !isSunrooof(row) &&
    !/test/i.test(String(row.Company ?? row.Full_Name ?? '')) && tf.matches(row.Created_Time));
  const ids = new Set(cohort.map((row) => String(row.id)));
  const qualifiedIds = new Set(history.filter((row) => isQualifiedStatus(row.Lead_Status))
    .map((row) => String(row.Full_Name?.id ?? '')));
  const qualified = cohort.filter((row) => row.Converted__s === true ||
    isQualifiedStatus(row.Lead_Status) || qualifiedIds.has(String(row.id)));
  const isQualified = new Set(qualified.map((row) => String(row.id)));
  const converted = cohort.filter((row) => row.Converted__s === true);
  const dropped = cohort.filter((row) => /junk|not interested|lost lead|not qualified/i.test(String(row.Lead_Status ?? '')));
  const untouched = cohort.filter((row) => /not contacted/i.test(String(row.Lead_Status ?? '')) && row.Converted__s !== true);
  const notResponding = cohort.filter((row) => /no response|not responding|call back later/i.test(String(row.Lead_Status ?? '')));
  const walkIns = cohort.filter((row) => /walk\s*-?\s*in/i.test(String(row.Lead_Source ?? '')));
  const linkedCalls = calls.filter((row) => linkedId(row, ids) && tf.matches(row.Call_Start_Time ?? row.Created_Time) &&
    !/scheduled/i.test(`${row.Outgoing_Call_Status ?? ''} ${row.Subject ?? ''}`));
  const outbound = linkedCalls.filter((row) => row.Call_Type === 'Outbound');
  const connected = outbound.filter((row) => Number(row.Call_Duration_in_seconds) > 0);
  const firstByLead = new Map();
  for (const call of linkedCalls.filter((row) => Number(row.Call_Duration_in_seconds) > 0)) {
    const id = linkedId(call, ids);
    const at = call.Call_Start_Time ?? call.Created_Time;
    if (!firstByLead.has(id) || at < firstByLead.get(id)) firstByLead.set(id, at);
  }
  const firstSpans = cohort.map((row) => days(row.Created_Time, firstByLead.get(String(row.id))))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const inContacts = (contacts ?? []).filter((row) => inPsm(row.Sales_Manager?.name ?? '') &&
    !isSunrooof(row) && !/test/i.test(String(row.Full_Name ?? '')) && tf.matches(row.Created_Time));
  const salesValues = inContacts.map((row) => Number(row.Total_Opportunity_Value) * 100_000)
    .filter((value) => Number.isFinite(value) && value > 0);
  const psmValues = inContacts.map((row) => Number(row.Amount) * 100_000)
    .filter((value) => Number.isFinite(value) && value > 0);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const overdue = tasks == null ? null : tasks.filter((row) => linkedId(row, ids) &&
    row.Due_Date && String(row.Due_Date).slice(0, 10) < today &&
    !/completed|cancelled|closed/i.test(String(row.Status ?? '')));
  const sources = group(cohort, (row) => row.Lead_Source).map((row) => {
    const subset = cohort.filter((lead) => String(lead.Lead_Source || 'Not recorded') === row.label);
    const qualifiedCount = subset.filter((lead) => isQualified.has(String(lead.id))).length;
    return { ...row, qualified: qualifiedCount, rate: rate(qualifiedCount, row.count) };
  });
  const byPsm = [...PSM_NAMES].filter(inPsm).map((name) => {
    const mine = cohort.filter((row) => owner(row) === name);
    const mineCalls = outbound.filter((row) => row.Owner?.name === name);
    return { label: name, leads: mine.length, qualified: mine.filter((row) => isQualified.has(String(row.id))).length,
      attempts: mineCalls.length, connected: mineCalls.filter((row) => Number(row.Call_Duration_in_seconds) > 0).length,
      talkMinutes: mineCalls.reduce((sum, row) => sum + (Number(row.Call_Duration_in_seconds) || 0), 0) / 60 };
  });
  let workingDays = 0;
  for (let day = new Date(`${tf.start}T00:00:00Z`); day.toISOString().slice(0, 10) <= tf.end;
    day.setUTCDate(day.getUTCDate() + 1)) if (day.getUTCDay() !== 0) workingDays += 1;
  return {
    metrics: [
      metric('leadContact', 'Lead → Contact ratio', rate(converted.length, cohort.length), '%', 'Converted leads ÷ raw leads', `${converted.length} / ${cohort.length}`),
      metric('firstConnect', 'Average first-connect time', mean(firstSpans.map((value) => value * 24 * 60)), 'min', 'First logged call with positive duration after lead creation', `${firstSpans.length} leads`),
      metric('dropRatio', 'Lead drop ratio', rate(dropped.length, cohort.length), '%', 'Dropped lead statuses ÷ raw leads', `${dropped.length} / ${cohort.length}`),
      metric('salesValue', 'Average sales value', mean(salesValues), 'inr', 'Contacts: Value(₹ Lacs)', `${salesValues.length} contacts with value`),
      metric('psmValue', 'Average PSM value', mean(psmValues), 'inr', 'Contacts: BD Value', `${psmValues.length} contacts with value`),
      metric('qualification', 'Lead → qualification ratio', rate(qualified.length, cohort.length), '%', 'Ever qualified or converted ÷ raw leads', `${qualified.length} / ${cohort.length}`),
      metric('walkIn', 'Lead → walk-in conversion', null, '%',
        'No walk-in transition is tracked in the Lead Blueprint; Walk In is a Lead_Source at intake',
        `${walkIns.length} leads have Walk In as their source`)
    ],
    health: [
      metric('sla', 'First-response SLA', null, '%', 'Target not configured'),
      metric('callConnect', 'Call connect', rate(connected.length, outbound.length), '%', 'Outbound calls with positive talk duration ÷ outbound attempts', `${connected.length} / ${outbound.length}`),
      metric('talkTime', 'Talk time', outbound.reduce((sum, row) => sum + (Number(row.Call_Duration_in_seconds) || 0), 0) / 60, 'min', 'Logged outbound talk minutes in the selected period; daily target not configured'),
      metric('untouched', 'Untouched leads', untouched.length, 'count', 'Still at Not Contacted Yet'),
      metric('notResponding', 'Not-responding pile', notResponding.length, 'count', 'No Response / Call Back Later status'),
      metric('overdueTasks', 'Overdue tasks on raw leads', overdue?.length ?? null, 'count', overdue ? 'Open tasks attached to leads in this period' : 'Task data unavailable'),
      metric('qualificationTarget', 'Qualification target progress', mandate?.target > 0
        ? rate(mandate.achieved, mandate.target) : null, '%', mandate?.target > 0
        ? 'Qualified-opportunity value achieved ÷ approved PSM value target' : 'Target not configured',
        mandate?.target > 0 ? `₹${Math.round(mandate.achieved).toLocaleString('en-IN')} / ₹${Math.round(mandate.target).toLocaleString('en-IN')}` : null)
    ],
    breakdowns: { dropReasons: group(dropped, (row) => row.Dead_Reason || row.Reason_for_Cold), sources, byPsm },
    efficiency: { leads: cohort.length, qualified: qualified.length, connected: firstSpans.length,
      averageFirstConnectMinutes: mean(firstSpans.map((value) => value * 24 * 60)),
      qualificationPerWorkingDay: workingDays ? qualified.length / workingDays : null,
      workingDays }
  };
}
