/* In-app voice calls: rider <-> customer, inside the website / rider app (v295).
   Free: WebRTC audio straight between the two phones. Firestore (already used) carries
   the "ring" and the connection details: calls/{orderId}
     {cid, from:'rider'|'customer', to, fromName, state:'ringing'|'answered'|'declined'|'missed'|'ended',
      offer:{type,sdp}, answer:{type,sdp}|null, at, answeredAt, endedAt, endBy, log:[{cid,from,state,sec,at}]}
   Phones on strict mobile networks need a relay (TURN). settings/captain.callRelay = URL of the
   free Cloudflare Worker in cloudflare/turn (Cloudflare TURN: 1,000 GB/month free; a voice minute
   is ~0.75 MB). No relay set -> public STUN only (most calls still connect).
   Rings only while the other side has the site open (order page / rider app).
   shop.js: HayatCall.attach(FB) once Firebase is up, HayatCall.sync([{id, role, name}]) on every change,
   buttons carry data-wcall=<orderId> data-wto=<'rider'|'customer'> data-wname=<my name>. */
(function(){
  'use strict';
  var FB = null, WATCH = {}, CUR = null, INC = null, ICE = null, ICE_AT = 0, SEEN = {}, AC = null, RING = null;
  var STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  var RING_MS = 45000;
  function api(){ return FB && FB.api; }
  function ref(id){ return api().doc(FB.db, 'calls', id); }
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function toast(m){ if(typeof window.shopToast === 'function') return window.shopToast(m); var t = document.getElementById('toast'); if(t){ t.textContent = m; t.className = 'show'; setTimeout(function(){ t.className = ''; }, 2600); } }
  function mmss(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- relay (TURN) credentials from the free Worker, cached 6 h ---------- */
  async function iceServers(){
    if(ICE && Date.now() - ICE_AT < 6 * 3600e3) return ICE;
    var list = STUN;
    try{
      var s = await api().getDoc(api().doc(FB.db, 'settings', 'captain'));
      var u = s.exists() && s.data().callRelay;
      if(u && /^https:\/\//.test(u)){
        var r = await fetch(u, { method: 'POST' });
        if(r.ok){ var j = await r.json(); if(j && j.iceServers) list = [].concat(j.iceServers); }
      }
    }catch(e){}
    ICE = list; ICE_AT = Date.now(); return list;
  }
  async function newPC(){
    var pc = new RTCPeerConnection({ iceServers: await iceServers() });
    pc.ontrack = function(e){ var a = audioEl(); a.srcObject = e.streams[0]; var p = a.play(); if(p && p.catch) p.catch(function(){}); };
    pc.oniceconnectionstatechange = function(){
      if(!CUR || CUR.pc !== pc) return; var s = pc.iceConnectionState;
      if(s === 'connected' || s === 'completed'){ if(CUR.state !== 'live'){ CUR.state = 'live'; CUR.liveAt = Date.now(); clearTimeout(CUR.timer); ui(); } clearTimeout(CUR.drop); }
      else if(s === 'failed') end('failed');
      else if(s === 'disconnected'){ clearTimeout(CUR.drop); CUR.drop = setTimeout(function(){ if(CUR && CUR.pc === pc && pc.iceConnectionState === 'disconnected') end('lost'); }, 8000); }
    };
    return pc;
  }
  /* no trickle: wait until the candidates are gathered (max 3 s), then send one description */
  function gathered(pc){ return new Promise(function(ok){ if(pc.iceGatheringState === 'complete') return ok();
    var t = setTimeout(ok, 3000); pc.addEventListener('icegatheringstatechange', function(){ if(pc.iceGatheringState === 'complete'){ clearTimeout(t); ok(); } }); }); }
  function audioEl(){ var a = document.getElementById('hcAudio'); if(!a){ a = document.createElement('audio'); a.id = 'hcAudio'; a.autoplay = true; a.setAttribute('playsinline', ''); document.body.appendChild(a); } return a; }
  async function mic(){ return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }

  /* ---------- ring tone (WebAudio; phones allow it after the person has tapped the page once) ---------- */
  function ringStart(kind){ ringStop(); try{ AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume(); }catch(e){ AC = null; }
    var beep = function(){ if(navigator.vibrate && kind === 'in') navigator.vibrate([400, 200, 400]); if(!AC) return; var t0 = AC.currentTime;
      [0, 0.5].forEach(function(dt){ var o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = kind === 'in' ? 880 : 425; g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(kind === 'in' ? 0.25 : 0.08, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.4); o.connect(g); g.connect(AC.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.42); }); };
    beep(); RING = setInterval(beep, kind === 'in' ? 2000 : 3000); }
  function ringStop(){ clearInterval(RING); RING = null; if(navigator.vibrate) try{ navigator.vibrate(0); }catch(e){} }

  /* ---------- the panel at the bottom of the screen ---------- */
  function css(){ if(document.getElementById('hcCss')) return; var s = document.createElement('style'); s.id = 'hcCss';
    s.textContent = '#hcBox{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;max-width:460px;margin:0 auto;background:var(--card,#FBF8F1);color:var(--ink,#1B1A17);border:1px solid var(--line2,rgba(0,0,0,.2));border-radius:18px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:14px 16px;display:grid;gap:10px;font-family:inherit}' +
      '#hcBox .hct{display:flex;align-items:center;gap:12px}#hcBox .hci{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:var(--soft2,rgba(0,0,0,.06))}#hcBox.in .hci{animation:hcp 1s ease-in-out infinite}' +
      '#hcBox b{font-size:17px;display:block}#hcBox small{color:var(--muted,#6F6758);font-size:13px}#hcBox .hcb{display:flex;gap:10px}#hcBox button{flex:1;min-height:50px;border-radius:14px;border:1px solid var(--line2,rgba(0,0,0,.2));background:var(--card2,#F0E9DA);color:inherit;font:700 16px/1 inherit;cursor:pointer}' +
      '#hcBox button.ok{background:#2E7D4F;border-color:#2E7D4F;color:#fff}#hcBox button.no{background:#B3462B;border-color:#B3462B;color:#fff}#hcBox button.on{background:var(--ink,#1B1A17);color:var(--card,#fff)}@keyframes hcp{50%{transform:scale(1.12)}}@media (prefers-reduced-motion:reduce){#hcBox .hci{animation:none}}';
    document.head.appendChild(s); }
  function ui(){
    css(); var box = document.getElementById('hcBox');
    if(!CUR && !INC){ if(box) box.remove(); clearInterval(ui.t); ui.t = null; return; }
    if(!box){ box = document.createElement('div'); box.id = 'hcBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); box.addEventListener('click', onBox); }
    if(INC && !CUR){
      box.className = 'in';
      box.innerHTML = '<div class="hct"><span class="hci">📞</span><span><b>' + esc(INC.d.from === 'rider' ? 'Your rider' : 'Customer') + (INC.d.fromName ? ' · ' + esc(INC.d.fromName) : '') + ' is calling</b><small>In-app call · order ' + esc(INC.id) + '</small></span></div>' +
        '<div class="hcb"><button class="no" data-hc="decline">Decline</button><button class="ok" data-hc="answer">Answer</button></div>';
    }else{
      var st = CUR.state, who = CUR.peer === 'rider' ? 'Rider' : 'Customer';
      var line = st === 'live' ? mmss((Date.now() - CUR.liveAt) / 1000) : st === 'calling' ? 'Ringing… (they need the app open)' : 'Connecting…';
      box.className = st;
      box.innerHTML = '<div class="hct"><span class="hci">' + (st === 'live' ? '🔊' : '📞') + '</span><span><b>' + esc(who) + (CUR.peerName ? ' · ' + esc(CUR.peerName) : '') + '</b><small id="hcLine">' + esc(line) + ' · order ' + esc(CUR.orderId) + '</small></span></div>' +
        '<div class="hcb"><button data-hc="mute" class="' + (CUR.muted ? 'on' : '') + '">' + (CUR.muted ? '🎙 Unmute' : '🔇 Mute') + '</button><button class="no" data-hc="end">End</button></div>';
      if(st === 'live' && !ui.t) ui.t = setInterval(function(){ var l = document.getElementById('hcLine'); if(l && CUR && CUR.state === 'live') l.textContent = mmss((Date.now() - CUR.liveAt) / 1000) + ' · order ' + CUR.orderId; }, 1000);
    }
  }
  function onBox(e){ var b = e.target.closest('[data-hc]'); if(!b) return; var a = b.dataset.hc;
    if(a === 'answer') answer(); else if(a === 'decline') decline(); else if(a === 'end') end('hangup');
    else if(a === 'mute' && CUR){ CUR.muted = !CUR.muted; CUR.stream.getAudioTracks().forEach(function(t){ t.enabled = !CUR.muted; }); ui(); } }

  /* ---------- place a call ---------- */
  async function call(orderId, to, myName, peerName){
    if(!FB) return toast('Not connected yet - try again in a moment');
    if(CUR || INC) return toast('Already on a call');
    if(!window.RTCPeerConnection || !navigator.mediaDevices) return toast('This browser cannot make in-app calls - use the phone call');
    var from = to === 'rider' ? 'customer' : 'rider', stream;
    try{ stream = await mic(); }catch(e){ return toast('Allow the microphone to make in-app calls'); }
    var cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var pc = await newPC(); stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });
    CUR = { orderId: orderId, cid: cid, caller: from, role: from, peer: to, peerName: peerName || '', pc: pc, stream: stream, state: 'calling', at: Date.now() };
    ui(); ringStart('out');
    try{
      var off = await pc.createOffer(); await pc.setLocalDescription(off); await gathered(pc);
      if(!CUR || CUR.cid !== cid) return;
      await api().setDoc(ref(orderId), { cid: cid, from: from, to: to, fromName: myName || '', state: 'ringing', offer: { type: 'offer', sdp: pc.localDescription.sdp }, answer: null, at: Date.now(), answeredAt: null, endedAt: null }, { merge: true });
      watch(orderId, from);
      CUR.timer = setTimeout(function(){ if(CUR && CUR.cid === cid && CUR.state === 'calling') end('missed'); }, RING_MS);
    }catch(e){ console.warn('call', e); end('error'); }
  }
  /* ---------- answer / decline ---------- */
  async function answer(){
    var I = INC; if(!I) return; ringStop(); var stream;
    try{ stream = await mic(); }catch(e){ toast('Allow the microphone to answer'); return; }
    if(INC !== I) { stream.getTracks().forEach(function(t){ t.stop(); }); return; }
    INC = null; var pc = await newPC(); stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });
    CUR = { orderId: I.id, cid: I.d.cid, caller: I.d.from, role: I.d.to, peer: I.d.from, peerName: I.d.fromName || '', pc: pc, stream: stream, state: 'connecting', at: Date.now() };
    ui();
    try{
      await pc.setRemoteDescription(I.d.offer); var ans = await pc.createAnswer(); await pc.setLocalDescription(ans); await gathered(pc);
      if(!CUR || CUR.cid !== I.d.cid) return;
      await api().runTransaction(FB.db, async function(tx){ var s = await tx.get(ref(I.id)); var d = s.exists() ? s.data() : null;
        if(!d || d.cid !== I.d.cid || d.state !== 'ringing') throw new Error('gone');
        tx.update(ref(I.id), { state: 'answered', answer: { type: 'answer', sdp: pc.localDescription.sdp }, answeredAt: Date.now() }); });
      CUR.timer = setTimeout(function(){ if(CUR && CUR.cid === I.d.cid && CUR.state !== 'live') end('failed'); }, 20000);
    }catch(e){ if(String(e && e.message) === 'gone'){ cleanup(); toast('The call ended before you answered'); } else { console.warn('answer', e); end('error'); } }
  }
  function decline(){ var I = INC; if(!I) return; INC = null; ringStop(); SEEN[I.d.cid] = 1; ui();
    write(I.id, I.d.cid, { state: 'declined', endedAt: Date.now(), endBy: I.d.to }, { cid: I.d.cid, from: I.d.from, state: 'declined', sec: 0, at: Date.now() }); }
  /* ---------- hang up / missed / failed ---------- */
  function end(why){
    if(!CUR) return; var C = CUR, sec = C.liveAt ? Math.round((Date.now() - C.liveAt) / 1000) : 0;
    var state = why === 'missed' ? 'missed' : 'ended';
    write(C.orderId, C.cid, { state: state, endedAt: Date.now(), endBy: C.role, why: why }, { cid: C.cid, from: C.caller, state: why === 'missed' ? 'missed' : (C.liveAt ? 'talked' : why), sec: sec, at: Date.now() });
    cleanup();
    toast(why === 'missed' ? 'No answer - they may not have the app open. Try a phone call.' : why === 'failed' || why === 'lost' ? 'The call could not connect - try a phone call.' : why === 'error' ? 'The call failed - try a phone call.' : sec ? 'Call ended · ' + mmss(sec) : 'Call ended');
  }
  function cleanup(){ if(!CUR) { ui(); return; } var C = CUR; CUR = null; ringStop(); clearTimeout(C.timer); clearTimeout(C.drop);
    try{ C.stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} try{ C.pc.close(); }catch(e){}
    var a = document.getElementById('hcAudio'); if(a) a.srcObject = null; SEEN[C.cid] = 1; ui(); }
  /* only touch the doc while it still belongs to this call */
  function write(id, cid, patch, logEntry){
    api().runTransaction(FB.db, async function(tx){ var s = await tx.get(ref(id)); var d = s.exists() ? s.data() : null; if(!d || d.cid !== cid) return;
      if(d.state === 'declined' || d.state === 'missed' || d.state === 'ended') return;
      var p = Object.assign({}, patch); if(logEntry) p.log = (d.log || []).concat([logEntry]).slice(-20); tx.update(ref(id), p); }).catch(function(e){ console.warn('call end', e); });
  }

  /* ---------- listen for calls on the orders this phone cares about ---------- */
  function onDoc(id, role, snap){
    var d = snap.exists() ? snap.data() : null; if(!d) return;
    if(CUR && CUR.orderId === id && CUR.cid === d.cid){
      if(CUR.role === d.from && d.state === 'answered' && d.answer && !CUR.remote){ CUR.remote = true; ringStop(); CUR.state = 'connecting'; ui();
        CUR.pc.setRemoteDescription(d.answer).catch(function(e){ console.warn('remote', e); end('error'); }); }
      if(d.state === 'declined'){ cleanup(); toast('They declined the call'); }
      else if((d.state === 'ended' || d.state === 'missed') && d.endBy !== CUR.role){ var sec = CUR.liveAt ? Math.round((Date.now() - CUR.liveAt) / 1000) : 0; cleanup(); toast(sec ? 'Call ended · ' + mmss(sec) : 'Call ended'); }
      return;
    }
    if(INC && INC.id === id && (d.cid !== INC.d.cid || d.state !== 'ringing')){ INC = null; ringStop(); ui(); if(d.state === 'missed' || d.state === 'ended') toast('Missed in-app call'); return; }
    if(d.state === 'ringing' && d.to === role && !SEEN[d.cid] && !CUR && !INC && Date.now() - (d.at || 0) < RING_MS){
      INC = { id: id, d: d }; ui(); ringStart('in');
      try{ if(document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('📞 In-app call', { body: (d.fromName || 'Someone') + ' is calling about order ' + id, tag: 'hc-' + id }); }catch(e){}
    }
  }
  function watch(id, role){ if(!FB || WATCH[id]) return; WATCH[id] = { role: role, off: api().onSnapshot(ref(id), function(s){ onDoc(id, role, s); }, function(){}) }; }
  /* shop.js passes the orders that should ring here; others stop listening (never the one in a call) */
  function sync(list){
    if(!FB) return; var want = {}; (list || []).forEach(function(x){ if(x && x.id) want[x.id] = x.role; });
    Object.keys(WATCH).forEach(function(id){ var busy = (CUR && CUR.orderId === id) || (INC && INC.id === id);
      if((!want[id] || want[id] !== WATCH[id].role) && !busy){ try{ WATCH[id].off(); }catch(e){} delete WATCH[id]; } });   /* role changed (signed in as the rider) -> listen again as that role */
    Object.keys(want).forEach(function(id){ watch(id, want[id]); });
  }
  function attach(fb){ FB = fb; }
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-wcall]'); if(!b) return; e.preventDefault(); e.stopPropagation();
    call(b.dataset.wcall, b.dataset.wto, b.dataset.wname || '', b.dataset.wpeer || ''); }, true);
  window.addEventListener('pagehide', function(){ if(CUR) end('hangup'); });
  window.HayatCall = { attach: attach, sync: sync, call: call, state: function(){ return { cur: CUR && { orderId: CUR.orderId, state: CUR.state, role: CUR.role }, inc: INC && { id: INC.id, from: INC.d.from }, watching: Object.keys(WATCH) }; } };
})();
