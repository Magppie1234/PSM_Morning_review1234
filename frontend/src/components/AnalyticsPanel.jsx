import { createContext, useCallback, useContext, useState } from 'react';
import { AnalyticsDetails } from './AnalyticsDetails.jsx';
const EvidenceContext = createContext(null);
import { Bullet, Combo, Gauge, HBars, Lollipop, Ring, Scatter, SplitBar, Waffle, fmt, parseSample, pct } from './charts/MiniCharts.jsx';

// PSM HEALTH, and the Sales health block that borrows the same card.
//
// WHY EVERY CARD CARRIES A CHART. A bare "17.6%" tells you the number and nothing else; the same
// figure as a filled ring against an empty one tells you it is low before you have read the digits.
// The chart is not decoration - it is the context the number cannot carry on its own.
//
// WHAT IS DELIBERATELY NOT CHARTED. A chart is drawn only where the API actually sends the data for
// it. Three cards here have a figure and no series behind it - average first-connect time, average
// PSM value, average sales value - and they stay as plain figures. Inventing a distribution for them
// would look better and be a lie, and a dashboard that draws a shape it cannot source is worse than
// one that admits the gap.
//
// THE PALETTE IS SIX COLOURS, fixed in analytics.css as --an-c1 … --an-c6 and listed in MiniCharts.
// Nothing on this board may introduce a seventh.

const count = (value) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const format = (item) => {
  if (item.value == null || !Number.isFinite(Number(item.value))) {
    return item.detail === 'Target not configured' ? 'Target not configured' : 'No data available';
  }
  if (item.unit === '%') return `${count(item.value)}%`;
  if (item.unit === 'inr') return `₹${count(item.value)}`;
  if (item.unit === 'hours') return `${count(item.value)} hours`;
  if (item.unit === 'min') return `${count(item.value)} min`;
  if (item.unit === 'days') return `${count(item.value)} days`;
  return count(item.value);
};

// WHICH CHART A METRIC GETS, decided by the shape of its data rather than by its name:
//   a real denominator ("6 / 34")  -> Ring, because a share of a known whole is a share
//   a count against the cohort     -> Waffle, because 30 untouched leads is thirty things
//   a percentage with no whole     -> Gauge
//   no value at all                -> an empty gauge in amber, so "not set" looks unset
// `cohort` is the period's lead count, the only denominator the count metrics share.
function chartFor(item, cohort) {
  const sample = parseSample(item.sample);
  const value = item.value != null && Number.isFinite(Number(item.value)) ? Number(item.value) : null;
  const tone = TONES[item.key] ?? 'c1';

  if (value == null) {
    return <div className="an-chart an-chart-unset"><Gauge value={null} label={`${item.label}: not configured`} /></div>;
  }
  if (sample) {
    return (
      <div className="an-chart">
        <Ring value={pct(sample.part, sample.whole)} tone={tone} label={`${item.label}: ${sample.part} of ${sample.whole}`} />
      </div>
    );
  }
  if (item.unit === 'count' && cohort > 0) {
    return (
      <div className="an-chart an-chart-block">
        <Waffle part={value} whole={cohort} tone={tone} label={`${item.label}: ${value} of ${cohort}`} />
      </div>
    );
  }
  if (item.unit === '%') {
    return <div className="an-chart"><Gauge value={value} tone={tone} label={`${item.label}: ${value}%`} /></div>;
  }
  // A figure with nothing behind it. Said plainly rather than dressed up.
  return null;
}

// Tone per metric, from the six. Loss is rose, effort/attention is amber, good outcomes are teal.
const TONES = {
  dropRatio: 'c5',
  untouched: 'c4',
  notResponding: 'c4',
  overdueTasks: 'c4',
  callConnect: 'c3',
  talkTime: 'c3',
  qualification: 'c1',
  leadContact: 'c1'
};

function Metric({ item, cohort }) {
  const open = useContext(EvidenceContext);
  const chart = chartFor(item, cohort);
  const unset = item.value == null || !Number.isFinite(Number(item.value));
  return (
    <article onClick={open ? () => open(item.key, item.label, item.detail) : undefined} onKeyDown={open ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item.key, item.label, item.detail); } } : undefined} role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined} className={`an-metric${chart ? ' has-chart' : ''}${unset ? ' is-unset' : ''}`} title={item.detail}>
      <h3>{item.label}</h3>
      <div className="an-metric-body">
        <div className="an-metric-figure">
          <strong className={unset ? 'an-empty' : ''}>{format(item)}</strong>
          {item.sample && <small>{item.sample}</small>}
        </div>
        {chart}
      </div>
      <p>{item.detail}</p>
    </article>
  );
}

