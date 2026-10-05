import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreSalesAnalytics, buildPreSalesTrend } from './preSalesAnalytics.js';
import { buildSalesHealth } from './salesHealth.js';

const tf = { start: '2026-09-01', end: '2026-09-30', reportLabel: 'September 2026',
  matches: (value) => String(value ?? '').startsWith('2026-09') };
const m = (rows, key) => rows.find((row) => row.key === key);

test('Pre-Sales rates use the lead cohort and linked CRM activity', () => {
  const leads = [
    { id: '1', Owner: { name: 'Deepak' }, Company: 'Client One', Created_Time: '2026-09-02T10:00:00+05:30',
      Lead_Status: 'Drawing Received', Lead_Source: 'Walk In', Converted__s: true },
    { id: '2', Owner: { name: 'Deepak' }, Company: 'Client Two', Created_Time: '2026-09-03T10:00:00+05:30',
      Lead_Status: 'Not Contacted Yet', Lead_Source: 'Scanner' },
    { id: '3', Owner: { name: 'Deepak' }, Company: 'Sunrooof project', Created_Time: '2026-09-03T10:00:00+05:30',
      Lead_Status: 'Drawing Received', Product_Requirement: 'Sunroof' }
  ];
  const calls = [{ Who_Id: { id: '1' }, What_Id: { id: 'unrelated' }, Call_Type: 'Outbound',
    Call_Start_Time: '2026-09-02T11:00:00+05:30', Created_Time: '2026-09-02T11:00:00+05:30',
    Owner: { name: 'Deepak' }, Call_Duration_in_seconds: 120 }];
  const tasks = [{ Who_Id: { id: '2' }, What_Id: { id: 'unrelated' }, Due_Date: '2026-09-10', Status: 'Not Started' }];
  const result = buildPreSalesAnalytics({ leads, contacts: [], history: [], calls, tasks,
    mandate: { achieved: 50, target: 100 }, tf, selectedPsm: 'Deepak' });
  assert.equal(result.efficiency.leads, 2);
  assert.equal(m(result.metrics, 'leadContact').value, 50);
  assert.equal(m(result.metrics, 'firstConnect').value, 1);
  assert.equal(m(result.health, 'callConnect').value, 100);
  assert.equal(m(result.health, 'overdueTasks').value, 1);
  assert.equal(m(result.health, 'sla').value, 50);
  assert.equal(m(result.health, 'qualificationTarget').value, 50);
});

test('Sales Health separates current-stage stock from unavailable historical conversion', () => {
  const contacts = [
    { id: '10', Full_Name: 'One', Created_Time: '2026-09-02T10:00:00+05:30',
      Client_Status: 'Only Validated', Stage: 'Price Discussion', Owner: { name: 'Rep' },
      Total_Opportunity_Value: 10, Next_Follow_UP_Date: '2026-09-10' },
    { id: '11', Full_Name: 'Two', Created_Time: '2026-09-04T10:00:00+05:30',
      Client_Status: 'Closed', Stage: 'Handover To Post Design', Owner: { name: 'Rep' },
      Total_Opportunity_Value: 20 },
    { id: '12', Full_Name: 'test opportunity', Created_Time: '2026-09-04T10:00:00+05:30',
      Client_Status: 'Closed', Owner: { name: 'Rep' } }
  ];
  const tasks = [{ Who_Id: { id: '10' }, What_Id: { id: 'other' }, Due_Date: '2026-09-10', Status: 'Not Started' }];
  const result = buildSalesHealth({ contacts, tf, city: 'all', history: new Map(), tasks, notes: [] });
  assert.equal(m(result.metrics, 'followUpPassed').value, 1);
  assert.equal(m(result.metrics, 'winRate').value, 50);
  assert.equal(m(result.metrics, 'averageDeal').value, 2_000_000);
  assert.equal(m(result.metrics, 'overdueTasks').value, 1);
  assert.equal(m(result.metrics, 'ladderConversion').value, null);
});

test('twelve-month qualification trend keeps empty months and follows the PSM filter', () => {
  const leads = [
    { id: '1', Owner: { name: 'Deepak' }, Company: 'One', Created_Time: '2026-08-02', Converted__s: true },
    { id: '2', Owner: { name: 'Ishita' }, Company: 'Two', Created_Time: '2026-08-03', Lead_Status: 'Not Contacted Yet' },
    { id: '3', Owner: { name: 'Deepak' }, Company: 'Three', Created_Time: '2026-09-01', Lead_Status: 'Not Interested' }
  ];
  const months = buildPreSalesTrend(leads, tf, 'Deepak');
  assert.equal(months.length, 12);
  assert.equal(months.find((row) => row.label === '2026-08').rate, 100);
  assert.equal(months.find((row) => row.label === '2026-09').rate, 0);
  assert.equal(months.find((row) => row.label === '2026-07').rate, null);
});


test('health evidence reconciles ratios, hours and unavailable call data', () => {
  const leads = [{ id: '1', Owner: { name: 'Deepak' }, Company: 'One', Created_Time: '2026-09-30T20:00:00Z', Lead_Status: 'Under follow-up' }];
  const calls = [{ id: 'call', Who_Id: { id: '1' }, Owner: { name: 'Deepak' }, Call_Type: 'Outbound', Call_Start_Time: '2026-10-01T10:00:00Z', Call_Duration_in_seconds: 60 }];
  const args = { leads, contacts: [], history: [], calls, tasks: [], mandate: null, tf, selectedPsm: 'Deepak' };
  const result = buildPreSalesAnalytics(args);
  assert.equal(m(result.metrics, 'firstConnect').value, 14);
  assert.equal(m(result.metrics, 'firstConnect').unit, 'hours');
  assert.equal(result.evidence.firstConnect[0].tat.excessHours, 2);
  assert.equal(result.evidence.leadContact.length, result.efficiency.leads);
  assert.equal(result.evidence.callConnect.length, 0); // Activity is outside the selected period.
  const unavailable = buildPreSalesAnalytics({ ...args, calls: null });
  assert.equal(m(unavailable.health, 'sla').value, null);
  assert.equal(m(unavailable.health, 'talkTime').value, null);
  assert.equal(unavailable.evidence.sla[0].tat.state, 'unknown');
});
