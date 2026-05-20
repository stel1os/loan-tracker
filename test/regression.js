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
  const loan=JSON.parse(raw.lt_loans)[0];
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
function checkInvariants(rows,loan){
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
      // Determine effective rate for this month (changes after fixedPeriodMonths)
      const effectiveRate=(postRate>0&&monthIdx>=loan.fixedPeriodMonths)?postRate:initRate;
      // Interest ≈ prevBal × monthly rate (within 0.05 to allow bank rounding)
      const expectedInt=+(prevBal*effectiveRate).toFixed(2);
      assert.ok(Math.abs(row.int-expectedInt)<=0.05,
        `Interest wrong in ${row.month}: got ${row.int}, expected ~${expectedInt} (bal=${prevBal}, rate=${effectiveRate})`);
      // Balance arithmetic: bal ≈ prevBal + interest - installment (tolerance 0.5 for rounding)
      const expectedBal=+(prevBal+row.int-row.inst).toFixed(2);
      assert.ok(Math.abs(row.bal-expectedBal)<=0.5,
        `Balance arithmetic wrong in ${row.month}: got ${row.bal}, expected ~${expectedBal}`);
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

// One invariant test + one snapshot test per sample file
const sampleFiles=fs.readdirSync(SAMPLES_DIR).filter(f=>f.endsWith('.json'));

for(const file of sampleFiles){
  const filePath=path.join(SAMPLES_DIR,file);
  const name=path.basename(file,'.json');

  test(`${name}: invariants`,()=>{
    const parsed=parseSample(filePath);
    const{rows}=runEngine(parsed);
    checkInvariants(rows,parsed.loan);
  });

  test(`${name}: snapshot`,()=>{
    const parsed=parseSample(filePath);
    const{rows}=runEngine(parsed);
    checkSnapshot(name,rows);
  });
}
