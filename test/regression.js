// test/regression.js — regression test suite (node:test, zero extra deps)
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

// Load pure engine functions — no DOM, no localStorage
const {genProj,projEndMonth,projFirstMonth}=require('../src/engine.js');

const SAMPLES_DIR=path.join(__dirname,'..','samples');
const SNAPSHOTS_DIR=path.join(__dirname,'snapshots');
const UPDATE=process.argv.includes('--update-snapshots');

// Parse a sample file (localStorage export JSON) into genProj arguments
function parseSample(filePath){
  const raw=JSON.parse(fs.readFileSync(filePath,'utf8'));
  const loans=JSON.parse(raw.lt_loans);
  if(loans.length!==1)throw new Error(`parseSample: expected 1 loan, got ${loans.length} in ${filePath}`);
  const loan=loans[0];
  const budget=parseFloat(raw[`lt_budget_${loan.id}`]||0);
  const actuals=JSON.parse(raw[`confirmed_${loan.id}_act`]||'{}');
  // Manual lumps stored as single JSON object at lt_manlump_<id>
  const manLumps=JSON.parse(raw[`lt_manlump_${loan.id}`]||'{}');
  return{loan,budget,actuals,manLumps};
}

// Build genProj call arguments from parsed sample and return {rows, sched}
function runEngine({loan,budget,actuals,manLumps}){
  const rate=(loan.annualRate+loan.levy)/100/12;
  const{ey,em}=projEndMonth(loan);
  const startMonthStr=projFirstMonth(loan);
  const postRate=(loan.postFixedRate&&loan.fixedPeriodMonths>0)
    ?((loan.postFixedRate+loan.levy)/100/12):0;
  return genProj(
    budget,loan.balance,startMonthStr,rate,ey,em,
    manLumps,loan.lumpMonth,actuals,
    loan.lumpEnabled!==false,loan.lumpEffect||'reduce-installment',
    !!loan.balloonEnabled,loan.balloonThreshold||0,
    loan.fixedPeriodMonths||0,postRate
  );
}

// Check structural invariants — these never need updating across bug fixes
function checkInvariants(rows,loan,actuals){
  actuals=actuals||{};
  const initRate=(loan.annualRate+loan.levy)/100/12;
  const postRate=(loan.postFixedRate&&loan.fixedPeriodMonths>0)
    ?((loan.postFixedRate+loan.levy)/100/12):0;
  let prevBal=loan.balance;
  let prevMonth=null;
  let monthIdx=0; // track months to detect rate transition
  const seen=new Set(); // track (month, type) pairs for duplicate check
  // Parse start date to calculate month index for rate transitions
  const[sy,sm]=projFirstMonth(loan).split('-').map(Number);

  for(const row of rows){
    // Balance never negative
    assert.ok(row.bal>=0,`Balance negative in ${row.month}: ${row.bal}`);

    // No duplicate (month, type) pairs
    const key=`${row.month}:${row.type}`;
    assert.ok(!seen.has(key),`Duplicate (month, type) pair: ${key}`);
    seen.add(key);

    // Rows are in chronological order (same month allowed for extra+inst pair)
    if(prevMonth!==null&&row.type==='inst'){
      assert.ok(row.month>=prevMonth,`Out of order: ${row.month} after ${prevMonth}`);
    }

    if(row.type==='extra'){
      // Lump never exceeds balance before it was applied
      assert.ok(row.inst<=prevBal+0.01,
        `Lump ${row.inst} exceeds pre-lump balance ${prevBal} in ${row.month}`);
      prevBal=row.bal; // prevBal is now balance after lump (balPost)
    }

    if(row.type==='inst'){
      // Skip arithmetic checks for confirmed actuals (user-entered bank data)
      const isActual=!!(actuals[row.month+'_inst']&&actuals[row.month+'_inst'].saved);
      if(!isActual){
        // Payoff rows embed the lump in row.lump (no preceding 'extra' row).
        // Interest is calculated on balPost = prevBal - embeddedLump.
        const embeddedLump=row.lump||0;
        const balForInterest=prevBal-embeddedLump;
        // Determine effective rate for this month (changes after fixedPeriodMonths)
        const effectiveRate=(postRate>0&&monthIdx>=loan.fixedPeriodMonths)?postRate:initRate;
        // Interest ≈ balForInterest × monthly rate (within 0.05 to allow bank rounding)
        const expectedInt=+(balForInterest*effectiveRate).toFixed(2);
        assert.ok(Math.abs(row.int-expectedInt)<=0.05,
          `Interest wrong in ${row.month}: got ${row.int}, expected ~${expectedInt} (bal=${balForInterest}, rate=${effectiveRate})`);
        // Balance arithmetic: for payoff rows total outflow = inst + settlement; bal must be 0
        const totalPaid=row.inst+(row.settlement||0);
        const expectedBal=+(balForInterest+row.int-totalPaid).toFixed(2);
        assert.ok(Math.abs(row.bal-expectedBal)<=0.5,
          `Balance arithmetic wrong in ${row.month}: got ${row.bal}, expected ~${expectedBal}`);
      }
      prevBal=row.bal;
      prevMonth=row.month;
      monthIdx++;
    }
  }

  // Loan must terminate: final inst row balance ≈ 0 (or ≤ balloon threshold)
  const lastInst=[...rows].reverse().find(r=>r.type==='inst');
  if(lastInst){
    const threshold=loan.balloonEnabled?(loan.balloonThreshold||0):0;
    assert.ok(lastInst.bal<=threshold+0.5,
      `Loan did not terminate: final balance ${lastInst.bal}`);
  }
}

