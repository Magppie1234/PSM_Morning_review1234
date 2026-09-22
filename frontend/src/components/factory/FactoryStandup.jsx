import { Info, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { useDashboard } from '../../hooks/useDashboard.js';
import { API_URL } from '../../lib/api.js';
import { BoardSkeleton } from '../presales/BoardSkeleton.jsx';
import { DesignerFocus } from './DesignerFocus.jsx';
import { MaterialTat } from './MaterialTat.jsx';
import { RollCall } from './RollCall.jsx';
import { DispatchHolds, ShareSummary, TeamPattern } from './StandupSide.jsx';
import { PeriodFilter } from '../PeriodFilter.jsx';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Stat({ label, value, note, tone = '' }) {
  return (
    <div className="fs-stat">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {note && <em>{note}</em>}
    </div>
  );
}

function PromiseLine({ data }) {
  const { promises, meta } = data;
  if (!promises.made) {
    return (
      <p className="fs-promise quiet">
        <Info size={15} aria-hidden="true" />
        {meta.hasHistory
          ? `No promises were due yesterday.${promises.dueToday ? ` ${promises.dueToday} due today.` : ''}`
          : 'Promise tracking starts today. Set a due date on each query during the meeting; tomorrow this line shows what was delivered.'}
      </p>
    );
  }
  return (
    <p className={`fs-promise${promises.missed.length ? ' warn' : ' ok'}`}>
      <strong>Yesterday's promises: {promises.made} made · {promises.delivered} delivered · {promises.missed.length} missed</strong>
      {promises.missed.length > 0 && <span>Missed: {promises.missed.map((item) => `${item.designer} (MPP ${item.mpp})`).join(', ')}</span>}
      {promises.dueToday > 0 && <span>{promises.dueToday} due today</span>}
    </p>
  );
}

function OlderNote({ older }) {
  if (!older?.count) return null;
  return (
    <p className="fs-promise quiet">
      <Info size={15} aria-hidden="true" />
      {older.count} older open {older.count === 1 ? 'query is' : 'queries are'} outside this period (logged {shortDate(older.oldest)}
      {older.newest !== older.oldest ? ` – ${shortDate(older.newest)}` : ''}) and not shown.
    </p>
  );
}

function EmptyPeriod({ label }) {
  return (
    <section className="ps-panel fs-empty">
      <h2>No factory queries logged in this period</h2>
      <p>{label}. New rows added to the planning sheet with a date in this window will appear here.</p>
    </section>
  );
}

export function FactoryStandup({ timeframe, onTimeframe }) {
  const initial = useDashboard({ timeframe }, '/api/factory-standup');
  const [fresh, setFresh] = useState(null);
  const [view, setView] = useState('standup');
  const [focusName, setFocusName] = useState(null);
  const [meetingStartedAt, setMeetingStartedAt] = useState(null);
  // The running order is frozen when the meeting starts so closing a query doesn't reshuffle it.
  const [meetingOrder, setMeetingOrder] = useState(null);
  const [focusStartedAt, setFocusStartedAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  const data = fresh ?? initial.data;
  if (!data) {
    if (initial.loading) return <BoardSkeleton />;
    return <div className="screen-message error">{initial.error || 'Factory stand-up could not be loaded.'}<span>Make sure the backend is running on port 4010.</span></div>;
  }

  const designers = meetingOrder
    ? [
        ...meetingOrder.map((name) => data.designers.find((designer) => designer.name === name)).filter(Boolean),
        ...data.designers.filter((designer) => !meetingOrder.includes(designer.name))
      ]
    : data.designers;
  const focus = designers.find((designer) => designer.name === focusName) ?? designers[0];
  const position = focus ? designers.indexOf(focus) + 1 : 0;

  const choose = (name) => {
    setFocusName(name);
    setFocusStartedAt(Date.now());
  };

  const save = async (keys, body) => {
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/factory-standup/queries?timeframe=${encodeURIComponent(timeframe)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, ...body })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The decision could not be saved.');
      setFresh(payload);
      setSaveError('');
      return true;
    } catch (error) {
      setSaveError(`${error.message} Try again.`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    const openKeys = data.queries.filter((query) => query.designer === focus.name && query.status !== 'done').map((query) => query.key);
    if (meetingStartedAt && openKeys.length && !focus.discussedToday) await save(openKeys, { discussed: true });
    choose(designers[position % designers.length].name);
  };

  const toggleMeeting = () => {
    if (meetingStartedAt) {
      setMeetingStartedAt(null);
      setMeetingOrder(null);
      return;
    }
    setMeetingStartedAt(Date.now());
    setMeetingOrder(designers.map((designer) => designer.name));
    choose(designers[0]?.name);
  };

  const { summary, meta } = data;

  return (
    <div className="ps fs">
      <header className="ps-head">
        <div>
          <h1>Designer stand-up</h1>
          <p className="ps-sub">
            <span>{meta.reportLabel}</span>
            <span>Factory queries and dispatch holds</span>
            <span className="fs-source" title={meta.source}>From the planning, dispatch and CHI sheets</span>
          </p>
        </div>
        <div className="ps-controls">
          <PeriodFilter
            value={timeframe}
            onChange={(value) => {
              setFresh(null);
              setMeetingStartedAt(null);
              setMeetingOrder(null);
              onTimeframe(value);
            }}
          />
          <div className="fs-switch" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'standup'} onClick={() => setView('standup')}>Stand-up</button>
            <button type="button" aria-pressed={view === 'tat'} onClick={() => setView('tat')}>Material TAT</button>
          </div>
          {view === 'standup' && designers.length > 0 && (
            <button type="button" className={meetingStartedAt ? 'fs-mini' : 'fs-primary'} onClick={toggleMeeting}>
              {meetingStartedAt ? <><Square size={13} aria-hidden="true" /> End meeting</> : <><Play size={13} aria-hidden="true" /> Start meeting</>}
            </button>
          )}
        </div>
      </header>

      {view === 'tat' ? (
        <MaterialTat tat={data.materialTat} />
      ) : (
        <>
          <section className="fs-stats" aria-label="Factory summary">
            <Stat label="Open queries" value={summary.open} note={summary.newToday ? `+${summary.newToday} new today` : null} />
            <Stat label="Closed yesterday" value={summary.closedYesterday ?? '—'} note={summary.closedYesterday === null ? `Tracking since ${shortDate(meta.trackingSince)}` : null} />
            <Stat label="Vehicles held" value={summary.vehiclesHeld} tone={summary.vehiclesHeld ? 'ps-danger-text' : ''} />
            <Stat label="Oldest open query" value={summary.oldestDays === null ? '—' : `${summary.oldestDays} days`} />
          </section>

          <PromiseLine data={data} />
          <OlderNote older={meta.olderOpen} />
          {saveError && <p className="ps-notice" role="alert">{saveError}</p>}

          <div className="fs-layout">
            <div className="fs-main">
              {designers.length === 0 && <EmptyPeriod label={meta.reportLabel} />}
              {designers.length > 0 && <RollCall designers={designers} focus={focus?.name} onFocus={choose} hasHistory={meta.hasHistory} frozen={Boolean(meetingOrder)} />}
              <DesignerFocus
                designer={focus}
                queries={data.queries.filter((query) => query.designer === focus?.name)}
                position={position}
                total={designers.length}
                today={meta.today}
                meetingStartedAt={meetingStartedAt}
                focusStartedAt={focusStartedAt}
                onSave={save}
                onNext={next}
                busy={busy}
              />
            </div>
            <aside className="fs-side">
              <DispatchHolds holds={data.dispatchHolds} />
              <TeamPattern pattern={data.teamPattern} />
              <ShareSummary data={data} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
