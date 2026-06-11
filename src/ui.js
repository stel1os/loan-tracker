/* ─────────────────────────────────────────
   Setup modal helpers
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   localStorage schema (v2 — extensible)
   ─────────────────────────────────────────
   Key: lt_loans  — JSON array of loan objects.
   Index 0 is the current (only) loan. Future loans
   appended via a + button (not built yet).

   Loan object shape:
   {
     id:               number,   // stable index/id (0 for first loan)
     label:            string,   // display label (user-editable in future)
     balance:          number,   // opening balance for projection (€)
     months:           number,   // remaining term in months
     annualRate:       number,   // base annual rate as % (e.g. 4.52)
     levy:             number,   // additional levy as % (e.g. 0.12)
     rateType:         'fixed'|'variable',
     startMonth:       number,   // 1–12
     startYear:        number,   // e.g. 2026
     lumpMonths:       [number], // 1–12, months annual lump fires (default [8])
     seedInstallments: [n,n,n,n] // last 4 known installments, oldest→newest
   }

   Per-loan keys (index-prefixed for future multi-loan):
     lt_budget_0          — monthly budget for loan 0
     confirmed_0_act      — confirmed actual rows for loan 0

   Migration: loans with the old scalar lumpMonth are migrated to
   lumpMonths:[lumpMonth] on load (loadLoans); loans missing both
   default to [8] (August).

   Migration (v1 → v2): if lt_loans is absent but the old
   single-loan key lt_loan_mort exists, it is migrated into
   lt_loans[0] and the old key deleted. Old mort_budget /
   mort_act are migrated to lt_budget_0 / confirmed_0_act.
───────────────────────────────────────── */



function renderLumpMonthChecks(selected){
  const sel=Array.isArray(selected)?selected:[];
  document.getElementById('s-loan-lump-month-checks').innerHTML=MN.map(function(m,i){
    return '<label style="font-size:0.85em"><input type="checkbox" value="'+(i+1)+'"'+(sel.includes(i+1)?' checked':'')+'> '+m+'</label>';
  }).join('');
}

function populateForm(data){
  if(!data){
    ['s-loan-bal','s-loan-months','s-loan-rate','s-loan-levy','s-loan-startmon','s-loan-startyear','s-loan-fixedperiod','s-loan-postrate','s-loan-goalmon','s-loan-goalyear','s-loan-balloon'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('s-loan-rtype').value='fixed';
    document.getElementById('s-loan-lump-enabled').checked=false;
    renderLumpMonthChecks([]);
    document.getElementById('s-loan-effect').value='reduce-installment';
    document.getElementById('s-loan-balloon-enabled').checked=false;
    toggleFixedPeriod();toggleLumpOptions();toggleBalloonOptions();
    return;
  }
  document.getElementById('s-loan-bal').value=data.balance??'';
  document.getElementById('s-loan-months').value=data.months??'';
  document.getElementById('s-loan-rate').value=data.annualRate??'';
  document.getElementById('s-loan-levy').value=data.levy??'';
  document.getElementById('s-loan-rtype').value=data.rateType??'fixed';
  document.getElementById('s-loan-startmon').value=data.startMonth??'5';
  document.getElementById('s-loan-startyear').value=data.startYear??'';
  renderLumpMonthChecks(Array.isArray(data.lumpMonths)?data.lumpMonths:[data.lumpMonth!=null?data.lumpMonth:8]);
  document.getElementById('s-loan-fixedperiod').value=data.fixedPeriodMonths||'';
  document.getElementById('s-loan-postrate').value=data.postFixedRate||'';
  toggleFixedPeriod();
  const gpd=data.targetPayoffDate||'';
  document.getElementById('s-loan-goalmon').value=gpd?gpd.slice(5,7):'';
  document.getElementById('s-loan-goalyear').value=gpd?gpd.slice(0,4):'';
  document.getElementById('s-loan-lump-enabled').checked=data.lumpEnabled!==false;
  toggleLumpOptions();
  document.getElementById('s-loan-effect').value=data.lumpEffect||'reduce-installment';
  document.getElementById('s-loan-balloon-enabled').checked=!!data.balloonEnabled;
  document.getElementById('s-loan-balloon').value=data.balloonThreshold||'';
  toggleBalloonOptions();
}

function openSetup(firstRun){
  document.querySelector('#setup-modal .btn-primary').setAttribute('onclick','saveSetup()');
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  populateForm(loadLoan(loanId));
  const loans=loadLoans()||[];
  const isMulti=loans.length>1;
  document.getElementById('btn-add-loan').style.display=isMulti?'none':'';
  document.getElementById('btn-delete-loan').style.display=(isMulti&&!firstRun)?'':'none';
  document.querySelector('#setup-modal .modal-title').textContent=firstRun?'Loan Setup':'Edit — '+(loans[loanId]&&loans[loanId].label||'Loan');
  clearErrors();
  document.getElementById('setup-cancel-btn').style.display=firstRun?'none':'';
  document.getElementById('setup-reset-btn').style.display=firstRun?'none':'';
  document.getElementById('setup-import-btn').style.display=firstRun?'':'none';
  document.getElementById('setup-modal').classList.add('open');
}

function closeSetup(){document.getElementById('setup-modal').classList.remove('open');}

function triggerImport(){document.getElementById('import-file').click();}

function handleImport(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const state=JSON.parse(ev.target.result);
      const loans=JSON.parse(state['lt_loans']||'null');
      if(!Array.isArray(loans)||!loans[0])throw new Error('No loan data found in file');
      const loan=loans[0];
      const summary='Loan from '+(MN[(loan.startMonth||1)-1]||'')+' '+(loan.startYear||'?')+
        (state._exported?', exported '+state._exported:'');
      if(!confirm('Import: '+summary+'\n\nThis will replace your current data. Continue?'))return;
      const toRemove=[];
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k.startsWith('lt_')||k.startsWith('confirmed_')))toRemove.push(k);}
      toRemove.forEach(k=>localStorage.removeItem(k));
      Object.keys(state).filter(k=>k.startsWith('lt_')||k.startsWith('confirmed_')).forEach(k=>localStorage.setItem(k,state[k]));
      closeSetup();
      initApp();
    }catch(err){
      alert('Could not import: '+err.message);
    }
    e.target.value='';
  };
  reader.readAsText(file);
}

function exportData(){
  const state={};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&(k.startsWith('lt_')||k.startsWith('confirmed_')))state[k]=localStorage.getItem(k);
  }
  state._exported=new Date().toISOString().slice(0,10);
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='loan-tracker-'+state._exported+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function toggleFixedPeriod(){
  const isFixed=document.getElementById('s-loan-rtype').value==='fixed';
  document.getElementById('s-fixedperiod-group').style.display=isFixed?'':'none';
  const fp=parseInt(document.getElementById('s-loan-fixedperiod').value,10)||0;
  const showPost=isFixed&&fp>0;
  document.getElementById('s-postrate-group').style.display=showPost?'':'none';
  if(showPost){document.getElementById('s-postrate-hint-month').textContent=fp+1;}
}