// Snapshot helpers
function snapshotPath(name){return path.join(SNAPSHOTS_DIR,name+'.json');}

function checkSnapshot(name,rows){
  const snapFile=snapshotPath(name);
  if(UPDATE){
    fs.mkdirSync(SNAPSHOTS_DIR,{recursive:true});
    fs.writeFileSync(snapFile,JSON.stringify(rows,null,2));
    console.log(`  snapshot updated: ${name}.json`);
    return;
  }
  assert.ok(fs.existsSync(snapFile),
    `Snapshot missing: ${snapFile}\nRun: node test/regression.js --update-snapshots`);
  const expected=JSON.parse(fs.readFileSync(snapFile,'utf8'));
  assert.deepEqual(rows,expected,`Snapshot mismatch for ${name}`);
}

// --- Unit tests for specific bug fixes ---

// #43: First annual lump sum must use actual months elapsed, not hardcoded 12
test('#43: mid-year start — first lump proportional to months elapsed', () => {
  // Loan starts August 2024, lump month April (mo=4).
  // By April 2025: only 8 installments in `recent` (Aug–Mar), not 12.
  const budget = 850;
  const rate = (4.4 + 0.12) / 100 / 12;
  const {rows} = genProj(
    budget, 95000, '2024-08', rate, 2049, 8,
    {}, 4, {}, true, 'reduce-installment', false, 0, 0, 0
  );

  // Collect inst rows strictly before the first lump month
  const instsBeforeLump = [];
  for (const r of rows) {
    if (r.type === 'extra') break;
    if (r.type === 'inst') instsBeforeLump.push(r);
  }
  const n = instsBeforeLump.length;
  const sumN = instsBeforeLump.reduce((a, r) => a + r.inst, 0);
  const prevBal = instsBeforeLump[n - 1].bal;

  const firstExtra = rows.find(r => r.type === 'extra');
  assert.ok(firstExtra, 'Expected at least one lump-sum row');
  assert.equal(firstExtra.month, '2025-04', 'First lump must fire in April 2025');

  assert.ok(n < 12, `Expected <12 installments before first lump (mid-year loan), got ${n}`);

  // Correct formula uses n (actual months elapsed), not 12
  const expectedLump = Math.round(Math.max(Math.min(n * budget - sumN, prevBal), 0));
  assert.equal(
    firstExtra.inst, expectedLump,
    `First lump should be ${expectedLump} (n=${n} months of surplus), ` +
    `not ${firstExtra.inst} (bugged 12-month value would be ${Math.round(Math.max(Math.min(12 * budget - sumN, prevBal), 0))})`
  );
});

