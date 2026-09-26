import { zohoGet } from './zohoClient.js';
import { isRealDeal, rankOf } from './preDesignBoard.js';

// API names verified against Deals field metadata. No monetary or milestone values are inferred.
const FIELDS = ['Deal_Name', 'Opportunity_Name', 'Stage', 'Created_Time', 'Designer_Name',
  'Number_of_Design_Revisions', 'Design_Approved_Date', 'Send_For_Approval_Date',
  'First_Measurement_Status', 'Measurement_open', 'Measurement_done', 'Site_Measurement_Person',
  'EPT_Status', 'EPT_Marking_open', 'EPT_Marking_done', 'EPT_Verification_open', 'EPT_Verification_done',
  'EPT_Signoff_open', 'EPT_Signoff_done', 'Signed_Appliances_List',
  'Mood_Board_3D_Status', 'Mood_Board_Signoff_open', 'Mood_Board_Signoff_done',
  'Production_Drawing_Status', 'Production_Drawing_Signoff_open', 'Production_Drawing_Signoff_done',
  'Payment_Confirmation', 'Payment_Received_Document',
  'PDI_Status', 'PDI_Visit_open', 'PDI_Visit_done', 'PDI_Done', 'Expected_PDI_date', 'Aligned_PDI_date'];
const present = v => v !== null && v !== undefined && v !== '' && v !== '-None-';
const text = v => present(v) ? String(v) : null;
const hasFile = v => Array.isArray(v) && v.length > 0;
const date = v => present(v) && Number.isFinite(Date.parse(v)) ? v : null;
const days = (v, now) => date(v) ? Math.max(0, Math.floor((now - Date.parse(v)) / 86400000)) : null;

export async function getPostDesignDeals(since, extraFields = []) {
  const cutoff = Date.parse(`${since}T00:00:00Z`) - 86400000;
  const rows = [];
  let token;
  for (let page = 1; page <= 100; page++) {
    if (page > 10 && !token) throw new Error('Zoho pagination incomplete');
    const payload = await zohoGet('Deals', { fields: [...new Set([...FIELDS, ...extraFields])].join(','), per_page: 200,
      sort_by: 'Created_Time', sort_order: 'desc', ...(page > 10 ? { page_token: token } : { page }) });
    const batch = payload.data ?? [];
    rows.push(...batch);
    if (!payload.info?.more_records || !batch.length || Date.parse(batch.at(-1).Created_Time) < cutoff) return rows;
    token = payload.info?.next_page_token;
  }
  throw new Error('Zoho order limit reached; narrow the reporting period');
}

export const POST_STAGES = [
  { key: 'approval', label: 'Design Approval', note: 'Handover from Pre Design' },
  { key: 'ep', label: 'EP Electrical Plumbing', note: 'Marking, checking & appliances' },
  { key: 'moodboard', label: 'Moodboard Approval', note: 'Finishes & moodboard sign-off' },
  { key: 'signout', label: 'PD Sign Out', note: 'Production drawing & payment' },
  { key: 'pdi', label: 'PDI', note: 'Production Design Inspection' }
];