function toggleLumpOptions(){
  const en=document.getElementById('s-loan-lump-enabled').checked;
  document.getElementById('s-lump-options').style.display=en?'':'none';
}
function toggleBalloonOptions(){
  const en=document.getElementById('s-loan-balloon-enabled').checked;
  document.getElementById('s-balloon-options').style.display=en?'':'none';
}

function resetApp(){
  Object.keys(localStorage)
    .filter(k=>k.startsWith('lt_')||k.startsWith('confirmed_'))
    .forEach(k=>localStorage.removeItem(k));
  closeSetup();
  initApp();
}

function clearErrors(){
  document.querySelectorAll('.form-err').forEach(e=>e.classList.remove('show'));
  document.querySelectorAll('.form-input').forEach(e=>e.classList.remove('err'));
}

function setErr(errId,inputId){
  document.getElementById(errId).classList.add('show');
  if(inputId)document.getElementById(inputId).classList.add('err');
}

function readForm(){
  const bal=parseFloat(document.getElementById('s-loan-bal').value);
  const months=parseInt(document.getElementById('s-loan-months').value,10);
  const rate=parseFloat(document.getElementById('s-loan-rate').value);
  const levy=parseFloat(document.getElementById('s-loan-levy').value)||0;
  const rtype=document.getElementById('s-loan-rtype').value;
  const smon=parseInt(document.getElementById('s-loan-startmon').value,10);
  const syr=parseInt(document.getElementById('s-loan-startyear').value,10);
  const lumpMonths=[...document.querySelectorAll('#s-loan-lump-month-checks input:checked')].map(cb=>parseInt(cb.value,10));
  const fixedPeriodMonths=parseInt(document.getElementById('s-loan-fixedperiod').value,10)||0;
  const postFixedRate=parseFloat(document.getElementById('s-loan-postrate').value)||null;
  const goalMon=document.getElementById('s-loan-goalmon').value;
  const goalYear=document.getElementById('s-loan-goalyear').value;
  const targetPayoffDate=(goalMon&&goalYear)?(goalYear+'-'+goalMon):null;
  const lumpEnabled=document.getElementById('s-loan-lump-enabled').checked;
  const lumpEffect=document.getElementById('s-loan-effect').value;
  const balloonEnabled=document.getElementById('s-loan-balloon-enabled').checked;
  const balloonThreshold=parseFloat(document.getElementById('s-loan-balloon').value)||0;
  return{bal,months,rate,levy,rtype,fixedPeriodMonths,postFixedRate,smon,syr,lumpMonths,lumpEnabled,lumpEffect,balloonEnabled,balloonThreshold,targetPayoffDate};
}

function validateForm(v){
  let ok=true;
  if(!v.bal||isNaN(v.bal)||v.bal<=0){setErr('err-loan-bal','s-loan-bal');ok=false;}
  if(!v.months||isNaN(v.months)||v.months<1){setErr('err-loan-months','s-loan-months');ok=false;}
  if(!v.rate||isNaN(v.rate)||v.rate<=0){setErr('err-loan-rate','s-loan-rate');ok=false;}
  if(!v.syr||isNaN(v.syr)){setErr('err-loan-start','s-loan-startyear');ok=false;}
  if(v.balloonEnabled&&(!v.balloonThreshold||v.balloonThreshold<=0)){
    setErr('err-loan-balloon','s-loan-balloon');ok=false;
  }
  if(v.lumpEnabled&&v.lumpMonths.length===0){
    setErr('err-loan-lumpmonths');ok=false;
  }
  return ok;
}

function saveSetup(){
  clearErrors();
  const v=readForm();
  if(!validateForm(v))return;
  const loans=loadLoans()||[];
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  const existing=loans[loanId]||{};
  loans[loanId]={
    id:loanId,label:existing.label||'Loan',
    balance:v.bal,months:v.months,annualRate:v.rate,levy:v.levy,
    rateType:v.rtype,startMonth:v.smon,startYear:v.syr,lumpMonths:v.lumpMonths,
    fixedPeriodMonths:v.fixedPeriodMonths,postFixedRate:v.postFixedRate,targetPayoffDate:v.targetPayoffDate,
    lumpEnabled:v.lumpEnabled,lumpEffect:v.lumpEffect,
    balloonEnabled:v.balloonEnabled,balloonThreshold:v.balloonThreshold
  };
  saveLoans(loans);
  closeSetup();
  document.getElementById('first-run-banner').classList.remove('show');
  initApp();
}

function startAddLoan(){
  closeSetup();
  // open the form in "add new loan" mode
  populateForm(null); // blank form
  clearErrors();
  document.getElementById('setup-cancel-btn').style.display='';
  document.getElementById('setup-reset-btn').style.display='none';
  document.getElementById('setup-import-btn').style.display='none';
  document.getElementById('btn-add-loan').style.display='none';
  document.getElementById('btn-delete-loan').style.display='none';
  document.querySelector('#setup-modal .modal-title').textContent='Add New Loan';
  // swap Save button to call saveNewLoan
  const saveBtn=document.querySelector('#setup-modal .btn-primary');
  saveBtn.setAttribute('onclick','saveNewLoan()');
  document.getElementById('setup-modal').classList.add('open');
}

function saveNewLoan(){
  clearErrors();
  const v=readForm();
  if(!validateForm(v))return;
  const loans=loadLoans()||[];
  const newId=loans.length>0?Math.max(...loans.map(l=>l.id))+1:0;
  loans.push({
    id:newId,label:'Loan '+(newId+1),
    balance:v.bal,months:v.months,annualRate:v.rate,levy:v.levy,
    rateType:v.rtype,startMonth:v.smon,startYear:v.syr,lumpMonths:v.lumpMonths,
    fixedPeriodMonths:v.fixedPeriodMonths,postFixedRate:v.postFixedRate,
    targetPayoffDate:v.targetPayoffDate,lumpEnabled:v.lumpEnabled,
    lumpEffect:v.lumpEffect,balloonEnabled:v.balloonEnabled,
    balloonThreshold:v.balloonThreshold
  });
  saveLoans(loans);
  // first multi-loan: migrate budget to shared pool
  if(loans.length===2)migrateToBudgetTotal();
  // new loan starts at 0% allocation — user sets it on Dashboard
  const alloc=getBudgetAlloc()||{};
  alloc[String(newId)]=0;
  setBudgetAlloc(alloc);
  // restore Save button onclick
  document.querySelector('#setup-modal .btn-primary').setAttribute('onclick','saveSetup()');
  closeSetup();
  activeLoanIdx='dashboard';
  document.getElementById('first-run-banner').classList.remove('show');
  initApp();
  showTab('dashboard');
}

