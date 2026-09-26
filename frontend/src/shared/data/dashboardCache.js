export const DASHBOARD_REFRESH_MS = 30 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;
const nextReportingDay = timestamp => (Math.floor((timestamp + IST_OFFSET) / 86_400_000) + 1) * 86_400_000 - IST_OFFSET;

export function dashboardQuery(endpoint, filters = {}) {
  const query = new URLSearchParams(Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b)));
  return `${endpoint}${query.size ? `?${query}` : ''}`;
}

// Memory only: no CRM records or credentials are persisted in browser storage.
// Shared reads survive a subscriber unmounting (including React StrictMode).
export function createDashboardCache({ fetcher = (...args) => fetch(...args), now = Date.now, maxEntries = 40 } = {}) {
  const entries = new Map(), pending = new Map();
  const peek = key => {
    const entry = entries.get(key);
    if (entry && entry.reportingUntil <= now()) { entries.delete(key); return null; }
    return entry ?? null;
  };
  const isFresh = entry => Boolean(entry && !entry.stale && entry.expiresAt > now());
  async function read(key, { force = false } = {}) {
    if (pending.has(key)) return pending.get(key);
    const saved = peek(key);
    if (!force && isFresh(saved)) return saved;
    const promise = (async () => {
      const url = force ? `${key}${key.includes('?') ? '&' : '?'}refresh=1` : key;
      const response = await fetcher(url);
      if (!response.ok) throw new Error('Dashboard data could not be loaded. Please retry.');
      const data = await response.json(), receivedAt = now(), metadata = data?.meta?.cache;
      const sourceTime = Date.parse(metadata?.fetchedAt), expiry = Date.parse(metadata?.expiresAt);
      const entry = {
        data, fetchedAt: Number.isFinite(sourceTime) ? sourceTime : metadata ? null : receivedAt,
        reportingUntil: nextReportingDay(receivedAt),
        expiresAt: Math.min(Number.isFinite(expiry) ? expiry : Infinity, receivedAt + DASHBOARD_REFRESH_MS, nextReportingDay(receivedAt)),
        stale: Boolean(metadata?.stale || data?.meta?.isDemo || data?.meta?.notice),
      };
      entries.delete(key); entries.set(key, entry);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return entry;
    })();
    pending.set(key, promise);
    try { return await promise; }
    catch (error) {
      if (saved) entries.set(key, { ...saved, stale: true });
      throw error;
    }
    finally { if (pending.get(key) === promise) pending.delete(key); }
  }
  return { peek, isFresh, read };
}

export const dashboardCache = createDashboardCache();
