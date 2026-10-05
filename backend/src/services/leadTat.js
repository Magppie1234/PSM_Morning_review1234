import { PSM_NAMES } from '../config/roster.js';

export const TAT_HOURS = 12;
export const linkedLeadId = (row, ids) => [row?.What_Id?.id, row?.Who_Id?.id, row?.Parent_Id?.id]
  .filter((id) => id != null).map(String).find((id) => ids.has(id));

// Elapsed clock hours from creation to the first verified PSM connection, including
// calls after the reporting window. A status change alone does not prove contact.
export function leadTat(leads, calls, now = Date.now()) {
  const byId = new Map(leads.map((lead) => [String(lead.id), lead]));
  const first = new Map();
  for (const call of calls ?? []) {
    const id = linkedLeadId(call, byId);
    const at = Date.parse(call.Call_Start_Time ?? call.Created_Time);
    const created = Date.parse(byId.get(id)?.Created_Time);
    if (!id || !PSM_NAMES.has(call.Owner?.name) || !['Inbound', 'Outbound'].includes(call.Call_Type) ||
      !(Number(call.Call_Duration_in_seconds) > 0) || !Number.isFinite(at) ||
      !Number.isFinite(created) || at < created || at > now ||
      /scheduled/i.test(`${call.Outgoing_Call_Status ?? ''} ${call.Subject ?? ''}`)) continue;
    if (!first.has(id) || at < first.get(id)) first.set(id, at);
  }
  return new Map(leads.map((lead) => {
    const id = String(lead.id);
    const created = Date.parse(lead.Created_Time);
    const at = first.get(id);
    const known = calls != null && Number.isFinite(created) && created <= now;
    const hours = known ? ((at ?? now) - created) / 3_600_000 : null;
    return [id, { hours, contactedAt: at == null ? null : new Date(at).toISOString(),
      state: !known ? 'unknown' : at != null ? (hours <= TAT_HOURS ? 'onTime' : 'late') : hours > TAT_HOURS ? 'overdue' : 'pending',
      excessHours: hours == null ? null : Math.max(0, hours - TAT_HOURS) }];
  }));
}

export function summarizeTat(rows) {
  const result = { onTime: 0, late: 0, overdue: 0, pending: 0, unknown: 0, maxExcessHours: 0 };
  for (const row of rows) {
    result[row.state] += 1;
    result.maxExcessHours = Math.max(result.maxExcessHours, row.excessHours ?? 0);
  }
  return result;
}