function Metrics({ rows, cohort = 0 }) {
  return <div className="an-metrics">{rows.map((item) => <Metric item={item} cohort={cohort} key={item.key} />)}</div>;
}

/** A titled block inside a panel. `wide` spans the full row. */
function Block({ title, note, wide = false, children, evidenceKey }) {
  const open = useContext(EvidenceContext);
  return (
    <section role={open && evidenceKey ? 'button' : undefined} tabIndex={open && evidenceKey ? 0 : undefined}
      onClick={open && evidenceKey ? () => open(evidenceKey, title, note) : undefined}
      onKeyDown={open && evidenceKey ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(evidenceKey, title, note); } } : undefined}
      className={`an-breakdown${wide ? ' is-wide' : ''}`} aria-label={title}>
      <h3>{title}{open && evidenceKey && <span aria-hidden="true"> ↗</span>}</h3>
      {note && <p className="an-note">{note}</p>}
      {children}
    </section>
  );
}

export function PreSalesAnalytics({ analytics, trend }) {
  const [selection, setSelection] = useState(null);
  const close = useCallback(() => setSelection(null), []);
  if (!analytics) return null;
  const { metrics, health, breakdowns, efficiency } = analytics;
  const dayWord = efficiency.workingDays === 1 ? 'day' : 'days';
  const cohort = Number(efficiency.leads) || 0;
  const byPsm = breakdowns.byPsm ?? [];
  const months = trend?.data?.months ?? [];

  const open = (key, label, detail) => {
    const unavailable = (['firstConnect', 'sla', 'callConnect', 'talkTime', 'connected', 'talkByPsm', 'effort'].includes(key) && analytics.availability?.calls === false) ||
      (['salesValue', 'psmValue', 'qualificationTarget'].includes(key) && analytics.availability?.contacts === false) ||
      (key === 'overdueTasks' && analytics.availability?.tasks === false);
    setSelection({ label, detail: unavailable ? `${detail || ''} · Source data unavailable` : detail,
      unavailable, rows: unavailable ? [] : key === 'trend' ? months.flatMap((month) => month.records ?? []) : analytics.evidence?.[key] ?? [] });
  };
  return <EvidenceContext.Provider value={open}><div className="an-stack">
    {/* 1 — conversion. Ratios with real denominators, so most of these are rings. */}
    <section className="an-panel" aria-labelledby="an-conversion">
      <div className="an-head"><h2 id="an-conversion">Pre-Sales conversion</h2><p>Lead intake and progression in the selected period</p></div>
      <Metrics rows={metrics} cohort={cohort} />
    </section>

    {/* 2 — health. Counts against the cohort, so these are waffles and gauges. */}
    <section className="an-panel" aria-labelledby="an-health">
      <div className="an-head"><h2 id="an-health">Pre-Sales health</h2><p>Response, calling effort and follow-up</p></div>
      <Metrics rows={health} cohort={cohort} />
    </section>

    {/* 3 — quality and loss. The combo chart leads because volume and rate only mean something together. */}
    <section className="an-panel" aria-labelledby="an-quality">
      <div className="an-head"><h2 id="an-quality">Lead quality and loss</h2><p>Where leads come from, and why they are lost</p></div>
      <div className="an-breakdowns">
        <Block
          evidenceKey="trend" title="Lead → qualified by intake month"
          note="Columns are leads created that month; the line is how many of them are qualified today."
          wide
        >
          {months.length
            ? <Combo rows={months} />
            : <p className="an-none" role="status">{trend?.error ? 'Trend unavailable from Zoho' : 'Loading twelve-month trend…'}</p>}
        </Block>
        <Block evidenceKey="dropReasons" title="Drop reasons" note="Why leads in this period were dropped.">
          <HBars rows={(breakdowns.dropReasons ?? []).map((row) => ({ label: row.label, value: row.count }))} tone="c5" restTone="c5" />
        </Block>
        <Block evidenceKey="sources" title="Source quality · qualified share" note="Qualified as a share of the leads each source brought in.">
          <HBars
            rows={(breakdowns.sources ?? []).map((row) => ({
              label: row.label, value: row.rate ?? 0, note: `${fmt(row.qualified)} of ${fmt(row.count)}`
            }))}
            tone="c1" restTone="c2" suffix="%"
          />
        </Block>
      </div>
    </section>

    {/* 4 — PSM activity. Same people, three readings: outcome, effort, and the two against each other. */}
    <section className="an-panel" aria-labelledby="an-psm">
      <div className="an-head"><h2 id="an-psm">PSM activity</h2><p>Calling and qualification by assigned PSM</p></div>
      <div className="an-breakdowns">
        <Block evidenceKey="byPsm" title="Leads qualified by PSM">
          <HBars rows={byPsm.map((row) => ({ label: row.label, value: row.qualified, note: `${fmt(row.leads)} assigned` }))} />
        </Block>
        <Block evidenceKey="talkByPsm" title="Talk hours by PSM">
          <Lollipop rows={byPsm.map((row) => ({ label: row.label, value: row.talkMinutes / 60 }))} tone="c3" />
        </Block>
        <Block evidenceKey="effort" title="Effort vs outcome" note="Is calling effort turning into qualified leads?">
          <Scatter
            rows={byPsm.map((row) => ({ label: row.label, x: row.talkMinutes / 60, y: row.qualified }))}
            xLabel="talk hours" yLabel="qualified"
          />
        </Block>
      </div>
    </section>

    {/* 5 — efficiency. Deliberately the calmest panel: three rates and nothing else. */}
    <section className="an-panel" aria-labelledby="an-efficiency">
      <div className="an-head"><h2 id="an-efficiency">Pre-Sales efficiency margin</h2><p>Actual output per working day, from the same filtered lead cohort</p></div>
      <div className="an-rates">
        <Rate evidenceKey="intake" label="Lead intake / working day" value={efficiency.workingDays ? efficiency.leads / efficiency.workingDays : null}
          of={cohort} note={`${fmt(efficiency.leads)} leads over ${efficiency.workingDays} working ${dayWord}`} tone="c1" />
        <Rate evidenceKey="dailyQualified" label="Qualifications / working day" value={efficiency.qualificationPerWorkingDay}
          of={cohort} note={`${fmt(efficiency.qualified)} qualified over ${efficiency.workingDays} working ${dayWord}`} tone="c3" />

      </div>
      <div className="an-split">
        <SplitBar part={efficiency.connected} whole={cohort} tone="c3"
          label={`${efficiency.connected} of ${cohort} leads connected`} />
        <button type="button" className="an-open" onClick={() => open('connected', 'Connected leads', 'First verified PSM connections for the selected lead cohort')}>{fmt(efficiency.connected)} of {fmt(cohort)} leads in this period have a connected call. ↗</button>
      </div>
    </section>
  </div>{selection && <AnalyticsDetails key={selection.label} selection={selection} onClose={close} />}</EvidenceContext.Provider>;
}

