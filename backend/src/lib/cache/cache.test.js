import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { dashboardCache } from './dashboardCache.js';
import { ReadCache, REFRESH_INTERVAL_MS, recordReadFailure, recordSourceRead } from './readCache.js';

async function serverFor(t, handler, options) {
  const app = express();
  app.use('/api', dashboardCache(options));
  app.get('/api/sales-efficiency', handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  t.after(() => new Promise((done) => server.close(done)));
  return async (query = '') => (await fetch(`http://127.0.0.1:${server.address().port}/api/sales-efficiency${query}`)).json();
}

test('source cache shares reads, expires at 30 minutes, and force refresh is scoped', async () => {
  let now = 1000, reads = 0;
  const cache = new ReadCache({ now: () => now });
  const load = async () => { reads++; await new Promise((r) => setTimeout(r, 5)); return reads; };
  await Promise.all([cache.get('a', load), cache.get('a', load)]);
  assert.equal(reads, 1);
  await cache.get('b', load);
  now += REFRESH_INTERVAL_MS - 1;
  await cache.get('a', load); assert.equal(reads, 2);
  await cache.get('a', load, { force: true }); assert.equal(reads, 3);
  await cache.get('b', load); assert.equal(reads, 3);
  now += 2;
  await cache.get('b', load); assert.equal(reads, 4);
});

test('responses reuse complete payload and singleflight, respecting query and manual refresh', async (t) => {
  let now = 1000, reads = 0;
  const get = await serverFor(t, async (req, res) => {
    reads++; await new Promise((r) => setTimeout(r, 15));
    res.json({ value: reads, meta: { period: req.query.timeframe } });
  }, { now: () => now });
  const pair = await Promise.all([get('?timeframe=monthly'), get('?timeframe=monthly')]);
  assert.equal(reads, 1); assert.equal(pair[0].value, pair[1].value);
  const hit = await get('?timeframe=monthly');
  assert.equal(hit.meta.cache.status, 'hit'); assert.equal(hit.meta.period, 'monthly');
  await get('?timeframe=quarterly'); assert.equal(reads, 2);
  await get('?timeframe=monthly&refresh=1'); assert.equal(reads, 3);
  await get('?timeframe=quarterly'); assert.equal(reads, 3);
  now += REFRESH_INTERVAL_MS;
  await get('?timeframe=monthly'); assert.equal(reads, 4);
});

test('failed refresh retains last good timestamp and marks stale; cold failure not cached', async (t) => {
  let now = 1000, fail = false, reads = 0;
  const get = await serverFor(t, (_req, res) => {
    reads++; if (fail) recordReadFailure();
    res.json({ value: fail ? 0 : 24 });
  }, { now: () => now });
  const good = await get(); fail = true; now += 50;
  const stale = await get('?refresh=1');
  assert.equal(stale.value, 24); assert.equal(stale.meta.cache.stale, true);
  assert.equal(stale.meta.cache.fetchedAt, good.meta.cache.fetchedAt);
  const bad = await get('?city=new');
  assert.equal(bad.meta.cache.status, 'unavailable'); assert.equal(bad.meta.cache.fetchedAt, null);
  await get('?city=new'); assert.equal(reads, 4);
});

test('response expiry follows oldest source, not date of mapping', async (t) => {
  const now = 100000;
  const get = await serverFor(t, (_req, res) => { recordSourceRead(1000); res.json({ value: 3 }); }, { now: () => now });
  const body = await get();
  assert.equal(body.meta.cache.fetchedAt, new Date(1000).toISOString());
  assert.equal(body.meta.cache.expiresAt, new Date(1000 + REFRESH_INTERVAL_MS).toISOString());
});

test('relative dashboard cache rolls over at IST midnight and never falls back to yesterday', async (t) => {
  let now = Date.parse('2026-09-30T18:29:50Z'), reads = 0, fail = false;
  const get = await serverFor(t, (_req, res) => {
    reads++;
    if (fail) recordReadFailure();
    res.json({ periodDay: new Date(now + 5.5 * 3600000).toISOString().slice(0, 10) });
  }, { now: () => now, timeZone: 'Asia/Kolkata' });
  const before = await get('?timeframe=daily');
  assert.equal(before.meta.cache.expiresAt, '2026-09-30T18:30:00.000Z');
  assert.equal((await get('?timeframe=daily')).meta.cache.status, 'hit');
  now += 11000; fail = true;
  const after = await get('?timeframe=daily');
  assert.equal(reads, 2);
  assert.equal(after.periodDay, '2026-10-01');
  assert.equal(after.meta.cache.status, 'unavailable');
});

test('source cache refreshes at reporting midnight even within its 30-minute TTL', async () => {
  const { nextReportingDayAt } = await import('./reportingDay.js');
  let now = Date.parse('2026-09-30T18:29:50Z'), reads = 0;
  const cache = new ReadCache({ now: () => now, expiresAtLimit: (at) => nextReportingDayAt(at, 'Asia/Kolkata') });
  const load = async () => ++reads;
  const before = await cache.get('Contacts', load);
  assert.equal(before.expiresAt, Date.parse('2026-09-30T18:30:00Z'));
  now += 9000; await cache.get('Contacts', load); assert.equal(reads, 1);
  now += 1000; await cache.get('Contacts', load); assert.equal(reads, 2);
  assert.equal(nextReportingDayAt(Date.parse('2026-03-08T05:00:00Z'), 'America/New_York'), Date.parse('2026-03-09T04:00:00Z'));
});
