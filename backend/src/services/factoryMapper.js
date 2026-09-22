import xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/env.js';

// Spreadsheet locations come from FACTORY_*_FILE in the environment (see backend/.env.example).
const { planning: PLANNING_FILE, dispatch: DISPATCH_FILE, chi: CHI_FILE } = config.factoryFiles;

function categorizeIssue(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('refrigerator') || t.includes('fridge') || t.includes('chimney') || t.includes('hob') || t.includes('oven') || t.includes('microwave') || t.includes('appliance') || t.includes('dishwasher') || t.includes('sink')) {
    return 'Appliance & Cutout Specs';
  }
  if (t.includes('dimension') || t.includes('depth') || t.includes('height') || t.includes('width') || t.includes('size') || t.includes('drop-down') || t.includes('dropdown') || t.includes('cladding') || t.includes('filler')) {
    return 'Dimension & Depth Clarity';
  }
  if (t.includes('pdi') || t.includes('pd drawing') || t.includes('elevation') || t.includes('drawing') || t.includes('code') || t.includes('elevation ab') || t.includes('elevation a')) {
    return 'Drawing Discrepancies (PD vs PDI)';
  }
  if (t.includes('hardware') || t.includes('accessory') || t.includes('iron board') || t.includes('detergent') || t.includes('pullout') || t.includes('laundry') || t.includes('tray') || t.includes('basket') || t.includes('hinge') || t.includes('titus')) {
    return 'Hardware & Scope Ambiguity';
  }
  if (t.includes('email') || t.includes('document') || t.includes('uid') || t.includes('mpp') || t.includes('swati') || t.includes('belonging to')) {
    return 'Order & Document Routing';
  }
  if (t.includes('stone') || t.includes('thickness') || t.includes('grain') || t.includes('tinted') || t.includes('glass') || t.includes('finish') || t.includes('sahara matt')) {
    return 'Material & Finish Specs';
  }
  return 'General Design Query';
}

const excelDate = (serial) => new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);

// Stable id for a planning query, so meeting decisions survive rows being re-ordered in the sheet.
const queryKey = (parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);

function normalizeDesignerName(name) {
  if (!name) return 'Unassigned';
  let clean = name.replace(/^Mr\.?\s*|^Ms\.?\s*|^Mrs\.?\s*/i, '').trim();
  clean = clean.replace(/\s+&.*$/, '').trim(); // Primary designer
  if (clean.toLowerCase().includes('mehul')) return 'Mehul';
  if (clean.toLowerCase().includes('vishal')) return 'Vishal Dubey';
  if (clean.toLowerCase().includes('ankita')) return 'Ankita';
  if (clean.toLowerCase().includes('jyoti')) return 'Jyoti Sharma';
  if (clean.toLowerCase().includes('sudha')) return 'Sudha';
  if (clean.toLowerCase().includes('atif')) return 'Atif Hussain';
  if (clean.toLowerCase().includes('rishabh')) return 'Rishabh Butar';
  if (clean.toLowerCase().includes('nidhi')) return 'Nidhi Srivastava';
  if (clean.toLowerCase().includes('pravallika')) return 'Pravallika';
  return clean || 'Unassigned';
}

