import { getAllRecords, zohoGet } from './zohoClient.js';
import { getTimeframeFilter, localDayKey } from './timeUtils.js';

// AMS (annual maintenance service) lives in three Zoho modules:
//   AMS_Complaints (Record Type = AMS)  — one record per scheduled service, with its AMS date and stage
//   Visit_Module   (Visit For = AMS)    — the service visits
//   AMS_Done_Data_by_Team (visit subform) — products inspected and paid / unpaid per visit
const SCHEDULE_FIELDS = 'Name,Client_Name,Stage,Status,AMS_Date,Remarks,Client_Address_City,Client_Address,Order_Names,AMS_Completed_Date';
const VISIT_FIELDS = 'Name,Client_Name,AMS_Status,Status,Purpose,AMS_Quarter,Completion_Date,Deploy_Date,Scheduled_Visit_Date,Team_Member_Name,Client_Address_City,Client_Address';
const MAX_VISIT_DETAILS = 80;

const isTest = (text) => /\btest\b/i.test(String(text ?? ''));
const clean = (name) => String(name ?? '').replace(/\s*\[AMS-\d+\]|\s*-\s*AMS Service/gi, '').trim() || null;
// Zoho has spelling variants of the same city; fold them so filters and counts don't split.
const CITY_ALIASES = { gurugram: 'Gurgaon', faridabaad: 'Faridabad', chattisgarh: 'Chhattisgarh', bangalore: 'Bengaluru', banglore: 'Bengaluru' };
function cityOf(record) {
  const raw = (record.Client_Address_City || String(record.Client_Address ?? '').split(/\n|,/)[0]).trim();
  if (!raw) return null;
  return CITY_ALIASES[raw.toLowerCase()] ?? raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tally(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

async function visitTeamData(visits) {
  const details = await Promise.all(visits.slice(0, MAX_VISIT_DETAILS).map(async (visit) => {
    try {
      const payload = await zohoGet(`Visit_Module/${visit.id}`);
      return [String(visit.id), payload.data?.[0]?.AMS_Done_Data_by_Team ?? []];
    } catch {
      return [String(visit.id), []];
    }
  }));
  return new Map(details);
}

export async function loadAmsDashboard(timeframe = 'daily', now = new Date()) {
  const tf = getTimeframeFilter(timeframe);
  const today = localDayKey(now);
  const between = `between:${tf.start},${tf.end}`;

  const [scheduleRaw, backlogRaw, visitsRaw] = await Promise.all([
    getAllRecords('AMS_Complaints', SCHEDULE_FIELDS, { criteria: `((Record_Type:equals:AMS)and(AMS_Date:${between}))` }),
    getAllRecords('AMS_Complaints', 'AMS_Date', { criteria: `((Record_Type:equals:AMS)and(Stage:equals:Planned)and(AMS_Date:less_than:${tf.start}))`, maxPages: 15 }),
    getAllRecords('Visit_Module', VISIT_FIELDS, { criteria: `((Record_Type:equals:AMS)and((Deploy_Date:${between})or(Completion_Date:${between})or(Scheduled_Visit_Date:${between})))` })
  ]);

  const schedule = scheduleRaw.filter((record) => !isTest(record.Name));
  const visits = visitsRaw.filter((visit) => !isTest(visit.Name));
  const teamByVisit = await visitTeamData(visits);

  const done = schedule.filter((record) => record.Stage === 'Done');
  const missed = schedule.filter((record) => record.Stage !== 'Done' && record.AMS_Date < today);
  const visitsDone = visits.filter((visit) => visit.AMS_Status === 'Done' && tf.matches(visit.Completion_Date));
  const teamRows = visits.flatMap((visit) => (teamByVisit.get(String(visit.id)) ?? []).map((row) => ({ ...row, visitId: String(visit.id) })));
  const hasTeamData = teamRows.length > 0;

  const members = [...new Set(visits.flatMap((visit) => visit.Team_Member_Name ?? []))].sort();
  const byMember = members.map((member) => {
    const mine = visits.filter((visit) => (visit.Team_Member_Name ?? []).includes(member));
    const rows = teamRows.filter((row) => row.Team_Member_Name === member);
    return {
      name: member,
      visits: mine.length,
      done: mine.filter((visit) => visit.AMS_Status === 'Done').length,
      followUps: mine.filter((visit) => /follow/i.test(visit.Purpose ?? '')).length,
      products: hasTeamData ? rows.reduce((total, row) => total + (Number(row.Number_of_Product) || 0), 0) : null,
      clientPaid: hasTeamData ? rows.filter((row) => row.Paid_Unpaid === 'Client Paid').length : null,
      companyPaid: hasTeamData ? rows.filter((row) => row.Paid_Unpaid === 'Company Paid').length : null,
      unpaid: hasTeamData ? rows.filter((row) => row.Paid_Unpaid === 'Unpaid').length : null
    };
  }).sort((a, b) => b.visits - a.visits);

  return {
    meta: {
      today,
      timeframe: tf.timeframe,
      reportLabel: tf.reportLabel,
      start: tf.start,
      end: tf.end,
      timeframeOptions: tf.options,
      olderPlanned: backlogRaw.length,
      olderPlannedCapped: backlogRaw.length >= 3000
    },
    kpis: [
      { key: 'due', label: 'AMS due', value: schedule.length, note: 'AMS date in this period', tone: 'info' },
      { key: 'done', label: 'AMS done', value: done.length, note: schedule.length ? `${Math.round((done.length / schedule.length) * 100)}% of due` : 'None due', tone: 'success' },
      { key: 'missed', label: 'Missed (still planned)', value: missed.length, note: 'AMS date passed, not done', tone: 'danger' },
      { key: 'visits', label: 'Service visits done', value: visitsDone.length, note: 'Visit done date in this period', tone: 'info' },
      { key: 'paid', label: 'Paid services', value: hasTeamData ? teamRows.filter((row) => /paid/i.test(row.Paid_Unpaid ?? '') && row.Paid_Unpaid !== 'Unpaid').length : null, note: hasTeamData ? 'Client or company paid' : 'No visit details in this period', tone: 'warning' }
    ],
    schedule: {
      rows: schedule.map((record) => ({
        id: String(record.id),
        client: clean(record.Client_Name?.name ?? record.Name),
        city: cityOf(record),
        order: record.Order_Names ?? null,
        amsDate: record.AMS_Date ?? null,
        stage: record.Stage ?? null,
        missed: record.Stage !== 'Done' && record.AMS_Date < today,
        remarks: record.Remarks ?? null,
        completedOn: record.AMS_Completed_Date ?? null
      })).sort((a, b) => (a.amsDate ?? '').localeCompare(b.amsDate ?? '')),
      byStage: tally(schedule.map((record) => record.Stage)),
      byCity: tally(schedule.map(cityOf)).slice(0, 8),
      reasons: tally(schedule.map((record) => record.Remarks))
    },
    visits: {
      rows: visits.map((visit) => ({
        id: String(visit.id),
        client: clean(visit.Client_Name?.name ?? visit.Name),
        city: cityOf(visit),
        purpose: visit.Purpose ?? null,
        quarter: visit.AMS_Quarter ?? null,
        scheduledOn: visit.Scheduled_Visit_Date ?? null,
        visitedOn: visit.Deploy_Date ?? null,
        doneOn: visit.Completion_Date ?? null,
        stage: visit.AMS_Status ?? null,
        team: visit.Team_Member_Name ?? [],
        products: (teamByVisit.get(String(visit.id)) ?? []).flatMap((row) => row.Product_Inspected1 ?? []),
        payment: tally((teamByVisit.get(String(visit.id)) ?? []).map((row) => row.Paid_Unpaid)).map((item) => item.name).join(', ') || null
      })).sort((a, b) => (a.visitedOn ?? '').localeCompare(b.visitedOn ?? '')),
      byMember,
      productsInspected: tally(teamRows.flatMap((row) => row.Product_Inspected1 ?? []))
    }
  };
}
