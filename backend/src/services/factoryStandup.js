import { loadFactoryDashboardData } from './factoryMapper.js';
import { loadStandupState, saveStandupState } from './standupStore.js';
import { dayOffset, getTimeframeFilter, localDayKey } from './timeUtils.js';

const PATTERN_TIPS = {
  'Appliance & Cutout Specs': 'Add an appliance cutout checklist to drawing sign-off.',
  'Dimension & Depth Clarity': 'Mark every depth and height on the drawing before release.',
  'Drawing Discrepancies (PD vs PDI)': 'Compare the PD drawing with the PDI drawing before it goes to the factory.',
  'Hardware & Scope Ambiguity': 'List hardware and accessories explicitly in the order.',
  'Order & Document Routing': 'Check client name and UID on every email before sending.',
  'Material & Finish Specs': 'Confirm material, thickness and finish in writing.',
  'General Design Query': 'Clear open factory questions with the planner the same day.'
};

const SHORT_CATEGORY = {
  'Appliance & Cutout Specs': 'Appliance cutouts',
  'Dimension & Depth Clarity': 'Dimensions',
  'Drawing Discrepancies (PD vs PDI)': 'PD vs PDI drawings',
  'Hardware & Scope Ambiguity': 'Hardware scope',
  'Order & Document Routing': 'Wrong documents',
  'Material & Finish Specs': 'Material and finish',
  'General Design Query': 'General queries'
};

function heldBy(reason = '') {
  if (/design and installation/i.test(reason)) return 'Design and installation team';
  const named = /\b([A-Z][a-z]+)\s+told\b/.exec(reason);
  if (named) return named[1];
  if (/installation/i.test(reason)) return 'Installation team';
  if (/design/i.test(reason)) return 'Design team';
  return 'Not recorded';
}

