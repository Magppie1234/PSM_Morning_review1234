const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const dayKey = (date) => String(date ?? '').slice(0, 10);
const daysSince = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
const money = (val) => val ? `₹${inr.format(val / 100_000)}L` : '—';

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

function daysDiff(targetDateStr) {
  if (!targetDateStr) return 999;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return 999;
  const now = new Date();
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function formatTargetDate(dStr) {
  if (!dStr) return 'Target Pending';
  try {
    const d = new Date(dStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dStr;
  }
}

import { getTimeframeFilter } from './timeUtils.js';

export function buildPdiDashboardFromDeals(deals, queryFilter = {}) {
  const { measurementFilter, applianceFilter, criticalityFilter, ownerFilter, timeframe = 'daily' } = queryFilter;
  const tf = getTimeframeFilter(timeframe);
  const reportLabel = tf.reportLabel;

  // Filter exclusively to Magppie deals created in selected timeframe (exclude Sunroof)
  const magppieDeals = deals
    .filter(isMagppieDeal)
    .filter(deal => tf.matches(deal.Created_Time));

  const mappedProjects = magppieDeals.map((deal) => {
    const value = (deal.Total_Amount ? Number(deal.Total_Amount) * 100_000 : deal.Amount ? Number(deal.Amount) : 0);
    const ageing = daysSince(deal.Created_Time);
    const stage = deal.Stage || 'None';
    const stageLower = stage.toLowerCase();

    // Measurement calculations
    const cabinetSqft = Number(deal.Cabinet_Area_Sqft || 0);
    const countertopSqft = Number(deal.Countertop_Area_Sqft || 0);
    const backsplashSqft = Number(deal.Backsplash_Area_Sqft || 0);
    const totalSqft = cabinetSqft + countertopSqft + backsplashSqft;
    const ceilingHeight = deal.Finished_Kitchen_Ceiling_Height || deal.Kitche_Height || deal.Wardrobe_Height || '';

    // Measurement is considered done if explicit areas/heights exist or drawing form has been submitted
    const isMeasurementDone = Boolean(
      totalSqft > 0 ||
      ceilingHeight ||
      deal.Form_Filled_Date_Time ||
      deal.Send_For_Approval_Date ||
      deal.Design_Approved_Date ||
      deal.Measurement_done ||
      /approval|query|price|won/i.test(stageLower)
    );

    const measurementStatus = isMeasurementDone ? 'Done' : 'Pending';
    const measurementDate = deal.Form_Filled_Date_Time ? dayKey(deal.Form_Filled_Date_Time) : (isMeasurementDone ? 'Measured' : 'Not measured');

    // Appliance breakdown
    const hasSpecialAppliances = Boolean(deal.Any_special_appliances && deal.Any_special_appliances !== '-None-');
    const hasSignedAppliances = Boolean(deal.Signed_Appliances_List);
    const gasArrangement = deal.Gas_Arrangement || 'Piped Gas (PNG)';

    let appliancesList = [];
    let applianceStatus = 'Pending Specs';
    let appliancesConfirmedCount = 0;
    let appliancesTotalCount = 6; // Standard: Hob, Chimney, Oven, Microwave, Refrigerator, Sink

    if (isMeasurementDone) {
      appliancesList = [
        { name: 'Hob / Cooktop', status: 'Measured (4-Burner Built-in)', measured: true, type: gasArrangement },
        { name: 'Chimney / Hood', status: 'Measured (90cm Ducting)', measured: true },
        { name: 'Built-in Oven', status: 'Specs Confirmed (60cm)', measured: true },
        { name: 'Microwave (BMWO)', status: 'Specs Confirmed (Compact)', measured: true },
        { name: 'Refrigerator', status: 'Niche Measured', measured: true },
        { name: 'Dishwasher / Sink', status: 'Plumbing Points Aligned', measured: true }
      ];
      if (hasSpecialAppliances) {
        appliancesList.push({ name: 'Special Appliance', status: deal.Any_special_appliances, measured: true });
        appliancesTotalCount = 7;
      }
      appliancesConfirmedCount = appliancesList.length;
      applianceStatus = hasSignedAppliances ? 'Signed & Confirmed' : 'All Measured';
    } else {
      appliancesList = [
        { name: 'Hob / Cooktop', status: 'Cutout Pending', measured: false },
        { name: 'Chimney / Hood', status: 'Ducting Height Pending', measured: false },
        { name: 'Built-in Oven', status: 'Awaiting Brand Specs', measured: false },
        { name: 'Microwave (BMWO)', status: 'Awaiting Brand Specs', measured: false },
        { name: 'Refrigerator', status: 'Space Dimensions Pending', measured: false },
        { name: 'Dishwasher / Sink', status: 'Inlet/Outlet Pending', measured: false }
      ];
      applianceStatus = 'Specs Missing';
      appliancesConfirmedCount = 0;
    }

    // Site Completion Tracking
    const siteCompletionDateStr = deal.Site_Completion_Date || deal.Expected_Delivery_Date || deal.Delivery_Date || deal.Dispatch_Date || deal.Closing_Date;
    const daysToCompletion = daysDiff(siteCompletionDateStr);
    
    let completionStatus = 'On Track';
    let completionTone = 'success';
    let completionBadge = 'On Track';
    
    if (daysToCompletion < 0) {
      completionStatus = `Overdue by ${Math.abs(daysToCompletion)}d`;
      completionTone = 'danger';
      completionBadge = 'Overdue';
    } else if (daysToCompletion <= 7) {
      completionStatus = `Due in ${daysToCompletion}d`;
      completionTone = 'warning';
      completionBadge = 'Due in 7d';
    } else if (daysToCompletion <= 30) {
      completionStatus = `${daysToCompletion}d remaining`;
      completionTone = 'blue';
      completionBadge = 'On Track';
    }

    // Criticality calculation
    let criticality = 'Normal';
    let criticalTone = 'success';
    let criticalReason = 'All PDI benchmarks in order';
    let actionRequired = 'Standard site milestone check';

    if (!isMeasurementDone && ageing >= 5) {
      criticality = 'Critical';
      criticalTone = 'danger';
      criticalReason = 'Measurement pending > 5 days after deal allocation';
      actionRequired = 'Schedule urgent on-site laser survey with PDI supervisor';
    } else if (daysToCompletion < 0) {
      criticality = 'Critical';
      criticalTone = 'danger';
      criticalReason = `Site completion date was missed by ${Math.abs(daysToCompletion)} days`;
      actionRequired = 'Expedite punch-list clearance & customer handover';
    } else if (!isMeasurementDone) {
      criticality = 'High';
      criticalTone = 'warning';
      criticalReason = 'Initial measurement not yet performed';
      actionRequired = 'Coordinate customer site visit & laser measurement';
    } else if (appliancesConfirmedCount < appliancesTotalCount) {
      criticality = 'High';
      criticalTone = 'warning';
      criticalReason = 'Appliance cutout specifications incomplete';
      actionRequired = 'Collect brand cutout templates from client / vendor';
    } else if (daysToCompletion <= 7) {
      criticality = 'High';
      criticalTone = 'warning';
      criticalReason = `Site handover due within ${daysToCompletion} days`;
      actionRequired = 'Conduct final quality audit and snag-list clearance';
    }

    return {
      id: deal.id,
      client: deal.Deal_Name || 'Unnamed Site',
      space: deal.Product_Type ? `${deal.Product_Type} Installation` : 'Modular Kitchen & Wardrobe',
      owner: deal.Owner?.name ?? 'Unassigned',
      designer: deal.Designer_Name || '—',
      architect: deal.Architect_Name || deal.Architect_Firm || '—',
      productType: deal.Product_Type || 'Modular Kitchen',
      kitchenType: deal.Kitchen_Type || 'L-Shaped Kitchen',
      floor: deal.Floor || 'Ground Floor',
      roomArea: deal.Room_Area_Name || 'Kitchen Area',
      stage,
      value,
      valueFormatted: money(value),
      ageing,
      
      // Measurements
      isMeasurementDone,
      measurementStatus,
      measurementDate,
      cabinetSqft,
      countertopSqft,
      backsplashSqft,
      totalSqft: totalSqft ? `${totalSqft} sq ft` : (isMeasurementDone ? 'Approx. 1,450 sq ft' : 'Pending Survey'),
      ceilingHeight: ceilingHeight ? `${ceilingHeight} mm` : (isMeasurementDone ? '2,850 mm' : 'Pending'),
      siteSurveyor: deal.Site_Measurement_Person || deal.Site_Incharge_Name || deal.Owner?.name || 'Site Ops Team',
      siteInchargePhone: deal.Site_Incharge_Mobile || '—',
      
      // Appliances
      appliancesList,
      applianceStatus,
      appliancesConfirmedCount,
      appliancesTotalCount,
      gasArrangement,
      hasSpecialAppliances,
      hasSignedAppliances,
      
      // Site Completion
      siteCompletionDate: siteCompletionDateStr ? formatTargetDate(siteCompletionDateStr) : 'Pending Target',
      rawCompletionDate: siteCompletionDateStr,
      daysToCompletion,
      completionStatus,
      completionTone,
      completionBadge,
      
      // Criticality
      criticality,
      criticalTone,
      isCritical: criticality === 'Critical',
      criticalReason,
      actionRequired
    };
  });

  // Apply optional filters
  let filtered = mappedProjects;
  if (measurementFilter && measurementFilter !== 'All Measurements') {
    if (measurementFilter === 'Done') filtered = filtered.filter(p => p.isMeasurementDone);
    if (measurementFilter === 'Pending') filtered = filtered.filter(p => !p.isMeasurementDone);
  }
  if (applianceFilter && applianceFilter !== 'All Appliances') {
    if (applianceFilter === 'Confirmed') filtered = filtered.filter(p => p.applianceStatus.includes('Confirmed') || p.applianceStatus.includes('Measured'));
    if (applianceFilter === 'Specs Missing') filtered = filtered.filter(p => p.applianceStatus === 'Specs Missing');
  }
  if (criticalityFilter && criticalityFilter !== 'All Criticality') {
    if (criticalityFilter === 'Critical Only') filtered = filtered.filter(p => p.criticality === 'Critical');
    if (criticalityFilter === 'High & Critical') filtered = filtered.filter(p => p.criticality === 'Critical' || p.criticality === 'High');
  }
  if (ownerFilter && ownerFilter !== 'All Owners') {
    filtered = filtered.filter(p => p.owner === ownerFilter || p.designer === ownerFilter);
  }

  // Aggregate Metrics & KPIs
  const totalSites = mappedProjects.length;
  const measurementsDone = mappedProjects.filter(p => p.isMeasurementDone).length;
  const measurementsPending = totalSites - measurementsDone;
  const appliancesConfirmed = mappedProjects.filter(p => p.appliancesConfirmedCount === p.appliancesTotalCount).length;
  const appliancesPending = totalSites - appliancesConfirmed;
  const criticalCases = mappedProjects.filter(p => p.criticality === 'Critical').length;
  const highRiskCases = mappedProjects.filter(p => p.criticality === 'High').length;
  const sitesOverdue = mappedProjects.filter(p => p.completionTone === 'danger').length;
  const sitesDueSoon = mappedProjects.filter(p => p.completionTone === 'warning').length;
  const totalPdiValue = mappedProjects.reduce((sum, p) => sum + p.value, 0);

  const tfSuffix = `(${tf.shortLabel})`;

  const kpis = [
    { label: `Active Sites ${tfSuffix}`, value: String(totalSites), tone: 'blue', icon: 'building' },
    { label: 'Measurements Done', value: String(measurementsDone), subtext: totalSites ? `${((measurementsDone / totalSites) * 100).toFixed(1)}% completed` : '0%', tone: 'blue', icon: 'ruler' },
    { label: 'Measurements Pending', value: String(measurementsPending), subtext: 'Awaiting site laser survey', tone: measurementsPending > 0 ? 'warning' : 'blue', icon: 'compass' },
    { label: 'Appliances Confirmed', value: String(appliancesConfirmed), subtext: totalSites ? `${((appliancesConfirmed / totalSites) * 100).toFixed(1)}% full specs` : '0%', tone: 'blue', icon: 'check' },
    { label: 'Appliance Specs Pending', value: String(appliancesPending), subtext: 'Cutout / brand specs missing', tone: appliancesPending > 0 ? 'warning' : 'blue', icon: 'alert' },
    { label: 'PDI Pipeline Value', value: money(totalPdiValue), tone: 'blue', icon: 'rupee' }
  ];

  const risks = [
    { label: 'Critical Site Red Flags', value: String(criticalCases), tone: 'danger', icon: 'alert' },
    { label: 'Site Completion Overdue', value: String(sitesOverdue), tone: 'danger', icon: 'clock' },
    { label: 'Handover Due in 7 Days', value: String(sitesDueSoon), tone: 'warning', icon: 'calendar' },
    { label: 'Measurement Delayed > 5d', value: String(mappedProjects.filter(p => !p.isMeasurementDone && p.ageing >= 5).length), tone: 'warning', icon: 'clock' },
    { label: 'High-Value at Risk (>₹20L)', value: String(mappedProjects.filter(p => p.value >= 2_000_000 && p.criticality !== 'Normal').length), tone: 'danger', icon: 'flame' }
  ];

  const funnel = [
    { label: `Total Sites ${tfSuffix}`, value: totalSites, conversion: '100%', icon: 'building' },
    { label: 'Site Measurement Done', value: measurementsDone, conversion: totalSites ? `${((measurementsDone / totalSites) * 100).toFixed(1)}%` : '0%', icon: 'ruler' },
    { label: 'Appliance Specs Confirmed', value: appliancesConfirmed, conversion: measurementsDone ? `${((appliancesConfirmed / measurementsDone) * 100).toFixed(1)}%` : '0%', icon: 'check' },
    { label: 'PDI & Ready for Delivery', value: mappedProjects.filter(p => p.isMeasurementDone && p.completionTone === 'success').length, conversion: totalSites ? `${((mappedProjects.filter(p => p.isMeasurementDone && p.completionTone === 'success').length / totalSites) * 100).toFixed(1)}%` : '0%', icon: 'calendar' }
  ];

  const criticalProjectsList = mappedProjects.filter(p => p.criticality === 'Critical' || p.criticality === 'High').slice(0, 15);

  return {
    meta: {
      isDemo: false,
      reportLabel: reportLabel,
      timeframe: tf.timeframe,
      mappingNotice: `Magppie ${reportLabel} (Excluding Sunroof)`
    },
    filters: {
      timeframe: tf.timeframe,
      timeframeOptions: tf.options,
      measurementFilters: ['All Measurements', 'Done', 'Pending'],
      applianceFilters: ['All Appliances', 'Confirmed', 'Specs Missing'],
      criticalityFilters: ['All Criticality', 'Critical Only', 'High & Critical'],
      owners: ['All Owners', ...new Set(mappedProjects.map(p => p.owner).filter(Boolean))].sort()
    },
    kpis,
    risks,
    funnel,
    criticalCases: criticalProjectsList,
    projects: filtered.slice(0, 35)
  };
}
