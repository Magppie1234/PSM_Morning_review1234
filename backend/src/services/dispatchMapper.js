import { localDayKey } from './timeUtils.js';

// Zoho Deal stages in pipeline order (the CRM spells "Dispatch" as "Dipatch" in one stage).
export const FIRST_DISPATCH_STAGES = [
  'Handover to Factory',
  'Create MPP',
  'Material Procurement',
  'Prepare PDI',
  'Send PDI Drawings to Factory',
  'Create Production Set',
  'Start Production',
  'Electric/Plumbing Marking Aligned',
  'Electric/Plumbing Checking Done',
  'Align PDI',
  'PDI Done',
  'Site Approved for Dispatch',
  'Sent for PDI payment Approval',
  'PDI Payment Done'
];
export const SECOND_DISPATCH_STAGES = [
  'First Dipatch Done',
  'Start First Installation Process',
  'First Installation Done',
  'Sent for Second Dispatch Approval'
];
export const DISPATCH_FIELDS = [
  'Deal_Name', 'Stage', 'Owner', 'Account_Name', 'Contact_Name', 'Product_Type', 'Freight',
  'Dispatch_Date', 'Expected_Dispatch_Date', 'Tentative_Dispatch_Date', 'Est_Dispatch_Factory_Date',
  'Ready_For_Dispatch_done', 'Installation_Managers', 'Modified_Time'
].join(',');

const IN_PRODUCTION = FIRST_DISPATCH_STAGES.slice(0, FIRST_DISPATCH_STAGES.indexOf('Start Production') + 1);
const at = (stage, list, from) => list.indexOf(stage) >= list.indexOf(from);
const gate = (state, label, basis) => ({ state, label, basis });
const DAY_MS = 86_400_000;

function siteGate(deal, phase) {
  if (phase === 1) {
    return at(deal.Stage, FIRST_DISPATCH_STAGES, 'PDI Done')
      ? gate('done', 'Site approved', `Stage: ${deal.Stage}`)
      : gate('no', 'Site not approved', `Stage: ${deal.Stage}`);
  }
  // Before the second dispatch, the site is ready once the first installation is done.
  return at(deal.Stage, SECOND_DISPATCH_STAGES, 'First Installation Done')
    ? gate('done', 'Installation done', `Stage: ${deal.Stage}`)
    : gate('no', 'Installation in progress', `Stage: ${deal.Stage}`);
}

function financeGate(deal, phase, payment) {
  if (payment?.total && payment.paid === payment.total) return gate('done', 'Fully paid', `Payment milestones: ${payment.paid} of ${payment.total} paid`);
  if (phase === 1 && deal.Stage === 'PDI Payment Done') return gate('done', 'Payment done', 'Stage: PDI Payment Done');
  if (phase === 1 && deal.Stage === 'Sent for PDI payment Approval') return gate('waiting', 'Awaiting approval', 'Stage: Sent for PDI payment Approval');
  if (phase === 2 && deal.Stage === 'Sent for Second Dispatch Approval') return gate('waiting', 'Awaiting approval', 'Stage: Sent for Second Dispatch Approval');
  if (payment?.total) return gate('no', `${payment.paid} of ${payment.total} paid`, 'Payment milestones');
  if (phase === 1 && !at(deal.Stage, FIRST_DISPATCH_STAGES, 'Site Approved for Dispatch')) return gate('pending', 'Not yet due', 'Payment falls due after site approval');
  return gate('unknown', 'Not recorded', 'No payment milestones in Zoho');
}

function productionGate(deal, phase) {
  if (deal.Ready_For_Dispatch_done) return gate('done', 'Ready', `Ready for dispatch on ${String(deal.Ready_For_Dispatch_done).slice(0, 10)}`);
  if (phase === 1 && IN_PRODUCTION.includes(deal.Stage)) return gate('no', 'In production', `Stage: ${deal.Stage}`);
  return gate('unknown', 'Not recorded', '"Ready For Dispatch" not set in Zoho');
}

const GATE_NAMES = { site: 'site', finance: 'payment', production: 'production' };

function verdictFor(gates) {
  const names = (state) => Object.entries(gates).filter(([, value]) => value.state === state).map(([key]) => GATE_NAMES[key]);
  if (names('no').length) return { tone: 'danger', text: `Blocked: ${names('no').join(', ')}` };
  if (names('waiting').length) return { tone: 'warning', text: `Waiting: ${names('waiting').join(', ')}` };
  if (names('unknown').length) return { tone: 'info', text: `Confirm ${names('unknown').join(', ')}` };
  if (names('pending').length) return { tone: 'info', text: `Next: ${names('pending').join(', ')}` };
  return { tone: 'success', text: 'Ready to dispatch' };
}

function plannedDate(deal, phase) {
  const candidates = phase === 1
    ? [deal.Dispatch_Date, deal.Expected_Dispatch_Date, deal.Tentative_Dispatch_Date, deal.Est_Dispatch_Factory_Date]
    : [deal.Expected_Dispatch_Date, deal.Tentative_Dispatch_Date, deal.Est_Dispatch_Factory_Date];
  return candidates.find(Boolean) ?? null;
}

