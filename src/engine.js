// Pure calculation functions — no DOM, no localStorage
function projEndMonth(s){
  let ey=s.startYear,em=s.startMonth+s.months+1;
  while(em>12){em-=12;ey++;}
  return{ey,em};
}

function projFirstMonth(s){
  let y=s.startYear,m=s.startMonth+1;
  if(m>12){m=1;y++;}
  return y+'-'+String(m).padStart(2,'0');
}

function calcPmt(b,r,m){return b*r/(1-Math.pow(1+r,-m));}

function amortizeSimple(bal,rate,months){
  const pmt=calcPmt(bal,rate,months);const out=[];let b=bal;
  for(let m=0;m<months&&b>0.01;m++){const i=b*rate;b=Math.max(0,b-(pmt-i));out.push(+b.toFixed(2));}
  return out;
}

function rowsToPlanMap(rows){const map={};rows.filter(r=>r.type==='inst').forEach(r=>{map[r.month]=r.bal;});return map;}

function rowsToLumpMap(rows){const map={};rows.filter(r=>r.type==='extra').forEach(r=>{map[r.month]=r.inst;});return map;}


function genProj(budget,startBal,startMonthStr,rate,endYear,endMon,manLumps,lumpMonth,actuals,lumpEnabled,lumpEffect,balloonEnabled,balloonThreshold,fixedPeriodMonths,postFixedRate){
  const rows=[];const sched=[];let prev=startBal;
  const recent=[];
  manLumps=manLumps||{};
  lumpMonth=lumpMonth||8;
  actuals=actuals||{};
  lumpEnabled=lumpEnabled!==false;
  lumpEffect=lumpEffect||'reduce-installment';
  balloonEnabled=!!balloonEnabled;
  balloonThreshold=balloonThreshold||0;
  fixedPeriodMonths=fixedPeriodMonths||0;
  postFixedRate=postFixedRate||0;
  let currentRate=rate;
  let monthIdx=0;
  const[sy,sm]=startMonthStr.split('-').map(Number);
  const initRemM=(endYear-sy)*12+(endMon-sm);
  const initM=calcPmt(startBal,rate,Math.max(1,initRemM));
  let effEndYear=endYear,effEndMon=endMon;
  let[y,mo]=startMonthStr.split('-').map(Number);
  while(prev>0.5){
    const month=y+'-'+String(mo).padStart(2,'0');
    if((effEndYear-y)*12+(effEndMon-mo)<=0)break;
    const act=actuals[month+'_inst'];
    if(act&&act.saved){
      // Confirmed actual: use saved figures verbatim; balance flows downstream
      const aLump=act.lump||0,aInt=+(+act.int).toFixed(2),aInst=+(+act.inst).toFixed(2);
      const aPrin=act.principal!=null?+(+act.principal).toFixed(2):+(aInst-aInt).toFixed(2);
      const aBal=+(+act.bal).toFixed(2);
      if(aLump>0)rows.push({month,type:'extra',inst:aLump,int:0,bal:Math.max(0,prev-aLump)});
      rows.push({month,type:'inst',inst:aInst,int:aInt,bal:aBal});
      sched.push({month,principal:aPrin,interest:aInt,inst:aInst,lump:aLump,autoLump:false,bal:aBal,confirmed:true});
      recent.push(aInst);
      if(recent.length>12)recent.shift();
      prev=aBal;
      monthIdx++;
      mo++;if(mo>12){mo=1;y++;}
      continue;
    }
    if(fixedPeriodMonths>0&&postFixedRate>0&&monthIdx>=fixedPeriodMonths){currentRate=postFixedRate;}
    monthIdx++;
    let lump=0,autoLump=false;
    if(lumpEnabled&&mo===lumpMonth){
      const recent12=recent.slice(-12);
      const n12=recent12.length;
      const sum12=recent12.reduce((a,b)=>a+b,0);
      lump=Math.round(Math.max(Math.min(n12*budget-sum12,prev),0));
      if(lump>0)autoLump=true;
    }
    const man=manLumps[month]||0;
    if(man>0)lump+=man;
    lump=Math.min(lump,prev);
    const manualLump=Math.max(0,Math.min(man,prev));
    // lump sum applied BEFORE installment of the month
    const balPost=Math.max(0,prev-lump);
    // reduce-duration: after a lump sum, solve for new remaining term so installment stays constant
    if(lump>0&&lumpEffect==='reduce-duration'&&initM>0){
      const rP=rate*balPost/initM;
      if(rP>0&&rP<1){
        const newN=Math.max(1,Math.ceil(-Math.log(1-rP)/Math.log(1+rate)));
        let em=mo+newN,ey=y;
        while(em>12){em-=12;ey++;}
        effEndYear=ey;effEndMon=em;
      }
    }
    const remM=(effEndYear-y)*12+(effEndMon-mo);
    if(remM<=0)break;
    const interest=+(balPost*currentRate).toFixed(2);
    const inst=+(lumpEffect==='reduce-duration'?initM:calcPmt(balPost,currentRate,remM)).toFixed(2);
    const endBal=+Math.max(0,balPost+interest-inst).toFixed(2);
    const principal=+(inst-interest).toFixed(2);
    // balloon: if balance after installment <= threshold, emit single payoff row and stop.
    // lump (if any) is embedded in the row rather than pushed as a separate 'extra' row.
    // settlement holds the remaining balance so inst reflects only the regular payment.
    if(balloonEnabled&&balloonThreshold>0&&endBal>0&&endBal<=balloonThreshold){
      rows.push({month,type:'inst',inst,int:interest,bal:0,settlement:+endBal.toFixed(2),lump});
      sched.push({month,principal,interest,inst,lump,autoLump,manualLump,bal:0,confirmed:false,payoff:true,payoffAmt:+endBal.toFixed(2)});
      // return rows + sched together; caller assigns mSchedule (avoids global side-effect in Node)
      return{rows,sched};
    }
    if(lump>0)rows.push({month,type:'extra',inst:lump,int:0,bal:balPost});
    rows.push({month,type:'inst',inst,int:interest,bal:endBal});
    sched.push({month,principal,interest,inst,lump,autoLump,manualLump,bal:endBal,confirmed:false});
    recent.push(inst);
    if(recent.length>12)recent.shift();
    prev=endBal;
    mo++;if(mo>12){mo=1;y++;}
  }
  // return rows + sched together; caller assigns mSchedule (avoids global side-effect in Node)
  return{rows,sched};
}
// Returns total interest on the no-extras baseline using the correct two-phase rate schedule.
// Replaces single-rate amortizeSimple for interest-saved calculations on fixed-rate loans.
function computeBaselineInterest(bal,startMonthStr,rate,endYear,endMon,fixedPeriodMonths,postFixedRate){
  const{sched}=genProj(0,bal,startMonthStr,rate,endYear,endMon,{},1,{},false,'reduce-installment',false,0,fixedPeriodMonths||0,postFixedRate||0);
  return sched.reduce((a,s)=>a+s.interest,0);
}
// Export for Node.js test runner; guard keeps browser build unaffected
if(typeof module!=='undefined')module.exports={genProj,calcPmt,amortizeSimple,computeBaselineInterest,projEndMonth,projFirstMonth,rowsToPlanMap,rowsToLumpMap};