function confirmDeleteLoan(){
  const loans=loadLoans()||[];
  if(loans.length<=1)return; // guard
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  const label=loans[loanId]&&loans[loanId].label||'this loan';
  if(!confirm('Delete "'+label+'"?\n\nThis permanently removes all confirmed actuals and manual lump entries for this loan. This cannot be undone.'))return;
  const alloc=getBudgetAlloc()||{};
  const freed=alloc[String(loanId)]||0;
  // remove the deleted loan from the array
  loans.splice(loanId,1);
  // build new alloc using each surviving loan's PRE-renumber id, before renumbering
  const newAlloc={};
  loans.forEach((l,newIdx)=>{newAlloc[String(newIdx)]=alloc[String(l.id)]||0;});
  // shift per-loan localStorage keys (actuals + manual lumps) down for loans
  // that were above the deleted index; ascending order is safe (deleted slot already freed)
  localStorage.removeItem(actKey(loanId));
  localStorage.removeItem(manLumpKey(loanId));
  for(let newIdx=loanId;newIdx<loans.length;newIdx++){
    const oldIdx=newIdx+1;
    const act=localStorage.getItem(actKey(oldIdx));
    if(act!==null)localStorage.setItem(actKey(newIdx),act);else localStorage.removeItem(actKey(newIdx));
    const lump=localStorage.getItem(manLumpKey(oldIdx));
    if(lump!==null)localStorage.setItem(manLumpKey(newIdx),lump);else localStorage.removeItem(manLumpKey(newIdx));
  }
  // remove the now-stale top keys (the former last loan's old index)
  if(loans.length>loanId){
    localStorage.removeItem(actKey(loans.length));
    localStorage.removeItem(manLumpKey(loans.length));
  }
  // renumber ids sequentially
  loans.forEach((l,i)=>{l.id=i;});
  saveLoans(loans);
  // add freed allocation % to the first remaining loan
  if(loans.length>0)newAlloc['0']=(newAlloc['0']||0)+freed;
  if(loans.length===1){
    // back to single-loan: restore lt_budget_0 from the shared pool
    localStorage.setItem('lt_budget_0',getBudgetTotal());
    localStorage.removeItem('lt_budget_total');
    localStorage.removeItem('lt_budget_alloc');
  }else{
    setBudgetAlloc(newAlloc);
  }
  closeSetup();
  activeLoanIdx=0;
  initApp();
  if(loans.length>1)showTab('dashboard');
}

/* ─────────────────────────────────────────
   Utilities
───────────────────────────────────────── */
const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function ymFmt(t){const p=(t.dispDate||t.date).slice(0,7).split('-');return p[0]+' '+MN[+p[1]-1];}
const fmtE=n=>'€'+Math.round(n).toLocaleString('el-GR');
const f2x=n=>n===0?'&mdash;':n.toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2});
const LOAN_COLORS=['#2563eb','#15803d','#d97706'];
let activeLoanIdx=0;
let dashboardChart=null;

/* ─────────────────────────────────────────
   Tab bar and view switching
───────────────────────────────────────── */
function renderTabBar(){
  const loans=loadLoans()||[];
  const isMulti=loans.length>1;
  const tb=document.getElementById('tab-bar');
  if(!tb)return;
  if(!isMulti){tb.style.display='none';tb.innerHTML='';return;}
  tb.style.display='';
  const activeId=activeLoanIdx;
  let html='<button class="tab-btn'+(activeId==='dashboard'?' active':'')+'" onclick="showTab(\'dashboard\')">Dashboard</button>';
  loans.forEach((loan,i)=>{
    html+='<button class="tab-btn'+(activeId===i?' active':'')+'" onclick="showTab('+i+')">'+(loan.label||'Loan '+(i+1))+'</button>';
  });
  html+='<button class="tab-btn-add" onclick="startAddLoan()">+ Add</button>';
  tb.innerHTML=html;
}

function showTab(id){
  activeLoanIdx=id;
  renderTabBar();
  const dv=document.getElementById('dashboard-view');
  const lv=document.getElementById('loan-view');
  if(id==='dashboard'){
    if(dv)dv.style.display='';
    if(lv)lv.style.display='none';
    const sub=document.getElementById('app-subtitle');
    if(sub)sub.textContent='Dashboard · '+((loadLoans()||[]).length)+' loans';
    renderDashboard();
  }else{
    if(dv)dv.style.display='none';
    if(lv)lv.style.display='';
    initApp(); // full reload for the active loan (reloads _mS + per-loan budget); refreshLoan alone keeps stale _mS
  }
}

/* ─────────────────────────────────────────
   Dashboard (multi-loan overview)
───────────────────────────────────────── */
function escHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));}

// Computes projection data for all loans. Returns array of {loan,rows,sched,payoffMonth,intSaved,budget,nextUnconf,loanIdx}.
function computeAllLoansData(){
  const loans=loadLoans()||[];
  return loans.map((loan,i)=>{
    const rate=(loan.annualRate+loan.levy)/100/12;
    const postRate=(loan.postFixedRate&&loan.fixedPeriodMonths>0)?((loan.postFixedRate+loan.levy)/100/12):0;
    const startKey=projFirstMonth(loan);
    const{ey,em}=projEndMonth(loan);
    const budget=effectiveBudget(i);
    const{rows,sched}=genProj(budget,loan.balance,startKey,rate,ey,em,
      getManLumps(i),loan.lumpMonths,getActuals(i),
      loan.lumpEnabled!==false,loan.lumpEffect||'reduce-installment',
      !!loan.balloonEnabled,loan.balloonThreshold||0,loan.fixedPeriodMonths||0,postRate);
    const instRows=rows.filter(r=>r.type==='inst');
    const payoffMonth=instRows.length?instRows[instRows.length-1].month:'---';
    const baseInt=computeBaselineInterest(loan.balance,startKey,rate,ey,em,loan.fixedPeriodMonths||0,postRate);
    const planInt=instRows.reduce((s,r)=>s+r.int,0);
    const intSaved=baseInt-planInt;
    const nextUnconf=sched.find(r=>!r.confirmed&&!r.payoff);
    return{loan,rows,sched,payoffMonth,intSaved,budget,nextUnconf,loanIdx:i};
  });
}

function renderDashboard(){
  const data=computeAllLoansData();
  renderDashboardStats(data);
  renderDashboardNextMonth(data);
  renderDashboardLoanCards(data);
  renderDashboardBudget(data);
  renderDashboardChart(data);
  // annual schedule rendered on-demand via toggleAnnualSchedule()
}

function renderDashboardStats(data){
  const totalBal=data.reduce((s,d)=>s+computeProgressStats(d.sched,d.loan.balance).latestBal,0);
  const totalSaved=data.reduce((s,d)=>s+d.intSaved,0);
  const payoffs=data.map(d=>d.payoffMonth).filter(m=>m!=='---').sort();
  const earliest=payoffs[0]||'---';
  const fmtMon=m=>{if(m==='---')return '---';const p=m.split('-');return p[0]+' '+MN[+p[1]-1];};
  document.getElementById('dash-stats').innerHTML=
    '<div class="card"><div class="card-label">Total Outstanding</div><div class="card-value red">'+fmtE(totalBal)+'</div></div>'+
    '<div class="card"><div class="card-label">Total Interest Saved</div><div class="card-value green">'+fmtE(totalSaved)+'</div></div>'+
    '<div class="card"><div class="card-label">Earliest Payoff</div><div class="card-value green">'+fmtMon(earliest)+'</div></div>';
}

