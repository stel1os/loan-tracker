// Regression tests: run genProj against known-good snapshots
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { genProj, projEndMonth, projFirstMonth } = require('../src/engine.js');

const UPDATE = process.argv.includes('--update-snapshots');
const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');

function runCase(sampleName) {
  const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, sampleName + '.json'), 'utf8'));
  const loan = JSON.parse(sample.lt_loans)[0];
  const budget = parseFloat(sample['lt_budget_0']);
  const actuals = sample['confirmed_0_act'] ? JSON.parse(sample['confirmed_0_act']) : {};
  const manLumps = {};

  const rate = (loan.annualRate + loan.levy) / 100 / 12;
  const postRate = (loan.postFixedRate && loan.fixedPeriodMonths > 0)
    ? (loan.postFixedRate + loan.levy) / 100 / 12
    : 0;
  const startKey = projFirstMonth(loan);
  const { ey, em } = projEndMonth(loan);

  const { rows } = genProj(
    budget,
    loan.balance,
    startKey,
    rate,
    ey, em,
    manLumps,
    loan.lumpMonth,
    actuals,
    loan.lumpEnabled !== false,
    loan.lumpEffect || 'reduce-installment',
    !!loan.balloonEnabled,
    loan.balloonThreshold || 0,
    loan.fixedPeriodMonths || 0,
    postRate
  );

  const snapshotPath = path.join(SNAPSHOTS_DIR, sampleName + '.json');
  if (UPDATE) {
    fs.writeFileSync(snapshotPath, JSON.stringify(rows, null, 2) + '\n');
    return { rows, snapshot: rows };
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  return { rows, snapshot };
}

// Run genProj from a sample with an explicit lumpMonths override (used by #48 tests)
function runWithLumpMonths(sampleName, lumpMonths) {
  const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, sampleName + '.json'), 'utf8'));
  const loan = JSON.parse(sample.lt_loans)[0];
  const budget = parseFloat(sample['lt_budget_0']);
  const actuals = sample['confirmed_0_act'] ? JSON.parse(sample['confirmed_0_act']) : {};
  const rate = (loan.annualRate + loan.levy) / 100 / 12;
  const postRate = (loan.postFixedRate && loan.fixedPeriodMonths > 0)
    ? (loan.postFixedRate + loan.levy) / 100 / 12 : 0;
  const startKey = projFirstMonth(loan);
  const { ey, em } = projEndMonth(loan);
  return genProj(
    budget, loan.balance, startKey, rate, ey, em,
    {}, lumpMonths, actuals,
    loan.lumpEnabled !== false,
    loan.lumpEffect || 'reduce-installment',
    !!loan.balloonEnabled, loan.balloonThreshold || 0,
    loan.fixedPeriodMonths || 0, postRate
  );
}

test('dummy-loan-95k-lump: row count matches snapshot', () => {
  const { rows, snapshot } = runCase('dummy-loan-95k-lump');
  assert.equal(rows.length, snapshot.length);
});

test('dummy-loan-95k-lump: rows match snapshot', () => {
  const { rows, snapshot } = runCase('dummy-loan-95k-lump');
  for (let i = 0; i < snapshot.length; i++) {
    const got = rows[i];
    const exp = snapshot[i];
    assert.equal(got.month, exp.month, `row ${i} month`);
    assert.equal(got.type, exp.type, `row ${i} type`);
    assert.equal(got.inst, exp.inst, `row ${i} inst`);
    assert.equal(got.int, exp.int, `row ${i} int`);
    assert.equal(got.bal, exp.bal, `row ${i} bal`);
  }
});

test('dummy-loan-95k-lump+payoff: row count matches snapshot', () => {
  const { rows, snapshot } = runCase('dummy-loan-95k-lump+payoff');
  assert.equal(rows.length, snapshot.length);
});

test('dummy-loan-95k-lump+payoff: rows match snapshot', () => {
  const { rows, snapshot } = runCase('dummy-loan-95k-lump+payoff');
  for (let i = 0; i < snapshot.length; i++) {
    const got = rows[i];
    const exp = snapshot[i];
    assert.equal(got.month, exp.month, `row ${i} month`);
    assert.equal(got.type, exp.type, `row ${i} type`);
    assert.equal(got.inst, exp.inst, `row ${i} inst`);
    assert.equal(got.int, exp.int, `row ${i} int`);
    assert.equal(got.bal, exp.bal, `row ${i} bal`);
    if (exp.settlement != null) assert.equal(got.settlement, exp.settlement, `row ${i} settlement`);
    if (exp.lump != null) assert.equal(got.lump, exp.lump, `row ${i} lump`);
  }
});