const isTestOrder = (deal) => /\btest\b/i.test(`${deal.Deal_Name} ${deal.Account_Name?.name ?? ''}`);
const isSunroof = (deal) => /sunroo+f/i.test(`${deal.Deal_Name} ${deal.Product_Type ?? ''}`);

export function buildDispatchDashboard(deals, paymentByOrder, holds, now = new Date()) {
  const today = localDayKey(now);
  const weekEnd = localDayKey(new Date(now.getTime() + 6 * DAY_MS));
  const dayDiff = (iso) => Math.round((Date.parse(iso) - Date.parse(today)) / DAY_MS);

  const relevant = deals.filter((deal) => !isTestOrder(deal) && !isSunroof(deal));
  const orders = relevant.map((deal) => {
    const phase = SECOND_DISPATCH_STAGES.includes(deal.Stage) ? 2 : 1;
    const payment = paymentByOrder.get(String(deal.id));
    const gates = { site: siteGate(deal, phase), finance: financeGate(deal, phase, payment), production: productionGate(deal, phase) };
    const planned = plannedDate(deal, phase);
    let bucket = 'none';
    if (planned && planned < today) bucket = 'overdue';
    else if (planned && planned <= weekEnd) bucket = 'week';
    else if (planned) bucket = 'later';
    return {
      id: String(deal.id),
      name: deal.Deal_Name,
      // Many orders sit under the company's own account; the contact is the real client there.
      client: [deal.Contact_Name?.name, deal.Account_Name?.name].find((name) => name && !/magppie/i.test(name)) ?? '—',
      owner: deal.Owner?.name ?? 'Unassigned',
      stage: deal.Stage,
      phase,
      planned,
      bucket,
      daysToGo: planned ? dayDiff(planned) : null,
      freight: deal.Freight ?? null,
      gates,
      verdict: verdictFor(gates)
    };
  }).sort((a, b) => (a.planned ?? '9999').localeCompare(b.planned ?? '9999') || a.phase - b.phase);

  const ids = (list) => list.map((order) => order.id);
  const overdue = orders.filter((order) => order.bucket === 'overdue');
  const week = orders.filter((order) => order.bucket === 'week');
  const weekBlocked = week.filter((order) => order.verdict.tone !== 'success');
  const ready = orders.filter((order) => order.verdict.tone === 'success');
  const noDate = orders.filter((order) => order.bucket === 'none');
  const heldVehicles = holds.filter((hold) => !/^\d{4}-\d{2}-\d{2}$/.test(hold.actualDate) || hold.plannedDate >= localDayKey(new Date(now.getTime() - 7 * DAY_MS)));

  const gateCounts = (key) => ({
    done: orders.filter((order) => order.gates[key].state === 'done').length,
    waiting: orders.filter((order) => order.gates[key].state === 'waiting').length,
    no: orders.filter((order) => order.gates[key].state === 'no').length,
    unknown: orders.filter((order) => order.gates[key].state === 'unknown').length,
    pending: orders.filter((order) => order.gates[key].state === 'pending').length
  });

  const days = Array.from({ length: 7 }, (_, offset) => {
    const key = localDayKey(new Date(now.getTime() + offset * DAY_MS));
    const planned = week.filter((order) => order.planned === key);
    return {
      date: key,
      label: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' }).format(new Date(now.getTime() + offset * DAY_MS)),
      planned: planned.length,
      ready: planned.filter((order) => order.verdict.tone === 'success').length
    };
  });

  return {
    meta: {
      today,
      windowLabel: `Overdue and next 7 days · to ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(now.getTime() + 6 * DAY_MS))}`,
      excludedTestOrders: deals.filter(isTestOrder).length,
      paymentMilestonesInUse: relevant.some((deal) => paymentByOrder.get(String(deal.id))?.total > 0)
    },
    kpis: [
      { key: 'overdue', label: 'Overdue dispatches', value: overdue.length, note: 'Planned date passed', tone: 'danger', ids: ids(overdue) },
      { key: 'weekBlocked', label: 'Due this week, not ready', value: weekBlocked.length, note: `${week.length} due in the next 7 days`, tone: 'warning', ids: ids(weekBlocked) },
      { key: 'ready', label: 'Ready to dispatch', value: ready.length, note: 'Site, payment and production all green', tone: 'success', ids: ids(ready) },
      { key: 'noDate', label: 'No dispatch date', value: noDate.length, note: `of ${orders.length} orders heading to dispatch`, tone: 'warning', ids: ids(noDate) },
      { key: 'held', label: 'Vehicles held', value: heldVehicles.length, note: 'From the dispatch sheet', tone: 'danger', ids: [] }
    ],
    gates: { site: gateCounts('site'), finance: gateCounts('finance'), production: gateCounts('production') },
    orders,
    transport: {
      days,
      holds: heldVehicles,
      freightTotal: week.reduce((sum, order) => sum + (Number(order.freight) || 0), 0),
      vehiclesInZoho: false
    }
  };
}
