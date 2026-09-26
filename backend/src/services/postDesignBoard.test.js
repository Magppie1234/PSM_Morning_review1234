import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostDesignBoard } from './postDesignBoard.js';

const tf = { matches: value => String(value).startsWith('2026-09'), reportLabel: 'September' };
const base = { id: '1', Deal_Name: 'Kitchen order', Created_Time: '2026-09-01',
  Stage: 'Assign Post - Designer', Designer_Name: 'Designer A', Opportunity_Name: { id: 'c1', name: 'Client One' } };

test('missing milestones and payments are not invented from later stages', () => {
  const { records } = buildPostDesignBoard({ deals: [{ ...base, Stage: 'Final Handover' }], tf });
  assert.equal(records[0].milestones.approval.status, 'Not recorded');
  assert.equal(records[0].paymentEvidence, 'Not recorded');
  assert.equal(records[0].revisions, null);
  assert.equal(records[0].appliancesReceived, null);
});

test('pending age uses milestone opening date; completion and zero revisions remain distinct', () => {
  const { records } = buildPostDesignBoard({ deals: [{ ...base, Number_of_Design_Revisions: 0,
    EPT_Signoff_open: '2026-09-20T00:00:00Z', PDI_Status: 'Approved' }], tf, now: Date.parse('2026-09-26T00:00:00Z') });
  assert.equal(records[0].milestones.ep.pendingDays, 6);
  assert.equal(records[0].milestones.pdi.status, 'Complete');
  assert.equal(records[0].milestones.pdi.pendingDays, null);
  assert.equal(records[0].revisions, 0);
});

test('order counts use lookup identity and the entire selected-period cohort', () => {
  const { records } = buildPostDesignBoard({ deals: [base, { ...base, id: '2', Stage: 'Designer Assigned' },
    { ...base, id: '3', Created_Time: '2026-08-01' }, { ...base, id: '4', Deal_Name: 'test order' }], tf });
  assert.equal(records.length, 1);
  assert.equal(records[0].orders, 2);
  assert.equal(records[0].designerOrders, 2);
});

test('signed appliance list is not physical receipt; receipt attachment is only payment evidence', () => {
  const { records } = buildPostDesignBoard({ deals: [{ ...base, Signed_Appliances_List: [{ id: 'file1' }],
    Payment_Received_Document: [{ id: 'file2' }] }], tf });
  assert.equal(records[0].applianceList, 'Signed list on file');
  assert.equal(records[0].appliancesReceived, null);
  assert.equal(records[0].paymentEvidence, 'Receipt on file');
});

test('recorded activity is pending even when its opening date is missing', () => {
  const { records } = buildPostDesignBoard({ deals: [{ ...base, PDI_Status: 'Visit Scheduled' }], tf });
  assert.equal(records[0].milestones.pdi.status, 'Pending');
  assert.equal(records[0].milestones.pdi.pendingDays, null);
});