// --- #47: confirmed actuals bal must be derived from chain, not read from stored value ---

test('#47 confirmed actuals: bal derived from chain, not stored (my-loan-95k)', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'my-loan-95k.json'), 'utf8'));
  const loan = JSON.parse(sample.lt_loans)[0];
  const budget = parseFloat(sample['lt_budget_0']);
  const actuals = JSON.parse(sample['confirmed_0_act']);
  const rate = (loan.annualRate + loan.levy) / 100 / 12;
  const postRate = (loan.postFixedRate && loan.fixedPeriodMonths > 0)
    ? (loan.postFixedRate + loan.levy) / 100 / 12 : 0;
  const startKey = projFirstMonth(loan);
  const { ey, em } = projEndMonth(loan);

  const { sched } = genProj(
    budget, loan.balance, startKey, rate, ey, em,
    {}, loan.lumpMonth, actuals,
    loan.lumpEnabled !== false,
    loan.lumpEffect || 'reduce-installment',
    !!loan.balloonEnabled, loan.balloonThreshold || 0,
    loan.fixedPeriodMonths || 0, postRate
  );

  // For every confirmed row: bal must equal prev − principal − lump (derived, not stored).
  // prev tracks through sched using each row's actual bal so the check is per-row, not cascading.
  let prev = loan.balance;
  for (const row of sched) {
    if (!row.confirmed) { prev = row.bal; continue; }
    const expectedPrin = +(row.inst - row.interest).toFixed(2);
    const expectedBal  = +Math.max(0, prev - expectedPrin - (row.lump || 0)).toFixed(2);
    assert.strictEqual(
      row.bal,
      expectedBal,
      `${row.month}: expected bal ${expectedBal} (prev=${prev} − prin=${expectedPrin} − lump=${row.lump || 0}), got ${row.bal}`
    );
    prev = row.bal;
  }
});

// --- #48: multi-month lump sum ---

test('#48 backwards-compat: lumpMonths:[4] fires same projection as lumpMonth:4', () => {
  const { rows: rowsScalar } = runWithLumpMonths('dummy-loan-95k-lump', 4);    // scalar — current api
  const { rows: rowsArray  } = runWithLumpMonths('dummy-loan-95k-lump', [4]); // array  — new api

  assert.strictEqual(rowsArray.length, rowsScalar.length, 'row count must match');
  for (let i = 0; i < rowsScalar.length; i++) {
    assert.deepEqual(rowsArray[i], rowsScalar[i], `row ${i} (${rowsScalar[i].month}) must match`);
  }
});

test('#48 multi-month: lumpMonths:[4,10] fires lumps in April and October only', () => {
  const { rows } = runWithLumpMonths('dummy-loan-95k-lump', [4, 10]);

  const firedMonths = [...new Set(
    rows.filter(r => r.type === 'extra').map(r => parseInt(r.month.split('-')[1], 10))
  )].sort((a, b) => a - b);

  assert.deepEqual(firedMonths, [4, 10], 'Lump rows must appear in April (4) and October (10) only');
});

// --- #51: lump accumulation must reset after each lump fires ---

test('#51 lump reset: accumulation resets after each lump fires (my-loan-95k-multi-lump)', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'my-loan-95k-multi-lump.json'), 'utf8'));
  const loan = JSON.parse(sample.lt_loans)[0];
  const budget = parseFloat(sample['lt_budget_0']);
  const actuals = JSON.parse(sample['confirmed_0_act']);
  const rate = (loan.annualRate + loan.levy) / 100 / 12;
  const postRate = (loan.postFixedRate && loan.fixedPeriodMonths > 0)
    ? (loan.postFixedRate + loan.levy) / 100 / 12 : 0;
  const startKey = projFirstMonth(loan);
  const { ey, em } = projEndMonth(loan);

  const { rows } = genProj(
    budget, loan.balance, startKey, rate, ey, em,
    {}, loan.lumpMonths, actuals,
    loan.lumpEnabled !== false,
    loan.lumpEffect || 'reduce-installment',
    !!loan.balloonEnabled, loan.balloonThreshold || 0,
    loan.fixedPeriodMonths || 0, postRate
  );

  // Last confirmed lump: March 2026 (lump=1500). August 2026 is the next lump month.
  // With reset fix: accumulates ~5 months (Mar→Jul) → lump = 176.
  // Without reset:  accumulates 12 months (Jul 2025→Jul 2026) → lump = 337 (wrong).
  const aug2026 = rows.find(r => r.month === '2026-08' && r.type === 'extra');
  assert.ok(aug2026, '2026-08 must have a lump row');
  assert.strictEqual(aug2026.inst, 176, '2026-08 lump should be 176 (reset after March lump), not 337');
});
