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
     lumpMonth:        number,   // 1–12, month annual lump fires (default 8)
     seedInstallments: [n,n,n,n] // last 4 known installments, oldest→newest
   }

   Per-loan keys (index-prefixed for future multi-loan):
     lt_budget_0          — monthly budget for loan 0
     confirmed_0_act      — confirmed actual rows for loan 0

   Migration: loans missing lumpMonth default to 8 (August)
   via genProj param default and form fallbacks.

   Migration (v1 → v2): if lt_loans is absent but the old
   single-loan key lt_loan_mort exists, it is migrated into
   lt_loans[0] and the old key deleted. Old mort_budget /
   mort_act are migrated to lt_budget_0 / confirmed_0_act.
───────────────────────────────────────── */



function populateForm(data){
  if(!data){
    ['s-loan-bal','s-loan-months','s-loan-rate','s-loan-levy','s-loan-startmon','s-loan-startyear','s-loan-lumpmon','s-loan-fixedperiod','s-loan-postrate','s-loan-goalmon','s-loan-goalyear','s-loan-balloon'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('s-loan-rtype').value='fixed';
    document.getElementById('s-loan-lump-enabled').checked=false;
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
  document.getElementById('s-loan-lumpmon').value=data.lumpMonth??'8';
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
  populateForm(loadLoan(0));
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
  const lmon=parseInt(document.getElementById('s-loan-lumpmon').value,10)||8;
  const fixedPeriodMonths=parseInt(document.getElementById('s-loan-fixedperiod').value,10)||0;
  const postFixedRate=parseFloat(document.getElementById('s-loan-postrate').value)||null;
  const goalMon=document.getElementById('s-loan-goalmon').value;
  const goalYear=document.getElementById('s-loan-goalyear').value;
  const targetPayoffDate=(goalMon&&goalYear)?(goalYear+'-'+goalMon):null;
  const lumpEnabled=document.getElementById('s-loan-lump-enabled').checked;
  const lumpEffect=document.getElementById('s-loan-effect').value;
  const balloonEnabled=document.getElementById('s-loan-balloon-enabled').checked;
  const balloonThreshold=parseFloat(document.getElementById('s-loan-balloon').value)||0;
  return{bal,months,rate,levy,rtype,fixedPeriodMonths,postFixedRate,smon,syr,lmon,lumpEnabled,lumpEffect,balloonEnabled,balloonThreshold,targetPayoffDate};
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
  return ok;
}

function saveSetup(){
  clearErrors();
  const v=readForm();
  if(!validateForm(v))return;
  const loans=loadLoans()||[];
  const existing=loans[0]||{};
  loans[0]={
    id:0,label:existing.label||'Loan',
    balance:v.bal,months:v.months,annualRate:v.rate,levy:v.levy,
    rateType:v.rtype,startMonth:v.smon,startYear:v.syr,lumpMonth:v.lmon,
    fixedPeriodMonths:v.fixedPeriodMonths,postFixedRate:v.postFixedRate,targetPayoffDate:v.targetPayoffDate,
    lumpEnabled:v.lumpEnabled,lumpEffect:v.lumpEffect,
    balloonEnabled:v.balloonEnabled,balloonThreshold:v.balloonThreshold
  };
  saveLoans(loans);
  closeSetup();
  document.getElementById('first-run-banner').classList.remove('show');
  initApp();
}

/* ─────────────────────────────────────────
   Utilities
───────────────────────────────────────── */
const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function ymFmt(t){const p=(t.dispDate||t.date).slice(0,7).split('-');return p[0]+' '+MN[+p[1]-1];}
const fmtE=n=>'€'+Math.round(n).toLocaleString('el-GR');
const f2x=n=>n===0?'&mdash;':n.toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2});


/* ─────────────────────────────────────────
   Projection engine
───────────────────────────────────────── */

