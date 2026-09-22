import { getTimeframeFilter, localDayKey } from './timeUtils.js';

// Order stages from dispatch through installation (the CRM spells "Dispatch" as "Dipatch" in one stage).
export const INSTALLATION_STAGES = [
  'First Dipatch Done',
  'Start First Installation Process',
  'First Installation Done',
  'Sent for Second Dispatch Approval',
  'Second Dispatch Done',
  'Start Second Installation Process',
  'Second Installation Done'
];
const AWAITING_INSTALLATION = new Set(['First Dipatch Done', 'Second Dispatch Done']);

export const VISIT_FIELDS = [
  'Name', 'Client_Name', 'Record_Type', 'AMS_Status', 'Completion_Date', 'Deploy_Date', 'Task_Name',
  'Installation_Manager', 'Team_Member_Name', 'Assigned_Team_Member_Count', 'Mandays', 'Client_Address_City',
  'Client_Address', 'Total_Sq_Ft_Installed', 'Target_Sq_Ft', 'Total_Hours_Lost_In_Hours', 'Labour_Cost'
].join(',');
export const ITEM_FIELDS = 'Parent_Id,Issue,Qty,Size,MRP_No,Responsible_Department,Case_Type,Factory_Remark,Item_Cost,Handing_Charge,Created_Time';
export const COMPLAINT_FIELDS = 'Name,Client_Name,Complaint_From,Raised_By_Installation,Stage,Status,Complaint_ID,Complaint_Date,Order_Names,Created_Time';
export const ORDER_FIELDS = [
  'Deal_Name', 'Stage', 'Account_Name', 'Contact_Name', 'Product_Type', 'Installation_Managers',
  'Actual_installation_start_date', 'Actual_End_Date', 'Second_Install_Actual_End_Date', 'Handover_Date', 'Est_Handover_Date'
].join(',');

const isTest = (text) => /\btest\b/i.test(String(text ?? ''));
const has = (value) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length);
const dateOf = (value) => (value ? String(value).slice(0, 10) : null);
const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
// A metric is "NA" (null) when no record in Zoho carries the field at all.
const sumOrNa = (rows, key, source) => (source.some((row) => has(row[key])) ? sum(rows, key) : null);

// Extra cost from mishandling = the item's cost plus its handling charge (Zoho field "Handing_Charge").
function extraCost(item) {
  if (!has(item.Item_Cost) && !has(item.Handing_Charge)) return null;
  return (Number(item.Item_Cost) || 0) + (Number(item.Handing_Charge) || 0);
}