function topCategory(queries) {
  const counts = new Map();
  queries.forEach((query) => counts.set(query.category, (counts.get(query.category) ?? 0) + 1));
  const [category, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return category ? { category, label: SHORT_CATEGORY[category] ?? category, count } : null;
}

const TAT_SLABS = [
  { label: 'Critical (>90d)', tone: 'danger', test: (days) => days >= 90 },
  { label: 'Delayed (60–90d)', tone: 'warning', test: (days) => days >= 60 && days < 90 },
  { label: 'Moderate (30–60d)', tone: 'blue', test: (days) => days >= 30 && days < 60 },
  { label: 'On Track (<30d)', tone: 'success', test: (days) => days < 30 }
];

function tatSummary(records) {
  const days = records.map((record) => record.materialTatDays);
  const pct = (count) => (records.length ? ((count / records.length) * 100).toFixed(1) : '0.0');
  return {
    totalTracked: records.length,
    avgTat: days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : 0,
    maxTat: days.length ? Math.max(...days) : 0,
    minTat: days.length ? Math.min(...days) : 0,
    slabs: TAT_SLABS.map((slab) => {
      const count = days.filter(slab.test).length;
      return { label: slab.label, tone: slab.tone, count, percentage: pct(count) };
    })
  };
}

export function buildFactoryStandup(timeframe = 'daily', now = new Date()) {
  const tf = getTimeframeFilter(timeframe);
  const source = loadFactoryDashboardData();
  const state = loadStandupState();
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getTime() - 86_400_000));

  // Remember when each query first appeared so tomorrow can show what is new.
  let changed = false;
  source.queries.forEach((query) => {
    if (!state.firstSeen[query.key]) {
      state.firstSeen[query.key] = today;
      changed = true;
    }
  });
  if (changed) saveStandupState(state);
  const trackingSince = Object.values(state.firstSeen).sort()[0] ?? today;
  const hasHistory = trackingSince < today;

  // Only queries logged in the selected window; older open ones are counted so nothing disappears silently.
  const inWindow = source.queries.filter((query) => query.loggedOn && tf.matches(query.loggedOn));
  const olderOpen = source.queries.filter((query) => !inWindow.includes(query) && (state.queries[query.key]?.status ?? 'open') !== 'done');
  const olderDates = olderOpen.map((query) => query.loggedOn).filter(Boolean).sort();

  const queries = inWindow.map((query) => {
    const saved = state.queries[query.key] ?? {};
    const status = saved.status ?? 'open';
    const dueDate = saved.dueDate ?? null;
    let due = 'none';
    if (status === 'done') due = 'done';
    else if (dueDate && dueDate < today) due = 'missed';
    else if (dueDate === today) due = 'today';
    else if (dueDate) due = 'upcoming';
    return {
      key: query.key,
      mpp: query.mppNo,
      uid: query.uidNo,
      client: query.client,
      product: query.product,
      designer: query.designer,
      coDesigners: query.coDesigners,
      issue1: query.issue1,
      issue2: query.issue2,
      category: query.category,
      categoryLabel: SHORT_CATEGORY[query.category] ?? query.category,
      severity: query.severity,
      loggedOn: query.loggedOn,
      ageDays: query.loggedOn ? dayOffset(query.loggedOn, now) : null,
      isNew: hasHistory && state.firstSeen[query.key] === today,
      status,
      dueDate,
      due,
      discussedToday: saved.discussedOn === today,
      closedOn: saved.closedOn ?? null
    };
  });

  const open = queries.filter((query) => query.status !== 'done');
  const promisedForYesterday = queries.filter((query) => query.dueDate === yesterday);
  const missedYesterday = promisedForYesterday.filter((query) => query.status !== 'done');

  const byDesigner = new Map();
  queries.forEach((query) => {
    const list = byDesigner.get(query.designer) ?? [];
    list.push(query);
    byDesigner.set(query.designer, list);
  });

  const designers = [...byDesigner].map(([name, list]) => {
    const openList = list.filter((query) => query.status !== 'done');
    const ages = openList.map((query) => query.ageDays).filter((age) => age !== null);
    return {
      name,
      open: openList.length,
      critical: openList.filter((query) => query.severity === 'Critical').length,
      oldestDays: ages.length ? Math.max(...ages) : null,
      newToday: openList.filter((query) => query.isNew).length,
      closedYesterday: list.filter((query) => query.closedOn === yesterday).length,
      closedToday: list.filter((query) => query.closedOn === today).length,
      dueToday: openList.filter((query) => query.due === 'today').length,
      missed: openList.filter((query) => query.due === 'missed').length,
      discussedToday: openList.length ? openList.every((query) => query.discussedToday) : list.some((query) => query.discussedToday),
      pattern: topCategory(openList)
    };
  }).filter((designer) => designer.open > 0 || designer.closedYesterday > 0 || designer.closedToday > 0)
    .sort((a, b) => b.missed - a.missed || b.critical - a.critical || b.open - a.open || (b.oldestDays ?? 0) - (a.oldestDays ?? 0));

  const holds = source.dispatchFailures.filter((hold) => tf.matches(hold.plannedDate));
  const tatInWindow = source.allTatRecords.filter((record) => tf.matches(record.receivedDate));

  const team = topCategory(open);
  const teamDesigners = team ? new Set(open.filter((query) => query.category === team.category).map((query) => query.designer)).size : 0;
  const openAges = open.map((query) => query.ageDays).filter((age) => age !== null);

  return {
    meta: {
      timeframe: tf.timeframe,
      reportLabel: tf.reportLabel,
      timeframeOptions: tf.options,
      olderOpen: { count: olderOpen.length, newest: olderDates.at(-1) ?? null, oldest: olderDates[0] ?? null },
      today,
      yesterday,
      trackingSince,
      hasHistory,
      source: 'Planning Query.xlsx · Dispatch Failure.xlsx · CHI MEET REF 8 SEP26.xlsx'
    },
    summary: {
      open: open.length,
      newToday: hasHistory ? open.filter((query) => query.isNew).length : null,
      closedYesterday: hasHistory ? queries.filter((query) => query.closedOn === yesterday).length : null,
      vehiclesHeld: holds.length,
      oldestDays: openAges.length ? Math.max(...openAges) : null
    },
    promises: {
      made: promisedForYesterday.length,
      delivered: promisedForYesterday.length - missedYesterday.length,
      missed: missedYesterday.map((query) => ({ designer: query.designer, mpp: query.mpp })),
      dueToday: open.filter((query) => query.due === 'today').length,
      overdue: open.filter((query) => query.due === 'missed').length
    },
    designers,
    queries,
    dispatchHolds: holds.map((hold) => ({
      id: hold.id,
      mrp: hold.mrpNo,
      client: hold.client,
      location: hold.location,
      orderType: hold.orderType,
      plannedDate: hold.plannedDate,
      actualDate: hold.actualDate,
      stillHeld: !/^\d{4}-\d{2}-\d{2}$/.test(hold.actualDate),
      heldBy: heldBy(hold.reason),
      reason: hold.reason
    })),
    teamPattern: team ? { ...team, designers: teamDesigners, tip: PATTERN_TIPS[team.category] ?? '' } : null,
    materialTat: { summary: tatSummary(tatInWindow), records: [...tatInWindow].sort((a, b) => b.materialTatDays - a.materialTatDays) }
  };
}
