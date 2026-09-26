import { zohoGet } from './zohoClient.js';
import { getPostDesignDeals } from './postDesignBoard.js';
import { isRealDeal } from './preDesignBoard.js';

const clean = v => v == null || v === '' || v === '-None-' ? null : v;
const stamp = v => clean(v) && Number.isFinite(Date.parse(v)) ? v : null;
const num = v => clean(v) !== null && Number.isFinite(Number(v)) ? Number(v) : null;
const PAID = new Set(['Paid', 'Paid/Confirmed']);
const PDI_STAGES = new Set(['Prepare PDI', 'PDI', 'PDI Done', 'PDI Verifiction', 'Align PDI', 'Request Visit for PDI', 'Send PDI Drawings to Factory', 'Site Approved for Dispatch', 'Sent for PDI payment Approval', 'PDI Payment Done']);
// These stages explicitly record approval beyond PDI; visit completion alone does not.
const VERIFIED_STAGES = new Set(['Site Approved for Dispatch', 'Sent for PDI payment Approval', 'PDI Payment Done']);

async function readModule(module, fields) {
  const rows = [];
  let token;
  for (let page = 1; page <= 100; page++) {
    if (page > 10 && !token) throw new Error(`${module} pagination incomplete`);
    const result = await zohoGet(module, { fields, per_page: 200, ...(page > 10 ? { page_token: token } : { page }) });
    rows.push(...(result.data ?? []));
    if (!result.info?.more_records) return rows;
    token = result.info?.next_page_token;
  }
  throw new Error(`${module} read limit reached`);
}

export function mapPdiPayments(milestones, links) {
  const byId = new Map(milestones.filter(m => m.Milestone_Number === 'PDI Approval').map(m => [String(m.id), m]));
  const result = new Map();
  for (const link of links) {
    const milestone = byId.get(String(link.Payment_Milestones?.id));
    const order = link.Orders?.id;
    if (!order || !milestone) continue;
    const entries = result.get(String(order)) ?? new Map();
    entries.set(String(milestone.id), milestone);
    result.set(String(order), entries);
  }
  return new Map([...result].map(([id, entries]) => [id, [...entries.values()]]));
}

export async function loadPdiReview(tf) {
  const [deals, paymentResult] = await Promise.all([
    getPostDesignDeals(tf.start, ['Owner', 'Product_Type', 'Floor', 'Cabinet_Area_Sqft', 'Finished_Kitchen_Ceiling_Height',
      'Ready_For_Dispatch_open', 'Ready_For_Dispatch_done', 'Expected_Dispatch_Date', 'Dispatch_done', 'Remarks']),
    Promise.all([readModule('Payment_Milestones', 'Milestone_Number,Payment_Status'),
      readModule('Payment_M_X_Orders', 'Orders,Payment_Milestones')])
      .then(([milestones, links]) => ({ payments: mapPdiPayments(milestones, links) }))
      .catch(error => { console.error('PDI payments unavailable:', error.message); return { payments: null }; })
  ]);
  return buildPdiReview(deals, paymentResult.payments, tf);
}

