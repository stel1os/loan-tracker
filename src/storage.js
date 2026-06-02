const APP_VERSION='__APP_VERSION__';
const LS_LOANS='lt_loans';
const LS_OLD_MORT='lt_loan_mort';

function migrateV1(){
  if(localStorage.getItem(LS_LOANS))return;
  let old=null;
  try{old=JSON.parse(localStorage.getItem(LS_OLD_MORT));}catch(e){old=null;}
  if(!old)return;
  const loan={
    id:0,label:'Loan',
    balance:old.balance,months:old.months,annualRate:old.annualRate,
    levy:old.levy,rateType:old.rateType,startMonth:old.startMonth,
    startYear:old.startYear,lumpMonth:old.lumpMonth||8,seedInstallments:old.seedInstallments
  };
  localStorage.setItem(LS_LOANS,JSON.stringify([loan]));
  localStorage.removeItem(LS_OLD_MORT);
  localStorage.removeItem('lt_loan_rep');
  // migrate budget + actuals
  const ob=localStorage.getItem('mort_budget');
  if(ob!=null&&localStorage.getItem('lt_budget_0')==null)localStorage.setItem('lt_budget_0',ob);
  const oa=localStorage.getItem('mort_act');
  if(oa!=null&&localStorage.getItem('confirmed_0_act')==null)localStorage.setItem('confirmed_0_act',oa);
  localStorage.removeItem('mort_budget');localStorage.removeItem('rep_budget');
  localStorage.removeItem('mort_act');localStorage.removeItem('rep_act');
}
function loadLoans(){try{const a=JSON.parse(localStorage.getItem(LS_LOANS));if(!Array.isArray(a))return null;a.forEach(function(loan){if(loan&&!Array.isArray(loan.lumpMonths)){loan.lumpMonths=[loan.lumpMonth!=null?loan.lumpMonth:8];}if(loan)delete loan.lumpMonth;});return a;}catch(e){return null;}}
function saveLoans(arr){localStorage.setItem(LS_LOANS,JSON.stringify(arr));}
function loadLoan(idx){const a=loadLoans();return a&&a[idx]?a[idx]:null;}

function manLumpKey(idx){return 'lt_manlump_'+idx;}
function getManLumps(idx){try{return JSON.parse(localStorage.getItem(manLumpKey(idx))||'{}');}catch(e){return{};}}
function saveManLump(idx,month,amt){const m=getManLumps(idx);if(amt>0)m[month]=amt;else delete m[month];localStorage.setItem(manLumpKey(idx),JSON.stringify(m));}

function actKey(idx){return 'confirmed_'+idx+'_act';}
function getActuals(idx){try{return JSON.parse(localStorage.getItem(actKey(idx))||'{}');}catch(e){return{};}}
function saveActual(idx,key,data){const a=getActuals(idx);a[key]=data;localStorage.setItem(actKey(idx),JSON.stringify(a));}