const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const dayKey = (date) => String(date ?? '').slice(0, 10);
const daysSince = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
const dealName = (deal) => deal.Deal_Name || 'Unnamed Deal';
const dealValue = (deal) => {
  if (deal.Total_Amount !== null && deal.Total_Amount !== undefined && deal.Total_Amount !== '') {
    return Number(deal.Total_Amount) * 100_000;
  }
  if (deal.Amount !== null && deal.Amount !== undefined && deal.Amount !== '') {
    return Number(deal.Amount);
  }
  return 0;
};
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

function isArchitectDeal(deal) {
  return /architect|designer/i.test(deal.Lead_Source ?? '') ||
    Boolean(deal.Architect_Name && String(deal.Architect_Name).trim()) ||
    Boolean(deal.Architect_Firm && String(deal.Architect_Firm).trim());
}

function classifyDeal(deal) {
  const stage = String(deal.Stage ?? 'None');
  const stageLower = stage.toLowerCase();
  const isWon = /won|closed won|booked|order booked/i.test(stageLower);
  const isLost = /lost|closed lost|dropped/i.test(stageLower);
  const isDesign = /designer|design|layout|drawing/i.test(stageLower);
  const isApproval = /approval|query|sm|sent for/i.test(stageLower);
  const isPrice = /price|negotiation|commercial|discount/i.test(stageLower);
  const isArchitect = isArchitectDeal(deal);
  
  const value = dealValue(deal);
  const ageing = daysSince(deal.Created_Time);
  const overdue = Boolean(deal.Next_Follow_UP_Date && dayKey(deal.Next_Follow_UP_Date) < new Date().toISOString().slice(0, 10));
  const designRisk = isDesign && ageing >= 7;
  const approvalRisk = isApproval && ageing >= 5;
  const highValueRisk = value >= 2_000_000 && ageing >= 7;

  return {
    deal,
    stage,
    isWon,
    isLost,
    isDesign,
    isApproval,
    isPrice,
    isArchitect,
    value,
    ageing,
    overdue,
    designRisk,
    approvalRisk,
    highValueRisk
  };
}

function actionForDeal(item) {
  if (item.overdue) return 'Follow up with client immediately';
  if (item.approvalRisk) return 'Expedite SM / management approval';
  if (item.designRisk) return 'Review drawing progress with designer';
  if (item.isPrice) return 'Finalize commercial offer & close';
  if (item.highValueRisk) return 'Senior intervention on high-value opportunity';
  return 'Review deal momentum';
}

import { getTimeframeFilter } from './timeUtils.js';

