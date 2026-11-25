/* ─────────────────────────────────────────
   Online saving for the private copy (ASTRO-129)
   Only runs on the private Cloudflare copy (*.pages.dev). The public GitHub Pages copy never
   loads or saves online: nothing below runs there.
───────────────────────────────────────── */

// Keys that make up the loan data, the same set a backup file holds.
function isDataKey(k){return /^(lt_|confirmed_)/.test(k);}
// Data keys whose change is a real edit. Panel open/closed preferences are kept but do not trigger a save.
function isTrackedKey(k){return isDataKey(k)&&!/^lt_panel_/.test(k);}
function snapshotOf(store){
  const out={};
  for(let i=0;i<store.length;i++){const k=store.key(i);if(k&&isDataKey(k))out[k]=store.getItem(k);}
  return out;
}
function snapHasLoan(s){return !!(s&&typeof s.lt_loans==='string');}
function sameData(a,b){
  const ka=Object.keys(a||{}).filter(isTrackedKey).sort(),kb=Object.keys(b||{}).filter(isTrackedKey).sort();
  return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&a[k]===b[k]);
}
// What to do when the app opens or comes back into view.
// meta: what this browser last knew {cloudSavedAt, localSavedAt, dirty}, or null on a device that never synced.
// local: this browser's data. cloud: {savedAt, data} from the service.
// Returns 'none' | 'push' | 'adopt' | 'conflict-keep-cloud' | 'conflict-keep-local'.
function decideSync(meta,local,cloud){
  const cloudT=cloud&&cloud.savedAt||null;
  if(!meta){
    if(!cloudT)return snapHasLoan(local)?'push':'none';
    if(!snapHasLoan(local))return 'adopt';
    return sameData(local,cloud.data)?'adopt':'conflict-keep-cloud';
  }
  const cloudChanged=!!cloudT&&cloudT!==meta.cloudSavedAt;
  if(!meta.dirty)return cloudChanged?'adopt':'none';
  if(!cloudChanged)return 'push';
  return Date.parse(meta.localSavedAt)>Date.parse(cloudT)?'conflict-keep-local':'conflict-keep-cloud';
}
if(typeof module!=='undefined')module.exports={isDataKey,isTrackedKey,snapshotOf,sameData,decideSync};