function tally(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

export function buildInstallationDashboard({ visits, items, complaints, orders, holds, timeframe = 'daily', now = new Date() }) {
  const tf = getTimeframeFilter(timeframe);
  const today = localDayKey(now);

  // Installation visits
  const installVisits = visits.filter((visit) => visit.Record_Type === 'Installation' && !isTest(visit.Name));
  const done = (visit) => visit.AMS_Status === 'Done';
  const planned = installVisits.filter((visit) => tf.matches(visit.Deploy_Date));
  const completed = installVisits.filter((visit) => done(visit) && tf.matches(visit.Completion_Date));
  // Open visits whose date in this period has passed; older never-closed visits are only counted.
  const overdue = planned.filter((visit) => !done(visit) && visit.Deploy_Date < today);
  const olderOpen = installVisits.filter((visit) => !done(visit) && visit.Deploy_Date && visit.Deploy_Date < today && !tf.matches(visit.Deploy_Date));

  const managers = [...new Set(installVisits.map((visit) => visit.Installation_Manager).filter(Boolean))].sort();
  const byManager = [...managers, null].map((name) => {
    const mine = (list) => list.filter((visit) => (visit.Installation_Manager ?? null) === name);
    const periodVisits = mine(planned);
    return {
      name: name ?? 'Not assigned',
      planned: periodVisits.length,
      done: mine(completed).length,
      overdueOpen: mine(overdue).length,
      mandays: sum(periodVisits, 'Mandays'),
      teamMembers: new Set(periodVisits.flatMap((visit) => visit.Team_Member_Name ?? [])).size,
      topTask: tally(periodVisits.map((visit) => visit.Task_Name))[0]?.name ?? null,
      sqFtInstalled: sumOrNa(periodVisits, 'Total_Sq_Ft_Installed', installVisits),
      targetSqFt: sumOrNa(periodVisits, 'Target_Sq_Ft', installVisits),
      hoursLost: sumOrNa(periodVisits, 'Total_Hours_Lost_In_Hours', installVisits),
      labourCost: sumOrNa(periodVisits, 'Labour_Cost', installVisits)
    };
  }).filter((row) => row.planned || row.done || row.overdueOpen);

  const visitRow = (visit) => ({
    id: String(visit.id),
    date: visit.Deploy_Date ?? null,
    client: visit.Client_Name?.name ?? visit.Name,
    city: visit.Client_Address_City || visit.Client_Address || null,
    task: visit.Task_Name ?? null,
    manager: visit.Installation_Manager ?? null,
    team: (visit.Team_Member_Name ?? []).map((member) => member.replace(/\s*\(Installation\)/i, '')),
    mandays: visit.Mandays ?? null,
    stage: visit.AMS_Status ?? null,
    doneOn: visit.Completion_Date ?? null
  });

  // Missing and damaged items, reported against complaints
  const complaintById = new Map(complaints.map((complaint) => [String(complaint.id), complaint]));
  const realItems = items.filter((item) => !isTest(item.Parent_Id?.name));
  const itemsInPeriod = realItems.filter((item) => tf.matches(dateOf(item.Created_Time)));
  const missingItems = itemsInPeriod.map((item) => {
    const complaint = complaintById.get(String(item.Parent_Id?.id));
    return {
      id: String(item.id),
      reportedOn: dateOf(item.Created_Time),
      issue: item.Issue ?? null,
      qty: item.Qty ?? null,
      size: item.Size ?? null,
      mrp: item.MRP_No ?? null,
      department: item.Responsible_Department ?? null,
      caseType: item.Case_Type ?? null,
      factoryRemark: item.Factory_Remark ?? null,
      itemCost: has(item.Item_Cost) ? Number(item.Item_Cost) : null,
      handlingCharge: has(item.Handing_Charge) ? Number(item.Handing_Charge) : null,
      extraCost: extraCost(item),
      complaintStage: complaint?.Stage ?? null,
      raisedBy: complaint?.Raised_By_Installation ?? null,
      client: complaint?.Client_Name?.name ?? null
    };
  });
  const installComplaints = complaints.filter((complaint) => complaint.Complaint_From === 'Installation Team' && !isTest(complaint.Name));
  const complaintsInPeriod = installComplaints.filter((complaint) => tf.matches(dateOf(complaint.Complaint_Date ?? complaint.Created_Time)));

  // Orders in installation right now (current state, not limited to the period)
  const realOrders = orders.filter((order) => !isTest(order.Deal_Name));
  const orderRows = realOrders.map((order) => ({
    id: String(order.id),
    name: order.Deal_Name,
    client: [order.Contact_Name?.name, order.Account_Name?.name].find((name) => name && !/magppie/i.test(name)) ?? null,
    stage: order.Stage,
    awaitingInstallation: AWAITING_INSTALLATION.has(order.Stage),
    manager: order.Installation_Managers ?? null,
    startedOn: order.Actual_installation_start_date ?? null,
    firstEndedOn: order.Actual_End_Date ?? null,
    secondEndedOn: order.Second_Install_Actual_End_Date ?? null,
    handoverOn: order.Handover_Date ?? null,
    houseWarming: order.Est_Handover_Date ?? null
  })).sort((a, b) => INSTALLATION_STAGES.indexOf(a.stage) - INSTALLATION_STAGES.indexOf(b.stage));
  const startedInPeriod = realOrders.filter((order) => tf.matches(order.Actual_installation_start_date));

  const installHolds = holds.filter((hold) => /install/i.test(hold.reason));

  return {
    meta: {
      today,
      timeframe: tf.timeframe,
      reportLabel: tf.reportLabel,
      timeframeOptions: tf.options,
      lastVisitRecorded: installVisits.map((visit) => visit.Deploy_Date).filter(Boolean).sort().at(-1) ?? null,
      itemsRecordedEver: realItems.length,
      olderOpenVisits: olderOpen.length,
      olderOpenSince: olderOpen.map((visit) => visit.Deploy_Date).sort()[0] ?? null
    },
    kpis: [
      { key: 'done', label: 'Visits completed', value: completed.length, note: 'Stage done, in this period', tone: 'success' },
      { key: 'planned', label: 'Visits planned', value: planned.length, note: 'Visit date in this period', tone: 'info' },
      { key: 'overdue', label: 'Visits not closed', value: overdue.length, note: 'Visit date in this period passed, still open', tone: 'danger' },
      { key: 'awaiting', label: 'Dispatched, not installed', value: orderRows.filter((order) => order.awaitingInstallation).length, note: 'Order stage right now', tone: 'warning' },
      { key: 'missing', label: 'Missing items reported', value: realItems.length ? missingItems.length : null, note: realItems.length ? 'In this period' : 'Not recorded in Zoho yet', tone: 'danger' }
    ],
    missing: {
      items: missingItems,
      byDepartment: tally(missingItems.map((item) => item.department)),
      // NA (null) until any item in Zoho carries a cost or handling charge.
      extraCostTotal: realItems.some((item) => extraCost(item) !== null)
        ? missingItems.reduce((total, item) => total + (item.extraCost ?? 0), 0)
        : null,
      complaints: {
        total: complaintsInPeriod.length,
        byStage: tally(complaintsInPeriod.map((complaint) => complaint.Stage))
      }
    },
    visits: {
      byManager,
      list: planned.map(visitRow).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
      overdue: overdue.map(visitRow).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
      tasks: tally(planned.map((visit) => visit.Task_Name))
    },
    orders: {
      rows: orderRows,
      byStage: INSTALLATION_STAGES.map((stage) => ({ name: stage, count: orderRows.filter((order) => order.stage === stage).length })),
      startedInPeriod: startedInPeriod.length
    },
    holds: installHolds
  };
}
