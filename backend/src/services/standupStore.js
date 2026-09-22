import { readJson, writeJson } from '../lib/dataStore.js';

// Meeting decisions (due dates, closed queries, who was discussed), kept in DATA_DIR.
const STATE_FILE = '.standup_state.json';

export function loadStandupState() {
  const saved = readJson(STATE_FILE);
  return { firstSeen: saved?.firstSeen ?? {}, queries: saved?.queries ?? {} };
}

// Strict: a decision the user just made must not be silently lost.
export function saveStandupState(state) {
  writeJson(STATE_FILE, state, { strict: true, pretty: true });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['open', 'done']);

// Validates a meeting update from the browser; returns { error } or { update }.
export function parseQueryUpdate(body = {}) {
  const update = {};
  if ('dueDate' in body) {
    if (body.dueDate !== null && !(typeof body.dueDate === 'string' && DATE.test(body.dueDate))) return { error: 'dueDate must be YYYY-MM-DD or null' };
    update.dueDate = body.dueDate;
  }
  if ('status' in body) {
    if (!STATUSES.has(body.status)) return { error: 'status must be open or done' };
    update.status = body.status;
  }
  if ('discussed' in body) {
    if (typeof body.discussed !== 'boolean') return { error: 'discussed must be true or false' };
    update.discussed = body.discussed;
  }
  if (!Object.keys(update).length) return { error: 'Nothing to update' };
  return { update };
}

export function applyQueryUpdate(state, key, update, today) {
  const current = state.queries[key] ?? {};
  const next = { ...current };
  if ('dueDate' in update) {
    next.dueDate = update.dueDate;
    next.promisedOn = update.dueDate ? today : null;
  }
  if ('status' in update) {
    next.status = update.status;
    next.closedOn = update.status === 'done' ? today : null;
  }
  if ('discussed' in update) next.discussedOn = update.discussed ? today : null;
  state.queries[key] = next;
  return state;
}
