import test from 'node:test';
import assert from 'node:assert/strict';
import { leadTat, summarizeTat } from './leadTat.js';
import { buildLeadFlow, missingLeadFields } from './leadFlow.js';
import { buildDashboardFromLeads } from './leadMapper.js';
const start = Date.parse('2026-09-01T00:00:00Z');
const lead = (id, extra = {}) => ({ id, Created_Time: new Date(start).toISOString(), Owner: { name: 'Deepak' }, Company: 'Client', ...extra });
const call = (id, hours, extra = {}) => ({ Who_Id: { id }, Owner: { name: 'Deepak' }, Call_Type: 'Outbound', Call_Duration_in_seconds: 30, Call_Start_Time: new Date(start + hours * 3600000).toISOString(), ...extra });
test('TAT boundaries, earliest valid connection and missing evidence', () => {
  const leads = ['on', 'late', 'waiting', 'unknown'].map((id) => lead(id));
  leads[3].Created_Time = 'invalid';
  const calls = [call('on', 12), call('on', 16), call('on', -1), call('late', 15),
    call('late', 2, { Call_Duration_in_seconds: 0 }), call('late', 1, { Owner: { name: 'Other' } }),
    call('late', 3, { Outgoing_Call_Status: 'Scheduled' }), call('late', 4, { Call_Type: 'Missed' }), call('waiting', 50)];
  const result = leadTat(leads, calls, start + 24 * 3600000);
  assert.equal(result.get('on').state, 'onTime');
  assert.equal(result.get('late').hours, 15);
  assert.equal(result.get('late').excessHours, 3);
  assert.equal(result.get('waiting').state, 'overdue');
  assert.equal(result.get('unknown').state, 'unknown');
  assert.equal(leadTat([lead('pending')], [], start + 6 * 3600000).get('pending').state, 'pending');
  assert.equal(leadTat([lead('on')], null, start + 24 * 3600000).get('on').state, 'unknown');
  assert.equal(summarizeTat([...result.values()]).maxExcessHours, 12);
});
test('Missing Info includes early stages and excludes later funnel stages', () => {
  const rows = [lead('blank', { Lead_Status: 'Under follow-up', State1: '  ' }),
    lead('present', { Lead_Status: 'No Response', State1: 'Delhi', Modified_Time: '2026-09-01T01:00:00Z' }),
    lead('awaited', { Lead_Status: 'Qualified / Drawings Awiated', State1: null }),
    lead('dropped', { Lead_Status: 'Not Interested' }),
    lead('untouched', { Lead_Status: 'Not Contacted Yet' }),
    lead('later', { Lead_Status: 'Drawing Received' }),
    lead('converted', { Lead_Status: 'Under follow-up', Converted__s: true })];
  const result = buildLeadFlow(rows, [], 'previous', { missingFieldsOf: (row) => missingLeadFields(row, { tat: { contactedAt: '2026-09-01T01:00:00Z' }, lastContact: { at: '2026-09-01T01:00:00Z' } }) });
  assert.deepEqual(result.nodes.missingInfo.ids.sort(), ['awaited', 'blank', 'dropped', 'untouched']);
  assert.equal(result.nodes.raw.count, rows.length);
  assert.equal(result.nodes.contacted.count + result.nodes.notContacted.count, rows.length);
  assert.equal(result.nodes.missingInfo.byCity.reduce((sum, row) => sum + row.count, 0), 4);
});
test('dashboard TAT performance totals reconcile with its lead drilldown', () => {
  const rows = [lead('one', { Lead_Status: 'Under follow-up' }), lead('two', { Lead_Status: 'Not Contacted Yet' })];
  const dashboard = buildDashboardFromLeads(rows, 'Deepak', 'month:2026-09', new Map(), [], [], [call('one', 14)]);
  const row = dashboard.performance.find((item) => item.psm === 'Deepak');
  assert.equal(row.tat.late, 1);
  assert.equal(dashboard.leads.find((item) => item.id === 'one').tat.excessHours, 2);
  assert.equal(Object.entries(row.tat).filter(([key]) => key !== 'maxExcessHours').reduce((sum, [, value]) => sum + value, 0), row.leads);
});

test('missing fields match each early-stage table rather than unrelated CRM fields', () => {
  const complete = lead('full', { State1: 'Delhi', Lead_Status: 'Under Follow Up', Modified_Time: '2026-09-01T01:00:00Z' });
  const activity = { lastContact: { at: '2026-09-01T01:00:00Z' }, tat: { contactedAt: '2026-09-01T01:00:00Z' } };
  assert.deepEqual(missingLeadFields(complete, activity), []); // No source/product/reassignment/attempt count required.
  assert.deepEqual(missingLeadFields({ ...complete, State1: '  ', Modified_Time: null }, activity), ['state', 'modifiedAt']);
  assert.deepEqual(missingLeadFields(complete), ['tat', 'lastContact']);
  assert.deepEqual(missingLeadFields(complete, { callsAvailable: false }), []);
  assert.deepEqual(missingLeadFields({ ...complete, Lead_Status: 'Junk Lead', Modified_Time: null }), ['reason']);
  assert.deepEqual(missingLeadFields({ ...complete, Lead_Status: 'Junk Lead', Dead_Reason: 'Budget Issue' }), []);
  assert.deepEqual(missingLeadFields({ ...complete, Lead_Status: 'Drawing Received', State1: null }), []);
  assert.deepEqual(missingLeadFields({ ...complete, Converted__s: true, State1: null }), []);
});
