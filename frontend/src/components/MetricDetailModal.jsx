import { useState, useEffect } from 'react';
import { ArrivalTime, arrivalDate } from './leadArrival.jsx';
import { X, ShieldCheck, ArrowLeft, Ruler, Building, Calendar, Phone, Flame, CheckCircle2, AlertTriangle, FileText, User, Sparkles } from 'lucide-react';
import { Icon } from './Icon.jsx';
import { SortTh, TableSearch, amountOf, timeOf, useTableTools } from './tableTools.jsx';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const formatMoney = (val) => typeof val === 'number' ? `₹${inr.format(val / 100000)}L` : String(val ?? '—');

// The columns change with the kind of record on show, so each sort key reads whichever field is there.
const RECORD_FIELDS = {
  name: (rec) => rec.client || rec.name,
  owner: (rec) => rec.designer || rec.owner || rec.psm,
  created: (rec) => timeOf(rec.created),
  detail: (rec) => rec.product ?? rec.space ?? rec.applianceStatus,
  stage: (rec) => rec.stage ?? rec.city ?? rec.siteCompletionDate,
  followUp: (rec) => rec.paymentStatus ?? rec.followUp ?? rec.criticalReason,
  value: (rec) => amountOf(rec.value ?? rec.valueFormatted)
};
const recordText = (rec) =>
  [rec.client, rec.name, rec.id, rec.designer, rec.owner, rec.psm, rec.stage, rec.city, rec.product, rec.status, rec.followUp]
    .filter(Boolean)
    .join(' ');

