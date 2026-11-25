// Tests for the private copy's sync decisions (src/sync.js, ASTRO-129).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isTrackedKey, snapshotOf, sameData, decideSync } = require('../src/sync.js');

const loan = { lt_loans: '[{"id":0}]', lt_budget_0: '1000' };
const T1 = '2026-11-25T10:00:00.000Z', T2 = '2026-11-25T11:00:00.000Z', T3 = '2026-11-25T12:00:00.000Z';

test('only loan data counts; panel preferences and the sync and backup notes do not', () => {
  assert.equal(isTrackedKey('lt_loans'), true);
  assert.equal(isTrackedKey('confirmed_0_act'), true);
  assert.equal(isTrackedKey('lt_panel_chart'), false);
  assert.equal(isTrackedKey('loantracker_sync'), false);
  assert.equal(isTrackedKey('loantracker_last_backup'), false);
  const store = { _: { lt_loans: 'a', lt_panel_x: '1', other: 'z', loantracker_sync: '{}' }, get length() { return Object.keys(this._).length; }, key(i) { return Object.keys(this._)[i]; }, getItem(k) { return this._[k]; } };
  assert.deepEqual(snapshotOf(store), { lt_loans: 'a', lt_panel_x: '1' });
  assert.equal(sameData({ lt_loans: 'a', lt_panel_x: '1' }, { lt_loans: 'a' }), true);
  assert.equal(sameData({ lt_loans: 'a' }, { lt_loans: 'b' }), false);
});

test('a device that never synced: pushes its data to an empty online copy, or takes the online copy', () => {
  assert.equal(decideSync(null, loan, { savedAt: null, data: null }), 'push');
  assert.equal(decideSync(null, {}, { savedAt: null, data: null }), 'none');
  assert.equal(decideSync(null, {}, { savedAt: T1, data: loan }), 'adopt');
  assert.equal(decideSync(null, { ...loan }, { savedAt: T1, data: loan }), 'adopt');
});

test('a device that never synced, with different data from the online copy, keeps the online copy and offers its own', () => {
  assert.equal(decideSync(null, { ...loan, lt_budget_0: '2000' }, { savedAt: T1, data: loan }), 'conflict-keep-cloud');
});

test('a device in step with the online copy: nothing to do, push its changes, or take the other device\'s changes', () => {
  const synced = { cloudSavedAt: T1, localSavedAt: T1, dirty: false };
  assert.equal(decideSync(synced, loan, { savedAt: T1, data: loan }), 'none');
  assert.equal(decideSync({ ...synced, dirty: true, localSavedAt: T2 }, loan, { savedAt: T1, data: loan }), 'push');
  assert.equal(decideSync(synced, loan, { savedAt: T2, data: { ...loan, lt_budget_0: '1500' } }), 'adopt');
});

test('both changed since the last sync: the newer one wins', () => {
  const base = { cloudSavedAt: T1, dirty: true };
  assert.equal(decideSync({ ...base, localSavedAt: T3 }, loan, { savedAt: T2, data: loan }), 'conflict-keep-local');
  assert.equal(decideSync({ ...base, localSavedAt: T2 }, loan, { savedAt: T3, data: loan }), 'conflict-keep-cloud');
});

test('a reset elsewhere (empty online copy) is taken like any other change', () => {
  assert.equal(decideSync({ cloudSavedAt: T1, localSavedAt: T1, dirty: false }, loan, { savedAt: T2, data: {} }), 'adopt');
});
