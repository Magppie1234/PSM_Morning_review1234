import { cityBucketOf, isOpenStage, isQualifiedStage, isRealRecord, stageKeyOf, valueOf } from '../config/salesFunnel.js';
import { localDayKey } from './timeUtils.js';

const linkedId = (row, ids) => [row?.What_Id?.id, row?.Who_Id?.id, row?.Parent_Id?.id]
  .map(String).find((id) => ids.has(id)) ?? '';
const metric = (key, label, value, unit, detail, sample = null) => ({ key, label, value, unit, detail, sample });
const rate = (part, whole) => whole ? part / whole * 100 : null;
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const inr = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const ranked = (rows, keyOf, valueOfRow = () => 0) => [...rows.reduce((map, row) => {
  const label = String(keyOf(row) || 'Not recorded');
  const item = map.get(label) ?? { label, count: 0, value: 0 };
  item.count += 1;
  item.value += valueOfRow(row);
  map.set(label, item);
  return map;
}, new Map()).values()].sort((a, b) => b.count - a.count);

// Sales Health follows the Sales board's Contacts cohort and Current Stage rules. Stage movement uses
// Opportunity_Stage_History; Modified_Time on the contact is not a stage timestamp.
export function buildSalesHealth({ contacts, tf, city, history, tasks, notes }) {
  const today = localDayKey(new Date());
  const cohort = contacts.filter((row) => isRealRecord(row) && tf.matches(row.Created_Time) &&
    (city === 'all' || cityBucketOf(row.City) === city || String(row.City ?? '').toLowerCase() === String(city).toLowerCase()));
  const open = cohort.filter((row) => isOpenStage(stageKeyOf(row.Client_Status)));
  const ids = new Set(cohort.map((row) => String(row.id)));
  const openIds = new Set(open.map((row) => String(row.id)));
  const followUp = (row) => String(row.Next_Follow_UP_Date ?? row.Next_Follow_Up_Date1 ?? '').slice(0, 10);
  const estimated = (row) => String(row.Est_Closoure_Date ?? '').slice(0, 10);
  const missed = open.filter((row) => followUp(row) && followUp(row) < today);
  const noFollowUp = open.filter((row) => !followUp(row));
  const lapsed = open.filter((row) => estimated(row) && estimated(row) < today);
  const noEstimate = open.filter((row) => !estimated(row));
  const latestStage = (row) => history?.get(String(row.id))?.entries?.at(-1)?.enteredAt ?? null;
  const stalled = history ? open.filter((row) => {
    const at = latestStage(row);
    return at && (Date.parse(today) - Date.parse(at)) >= 30 * 86_400_000;
  }) : null;
  const unowned = open.filter((row) => !row.Owner?.name || /^magppie$/i.test(row.Owner.name));
  const closed = cohort.filter((row) => stageKeyOf(row.Client_Status) === 'closed');
  const qualified = cohort.filter((row) => isQualifiedStage(stageKeyOf(row.Client_Status)) ||
    stageKeyOf(row.Client_Status) === 'closed');
  const values = closed.map((row) => Number(row.Total_Opportunity_Value) * 100_000)
    .filter((value) => Number.isFinite(value) && value > 0);
  const dropped = cohort.filter((row) => stageKeyOf(row.Client_Status) === 'dead');
  const overdueTasks = tasks == null ? null : tasks.filter((row) => linkedId(row, ids) &&
    String(row.Due_Date ?? '').slice(0, 10) < today && row.Due_Date &&
    !/completed|cancelled|closed/i.test(String(row.Status ?? '')));
  const latestNotes = new Map();
  for (const note of notes ?? []) {
    const id = linkedId(note, openIds);
    if (openIds.has(id) && (!latestNotes.has(id) || note.Created_Time > latestNotes.get(id))) latestNotes.set(id, note.Created_Time);
  }
  const noteDays = notes == null ? null : [...latestNotes.values()].map((at) =>
    (Date.parse(today) - Date.parse(at)) / 86_400_000).filter((value) => Number.isFinite(value) && value >= 0);
  const ladder = ['Not Yet Validated', 'Only Validated', 'Validated But Design Open',
    'Design Open + Price Open', 'Design Closed + Price Open'].map((label) => ({
    label, count: cohort.filter((row) => String(row.Client_Status ?? '') === label).length
  }));
  const bySalesperson = ranked(qualified, (row) => row.Owner?.name).map((row) => {
    const wins = closed.filter((item) => String(item.Owner?.name || 'Not recorded') === row.label).length;
    return { ...row, closed: wins, rate: rate(wins, row.count) };
  });
  const totalValue = (rows) => inr(rows.reduce((sum, row) => sum + valueOf(row), 0));
  return {
    scope: `${cohort.length} qualified leads created in ${tf.reportLabel}`,
    metrics: [
      metric('followUpPassed', 'Follow-up date passed', missed.length, 'count', 'Open contacts with follow-up before today', totalValue(missed)),
      metric('noFollowUp', 'No follow-up date set', noFollowUp.length, 'count', 'Open contacts without either follow-up field', totalValue(noFollowUp)),
      metric('closureLapsed', 'Estimated closure lapsed', lapsed.length, 'count', 'Open contacts with estimate before today', totalValue(lapsed)),
      metric('noClosure', 'No estimated closure date', noEstimate.length, 'count', 'Open contacts without an estimate', totalValue(noEstimate)),
      metric('stalled', 'Stalled deals', stalled?.length ?? null, 'count', stalled ? 'No Contacts.Stage movement for 30+ days' : 'Stage history unavailable', stalled ? totalValue(stalled) : null),
      metric('ladderConversion', 'Stage-ladder conversion', null, '%', 'Client_Status history is not tracked in Zoho; current S1–S5 distribution is shown below. S6 flow is the dated card above.'),
      metric('unowned', 'Unowned pipeline', unowned.length, 'count', 'Blank or generic Magppie owner', totalValue(unowned)),
      metric('winRate', 'Qualified → closed ratio', rate(closed.length, qualified.length), '%', 'Closed contacts ÷ qualified contacts in the created cohort', `${closed.length} / ${qualified.length}`),
      metric('averageDeal', 'Average deal size', mean(values), 'inr', 'Mean Value(₹ Lacs) for closed contacts', `${values.length} valued closures`),
      metric('closureTarget', 'Closure target progress', null, '%', 'Target not configured'),
      metric('communication', 'Communication recency', noteDays ? mean(noteDays) : null, 'days',
        noteDays ? 'Mean days since the latest Zoho note on open contacts with a note' : 'Notes unavailable',
        noteDays ? `${noteDays.length} / ${open.length} open contacts have a note` : null),
      metric('overdueTasks', 'Overdue tasks on qualified leads', overdueTasks?.length ?? null, 'count',
        overdueTasks ? 'Open tasks attached to contacts in the selected cohort' : 'Task data unavailable')
    ],
    breakdowns: { ladder, bySalesperson, droppedReasons: ranked(dropped, (row) => row.Lead_Drop_Reason, valueOf),
      noteAge: noteDays ? [
        { label: '0–7 days', count: noteDays.filter((day) => day <= 7).length },
        { label: '8–30 days', count: noteDays.filter((day) => day > 7 && day <= 30).length },
        { label: '31+ days', count: noteDays.filter((day) => day > 30).length },
        { label: 'No note', count: open.length - noteDays.length }
      ] : [] }
  };
}