export function buildPdiReview(deals, payments, tf, now = Date.now()) {
  const cohort = deals.filter(isRealDeal).filter(d => !/sunroo+f/i.test(`${d.Deal_Name} ${d.Product_Type ?? ''}`)).filter(d => tf.matches(d.Created_Time));
  const counts = (key) => cohort.reduce((m, d) => { const k = key(d); if (k) m.set(k, (m.get(k) ?? 0) + 1); return m; }, new Map());
  const clients = counts(d => d.Opportunity_Name?.id), designers = counts(d => clean(d.Designer_Name));
  const records = cohort.filter(d => PDI_STAGES.has(d.Stage) || clean(d.PDI_Status) || d.PDI_Done === true
    || stamp(d.PDI_Visit_open) || stamp(d.PDI_Visit_done) || stamp(d.Ready_For_Dispatch_open) || stamp(d.Ready_For_Dispatch_done))
    .map(d => {
      const verified = d.PDI_Status === 'Approved' || VERIFIED_STAGES.has(d.Stage);
      const paymentRows = payments?.get(String(d.id)) ?? [];
      let paymentDone = payments === null ? 'Unavailable' : 'Not recorded';
      if (paymentRows.length) {
        const states = paymentRows.map(m => clean(m.Payment_Status));
        paymentDone = states.every(s => PAID.has(s)) ? 'Done'
          : states.some(s => ['Partially Paid', 'Partially Confirmed'].includes(s)) ? 'Partially paid'
            : states.some(s => s === 'Unpaid') ? 'Pending' : 'Not recorded';
      } else if (d.Stage === 'PDI Payment Done') paymentDone = 'Done';
      const dispatched = Boolean(stamp(d.Dispatch_done));
      const ready = Boolean(stamp(d.Ready_For_Dispatch_done));
      const dispatchStatus = dispatched ? 'Dispatched' : ready ? 'Ready for Dispatch' : 'Pending';
      const reasons = [];
      if (dispatchStatus === 'Pending') {
        if (!verified) reasons.push(clean(d.PDI_Status) ? `PDI: ${d.PDI_Status}` : 'PDI verification not recorded');
        if (paymentDone !== 'Done') reasons.push(`PDI payment: ${paymentDone.toLowerCase()}`);
        reasons.push(stamp(d.Ready_For_Dispatch_open) ? 'Dispatch readiness approval pending' : 'Dispatch readiness not recorded');
      }
      return { id: String(d.id), client: d.Opportunity_Name?.name || d.Deal_Name, order: d.Deal_Name,
        designer: clean(d.Designer_Name), owner: d.Owner?.name, orders: clients.get(d.Opportunity_Name?.id) ?? null,
        designerOrders: designers.get(d.Designer_Name) ?? null, revisions: num(d.Number_of_Design_Revisions),
        firstMeasurement: stamp(d.Measurement_done) || clean(d.First_Measurement_Status), designApproval: stamp(d.Design_Approved_Date),
        pendingDays: !verified && stamp(d.PDI_Visit_open) ? Math.max(0, Math.floor((now - Date.parse(d.PDI_Visit_open)) / 86400000)) : null,
        verified, verification: verified ? 'Done' : 'Pending / not recorded', pdiStatus: clean(d.PDI_Status),
        pdiVisitDone: stamp(d.PDI_Visit_done), pdiExpected: stamp(d.Expected_PDI_date), pdiAligned: stamp(d.Aligned_PDI_date),
        paymentDone, paymentBasis: paymentRows.length ? 'Linked PDI Approval payment milestones' : d.Stage === 'PDI Payment Done' ? 'Zoho stage: PDI Payment Done' : 'No linked PDI Approval payment status',
        dispatchStatus, dispatchReason: reasons.join('; ') || null, dispatchReadyOn: stamp(d.Ready_For_Dispatch_done),
        dispatchExpected: stamp(d.Expected_Dispatch_Date), remarks: clean(d.Remarks),
        product: clean(d.Product_Type), floor: clean(d.Floor), area: num(d.Cabinet_Area_Sqft), height: num(d.Finished_Kitchen_Ceiling_Height), surveyor: clean(d.Site_Measurement_Person) };
    });
  return { records, meta: { reportLabel: tf.reportLabel, paymentUnavailable: payments === null,
    scope: 'Magppie orders created in the selected period with PDI or dispatch-readiness activity. Test and Sunroof orders are excluded.',
    mapping: 'Verification uses PDI Status = Approved or an explicit site-approved/PDI-payment stage. Visit completion alone is not verification. Payment Done uses linked PDI Approval milestones, with the PDI Payment Done stage as fallback.',
    dispatch: 'Ready uses the recorded Ready For Dispatch completion date. Dispatched orders stay separate. Pending reasons describe recorded blockers or missing evidence; CRM remarks are shown separately.',
    counts: 'Client and designer order counts cover all Magppie orders created in the selected period. Pending days starts at the PDI opening date.' } };
}