(function(){
  if(typeof window==='undefined'||typeof localStorage==='undefined')return;
  const onPrivateCopy=window.LT_FORCE_CLOUD===true||(location.protocol==='https:'&&/\.pages\.dev$/.test(location.hostname));
  if(!onPrivateCopy)return;

  const META='loantracker_sync',API='/api/state',DELAY=2000,RETRY=30000;
  const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
  let meta=null;try{meta=JSON.parse(localStorage.getItem(META)||'null');}catch(e){meta=null;}
  let suppress=false,timer=null,inFlight=false,again=false,status={kind:'idle'},otherVersion=null;

  const saveMeta=()=>{try{rawSet.call(localStorage,META,JSON.stringify(meta));}catch(e){}};
  const hhmm=iso=>{const d=new Date(iso);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};

  function setStatus(s){status=s;renderSyncStatus();}
  function statusText(){
    switch(status.kind){
      case 'saved':return 'Saved online · '+hhmm(status.at);
      case 'saving':return 'Saving…';
      case 'offline':return 'Not saved: offline. Will save when back online';
      case 'signin':return 'Not saved: your sign-in has expired. Reload the page to sign in again';
      case 'error':return 'Not saved: the online copy could not be reached. Will try again';
      case 'loading':return 'Loading the online copy…';
      default:return meta&&meta.cloudSavedAt?'Saved online · '+hhmm(meta.cloudSavedAt):'Not saved online yet';
    }
  }
  window.renderSyncStatus=function(){
    const el=document.getElementById('menu-sync');if(!el)return;
    el.hidden=false;el.textContent=statusText();
    el.classList.toggle('stale',['offline','signin','error'].includes(status.kind));
  };

  // Any change to the loan data marks this browser as ahead of the online copy and schedules one grouped save.
  function onLocalChange(){
    if(suppress)return;
    if(localStorage.getItem('lt_loans'))hidePrivateStart();
    meta=Object.assign({cloudSavedAt:null},meta||{},{dirty:true,localSavedAt:new Date().toISOString()});
    saveMeta();
    setStatus({kind:'saving'});
    clearTimeout(timer);timer=setTimeout(push,DELAY);
  }
  Storage.prototype.setItem=function(k,v){
    const tracked=this===localStorage&&isTrackedKey(k),old=tracked?this.getItem(k):null;
    rawSet.call(this,k,v);
    if(tracked&&old!==String(v))onLocalChange();
  };
  Storage.prototype.removeItem=function(k){
    const tracked=this===localStorage&&isTrackedKey(k)&&this.getItem(k)!==null;
    rawRemove.call(this,k);
    if(tracked)onLocalChange();
  };

  async function call(method,body,extra){
    const r=await fetch(API,Object.assign({method,credentials:'same-origin',redirect:'manual',cache:'no-store',
      headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined},extra||{}));
    if(r.type==='opaqueredirect'||r.status===401||r.status===403)throw {signin:true};
    let j=null;try{j=await r.json();}catch(e){}
    return {status:r.status,body:j};
  }
  function failed(e){setStatus({kind:e&&e.signin?'signin':(navigator.onLine===false?'offline':'error')});}

  async function push(){
    clearTimeout(timer);
    if(!meta||!meta.dirty)return;
    if(inFlight){again=true;return;}
    inFlight=true;
    const savedAt=meta.localSavedAt;
    try{
      setStatus({kind:'saving'});
      const r=await call('PUT',{savedAt,data:snapshotOf(localStorage)});
      if(r.status===200){
        meta.cloudSavedAt=savedAt;
        if(meta.localSavedAt===savedAt)meta.dirty=false;
        saveMeta();setStatus({kind:'saved',at:savedAt});
      }else if(r.status===409&&r.body){
        resolve('conflict-keep-cloud',r.body);
      }else{setStatus({kind:'error'});}
    }catch(e){failed(e);}
    finally{inFlight=false;}
    if(again||(meta&&meta.dirty&&status.kind==='saving')){again=false;timer=setTimeout(push,DELAY);}
  }

  function showPrivateStart(){
    const el=document.getElementById('private-start');if(!el)return;
    el.hidden=false;
    const lv=document.getElementById('loan-view');if(lv)lv.style.visibility='hidden';
    const st=document.getElementById('app-subtitle');if(st)st.textContent='Private copy';
    const fr=document.getElementById('first-run-banner');if(fr)fr.classList.remove('show');
    if(typeof closeSetup==='function')closeSetup();
  }
  window.startNewLoanHere=function(){
    hidePrivateStart();
    if(typeof openSetup==='function')openSetup(true);
  };
  function hidePrivateStart(){
    const el=document.getElementById('private-start');if(el)el.hidden=true;
    const lv=document.getElementById('loan-view');if(lv)lv.style.visibility='';
  }
  function rerender(){
    hidePrivateStart();
    try{
      const hasLoan=!!localStorage.getItem('lt_loans');
      if(hasLoan&&typeof closeSetup==='function')closeSetup();
      if(typeof activeLoanIdx!=='undefined'&&activeLoanIdx==='dashboard'&&hasLoan)showTab('dashboard');
      else{if(typeof activeLoanIdx!=='undefined'&&typeof activeLoanIdx==='number'&&!loadLoan(activeLoanIdx))activeLoanIdx=0;initApp();}
      if(typeof renderLastBackup==='function')renderLastBackup();
    }catch(e){console.error('[sync] re-render failed',e);}
  }
  // Replace this browser's data with the online copy, without counting it as a local change.
  function adopt(cloud){
    suppress=true;
    try{
      Object.keys(snapshotOf(localStorage)).forEach(k=>rawRemove.call(localStorage,k));
      const d=cloud.data||{};Object.keys(d).filter(isDataKey).forEach(k=>rawSet.call(localStorage,k,d[k]));
    }finally{suppress=false;}
    meta={cloudSavedAt:cloud.savedAt,localSavedAt:cloud.savedAt,dirty:false};saveMeta();
    setStatus({kind:'saved',at:cloud.savedAt});
    rerender();
  }
  function resolve(action,cloud){
    if(action==='push')return push();
    if(action==='adopt')return adopt(cloud);
    if(action==='conflict-keep-cloud'){
      otherVersion={data:snapshotOf(localStorage),when:meta&&meta.localSavedAt,which:'this device'};
      adopt(cloud);
      showConflict('This device and another one both changed the loan data. The newer version, from '+fmtWhen(cloud.savedAt)+', is kept. The version from this device can be saved as a backup file.');
      return;
    }
    if(action==='conflict-keep-local'){
      otherVersion={data:cloud.data||{},when:cloud.savedAt,which:'the other device'};
      showConflict('This device and another one both changed the loan data. The newer version, from this device, is kept and saved online. The other version, from '+fmtWhen(cloud.savedAt)+', can be saved as a backup file.');
      return push();
    }
  }
  function fmtWhen(iso){if(!iso)return 'an unknown time';const d=new Date(iso);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+hhmm(iso);}
  function showConflict(text){
    const el=document.getElementById('sync-notice');if(!el)return;
    document.getElementById('sync-notice-text').textContent=text;
    el.hidden=false;
  }
  window.downloadOtherVersion=function(){
    if(!otherVersion)return;
    const state=Object.assign({},otherVersion.data,{_exported:new Date().toISOString().slice(0,10)});
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='loan-tracker-other-version-'+state._exported+'.json';a.click();URL.revokeObjectURL(a.href);
  };
  window.dismissSyncNotice=function(){const el=document.getElementById('sync-notice');if(el)el.hidden=true;};

  async function pull(){
    if(inFlight)return;
    inFlight=true;let cloud=null;
    try{
      if(!meta||!meta.cloudSavedAt)setStatus({kind:'loading'});
      const r=await call('GET');
      if(r.status===200&&r.body)cloud=r.body;else setStatus({kind:'error'});
    }catch(e){failed(e);}
    finally{inFlight=false;}
    if(!cloud)return;
    const action=decideSync(meta,snapshotOf(localStorage),cloud);
    if(action==='none'&&!cloud.savedAt&&!localStorage.getItem('lt_loans'))showPrivateStart();
    if(action==='none'){
      if(!meta&&!cloud.savedAt)setStatus({kind:'idle'});
      else{if(!meta){meta={cloudSavedAt:cloud.savedAt,localSavedAt:cloud.savedAt,dirty:false};saveMeta();}setStatus({kind:'saved',at:cloud.savedAt||meta.cloudSavedAt});}
      return;
    }
    if(action==='push'&&!meta){meta={cloudSavedAt:null,localSavedAt:new Date().toISOString(),dirty:true};saveMeta();}
    resolve(action,cloud);
  }

  window.addEventListener('online',()=>{if(meta&&meta.dirty)push();else pull();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(meta&&meta.dirty)push();else pull();}});
  setInterval(()=>{if(meta&&meta.dirty&&!inFlight&&['offline','error'].includes(status.kind))push();},RETRY);
  window.addEventListener('pagehide',()=>{
    if(!meta||!meta.dirty)return;
    try{fetch(API,{method:'PUT',keepalive:true,credentials:'same-origin',headers:{'content-type':'application/json'},
      body:JSON.stringify({savedAt:meta.localSavedAt,data:snapshotOf(localStorage)})});}catch(e){}
  });
  // For checks on a local copy: lets a test trigger a pull without leaving the page.
  window.LT_SYNC={pull,push,state:()=>({meta,status,otherVersion:!!otherVersion})};
  renderSyncStatus();
  pull();
})();