/** One efficiency rate: a figure and a track showing it against the period's lead count. */
function Rate({ label, value, of, note, unit = '', tone = 'c1', evidenceKey }) {
  const open = useContext(EvidenceContext);
  const shown = value != null && Number.isFinite(Number(value)) ? Number(value) : null;
  return (
    <div className="an-rate" role="button" tabIndex={0} onClick={() => open?.(evidenceKey, label, note)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open?.(evidenceKey, label, note); } }}>
      <span className="an-rate-label">{label} ↗</span>
      <strong className={shown == null ? 'an-empty' : ''}>{shown == null ? 'No data' : `${fmt(shown)}${unit}`}</strong>
      {of ? <Bullet value={pct(shown ?? 0, of)} tone={tone} label={`${label}: ${fmt(shown)}`} /> : null}
      <small>{note}</small>
    </div>
  );
}

export function SalesHealth({ health }) {
  if (!health) return null;
  const rows = (list, valueOf, noteOf) => (list ?? []).map((row) => ({
    label: row.label, value: valueOf(row), note: noteOf ? noteOf(row) : undefined
  }));
  return (
    <section className="an-panel" aria-labelledby="an-sales">
      <div className="an-head"><h2 id="an-sales">Sales health</h2><p>{health.scope}</p></div>
      <Metrics rows={health.metrics} />
      <div className="an-breakdowns">
        <Block title="Current Status · S1–S5">
          <HBars rows={rows(health.breakdowns.ladder, (row) => row.count)} />
        </Block>
        <Block title="Qualified → closed by salesperson">
          <HBars rows={rows(health.breakdowns.bySalesperson, (row) => row.rate ?? 0, (row) => `${row.closed} of ${row.count}`)}
            tone="c3" restTone="c2" suffix="%" />
        </Block>
        <Block title="Dropped value by reason">
          <HBars rows={rows(health.breakdowns.droppedReasons, (row) => row.value)} tone="c5" restTone="c5" />
        </Block>
        <Block title="Communication recency">
          <HBars rows={rows(health.breakdowns.noteAge, (row) => row.count)} tone="c4" restTone="c6" />
        </Block>
      </div>
    </section>
  );
}
