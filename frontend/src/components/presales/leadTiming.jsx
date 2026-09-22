// Timing cells for lead tables: how long a lead has sat in its status, when it was created, and when it was
// last modified in Zoho. Times are shown in IST.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NA = <span className="lf-na">NA</span>;

const stamp = (iso, withYear = false) => new Date(iso).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit', hour12: true
});

// "5h 20m" under a day; "1 day + 3h 12m" once it passes 24 hours.
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const rest = `${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m`;
  return days ? `${days} day${days === 1 ? '' : 's'} + ${rest}` : rest;
}

// Time since the lead entered its current status (Zoho Lead Status History); a lead whose status never
// changed has been in it since it was created.
export const statusAge = (lead, now = Date.now()) => {
  const since = lead.statusSince ?? lead.createdAt;
  return since ? now - Date.parse(since) : null;
};

// Buckets used by the chart view.
export const AGE_BUCKETS = [
  { key: 'fresh', label: 'Under 24 hrs', test: (ms) => ms < DAY },
  { key: 'day', label: '1–2 days', test: (ms) => ms >= DAY && ms < 2 * DAY },
  { key: 'late', label: '2+ days', test: (ms) => ms >= 2 * DAY }
];
export const ageBucket = (ms) => AGE_BUCKETS.find((bucket) => bucket.test(ms))?.key ?? null;

// `flagLate` is off for end states (dropped / dead), where sitting in the status is expected.
export function TimeInStatus({ lead, flagLate = true }) {
  const age = statusAge(lead);
  if (age === null) return NA;
  const late = flagLate && age >= DAY;
  const since = lead.statusSince ?? lead.createdAt;
  return (
    <span className={late ? 'lt-late' : 'lt-ok'} title={`"${lead.status}" since ${stamp(since, true)}${late ? ' · more than 24 hours' : ''}`}>
      {formatDuration(age)}
    </span>
  );
}

export function CreatedCell({ lead }) {
  if (!lead.createdAt) return NA;
  return (
    <span className="lt-stack">
      <span>{stamp(lead.createdAt, true)}</span>
      {lead.afterHours && <em className="lt-tag">After hours</em>}
    </span>
  );
}

export function ModifiedCell({ lead }) {
  if (!lead.modifiedAt) return NA;
  return (
    <span className="lt-stack" title={`Last modified in Zoho${lead.modifiedBy ? ` by ${lead.modifiedBy}` : ''}; status now "${lead.status}"`}>
      <span>{stamp(lead.modifiedAt)}</span>
      <small>{lead.status}{lead.modifiedBy ? ` · by ${lead.modifiedBy}` : ''}</small>
    </span>
  );
}

// Last real call on the lead from Zoho's call log: when, which way, how long the talk lasted, how many calls.
const talk = (seconds) => (seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`);
export function LastContactCell({ lead }) {
  const call = lead.lastContact;
  if (!call) return <span className="lf-na" title="No call logged in Zoho for this lead">No call logged</span>;
  const connected = call.seconds > 0;
  const kind = call.type === 'Inbound' ? 'Incoming' : call.type === 'Missed' ? 'Missed call' : 'Outgoing';
  const ago = formatDuration(Date.now() - Date.parse(call.at));
  return (
    <span className="lt-stack" title={`Last call ${stamp(call.at, true)}${call.by ? ` by ${call.by}` : ''} · ${ago} ago · ${call.count} call${call.count === 1 ? '' : 's'} logged`}>
      <span>{stamp(call.at)}</span>
      <small>
        {kind}
        {call.type !== 'Missed' && (connected ? ` · ${talk(call.seconds)} talk` : ' · not connected')}
        {call.count > 1 ? ` · ${call.count} calls` : ''}
      </small>
    </span>
  );
}

// Call attempts the PSM has placed on the lead, against the policy limit of 15.
export const MAX_ATTEMPTS = 15;
export function AttemptsCell({ lead }) {
  const attempts = lead.lastContact?.attempts ?? 0;
  const tone = attempts >= MAX_ATTEMPTS ? 'lt-late' : attempts >= MAX_ATTEMPTS - 3 ? 'lt-warn' : 'lt-ok';
  const note = attempts >= MAX_ATTEMPTS ? 'Limit reached' : `${MAX_ATTEMPTS - attempts} left`;
  return (
    <span className="lt-stack" title={`${attempts} outgoing call${attempts === 1 ? '' : 's'} logged; the limit is ${MAX_ATTEMPTS} per lead`}>
      <span className={tone}>{attempts} / {MAX_ATTEMPTS}</span>
      <span className="lt-meter" aria-hidden="true"><b className={tone} style={{ width: `${Math.min(100, (attempts / MAX_ATTEMPTS) * 100)}%` }} /></span>
      <small>{note}</small>
    </span>
  );
}
