import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardCache, dashboardQuery, DASHBOARD_REFRESH_MS } from './dashboardCache.js';

test('equivalent filters share a key without mixing populations', () => {
  assert.equal(dashboardQuery('/api/dashboard', { psm: 'A', timeframe: 'monthly', empty: '' }),
    dashboardQuery('/api/dashboard', { timeframe: 'monthly', psm: 'A' }));
  assert.notEqual(dashboardQuery('/api/dashboard', { psm: 'A' }), dashboardQuery('/api/dashboard', { psm: 'B' }));
});
test('requests coalesce and cached navigation lasts 30 minutes', async () => {
  let clock = 1_000, requests = 0;
  const cache = createDashboardCache({ now: () => clock, fetcher: async () => {
    requests++; return { ok: true, json: async () => ({ records: [{ id: 'one' }] }) };
  } });
  await Promise.all([cache.read('/api/a'), cache.read('/api/a')]);
  assert.equal(requests, 1);
  clock += DASHBOARD_REFRESH_MS - 1;
  await cache.read('/api/a'); assert.equal(requests, 1);
  clock += 1;
  await cache.read('/api/a'); assert.equal(requests, 2);
});
test('manual refresh bypasses cache; failure retains last snapshot', async () => {
  let url, fails = false;
  const cache = createDashboardCache({ fetcher: async input => {
    url = input; if (fails) throw new Error('offline');
    return { ok: true, json: async () => ({ records: ['saved'] }) };
  } });
  const key = '/api/a?timeframe=monthly', initial = await cache.read(key);
  await cache.read(key, { force: true }); assert.equal(url, `${key}&refresh=1`);
  fails = true;
  await assert.rejects(cache.read(key, { force: true }), /offline/);
  assert.deepEqual(cache.peek(key).data, initial.data);
  assert.equal(cache.isFresh(cache.peek(key)), false);
});

test('IST midnight expires snapshots and never reuses yesterday after a failed read', async () => {
  let clock = Date.parse('2026-09-30T18:29:00Z'), fail = false;
  const cache = createDashboardCache({ now: () => clock, fetcher: async () => {
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => ({ records: ['yesterday'] }) };
  } });
  const entry = await cache.read('/api/dashboard?timeframe=daily');
  assert.equal(entry.expiresAt, Date.parse('2026-09-30T18:30:00Z'));
  clock = entry.expiresAt; fail = true;
  assert.equal(cache.peek('/api/dashboard?timeframe=daily'), null);
  await assert.rejects(cache.read('/api/dashboard?timeframe=daily'), /offline/);
  assert.equal(cache.peek('/api/dashboard?timeframe=daily'), null);
});

test('unavailable source timestamps remain unknown', async () => {
  const cache = createDashboardCache({ fetcher: async () => ({ ok: true, json: async () => ({ meta: { cache: { fetchedAt: null, stale: true } } }) }) });
  assert.equal((await cache.read('/api/a')).fetchedAt, null);
});
test('server source expiry is respected; stale data is never fresh', async () => {
  const now = Date.now();
  const cache = createDashboardCache({ now: () => now, fetcher: async () => ({ ok: true, json: async () => ({
    meta: { cache: { fetchedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now - 1).toISOString(), stale: true } },
  }) }) });
  const entry = await cache.read('/api/a');
  assert.equal(entry.fetchedAt, now - 1_000); assert.equal(cache.isFresh(entry), false);
});