// #44 — bug 1: payoff row inst must not be inflated with the settlement amount
test('#44: balloon payoff row — inst is regular installment, settlement is separate field', () => {
  // Loan balance 5100, rate 0.5%/month, no lump, balloon threshold 5000.
  // After 1 normal month (5026.90 remaining), month 2 endBal ≈ 4954 ≤ 5000 → balloon fires.
  const rate = 0.005;
  const {rows, sched} = genProj(
    0, 5100, '2025-01', rate, 2030, 1,
    {}, 8, {}, false, 'reduce-installment',
    true, 5000, 0, 0
  );

  const payoffRow = rows.find(r => r.type === 'inst' && r.bal === 0);
  assert.ok(payoffRow, 'Expected a payoff row with bal=0');

  const payoffSched = sched.find(s => s.payoff === true);
  assert.ok(payoffSched, 'Expected a sched entry with payoff:true');
  assert.ok(payoffSched.payoffAmt > 0, 'Expected non-zero settlement amount in sched');

  // Payoff row must carry a separate settlement field
  assert.ok('settlement' in payoffRow,
    `Payoff row must have a settlement field separate from inst; got keys: ${Object.keys(payoffRow).join(', ')}`);

  // inst must be the regular monthly payment only, not inst+settlement
  assert.ok(payoffRow.inst < payoffRow.inst + payoffRow.settlement,
    'Tautology guard — settlement must be positive');
  assert.equal(payoffRow.settlement, payoffSched.payoffAmt,
    'row.settlement must equal sched.payoffAmt');
  // inst must be the regular installment only — much smaller than the remaining balance
  assert.ok(payoffRow.inst < payoffRow.settlement,
    `inst (${payoffRow.inst}) must be less than settlement (${payoffRow.settlement}); ` +
    'inst appears inflated with settlement amount');
});

// #44 — bug 2: when lump fires in balloon month, only one row for that month
test('#44: lump + balloon in same month produces a single row', () => {
  // Loan balance 5100, rate 0.5%/month, balloon threshold 5000, lump month February.
  // Month 1 (Jan): normal installment, recent=[inst].
  // Month 2 (Feb): lump fires (1 month surplus), balPost ≈ 4626, then endBal ≈ 4559 ≤ 5000 → balloon.
  const rate = 0.005;
  const budget = 500;
  const {rows} = genProj(
    budget, 5100, '2025-01', rate, 2030, 1,
    {}, 2, {}, true, 'reduce-installment',
    true, 5000, 0, 0
  );

  const payoffRow = rows.find(r => r.type === 'inst' && r.bal === 0);
  assert.ok(payoffRow, 'Expected a payoff row with bal=0');
  const payoffMonth = payoffRow.month;

  const rowsInMonth = rows.filter(r => r.month === payoffMonth);
  assert.equal(rowsInMonth.length, 1,
    `Expected 1 row in payoff month ${payoffMonth}, got ${rowsInMonth.length}: ` +
    rowsInMonth.map(r => `${r.type}(inst=${r.inst})`).join(', ')
  );

  // The single row must carry the lump amount
  assert.ok(rowsInMonth[0].lump > 0,
    `Payoff row must carry lump amount; got lump=${rowsInMonth[0].lump}`);
});

// --- Sample-based invariant + snapshot tests ---

// One invariant test + one snapshot test per sample file
const sampleFiles=fs.readdirSync(SAMPLES_DIR).filter(f=>f.endsWith('.json'));

for(const file of sampleFiles){
  const filePath=path.join(SAMPLES_DIR,file);
  const name=path.basename(file,'.json');

  test(`${name}: invariants`,()=>{
    const parsed=parseSample(filePath);
    const{rows}=runEngine(parsed);
    checkInvariants(rows,parsed.loan,parsed.actuals);
  });

  test(`${name}: snapshot`,()=>{
    const parsed=parseSample(filePath);
    const{rows}=runEngine(parsed);
    checkSnapshot(name,rows);
  });
}