function renderDashboardNextMonth(data){
  const fmtMon=m=>{if(!m)return '';const p=m.split('-');return p[0]+' '+MN[+p[1]-1];};
  const nextMonths=data.map(d=>d.nextUnconf?d.nextUnconf.month:null).filter(Boolean).sort();
  const nextMon=nextMonths[0]||null;
  if(!nextMon){document.getElementById('dash-next-month').textContent='';return;}
  let parts=[];let total=0;
  data.forEach(d=>{
    const row=d.sched.find(r=>r.month===nextMon&&!r.confirmed);
    if(row){parts.push(escHtml(d.loan.label||'Loan')+'&nbsp;'+fmtE(row.inst+(row.lump||0)));total+=row.inst+(row.lump||0);}
  });
  document.getElementById('dash-next-month').innerHTML='<strong>'+fmtMon(nextMon)+':</strong>&nbsp;&nbsp;'+parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')+'&nbsp;&nbsp;·&nbsp;&nbsp;<strong>Total&nbsp;'+fmtE(total)+'</strong>';
}

function renderDashboardLoanCards(data){
  const fmtMon=m=>{if(m==='---')return '---';const p=m.split('-');return p[0]+' '+MN[+p[1]-1];};
  let html='';
  data.forEach((d,i)=>{
    const color=LOAN_COLORS[i%LOAN_COLORS.length];
    const ps=computeProgressStats(d.sched,d.loan.balance);
    const bal=ps.latestBal;
    html+='<div class="dash-loan-card" onclick="showTab('+d.loanIdx+')" style="border-top:3px solid '+color+'">'+
      '<div class="dash-loan-card-label" style="color:'+color+'">'+escHtml(d.loan.label||'Loan '+(i+1))+'</div>'+
      '<div class="dash-loan-card-balance">'+fmtE(bal)+'</div>'+
      '<div class="dash-loan-card-payoff">Payoff: '+fmtMon(d.payoffMonth)+'</div>'+
      '<div class="progress-track" style="margin:4px 0 0"><div class="progress-fill" style="width:'+ps.progressPct.toFixed(1)+'%;background:'+color+'"></div></div>'+
      '</div>';
  });
  document.getElementById('dash-loan-cards').innerHTML=html;
}

function renderDashboardBudget(data){
  const total=getBudgetTotal()||1000;
  const alloc=getBudgetAlloc()||{};
  let html='<div class="dash-budget-title">Monthly Budget</div>'+
    '<div class="dash-budget-row">'+
    '<span class="dash-budget-label">Total</span>'+
    '<input type="number" id="dash-total-budget" value="'+total+'" step="10" min="0" style="width:90px;border:1px solid #cbd5e1;border-radius:4px;padding:3px 6px" onchange="onDashBudgetTotalChange(this.value)">'+
    '&nbsp;<span style="font-size:.82rem;color:#64748b">€ / month</span></div>';
  data.forEach((d,i)=>{
    const color=LOAN_COLORS[i%LOAN_COLORS.length];
    const pct=alloc[String(i)]||0;
    const eur=Math.round(total*pct/100);
    html+='<div class="dash-budget-row">'+
      '<span class="dash-budget-label" style="color:'+color+'">'+escHtml(d.loan.label||'Loan '+(i+1))+'</span>'+
      '<input type="range" min="0" max="100" step="5" value="'+pct+'" style="flex:1;accent-color:'+color+'" oninput="onDashAllocChange(\''+String(i)+'\',+this.value,this)">'+
      '<input type="number" min="0" max="100" value="'+pct+'" class="dash-budget-pct" id="dash-pct-'+String(i)+'" onchange="onDashAllocChange(\''+String(i)+'\',+this.value,null)">'+
      '<span style="font-size:.78rem;color:#64748b">%&nbsp;=&nbsp;</span>'+
      '<span class="dash-budget-eur" id="dash-eur-'+String(i)+'">'+fmtE(eur)+'</span>'+
      '</div>';
  });
  html+='<div class="dash-budget-warn" id="dash-budget-warn">⚠ Allocations must sum to 100%</div>';
  document.getElementById('dash-budget').innerHTML=html;
  checkBudgetSum();
}

function onDashBudgetTotalChange(val){
  const v=parseFloat(val)||0;
  setBudgetTotal(v);
  renderDashboard();
}

function onDashAllocChange(loanId,newPct,sliderEl){
  newPct=Math.max(0,Math.min(100,Math.round(newPct)));
  const alloc=getBudgetAlloc()||{};
  const newAlloc=redistributeBudgetAlloc(alloc,loanId,newPct);
  setBudgetAlloc(newAlloc);
  const total=getBudgetTotal()||1000;
  Object.keys(newAlloc).forEach(id=>{
    const pctEl=document.getElementById('dash-pct-'+id);
    const eurEl=document.getElementById('dash-eur-'+id);
    if(pctEl)pctEl.value=newAlloc[id];
    if(eurEl)eurEl.textContent=fmtE(Math.round(total*newAlloc[id]/100));
    if(sliderEl){
      const rows=document.querySelectorAll('#dash-budget .dash-budget-row input[type=range]');
      rows.forEach(r=>{
        const pctSib=r.nextElementSibling;
        if(pctSib&&pctSib.id==='dash-pct-'+id)r.value=newAlloc[id];
      });
    }
  });
  checkBudgetSum();
}

function checkBudgetSum(){
  const alloc=getBudgetAlloc()||{};
  const sum=Object.values(alloc).reduce((s,v)=>s+v,0);
  const warn=document.getElementById('dash-budget-warn');
  if(warn)warn.style.display=(sum!==100)?'':'none';
}

function renderDashboardChart(data){
  if(dashboardChart){dashboardChart.destroy();dashboardChart=null;}
  if(!data.length)return;
  const allMonths=new Set();
  data.forEach(d=>d.rows.filter(r=>r.type==='inst').forEach(r=>allMonths.add(r.month)));
  const labels=[...allMonths].sort();
  const datasets=data.map((d,i)=>{
    const color=LOAN_COLORS[i%LOAN_COLORS.length];
    const balMap={};d.rows.filter(r=>r.type==='inst').forEach(r=>{balMap[r.month]=r.bal;});
    return{
      label:d.loan.label||'Loan '+(i+1),
      data:labels.map(m=>balMap[m]!=null?balMap[m]:null),
      borderColor:color,tension:.3,pointRadius:0,borderWidth:2,fill:false,spanGaps:false
    };
  });
  const ctx=document.getElementById('dashboardChart');
  if(!ctx)return;
  dashboardChart=new Chart(ctx.getContext('2d'),{type:'line',data:{labels,datasets},
    options:{responsive:true,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},
      scales:{
        x:{ticks:{maxTicksLimit:20,font:{size:10},callback(v){const l=this.getLabelForValue(v),d=new Date(l+'-01');return d.getMonth()%6===0?d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear():''}},grid:{color:'rgba(0,0,0,.04)'}},
        y:{ticks:{font:{size:10},callback:v=>'€'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}}
      }
    }
  });
}

