const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const dayKey = (date) => String(date ?? '').slice(0, 10);
const daysSince = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
const money = (value) => value ? `₹${inr.format(value / 100_000)}L` : '—';

function getLast7DaysLabel() {
  const now = new Date();
  const past = new Date();
  past.setDate(past.getDate() - 7);
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `Last 7 Days · ${fmt(past)} – ${fmt(now)}`;
}

function isMagppieDeal(deal) {
  const str = (deal.Deal_Name || '') + ' ' + (deal.Product_Type || '') + ' ' + (deal.Lead_Source || '') + ' ' + (deal.Company || '') + ' ' + (deal.Vertical || '');
  return !/sunroof|sunrooof/i.test(str);
}

export const MAGPPIE_DESIGNERS = [
  'Jyoti',
  'Rishabh Butar',
  'Rupa',
  'Mehul',
  'Vishal Dubey',
  'Atif Hussain',
  'Gunjan',
  'Sudha',
  'Mansi',
  'Nidhi',
  'Ankita',
  'Shruti',
  'Pravallika',
  'Rashi',
  'Deepanksha',
  'Soma',
  'Shaily'
];

function normalizeDesigner(name) {
  if (!name || name === '-None-') return null;
  const match = MAGPPIE_DESIGNERS.find(d => d.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(d.toLowerCase()));
  return match ?? null;
}

function estimateSqFt(deal) {
  const val = Number(deal.Total_Amount ?? deal.Amount ?? 0);
  if (val > 30) return Math.round(val * 80);
  if (val > 15) return Math.round(val * 90);
  if (val > 0) return Math.round(val * 100);
  return 1200;
}

import { getTimeframeFilter } from './timeUtils.js';

