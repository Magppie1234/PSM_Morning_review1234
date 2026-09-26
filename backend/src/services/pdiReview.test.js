import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdiReview, mapPdiPayments } from './pdiReview.js';
const tf = { matches: v => v?.startsWith('2026-09'), reportLabel: 'September' };
const order = { id: '1', Deal_Name: 'Kitchen', Created_Time: '2026-09-01', Stage: 'PDI Done', PDI_Visit_done: '2026-09-20' };
test('visit completion does not imply verification or payment', () => {
  const r = buildPdiReview([order], new Map(), tf).records[0];
  assert.equal(r.verified, false);
  assert.equal(r.paymentDone, 'Not recorded');
  assert.equal(r.dispatchStatus, 'Pending');
  assert.match(r.dispatchReason, /verification not recorded/);
});
test('only PDI Approval payments are linked and duplicate links are deduplicated', () => {
  const links = [{ Orders: { id: '1' }, Payment_Milestones: { id: 'p1' } }, { Orders: { id: '1' }, Payment_Milestones: { id: 'p2' } }];
  const p = mapPdiPayments([{ id: 'p1', Milestone_Number: 'PDI Approval', Payment_Status: 'Unpaid' },
    { id: 'p2', Milestone_Number: 'Order Booking', Payment_Status: 'Paid' }], [...links, links[0]]);
  assert.equal(p.get('1').length, 1);
  assert.equal(buildPdiReview([{ ...order, Stage: 'PDI Payment Done' }], p, tf).records[0].paymentDone, 'Pending');
});
test('readiness and dispatch evidence are independent of PDI verification', () => {
  const r = buildPdiReview([{ ...order, PDI_Status: 'Approved', Ready_For_Dispatch_done: '2026-09-21' },
    { ...order, id: '2', Dispatch_done: '2026-09-22' }], new Map(), tf).records;
  assert.equal(r[0].verified, true);
  assert.equal(r[0].dispatchStatus, 'Ready for Dispatch');
  assert.equal(r[0].dispatchReason, null);
  assert.equal(r[1].dispatchStatus, 'Dispatched');
});
test('partial and unavailable payments are never reported as done', () => {
  assert.equal(buildPdiReview([order], new Map([['1', [{ Payment_Status: 'Partially Paid' }]]]), tf).records[0].paymentDone, 'Partially paid');
  assert.equal(buildPdiReview([order], null, tf).records[0].paymentDone, 'Unavailable');
});
test('period, test and Sunroof exclusions preserve the existing PDI business scope', () => {
  const r = buildPdiReview([order, { ...order, id: '2', Deal_Name: 'Sunrooof' },
    { ...order, id: '3', Deal_Name: 'test kitchen' }, { ...order, id: '4', Created_Time: '2026-08-01' }], new Map(), tf);
  assert.equal(r.records.length, 1);
});