let _annualOpen=false;
function toggleAnnualSchedule(){
  const el=document.getElementById('dash-annual');
  const btn=document.querySelector('.dash-annual-toggle');
  if(!el)return;
  _annualOpen=!_annualOpen;
  el.style.display=_annualOpen?'':'none';
  if(btn)btn.innerHTML=(_annualOpen?'&#9660;':'&#9654;')+' Annual schedule';
  if(_annualOpen)renderAnnualSchedule();
}

function renderAnnualSchedule(){
  const data=computeAllLoansData();
  const byYear={};
  data.forEach(d=>{
    d.rows.forEach(r=>{
      const yr=r.month.slice(0,4);
      if(!byYear[yr])byYear[yr]={inst:0,int:0,prin:0,lump:0,bal:0};
      if(r.type==='inst'){byYear[yr].inst+=r.inst;byYear[yr].int+=r.int;byYear[yr].prin+=r.inst-r.int;byYear[yr].bal=r.bal;}
      if(r.type==='extra'){byYear[yr].lump+=r.inst;}
    });
  });
  const balByYear={};
  Object.keys(byYear).forEach(yr=>{balByYear[yr]=0;});
  data.forEach(d=>{
    const yearBals={};
    d.rows.filter(r=>r.type==='inst').forEach(r=>{yearBals[r.month.slice(0,4)]=r.bal;});
    Object.keys(yearBals).forEach(yr=>{balByYear[yr]=(balByYear[yr]||0)+yearBals[yr];});
  });

  const years=Object.keys(byYear).sort();
  let html='<div class="tbl-wrap"><table class="txn"><thead><tr>'+
    '<th>Year</th><th class="num">Instalments</th><th class="num">Interest</th><th class="num">Principal</th><th class="num">Lump Sums</th><th class="num">Balance</th>'+
    '</tr></thead><tbody>';
  years.forEach(yr=>{
    const r=byYear[yr];
    html+='<tr><td>'+yr+'</td>'+
      '<td class="num">'+f2x(r.inst)+'</td>'+
      '<td class="num" style="color:#c2410c">'+f2x(r.int)+'</td>'+
      '<td class="num" style="color:#16a34a">'+f2x(r.prin)+'</td>'+
      '<td class="num" style="color:#2563eb">'+f2x(r.lump)+'</td>'+
      '<td class="num bal-owed">'+f2x(balByYear[yr]||0)+'</td></tr>';
  });
  html+='</tbody></table></div>';
  document.getElementById('dash-annual').innerHTML=html;
}

/* ─────────────────────────────────────────
   Projection engine
───────────────────────────────────────── */

function computePlanStats(mRows,mS){
  const LOAN_RATE=(mS.annualRate+mS.levy)/100/12;
  const postRate=(mS.postFixedRate&&mS.fixedPeriodMonths>0)?((mS.postFixedRate+mS.levy)/100/12):0;
  const{ey,em}=projEndMonth(mS);
  const mBI=computeBaselineInterest(mS.balance,projFirstMonth(mS),LOAN_RATE,ey,em,mS.fixedPeriodMonths||0,postRate);
  const mBase=amortizeSimple(mS.balance,LOAN_RATE,mS.months);
  const mPI=mRows.filter(r=>r.type==='inst').reduce((s,r)=>s+r.int,0);
  const mLT=mRows.filter(r=>r.type==='extra').reduce((s,r)=>s+r.inst,0);
  const mLN=mRows.filter(r=>r.type==='extra').length;
  const mSv=mBI-mPI;
  const mInst=mRows.filter(r=>r.type==='inst');
  const mPayoff=mInst.length?mInst[mInst.length-1].month:'---';
  const fmtMon=m=>{const p=m.split('-');return p[0]+' '+MN[+p[1]-1];};
  document.getElementById('m-plan-int').textContent=fmtE(mPI);
  document.getElementById('m-base-int').textContent=fmtE(mBI);
  document.getElementById('m-int-saved').textContent=fmtE(mSv);
  document.getElementById('m-lumps-total').textContent=mLN+' payments = '+fmtE(mLT);
  document.getElementById('m-payoff').textContent=fmtMon(mPayoff);
  const mTimeSaved=mBase.length-mInst.length;
  document.getElementById('m-time-saved').textContent=mTimeSaved>0?'~'+(Math.round(mTimeSaved/12*10)/10)+' yrs':'--';
  document.getElementById('m-next-lump').textContent=(()=>{const nx=mRows.find(r=>r.type==='extra');return nx?fmtMon(nx.month)+' · '+fmtE(nx.inst):'None';})();
  document.getElementById('card-saved').textContent=fmtE(mSv);
  document.getElementById('card-saved-sub').textContent=fmtE(mSv)+' vs no extras';
  document.getElementById('card-payoff').textContent=fmtMon(mPayoff);
  document.getElementById('card-payoff-sub').textContent='Loan '+fmtMon(mPayoff);
  document.getElementById('card-total-debt').textContent=fmtE(mS.balance);
  document.getElementById('card-total-sub').textContent=fmtE(mS.balance)+' loan balance';
  document.getElementById('m-bal-stat').textContent=fmtE(mS.balance);
  document.getElementById('m-badge').textContent=(mS.annualRate+mS.levy).toFixed(2)+'% · '+Math.round(mS.months/12*10)/10+'y';
  if(typeof activeLoanIdx==='number'){
    document.getElementById('app-subtitle').textContent=(mS.label||'Loan')+' · '+MN[mS.startMonth-1]+' '+mS.startYear;
  }
  const footerRate=mS.postFixedRate&&mS.fixedPeriodMonths>0?'Rate '+mS.annualRate.toFixed(2)+'% fixed ('+mS.fixedPeriodMonths+' mo) → '+mS.postFixedRate.toFixed(2)+'% + '+mS.levy.toFixed(2)+'% levy':'Rate '+mS.annualRate.toFixed(2)+'% fixed + '+mS.levy.toFixed(2)+'% levy';
  const lumpMons=Array.isArray(mS.lumpMonths)?mS.lumpMonths:[mS.lumpMonth!=null?mS.lumpMonth:8];
  document.getElementById('app-footer').textContent=footerRate+' · Annual lump in '+lumpMons.map(m=>MN[m-1]).join(', ')+' · Budget drives lump formula dynamically';
  const ps=computeProgressStats(mSchedule,mS.balance);
  const pfill=document.getElementById('m-progress-fill');
  if(pfill)pfill.style.width=ps.progressPct.toFixed(2)+'%';
  const pstat=document.getElementById('m-so-far-stats');
  if(pstat)pstat.textContent=fmtE(ps.principalReduced)+' principal reduced · '+fmtE(ps.interestPaid)+' interest · '+fmtE(ps.extrasSoFar)+' extras so far';
  return{mBase};
}

