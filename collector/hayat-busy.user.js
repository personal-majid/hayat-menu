// ==UserScript==
// @name         Hayat busy reader
// @namespace    hayat-menu
// @version      1.1
// @description  Tap a place on Hayat's Competitors page, Google Maps opens, this reads "now vs usual" busyness and saves it to Hayat's owner app.
// @match        https://personal-majid.github.io/hayat-menu/*
// @match        https://www.google.com/maps/*
// @match        https://www.google.com/search*
// @match        https://www.google.co.in/maps/*
// @match        https://www.google.co.in/search*
// @match        https://maps.google.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==
/* Works with: iPhone/iPad Safari + the free "Userscripts" app; Android Firefox + Tampermonkey; laptop Chrome/Firefox + Tampermonkey.
   Only reads while you are on a Google page you opened yourself from the Competitors list. Writes the same documents as the
   Android collector: crowd/{placeId} (latest) and crowd_hist/{business day} p.{placeId}.{HH} = {now, usual, at}. */
(function(){
  'use strict';
  const FS='https://firestore.googleapis.com/v1/projects/h-menu/databases/(default)/documents/', FK='AIzaSyA48aGGeEvg9lyVzeTX5fPIA21SrMZQPn8';
  const getV=async(k,d)=>{ try{ if(typeof GM!=='undefined'&&GM.getValue) return await GM.getValue(k,d); }catch(e){} try{ return GM_getValue(k,d); }catch(e){} return d; };
  const setV=async(k,v)=>{ try{ if(typeof GM!=='undefined'&&GM.setValue) return await GM.setValue(k,v); }catch(e){} try{ GM_setValue(k,v); }catch(e){} };

  /* ---- on Hayat's own page: remember which place was tapped ---- */
  if(location.hostname==='personal-majid.github.io'){
    document.documentElement.dataset.hayatBusy='1.1';
    document.addEventListener('click',e=>{ const a=e.target&&e.target.closest&&e.target.closest('[data-busy-pid]'); if(!a) return;
      setV('pending',JSON.stringify({pid:a.dataset.busyPid,name:a.dataset.busyName||'',area:a.dataset.busyArea||'',kind:a.dataset.busyKind||'food',at:Date.now()})); },true);
    return;
  }

  /* ---- on Google: read and save ---- */
  const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='boolean'?{booleanValue:v}:typeof v==='string'?{stringValue:v}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
  const patch=(path,obj,mask)=>fetch(FS+path+'?'+mask.map(f=>'updateMask.fieldPaths='+encodeURIComponent(f)).join('&')+'&key='+FK,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({fields:enc(obj).mapValue.fields})}).then(r=>{ if(!r.ok) throw new Error(r.status); });
  const ist=()=>new Date(Date.now()+5.5*3600e3), bizDay=()=>{ const x=ist(); if(x.getUTCHours()<5) x.setUTCDate(x.getUTCDate()-1); return x.toISOString().slice(0,10); };
  const box=(html,bad)=>{ let b=document.getElementById('hayatBusyBox'); if(!b){ b=document.createElement('div'); b.id='hayatBusyBox'; b.style.cssText='position:fixed;left:8px;right:8px;bottom:12px;z-index:2147483647;padding:12px 14px;border-radius:14px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)'; document.body.appendChild(b); }
    b.style.background=bad?'#fff4e5':'#e8f5ee'; b.style.color='#1b1a17'; b.innerHTML=html; };

  function read(){ let live=null; const byHour={};
    document.querySelectorAll('[aria-label]').forEach(el=>{ const l=el.getAttribute('aria-label')||'';
      let m=l.match(/Currently\s+(\d+)%\s+busy,\s+usually\s+(\d+)%\s+busy/i); if(m){ live={now:+m[1],usual:+m[2]}; return; }
      m=l.match(/(\d+)% busy at (\d{1,2})\s?([ap])\.?m/i); if(m){ const h=(+m[2]%12)+(m[3].toLowerCase()==='p'?12:0); if(!(h in byHour)) byHour[h]=+m[1]; } });
    if(!live){ const t=(document.body&&document.body.innerText)||''; const m=t.match(/Live[^\n]{0,40}\n?[^\n]{0,60}(\d+)%[^\n]{0,30}usually[^\n]{0,10}(\d+)%/i); if(m) live={now:+m[1],usual:+m[2]}; }
    return {live,byHour,signedOut:/limited view of Google Maps|Sign in to see/i.test((document.body&&document.body.innerText)||'')}; }

  (async()=>{
    let P=null; try{ P=JSON.parse(await getV('pending','null')); }catch(e){}
    const qs=new URLSearchParams(location.search), urlPid=qs.get('query_place_id')||((qs.get('q')||'').match(/place_id:(\S+)/)||[])[1];
    if(urlPid&&(!P||P.pid!==urlPid)) P={pid:urlPid,name:qs.get('query')||'',area:'',kind:'food',at:Date.now()};
    if(!P||!P.pid||Date.now()-P.at>15*60e3) return;   /* only places tapped in the last 15 min from Hayat's list */
    box(`Hayat · reading <b>${P.name||'this place'}</b>… scroll to <b>Popular times</b> if it does not appear.`);
    const t0=Date.now();
    const tick=async()=>{ const r=read();
      const key=((P.name||'').split(/\s+/).find(x=>x.length>=4)||'').toLowerCase();
      if((r.live||Object.keys(r.byHour).length)&&key&&!((document.body.innerText||'').toLowerCase().includes(key))){ box(`This page does not look like <b>${P.name}</b> — not saved. Open the right business and tap it again from Hayat.`,true); return; }
      if(r.live||(Object.keys(r.byHour).length&&Date.now()-t0>12000)){
        const at=new Date().toISOString(), day=bizDay(), hh=String(ist().getUTCHours()).padStart(2,'0'), hour=ist().getUTCHours();
        const usual=r.live?r.live.usual:(r.byHour[hour]!=null?r.byHour[hour]:null);
        try{
          await patch('crowd/'+P.pid,{name:P.name,area:P.area,kind:P.kind,now:r.live?r.live.now:null,usual,at,src:'phone-js'},['name','area','kind','now','usual','at','src']);
          if(r.live) await patch('crowd_hist/'+day,{p:{[P.pid]:{[hh]:{now:r.live.now,usual:r.live.usual,at}}},n:{[P.pid]:{name:P.name,area:P.area,kind:P.kind}}},['p.`'+P.pid+'`.`'+hh+'`','n.`'+P.pid+'`']);
          await setV('pending','null');
          box(r.live?`✓ Saved <b>${P.name}</b> · now <b>${r.live.now}%</b> vs usual ${r.live.usual}%. Go back to Hayat for the next one.`
                    :`Saved <b>${P.name}</b> · Google shows no <b>Live</b> reading right now (usually ${usual==null?'—':usual+'%'} at this hour). Live appears only when enough phones are there.`,!r.live);
        }catch(e){ box('Could not save to Hayat ('+e.message+'). Check the internet and try again.',true); }
        return; }
      if(r.signedOut) return box('Google shows busy times only when you are <b>signed in</b>. Sign in to Google in this browser, then tap the place again.',true);
      if(Date.now()-t0>30000) return box('No <b>Popular times</b> found on this page. Scroll down to Popular times and wait, or open the place in Google Maps on the web (not the app).',true);
      setTimeout(tick,1200); };
    setTimeout(tick,1500);
  })();
})();
