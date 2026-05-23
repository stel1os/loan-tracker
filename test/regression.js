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
