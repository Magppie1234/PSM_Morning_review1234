import { AsyncLocalStorage } from 'node:async_hooks';

export const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const context = new AsyncLocalStorage();
export const readContext = () => context.getStore();
export const withReadContext = (state, run) => context.run(state, run);
export function recordSourceRead(fetchedAt) {
  const state = readContext();
  if (state) state.fetchedAt = Math.min(state.fetchedAt, fetchedAt);
}
export function recordReadFailure() {
  const state = readContext();
  if (state) state.degraded = true;
}

// Per-process cache: pending requests share the same read without refreshing OAuth.
export class ReadCache {
  constructor({ ttl = REFRESH_INTERVAL_MS, maxEntries = 1000, now = Date.now, expiresAtLimit = () => Infinity } = {}) {
    this.ttl = ttl; this.maxEntries = maxEntries; this.now = now; this.expiresAtLimit = expiresAtLimit;
    this.entries = new Map(); this.pending = new Map();
  }
  clear() { this.entries.clear(); }
  async get(key, load, { force = false } = {}) {
    const entry = this.entries.get(key);
    if (!force && entry && entry.expiresAt > this.now()) return entry;
    if (this.pending.has(key)) return this.pending.get(key);
    const pending = Promise.resolve().then(load).then((data) => {
      const fetchedAt = this.now();
      const value = { data, fetchedAt, expiresAt: Math.min(fetchedAt + this.ttl, this.expiresAtLimit(fetchedAt)) };
      this.entries.delete(key); this.entries.set(key, value);
      while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
      return value;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, pending);
    return pending;
  }
}
