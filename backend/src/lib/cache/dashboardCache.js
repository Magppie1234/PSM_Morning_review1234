import { config } from '../../config/env.js';
import { nextReportingDayAt, reportingDay } from './reportingDay.js';
import { REFRESH_INTERVAL_MS, withReadContext } from './readCache.js';

const PATHS = new Set(['/dashboard', '/sales-funnel', '/sales-efficiency', '/pre-design-funnel', '/post-design-dashboard', '/pdi-dashboard', '/sales-dashboard', '/design-dashboard', '/dispatch-dashboard', '/installation-dashboard', '/ams-dashboard']);

// Cache the complete mapped response as well as source pages. Query variants retain their
// own populations; manual refresh bypasses only this request's sources, never other boards.
export function dashboardCache({ now = Date.now, maxEntries = 80, timeZone = config.zoho.timezone } = {}) {
  const entries = new Map();
  const pending = new Map();
  function reply(response, item, status) {
    const stale = item.stale || now() >= item.expiresAt;
    response.set('Cache-Control', 'no-store');
    response.set('X-Dashboard-Cache', status);
    return response.status(item.status).json({ ...item.body, meta: { ...item.body.meta, cache: {
      fetchedAt: item.fetchedAt ? new Date(item.fetchedAt).toISOString() : null,
      expiresAt: new Date(item.expiresAt).toISOString(), refreshIntervalMs: REFRESH_INTERVAL_MS,
      refreshAfterMs: Math.max(0, item.expiresAt - now()), stale, status,
    } } });
  }
  return (request, response, next) => {
    if (request.method !== 'GET' || !PATHS.has(request.path)) return next();
    const query = new URLSearchParams(request.query); query.delete('refresh'); query.sort();
    const requestedAt = now();
    const dayEndsAt = nextReportingDayAt(requestedAt, timeZone);
    const key = `${reportingDay(requestedAt, timeZone)}:${request.path}?${query}`;
    const force = request.query.refresh === '1';
    const cached = entries.get(key);
    if (!force && cached && cached.expiresAt > now()) return reply(response, cached, cached.stale ? 'stale' : 'hit');
    if (pending.has(key)) {
      pending.get(key).then((item) => reply(response, item, item.stale ? 'stale' : 'shared'));
      return;
    }
    let resolve;
    pending.set(key, new Promise((done) => { resolve = done; }));
    const state = { force, fetchedAt: now(), degraded: false };
    const originalJson = response.json.bind(response);
    response.json = (body) => {
      response.json = originalJson;
      const failed = response.statusCode >= 400 || state.degraded || Boolean(body?.meta?.notice);
      const item = failed && cached ? { ...cached, stale: true } : {
        body, status: response.statusCode, fetchedAt: failed ? null : state.fetchedAt,
        expiresAt: failed ? now() : Math.min(dayEndsAt, state.fetchedAt + REFRESH_INTERVAL_MS), stale: failed,
      };
      if (failed && cached) entries.set(key, item);
      if (!failed) {
        entries.delete(key); entries.set(key, item);
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      }
      pending.delete(key); resolve(item);
      return reply(response, item, failed ? (cached ? 'stale' : 'unavailable') : force ? 'refreshed' : 'miss');
    };
    withReadContext(state, next);
  };
}