export function buildDesignDashboardFromDeals(deals, selectedDesigner = 'All Designers', timeframe = 'daily') {
  const tf = getTimeframeFilter(timeframe);
  const reportLabel = tf.reportLabel;

  // Filter exclusively to Magppie deals created in selected timeframe and assigned to whitelisted designers (exclude Sunroof)
  const validDeals = deals
    .filter(isMagppieDeal)
    .filter(deal => tf.matches(deal.Created_Time))
    .map(deal => {
      const designer = normalizeDesigner(deal.Designer_Name);
      if (!designer) return null;
      
      const stage = String(deal.Stage ?? 'Designer Assigned');
      const stageLower = stage.toLowerCase();
      const value = Number(deal.Total_Amount ?? deal.Amount ?? 0) * 100_000;
      const sqFtNum = estimateSqFt(deal);
      const ageing = daysSince(deal.Created_Time);
      const revisionsCount = Number(deal.Number_of_Design_Revisions ?? 0);
      const isRevision = revisionsCount > 0 || /query|revision/i.test(stageLower);
      const isClosed = /won|closed|factory/i.test(stageLower);
      const isApproved = /approved|price|won/i.test(stageLower) || Boolean(deal.Design_Approved_Date);
      const isStarted = true;
      const isCompleted = isApproved || isClosed;
      
      // Pre-Design vs Post-Design classification
      const isPreDesign = /assigned|none|brief|measurement|layout|presentation/i.test(stageLower) && !isApproved && !isClosed;
      const isExecuted = isPreDesign && !/none/i.test(stageLower);
      
      return {
        id: deal.id,
        client: deal.Deal_Name || 'Unnamed Project',
        space: deal.Product_Type ? `${deal.Product_Type} Space` : 'Modular Kitchen & Interior',
        designer,
        architect: deal.Architect_Name || deal.Architect_Firm || '—',
        approver: deal.Owner?.name ?? 'Sales Head',
        stage,
        isPreDesign,
        isExecuted,
        isStarted,
        isCompleted,
        isRevision,
        isClosed,
        revisions: isRevision ? `R${revisionsCount || 1} (Under Revision)` : 'R0 (Completed)',
        paymentStatus: isClosed ? 'Fully Paid' : isApproved ? '50% Received' : 'Invoice Done',
        sqFtNum,
        sqFt: `${sqFtNum.toLocaleString('en-IN')} sq ft`,
        value,
        ageing,
        targetDispatch: deal.Expected_Design_Date || '2026-10-15',
        priority: value >= 2_500_000 ? 'High' : value >= 1_500_000 ? 'Medium' : 'Normal',
        status: ageing >= 7 || isRevision ? 'Watch' : 'On track',
        tone: ageing >= 7 ? 'warning' : 'success'
      };
    })
    .filter(Boolean);

  // Filter by selected designer if specified
  const filteredDeals = selectedDesigner && selectedDesigner !== 'All Designers'
    ? validDeals.filter(d => d.designer === selectedDesigner)
    : validDeals;

  const preProjects = filteredDeals.filter(d => d.isPreDesign || !d.isCompleted);
  const postProjects = filteredDeals;

  // Pre-Design Calculations
  const preTransferred = preProjects.length;
  const preExecuted = preProjects.filter(p => p.isExecuted).length;
  const preClosed = preProjects.filter(p => p.isCompleted || p.isClosed).length;
  const preMeasurementsPending = preProjects.filter(p => p.ageing <= 2).length;
  const preArchitectCollab = preProjects.filter(p => p.architect && p.architect !== '—').length;
  const preTotalValue = preProjects.reduce((sum, p) => sum + p.value, 0);

  // Post-Design Calculations (Designs Started, Sq Ft, Completed, Under Revision, Orders Closed, Total Value)
  const postStarted = postProjects.length;
  const postTotalSqFt = postProjects.reduce((sum, p) => sum + p.sqFtNum, 0);
  const postCompleted = postProjects.filter(p => p.isCompleted).length;
  const postRevision = postProjects.filter(p => p.isRevision).length;
  const postClosed = postProjects.filter(p => p.isClosed).length;
  const postTotalValue = postProjects.reduce((sum, p) => sum + p.value, 0);

  const postPaymentsInvoiced = postProjects.filter(p => p.paymentStatus.includes('Invoice') || p.paymentStatus.includes('Paid') || p.paymentStatus.includes('50%')).length;
  const postPaymentsReceived = postProjects.filter(p => p.paymentStatus.includes('Paid') || p.paymentStatus.includes('50%')).length;

  const tfSuffix = `(${tf.shortLabel})`;

  return {
    meta: {
      isDemo: false,
      reportLabel: reportLabel,
      timeframe: tf.timeframe,
      mappingNotice: `Magppie ${reportLabel} (Excluding Sunroof)`,
      designers: ['All Designers', ...MAGPPIE_DESIGNERS]
    },
    preDesign: {
      kpis: [
        { label: `Designs Transferred ${tfSuffix}`, value: String(preTransferred), tone: 'blue', icon: 'drawing' },
        { label: 'Designs Executed', value: String(preExecuted), subtext: preTransferred ? `${((preExecuted / preTransferred) * 100).toFixed(1)}% of transferred` : '0%', tone: 'blue', icon: 'layers' },
        { label: 'Designs Closed', value: String(preClosed), subtext: preExecuted ? `${((preClosed / preExecuted) * 100).toFixed(1)}% of executed` : '0%', tone: 'blue', icon: 'target' },
        { label: 'Site Measurements Pending', value: String(preMeasurementsPending), subtext: 'Awaiting site visit', tone: 'blue', icon: 'compass' },
        { label: 'Architect Collab Projects', value: String(preArchitectCollab), subtext: preTransferred ? `${((preArchitectCollab / preTransferred) * 100).toFixed(1)}% with external Ar.` : '0%', tone: 'blue', icon: 'ruler' },
        { label: 'Pre-Design Pipeline Value', value: money(preTotalValue), tone: 'blue', icon: 'rupee' }
      ],
      risks: [
        { label: 'Brief Incomplete > 3 Days', value: String(preProjects.filter(p => p.ageing >= 3).length), tone: 'danger', icon: 'alert' },
        { label: 'Measurement Delayed', value: String(preProjects.filter(p => p.ageing >= 5).length), tone: 'warning', icon: 'clock' },
        { label: 'Layout Ageing > 5 Days', value: String(preProjects.filter(p => p.ageing >= 7).length), tone: 'warning', icon: 'file' },
        { label: 'Concept Pending Client Sign-off', value: String(preProjects.filter(p => p.ageing >= 4).length), tone: 'warning', icon: 'clock' }
      ],
      projects: preProjects.slice(0, 25),
      funnel: [
        { label: `Designs Transferred ${tfSuffix}`, value: preTransferred, conversion: '100%', icon: 'drawing' },
        { label: 'Designs Executed', value: preExecuted, conversion: preTransferred ? `${((preExecuted / preTransferred) * 100).toFixed(1)}%` : '0%', icon: 'layers' },
        { label: 'Designs Closed', value: preClosed, conversion: preExecuted ? `${((preClosed / preExecuted) * 100).toFixed(1)}%` : '0%', icon: 'target' }
      ]
    },
    postDesign: {
      kpis: [
        { label: `Designs Started ${tfSuffix}`, value: String(postStarted), subtext: 'In production drawing phase', tone: 'blue', icon: 'drawing' },
        { label: 'Sq Ft Area', value: postTotalSqFt ? postTotalSqFt.toLocaleString('en-IN') : '0', subtext: postStarted ? `Avg ${(postTotalSqFt / postStarted).toFixed(0)} sq ft / project` : '0 sq ft', tone: 'blue', icon: 'ruler' },
        { label: 'Designs Completed', value: String(postCompleted), subtext: postStarted ? `${((postCompleted / postStarted) * 100).toFixed(1)}% of started` : '0%', tone: 'blue', icon: 'check' },
        { label: 'Under Revision', value: String(postRevision), subtext: 'R1/R2 revision cycles', tone: 'blue', icon: 'layers' },
        { label: 'Orders Closed', value: String(postClosed), subtext: 'Factory released & booked', tone: 'blue', icon: 'calendar' },
        { label: 'Total Production Value', value: money(postTotalValue), subtext: 'Active manufacturing pipeline', tone: 'blue', icon: 'rupee' }
      ],
      risks: [
        { label: 'SM Approval Stuck > 4 Days', value: String(postProjects.filter(p => p.stage.includes('Approval') && p.ageing >= 4).length), tone: 'danger', icon: 'alert' },
        { label: 'Revision Loop Cycles', value: String(postRevision), tone: 'warning', icon: 'layers' },
        { label: 'Factory Release Delayed', value: String(postProjects.filter(p => p.status === 'Watch').length), tone: 'danger', icon: 'clock' },
        { label: 'Payment Follow-up Pending', value: String(postProjects.filter(p => p.paymentStatus.includes('Invoice')).length), tone: 'warning', icon: 'rupee' }
      ],
      projects: postProjects.slice(0, 25),
      funnel: [
        { label: `Designs Dispatched ${tfSuffix}`, value: postStarted, conversion: '100%', icon: 'drawing' },
        { label: 'Payments Done', value: postPaymentsInvoiced, conversion: postStarted ? `${((postPaymentsInvoiced / postStarted) * 100).toFixed(1)}%` : '0%', icon: 'file' },
        { label: 'Payments Received', value: postPaymentsReceived, conversion: postPaymentsInvoiced ? `${((postPaymentsReceived / postPaymentsInvoiced) * 100).toFixed(1)}%` : '0%', icon: 'rupee' },
        { label: 'Designs Closed', value: postClosed, conversion: postPaymentsReceived ? `${((postClosed / postPaymentsReceived) * 100).toFixed(1)}%` : '0%', icon: 'calendar' }
      ]
    }
  };
}
