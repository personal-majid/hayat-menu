/* owner-ux.js (v298) — what the owner looks at, and Arrange.
   Majid, 16 Oct: "add some analytics to the owner app, see which things I watch most" and
   "carefully rearrange one at a time". Two parts, both talking to owner.html only through
   window.__OWNUX (page, render, who, fs, day) and the data-ck="<card function>" on each card:

   1. Usage: seconds each page and each card is ON SCREEN (half or more visible, page in front,
      someone touched / scrolled in the last 3 minutes), taps per card, folds opened.
      Kept per device per business day: localStorage hayat-ux + Firestore owner_ux/{day}_{device}.
   2. Arrange (More → ✎ Arrange this page): ▲ ▼ move a card, 👁 hide it, per device
      (localStorage hayat-layout {page:{order:[key], hide:[key]}}). Nothing is ever deleted. */
(function(){
  'use strict';
  var O = function(){ return window.__OWNUX; };
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(x){ return String(x == null ? '' : x).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var LS = {
    get: function(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
    set: function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };
  var DEV = (function(){ try{ var d = localStorage.getItem('hayat-dev'); if(!d){ d = Math.random().toString(36).slice(2, 10); localStorage.setItem('hayat-dev', d); } return d; }catch(e){ return 'nodev'; } })();
  function today(){ try{ if(O() && O().day) return O().day(); }catch(e){} var d = new Date(Date.now() - 5 * 3600e3); return d.toISOString().slice(0, 10); }

  /* plain names for the cards (the function behind each card) */
  var NAMES = {
    todayBox:'Today so far (top box)', avgStrip:'Average a day', hourly:'Sales by hour', runLine:'Running total', billsCard:'Bills per hour',
    topItems:'Top items', catCard:'Items by category', items:'Item-wise list', breakdown:'Breakdown (section · type · payment)', pace:'Pace',
    closures:'Bill times', waiters:'Waiters', upsell:'Upselling', tables:'Tables', voids:'Voids', discounts:'Discounts',
    newOrders:'New orders', alerts:'Needs attention', unrealized:'Unpaid now', floor:'Tables now', outlook:'Today / Tomorrow outlook',
    kitchens:'Kitchens', trafficCard:'Road traffic', bills:'Bills list', daySpendCard:'Spends day by day', drafts:'Bills being entered',
    payments:'Payments', cashCard:'Cash & bank', fcostCard:'Food cost', juiceCard:'Juice counter', similar:'Similar days', compare:'Compare days',
    needsYou:'Needs you', topDishes:'Top dishes', trends:'Trends', weekCard:'Week on week', instaCard:'Instagram', lgCard:'Pre-bookings',
    spDupCard:'Possible duplicates'
  };
  var PAGES = { 'd/floor':'Live', 'd/sales':'Sales', 'd/buy':'Spends', 'd/cash':'Cash & bank', 'd/items':'Items', 'd/bills':'Bills',
    'd/patterns':'Patterns', 'd/growth':'Why we grew', 'd/similar':'Similar days', 'd/lab':'Forecast lab', 'd/cmp':'Compare',
    's/floor':'Simple · Today', 's/days':'Simple · Days', 's/buy':'Simple · Money', 's/cash':'Simple · Cash', 's/items':'Simple · Dishes',
    'p/overview':'Period · Sales', 'p/money':'Period · Spends', 'p/cash':'Period · Cash', 'p/items':'Period · Items', 'p/people':'Period · People', 'p/voids':'Period · Voids' };

  /* ---------- which element is a card, and its key ---------- */
  function cardsIn(main){
    return [].slice.call(main.querySelectorAll('.grid > .card, .grid > details.moreg, .grid > [data-ck], #main > [data-ck], #main > details.moreg, #main > .card'))
      .filter(function(c, i, a){ return a.indexOf(c) === i && !c.closest('.uxbar'); });
  }
  function titleOf(c){
    var h = c.querySelector('h2, summary b, h3'); if(!h) return '';
    var t = h.cloneNode(true); [].slice.call(t.querySelectorAll('.n, small, button, a')).forEach(function(x){ x.remove(); });
    return t.textContent.replace(/\s+/g, ' ').trim().slice(0, 48);
  }
  function keyOf(c){
    if(c.dataset.ck) return c.dataset.ck;
    if(c.dataset.mg) return 'mg:' + c.dataset.mg;
    var t = titleOf(c).toLowerCase().replace(/[0-9₹,.·%+\-–—]+/g, ' ').replace(/[^a-zഀ-ൿ ]+/g, '').replace(/\s+/g, ' ').trim();
    return t ? 'h:' + t.slice(0, 32) : '';
  }
  function nameOf(k, t){ return NAMES[k] || t || k.replace(/^h:|^mg:/, ''); }

  /* ---------- usage ---------- */
  var U = fresh();
  function fresh(){ var x = LS.get('hayat-ux', null); return (x && x.day === today()) ? x : { day: today(), pages: {}, cards: {}, opens: {} }; }
  var dirty = false, lastAct = Date.now(), curPage = '', vis = new Set(), io = null;
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function(ev){ window.addEventListener(ev, function(){ lastAct = Date.now(); }, { passive: true, capture: true }); });
  function roll(){ if(U.day !== today()){ flush(true); U = { day: today(), pages: {}, cards: {}, opens: {} }; } }
  function tick(){
    roll();
    if(document.hidden || Date.now() - lastAct > 3 * 60e3 || !curPage) return;   /* phone left on the table: not "watching" */
    var p = U.pages[curPage] = U.pages[curPage] || { n: 0, s: 0 }; p.s++;
    vis.forEach(function(c){ if(!c.isConnected) return; var k = c.__uxk; if(!k) return;
      var r = U.cards[curPage + '|' + k] = U.cards[curPage + '|' + k] || { s: 0, t: 0, n: '' }; r.s++; if(!r.n) r.n = c.__uxt || ''; });
    dirty = true; if(p.s % 10 === 0) LS.set('hayat-ux', U);
  }
  setInterval(tick, 1000);
  function observe(list){
    if(io) io.disconnect(); vis = new Set();
    if(!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.intersectionRatio >= 0.5 || (e.isIntersecting && e.intersectionRect.height > innerHeight * 0.5)) vis.add(e.target); else vis.delete(e.target); }); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    list.forEach(function(c){ io.observe(c); });
  }
  document.addEventListener('click', function(e){
    var c = e.target.closest && e.target.closest('[data-uxk]'); if(!c || !curPage || e.target.closest('.uxbar')) return;
    var k = curPage + '|' + c.dataset.uxk, r = U.cards[k] = U.cards[k] || { s: 0, t: 0, n: c.__uxt || '' }; r.t++; dirty = true; LS.set('hayat-ux', U);
  }, true);
  /* a fold OPENED by a person (a redraw also fires 'toggle', so listen to the tap on its summary) */
  document.addEventListener('click', function(e){
    var sm = e.target.closest && e.target.closest('details.moreg > summary'); if(!sm) return; var d = sm.parentElement; if(d.open) return;
    var k = (curPage || '?') + '|mg:' + (d.dataset.mg || ''); U.opens[k] = (U.opens[k] || 0) + 1; dirty = true;
  }, true);
  function flush(force){
    if(!dirty && !force) return; var o = O(), f = o && o.fs && o.fs(); if(!f) return;
    LS.set('hayat-ux', U); dirty = false;
    try{ f.fs.setDoc(f.fs.doc(f.db, 'owner_ux', U.day + '_' + DEV), { v: 1, day: U.day, dev: DEV, who: (o.who && o.who()) || '', at: Date.now(),
      wide: innerWidth >= 900, pages: U.pages, cards: U.cards, opens: U.opens }).catch(function(){ dirty = true; }); }catch(e){ dirty = true; }
  }
  setInterval(flush, 60e3);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) flush(); });
  window.addEventListener('pagehide', function(){ flush(); });

  /* ---------- Arrange ---------- */
  var LAY = LS.get('hayat-layout', {}), ARR = false;
  function lay(p){ return LAY[p] = LAY[p] || { order: [], hide: [] }; }
  function apply(main, page, list){
    var L = LAY[page] || { order: [], hide: [] };
    list.forEach(function(c, i){
      var k = c.__uxk, oi = L.order.indexOf(k);
      c.style.order = oi >= 0 ? String(oi) : String(1000 + i);
      c.classList.toggle('uxhid', L.hide.indexOf(k) >= 0);
    });
    var bar = $('uxHidBar'); if(bar) bar.remove();
    var hid = list.filter(function(c){ return c.classList.contains('uxhid'); });
    if(hid.length && !ARR){
      bar = document.createElement('div'); bar.id = 'uxHidBar'; bar.className = 'uxhidbar';
      bar.innerHTML = '<span>Hidden here:</span>' + hid.map(function(c){ return '<button type="button" data-uxshow="' + esc(c.__uxk) + '">' + esc(nameOf(c.__uxk, c.__uxt)) + ' · show</button>'; }).join('');
      main.appendChild(bar);
      [].slice.call(bar.querySelectorAll('[data-uxshow]')).forEach(function(b){ b.onclick = function(){ var l = lay(page); l.hide = l.hide.filter(function(x){ return x !== b.dataset.uxshow; }); LS.set('hayat-layout', LAY); O().render(); }; });
    }
  }
  function arrangeUI(main, page, list){
    var top = $('uxArrTop'); if(top) top.remove();
    document.body.classList.toggle('uxarr', ARR);
    if(!ARR) return;
    top = document.createElement('div'); top.id = 'uxArrTop'; top.className = 'uxarrtop';
    top.innerHTML = '<b>✎ Arrange ' + esc(PAGES[page] || page) + '</b><span>▲ ▼ move a card · 👁 hide or show it · only on this phone / PC</span>' +
      '<button type="button" id="uxReset">Reset this page</button><button type="button" class="pri" id="uxDone">Done</button>';
    main.insertBefore(top, main.firstChild);
    $('uxDone').onclick = function(){ ARR = false; O().render(); };
    $('uxReset').onclick = function(){ delete LAY[page]; LS.set('hayat-layout', LAY); O().render(); };
    list.forEach(function(c){
      var g = c.parentElement, inGrid = g && g.classList.contains('grid'), k = c.__uxk;
      var b = document.createElement('div'); b.className = 'uxbar';
      b.innerHTML = '<span>' + esc(nameOf(k, c.__uxt)) + '</span>' + (inGrid ? '<button type="button" data-m="-1" aria-label="move up">▲</button><button type="button" data-m="1" aria-label="move down">▼</button>' : '') +
        '<button type="button" data-h="1" aria-label="hide or show">' + (c.classList.contains('uxhid') ? '👁 show' : '👁 hide') + '</button>';
      c.insertBefore(b, c.firstChild);
      b.onclick = function(e){ e.stopPropagation(); e.preventDefault();
        var t = e.target.closest('button'); if(!t) return; var l = lay(page);
        if(t.dataset.h){ var i = l.hide.indexOf(k); if(i >= 0) l.hide.splice(i, 1); else l.hide.push(k); }
        else {
          var sibs = list.filter(function(x){ return x.parentElement === g; }).sort(function(a, b2){ return (+a.style.order) - (+b2.style.order); });
          var at = sibs.indexOf(c), to = at + (+t.dataset.m); if(to < 0 || to >= sibs.length) return;
          sibs.splice(to, 0, sibs.splice(at, 1)[0]);
          var keys = sibs.map(function(x){ return x.__uxk; });
          l.order = l.order.filter(function(x){ return keys.indexOf(x) < 0; }).concat(keys);
        }
        LS.set('hayat-layout', LAY); O().render();
      };
    });
  }

  /* ---------- "What I look at" ---------- */
  function fmt(s){ if(s < 60) return s + ' s'; var m = Math.round(s / 60); return m < 60 ? m + ' min' : (m / 60).toFixed(1) + ' h'; }
  async function report(){
    var days = 7, d0 = new Date(Date.now() - 5 * 3600e3 - days * 864e5).toISOString().slice(0, 10);
    var docs = [{ id: U.day + '_' + DEV, data: U }], o = O(), f = o.fs && o.fs(), who = {};
    if(f){ try{ flush(true); var q = await f.fs.getDocs(f.fs.query(f.fs.collection(f.db, 'owner_ux'), f.fs.where('day', '>=', d0)));
      docs = q.docs.map(function(x){ return { id: x.id, data: x.data() }; }); if(!docs.some(function(x){ return x.id === U.day + '_' + DEV; })) docs.push({ id: U.day + '_' + DEV, data: U }); }catch(e){} }
    var P = {}, C = {}, M = {}, dayset = {};
    docs.forEach(function(x){ var d = x.data || {}; dayset[d.day] = 1; who[d.who || 'this device'] = 1;
      Object.keys(d.pages || {}).forEach(function(k){ P[k] = (P[k] || 0) + (d.pages[k].s || 0); });
      Object.keys(d.cards || {}).forEach(function(k){ var r = d.cards[k], c = C[k] = C[k] || { s: 0, t: 0, n: r.n || '' }; c.s += r.s || 0; c.t += r.t || 0; if(!c.n) c.n = r.n || ''; });
      Object.keys(d.opens || {}).forEach(function(k){ M[k] = (M[k] || 0) + d.opens[k]; }); });
    var tot = Object.keys(P).reduce(function(n, k){ return n + P[k]; }, 0) || 1;
    var pr = Object.keys(P).sort(function(a, b){ return P[b] - P[a]; });
    var cr = Object.keys(C).sort(function(a, b){ return (C[b].s + 20 * C[b].t) - (C[a].s + 20 * C[a].t); });
    var bar = function(v, max){ return '<i style="width:' + Math.max(2, Math.round(100 * v / (max || 1))) + '%"></i>'; };
    var nd = Object.keys(dayset).length;
    var h = '<div class="uxrep"><div class="uxrh"><b>📊 What I look at</b><button type="button" id="uxX" aria-label="close">✕</button></div>' +
      '<p class="uxsub">Last ' + days + ' days · ' + nd + (nd === 1 ? ' day' : ' days') + ' of data · ' + esc(Object.keys(who).join(', ')) + ' · time counts only while a card is half on screen and someone is using the phone.' +
      (nd < 3 ? ' <b>Give it 2–3 days</b> before deciding anything.' : '') + '</p>' +
      '<h3>Pages</h3>' + (pr.length ? '<div class="uxl">' + pr.map(function(k){ return '<div class="uxr"><span>' + esc(PAGES[k] || k) + '</span><em>' + bar(P[k], P[pr[0]]) + '</em><b>' + fmt(P[k]) + ' · ' + Math.round(100 * P[k] / tot) + '%</b></div>'; }).join('') + '</div>' : '<p class="uxsub">Nothing yet.</p>') +
      '<h3>Cards, most watched first</h3>' + (cr.length ? '<div class="uxl">' + cr.slice(0, 30).map(function(k){ var c = C[k], pg = k.split('|')[0], ck = k.split('|').slice(1).join('|');
        return '<div class="uxr"><span>' + esc(nameOf(ck, c.n)) + ' <small>' + esc(PAGES[pg] || pg) + '</small></span><em>' + bar(c.s, C[cr[0]].s) + '</em><b>' + fmt(c.s) + (c.t ? ' · ' + c.t + ' taps' : '') + '</b></div>'; }).join('') + '</div>' : '<p class="uxsub">Nothing yet.</p>') +
      (Object.keys(M).length ? '<h3>Folded parts opened</h3><div class="uxl">' + Object.keys(M).sort(function(a, b){ return M[b] - M[a]; }).map(function(k){ return '<div class="uxr"><span>' + esc(k.split('|')[1].replace('mg:', 'More: ')) + ' <small>' + esc(PAGES[k.split('|')[0]] || '') + '</small></span><em></em><b>' + M[k] + '×</b></div>'; }).join('') + '</div>' : '') +
      '<p class="uxsub">Next: after 2–3 days we use this to move the most-watched cards up and fold the rest — together, one page at a time (✎ Arrange this page).</p></div>';
    var w = $('uxRep'); if(!w){ w = document.createElement('div'); w.id = 'uxRep'; w.className = 'uxsheet'; document.body.appendChild(w); }
    w.innerHTML = h; w.hidden = false; $('uxX').onclick = function(){ w.hidden = true; };
    w.onclick = function(e){ if(e.target === w) w.hidden = true; };
  }

  /* ---------- after every render of the board ---------- */
  function menu(){
    var dm = $('dockMore'); if(!dm || $('uxArrBtn')) return;
    dm.insertAdjacentHTML('beforeend', '<button class="tab" type="button" id="uxArrBtn">✎ Arrange this page</button><button class="tab" type="button" id="uxRepBtn">📊 What I look at</button>');
    $('uxArrBtn').onclick = function(){ ARR = true; var s = $('dockSheet'); if(s) s.hidden = true; window.scrollTo(0, 0); O().render(); };
    $('uxRepBtn').onclick = function(){ var s = $('dockSheet'); if(s) s.hidden = true; report(); };
  }
  function after(){
    var o = O(), main = $('main'); if(!o || !main) return;
    var page = o.page();
    if(page !== curPage){ curPage = page; var p = U.pages[page] = U.pages[page] || { n: 0, s: 0 }; p.n++; dirty = true; }
    var list = cardsIn(main);
    list.forEach(function(c){ c.__uxk = keyOf(c); c.__uxt = titleOf(c); if(c.__uxk) c.dataset.uxk = c.__uxk; });
    list = list.filter(function(c){ return c.__uxk; });
    apply(main, page, list); arrangeUI(main, page, list); observe(list); menu();
  }

  var css = document.createElement('style');
  css.textContent =
    '.uxhid{display:none!important} body.uxarr .uxhid{display:block!important;opacity:.45;outline:2px dashed var(--line2)}' +
    'body.uxarr #main .card,body.uxarr #main details.moreg{position:relative;outline:2px dashed rgba(184,151,90,.55);outline-offset:2px}' +
    '.uxbar{display:flex;align-items:center;gap:6px;margin:-4px -4px 8px;padding:6px;border-radius:10px;background:var(--soft2);font-size:13px}' +
    '.uxbar span{flex:1;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.uxbar button{min-width:40px;height:36px;border-radius:9px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-weight:700;cursor:pointer}' +
    '.uxarrtop{position:sticky;top:var(--toph,52px);z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;margin:0 0 12px;border-radius:12px;background:var(--card);border:1px solid var(--gold);box-shadow:0 6px 18px rgba(0,0,0,.12)}' +
    '.uxarrtop span{flex:1 1 220px;font-size:12.5px;color:var(--muted)} .uxarrtop button{height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--line2);background:transparent;color:var(--ink);font:inherit;font-weight:700;cursor:pointer} .uxarrtop .pri{background:var(--pri);color:var(--onpri);border-color:var(--pri)}' +
    '.uxhidbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:14px 0;font-size:12.5px;color:var(--muted)} .uxhidbar button{height:32px;padding:0 10px;border-radius:999px;border:1px dashed var(--line2);background:transparent;color:var(--muted);font:inherit;cursor:pointer}' +
    '.uxsheet{position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.45);display:flex;align-items:flex-end;justify-content:center}.uxsheet[hidden]{display:none}' +
    '.uxrep{width:min(720px,100%);max-height:88vh;overflow:auto;background:var(--bg);border-radius:20px 20px 0 0;padding:16px 16px 28px}' +
    '@media(min-width:900px){.uxsheet{align-items:center}.uxrep{border-radius:18px}}' +
    '.uxrh{display:flex;justify-content:space-between;align-items:center}.uxrh b{font-size:19px}.uxrh button{width:38px;height:38px;border-radius:50%;border:0;background:var(--soft2);font-size:16px;cursor:pointer;color:var(--ink)}' +
    '.uxrep h3{margin:16px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)} .uxsub{font-size:12.5px;color:var(--muted);margin:6px 0}' +
    '.uxl{display:flex;flex-direction:column;gap:4px} .uxr{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr auto;gap:10px;align-items:center;font-size:13.5px;padding:5px 0;border-bottom:1px solid var(--line)}' +
    '.uxr span small{display:block;color:var(--muted);font-size:11px} .uxr em{height:8px;background:var(--soft2);border-radius:4px;overflow:hidden;display:block} .uxr em i{display:block;height:100%;background:var(--s1,#2a78d6);border-radius:4px} .uxr b{font-variant-numeric:tabular-nums;font-size:12.5px;white-space:nowrap}' +
    '.carderr{border:1px dashed var(--line2)!important;opacity:.85}';
  document.head.appendChild(css);

  window.OwnerUX = { after: after, flush: flush, report: report, arrange: function(on){ ARR = on !== false; O().render(); }, _u: function(){ return U; }, _lay: function(){ return LAY; } };
})();
