import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../lib/api.js';
import { DASHBOARD_REFRESH_MS, dashboardCache, dashboardQuery } from '../shared/data/dashboardCache.js';

export { API_URL };

const stateFor = (key, entry, enabled) => ({
  key, data: entry?.data ?? null, error: '', loading: enabled && !entry,
  refreshing: false, fetchedAt: entry?.fetchedAt != null ? new Date(entry.fetchedAt) : null,
  expiresAt: entry ? new Date(entry.expiresAt) : null, stale: Boolean(entry?.stale),
});

export function useDashboard(filters, endpoint = '/api/dashboard', enabled = true) {
  const key = dashboardQuery(`${API_URL}${endpoint}`, filters);
  const [state, setState] = useState(() => stateFor(key, dashboardCache.peek(key), enabled));
  const [reload, setReload] = useState(0);
  const forceNext = useRef(false);
  const refresh = useCallback(() => { forceNext.current = true; setReload(n => n + 1); }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false, timer;
    const schedule = entry => {
      clearTimeout(timer);
      const wait = entry?.stale ? DASHBOARD_REFRESH_MS : Math.max(1_000, (entry?.expiresAt ?? 0) - Date.now());
      timer = setTimeout(() => { if (document.visibilityState !== 'hidden') run(); }, entry ? wait : DASHBOARD_REFRESH_MS);
    };
    async function run(force = false) {
      const saved = dashboardCache.peek(key);
      if (!force && dashboardCache.isFresh(saved)) {
        if (!disposed) { setState(stateFor(key, saved, true)); schedule(saved); }
        return;
      }
      setState({ ...stateFor(key, saved, true), refreshing: Boolean(saved) });
      try {
        const entry = await dashboardCache.read(key, { force });
        if (!disposed) { setState(stateFor(key, entry, true)); schedule(entry); }
      } catch (error) {
        if (!disposed) {
          setState({ ...stateFor(key, saved, false), error: error.message, stale: Boolean(saved) });
          schedule(null);
        }
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !dashboardCache.isFresh(dashboardCache.peek(key))) run();
    };
    const force = forceNext.current;
    forceNext.current = false;
    run(force);
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [key, enabled, reload]);

  // Do not render the previous filter's records while the new effect is starting.
  const current = state.key === key ? state : stateFor(key, dashboardCache.peek(key), enabled);
  return { ...current, refresh };
}