let chart=null;
function buildLabels(mS){
  const l=[];
  const sy=mS.startYear,sm=mS.startMonth;
  const{ey,em}=projEndMonth(mS);
  // extend one month past payoff for a clean trailing zero
  let ey2=ey,em2=em+1;if(em2>12){em2-=12;ey2++;}
  for(let y=sy;y<=ey2;y++){
    const ms=y===sy?sm:1,me=y===ey2?em2:12;
    for(let m=ms;m<=me;m++)l.push(`${y}-${String(m).padStart(2,'0')}`);
  }
  return l;
}

function makeMarkersPlugin(markers){
  return {id:'markers',afterDraw(c){
    markers.forEach(function(m){
      const i=c.data.labels.indexOf(m.month);
      if(i<0)return;
      const x=c.scales.x.getPixelForValue(i),ya=c.scales.y,ctx=c.ctx;
      ctx.save();
      ctx.beginPath();ctx.moveTo(x,ya.top);ctx.lineTo(x,ya.bottom);
      ctx.strokeStyle=m.color;ctx.lineWidth=1.5;ctx.setLineDash([6,3]);ctx.stroke();
      ctx.setLineDash([]);ctx.fillStyle=m.color;
      ctx.font='600 10px sans-serif';ctx.textAlign='center';
      ctx.fillText(m.label1,x,ya.top+12);
      if(m.label2)ctx.fillText(m.label2,x,ya.top+24);
      ctx.restore();
    });
  }};
}