export function buildSalesDashboardFromDeals(deals, selectedOwner = 'All Sales Reps', timeframe = 'daily') {
  const tf = getTimeframeFilter(timeframe);
  const reportLabel = tf.reportLabel;

  // Filter exclusively to Magppie deals created in selected timeframe (exclude Sunroof)
  const items = deals
    .filter(isMagppieDeal)
    .filter(deal => tf.matches(deal.Created_Time))
    .map(classifyDeal);
    
  const allActive = items.filter((item) => !item.isLost);

  // Group by owner for all Sales Reps / Closers / SMs
  const byOwner = new Map();
  allActive.forEach((item) => {
    const owner = item.deal.Owner?.name ?? 'Unassigned';
    const row = byOwner.get(owner) ?? {
      owner,
      deals: 0,
      architectDeals: 0,
      design: 0,
      approval: 0,
      price: 0,
      won: 0,
      value: 0,
      overdue: 0,
      risks: 0
    };
    row.deals += 1;
    row.architectDeals += Number(item.isArchitect);
    row.design += Number(item.isDesign);
    row.approval += Number(item.isApproval);
    row.price += Number(item.isPrice);
    row.won += Number(item.isWon);
    row.value += item.value;
    row.overdue += Number(item.overdue);
    row.risks += Number(item.overdue || item.designRisk || item.approvalRisk);
    byOwner.set(owner, row);
  });

  const allOwners = ['All Sales Reps', ...[...byOwner.keys()].sort()];

  // Filter cohort based on selected Sales Rep / Closer / SM
  const isSpecificOwner = selectedOwner && selectedOwner !== 'All Sales Reps';
  const active = isSpecificOwner 
    ? allActive.filter(item => (item.deal.Owner?.name ?? 'Unassigned') === selectedOwner)
    : allActive;

  const total = active.length;
  const architectCount = active.filter((item) => item.isArchitect).length;
  const designCount = active.filter((item) => item.isDesign).length;
  const approvalCount = active.filter((item) => item.isApproval).length;
  const priceCount = active.filter((item) => item.isPrice).length;
  const wonCount = active.filter((item) => item.isWon).length;
  
  const overdueItems = active.filter((item) => item.overdue);
  const designRiskItems = active.filter((item) => item.designRisk);
  const approvalRiskItems = active.filter((item) => item.approvalRisk);
  const highValueRiskItems = active.filter((item) => item.highValueRisk);
  
  const totalPipelineValue = active.reduce((sum, item) => sum + item.value, 0);

  const decisionItems = [...overdueItems, ...approvalRiskItems, ...designRiskItems, ...highValueRiskItems].slice(0, 20);

  const performanceRows = isSpecificOwner
    ? [...byOwner.values()].filter(row => row.owner === selectedOwner)
    : [...byOwner.values()];

  const tfSuffix = `(${tf.shortLabel})`;

  return {
    meta: {
      isDemo: false,
      reportLabel: reportLabel,
      timeframe: tf.timeframe,
      mappingNotice: isSpecificOwner ? `Showing Magppie (${reportLabel}) pipeline for: ${selectedOwner}` : `Magppie ${reportLabel} (Excluding Sunroof)`
    },
    filters: {
      timeframe: tf.timeframe,
      timeframeOptions: tf.options,
      owners: allOwners,
      stages: ['All Stages', 'Designer Assigned', 'Sent for Approval', 'Query to SM', 'Price Discussion', 'Closed Won'],
      products: ['All Product', 'Modular Kitchen', 'Wardrobe', 'Pantry', 'Complete Interior'],
      sources: ['All Lead source', 'Architect', 'Direct Client', 'Referral', 'Walk-in']
    },
    kpis: [
      { label: `Active Opportunities ${tfSuffix}`, value: String(total), tone: 'blue', icon: 'briefcase' },
      { label: 'Deals by Architect', value: String(architectCount), subtext: total ? `${((architectCount / total) * 100).toFixed(1)}% of pipeline` : '0%', tone: 'blue', icon: 'ruler' },
      { label: 'In Design / Layout', value: String(designCount), subtext: total ? `${((designCount / total) * 100).toFixed(1)}% of active` : '—', tone: 'blue', icon: 'drawing' },
      { label: 'Sent for Approval', value: String(approvalCount), subtext: 'Awaiting SM review', tone: 'blue', icon: 'file' },
      { label: 'Price Discussion', value: String(priceCount), subtext: 'Negotiation stage', tone: 'blue', icon: 'target' },
      { label: 'Active Pipeline Value', value: money(totalPipelineValue), tone: 'blue', icon: 'rupee' }
    ],
    risks: [
      { label: 'Overdue Follow-ups', value: String(overdueItems.length), tone: 'danger', icon: 'alert' },
      { label: 'Approval Stuck 5+ Days', value: String(approvalRiskItems.length), tone: 'danger', icon: 'clock' },
      { label: 'Design Delayed 7+ Days', value: String(designRiskItems.length), tone: 'warning', icon: 'file' },
      { label: 'High Value at Risk (₹20L+)', value: String(highValueRiskItems.length), tone: 'danger', icon: 'flame' },
      { label: 'Stale Deals (No Touch)', value: String(active.filter(i => i.ageing >= 10).length), tone: 'warning', icon: 'clock' }
    ],
    performance: performanceRows.map((row) => ({
      owner: row.owner,
      deals: row.deals,
      architectDeals: row.architectDeals,
      design: row.design,
      approval: row.approval,
      price: row.price,
      won: row.won,
      value: money(row.value),
      overdue: row.overdue,
      status: row.overdue > 1 ? 'At risk' : row.overdue > 0 || row.risks > 1 ? 'Watch' : 'On track',
      tone: row.overdue > 1 ? 'danger' : row.overdue > 0 || row.risks > 1 ? 'warning' : 'success'
    })),
    deals: active.map((item) => ({
      id: item.deal.id,
      name: dealName(item.deal),
      owner: item.deal.Owner?.name ?? 'Unassigned',
      stage: item.deal.Stage ?? 'None',
      product: item.deal.Product_Type ?? 'Interior',
      architect: item.deal.Architect_Name || item.deal.Architect_Firm || (item.isArchitect ? 'Architect / Designer' : '—'),
      created: dayKey(item.deal.Created_Time),
      followUp: item.deal.Next_Follow_UP_Date ?? 'Not scheduled',
      value: money(item.value)
    })),
    decisions: decisionItems.map((item) => ({
      lead: dealName(item.deal),
      id: `${item.deal.id} · ${item.deal.Product_Type ?? 'Product not specified'}`,
      psm: item.deal.Owner?.name ?? 'Unassigned',
      priority: item.highValueRisk ? 'High' : item.approvalRisk ? 'High' : 'Medium',
      ageing: `${item.ageing} days`,
      risk: item.overdue ? 'Follow-up date has passed' : item.approvalRisk ? 'Approval pending > 5 days' : item.designRisk ? 'Design / drawings pending > 7 days' : 'Stagnant deal value',
      action: actionForDeal(item)
    })),
    funnel: [
      { label: `Total Opportunities ${tfSuffix}`, value: total, conversion: '100%', icon: 'briefcase' },
      { label: 'Designer Assigned', value: designCount, conversion: total ? `${((designCount / total) * 100).toFixed(1)}%` : '—', icon: 'drawing' },
      { label: 'Sent for Approval', value: approvalCount, conversion: total ? `${((approvalCount / total) * 100).toFixed(1)}%` : '—', icon: 'file' },
      { label: 'Price Discussion', value: priceCount, conversion: total ? `${((priceCount / total) * 100).toFixed(1)}%` : '—', icon: 'target' },
      { label: 'Closed / Won', value: wonCount, conversion: total ? `${((wonCount / total) * 100).toFixed(1)}%` : '—', icon: 'calendar' }
    ]
  };
}