function computePlanStats(mRows,mS){
  const LOAN_RATE=(mS.annualRate+mS.levy)/100/12;
  const mBase=amortizeSimple(mS.balance,LOAN_RATE,mS.months);
  let mBI=0,b=mS.balance;mBase.forEach(v=>{mBI+=b*LOAN_RATE;b=v;});
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
  document.getElementById('app-subtitle').textContent=(mS.label||'Loan')+' · '+MN[mS.startMonth-1]+' '+mS.startYear;
  const footerRate=mS.postFixedRate&&mS.fixedPeriodMonths>0?'Rate '+mS.annualRate.toFixed(2)+'% fixed ('+mS.fixedPeriodMonths+' mo) → '+mS.postFixedRate.toFixed(2)+'% + '+mS.levy.toFixed(2)+'% levy':'Rate '+mS.annualRate.toFixed(2)+'% fixed + '+mS.levy.toFixed(2)+'% levy';
  document.getElementById('app-footer').textContent=footerRate+' · Annual lump in '+MN[(mS.lumpMonth||8)-1]+' · Budget drives lump formula dynamically';
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


/* genProj returns inst/extra rows (chart + stats) AND mSchedule
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
  document.getElementById(`pp-${loanIdx}-${idx}`).innerHTML=`<input class="act-input" id="ap-${loanIdx}-${idx}" type="number" value="${(+p).toFixed(2)}" step="0.01">`;
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
  const principal=parseFloat(document.getElementById(`ap-${loanIdx}-${idx}`).value)||0;
  const interest=parseFloat(document.getElementById(`an-${loanIdx}-${idx}`).value)||0;
  const inst=parseFloat(document.getElementById(`ai-${loanIdx}-${idx}`).value)||0;
  const lump=parseFloat(document.getElementById(`al-${loanIdx}-${idx}`).value)||0;
  // Balance carried forward = (opening − lump) + interest − installment.
  // Opening balance for this month = previous row's closing balance,
  // or the loan's opening balance for the very first row.
  const prevBal=idx>0?mSchedule[idx-1].bal:(_mS?_mS.balance:0);
  const bal=+Math.max(0,(prevBal-lump)+interest-inst).toFixed(2);
  saveActual(loanIdx,month+'_inst',{principal,int:interest,inst,lump,bal,saved:true});
  // Re-run the projection so every subsequent row recalculates from the
  // confirmed actual balance flowing downstream.
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
  loans[0]={...loans[0],balloonEnabled:true,balloonThreshold:threshold};
  saveLoans(loans);
  _mS=loans[0];
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
  const budget=parseFloat(document.getElementById('loan-budget').value)||1000;
  localStorage.setItem('lt_budget_0',budget);
  const rate=(_mS.annualRate+_mS.levy)/100/12;
  const startKey=projFirstMonth(_mS);
  const{ey,em}=projEndMonth(_mS);
  const postRate=(_mS.postFixedRate&&_mS.fixedPeriodMonths>0)?((_mS.postFixedRate+_mS.levy)/100/12):0;
  // destructure return value; assign rows + schedule from result object
  const _r1=genProj(budget,_mS.balance,startKey,rate,ey,em,getManLumps(0),_mS.lumpMonth,getActuals(0),_mS.lumpEnabled!==false,_mS.lumpEffect||'reduce-installment',!!_mS.balloonEnabled,_mS.balloonThreshold||0,_mS.fixedPeriodMonths||0,postRate);mProjRows=_r1.rows;mSchedule=_r1.sched;
  renderProj('m-proj-tbody',0);
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
  const mS=loadLoan(0);

  if(!mS){
    document.getElementById('first-run-banner').classList.add('show');
    openSetup(true);
    return;
  }

  _mS=mS;

  const LOAN_RATE=(mS.annualRate+mS.levy)/100/12;
  const mStartKey=projFirstMonth(mS);
  const{ey:mEy,em:mEm}=projEndMonth(mS);

  const mB=parseFloat(localStorage.getItem('lt_budget_0'))||1000;
  document.getElementById('loan-budget').value=mB;

  const mPostRate=(mS.postFixedRate&&mS.fixedPeriodMonths>0)?((mS.postFixedRate+mS.levy)/100/12):0;
  // destructure return value; assign rows + schedule from result object
  const _r2=genProj(mB,mS.balance,mStartKey,LOAN_RATE,mEy,mEm,getManLumps(0),mS.lumpMonth,getActuals(0),mS.lumpEnabled!==false,mS.lumpEffect||'reduce-installment',!!mS.balloonEnabled,mS.balloonThreshold||0,mS.fixedPeriodMonths||0,mPostRate);mProjRows=_r2.rows;mSchedule=_r2.sched;

  renderProj('m-proj-tbody',0);
  rebuildChart();
  refreshPayoffPanel();
  const bnEl=document.getElementById('budget-bar-note');
  if(bnEl)bnEl.textContent=mS&&mS.lumpEnabled!==false?'Accumulates surplus; pays once a year as lump sum':'No lump sum — installments only';
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
  document.getElementById('s-loan-lumpmon').value='8';
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