export function buildPostDesignBoard({ deals, tf, now = Date.now() }) {
  const cohort = deals.filter(isRealDeal).filter(d => tf.matches(d.Created_Time));
  const designerCounts = new Map();
  const clientCounts = new Map();
  for (const d of cohort) {
    if (text(d.Designer_Name)) designerCounts.set(d.Designer_Name, (designerCounts.get(d.Designer_Name) ?? 0) + 1);
    if (d.Opportunity_Name?.id) clientCounts.set(d.Opportunity_Name.id, (clientCounts.get(d.Opportunity_Name.id) ?? 0) + 1);
  }
  const records = cohort.filter(d => {
    const designEvidence = text(d.Designer_Name) || date(d.Design_Approved_Date) || date(d.Measurement_open)
      || date(d.Production_Drawing_Signoff_open) || date(d.PDI_Visit_open);
    return designEvidence && (rankOf(d.Stage) >= 4 || date(d.Design_Approved_Date)
      || date(d.EPT_Signoff_open) || date(d.Mood_Board_Signoff_open) || date(d.Production_Drawing_Signoff_open) || date(d.PDI_Visit_open));
  }).map(d => {
    const done = {
      approval: Boolean(date(d.Design_Approved_Date)),
      ep: Boolean(date(d.EPT_Signoff_done)) || d.EPT_Status === 'Completed',
      moodboard: Boolean(date(d.Mood_Board_Signoff_done)) || d.Mood_Board_3D_Status === 'Approved',
      signout: Boolean(date(d.Production_Drawing_Signoff_done)),
      pdi: Boolean(date(d.PDI_Visit_done)) || d.PDI_Done === true || d.PDI_Status === 'Approved'
    };
    const started = { approval: d.Send_For_Approval_Date, ep: d.EPT_Signoff_open || d.EPT_Marking_open,
      moodboard: d.Mood_Board_Signoff_open, signout: d.Production_Drawing_Signoff_open, pdi: d.PDI_Visit_open };
    const activity = { ep: d.EPT_Status, moodboard: d.Mood_Board_3D_Status,
      signout: d.Production_Drawing_Status, pdi: d.PDI_Status };
    // Each milestone independently records completion. Later activity never invents earlier approval.
    const milestones = Object.fromEntries(POST_STAGES.map(({ key }) => [key, {
      done: done[key], pendingDays: done[key] ? null : days(started[key], now),
      status: done[key] ? 'Complete' : date(started[key]) || (text(activity[key]) && activity[key] !== 'Not Started') ? 'Pending' : 'Not recorded'
    }]));
    return { id: String(d.id), client: d.Opportunity_Name?.name || d.Deal_Name || 'Unnamed order',
      order: d.Deal_Name, designer: text(d.Designer_Name), orders: d.Opportunity_Name?.id ? clientCounts.get(d.Opportunity_Name.id) : null,
      designerOrders: text(d.Designer_Name) ? designerCounts.get(d.Designer_Name) : null,
      revisions: present(d.Number_of_Design_Revisions) && Number.isFinite(Number(d.Number_of_Design_Revisions)) ? Number(d.Number_of_Design_Revisions) : null,
      firstMeasurement: date(d.Measurement_done) || text(d.First_Measurement_Status),
      measurementPerson: text(d.Site_Measurement_Person), designApproval: date(d.Design_Approved_Date),
      epMarking: date(d.EPT_Marking_done) || (date(d.EPT_Marking_open) ? 'Pending' : null),
      epChecking: date(d.EPT_Verification_done) || (date(d.EPT_Verification_open) ? 'Pending' : null),
      appliancesReceived: null, applianceList: hasFile(d.Signed_Appliances_List) ? 'Signed list on file' : 'Not recorded',
      moodboardStatus: text(d.Mood_Board_3D_Status), moodboardSignoff: date(d.Mood_Board_Signoff_done),
      productionStatus: text(d.Production_Drawing_Status), productionSignoff: date(d.Production_Drawing_Signoff_done),
      paymentEvidence: hasFile(d.Payment_Received_Document) ? 'Receipt on file' : hasFile(d.Payment_Confirmation) ? 'Confirmation on file' : 'Not recorded',
      pdiStatus: text(d.PDI_Status), pdiExpected: date(d.Expected_PDI_date), pdiAligned: date(d.Aligned_PDI_date), pdiDone: date(d.PDI_Visit_done),
      milestones };
  });
  return { records, stages: POST_STAGES, meta: { reportLabel: tf.reportLabel,
    scope: 'Orders created in the selected period that have entered Post Design. Each card tracks the same handover cohort; completed milestones remain visible.',
    counts: 'Client and designer order counts include all orders created in the selected period, before filters.',
    pending: 'Days pending starts at the recorded opening date of the selected milestone. A dash means the date is not recorded.',
    appliances: 'Zoho has a signed appliance list, but no verified field for physical appliance receipt.',
    payment: 'Payment evidence is recorded at order level; it does not confirm the amount or a PD Sign Out instalment.' } };
}
