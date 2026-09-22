import { useEffect, useState } from 'react';
import { API_URL } from '../../lib/api.js';

// "Reassigned to (by whom)" for lead tables. Read from each lead's Zoho Timeline on demand, since the lead
// record itself only keeps the current owner. The company account is Zoho's automatic assignment.
const COMPANY_ACCOUNT = 'Magppie Living Private Limited';
const who = (name) => (!name ? 'unknown' : name === COMPANY_ACCOUNT ? 'auto-assignment' : name);
const stamp = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

export function useReassignments(ids, enabled) {
  const [state, setState] = useState({ key: '', data: {}, loading: false });
  const key = enabled ? ids.slice(0, 100).join(',') : '';
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    // Keep what is already loaded (e.g. the first page) while the next rows are read.
    setState((current) => ({ key, data: current.data ?? {}, loading: true }));
    fetch(`${API_URL}/api/lead-reassignments?ids=${key}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((data) => setState((current) => ({ key, data: { ...(current.data ?? {}), ...data }, loading: false })))
      .catch((error) => { if (error.name !== 'AbortError') setState({ key, data: null, loading: false }); });
    return () => controller.abort();
  }, [key]);
  return state;
}

export function ReassignedCell({ entry, loading }) {
  if (!entry && loading) return <span className="lf-na">Checking Zoho…</span>;
  if (!entry || entry.error) return <span className="lf-na" title="The Zoho timeline for this lead could not be read">NA</span>;
  const { latest, count, assigned } = entry;
  if (!latest) {
    return (
      <span className="lt-stack" title={assigned ? `First assigned ${stamp(assigned.at)} by ${assigned.by}` : undefined}>
        <span className="lf-na">Not reassigned</span>
        {assigned && <small>Assigned on arrival ({who(assigned.by)})</small>}
      </span>
    );
  }
  return (
    <span className="lt-stack" title={`${latest.from ?? 'Unknown'} → ${latest.to} on ${stamp(latest.at)} by ${latest.by ?? 'unknown'}${count > 1 ? ` · reassigned ${count} times in all` : ''}`}>
      <span><strong>{latest.to}</strong> ({who(latest.by)})</span>
      <small>from {latest.from ?? 'unknown'} · {stamp(latest.at)}{count > 1 ? ` · ${count}× reassigned` : ''}</small>
    </span>
  );
}