// The records behind the card that was clicked. Searchable, and every column sorts.
function RecordsTable({ records, recordType, isLeadRecord, onSelect }) {
  const tools = useTableTools(records, { fields: RECORD_FIELDS, search: recordText });
  return (
    <div className="modal-records-section">
      <div className="section-title-row">
        <h3>Matching Live Records ({tools.shown === tools.total ? tools.total : `${tools.shown} of ${tools.total}`})</h3>
        <div className="tt-bar">
          <TableSearch tools={tools} label="Search these records" placeholder="Search name, owner, stage…" />
          <span className="records-note">Click any record row to inspect full details</span>
        </div>
      </div>

      <div className="table-scroll modal-table-scroll">
        <table>
          <thead>
            <tr>
              <SortTh tools={tools} field="name">{recordType === 'pdi' ? 'Site / Client' : recordType === 'design' ? 'Project / Client' : recordType === 'deal' ? 'Deal / Project' : 'Lead / Customer'}</SortTh>
              <SortTh tools={tools} field="owner">{recordType === 'pdi' ? 'Measurement' : recordType === 'design' ? 'Designer' : 'Owner'}</SortTh>
              {isLeadRecord && <SortTh tools={tools} field="created">Came on</SortTh>}
              {isLeadRecord && <SortTh tools={tools} field="created">Time</SortTh>}
              <SortTh tools={tools} field="detail">{recordType === 'pdi' ? 'Appliance Specs' : recordType === 'design' ? 'Space / Area' : 'Product'}</SortTh>
              <SortTh tools={tools} field="stage">{recordType === 'pdi' ? 'Target Completion' : recordType === 'design' ? 'Stage / Revision' : recordType === 'deal' ? 'Stage' : 'City / Source'}</SortTh>
              <SortTh tools={tools} field="followUp">{recordType === 'pdi' ? 'Critical Reason' : recordType === 'design' ? 'Payment Status' : 'Follow-up'}</SortTh>
              <SortTh tools={tools} field="value">Value</SortTh>
            </tr>
          </thead>
          <tbody>
            {tools.rows.length ? (
              tools.rows.map((rec) => (
                <tr
                  key={rec.id}
                  onClick={() => onSelect(rec)}
                  title="Click to view detailed record breakdown"
                >
                  <th scope="row">
                    <strong style={{ color: '#1260e9', cursor: 'pointer' }}>{rec.client || rec.name}</strong>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#667085' }}>{rec.id}</span>
                  </th>
                  <td>
                    {recordType === 'pdi'
                      ? <span className={`status ${rec.isMeasurementDone ? 'success' : 'danger'}`}><i />{rec.isMeasurementDone ? 'Done' : 'Pending'}</span>
                      : rec.designer || rec.owner || rec.psm || 'Unassigned'}
                  </td>
                  {isLeadRecord && <td>{arrivalDate(rec.created)}</td>}
                  {isLeadRecord && <td><ArrivalTime lead={rec} /></td>}
                  <td>
                    {recordType === 'pdi'
                      ? <span className={`priority ${rec.applianceStatus === 'Specs Missing' ? 'high' : 'normal'}`}>{rec.applianceStatus}</span>
                      : rec.sqFt ? `${rec.space} (${rec.sqFt})` : rec.product ?? 'Interior'}
                  </td>
                  <td>
                    {recordType === 'pdi'
                      ? <span>{rec.siteCompletionDate}</span>
                      : rec.revisions ? `${rec.stage} · ${rec.revisions}` : rec.stage ?? `${rec.city} · ${rec.architect ?? rec.source}`}
                  </td>
                  <td>
                    {recordType === 'pdi'
                      ? <span style={{ color: rec.criticality === 'Critical' ? '#d93025' : '#475467', fontWeight: rec.criticality === 'Critical' ? 600 : 400 }}>{rec.criticalReason || 'On Track'}</span>
                      : rec.paymentStatus || rec.followUp || '—'}
                  </td>
                  <td><strong>{typeof rec.value === 'number' ? formatMoney(rec.value) : rec.value || rec.valueFormatted || '—'}</strong></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isLeadRecord ? 8 : 6} className="empty-leads">
                  {tools.total
                    ? `No records match “${tools.query.trim()}”.`
                    : 'No matching records currently in risk queue for this metric.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MetricDetailModal({ item, onClose, leads = [], deals = [], projects = [], mode = 'pre-sales' }) {
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedRecord) {
          setSelectedRecord(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedRecord]);

  if (!item) return null;

  const title = typeof item === 'string' ? item : item.label;
  const value = item.value ?? '—';
  const subtext = item.subtext ?? '';
  const trend = item.trend ?? '';
  const tone = item.tone ?? 'blue';
  const icon = item.icon ?? 'drawing';

  // Compute matching records based on card title and active mode
  const titleLower = title.toLowerCase();
  
  let records = [];
  let recordType = mode === 'pdi' ? 'pdi' : mode === 'design' ? 'design' : mode === 'sales' ? 'deal' : 'lead';
  let guidance = '';
  let slaRule = '';

  if (mode === 'pdi' || (projects.length > 0 && projects[0]?.measurementStatus)) {
    recordType = 'pdi';
    const pool = projects.length ? projects : deals;

    if (titleLower.includes('critical') || titleLower.includes('red flag')) {
      records = pool.filter(p => p.criticality === 'Critical' || p.criticality === 'High').slice(0, 15);
      guidance = 'Immediate senior management intervention required — delayed measurements, missing appliance specs, or overdue site completion.';
      slaRule = 'SLA: Daily senior site clearance review at 09:00 AM IST.';
    } else if (titleLower.includes('measurement') && titleLower.includes('pending')) {
      records = pool.filter(p => !p.isMeasurementDone).slice(0, 15);
      guidance = 'Sites awaiting physical laser survey & ceiling height confirmation before production drawing sign-off.';
      slaRule = 'SLA: Laser measurement survey completed within 48 hours of site allocation.';
    } else if (titleLower.includes('measurement') && (titleLower.includes('done') || titleLower.includes('clearance'))) {
      records = pool.filter(p => p.isMeasurementDone).slice(0, 15);
      guidance = 'Laser measurements, ceiling height, and room dimensions verified and logged into CRM.';
      slaRule = 'Standard: Certified laser measurement accuracy required.';
    } else if (titleLower.includes('appliance')) {
      records = pool.filter(p => p.applianceStatus === 'Specs Missing' || (titleLower.includes('pending') && !p.hasSignedAppliances)).slice(0, 15);
      if (!records.length) records = pool.slice(0, 15);
      guidance = 'Brand specifications, cutouts & utility points (Hob, Chimney, Built-in Oven, Microwave, Fridge, Dishwasher).';
      slaRule = 'Benchmark Gate: 100% appliance cutout specs confirmed prior to factory indent.';
    } else if (titleLower.includes('overdue') || titleLower.includes('completion') || titleLower.includes('handover')) {
      records = pool.filter(p => p.completionTone === 'danger' || p.completionTone === 'warning').slice(0, 15);
      guidance = 'Target site handover and house warming schedule tracking.';
      slaRule = 'SLA: Readiness milestone confirmed 14 days prior to target handover date.';
    } else {
      records = pool.slice(0, 15);
      guidance = 'Operational site PDI metric tracked in daily morning review.';
      slaRule = 'Reviewed daily at 09:00 AM IST.';
    }
  } else if (mode === 'design' || (projects.length > 0 && projects[0]?.space)) {
    recordType = 'design';
    const pool = projects.length ? projects : deals;
    
    if (titleLower.includes('revision')) {
      records = pool.filter(p => p.isRevision || /revision|query/i.test(p.stage ?? '') || (p.revisions && !p.revisions.includes('R0'))).slice(0, 15);
      guidance = 'Design iterations requiring architect/client confirmation or technical adjustments.';
      slaRule = 'SLA: Complete revision cycle and release updated drawings within 3 days.';
    } else if (titleLower.includes('approval') || titleLower.includes('sm approval')) {
      records = pool.filter(p => /approval|query/i.test(p.stage ?? '') || p.ageing >= 3).slice(0, 15);
      guidance = 'Drawings awaiting Sales Manager / Technical Head sign-off before manufacturing handover.';
      slaRule = 'SLA: SM / Technical sign-off required within 24 hours of release.';
    } else if (titleLower.includes('completed') || titleLower.includes('dispatched') || titleLower.includes('closed')) {
      records = pool.filter(p => p.isCompleted || p.isClosed || /closed|paid|complete/i.test(p.stage ?? '')).slice(0, 15);
      guidance = 'Approved designs ready for factory production, material indenting, and dispatch.';
      slaRule = 'Benchmark Target: 100% drawing sign-off accuracy before CNC release.';
    } else if (titleLower.includes('sq ft') || titleLower.includes('started') || titleLower.includes('transferred') || titleLower.includes('executed')) {
      records = pool.slice(0, 15);
      guidance = 'Active drawing projects currently under space planning, 2D drafting, or 3D visualization.';
      slaRule = 'Milestone Target: Concept 3D preview within 5 business days of site measurement.';
    } else if (titleLower.includes('payment') || titleLower.includes('invoice')) {
      records = pool.filter(p => p.paymentStatus && !p.paymentStatus.includes('Fully Paid')).slice(0, 15);
      guidance = 'Factory advance / stage payment milestone follow-up required before dispatch.';
      slaRule = 'SLA: Minimum 50% milestone collection prior to factory release.';
    } else {
      records = pool.slice(0, 15);
      guidance = 'Design and technical production metric tracked in daily morning review.';
      slaRule = 'Reviewed daily at 09:00 AM IST.';
    }
  } else if (Array.isArray(item.recordIds)) {
    // The API sent the exact leads behind this count; show those and nothing else.
    const ids = new Set(item.recordIds);
    records = leads.filter(l => ids.has(String(l.id)));
    if (titleLower.startsWith('raw leads')) {
      guidance = 'Every Magppie lead created in this period, including junk and not-interested ones.';
      slaRule = 'Each lead needs a first contact within 2 hours of assignment.';
    } else if (titleLower === 'not contacted') {
      guidance = 'No first contact recorded yet. Assign and call these leads today.';
      slaRule = 'SLA: First call logged within 2 hours of assignment.';
    } else if (titleLower === 'psm qualified') {
      guidance = 'Every lead the PSM has qualified: drawings awaited, plus those already past it (drawing received or converted).';
      slaRule = 'Qualification Gate: Criteria confirmed and logged in Zoho CRM.';
    } else if (titleLower === 'qualified drawing awaited') {
      guidance = 'Status "Qualified / Drawings Awaited": qualified, waiting for the client or architect to share drawings.';
      slaRule = 'Chase drawings within 7 days of qualification; older ones show under Drawings delayed.';
    } else if (titleLower === 'qualified leads') {
      guidance = 'Every qualified lead in the period: PSM qualified plus qualified drawing awaited.';
      slaRule = 'Pre-Sales mandate: 25 qualified leads per PSM a month.';
    } else if (titleLower === 'closed') {
      guidance = 'Sales-qualified leads whose converted Zoho deal is booked or won.';
      slaRule = 'Confirm the booking is recorded on the deal.';
    } else if (titleLower === 'sales qualified' || titleLower === 'went to sm') {
      guidance = 'Qualified leads handed to sales: converted to a deal, or now owned by a sales manager in Zoho.';
      slaRule = 'Follow each hand-over through to the first SM meeting.';
    } else if (titleLower === 'under follow-up') {
      guidance = 'Contacted and still in conversation: follow-up, future purchase or AI call hand-offs.';
      slaRule = 'SLA: Next follow-up date recorded in Zoho for every lead.';
    } else if (titleLower === 'not responding') {
      guidance = 'Contacted at least once but not answering: no response, call back later or cold.';
      slaRule = 'Try a different time or channel; mark dead after the agreed number of attempts.';
    } else if (titleLower === 'dropped / dead') {
      guidance = 'Junk, not interested, lost or not qualified. Review reasons for patterns.';
      slaRule = 'Reviewed weekly for lead-source quality.';
    } else if (titleLower.includes('architect')) {
      guidance = 'High-value partner channel. Prioritize relationship management and architect coordination.';
      slaRule = 'SLA: First contact with architect within 4 hours of receipt.';
    } else if (titleLower === 'contacted') {
      guidance = 'First touchpoint completed. Advance client toward requirement brief and qualification.';
      slaRule = 'Benchmark Target: ≥ 85% first-contact rate on daily assigned cohort.';
    } else if (titleLower === 'qualified') {
      guidance = 'Status "Qualified / Drawings Awaited" or "Drawing Received" in Zoho. Ready for drawings and site measurement.';
      slaRule = 'Qualification Gate: Criteria confirmed and logged in Zoho CRM.';
    } else if (titleLower === 'enabled' || titleLower === 'bookings') {
      guidance = titleLower === 'enabled' ? 'Leads converted into a Zoho deal.' : 'Converted leads whose deal is Order Booked or Closed Won.';
      slaRule = 'Reviewed daily at 09:00 AM IST.';
    } else if (titleLower.includes('drawing')) {
      guidance = 'Status still "Qualified / Drawings Awaited" 7+ days after the lead came in. Review drawing status with the assigned PSM.';
      slaRule = 'SLA: Drawing work starts within 7 days of qualification.';
    } else if (titleLower.includes('qualified')) {
      guidance = 'Qualified 7+ days ago and not yet moved forward. Confirm the next step with the assigned PSM.';
      slaRule = 'SLA: Qualified leads progress to drawing within 7 days.';
    } else if (titleLower.includes('hot')) {
      guidance = 'Clients marked Hot in Zoho (Client Status) who are not yet qualified. Call them today.';
      slaRule = 'SLA: Hot leads contacted the same day.';
    } else if (titleLower.includes('missed')) {
      guidance = 'Leads assigned with zero recorded contact. Mandate immediate calling by assigned PSM.';
      slaRule = 'SLA Breached: First call must be logged within 2 hours of assignment.';
    } else if (titleLower.includes('overdue')) {
      guidance = 'Scheduled follow-up date has elapsed. Contact client to confirm next milestone or reschedule.';
      slaRule = 'SLA: Follow-up must occur on or before the committed date.';
    } else {
      guidance = 'Operational metric tracked for daily morning review and senior management intervention.';
      slaRule = 'Reviewed daily at 09:00 AM IST.';
    }
  } else if (titleLower.includes('architect')) {
    records = leads.filter(l => l.architect && l.architect !== '—').slice(0, 15);
    if (!records.length && deals.length) {
      records = deals.filter(d => d.architect && d.architect !== '—').slice(0, 15);
      recordType = 'deal';
    }
    guidance = 'High-value partner channel. Prioritize relationship management and architect coordination.';
    slaRule = 'SLA: First contact with architect within 4 hours of receipt.';
  } else if (titleLower.includes('missed')) {
    records = leads.filter(l => l.status?.toLowerCase().includes('not contacted')).slice(0, 15);
    guidance = 'Leads assigned yesterday with zero recorded contact. Mandate immediate calling by assigned PSM.';
    slaRule = 'SLA Breached: First call must be logged within 2 hours of assignment.';
  } else if (titleLower.includes('overdue')) {
    records = leads.filter(l => l.followUp && l.followUp !== 'Not scheduled').slice(0, 15);
    if (!records.length && deals.length) {
      records = deals.filter(d => d.followUp && d.followUp !== 'Not scheduled').slice(0, 15);
      recordType = 'deal';
    }
    guidance = 'Scheduled follow-up date has elapsed. Contact client to confirm next milestone or reschedule.';
    slaRule = 'SLA: Follow-up must occur on or before the committed date.';
  } else if (titleLower.includes('qualified')) {
    records = leads.filter(l => l.status?.toLowerCase().includes('qualified')).slice(0, 15);
    guidance = 'Meets core qualification criteria (Kitchen in 3 months, Budget ≥ ₹4L). Ready for site measurement.';
    slaRule = 'Qualification Gate: Criteria confirmed and logged in Zoho CRM.';
  } else if (titleLower.includes('contacted')) {
    records = leads.filter(l => !l.status?.toLowerCase().includes('not contacted')).slice(0, 15);
    guidance = 'First touchpoint completed. Advance client toward requirement brief and qualification.';
    slaRule = 'Benchmark Target: ≥ 85% first-contact rate on daily assigned cohort.';
  } else if (titleLower.includes('approval')) {
    records = deals.filter(d => d.stage?.toLowerCase().includes('approval') || d.stage?.toLowerCase().includes('query')).slice(0, 15);
    recordType = 'deal';
    guidance = 'Quotations or design revisions pending SM / management sign-off.';
    slaRule = 'SLA: Management approval review within 24 hours of submission.';
  } else if (titleLower.includes('revision')) {
    records = deals.filter(d => d.stage?.toLowerCase().includes('query') || d.stage?.toLowerCase().includes('revision')).slice(0, 15);
    recordType = 'deal';
    guidance = 'Drawings under active modification cycles (R1/R2) based on client or site feedback.';
    slaRule = 'SLA: Revision drawings released within 3 business days.';
  } else if (titleLower.includes('started') || titleLower.includes('executed') || titleLower.includes('opportunity') || titleLower.includes('transferred')) {
    records = (deals.length ? deals : leads).slice(0, 15);
    recordType = deals.length ? 'deal' : 'lead';
    guidance = 'Active projects moving through design planning, technical drawing, and commercial stages.';
    slaRule = 'Pipeline velocity target: Progression to next stage within 7 days.';
  } else {
    records = (deals.length ? deals : leads).slice(0, 15);
    recordType = deals.length ? 'deal' : 'lead';
    guidance = 'Operational metric tracked for daily morning review and senior management intervention.';
    slaRule = 'Reviewed daily at 09:00 AM IST.';
  }

  // Lead records get two extra columns: the date and the time the lead came in.
  const isLeadRecord = recordType === 'lead';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <header className="modal-header">
          <div className="modal-header-info">
            {selectedRecord ? (
              <button
                type="button"
                className="psm-link"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#1260e9', padding: '4px 8px', borderRadius: '6px', background: '#edf4fe' }}
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft size={16} />
                <span>Back to matching records</span>
              </button>
            ) : (
              <div className={`modal-icon-badge ${tone}`}>
                <Icon name={icon} size={22} />
              </div>
            )}
            <div>
              <div className="modal-title-row">
                <h2>{selectedRecord ? (selectedRecord.client || selectedRecord.name) : title}</h2>
                <span className={`modal-badge ${selectedRecord ? (selectedRecord.criticalTone || 'blue') : tone}`}>
                  {selectedRecord ? (selectedRecord.criticality || selectedRecord.stage || 'Live Record') : (tone === 'danger' ? 'Action Required' : tone === 'warning' ? 'Needs Attention' : 'Active Metric')}
                </span>
              </div>
              <p className="modal-subtitle">
                {selectedRecord
                  ? `Detailed record breakdown for ID: ${selectedRecord.id}`
                  : 'Operational Deep Dive & Live Underlying CRM Records — Click any record below for full details'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </header>

        {/* Big Metric Banner or Selected Record Spotlight */}
        {!selectedRecord ? (
          <div className="modal-metric-banner">
            <div className="metric-figure">
              <span className="figure-label">Current Value</span>
              <strong className="figure-val">{value}</strong>
              {subtext && <span className="figure-sub">{subtext}</span>}
            </div>
            {trend && (
              <div className="metric-trend-box">
                <span className="trend-label">Trend vs Previous</span>
                <strong className="trend-val">↑ {trend}</strong>
                {item.comparison && <span className="trend-comp">{item.comparison}</span>}
              </div>
            )}
          </div>
        ) : null}

        {/* Guidance & SLA Box (when in list view) */}
        {!selectedRecord && (
          <div className="modal-guidance-box">
            <div className="guidance-item">
              <strong>Management Focus: </strong>
              <span>{guidance}</span>
            </div>
            {slaRule && (
              <div className="guidance-item sla">
                <ShieldCheck size={16} />
                <span><strong>Operational Rule: </strong>{slaRule}</span>
              </div>
            )}
          </div>
        )}

        {/* Single Record Deep-Dive Detail View */}
        {selectedRecord ? (
          <div className="modal-records-section" style={{ padding: '20px 24px', overflowY: 'auto' }}>
            {/* Top KPI Grid for Selected Record */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fbff', border: '1px solid #dce8fa', borderRadius: '8px', padding: '12px 14px' }}>
                <span style={{ fontSize: '0.7rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Financial Value</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10224c', marginTop: '2px' }}>
                  {typeof selectedRecord.value === 'number' ? formatMoney(selectedRecord.value) : selectedRecord.value || selectedRecord.valueFormatted || '—'}
                </div>
              </div>

              <div style={{ background: '#f8fbff', border: '1px solid #dce8fa', borderRadius: '8px', padding: '12px 14px' }}>
                <span style={{ fontSize: '0.7rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>
                  {recordType === 'pdi' ? 'Site Measurement' : recordType === 'design' ? 'Design Stage' : 'Owner / Rep'}
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 750, color: '#10224c', marginTop: '2px' }}>
                  {recordType === 'pdi' ? (selectedRecord.isMeasurementDone ? 'Done (Laser Surveyed)' : `Pending (${selectedRecord.ageing}d)`) : selectedRecord.designer || selectedRecord.owner || selectedRecord.psm || '—'}
                </div>
              </div>

              <div style={{ background: '#f8fbff', border: '1px solid #dce8fa', borderRadius: '8px', padding: '12px 14px' }}>
                <span style={{ fontSize: '0.7rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Target Completion / Follow-Up</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 750, color: '#10224c', marginTop: '2px' }}>
                  {selectedRecord.siteCompletionDate || selectedRecord.targetDispatch || selectedRecord.followUp || 'Not scheduled'}
                </div>
              </div>

              <div style={{ background: '#f8fbff', border: '1px solid #dce8fa', borderRadius: '8px', padding: '12px 14px' }}>
                <span style={{ fontSize: '0.7rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Criticality / SLA</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 750, color: selectedRecord.criticality === 'Critical' ? '#d93025' : '#0d7042', marginTop: '2px' }}>
                  {selectedRecord.criticality || selectedRecord.status || 'Active'}
                </div>
              </div>
            </div>

            {/* Critical Reason Banner */}
            {selectedRecord.criticalReason && (
              <div style={{ background: '#fef3f2', border: '1px solid #fecdca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={18} style={{ color: '#d93025', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#b42318', fontSize: '0.85rem' }}>Management Critical Flag:</strong>
                  <div style={{ color: '#475467', fontSize: '0.8rem', marginTop: '3px' }}>{selectedRecord.criticalReason}</div>
                  {selectedRecord.actionRequired && (
                    <div style={{ color: '#10224c', fontSize: '0.8rem', fontWeight: 700, marginTop: '6px' }}>
                      Recommended Action: {selectedRecord.actionRequired}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Properties Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Box 1: Space & Measurement Specs */}
              <div style={{ background: '#ffffff', border: '1px solid #e4eaf2', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', color: '#10224c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ruler size={16} color="#1260e9" />
                  Space & Measurement Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                    <span style={{ color: '#667085' }}>Space Type:</span>
                    <strong>{selectedRecord.productType || selectedRecord.space || selectedRecord.product || 'Modular Kitchen'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                    <span style={{ color: '#667085' }}>Layout / Floor:</span>
                    <strong>{selectedRecord.kitchenType ? `${selectedRecord.kitchenType} · ${selectedRecord.floor || 'Floor 1'}` : selectedRecord.floor || 'Standard Layout'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                    <span style={{ color: '#667085' }}>Total Area:</span>
                    <strong>{selectedRecord.totalSqft || selectedRecord.sqFt || '1,450 sq ft'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                    <span style={{ color: '#667085' }}>Finished Ceiling Height:</span>
                    <strong>{selectedRecord.ceilingHeight || '2,850 mm (Standard)'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#667085' }}>Assigned Site Incharge:</span>
                    <strong>{selectedRecord.siteSurveyor || selectedRecord.siteIncharge || selectedRecord.owner || 'Operations Lead'}</strong>
                  </div>
                </div>
              </div>

              {/* Box 2: Appliances Breakdown */}
              <div style={{ background: '#ffffff', border: '1px solid #e4eaf2', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', color: '#10224c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={16} color="#1260e9" />
                  Appliance Cutouts & Utilities
                </h4>
                {selectedRecord.appliancesList?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    {selectedRecord.appliancesList.map((app) => (
                      <div key={app.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: app.measured ? '#f6fdf9' : '#fffbfa', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${app.measured ? '#d1fadf' : '#fee4e2'}` }}>
                        <span style={{ fontWeight: 600, color: '#10224c' }}>{app.name}</span>
                        <span style={{ fontSize: '0.72rem', color: app.measured ? '#027a48' : '#b42318', fontWeight: 600 }}>
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                      <span style={{ color: '#667085' }}>Appliance Status:</span>
                      <strong>{selectedRecord.applianceStatus || 'Standard Appliances Included'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                      <span style={{ color: '#667085' }}>Gas Supply:</span>
                      <strong>{selectedRecord.gasArrangement || 'Piped Gas (PNG)'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f7', paddingBottom: '6px' }}>
                      <span style={{ color: '#667085' }}>Architect Partner:</span>
                      <strong>{selectedRecord.architect || 'Direct Customer'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#667085' }}>Payment / Stage:</span>
                      <strong>{selectedRecord.paymentStatus || selectedRecord.stage || 'In Progress'}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <RecordsTable records={records} recordType={recordType} isLeadRecord={isLeadRecord} onSelect={setSelectedRecord} />
        )}

        {/* Footer */}
        <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {selectedRecord ? (
            <button
              type="button"
              className="psm-link"
              style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4a5e80' }}
              onClick={() => setSelectedRecord(null)}
            >
              ← Back to list
            </button>
          ) : (
            <span style={{ fontSize: '0.74rem', color: '#667085' }}>Click any record for deep-dive inspection</span>
          )}
          <button type="button" className="modal-action-btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