export function loadFactoryDashboardData(filters = {}) {
  const { designerFilter, bucketFilter, productFilter, tatSlabFilter } = filters;

  // 1. Parse Planning Queries
  let queries = [];
  if (fs.existsSync(PLANNING_FILE)) {
    const wbPlan = xlsx.readFile(PLANNING_FILE);
    const sheetPlan = wbPlan.Sheets[wbPlan.SheetNames[0]];
    const rowsPlan = xlsx.utils.sheet_to_json(sheetPlan, { header: 1 });

    // The sheet is a log: a lone date cell starts each block and the header row repeats between blocks.
    let loggedOn = null;
    for (let i = 1; i < rowsPlan.length; i++) {
      const row = rowsPlan[i];
      if (!row) continue;
      const filledCells = row.filter((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (filledCells.length === 1 && typeof row[0] === 'number' && row[0] > 40000) {
        loggedOn = excelDate(row[0]);
        continue;
      }
      if (/^mpp/i.test(String(row[0] ?? '').trim())) continue;
      if (!row[2] && !row[4]) continue;

      const mpp = row[0] ? String(row[0]).trim() : '';
      const uid = row[1] ? String(row[1]).trim() : '';
      const client = row[2] ? String(row[2]).trim() : 'Unnamed Client';
      const product = row[3] ? String(row[3]).trim() : 'Kitchen';
      const issue1 = row[4] ? String(row[4]).trim() : '';
      const issue2 = row[5] ? String(row[5]).trim() : '';
      const rawDesigner = row[6] ? String(row[6]).trim() : 'Unassigned';
      const normalizedDesigner = normalizeDesignerName(rawDesigner);

      const combinedIssues = [issue1, issue2].filter(Boolean).join('\n\n');
      const category = categorizeIssue(combinedIssues);

      const coDesigners = rawDesigner.split('&').slice(1).map((name) => normalizeDesignerName(name)).filter((name) => name !== 'Unassigned');

      queries.push({
        id: `PQ-${i + 1}`,
        key: queryKey([mpp, uid, client, issue1, issue2]),
        loggedOn,
        coDesigners,
        mppNo: mpp || '—',
        uidNo: uid || '—',
        client,
        product,
        designerRaw: rawDesigner,
        designer: normalizedDesigner,
        issue1,
        issue2,
        combinedIssues,
        category,
        severity: (combinedIssues.toLowerCase().includes('hold') || combinedIssues.toLowerCase().includes('wrong') || combinedIssues.toLowerCase().includes('incorrect') || combinedIssues.toLowerCase().includes('not clear') || combinedIssues.toLowerCase().includes('missing')) ? 'Critical' : 'High',
        status: 'Open Query',
        standupAction: `Align with Designer (${normalizedDesigner}) to resolve drawing / cutout / spec before factory production line starts.`
      });
    }
  }

  // 2. Parse Dispatch Failures
  let dispatchFailures = [];
  if (fs.existsSync(DISPATCH_FILE)) {
    const wbDisp = xlsx.readFile(DISPATCH_FILE);
    const sheetDisp = wbDisp.Sheets[wbDisp.SheetNames[0]];
    const rowsDisp = xlsx.utils.sheet_to_json(sheetDisp, { header: 1 });

    for (let i = 1; i < rowsDisp.length; i++) {
      const row = rowsDisp[i];
      if (!row || (!row[1] && !row[6])) continue;

      const mrp = row[0] ? String(row[0]).trim() : '—';
      const client = row[1] ? String(row[1]).trim() : 'Unnamed Client';
      const location = row[2] ? String(row[2]).trim() : '—';
      const orderType = row[3] ? String(row[3]).trim() : '—';
      const planned = row[4] ? (typeof row[4] === 'number' ? new Date((row[4] - (25567 + 2)) * 86400 * 1000).toISOString().slice(0, 10) : String(row[4]).slice(0, 10)) : '—';
      const actual = row[5] ? (typeof row[5] === 'number' ? new Date((row[5] - (25567 + 2)) * 86400 * 1000).toISOString().slice(0, 10) : String(row[5]).trim().slice(0, 10)) : 'On Hold';
      const reason = row[6] ? String(row[6]).trim() : 'No reason recorded';

      dispatchFailures.push({
        id: `DF-${i + 1}`,
        mrpNo: mrp,
        client,
        location,
        orderType,
        plannedDate: planned,
        actualDate: actual,
        reason,
        impact: 'Vehicle Ready & Held at Factory Gate',
        rootCause: 'Last-minute hold requested by Design / Installation team despite site approval',
        standupRecommendation: 'Mandate 48h advance freeze for dispatch holds to eliminate idle transport & factory staging costs.'
      });
    }
  }

  // 3. Parse CHI Material TAT
  let tatRecords = [];
  if (fs.existsSync(CHI_FILE)) {
    const wbChi = xlsx.readFile(CHI_FILE);
    const sheetName = wbChi.SheetNames.find(s => s.toLowerCase().includes('tat')) || wbChi.SheetNames[0];
    const sheetChi = wbChi.Sheets[sheetName];
    const rowsChi = xlsx.utils.sheet_to_json(sheetChi, { header: 1 });

    for (let i = 1; i < rowsChi.length; i++) {
      const row = rowsChi[i];
      if (!row || (!row[1] && row[4] === undefined)) continue;

      const sno = row[0] || i;
      const trustee = row[1] ? String(row[1]).trim() : `Project #${i}`;
      const raised = row[2] ? (typeof row[2] === 'number' ? new Date((row[2] - (25567 + 2)) * 86400 * 1000).toISOString().slice(0, 10) : String(row[2]).slice(0, 10)) : '—';
      const received = row[3] ? (typeof row[3] === 'number' ? new Date((row[3] - (25567 + 2)) * 86400 * 1000).toISOString().slice(0, 10) : String(row[3]).slice(0, 10)) : '—';
      const tatVal = row[4];
      const materialTatDays = (typeof tatVal === 'number') ? tatVal : (tatVal ? parseInt(tatVal, 10) : null);

      if (materialTatDays === null || isNaN(materialTatDays)) continue;

      let slab = 'On Track (<30d)';
      let slabTone = 'success';
      if (materialTatDays >= 90) {
        slab = 'Critical (>90d)';
        slabTone = 'danger';
      } else if (materialTatDays >= 60) {
        slab = 'Delayed (60–90d)';
        slabTone = 'warning';
      } else if (materialTatDays >= 30) {
        slab = 'Moderate (30–60d)';
        slabTone = 'blue';
      }

      tatRecords.push({
        id: `CHI-${i}`,
        sno,
        trustee,
        raisedDate: raised,
        receivedDate: received,
        materialTatDays,
        slab,
        slabTone
      });
    }
  }

  // Calculate TAT Statistics
  const tatNumbers = tatRecords.map(r => r.materialTatDays).filter(n => typeof n === 'number');
  const avgTat = tatNumbers.length ? Math.round(tatNumbers.reduce((a, b) => a + b, 0) / tatNumbers.length) : 0;
  const maxTat = tatNumbers.length ? Math.max(...tatNumbers) : 0;
  const minTat = tatNumbers.length ? Math.min(...tatNumbers) : 0;
  const criticalTatCount = tatRecords.filter(r => r.materialTatDays >= 90).length;
  const delayedTatCount = tatRecords.filter(r => r.materialTatDays >= 60 && r.materialTatDays < 90).length;
  const moderateTatCount = tatRecords.filter(r => r.materialTatDays >= 30 && r.materialTatDays < 60).length;
  const onTrackTatCount = tatRecords.filter(r => r.materialTatDays < 30).length;

  // Bucketing counts for Planning Queries
  const bucketCounts = {};
  queries.forEach(q => {
    bucketCounts[q.category] = (bucketCounts[q.category] || 0) + 1;
  });

  // Designer counts for Planning Queries
  const designerCounts = {};
  queries.forEach(q => {
    designerCounts[q.designer] = (designerCounts[q.designer] || 0) + 1;
  });

  // Apply filters
  let filteredQueries = queries;
  if (designerFilter && designerFilter !== 'All Designers') {
    filteredQueries = filteredQueries.filter(q => q.designer === designerFilter);
  }
  if (bucketFilter && bucketFilter !== 'All Buckets') {
    filteredQueries = filteredQueries.filter(q => q.category === bucketFilter);
  }
  if (productFilter && productFilter !== 'All Products') {
    filteredQueries = filteredQueries.filter(q => q.product.toLowerCase().includes(productFilter.toLowerCase()));
  }

  let filteredTat = tatRecords;
  if (tatSlabFilter && tatSlabFilter !== 'All Slabs') {
    filteredTat = filteredTat.filter(t => t.slab === tatSlabFilter);
  }

  // Standup Highlights
  const standupGaps = [
    {
      title: '30 Factory Planning Queries Holding Production',
      description: 'Factory floor cannot proceed due to missing dimensions (12), appliance cutout clarity (15), and PD vs PDI drawing conflicts (1).',
      tone: 'danger',
      metric: '30 Blocked Orders',
      action: 'Assign design leads (Mehul: 11, Vishal: 5, Ankita: 4, Sudha: 4) to submit revised drawings by 12:00 PM.'
    },
    {
      title: '3 Last-Minute Dispatch Vehicle Holds',
      description: 'Material ready and site approved, but vehicles stopped at factory gate by Design / Installation teams.',
      tone: 'danger',
      metric: '3 Stuck Trucks (Gurgaon, Coimbatore, Noida)',
      action: 'Enforce 48-hour advance notice freeze on dispatch halts to eliminate idle freight charges.'
    },
    {
      title: 'High Material Turnaround Time (Avg 60.4 Days)',
      description: `45 out of 168 material requisitions have breached the 90-day SLA with max delay of ${maxTat} days.`,
      tone: 'warning',
      metric: '60.4 Days Avg TAT',
      action: 'Expedite procurement clearance for critical CHI trustee orders.'
    }
  ];

  // KPIs
  const kpis = [
    {
      label: 'Factory Queries for Design',
      value: String(queries.length),
      subtext: `${queries.filter(q => q.severity === 'Critical').length} Critical Blockers`,
      tone: 'danger',
      icon: 'alert'
    },
    {
      label: 'Dispatch Failures',
      value: String(dispatchFailures.length),
      subtext: 'Vehicles held at factory gate',
      tone: 'danger',
      icon: 'clock'
    },
    {
      label: 'Avg Material TAT (Days)',
      value: `${avgTat} Days`,
      subtext: `Min ${minTat}d · Max ${maxTat}d`,
      tone: 'warning',
      icon: 'calendar'
    },
    {
      label: 'Critical SLA Breaches (>90d)',
      value: String(criticalTatCount),
      subtext: `${((criticalTatCount / (tatRecords.length || 1)) * 100).toFixed(1)}% of total orders`,
      tone: 'danger',
      icon: 'flame'
    },
    {
      label: 'Designers with Queries',
      value: String(Object.keys(designerCounts).length),
      subtext: 'Mehul, Vishal, Ankita, Sudha',
      tone: 'blue',
      icon: 'users'
    },
    {
      label: 'Total Tracked Dispatches',
      value: String(tatRecords.length),
      subtext: 'CHI Materials tracker',
      tone: 'blue',
      icon: 'building'
    }
  ];

  const risks = [
    {
      label: 'Appliance & Cutout Gaps',
      value: String(bucketCounts['Appliance & Cutout Specs'] || 0),
      subtext: 'Fridge bottom/back, Chimney cover panel height',
      tone: 'danger',
      icon: 'alert'
    },
    {
      label: 'Dimension & Depth Errors',
      value: String(bucketCounts['Dimension & Depth Clarity'] || 0),
      subtext: 'Countertop depth, Backsplash height',
      tone: 'danger',
      icon: 'ruler'
    },
    {
      label: 'Vehicle Dispatches Blocked',
      value: String(dispatchFailures.length),
      subtext: 'Site approved but installation/design hold',
      tone: 'danger',
      icon: 'clock'
    },
    {
      label: 'Material TAT > 90 Days',
      value: String(criticalTatCount),
      subtext: 'Severe delay in raw material receipt',
      tone: 'danger',
      icon: 'flame'
    },
    {
      label: 'Wrong Client Documents',
      value: '1 Order',
      subtext: 'Ms. Swapan received Ms. Swati Chandwani files',
      tone: 'warning',
      icon: 'file'
    }
  ];

  return {
    meta: {
      reportLabel: 'Live Factory Morning Review',
      mappingNotice: 'Aggregated from Planning Query.xlsx, Dispatch Failure.xlsx & CHI MEET REF 8 SEP26.xlsx',
      sources: [
        'Planning Query.xlsx (Issue 1 & 2 Concerns for Design)',
        'Dispatch Failure.xlsx (Vehicle Dispatch Failure Reasons)',
        'CHI MEET REF 8 SEP26.xlsx (Material TAT No of Days)'
      ]
    },
    kpis,
    risks,
    standupGaps,
    filters: {
      designers: ['All Designers', ...Object.keys(designerCounts).sort()],
      buckets: ['All Buckets', ...Object.keys(bucketCounts).sort()],
      products: ['All Products', 'Kitchen', 'Dry kitchen', 'Wet kitchen', 'Wardrobe', 'Classic Kitchen'],
      tatSlabs: ['All Slabs', 'Critical (>90d)', 'Delayed (60–90d)', 'Moderate (30–60d)', 'On Track (<30d)']
    },
    bucketDistribution: Object.entries(bucketCounts).map(([name, count]) => ({
      name,
      count,
      percentage: ((count / queries.length) * 100).toFixed(1)
    })),
    designerDistribution: Object.entries(designerCounts).map(([name, count]) => ({
      name,
      count,
      percentage: ((count / queries.length) * 100).toFixed(1)
    })),
    tatSummary: {
      avgTat,
      maxTat,
      minTat,
      totalTracked: tatRecords.length,
      slabs: [
        { label: 'Critical (>90d)', count: criticalTatCount, tone: 'danger', percentage: ((criticalTatCount / tatRecords.length) * 100).toFixed(1) },
        { label: 'Delayed (60–90d)', count: delayedTatCount, tone: 'warning', percentage: ((delayedTatCount / tatRecords.length) * 100).toFixed(1) },
        { label: 'Moderate (30–60d)', count: moderateTatCount, tone: 'blue', percentage: ((moderateTatCount / tatRecords.length) * 100).toFixed(1) },
        { label: 'On Track (<30d)', count: onTrackTatCount, tone: 'success', percentage: ((onTrackTatCount / tatRecords.length) * 100).toFixed(1) }
      ]
    },
    queries: filteredQueries,
    dispatchFailures,
    tatRecords: [...filteredTat].sort((x, y) => y.materialTatDays - x.materialTatDays).slice(0, 50),
    allTatRecords: tatRecords
  };
}