function buildChart(mBase,mPlanMap,mLumpsMap,mS){
  const mStartKey=mS.startYear+'-'+String(mS.startMonth).padStart(2,'0');
  let mBSmon=mS.startMonth+1,mBSyr=mS.startYear;if(mBSmon>12){mBSmon=1;mBSyr++;}
  const mBSkey=mBSyr+'-'+String(mBSmon).padStart(2,'0');
  const labels=buildLabels(mS);
  const mP=labels.map(l=>{if(l===mStartKey)return mS.balance;const v=mPlanMap[l];return(v!=null&&v>0)?v:null;});
  const mBS=labels.indexOf(mBSkey);
  const mBD=labels.map((_,i)=>{const x=i-mBS;return x>=0&&x<mBase.length&&mBase[x]>0?mBase[x]:null;});
  const mLD=labels.map(l=>(l in mLumpsMap)&&(mPlanMap[l]!=null)?mPlanMap[l]:null);
  const _markers=[];
  if(mS.rateType==='fixed'&&mS.fixedPeriodMonths>0){
    let em=mS.startMonth+mS.fixedPeriodMonths,ey=mS.startYear;
    while(em>12){em-=12;ey++;}
    const fxKey=ey+'-'+String(em).padStart(2,'0');
    _markers.push({month:fxKey,color:'#f97316',label1:'Rate end',label2:MN[em-1]+' '+ey});
  }
  if(mS.targetPayoffDate){
    const tmo=+mS.targetPayoffDate.slice(5,7);
    const tyr=mS.targetPayoffDate.slice(0,4);
    _markers.push({month:mS.targetPayoffDate,color:'#a855f7',label1:'Goal',label2:MN[tmo-1]+' '+tyr});
  }
  const fxPlugin=makeMarkersPlugin(_markers);
  if(chart)chart.destroy();
  chart=new Chart(document.getElementById('balanceChart').getContext('2d'),{type:'line',plugins:[fxPlugin],data:{labels,datasets:[
    {label:'Loan (plan)',data:mP,borderColor:'#2563eb',tension:.3,pointRadius:0,borderWidth:2,borderDash:[6,3],fill:false},
    {label:'Loan (no extras)',data:mBD,borderColor:'rgba(37,99,235,.28)',tension:.3,pointRadius:0,borderWidth:1.5,borderDash:[2,4],fill:false},
    {label:'L lump',data:mLD,borderColor:'transparent',backgroundColor:'#1d4ed8',pointRadius:5,pointHoverRadius:7,showLine:false},
  ]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{boxWidth:12,font:{size:11},filter:i=>!i.text.includes('lump')}},tooltip:{callbacks:{label:c=>{if(c.raw===null)return null;if(c.dataset.label.includes('lump')){const lbl=c.label;return 'Lump: '+fmtE(mLumpsMap[lbl]||0);}return c.dataset.label+': '+fmtE(c.raw);}}}},scales:{x:{ticks:{maxTicksLimit:20,font:{size:10},callback(v){const l=this.getLabelForValue(v),d=new Date(l+'-01');return d.getMonth()%6===0?d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear():''}},grid:{color:'rgba(0,0,0,.04)'}},y:{ticks:{font:{size:10},callback:v=>'€'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(0,0,0,.05)'}}}}});
}


/* mSchedule is assigned by the caller from genProj.sched
   exposes a parallel per-month array of δοσολόγιο rows:
   {month,principal,interest,inst,lump,autoLump,manualLump,bal} */
let mSchedule=[];


/* renders the unified δοσολόγιο from mSchedule */
function renderProj(tbodyId,loanIdx){
  const tbody=document.getElementById(tbodyId);
  tbody.innerHTML='';
  let n=0,prevYr='';let html='';
  mSchedule.forEach((row,idx)=>{
    n++;
    const locked=!!row.confirmed;
    const principal=row.principal;
    const interest=row.interest;
    const inst=row.inst;
    const lump=row.lump;
    const bal=row.bal;
    const yr=row.month.slice(0,4);
    if(yr!==prevYr){html+=`<tr class="tr-sep"><td colspan="7">${yr}</td></tr>`;prevYr=yr;}
    // balloon payoff + lump same month: emit a separate lump row before the payoff row
    if(row.payoff&&lump>0){
      const balPost=+(row.payoffAmt+inst-interest).toFixed(2);
      html+=`<tr class="tr-lump"><td style="color:#bbb;font-size:.7rem">${n}</td><td>${row.month.slice(0,4)+' '+MN[+row.month.slice(5,7)-1]}</td><td class="num">&mdash;</td><td class="num">&mdash;</td><td class="num">&mdash;</td><td class="num" style="color:#15803d">${f2x(lump)}</td><td class="bal-owed">${f2x(balPost)}</td></tr>`;
      n++;
    }
    const rowCls=locked?'tr-confirmed':row.payoff?'tr-payoff':row.autoLump?'tr-lump':'';
    const numCol=locked
      ?`<td style="font-size:.7rem"><span class="lock-ic" title="Confirmed — click to edit" onclick="unlockRow(${loanIdx},${idx})">&#128274;</span> ${n}</td>`
      :`<td style="color:#bbb;font-size:.7rem">${n} <span class="lock-ic" title="Mark as paid — confirm actual amounts" onclick="unlockRow(${loanIdx},${idx})" style="color:#2563eb">&#10003;</span></td>`;
    let lumpCell;
    const manL=locked?0:(row.manualLump||0);
    if(row.payoff&&row.payoffAmt>0){
      lumpCell=`<td class="num" style="color:#7c3aed;font-weight:700" id="pl-${loanIdx}-${idx}" title="Balloon payoff">Payoff ${f2x(row.payoffAmt)}</td>`;
    } else if(lump>0&&!locked){
      const t=manL>0?`Manual lump €${f2x(manL)} (click to edit)`:'Add manual lump sum';
      lumpCell=`<td class="num" id="pl-${loanIdx}-${idx}"><span class="lump-add${manL>0?' lump-set':''}" title="${t}" onclick="addLump(${loanIdx},${idx},'${row.month}')">${f2x(lump)}</span></td>`;
    }
    else if(lump>0){lumpCell=`<td class="num" style="color:#15803d" id="pl-${loanIdx}-${idx}">${f2x(lump)}</td>`;}
    else if(!locked){lumpCell=`<td class="num" id="pl-${loanIdx}-${idx}"><span class="lump-add" title="Add manual lump sum" onclick="addLump(${loanIdx},${idx},'${row.month}')">+</span></td>`;}
    else{lumpCell=`<td class="num" id="pl-${loanIdx}-${idx}">&mdash;</td>`;}
    html+=`<tr class="${rowCls}" id="prow-${loanIdx}-${idx}">
      ${numCol}
      <td>${row.month.slice(0,4)+' '+MN[+row.month.slice(5,7)-1]}</td>
      <td class="num" style="color:#16a34a" id="pp-${loanIdx}-${idx}">${f2x(principal)}</td>
      <td class="num" style="color:#c2410c" id="pn-${loanIdx}-${idx}">${f2x(interest)}</td>
      <td class="num" id="pi-${loanIdx}-${idx}">${f2x(inst)}</td>
      ${lumpCell}
      <td class="bal-owed">${f2x(bal)}</td></tr>`;
  });
  tbody.innerHTML=html;
}

/* unlock / mark-as-paid → inline edit (principal / interest / installment / lump)
   Pre-fills with the row's current figures (projected for new rows, or the
   previously-saved actuals for an already-confirmed row). */
function unlockRow(loanIdx,idx){
  const row=mSchedule[idx];if(!row)return;
  const p=row.principal,it=row.interest,ins=row.inst,lm=row.lump||0;
  document.getElementById(`pp-${loanIdx}-${idx}`).innerHTML=`<span class="act-input" style="display:inline-block;color:#aaa" title="Derived: instalment − interest">${(+Math.max(0,ins-it)).toFixed(2)}</span>`;
  document.getElementById(`pn-${loanIdx}-${idx}`).innerHTML=`<input class="act-input" id="an-${loanIdx}-${idx}" type="number" value="${(+it).toFixed(2)}" step="0.01">`;
  document.getElementById(`pi-${loanIdx}-${idx}`).innerHTML=`<input class="act-input" id="ai-${loanIdx}-${idx}" type="number" value="${(+ins).toFixed(2)}" step="0.01">`;
  document.getElementById(`pl-${loanIdx}-${idx}`).innerHTML=`<input class="act-input" id="al-${loanIdx}-${idx}" type="number" value="${lm?(+lm).toFixed(2):''}" placeholder="0.00" step="0.01"> <button class="btn-save" onclick="confirmActual(${loanIdx},${idx},'${row.month}')">Save</button><button class="btn-cancel" onclick="refreshLoan()">Cancel</button>`;
}

/* future row: inline manual lump sum entry */
function addLump(loanIdx,idx,month){
  const cur=getManLumps(loanIdx)[month]||0;
  document.getElementById(`pl-${loanIdx}-${idx}`).innerHTML=`<input class="act-input" id="al-${loanIdx}-${idx}" type="number" value="${cur||''}" placeholder="0.00" step="0.01" onkeydown="if(event.key==='Enter'){saveLumpEntry(${loanIdx},${idx},'${month}')}else if(event.key==='Escape'){renderProj('m-proj-tbody',${loanIdx})}"> <button class="btn-save" onclick="saveLumpEntry(${loanIdx},${idx},'${month}')">Save</button><button class="btn-cancel" onclick="renderProj('m-proj-tbody',${loanIdx})">Cancel</button>`;
  const inp=document.getElementById(`al-${loanIdx}-${idx}`);if(inp)inp.focus();
}
function saveLumpEntry(loanIdx,idx,month){
  const amt=parseFloat(document.getElementById(`al-${loanIdx}-${idx}`).value)||0;
  saveManLump(loanIdx,month,amt);
  refreshLoan();
}

function confirmActual(loanIdx,idx,month){
  const interest=parseFloat(document.getElementById(`an-${loanIdx}-${idx}`).value)||0;
  const inst=parseFloat(document.getElementById(`ai-${loanIdx}-${idx}`).value)||0;
  const lump=parseFloat(document.getElementById(`al-${loanIdx}-${idx}`).value)||0;
  saveActual(loanIdx,month+'_inst',{int:interest,inst,lump,saved:true});
  refreshLoan();
}

/* ─────────────────────────────────────────
   Module-level state
───────────────────────────────────────── */
let mProjRows=[];
let _mS=null; // active loan setup (for budget refresh)

function rebuildChart(){
  const mp=rowsToPlanMap(mProjRows);
  const ml=rowsToLumpMap(mProjRows);
  const{mBase}=computePlanStats(mProjRows,_mS);
  buildChart(mBase,mp,ml,_mS);
}

function refreshPayoffPanel(){
  if(!_mS)return;
  const panel=document.getElementById('payoff-panel');
  if(!panel)return;
  const isReduceInst=(_mS.lumpEffect||'reduce-installment')==='reduce-installment';
  document.getElementById('payoff-panel-na').style.display=isReduceInst?'none':'';
  document.getElementById('payoff-panel-content').style.display=isReduceInst?'':'none';
  if(!isReduceInst)return;
  // populate month picker with future unconfirmed rows
  const sel=document.getElementById('pp-month');
  sel.innerHTML='';
  const future=mSchedule.filter(r=>!r.confirmed&&!r.payoff);
  future.forEach(r=>{
    const o=document.createElement('option');
    o.value=r.month;
    o.textContent=r.month.slice(0,4)+' '+MN[+r.month.slice(5,7)-1];
    sel.appendChild(o);
  });
  updatePayoffPanel();
}

function applyEarlySettlement(mode){
  if(!_mS)return;
  let threshold=0;
  if(mode==='month'){
    const targetMonth=document.getElementById('pp-month').value;
    const tIdx=mSchedule.findIndex(r=>r.month===targetMonth);
    threshold=tIdx>0?mSchedule[tIdx-1].bal:(_mS?_mS.balance:0);
  } else {
    threshold=parseFloat(document.getElementById('pp-amount').value)||0;
  }
  if(!threshold)return;
  const loans=loadLoans()||[];
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  loans[loanId]={...loans[loanId],balloonEnabled:true,balloonThreshold:threshold};
  saveLoans(loans);
  _mS=loans[loanId];
  refreshLoan();
}
function updatePayoffPanel(){
  // Mode A: target month -> required lump sum (opening balance of that month)
  const targetMonth=document.getElementById('pp-month').value;
  if(!targetMonth){document.getElementById('pp-result-month').textContent='—';document.getElementById('pp-result-amount').textContent='—';document.getElementById('pp-apply-month').style.display='none';document.getElementById('pp-apply-amount').style.display='none';return;}
  const tIdx=mSchedule.findIndex(r=>r.month===targetMonth);
  const openingBal=tIdx>0?mSchedule[tIdx-1].bal:(_mS?_mS.balance:0);
  const tmo=+targetMonth.slice(5,7);
  document.getElementById('pp-result-month-when').textContent=MN[tmo-1]+' '+targetMonth.slice(0,4);
  const hasMonResult=openingBal>0;
  document.getElementById('pp-result-month').textContent=hasMonResult?fmtE(openingBal):'—';
  document.getElementById('pp-apply-month').style.display=hasMonResult?'':'none';
  // Mode B: lump sum amount -> earliest payoff month
  const amt=parseFloat(document.getElementById('pp-amount').value)||0;
  if(amt>0){
    const hit=mSchedule.find((r,i)=>!r.confirmed&&!r.payoff&&(i===0?_mS.balance:mSchedule[i-1].bal)<=amt);
    document.getElementById('pp-result-amount').textContent=hit?(hit.month.slice(0,4)+' '+MN[+hit.month.slice(5,7)-1]):'Balance never reaches this amount';
    document.getElementById('pp-apply-amount').style.display=hit?'':'none';
  } else {
    document.getElementById('pp-result-amount').textContent='—';
    document.getElementById('pp-apply-amount').style.display='none';
  }
}



function refreshLoan(){
  if(!_mS)return;
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  const budget=parseFloat(document.getElementById('loan-budget').value)||1000;
  // single-loan: persist to lt_budget_<id>; multi-loan total is managed via Dashboard
  localStorage.setItem('lt_budget_'+loanId,budget);
  const rate=(_mS.annualRate+_mS.levy)/100/12;
  const startKey=projFirstMonth(_mS);
  const{ey,em}=projEndMonth(_mS);
  const postRate=(_mS.postFixedRate&&_mS.fixedPeriodMonths>0)?((_mS.postFixedRate+_mS.levy)/100/12):0;
  // destructure return value; assign rows + schedule from result object
  const _r1=genProj(budget,_mS.balance,startKey,rate,ey,em,getManLumps(loanId),_mS.lumpMonths,getActuals(loanId),_mS.lumpEnabled!==false,_mS.lumpEffect||'reduce-installment',!!_mS.balloonEnabled,_mS.balloonThreshold||0,_mS.fixedPeriodMonths||0,postRate);mProjRows=_r1.rows;mSchedule=_r1.sched;
  renderProj('m-proj-tbody',loanId);
  rebuildChart();
  refreshPayoffPanel();
  const bnEl=document.getElementById('budget-bar-note');
  if(bnEl)bnEl.textContent=_mS&&_mS.lumpEnabled!==false?'Accumulates surplus; pays once a year as lump sum':'No lump sum — installments only';
}

/* ─────────────────────────────────────────
   App init — reads from localStorage
───────────────────────────────────────── */
function initApp(){
  migrateV1();
  const loanId=typeof activeLoanIdx==='number'?activeLoanIdx:0;
  const mS=loadLoan(loanId);

  if(!mS){
    document.getElementById('first-run-banner').classList.add('show');
    openSetup(true);
    return;
  }
  // a loan exists — ensure the first-run banner is cleared (e.g. after import)
  document.getElementById('first-run-banner').classList.remove('show');

  _mS=mS;

  const LOAN_RATE=(mS.annualRate+mS.levy)/100/12;
  const mStartKey=projFirstMonth(mS);
  const{ey:mEy,em:mEm}=projEndMonth(mS);

  const mB=effectiveBudget(loanId)||parseFloat(localStorage.getItem('lt_budget_'+loanId))||1000;
  document.getElementById('loan-budget').value=mB;

  const mPostRate=(mS.postFixedRate&&mS.fixedPeriodMonths>0)?((mS.postFixedRate+mS.levy)/100/12):0;
  // destructure return value; assign rows + schedule from result object
  const _r2=genProj(mB,mS.balance,mStartKey,LOAN_RATE,mEy,mEm,getManLumps(loanId),mS.lumpMonths,getActuals(loanId),mS.lumpEnabled!==false,mS.lumpEffect||'reduce-installment',!!mS.balloonEnabled,mS.balloonThreshold||0,mS.fixedPeriodMonths||0,mPostRate);mProjRows=_r2.rows;mSchedule=_r2.sched;

  renderProj('m-proj-tbody',loanId);
  rebuildChart();
  refreshPayoffPanel();
  const bnEl=document.getElementById('budget-bar-note');
  if(bnEl)bnEl.textContent=mS&&mS.lumpEnabled!==false?'Accumulates surplus; pays once a year as lump sum':'No lump sum — installments only';
  renderTabBar();
  const loans=loadLoans()||[];
  if(loans.length>1){
    document.getElementById('tab-bar').style.display='';
  }
}

function loadExample(){
  openSetup(true);
  document.getElementById('s-loan-bal').value='200000';
  document.getElementById('s-loan-months').value='360';
  document.getElementById('s-loan-rate').value='4.2';
  document.getElementById('s-loan-levy').value='0.12';
  document.getElementById('s-loan-rtype').value='fixed';
  document.getElementById('s-loan-fixedperiod').value='120';
  document.getElementById('s-loan-postrate').value='4.2';
  document.getElementById('s-loan-startmon').value='1';
  document.getElementById('s-loan-startyear').value='2026';
  renderLumpMonthChecks([8]);
  document.getElementById('s-loan-lump-enabled').checked=false;
  document.getElementById('s-loan-effect').value='reduce-installment';
  document.getElementById('s-loan-goalmon').value='12';
  document.getElementById('s-loan-goalyear').value='2046';
  document.getElementById('s-loan-balloon-enabled').checked=true;
  document.getElementById('s-loan-balloon').value='5000';
  toggleFixedPeriod();toggleLumpOptions();toggleBalloonOptions();
}

function openHelp(){document.getElementById('help-modal').classList.add('open');}
function closeHelp(){document.getElementById('help-modal').classList.remove('open');}
function setVersion(){const v=document.getElementById('version-line');if(v)v.textContent='Loan Tracker '+APP_VERSION;}
setVersion();
initApp();