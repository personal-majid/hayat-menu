/* ============================================================
   HAYAT CAPTAIN — the waiter / captain / cashier / cleaner app.
   One installable page (captain.html + captain.webmanifest).

   Writes the SAME documents the website counter (shop.js #/admin/pos)
   writes, so the KDS, the print agent and the counter's open-bills
   strip all see captain orders without any change:
     orders/{id}      source:"captain", mode:"dinein", table, lines[],
                      kots[], edits[], kotN, dueAt, dueCount, paid…
                      trial:true while we run alongside VMENU.
     print_jobs       {kind:"kot"|"bill", order, tickets, money…} -> shop PC prints, no popup
     cleanreq/{id}    table cleaning requests -> the cleaner's phone
     settings/floor   spaces + tables      (edited in Admin → Tables)
     settings/captain upi, trial, printing (Admin → Settings)
     crew/{id}, crew/_list   staff + codes (Admin → Staff)
   ============================================================ */
(function(){
'use strict';
var C = window.CONFIG || {};
var SETUP = !!window.HAYAT_SETUP;   /* setup.html: the office's Staff / Tables / Menu / Settings / Trial / Usage - not for the floor */
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function rs(n){ n = Math.round(+n || 0); return (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN'); }
function clean(x){ return JSON.parse(JSON.stringify(x)); }   /* Firestore refuses undefined */
var BH0 = 5;   /* the business day starts 05:00 */
function ymd(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function bizDay(t){ return ymd(new Date((t || Date.now()) - BH0 * 3600e3)); }
function hm(t){ var d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function agoT(t){ var a = ago(t); return a === 'now' ? 'just now' : a + ' ago'; }
function ago(t){ if(!t) return ''; var m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'now' : m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
function norm(s){ return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function initials(n){ var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
function hue(s){ var h = 0; s = String(s || ''); for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function avatar(name, cls){ return '<span class="av' + (cls ? ' ' + cls : '') + '" style="background:hsl(' + hue(name) + ' 42% 38%)">' + esc(initials(name)) + '</span>'; }
function vib(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }

var ROLES = { captain:'Captain', waiter:'Waiter', runner:'Runner', cashier:'Cashier', cleaner:'Cleaner', office:'Office', kitchen:'Cook / kitchen' };
var APP_ROLES = ['captain', 'waiter', 'runner', 'cashier', 'cleaner', 'office'];
var REASONS = ['Customer changed mind', 'Wrong entry', 'Out of stock', 'Taking too long', 'Complimentary'];
var CLEAN_KINDS = [['clean','🧽','Clean table'],['deep','🧼','Deep clean'],['plates','🍽️','Change plates'],['spill','💧','Spill / mess'],['water','🥤','Water / refill'],['other','✳️','Other']];
var SHAPES = [['square','□'],['round','○'],['rect','▭']];
var SEATS = [2, 4, 6, 8, 12];

var DEF_FLOOR = { v:1, spaces:[
  { id:'ac', name:'AC', tables:[1,2,3,4,5,6,7,8,9,10].map(function(n){ return { id:'ac-' + n, name:'A' + n, seats:n <= 6 ? 6 : 2, shape:n <= 6 ? 'rect' : 'square', rot:0 }; }) },
  { id:'nonac', name:'Non AC', tables:[[1,12,'rect'],[2,6,'rect'],[3,6,'rect'],[4,6,'rect'],[5,4,'square'],[6,4,'square'],[7,4,'square']].map(function(x){ return { id:'nonac-' + x[0], name:'N' + x[0], seats:x[1], shape:x[2], rot:0 }; }) },
  { id:'hut', name:'Hut', tables:[1,2].map(function(n){ return { id:'hut-' + n, name:'H' + n, seats:12, shape:'round', rot:0 }; }) },
  { id:'juicy', name:'Juicy Hut', tables:[1,2,3,4,5,6].map(function(n){ return { id:'juicy-' + n, name:'J' + n, seats:4, shape:'round', rot:0 }; }) }
]};

var S = {
  ctx:null, F:null, D:null, me:null, people:[], floor:null, cfg:{}, print:{}, orders:{}, clean:{},
  view:'login', space:'all', mine:false, table:null, cat:'', q:'', billsTab:'open', adminTab:'staff',
  draft: lsGet('hayat-cap-draft', {}), online:navigator.onLine, ready:{}, refresh:null, floorEdit:null, pin:'', pinFor:null, roleF:''
};
window.CAPTAIN = S;   /* tests + console */
window.CAPTAIN_MENU = function(){ return BYID; };

function ref(c, id){ return S.F.doc(S.D, c, id); }
/* TRIAL: bills, cleaning and table locks live in trial_* collections, apart from the website's real orders.
   The owner app reads only VMENU's vm_* data, so nothing here ever mixes with the real sales. */
function C_(n){ return isTrial() ? 'trial_' + n : n; }
function col(c){ return S.F.collection(S.D, c); }
function saveDraft(){ lsSet('hayat-cap-draft', S.draft); }
function cfg(k, d){ return S.cfg[k] == null ? d : S.cfg[k]; }
function isTrial(){ return cfg('trial', true) !== false; }

/* ---------------- toasts + sound ---------------- */
function toast(msg, kind, sub){
  if(kind === 'bad') try{ ux('err', { m:String(msg).replace(/<[^>]+>/g, '').slice(0, 60) }); }catch(e){}
  var box = $('toasts'); var el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : ''); el.innerHTML = msg + (sub ? '<small>' + sub + '</small>' : '');
  el.onclick = function(){ el.remove(); };
  box.prepend(el); while(box.children.length > 2) box.lastChild.remove();
  setTimeout(function(){ el.remove(); }, kind === 'bad' ? 5000 : 2600);
}
var AC = null;
function unlock(){ try{ if(!AC){ var K = window.AudioContext || window.webkitAudioContext; if(K) AC = new K(); } if(AC && AC.state === 'suspended') AC.resume(); }catch(e){} }
['pointerdown','keydown'].forEach(function(ev){ addEventListener(ev, unlock, { passive:true }); });
function beep(kind){ try{ unlock(); if(!AC) return; var t = AC.currentTime + .02; var tones = kind === 'urgent' ? [[988,.12],[784,.12],[988,.16]] : [[784,.12],[1046,.18]];
  tones.forEach(function(x){ var o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = x[0]; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + x[1]); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + x[1] + .02); t += x[1] + .05; }); }catch(e){} }

/* ---------------- menu ---------------- */
var QS = { quarter:'Qtr', half:'Half', full:'Full' };
function lab(k){ var t = String(k).replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); }
function choices(it){
  var out = [];
  if(typeof it.price === 'number') out.push({ label:'', price:it.price });
  (it.opts || []).forEach(function(o){ if(typeof o[1] === 'number') out.push({ label:lab(o[0]), price:o[1] }); });
  if(it.matrix){ var many = it.matrix.rows.length > 1;
    it.matrix.rows.forEach(function(r){ (r[1] || []).forEach(function(p, i){ if(typeof p !== 'number') return; var c = lab(it.matrix.cols[i]); out.push({ label:many ? lab(r[0]) + ' · ' + c : c, price:p }); }); }); }
  return out;
}
function short(l){ if(!l) return 'Regular'; var w = l.split(' · '); var last = w[w.length - 1]; var s = QS[last.toLowerCase()] || last; return (w.length > 1 ? w[0].slice(0, 10) + ' ' : '') + s; }
var MENU = [], IDX = [], BYID = {}, POP = null;
function buildMenu(cats, layout, pos){
  layout = layout || {}; var hide = layout.hide || {}, off = layout.off || {}, order = layout.cats || [];
  if(pos){ MENU = pos.map(function(g){ return { id:g.id, name:g.name, items:g.items }; }); S.menuSrc = 'pos'; }
  else {
    MENU = (cats || []).filter(function(c){ return c && c.id && c.active !== false && !hide[c.id]; }).map(function(c){
      return { id:c.id, name:c.name || c.id, ic:c.ic || '', items:(c.items || []).filter(function(it){ return it && it.off !== true && !off[it.id] && choices(it).length; }) };
    }).filter(function(c){ return c.items.length; });
    MENU.sort(function(a, b){ var ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
    S.menuSrc = 'web';
  }
  IDX = []; BYID = {};
  MENU.forEach(function(c){ c.items.forEach(function(it){ var words = (it.name + ' ' + (it.sub || '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    var x = { id:it.id, name:it.name, sub:it.sub || '', catId:c.id, cat:c.name, ch:pos ? it.ch : choices(it), q:it.q || 0, h:it.h || null, kit:it.kit || '', words:words, ini:words.map(function(w){ return w[0]; }).join('') };
    IDX.push(x); BYID[it.id] = x; }); });
  POP = null;
}
async function loadMenu(){
  buildMenu(window.MENU || [], {});
  try{
    var a = await S.F.getDoc(ref('menus', 'active')), lay = await S.F.getDoc(ref('menus', 'layout'));
    var L = lay.exists() ? lay.data() : {};
    var id = a.exists() && a.data().id;
    if(id){ var m = await S.F.getDoc(ref('menus', id)); if(m.exists() && m.data().json){ var cats = JSON.parse(m.data().json); if(cats && cats.length){ buildMenu(cats, L); return; } } }
    buildMenu(window.MENU || [], L);
  }catch(e){ /* the file menu is fine */ }
  usePos();
}
/* VMENU's own list wins while it exists (Admin → Menu can switch to the website menu) */
function usePos(){ if(cfg('menuSrc', 'pos') === 'web') return false; var pc = posCats(); if(pc && pc.length){ buildMenu(null, null, pc); return true; } return false; }
/* "Popular" is worked out once per page load and then frozen - a grid
   that re-sorts while somebody is tapping it costs taps (see CLAUDE.md, counter) */
function popular(){
  if(POP) return POP;
  var cnt = lsGet('hayat-cap-pop', {});
  Object.values(S.orders).forEach(function(o){ (o.lines || []).forEach(function(l){ cnt[l.id] = (cnt[l.id] || 0) + (l.q || 0); }); });
  var ids = Object.keys(cnt).filter(function(k){ return BYID[k]; }).sort(function(a, b){ return cnt[b] - cnt[a]; }).slice(0, 14);
  if(ids.length < 6) IDX.slice(0, 14).forEach(function(x){ if(ids.indexOf(x.id) < 0 && ids.length < 14) ids.push(x.id); });
  POP = ids.map(function(k){ return BYID[k]; });
  return POP;
}
function bumpPop(lines){ var cnt = lsGet('hayat-cap-pop', {}); lines.forEach(function(l){ cnt[l.id] = (cnt[l.id] || 0) + l.q; }); lsSet('hayat-cap-pop', cnt); }
/* ---------------- the REAL menu: learned from VMENU bills ----------------
   The website menu (menu-data.js) is the customer menu; the shop sells from VMENU,
   which has Meals, Porotta, King Fish Mandi, bottled drinks by size… So the captain app
   learns the dish list, sizes, latest prices and kitchens from what VMENU billed:
   vm_months (2 months, every item + qty) + the last 7 vm_daylog days (price, kitchen,
   hour of day, what is ordered together). Kept in settings/pos_menu, rebuilt once a day
   by the first phone that opens. Office edits (price, hide, new dish) live apart in
   settings/pos_edits so a rebuild never undoes them. */
var CATS = [['Mandi',/MANDI|KABSA|MAJBOOS|MANDHI/],['Juices & shakes',null,'juice'],['Bottled drinks',null,'soft'],
  ['Fish & seafood',/FISH|PRAWN|SQUID|CRAB|POMFRET|AILA|AYALA|MATHI|NEYMEEN|SEER|KOONTHAL|CHEMMEEN|KALLUMMAKKAYA|ANCHOVY|NATHOLI/],
  ['Alfaham & grill',/ALFAHAM|ALFAM|ALFHAM|SHAWAYA|GRILL|TANDOOR|TIKKA|KEBAB|KABAB|BBQ|SHAWARMA/],
  ['Broast & fried',/BROAST|\bFRY\b|FRIED(?! RICE)|\b65\b|CRISPY|POPCORN|NUGGET|WINGS|STRIPS|LOLLIPOP/],
  ['Biriyani & rice',/BIRIYANI|BIRYANI|RICE|MEALS|PULAO|GHEE/],
  ['Breads',/POROTTA|PORATTA|PAROTTA|CHAPATI|CHAPPATHI|KUBOOS|KHUBOOS|NAAN|ROTI|APPAM|PATHIRI|IDIYAPPAM|PUTTU|BUN\b/],
  ['Curries & gravy',/CURRY|MASALA|ROAST|BUTTER CHICKEN|CHILLI|PEPPER|KADAI|GRAVY|STEW|KURMA|KORMA|\bDRY\b|MAPPAS|THORAN|MANCHURIAN/],
  ['Tea & coffee',/\bTEA\b|COFFEE/],['Desserts',/ICE ?CREAM|PUDDING|KUNAFA|SWEET|CAKE|HALWA|PAYASAM|BURFI|BARFI/],['Salads & sides',/SALAD|MAYO|RAITA|PICKLE|FRIES|SOUP/]];
var DR_SOFT = /7 ?UP|SPRITE|PEPSI|COCA|COCO ?COLA|COKE|\bSLICE\b|MIRINDA|FANTA|THUMS ?UP|LIMCA|MAAZA|FROOTI|\bDEW\b|RED ?BULL|\bSTING\b|BISLERI|KINLEY|AQUAFINA|MINERAL|MENIRAL|WATER BOTTLE|BOTTLE WATER|\bCAN\b|\bPET\b|\d+ ?ML\b|\d ?LTR\b/i;
var DR_JUICE = /JUICE|LIME|LEMON|MOJITO|SHAKE|FALOODA|LASSI|SMOOTHIE|AVIL ?MILK|SHARJAH|COOLER|PUNCH|MOCKTAIL|SQUASH|SARBATH|SHARBAT|NANNARI|SODA/i;
function catName(u){ u = String(u || '').toUpperCase(); var k = DR_SOFT.test(u) ? 'soft' : DR_JUICE.test(u) ? 'juice' : '';
  for(var i = 0; i < CATS.length; i++){ var c = CATS[i]; if(c[2] && k === c[2]) return c[0]; if(c[1] && c[1].test(u)) return c[0]; } return 'Others'; }
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function titleCase(s){ return String(s).toLowerCase().replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); }).replace(/\b(Ml|Ltr|Pcs)\b/g, function(x){ return x.toLowerCase(); }); }
var SZ_ORDER = { qtr:1, half:2, full:3 };
/* "ALFAHAM MANDI HALF" -> {fam:"ALFAHAM MANDI", size:"Half"}; "BROAST (8PCS)" -> 8 pcs; "7UP 750ML" -> 750ml */
function parseName(raw){
  var n = String(raw || '').replace(/\s+/g, ' ').trim().toUpperCase();
  n = n.replace(/(ML|LTR|L|\))\s+\d{1,3}$/, '$1');               /* "COCOCOLA 250ML 20": the 20 is the price */
  var m, fam = n, size = '';
  if((m = n.match(/^(.*?)[\s(]+(QTR|QUARTER|HALF|FULL)\)?$/))){ fam = m[1]; size = { QTR:'Qtr', QUARTER:'Qtr', HALF:'Half', FULL:'Full' }[m[2]]; }
  else if((m = n.match(/^(.*?)\s*\((\d+)\s*PCS?\)$/))){ fam = m[1]; size = m[2] + ' pcs'; }
  else if((m = n.match(/^(.*?)\s*\(?(\d+(?:\.\d+)?)\s*(ML|LTR|LT|L)\)?$/))){ fam = m[1]; size = m[2] + (m[3] === 'ML' ? 'ml' : ' ltr'); }
  else if((m = n.match(/^(.*?)\s+(CAN|\d{2})$/)) && DR_SOFT.test(n)){ fam = m[1]; size = m[2] === 'CAN' ? 'Can' : 'Small'; }   /* "7UP 20" = ₹20 bottle; "CHICKEN 65" is a dish */
  fam = fam.replace(/[\s(]+$/, '').trim() || n;
  return { fam:fam, size:size };
}
function sizeRank(l){ var k = String(l).toLowerCase(); if(SZ_ORDER[k]) return SZ_ORDER[k]; var m = k.match(/[\d.]+/); if(!m) return 50; var v = +m[0]; if(/ltr/.test(k)) v *= 1000; return 10 + v / 10; }
var POSM = null, POSE = {};
async function buildPosMenu(){
  var now = Date.now(), d0 = new Date(now - BH0 * 3600e3), days = [], months = [];
  for(var i = 0; i < 7; i++){ var d = new Date(d0); d.setDate(d.getDate() - i); days.push(ymd(d)); }
  months.push(days[0].slice(0, 7)); var pm = new Date(d0); pm.setDate(1); pm.setMonth(pm.getMonth() - 1); months.push(ymd(pm).slice(0, 7));
  var names = {}, pairs = {}, famBills = {}, bills = 0;
  var touch = function(n){ return names[n] = names[n] || { n:n, q:0, v:0, p:0, pAt:'', kit:'', h:Array(24).fill(0), inMonth:false }; };
  for(var mi = 0; mi < months.length; mi++){ try{ var md = await S.F.getDoc(ref('vm_months', months[mi])); if(md.exists()){ var its = md.data().items || {}; Object.keys(its).forEach(function(k){ var x = its[k], t = touch(x.n || k); t.q += +x.q || 0; t.v += +x.v || 0; t.inMonth = true; }); } }catch(e){} }
  for(var di = 0; di < days.length; di++){
    var doc = null; try{ var sn = await S.F.getDoc(ref('vm_daylog', days[di])); if(sn.exists()) doc = sn.data(); }catch(e){}
    if(!doc || !doc.records) continue;
    Object.values(doc.records).forEach(function(r){
      if(r.status === 'void' || r.status === 'cancelled') return;
      var fams = {}, h = r.createdAt ? (new Date(String(r.createdAt).replace(' ', 'T')).getHours()) : -1; bills++;
      (r.items || []).forEach(function(it){ if(!it || !it.n) return; var t = touch(it.n);
        if(!t.inMonth) t.q += +it.q || 0;   /* not in a month snapshot yet (today) */
        if(it.p > 0 && String(r.createdAt || '') >= t.pAt){ t.p = +it.p; t.pAt = String(r.createdAt || ''); }
        if(it.kit) t.kit = it.kit; if(h >= 0) t.h[h] += +it.q || 1;
        fams['v-' + slug(parseName(it.n).fam)] = 1; });
      var F = Object.keys(fams); F.forEach(function(a){ famBills[a] = (famBills[a] || 0) + 1; var P = pairs[a] = pairs[a] || {}; F.forEach(function(b){ if(a !== b) P[b] = (P[b] || 0) + 1; }); });
    });
  }
  var fams = {};
  Object.values(names).forEach(function(t){ if(!(t.q >= 2) && !t.pAt) return; var price = t.p || (t.q ? Math.round(t.v / t.q) : 0); if(!(price > 0)) return;
    var pn = parseName(t.n), id = 'v-' + slug(pn.fam), f = fams[id] = fams[id] || { id:id, name:titleCase(pn.fam), cat:catName(t.n), kit:t.kit || '', q:0, h:Array(24).fill(0), ch:[] };
    f.q += t.q; t.h.forEach(function(v, i){ f.h[i] += v; }); if(t.kit && !f.kit) f.kit = t.kit;
    var dup = f.ch.filter(function(c){ return c.label === pn.size; })[0];
    if(dup){ if(t.q > dup.q){ dup.price = price; dup.vn = t.n; dup.q = t.q; dup.kit = t.kit || dup.kit; } }   /* "MINERAL"/"MENIRAL" style twins: keep the busier */
    else f.ch.push({ label:pn.size, price:price, vn:t.n, q:t.q, kit:t.kit || '' }); });
  var list = Object.values(fams); list.forEach(function(f){ f.ch.sort(function(a, b){ return sizeRank(a.label) - sizeRank(b.label); }); f.q = Math.round(f.q); });
  var P2 = {}; Object.keys(pairs).forEach(function(a){ var top = Object.keys(pairs[a]).sort(function(x, y){ return pairs[a][y] - pairs[a][x]; }).slice(0, 10), o = {}; top.forEach(function(b){ o[b] = pairs[a][b]; }); P2[a] = o; });   /* maps, not [[id,n]]: Firestore refuses nested arrays */
  var out = clean({ v:1, at:now, by:who() || '', days:days, months:months, bills:bills, fams:list, pairs:P2, famBills:famBills });
  if(list.length >= 10){ try{ await S.F.setDoc(ref('settings', 'pos_menu'), out); }catch(e){ console.warn('pos_menu not saved', e); toast('Menu learned on this phone only', 'bad', esc(e && e.message || e)); } }
  return out;
}
async function ensurePosMenu(){
  try{
    var sn = await S.F.getDoc(ref('settings', 'pos_menu')); POSM = sn.exists() ? sn.data() : null;
    var e = await S.F.getDoc(ref('settings', 'pos_edits')); POSE = e.exists() ? e.data() : {};
    var stale = !POSM || !POSM.at || Date.now() - POSM.at > 20 * 3600e3;
    if(stale && S.me){
      var lease = ref('settings', 'pos_menu_lease'), mine = false;
      try{ mine = await S.F.runTransaction(S.D, async function(tx){ var l = await tx.get(lease); if(l.exists() && Date.now() - (l.data().at || 0) < 10 * 60e3) return false; tx.set(lease, { at:Date.now(), by:who() }); return true; }); }catch(x){}
      if(mine){ var b = await buildPosMenu(); if(b.fams.length >= 10) POSM = b; }
    }
  }catch(err){ console.warn('pos menu', err); }
}
function posCats(){
  if(!POSM || !POSM.fams || !POSM.fams.length) return null;
  var hide = POSE.hide || {}, price = POSE.price || {};
  var fams = POSM.fams.concat(POSE.add || []).filter(function(f){ return !hide[f.id]; }).map(function(f){
    return Object.assign({}, f, { ch:(f.ch || []).filter(function(c){ return !hide[f.id + '|' + c.label]; }).map(function(c){ var k = f.id + '|' + c.label; return Object.assign({}, c, { price:price[k] != null ? +price[k] : c.price }); }) }); }).filter(function(f){ return f.ch.length; });
  var G = {}; fams.forEach(function(f){ var g = G[f.cat] = G[f.cat] || { id:slug(f.cat), name:f.cat, q:0, items:[] }; g.q += f.q || 0; g.items.push(f); });
  return Object.values(G).sort(function(a, b){ return b.q - a.q; }).map(function(g){ g.items.sort(function(a, b){ return (b.q || 0) - (a.q || 0); }); return g; });
}

/* ---------------- search: initials, sizes, small typos ----------------
   "cmf" / "cm full" / "chiken mandi f" all find Chicken Mandi · Full. */
var SZ_TOK = { q:'qtr', qt:'qtr', qtr:'qtr', quarter:'qtr', h:'half', hf:'half', half:'half', f:'full', fl:'full', full:'full' };
function lev1(a, b){ if(a === b) return true; if(Math.abs(a.length - b.length) > 1) return false; var i = 0, j = 0, e = 0;
  while(i < a.length && j < b.length){ if(a[i] === b[j]){ i++; j++; continue; } if(++e > 1) return false; if(a.length > b.length) i++; else if(b.length > a.length) j++; else { i++; j++; } }
  return e + (a.length - i) + (b.length - j) <= 1; }
function searchMenu(q){
  var toks = q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean); if(!toks.length) return [];
  var sz = null; if(toks.length > 1 && SZ_TOK[toks[toks.length - 1]]){ sz = SZ_TOK[toks.pop()]; }
  var tryOnce = function(T, szz){ var out = [];
    IDX.forEach(function(x){ var words = x.words, ini = x.ini, score = 0, ok = T.every(function(t){
        var best = 0; words.forEach(function(w){ if(w.indexOf(t) === 0) best = Math.max(best, 3 + (w === t ? 1 : 0)); else if(t.length >= 3 && w.indexOf(t) > 0) best = Math.max(best, 1.5); else if(t.length >= 4 && (lev1(t, w.slice(0, t.length)) || lev1(t, w.slice(0, t.length + 1)) || lev1(t, w.slice(0, t.length - 1)))) best = Math.max(best, 1); });
        if(!best && t.length >= 2 && ini.indexOf(t) === 0) best = 2.5;
        score += best; return best > 0; });
      if(!ok) return;
      var chs = x.ch.map(function(c, i){ return i; }); if(szz){ var f = chs.filter(function(i){ return String(x.ch[i].label).toLowerCase().split(' · ').pop().indexOf(szz) === 0 || (szz === 'qtr' && /quarter/i.test(x.ch[i].label)); }); if(f.length) chs = f; else score -= 2; }
      out.push({ x:x, s:score + Math.log(1 + (x.q || 0)) * .35, chs:chs, sz:szz }); });
    return out.sort(function(a, b){ return b.s - a.s; }); };
  var r = tryOnce(toks, sz);
  if(!r.length && toks.length === 1 && toks[0].length >= 2 && SZ_TOK[toks[0].slice(-1)]){ r = tryOnce([toks[0].slice(0, -1)], SZ_TOK[toks[0].slice(-1)]); }   /* "cmf" = cm + f */
  return r.slice(0, 40);
}

/* ---------------- money + kitchens ---------------- */
function linesTotal(L){ return (L || []).reduce(function(n, l){ return n + (l.q || 0) * (l.price || 0); }, 0); }
function money(o, over){
  over = over || {};
  var sub = linesTotal(o.lines), d = over.discount !== undefined ? over.discount : o.discount, off = 0;
  if(d && d.value > 0) off = d.type === 'pct' ? sub * Math.min(d.value, 100) / 100 : Math.min(d.value, sub);
  off = Math.round(off);
  var charge = Math.max(0, Math.round(+o.charge || 0)), tip = Math.max(0, Math.round(+(over.tip !== undefined ? over.tip : o.tip) || 0));
  var total = Math.max(0, sub - off) + charge;
  return { sub:sub, off:off, charge:charge, total:total, tip:tip, pay:total + tip };
}
function catOf(id){ var x = BYID[id]; if(x) return x.catId; var hit = ''; (window.MENU || []).forEach(function(c){ (c.items || []).forEach(function(it){ if(it.id === id) hit = c.id; }); }); return hit; }
function kitchens(){
  var ps = S.print || {};
  if(ps.kitchens && ps.kitchens.length) return ps.kitchens;
  return [{ key:'main', name:'Main kitchen', cancel:true }, { key:'front', name:'Front', cancel:true }];
}
function station(l){
  var kit = String(l.kit || (BYID[l.id] && BYID[l.id].kit) || '').toUpperCase();
  if(/NO ?KOT/.test(kit)) return 'none';                 /* bottled drinks etc: VMENU prints no KOT for them */
  if(kit && kit.replace(/KITCHEN/g, '').trim()){ var kk = kitchens(), w = kit.replace(/KITCHEN/g, '').trim().toLowerCase().split(/\s+/)[0];
    var hit0 = kk.filter(function(k){ return (String(k.name || '') + ' ' + k.key).toLowerCase().indexOf(w) >= 0; })[0]; if(hit0) return hit0.key; }
  var ks = (S.print || {}).kitchens;
  if(ks && ks.length){ var kc = catOf(l.id);
    var hit = ks.filter(function(k){ return (k.items || []).indexOf(l.id) >= 0; })[0] || ks.filter(function(k){ return (k.cats || []).indexOf(kc) >= 0; })[0] || ks.filter(function(k){ return k.dflt; })[0] || ks[0];
    return hit.key; }
  var cid = catOf(l.id), set = ((S.print || {}).stations || {})[cid];
  if(set === 'main' || set === 'front') return set;
  var main = ((C.kot || {}).main) || []; if(main.indexOf(cid) >= 0) return 'main';
  var n = (cid + ' ' + (l.name || '')).toLowerCase();
  if(/mandi|alfaham|bread|parotta|kuboos|chapati|meal|biryani|beef|rice$/.test(n) && !/fried rice|juice/.test(n)) return 'main';
  return 'front';
}
function kname(k){ var x = kitchens().filter(function(z){ return z.key === k; })[0]; return x ? x.name : k; }
function canPrint(){ return (S.print || {}).mode === 'agent'; }
function site(){ return (location.host + location.pathname).replace(/[^/]*$/, '').replace(/\/$/, ''); }
function sendPrint(job){
  return S.F.addDoc(col('print_jobs'), clean(Object.assign({}, job, { done:false, tries:0, by:S.me ? S.me.name : '', sentAt:Date.now() })))
    .then(function(){ return true; }).catch(function(e){ toast('Printer job not sent', 'bad', esc(e && e.message || e)); return false; });
}
function printKot(o, lines, round, cancel, reason, skip){
  if(!canPrint() || cfg('printKot', !isTrial()) === false) return Promise.resolve(false);
  var by = {}; lines.forEach(function(l){ if(l.q > 0){ var st = l.station || station(l); if(st === 'none') return; (by[st] = by[st] || []).push({ k:l.k, id:l.id, name:l.name, label:l.label || '', q:l.q, price:l.price }); } });
  var order = kitchens().map(function(k){ return k.key; }); Object.keys(by).forEach(function(k){ if(order.indexOf(k) < 0) order.push(k); });
  var tickets = order.filter(function(k){ return by[k]; })
    .filter(function(k){ return !skip || skip.indexOf(k) < 0; })
    .filter(function(k){ if(!cancel) return true; var z = kitchens().filter(function(x){ return x.key === k; })[0]; return !z || z.cancel !== false; })
    .map(function(k){ return { station:k, name:kname(k), lines:by[k], round:round, cancel:!!cancel, reason:reason || '', reprint:false, where:'', table:o.table || '', mode:'dinein' }; });
  if(!tickets.length) return Promise.resolve(false);
  return sendPrint({ kind:'kot', at:Date.now(), auto:false, site:site(), order:Object.assign({}, o, { lines:lines, kotRound:round, kotCancel:!!cancel, kotReason:reason || '' }), tickets:tickets, money:money(o), offLabel:'', reviewUrl:'' });
}
function offLabel(o){ var d = o.discount; if(!d || !d.value) return ''; return d.type === 'pct' ? d.value + '% off' : rs(d.value) + ' off'; }
function printBill(o){
  if(!canPrint() || cfg('printBill', true) === false) return Promise.resolve(false);
  var L = live(o);
  return sendPrint({ kind:'bill', at:Date.now(), auto:true, site:site(), order:Object.assign({}, o, { lines:L }), tickets:[], money:money(o), offLabel:offLabel(o), reviewUrl:'' });
}

/* ---------------- tables + orders ---------------- */
function floor(){ return S.floor && S.floor.spaces && S.floor.spaces.length ? S.floor : DEF_FLOOR; }
function allTables(){ var out = []; floor().spaces.forEach(function(sp){ (sp.tables || []).forEach(function(t){ out.push(Object.assign({ space:sp.id, spaceName:sp.name }, t)); }); }); return out; }
function tableById(id){ return allTables().filter(function(t){ return t.id === id; })[0] || null; }
function closed(o){ return o.status === 'delivered' || o.status === 'cancelled'; }
function live(o){ return (o.lines || []).filter(function(l){ return l.q > 0; }); }
function openOrder(t){
  var key = norm(t.name);
  return Object.values(S.orders).filter(function(o){ return o.mode === 'dinein' && !closed(o) && (o.tableId === t.id || (!o.tableId && norm(o.table) === key)); })
    .sort(function(a, b){ return (b.at || 0) - (a.at || 0); })[0] || null;
}
function openClean(t){ return Object.values(S.clean).filter(function(c){ return c.status !== 'done' && c.status !== 'cancelled' && c.tableId === t.id; }).sort(function(a, b){ return (a.at || 0) - (b.at || 0); })[0] || null; }
function tstate(t){
  var o = openOrder(t); if(o) return { st:o.dueAt ? 'bill' : 'eat', o:o, m:money(o) };
  var c = openClean(t); if(c) return { st:'clean', c:c };
  return { st:'free' };
}
function draftOf(id){ return (S.draft[id] && S.draft[id].lines) || []; }
function draftCount(id){ return draftOf(id).reduce(function(n, l){ return n + l.q; }, 0); }
function orderId(){ var d = new Date(); return 'H' + String(d.getDate()).padStart(2, '0') + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function who(){ return S.me ? S.me.name : ''; }

function addDraft(tid, x, ch, note){
  var d = S.draft[tid] = S.draft[tid] || { lines:[] };
  var k = x.id + '|' + (ch.label || '') + (note ? '|' + note : '');
  var l = d.lines.filter(function(z){ return z.k === k; })[0];
  if(!d.at) d.at = Date.now();
  if(l) l.q++; else d.lines.push(clean({ k:k, id:x.id, name:x.name, label:ch.label || '', price:ch.price, q:1, note:note || '', vn:ch.vn || undefined, kit:ch.kit || x.kit || undefined }));
  saveDraft(); vib(8);
}
function stepDraft(tid, k, dq){
  var d = S.draft[tid]; if(!d) return; var l = d.lines.filter(function(z){ return z.k === k; })[0]; if(!l) return;
  l.q += dq; if(l.q <= 0) d.lines = d.lines.filter(function(z){ return z !== l; });
  if(!d.lines.length){ delete d.at; if(!d.pax) delete S.draft[tid]; }
  saveDraft();
}

/* first KOT creates the order; every later KOT is an add-on - only the new items go to the kitchen.
   One transaction reads the table lock (tablelock/{tableId} -> open order id), so two phones
   starting the same table at once end up on ONE bill, never two. */
var SENDING = {};
async function sendKot(tid){
  var t = tableById(tid); if(!t) return;
  if(SENDING[tid]) return;                       /* a double tap must not send twice */
  var taken = draftOf(tid).filter(function(l){ return l.q > 0; }).map(function(l){ return { k:l.k, q:l.q }; });
  var adds = draftOf(tid).filter(function(l){ return l.q > 0; }).map(function(l){ return clean({ k:l.k, id:l.id, name:l.name, label:l.note ? (l.label ? l.label + ' · ' : '') + l.note : l.label, price:l.price, q:l.q, vn:l.vn || undefined, kit:l.kit || undefined }); });
  if(!adds.length){ toast('Nothing new to send', 'bad'); return; }
  if(!S.online){ toast('No internet', 'bad', 'the KOT needs internet to reach the kitchen'); return; }
  /* a send id saved WITH the draft: if the phone refreshes mid-send and the waiter taps again, the bill
     already holds a KOT with this id and nothing goes to the kitchen twice */
  var ko = (S.draft[tid] && S.draft[tid].kopt) || { flags:[], note:'', off:[] }, kNote = kotNoteText(ko), kHold = ko.flags.indexOf('hold') >= 0, kPri = ko.flags.indexOf('urgent') >= 0 ? 'urgent' : ko.flags.indexOf('norush') >= 0 ? 'norush' : '';
  var kx = function(base){ return clean(Object.assign(base, { note:kNote || undefined, flags:ko.flags.length ? ko.flags.slice() : undefined, pri:kPri || undefined, hold:kHold || undefined, skip:ko.off.length ? ko.off.slice() : undefined })); };
  var dd = S.draft[tid]; if(!dd.sid){ dd.sid = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); saveDraft(); } var sid = dd.sid;
  SENDING[tid] = true; render();
  var now = Date.now(), me = who(), round = 1, saved;
  var lockRef = ref(C_('tablelock'), t.id), local = openOrder(t);
  try{
    saved = await S.F.runTransaction(S.D, async function(tx){
      var lk = await tx.get(lockRef), oid = (lk.exists() && lk.data().oid) || (local && local.id) || null, cur = null, r = null;
      if(oid){ r = ref(C_('orders'), oid); var sn = await tx.get(r); if(sn.exists() && !closed(sn.data())) cur = sn.data(); }
      if(cur && (cur.kots || []).some(function(k){ return k.sid === sid; })) return Object.assign({}, cur, { id:oid, __dup:true });
      if(!cur){
        var id = orderId(), nr = ref(C_('orders'), id), ex = await tx.get(nr); if(ex.exists()){ id = orderId() + 'X'; nr = ref(C_('orders'), id); }
        var o = clean({ id:id, at:now, status:'accepted', log:[{ s:'placed', at:now }, { s:'accepted', at:now, by:me }], source:'captain', mode:'dinein', kind:'dine',
          table:t.name, tableId:t.id, space:t.space, section:t.spaceName, pax:(S.draft[tid] && S.draft[tid].pax) || null,
          by:me, byRole:S.me.role, crew:S.me.id, custUid:(S.ctx.user && S.ctx.user.uid) || '', day:bizDay(now),
          lines:adds.map(function(a){ return Object.assign({}, a, { at:now, by:me, rounds:[{ n:1, q:a.q, at:now, by:me }] }); }),
          kots:[kx({ n:1, kind:'kot', at:now, by:me, sid:sid, lines:adds.map(function(a){ return { k:a.k, name:a.name, label:a.label || '', q:a.q, station:station(a) }; }) })],
          kotN:1, edits:[], total:linesTotal(adds), discount:null, tip:0, trial:isTrial() });
        tx.set(nr, o); tx.set(lockRef, { oid:id, at:now, table:t.name }); round = 1;
        return o;
      }
      var lines = (cur.lines || []).map(function(l){ return Object.assign({}, l, { rounds:(l.rounds || []).slice() }); });
      round = (cur.kotN || (cur.kots || []).filter(function(k){ return k.kind === 'kot'; }).length || 1) + 1;
      adds.forEach(function(a){ var l = lines.filter(function(z){ return z.k === a.k; })[0];
        if(l){ l.q += a.q; l.rounds.push({ n:round, q:a.q, at:now, by:me }); }
        else lines.push(Object.assign({}, a, { at:now, by:me, rounds:[{ n:round, q:a.q, at:now, by:me }] })); });
      var kots = (cur.kots || []).concat([kx({ n:round, kind:'kot', at:now, by:me, sid:sid, lines:adds.map(function(a){ return { k:a.k, name:a.name, label:a.label || '', q:a.q, station:station(a) }; }) })]);
      var patch = clean({ lines:lines, kots:kots, kotN:round, total:money(Object.assign({}, cur, { lines:lines })).total, editedAt:now, dueAt:null });
      tx.update(r, patch); if(!lk.exists() || lk.data().oid !== oid) tx.set(lockRef, { oid:oid, at:now, table:t.name });
      return Object.assign({}, cur, patch, { id:oid });
    });
  }catch(e){ SENDING[tid] = false; toast('KOT not sent', 'bad', esc(e && e.message || e)); render(); return; }
  SENDING[tid] = false;
  var dup = saved.__dup; delete saved.__dup;
  S.orders[saved.id] = saved; setMode(t, 'bill');
  bumpPop(adds); ux('kot', { round:round, items:adds.reduce(function(n, a){ return n + a.q; }, 0), ms:dd && dd.at ? Date.now() - dd.at : undefined, dup:dup || undefined });
  /* take off only what was sent - dishes tapped while it was sending stay in the draft */
  var d = S.draft[tid]; if(d){ delete d.sid; delete d.kopt; taken.forEach(function(x){ var l = d.lines.filter(function(z){ return z.k === x.k; })[0]; if(l) l.q -= x.q; }); d.lines = d.lines.filter(function(l){ return l.q > 0; }); if(!d.lines.length) delete S.draft[tid]; saveDraft(); }
  if(dup){ toast('Already sent ✓', 'good', 'this KOT reached the kitchen before the phone refreshed'); render(); return; }
  var selfL = adds.filter(function(a){ return station(a) === 'none'; });
  var printed = kHold ? false : await printKot(Object.assign({}, saved, { note:kNote || saved.note }), adds, round, false, '', ko.off);
  if(selfL.length) setTimeout(function(){ toast('🥤 You bring: ' + selfL.map(function(l){ return l.q + '× ' + esc(l.name) + (l.label ? ' ' + esc(short(l.label)) : ''); }).join(', '), '', 'no kitchen ticket for these'); }, 900);
  toast((kHold ? '⏸ KOT ' + round + ' on hold · ' : 'KOT ' + round + ' sent · ') + adds.reduce(function(n, a){ return n + a.q; }, 0) + ' item' + (adds.length > 1 || adds[0].q > 1 ? 's' : ''), 'good', esc(t.name) + (printed ? ' · printing in the kitchen' : canPrint() ? '' : ' · kitchen printer not set up'));
  vib([12, 40, 12]);
  render();
}

/* every change to a running bill goes through a transaction that refuses a bill already closed
   on another phone - a payment can never overwrite a cancel, a void never edits a paid bill */
function txOrder(oid, fn){
  var r = ref(C_('orders'), oid);
  return S.F.runTransaction(S.D, async function(tx){
    var sn = await tx.get(r); if(!sn.exists()) throw new Error('bill not found');
    var cur = Object.assign({}, sn.data(), { id:oid }); if(closed(cur)) throw new Error('this bill was already ' + (cur.status === 'cancelled' ? 'cancelled' : 'paid') + ' on another phone');
    var patch = fn(cur); tx.update(r, clean(patch)); return Object.assign({}, cur, clean(patch));
  });
}
function fail(what, e){ toast(what, 'bad', esc(e && e.message || e)); }

async function voidLine(oid, k, qty, reason){
  var now = Date.now(), me = who(), out = {};
  try{
    var o2 = await txOrder(oid, function(cur){
      var lines = (cur.lines || []).map(function(l){ return Object.assign({}, l, { rounds:(l.rounds || []).slice() }); });
      var l = lines.filter(function(z){ return z.k === k; })[0]; if(!l || l.q <= 0) throw new Error('already removed');
      qty = Math.min(qty, l.q); var from = l.q; l.q -= qty; l.rounds.push({ n:'void', q:-qty, at:now, by:me, reason:reason });
      out.n = cur.kotN || 1; out.l = Object.assign({}, l, { q:qty });
      return { lines:lines, kots:(cur.kots || []).concat([{ n:out.n, kind:'cancel', at:now, by:me, reason:reason, lines:[{ k:l.k, name:l.name, label:l.label || '', q:qty, station:station(l) }] }]),
        edits:(cur.edits || []).concat([{ at:now, by:me, item:l.name, label:l.label || '', from:from, to:l.q, reason:reason, void:l.q === 0 }]),
        total:money(Object.assign({}, cur, { lines:lines })).total, editedAt:now };
    });
  }catch(e){ fail('Not removed', e); return; }
  S.orders[oid] = o2; ux('void', { name:out.l.name, q:qty, reason:reason });
  printKot(o2, [out.l], out.n, true, reason);
  toast('Removed ' + qty + '× ' + esc(out.l.name), '', 'cancel ticket ' + (canPrint() ? 'sent to the kitchen' : 'saved'));
  render();
}

async function dueBill(oid){
  var now = Date.now(), o;
  try{ o = await txOrder(oid, function(cur){ return { dueAt:now, dueCount:(cur.dueCount || 0) + 1, total:money(cur).total, log:(cur.log || []).concat([{ s:'due', at:now, by:who() }]) }; }); }
  catch(e){ fail('Bill not saved', e); return; }
  S.orders[oid] = o; ux('due', { n:o.dueCount });
  var p = await printBill(o);
  toast((o.dueCount > 1 ? 'Bill printed again · ' : 'Bill · ') + rs(money(o).total), 'good', p ? 'printing at the counter' : canPrint() ? 'bill printing is off in Settings' : 'printer not set up - show the bill on this phone');
  render(); paySheet(oid);
}

async function markPaid(oid, P, shown){
  var now = Date.now(), o, m;
  try{
    o = await txOrder(oid, function(cur){
      m = money(cur, { discount:P.discount, tip:P.tip });
      if(shown != null && m.pay !== shown) throw new Error('the bill changed to ' + rs(m.pay) + ' - check it and take the money again');
      var pays = P.mode === 'split' ? P.split.filter(function(x){ return x.amt > 0; }) : [{ mode:P.mode, amt:m.pay }];
      return { discount:P.discount || null, tip:m.tip, total:m.total, paid:true, payMode:P.mode, paidAt:now, paidBy:who(), paidCrew:S.me.id, paidAmt:m.pay !== m.total ? m.pay : null,
        pays:pays, tendered:P.mode === 'cash' && P.tendered ? P.tendered : null, change:P.mode === 'cash' && P.tendered > m.pay ? P.tendered - m.pay : null,
        status:'delivered', dueAt:cur.dueAt || now, log:(cur.log || []).concat([{ s:'delivered', at:now, by:who(), paid:m.pay }]) };
    });
  }catch(e){ fail('Payment not saved', e); return false; }
  S.orders[oid] = o;
  if(P.cleanAfter && o.tableId) await requestClean(o.tableId, 'clean', 'normal', 'after bill', true);
  toast('Paid ✓ ' + rs(m.pay) + ' · ' + payWord(P.mode), 'good', esc(o.table || '') + (P.cleanAfter ? ' · cleaner called' : ''));
  vib([20, 60, 20]);
  return true;
}
function payWord(m){ return { cash:'Cash', upi:'UPI', card:'Card', split:'Split', credit:'Credit' }[m] || m; }

async function moveTable(oid, toId){
  var o = S.orders[oid], t = tableById(toId); if(!o || !t) return;
  var now = Date.now(), from = o.tableId, fresh;
  try{
    fresh = await S.F.runTransaction(S.D, async function(tx){
      var r = ref(C_('orders'), oid), to = ref(C_('tablelock'), t.id), sn = await tx.get(r), lk = await tx.get(to);
      if(!sn.exists() || closed(sn.data())) throw new Error('bill already closed');
      if(lk.exists() && lk.data().oid && lk.data().oid !== oid){ var other = await tx.get(ref(C_('orders'), lk.data().oid)); if(other.exists() && !closed(other.data())) throw new Error(t.name + ' was just taken'); }
      var cur = sn.data(), patch = clean({ table:t.name, tableId:t.id, space:t.space, section:t.spaceName, moves:(cur.moves || []).concat([{ at:now, by:who(), from:cur.table, to:t.name }]) });
      tx.update(r, patch); tx.set(to, { oid:oid, at:now, table:t.name }); if(from) tx.set(ref(C_('tablelock'), from), { oid:null, at:now });
      return Object.assign({}, cur, patch, { id:oid });
    });
  }catch(e){ fail('Not moved', e); return; }
  if(S.draft[from]){ S.draft[toId] = S.draft[from]; delete S.draft[from]; saveDraft(); }
  S.orders[oid] = fresh; S.table = toId; toast('Moved to ' + esc(t.name), 'good'); render();
}
async function cancelBill(oid, reason){
  var now = Date.now(), me = who(), L = [], o;
  try{ o = await txOrder(oid, function(cur){ L = live(cur);
    return { kots:(cur.kots || []).concat(L.length ? [{ n:cur.kotN || 1, kind:'cancel', at:now, by:me, reason:reason, lines:L.map(function(l){ return { k:l.k, name:l.name, label:l.label || '', q:l.q, station:station(l) }; }) }] : []),
      edits:(cur.edits || []).concat(L.map(function(l){ return { at:now, by:me, item:l.name, label:l.label || '', from:l.q, to:0, reason:reason, void:true, bill:true }; })),
      status:'cancelled', cancelReason:reason, log:(cur.log || []).concat([{ s:'cancelled', at:now, by:me, reason:reason }]) }; }); }
  catch(e){ fail('Not cancelled', e); return; }
  S.orders[oid] = o; if(L.length) printKot(o, L, o.kotN || 1, true, reason);
  toast('Bill cancelled', '', esc(reason)); S.view = 'floor'; render();
}
async function setPax(tid, n){
  n = Math.max(1, Math.min(40, n)); var t = tableById(tid), o = t && openOrder(t);
  if(o){ o.pax = n; try{ await S.F.updateDoc(ref(C_('orders'), o.id), { pax:n }); }catch(e){} }
  else { S.draft[tid] = S.draft[tid] || { lines:[] }; S.draft[tid].pax = n; saveDraft(); }
  render();
}

/* ---------------- cleaning ---------------- */
async function requestClean(tid, kind, urgency, note, quiet){
  var t = tableById(tid); if(!t) return;
  var id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), now = Date.now();
  var c = clean({ id:id, table:t.name, tableId:t.id, space:t.space, spaceName:t.spaceName, kind:kind, urgency:urgency, note:note || '', by:who(), byRole:S.me.role, at:now, status:'open', day:bizDay(now) });
  try{ await S.F.setDoc(ref(C_('cleanreq'), id), c); S.clean[id] = c; }catch(e){ toast('Request not sent', 'bad', esc(e.message || e)); return; }
  if(!quiet) toast('🧹 Cleaner called · ' + esc(t.name), 'clean', kindName(kind) + (urgency === 'urgent' ? ' · URGENT' : ''));
  render();
}
async function cleanStep(id, to){
  var c = S.clean[id]; if(!c) return; var now = Date.now(), patch = { status:to };
  if(to === 'taken'){ patch.takenBy = who(); patch.takenAt = now; }
  if(to === 'done'){ patch.doneBy = who(); patch.doneAt = now; if(!c.takenAt){ patch.takenAt = now; patch.takenBy = who(); } }
  if(to === 'cancelled'){ patch.cancelBy = who(); patch.cancelAt = now; }
  try{ await S.F.updateDoc(ref(C_('cleanreq'), id), patch); Object.assign(c, patch); }catch(e){ toast('Not saved', 'bad', esc(e.message || e)); return; }
  if(to === 'done') toast('✓ ' + esc(c.table) + ' is clean', 'good');
  render();
}
function kindName(k){ var x = CLEAN_KINDS.filter(function(z){ return z[0] === k; })[0]; return x ? x[2] : k; }
function kindIc(k){ var x = CLEAN_KINDS.filter(function(z){ return z[0] === k; })[0]; return x ? x[1] : '🧹'; }

/* ---------------- icons ---------------- */
var IC = {
  tables:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  bills:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  clean:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 9 13"/><path d="M5 13h10l-1 8H6z"/><path d="M8 17v4M11 17v4"/></svg>',
  admin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function shapeSvg(t, sz){
  sz = sz || 16; var w = sz, h = sz, sh = t.shape || 'square';
  if(sh === 'rect'){ if(t.rot) { w = sz * .6; } else { h = sz * .6; } }
  return '<svg class="shape" width="' + sz + '" height="' + sz + '" viewBox="0 0 ' + sz + ' ' + sz + '"><' + (sh === 'round' ? 'ellipse cx="' + sz / 2 + '" cy="' + sz / 2 + '" rx="' + w / 2.2 + '" ry="' + h / 2.2 + '"' : 'rect x="' + (sz - w) / 2 + '" y="' + (sz - h) / 2 + '" width="' + w + '" height="' + h + '" rx="3"') + ' fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
}

/* ============================================================
   RENDER
   ============================================================ */
function navItems(){
  var r = S.me ? S.me.role : '';
  if(r === 'cleaner') return [['clean','Clean',IC.clean], ['floor','Tables',IC.tables]];
  var n = [['floor','Tables',IC.tables], ['bills','Bills',IC.bills], ['clean','Clean',IC.clean]];
  return n;
}
function topBar(){
  var openC = Object.values(S.clean).filter(function(c){ return c.status === 'open' || c.status === 'taken'; }).length;
  return '<header class="top"><div class="brand">Hayat<small>' + (SETUP ? 'Setup' : esc(ROLES[S.me.role] || 'Captain')) + '</small></div>' +
    (isTrial() ? '<span class="pill trial" title="Bills here are a trial: the owner app still counts VMENU">TRIAL</span>' : '') +
    '<span class="sp"></span><span class="pill"><i class="dot' + (S.online ? '' : ' off') + '"></i>' + (S.online ? 'live' : 'offline') + '</span>' +
    '<button class="me" data-a="me">' + '<span>' + esc(S.me.name) + '</span>' + avatar(S.me.name) + '</button></header>' +
    (openC && S.view !== 'clean' && S.me.role === 'cleaner' ? '' : '');
}
function nav(){
  if(SETUP) return '';
  var openC = Object.values(S.clean).filter(function(c){ return c.status === 'open'; }).length;
  var due = Object.values(S.orders).filter(function(o){ return !closed(o) && o.dueAt && !o.paid; }).length;
  return '<nav class="nav">' + navItems().map(function(n){
    var b = n[0] === 'clean' && openC ? openC : n[0] === 'bills' && due ? due : 0;
    return '<button data-a="nav" data-v="' + n[0] + '" class="' + (S.view === n[0] || (S.view === 'order' && n[0] === 'floor') ? 'on' : '') + '">' + n[2] + n[1] + (b ? '<span class="badge">' + b + '</span>' : '') + '</button>';
  }).join('') + '</nav>';
}
function softRender(){
  var ae = document.activeElement;
  if(S.view === 'admin' && (S.adminDirty || (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)))) return;
  if(S.view === 'order' && ae && ae.id === 'q'){ orderRefresh(); return; }   /* the captain is typing: keep the field (and the keyboard) */
  render(); }
var LASTV = '';
function render(){
  var app = $('app'); if(!app) return;
  if(S.me && S.view + '|' + (S.table || '') !== LASTV){ LASTV = S.view + '|' + (S.table || ''); ux('view'); }
  if(SETUP && S.me){ S.view = 'admin'; }
  var a = document.activeElement, keep = a && a.id && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') ? { id:a.id, s:a.selectionStart, e:a.selectionEnd } : null;
  if(!S.me){ app.innerHTML = loginView(); }
  else {
    if(S.view === 'spaces'){ app.innerHTML = spacesView(); return; }
    var body = S.view === 'order' ? orderView() : S.view === 'bills' ? billsView() : S.view === 'clean' ? cleanView() : S.view === 'admin' ? adminView() : floorView();
    app.innerHTML = (S.online ? '' : '<div class="offline">No internet · KOTs and payments wait until it is back</div>') + topBar() + '<main id="main">' + body + '</main>' + (S.view === 'order' ? orderDock() : nav());
  }
  document.body.classList.toggle('inorder', !!(S.me && S.view === 'order'));
  dockSize(); if(S.me) saveUI();
  if(keep){ var el = $(keep.id); if(el){ el.focus(); try{ el.setSelectionRange(keep.s, keep.e); }catch(e){} } }
  if(S.refresh) try{ S.refresh(); }catch(e){}
}

/* ---------------- login ---------------- */
function loginView(){
  var P = S.people.filter(function(p){ return !p.off && (SETUP ? (p.role || 'office') === 'office' : APP_ROLES.indexOf(p.role || 'office') >= 0); });
  if(S.pinFor){
    var p = S.pinFor;
    return '<div class="login"><div class="hero">' + avatar(p.name, 'big') + '<h2 style="margin:10px 0 2px">' + esc(p.name) + '</h2><div class="muted">' + esc(ROLES[p.role || 'office'] || '') + ' · enter your code</div></div>' +
      '<div class="pin" id="pin">' + [0,1,2,3,4,5].map(function(i){ return '<i class="' + (i < S.pin.length ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="pad">' + [1,2,3,4,5,6,7,8,9].map(function(n){ return '<button data-a="pin" data-k="' + n + '">' + n + '</button>'; }).join('') +
      '<button data-a="pin" data-k="back">⌫</button><button data-a="pin" data-k="0">0</button><button class="go" data-a="pin" data-k="go">Sign in</button></div>' +
      '<p class="muted" style="text-align:center;margin-top:18px"><a href="#" data-a="pinx" style="color:inherit">‹ Not ' + esc(p.name.split(' ')[0]) + '? pick another name</a></p></div>';
  }
  var roles = APP_ROLES.filter(function(r){ return P.some(function(p){ return (p.role || 'office') === r; }); });
  var shown = S.roleF ? P.filter(function(p){ return (p.role || 'office') === S.roleF; }) : P;
  return '<div class="login"><div class="hero"><div class="brand">Hayat<small>Captain</small></div><p class="muted" style="margin:10px 0 0">Who is using this phone?</p></div>' +
    (roles.length > 1 ? '<div class="chips" style="justify-content:center"><button class="chip' + (S.roleF ? '' : ' on') + '" data-a="rolef" data-r="">Everyone</button>' + roles.map(function(r){ return '<button class="chip' + (S.roleF === r ? ' on' : '') + '" data-a="rolef" data-r="' + r + '">' + ROLES[r] + 's</button>'; }).join('') + '</div>' : '') +
    (P.length ? '<div class="people">' + shown.map(function(p){ return '<button class="person" data-a="pick" data-id="' + esc(p.id) + '">' + avatar(p.name, 'big') + '<span>' + esc(p.name) + '<br><small>' + esc(ROLES[p.role || 'office'] || p.role) + '</small></span></button>'; }).join('') + '</div>'
      : '<div class="card"><h2>No staff yet</h2><p class="sub">Owner app → More → 👥 Staff → add people with a code.</p></div>') +
    '</div>';
}
async function verify(p, code){
  var known = null;
  try{ var d = await S.F.getDoc(ref('crew', p.id)); if(d.exists() && d.data().code != null) known = String(d.data().code); }catch(e){}
  if(known != null && known !== code) return false;
  try{ await S.F.setDoc(ref('staff', S.ctx.user.uid), { crew:p.id, code:code, role:p.role || 'office', name:p.name, at:Date.now() }); }catch(e){ return false; }
  return true;
}
async function pinKey(k){
  if(k === 'back'){ S.pin = S.pin.slice(0, -1); render(); return; }
  if(k !== 'go'){ if(S.pin.length < 6) S.pin += k; render(); vib(6); if(S.pin.length < 6) return; }
  if(S.pin.length < 4){ var pe = $('pin'); if(pe){ pe.classList.remove('err'); void pe.offsetWidth; pe.classList.add('err'); } return; }
  var p = S.pinFor, ok = await verify(p, S.pin);
  if(!ok){ S.pin = ''; render(); var e2 = $('pin'); if(e2) e2.classList.add('err'); vib([40, 40, 40]); toast('That code did not work', 'bad'); return; }
  S.me = { id:p.id, name:p.name, role:p.role || 'office' }; lsSet('hayat-cap-me', S.me);
  S.pin = ''; S.pinFor = null; if(SETUP){ S.view = 'admin'; toast('Hello ' + esc(p.name.split(' ')[0]) + ' 👋', 'good'); render(); return; } S.view = S.me.role === 'cleaner' ? 'clean' : (mySpaces() || S.me.role === 'office' ? 'floor' : 'spaces'); S.space = mySpaces() ? 'mine' : 'all';
  toast('Hello ' + esc(p.name.split(' ')[0]) + ' 👋', 'good'); render();
}

/* ---------------- floor ---------------- */
function floorView(){
  var T = allTables(), st = T.map(function(t){ return [t, tstate(t)]; });
  var busy = st.filter(function(x){ return x[1].o; }), run = busy.reduce(function(n, x){ return n + x[1].m.total; }, 0);
  var billed = st.filter(function(x){ return x[1].st === 'bill'; }).length, cl = st.filter(function(x){ return x[1].st === 'clean'; }).length;
  var seats = T.reduce(function(n, t){ return n + (t.seats || 0); }, 0), used = busy.reduce(function(n, x){ return n + (x[1].o.pax || x[0].seats || 0); }, 0);
  var sp = floor().spaces;
  var mineOk = function(x){ return !S.mine || (x[1].o && x[1].o.crew === S.me.id) || draftCount(x[0].id); };
  var MS = mySpaces() || [];
  var head = '<div class="sum"><div><small>Tables</small><b>' + busy.length + '<span class="muted" style="font-size:13px">/' + T.length + '</span></b></div><div><small>Running</small><b>' + (run >= 100000 ? (run / 100000).toFixed(2) + 'L' : rs(run)) + '</b></div><div><small>Bill due</small><b>' + billed + '</b></div><div><small>Cleaning</small><b>' + cl + '</b></div></div>' +
    '<div class="chips spchips">' + (MS.length ? '<button class="chip' + (S.space === 'mine' ? ' on' : '') + '" data-a="space" data-s="mine">My halls<small>' + MS.map(function(id){ var z = sp.filter(function(q){ return q.id === id; })[0]; return z ? z.name : ''; }).join(' + ') + '</small></button>' : '') + '<button class="chip' + (S.space === 'all' ? ' on' : '') + '" data-a="space" data-s="all">All<small>' + busy.length + '/' + T.length + '</small></button>' +
    sp.map(function(s){ var n = (s.tables || []).length, b = st.filter(function(x){ return x[0].space === s.id && x[1].o; }).length; return '<button class="chip' + (S.space === s.id ? ' on' : '') + '" data-a="space" data-s="' + esc(s.id) + '">' + esc(s.name) + '<small>' + b + '/' + n + '</small></button>'; }).join('') +
    '<button class="chip' + (S.mine ? ' on' : '') + '" data-a="mine">★ My bills</button><button class="chip" data-a="sppick">✎ Halls</button></div>' +
    attnHtml() + '<div class="legend"><span><i style="background:var(--free)"></i>Free</span><span><i style="background:var(--eat)"></i>Eating</span><span><i style="background:var(--bill)"></i>Bill given</span><span><i style="background:var(--clean)"></i>Cleaning</span><span class="muted">' + used + '/' + seats + ' seats</span></div>';
  var body = sp.filter(function(s){ return S.space === 'all' || S.space === s.id || (S.space === 'mine' && (MS.indexOf(s.id) >= 0 || !MS.length)); }).map(function(s){
    var rows = st.filter(function(x){ return x[0].space === s.id && mineOk(x); });
    if(!rows.length) return '';
    var b = rows.filter(function(x){ return x[1].o; });
    return '<section class="space"><h3>' + esc(s.name) + '<span>' + b.length + ' of ' + rows.length + ' busy' + (b.length ? ' · ' + rs(b.reduce(function(n, x){ return n + x[1].m.total; }, 0)) : '') + '</span></h3><div class="tgrid">' + rows.map(function(x){ return tableCard(x[0], x[1]); }).join('') + '</div></section>';
  }).join('');
  return head + (body || '<div class="empty"><b>🪑</b>No tables here' + (S.mine ? ' that are yours. Tap ★ Mine to see all.' : '.') + '</div>');
}
function shortName(n){ var w = String(n || '').replace(/^SIM · /, '').trim().split(/\s+/)[0] || ''; w = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); return w.length > 7 ? w.slice(0, 7) : w; }
/* the table drawn small: its chairs as dots, one filled per guest seated */
function seatSvg(t, pax){
  var n = Math.max(1, Math.min(12, t.seats || 4)), round = t.shape === 'round', W = 46, H = 34, cx = W / 2, cy = H / 2, dots = [];
  if(round || n <= 2){ for(var i = 0; i < n; i++){ var a = -Math.PI / 2 + 2 * Math.PI * i / n; dots.push([cx + Math.cos(a) * 18, cy + Math.sin(a) * 13]); } }
  else { var top = Math.ceil(n / 2), bot = n - top; for(var k = 0; k < top; k++) dots.push([8 + (W - 16) * (top === 1 ? .5 : k / (top - 1)), 4]); for(var m = 0; m < bot; m++) dots.push([8 + (W - 16) * (bot === 1 ? .5 : m / (bot - 1)), H - 4]); }
  var body = round || n <= 2 ? '<ellipse cx="' + cx + '" cy="' + cy + '" rx="11" ry="7" class="tbl"/>' : '<rect x="6" y="10" width="' + (W - 12) + '" height="' + (H - 20) + '" rx="3" class="tbl"/>';
  return '<svg class="seats2" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + body + dots.map(function(d, i){ return '<circle cx="' + d[0].toFixed(1) + '" cy="' + d[1].toFixed(1) + '" r="3.1" class="' + (i < (pax || 0) ? 'on' : '') + '"/>'; }).join('') + '</svg>';
}
function tableCard(t, s){
  var dc = draftCount(t.id), tag = '', tm = '', tv = '', pax = (s.o && s.o.pax) || (S.draft[t.id] && S.draft[t.id].pax) || 0;
  if(s.st === 'free'){ tag = 'Free'; }
  if(s.st === 'eat'){ var lk = (s.o.kots || []).filter(function(k){ return k.kind === 'kot'; }).slice(-1)[0], kst = lk ? kotState(s.o, lk) : null, held = (s.o.kots || []).some(function(k){ return k.hold && !k.fireAt; });
    tag = kst && kst.s === 'ready' ? '✅ Ready' : kst && kst.s === 'cooking' ? '🍳 Cooking' : held ? '⏸ Hold' : 'Eating'; tm = ago(s.o.at) + ' · KOT ' + (s.o.kotN || 1); tv = rs(s.m.total); }
  if(s.st === 'bill'){ tag = 'Bill'; tm = 'billed ' + ago(s.o.dueAt); tv = rs(s.m.total); }
  if(s.st === 'clean'){ tag = kindIc(s.c.kind) + ' ' + (s.c.status === 'taken' ? 'on it' : 'clean'); tm = kindName(s.c.kind) + ' · ' + ago(s.c.at); }
  /* who is at it: guests (of seats) + the waiter, short name */
  var who = s.o ? '<span class="ts"><b class="px">👥 ' + (pax || '?') + '<i>/' + t.seats + '</i></b>' + (s.o.by ? ' · <b>' + esc(shortName(s.o.by)) + '</b>' : '') + '</span>' : '<span class="ts">' + t.seats + ' seats' + (pax ? ' · 👥' + pax + ' waiting' : '') + '</span>';
  return '<button class="tb ' + s.st + (s.c && s.c.urgency === 'urgent' ? ' urgent' : '') + '" data-a="table" data-lp="table" data-t="' + esc(t.id) + '"><span class="tag">' + tag + '</span><span class="tn">' + esc(t.name) + '</span>' + who +
    (tv ? '<span class="tv">' + tv + '</span>' : '') + (tm ? '<span class="tm">' + esc(tm) + '</span>' : '') + (dc ? '<span class="dr">' + dc + ' not sent</span>' : seatSvg(t, s.o ? pax : 0)) + '</button>';
}

/* ---------------- order (one-handed) ----------------
   Everything the thumb needs sits in the bottom dock: suggestions, categories, the search
   field with ‹ back, and the bill tray + the one action that matters now. The list scrolls above. */
function curTable(){ return tableById(S.table); }
function inBill(t){ var o = openOrder(t), ids = {}; (o ? live(o) : []).concat(draftOf(t.id)).forEach(function(l){ ids[l.id] = (ids[l.id] || 0) + l.q; }); return ids; }
function isDrink(x){ return x && /juice|bottled/i.test(x.cat || ''); }
function isDessert(x){ return x && /dessert/i.test(x.cat || ''); }
function topChoice(x){ var best = 0; x.ch.forEach(function(c, i){ if((c.q || 0) > (x.ch[best].q || 0)) best = i; }); return best; }
function nowHour(){ return new Date().getHours(); }
function hotNow(n){ var h = nowHour(), h2 = (h + 1) % 24;
  return IDX.slice().sort(function(a, b){ var sa = a.h ? a.h[h] * 2 + a.h[h2] : 0, sb = b.h ? b.h[h] * 2 + b.h[h2] : 0; return (sb - sa) || ((b.q || 0) - (a.q || 0)); }).slice(0, n); }
function suggestions(t){
  var o = openOrder(t), have = inBill(t), ids = Object.keys(have), pax = (o && o.pax) || (S.draft[t.id] && S.draft[t.id].pax) || 0, out = [], seen = {};
  var push = function(x, i, q, why, cls){ if(!x || seen[x.id + '|' + i + '|' + q]) return; seen[x.id + '|' + i + '|' + q] = 1; out.push({ x:x, i:i, q:q || 1, why:why, cls:cls || '' }); };
  if(!ids.length){
    if(pax >= 3){ var mandi = IDX.filter(function(x){ return /mandi/i.test(x.cat) && x.ch.some(function(c){ return /full/i.test(c.label); }); }).sort(function(a, b){ return (b.q || 0) - (a.q || 0); })[0];
      if(mandi){ var fi = mandi.ch.findIndex(function(c){ return /full/i.test(c.label); }); push(mandi, fi, Math.max(1, Math.round(pax / 4)), 'for 👥' + pax, 'pax'); } }
    hotNow(6).forEach(function(x){ push(x, topChoice(x), 1, 'popular at ' + hlab(nowHour())); });
    return out.slice(0, 7);
  }
  var drinks = ids.some(function(id){ return isDrink(BYID[id]); });
  if(!drinks){ var made = IDX.filter(function(x){ return /juice/i.test(x.cat) && !/water|soda water/i.test(x.name); }).sort(function(a, b){ return (b.q || 0) - (a.q || 0); });   /* a made drink first: more value than a bottle */
    var d = made[0] || IDX.filter(isDrink).sort(function(a, b){ return (b.q || 0) - (a.q || 0); })[0];
    if(d){ push(d, topChoice(d), Math.max(1, pax || 1), pax > 1 ? 'one each' : 'no drinks yet', 'drink'); if(made[1] && pax > 1) push(made[1], topChoice(made[1]), 1, 'or this', 'drink'); } }
  if(POSM && POSM.pairs){ var sc = {};
    ids.forEach(function(a){ var base = Math.max(1, (POSM.famBills || {})[a] || 1); var pr = POSM.pairs[a] || {}; if(Array.isArray(pr)){ var o3 = {}; pr.forEach(function(z){ o3[z[0]] = z[1]; }); pr = o3; }
      Object.keys(pr).forEach(function(b){ if(have[b] || !BYID[b]) return; sc[b] = (sc[b] || 0) + pr[b] / base; }); });
    var usedIds = {}; out.forEach(function(o2){ if(o2.x) usedIds[o2.x.id] = 1; });
    Object.keys(sc).filter(function(id){ return !usedIds[id]; }).sort(function(a, b){ return sc[b] - sc[a]; }).slice(0, 5).forEach(function(id){ var x = BYID[id]; push(x, topChoice(x), 1, 'goes with · ' + Math.round(100 * Math.min(1, sc[id])) + '%'); }); }
  if(o && (o.kots || []).length){ var k = (o.kots || []).filter(function(z){ return z.kind === 'kot'; }).slice(-1)[0]; if(k && k.lines && k.lines.length) out.push({ repeat:k, why:'KOT ' + k.n }); }
  return out.slice(0, 8);
}
function hlab(h){ return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); }
function sugHtml(t){
  var L = suggestions(t); if(!L.length) return '<div class="sugs" id="sugs"><span class="sugph">Smart picks show here as the order grows</span></div>';   /* the row is always there: no jump when the first suggestion arrives */
  return '<div class="sugs" id="sugs">' + L.map(function(s, n){
    if(s.repeat) return '<button class="sug rep" data-a="rep" data-n="' + s.repeat.n + '">↻ <b>Repeat ' + esc(s.why) + '</b><small>' + s.repeat.lines.reduce(function(a, l){ return a + l.q; }, 0) + ' items</small></button>';
    var c = s.x.ch[s.i] || s.x.ch[0];
    return '<button class="sug ' + s.cls + '" data-a="sug" data-id="' + esc(s.x.id) + '" data-i="' + s.i + '" data-q="' + s.q + '">' + (s.q > 1 ? '<i>' + s.q + '×</i> ' : '+ ') + '<b>' + esc(s.x.name) + (c.label ? ' ' + esc(short(c.label)) : '') + '</b><small>' + rs(c.price * s.q) + ' · ' + esc(s.why) + '</small></button>';
  }).join('') + '</div>';
}
function itemHtml(x, chs, D, best){
  if(oos(x.id)) return '<div class="it one oosx" data-a="oos" data-lp="qty" data-id="' + esc(x.id) + '" data-i="0" role="button"><div class="nm">' + esc(x.name) + '<small>🚫 out of stock today · hold to undo</small></div></div>';
  var qOf = function(label){ return D.filter(function(l){ return l.id === x.id && l.label === label; }).reduce(function(n, l){ return n + l.q; }, 0); };
  chs = chs || x.ch.map(function(c, i){ return i; });
  if(x.ch.length === 1){ var n1 = qOf(x.ch[0].label); return '<div class="it one' + (best ? ' best' : '') + '" data-a="add" data-lp="qty" data-id="' + esc(x.id) + '" data-i="0" role="button"><div class="nm">' + esc(x.name) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + (x.ch[0].label ? '<small>' + esc(x.ch[0].label) + '</small>' : '') + '</div><span class="pr">' + rs(x.ch[0].price) + '</span>' + (n1 ? '<span class="q1">' + n1 + '</span>' : '') + '</div>'; }
  var groups = []; chs.forEach(function(i){ var c = x.ch[i], p = String(c.label).split(' · '), g = p.length > 1 ? p[0] : ''; var G = groups.filter(function(z){ return z.g === g; })[0]; if(!G) groups.push(G = { g:g, b:[] });
    var n = qOf(c.label); G.b.push('<button class="sz' + (n ? ' has' : '') + (best && chs.length === 1 ? ' hit' : '') + '" data-a="add" data-lp="qty" data-id="' + esc(x.id) + '" data-i="' + i + '" title="' + esc(c.label) + '"><b>' + esc(p.length > 1 ? short(p[1]) : short(c.label)) + '</b><span>' + rs(c.price) + '</span>' + (n ? '<span class="q">' + n + '</span>' : '') + '</button>'); });
  return '<div class="it' + (best ? ' best' : '') + '"><div class="nm">' + esc(x.name) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</div>' + groups.map(function(G){ return '<div class="szr">' + (G.g ? '<small>' + esc(G.g) + '</small>' : '') + '<div class="szs">' + G.b.join('') + '</div></div>'; }).join('') + '</div>';
}
function billHtml(t){
  var s = tstate(t), o = s.o, D = draftOf(t.id), L = o ? live(o) : [];
  var dsum = linesTotal(D), m = o ? money(o) : { sub:0, off:0, total:0 };
  var rows = '';
  if(L.length){ rows += '<div class="bgrp">Sent to kitchen</div>' + L.map(function(l){ var r = (l.rounds || []).filter(function(z){ return z.n !== 'void'; }).map(function(z){ return z.n; }).filter(function(v, i, a){ return a.indexOf(v) === i; }); return '<div class="bl" data-a="void" data-k="' + esc(l.k) + '" role="button"><span class="qx">' + l.q + '×</span><span class="n">' + esc(l.name) + (r.length > 1 || (r[0] && r[0] > 1) ? r.map(function(v){ return '<span class="rnd">K' + v + '</span>'; }).join('') : '') + (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</span><span class="a">' + rs(l.q * l.price) + '</span></div>'; }).join(''); }
  if(D.length){ rows += '<div class="bgrp new">New · not sent yet</div>' + D.map(function(l){ return '<div class="bl new"><div class="step"><button data-a="dq" data-k="' + esc(l.k) + '" data-d="-1" aria-label="one less">−</button><span>' + l.q + '</span><button data-a="dq" data-k="' + esc(l.k) + '" data-d="1" aria-label="one more">+</button></div><span class="n" data-a="note" data-k="' + esc(l.k) + '" role="button">' + esc(l.name) + '<small>' + esc([l.label, l.note ? '“' + l.note + '”' : ''].filter(Boolean).join(' · ') || 'tap to add a note') + '</small></span><span class="a">' + rs(l.q * l.price) + '</span></div>'; }).join(''); }
  if(!rows) rows = '<div class="empty" style="padding:26px 10px"><b>🍽️</b>Tap dishes to start the order.</div>';
  var tot = '<div class="btot">' + (o && m.off ? '<div><span>Subtotal</span><span>' + rs(m.sub) + '</span></div><div><span>' + esc(offLabel(o)) + '</span><span>−' + rs(m.off) + '</span></div>' : '') +
    (D.length && o ? '<div class="muted"><span>On the bill</span><span>' + rs(m.total) + '</span></div><div class="muted"><span>New</span><span>+' + rs(dsum) + '</span></div>' : '') +
    '<div class="g"><span>Total</span><span>' + rs(m.total + dsum) + '</span></div></div>';
  /* gentle nudge before the bill: nothing sweet on it yet */
  var nudge = '';
  if(o && !D.length && !o.dueAt){ var have = inBill(t); if(!Object.keys(have).some(function(id){ return isDessert(BYID[id]); })){ var ds = IDX.filter(isDessert).sort(function(a, b){ return (b.q || 0) - (a.q || 0); }).slice(0, 2);
    if(ds.length) nudge = '<div class="nudge"><small>Before the bill · something sweet?</small>' + ds.map(function(x){ var i = topChoice(x); return '<button class="sug" data-a="sug" data-id="' + esc(x.id) + '" data-i="' + i + '" data-q="1">+ <b>' + esc(x.name) + '</b><small>' + rs(x.ch[i].price) + '</small></button>'; }).join('') + '</div>'; } }
  var acts = '<div class="bact">';
  if(D.length) acts += '<button class="btn wide" data-a="kopt" style="min-height:42px;font-size:14px">✎ Note · kitchens · hold' + (S.draft[t.id] && S.draft[t.id].kopt && (S.draft[t.id].kopt.flags.length || S.draft[t.id].kopt.note) ? ' <b>(' + esc(kotNoteText(S.draft[t.id].kopt) || 'hold') + ')</b>' : '') + '</button><button class="btn pri wide" data-a="kot"' + (SENDING[t.id] ? ' disabled' : '') + '>' + (SENDING[t.id] ? 'Sending…' : 'Send KOT') + ' · ' + draftCount(t.id) + ' item' + (draftCount(t.id) > 1 ? 's' : '') + '</button><button class="btn wide" data-a="dclear" style="min-height:40px;font-size:13px">Clear new items</button>';
  else if(o){ acts += '<button class="btn acc" data-a="due">' + (o.dueAt ? '🖨 Bill again' : '🧾 Due bill') + '</button><button class="btn pri" data-a="pay">Pay ' + rs(m.total) + '</button>'; }
  else acts += '<div class="why">Add dishes, then Send KOT. Nothing reaches the kitchen until you send.</div>';
  acts += '</div>';
  return '<div class="bhd"><b>Bill · ' + esc(t.name) + '</b>' + (o ? '<span class="badge2 ' + (o.dueAt ? 'b-bill' : 'b-eat') + '">' + (o.dueAt ? 'bill given' : 'KOT ' + (o.kotN || 1)) + '</span>' : '') + '</div><div class="blines">' + rows + '</div>' + tot + nudge + acts;
}
/* ---------------- two modes on a phone ----------------
   A NEW table opens on quick-pick dishes. A table that already has a bill opens on the BILL
   (what was ordered, when, the total) - the waiter usually comes back to check, bill or pay.
   "＋ Add items" or 🔍 switches to dishes; sending a KOT goes back to the bill. */
function wide(){ return innerWidth >= 900; }
function omode(t){ if(wide()) return 'menu'; if(draftCount(t.id)) return 'menu'; var m = (S.omodes || {})[t.id]; if(m) return m; return openOrder(t) ? 'bill' : 'menu'; }
function setMode(t, m){ S.omodes = S.omodes || {}; S.omodes[t.id] = m; }
function orderView(){
  var t = curTable(); if(!t){ S.view = 'floor'; return floorView(); }
  var s = tstate(t), o = s.o, pax = (o && o.pax) || (S.draft[t.id] && S.draft[t.id].pax) || 0, md = omode(t);
  var lastK = o ? Math.max.apply(null, (o.kots || []).map(function(k){ return k.at || 0; }).concat([o.at || 0])) : 0;
  var sub = esc(t.spaceName) + ' · ' + t.seats + ' seats' + (o ? ' · seated ' + ago(o.at) + (o.by ? ' · ' + esc(o.by) : '') : '');
  var head = '<div class="ohead"><div class="tt"><b>Table ' + esc(t.name) + '</b><small>' + sub + '</small></div>' +
    '<div class="pax"><button data-a="pax" data-d="-1" aria-label="fewer guests">−</button><span>👥 ' + (pax || '–') + '</span><button data-a="pax" data-d="1" aria-label="more guests">+</button></div><button class="more" data-a="tmenu" aria-label="table options">⋯</button></div>';
  var banner = s.st === 'clean' ? '<div class="card" style="border-color:var(--clean);background:var(--cleanwash)"><b>' + kindIc(s.c.kind) + ' ' + esc(kindName(s.c.kind)) + '</b> asked ' + agoT(s.c.at) + ' by ' + esc(s.c.by) + (s.c.status === 'taken' ? ' · <b>' + esc(s.c.takenBy) + '</b> is on it' : '') + '<div class="row" style="margin-top:8px;display:flex;gap:8px"><button class="btn" data-a="cdone" data-id="' + esc(s.c.id) + '">✓ Table is clean</button></div></div>' : '';
  if(md === 'bill' && o){
    var m = money(o), L = live(o), byK = {};
    (o.kots || []).filter(function(k){ return k.kind === 'kot'; }).forEach(function(k){ byK[k.n] = k; });
    var status = o.dueAt ? '<span class="badge2 b-bill">bill given ' + ago(o.dueAt) + ' ago</span>' : '<span class="badge2 b-eat">eating · KOT ' + (o.kotN || 1) + '</span>';
    return '<div class="bview">' + head + banner +
      '<div class="bsum"><div><small>Bill</small><b>' + rs(m.total) + '</b></div><div><small>Items</small><b>' + L.reduce(function(n, l){ return n + l.q; }, 0) + '</b></div><div><small>Last KOT</small><b>' + ago(lastK) + '</b></div></div>' +
      '<div class="card bcard"><div class="bhd2">' + status + '<span class="muted" style="font-size:12.5px">tap a dish to remove it</span></div>' +
      L.map(function(l){ var r = (l.rounds || []).filter(function(z){ return z.n !== 'void'; }).map(function(z){ return z.n; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
        return '<div class="bl" data-a="void" data-k="' + esc(l.k) + '" role="button"><span class="qx">' + l.q + '×</span><span class="n">' + esc(l.name) + r.map(function(v){ return '<span class="rnd">K' + v + (byK[v] ? ' ' + hm(byK[v].at) : '') + '</span>'; }).join('') + (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</span><span class="a">' + rs(l.q * l.price) + '</span></div>'; }).join('') +
      (m.off ? '<div class="bl"><span></span><span class="n">' + esc(offLabel(o)) + '</span><span class="a">−' + rs(m.off) + '</span></div>' : '') +
      '<div class="btot"><div class="g"><span>Total</span><span>' + rs(m.total) + '</span></div></div></div>' +
      '<div class="card klist"><div class="sec-t" style="margin:0 0 6px">Kitchen</div>' + (o.kots || []).filter(function(k){ return k.kind === 'kot'; }).map(function(k){ var ks = kotState(o, k), self = (k.lines || []).every(function(l){ return l.station === 'none'; });
        return '<div class="krow"><b>KOT ' + k.n + '</b><span>' + hm(k.at) + ' · ' + (k.lines || []).reduce(function(n, l){ return n + l.q; }, 0) + ' items' + (k.note ? ' · “' + esc(k.note) + '”' : '') + '</span>' +
          (k.hold && !k.fireAt ? '<button class="btn acc" data-a="fire" data-n="' + k.n + '" style="min-height:38px">🔥 Fire</button>' : self ? '<span class="kst">🥤 you bring</span>' : '<span class="kst ' + (ks ? ks.s : '') + '">' + (ks && ks.txt ? ks.txt : k.fireAt ? '🔥 fired ' + ago(k.fireAt) : 'sent') + '</span>') + '</div>'; }).join('') + '</div>' +
      (function(){ var n = billNudge(t, o); return n ? '<div class="card">' + n + '</div>' : ''; })() + '</div>';
  }
  return '<div class="ord"><div>' + head + banner + (o && !wide() ? '<button class="backbill" data-a="omode" data-m="bill">🧾 Back to the bill · ' + rs(money(o).total) + '</button>' : '') + '<div id="items">' + itemsHtml(t) + '</div></div><aside class="billcol" id="billcol">' + billHtml(t) + '</aside></div>';
}
function billNudge(t, o){
  if(!o || o.dueAt) return ''; var have = inBill(t); if(Object.keys(have).some(function(id){ return isDessert(BYID[id]); })) return '';
  var ds = IDX.filter(isDessert).sort(function(a, b){ return (b.q || 0) - (a.q || 0); }).slice(0, 2); if(!ds.length) return '';
  return '<div class="nudge"><small>Before the bill · something sweet?</small>' + ds.map(function(x){ var i = topChoice(x); return '<button class="sug" data-a="sug" data-id="' + esc(x.id) + '" data-i="' + i + '" data-q="1">+ <b>' + esc(x.name) + '</b><small>' + rs(x.ch[i].price) + '</small></button>'; }).join('') + '</div>';
}
/* ---------------- where am I working today? ----------------
   After signing in, a waiter picks the hall(s) they cover; the floor then shows just those tables.
   Kept per person per business day; "All" or another hall is one tap away on the floor. */
function mySpaces(){ var v = lsGet('hayat-cap-space', null); return v && S.me && v.me === S.me.id && v.day === bizDay() ? v.sp : null; }
function setMySpaces(sp){ lsSet('hayat-cap-space', { me:S.me.id, day:bizDay(), sp:sp }); }
function spacesView(){
  var sp = floor().spaces, cur = S.pickSp || mySpaces() || [];
  return '<div class="login"><div class="hero"><div class="brand">Hayat<small>' + esc(ROLES[S.me.role] || '') + '</small></div><h2 style="margin:14px 0 2px">Where are you working, ' + esc(S.me.name.split(' ')[0]) + '?</h2><p class="muted" style="margin:0">Pick one or more · you can change it any time</p></div>' +
    '<div class="sppick">' + sp.map(function(s){ var on = cur.indexOf(s.id) >= 0, busy = (s.tables || []).filter(function(t){ return openOrder(Object.assign({ space:s.id, spaceName:s.name }, t)); }).length;
      return '<button class="spt' + (on ? ' on' : '') + '" data-a="sptog" data-s="' + esc(s.id) + '"><b>' + esc(s.name) + '</b><small>' + (s.tables || []).length + ' tables' + (busy ? ' · ' + busy + ' busy' : '') + '</small><i>' + (on ? '✓' : '') + '</i></button>'; }).join('') + '</div>' +
    '<div class="row" style="display:flex;gap:8px;margin-top:14px"><button class="btn" data-a="spall" style="flex:1">All halls</button><button class="btn pri" data-a="spgo" style="flex:2"' + (cur.length ? '' : ' disabled') + '>Start · ' + (cur.length ? cur.length + ' hall' + (cur.length > 1 ? 's' : '') : 'pick a hall') + '</button></div></div>';
}

/* ---------------- categories: no sliding strip ----------------
   ‹ 🍗 Mandi · 12 ›  - arrows or a swipe on the list step through categories in a fixed order;
   tapping the name opens every category as big tiles (all visible, one tap). */
var CAT_IC = [[/mandi/i,'🍗'],[/alfaham|grill/i,'🔥'],[/fish|sea/i,'🐟'],[/broast|fried/i,'🍟'],[/biri|rice/i,'🍚'],[/bread/i,'🫓'],[/curr|gravy/i,'🍛'],[/juice|shake/i,'🥤'],[/bottle/i,'🧃'],[/tea|coffee/i,'☕'],[/dessert|sweet/i,'🍰'],[/salad|side/i,'🥗'],[/shawarma/i,'🌯'],[/drink/i,'🥤']];
function catIc(n){ for(var i = 0; i < CAT_IC.length; i++) if(CAT_IC[i][0].test(n)) return CAT_IC[i][1]; return '🍽️'; }
function catList(){ return [{ id:'', name:'Now', ic:'★', n:Math.min(16, IDX.length) }].concat(MENU.map(function(c){ return { id:c.id, name:c.name, ic:catIc(c.name), n:c.items.length }; })); }
function catIdx(){ var L = catList(); for(var i = 0; i < L.length; i++) if(L[i].id === (S.cat || '')) return i; return 0; }
function catsHtml(){ var L = catList(), i = catIdx(), c = L[i];
  return '<div class="catnav" id="cats"><button class="cstep" data-a="cstep" data-d="-1" aria-label="previous category">‹</button><button class="ccur" data-a="cgrid"><span class="ci">' + c.ic + '</span><b>' + esc(c.name) + '</b><small>' + (i + 1) + '/' + L.length + ' · all ▾</small></button><button class="cstep" data-a="cstep" data-d="1" aria-label="next category">›</button></div>'; }
function stepCat(d){ var L = catList(), i = (catIdx() + d + L.length) % L.length; S.cat = L[i].id; orderRefresh(); window.scrollTo(0, 0); vib(6); }
function catGrid(){
  var L = catList(), cur = S.cat || '';
  sheet('<h2>Categories</h2><p class="sub">Always in this order · swipe the dish list left/right to step through</p><div class="cgrid">' + L.map(function(c){ return '<button class="' + (c.id === cur ? 'on' : '') + '" data-cg="' + esc(c.id) + '"><span>' + c.ic + '</span><b>' + esc(c.name) + '</b><small>' + c.n + '</small></button>'; }).join('') + '</div>');
  document.querySelectorAll('[data-cg]').forEach(function(b){ b.onclick = function(){ S.cat = b.dataset.cg; closeSheet(); orderRefresh(); window.scrollTo(0, 0); }; });
}
/* search results sit right ABOVE the search box, best match nearest the thumb, the rest stacked upward */
function sresHtml(t){
  var q = S.q.trim(); if(!q){ S.best = null; return ''; }
  var R = searchMenu(q).slice(0, 8), D = draftOf(t.id); S.best = R[0] || null;
  if(!R.length) return '<div class="sres" id="sres"><div class="sr none">No dish matches “' + esc(q) + '” · try first letters: <b>cmf</b> = Chicken Mandi Full</div></div>';
  var qOf = function(x, label){ return D.filter(function(l){ return l.id === x.id && l.label === label; }).reduce(function(n, l){ return n + l.q; }, 0); };
  return '<div class="sres" id="sres">' + R.map(function(r, i){ var x = r.x, chs = r.sz ? r.chs : x.ch.map(function(c, j){ return j; });
    if(oos(x.id)) return '<div class="sr oosx" data-a="oos" data-lp="qty" data-id="' + esc(x.id) + '" data-i="0"><span class="nm">' + esc(x.name) + ' <small>🚫 out of stock today</small></span></div>';
    if(x.ch.length === 1){ var n1 = qOf(x, x.ch[0].label); return '<div class="sr' + (i === 0 ? ' best' : '') + '" data-a="add" data-lp="qty" data-id="' + esc(x.id) + '" data-i="0" role="button"><span class="nm">' + esc(x.name) + (x.ch[0].label ? ' <small>' + esc(x.ch[0].label) + '</small>' : '') + '</span><span class="sp">' + (n1 ? '<i>' + n1 + '</i>' : '') + rs(x.ch[0].price) + '</span></div>'; }
    return '<div class="sr' + (i === 0 ? ' best' : '') + '"><span class="nm">' + esc(x.name) + '</span><span class="szb">' + chs.map(function(j){ var c = x.ch[j], n = qOf(x, c.label); return '<button data-a="add" data-lp="qty" data-id="' + esc(x.id) + '" data-i="' + j + '" class="' + (n ? 'has' : '') + (i === 0 && chs.length === 1 ? ' hit' : '') + '"><b>' + esc(short(c.label)) + '</b><span>' + rs(c.price) + '</span>' + (n ? '<i>' + n + '</i>' : '') + '</button>'; }).join('') + '</span></div>';
  }).join('') + '</div>';
}
function itemsHtml(t){
  var D = draftOf(t.id), list, title = '';
  if(S.cat){ var c = MENU.filter(function(z){ return z.id === S.cat; })[0]; list = c ? c.items.map(function(it){ return BYID[it.id]; }).filter(Boolean) : []; title = c ? c.name : ''; }
  else { list = hotNow(16); title = 'Quick pick · selling now ' + hlab(nowHour()); }
  return (title ? '<div class="sec-t">' + esc(title) + '</div>' : '') + '<div class="items">' + list.map(function(x){ return itemHtml(x, null, D); }).join('') + '</div>';
}
function orderDock(){
  var t = curTable(); if(!t) return '';
  var s = tstate(t), o = s.o, D = draftOf(t.id), md = omode(t), n = (o ? live(o).reduce(function(a, l){ return a + l.q; }, 0) : 0) + draftCount(t.id), tot = (o ? money(o).total : 0) + linesTotal(D);
  var kon = D.length && S.draft[t.id] && S.draft[t.id].kopt && (S.draft[t.id].kopt.flags.length || S.draft[t.id].kopt.note || S.draft[t.id].kopt.off.length);
  var btn = D.length ? '<button class="kob' + (kon ? ' on' : '') + '" data-a="kopt" aria-label="KOT note and kitchens">✎<small>note</small></button><button class="btn pri" data-a="kot"' + (SENDING[t.id] ? ' disabled' : '') + '>' + (SENDING[t.id] ? 'Sending…' : (S.draft[t.id] && S.draft[t.id].kopt && S.draft[t.id].kopt.flags.indexOf('hold') >= 0 ? '⏸ Hold' : 'Send KOT')) + ' · ' + draftCount(t.id) + '</button>' : o ? (o.dueAt ? '<button class="btn pri" data-a="pay">Pay ' + rs(money(o).total) + '</button>' : '<button class="btn acc" data-a="due">🧾 Due bill</button>') : '<button class="btn pri" disabled>Send KOT</button>';
  var bar = '<div class="ordbar"><button class="tray" data-a="billsheet"><span><b>' + rs(tot) + '</b><small>' + n + ' item' + (n === 1 ? '' : 's') + (D.length ? ' · ' + draftCount(t.id) + ' not sent' : '') + ' · bill ▴</small></span></button>' + btn + '</div>';
  if(md === 'bill' && o) return '<div class="dock" id="dock" data-mode="bill">' + sugHtml(t) +
    '<div class="srow"><button class="back" data-a="nav" data-v="floor" aria-label="back to tables">‹</button><button class="addbtn" data-a="omode" data-m="menu">＋ Add items</button><button class="srch" data-a="omode" data-m="search" aria-label="search dishes">🔍</button></div>' +
    '<div class="ordbar">' + (o.dueAt ? '<button class="btn acc" data-a="due" style="flex:none">🖨 Again</button><button class="btn pri" data-a="pay" style="flex:1">Pay ' + rs(money(o).total) + '</button>' : '<button class="btn acc" data-a="due" style="flex:1">🧾 Due bill · ' + rs(money(o).total) + '</button>') + '</div></div>';
  return '<div class="dock" id="dock" data-mode="menu">' + sresHtml(t) + sugHtml(t) + catsHtml() +
    '<div class="srow"><button class="back" data-a="nav" data-v="floor" aria-label="back to tables">‹</button><div class="sbox"><input id="q" type="search" placeholder="Search dishes · try cmf" value="' + esc(S.q) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">' + (S.q ? '<button class="qx2" data-a="qclr" aria-label="clear">✕</button>' : '') + '</div></div>' + bar + '</div>';
}
/* redraw everything EXCEPT the search box, so the keyboard stays up while dishes are added */
function orderRefresh(){
  var t = curTable(), d = $('dock'); if(S.view !== 'order' || !t || !d || d.dataset.mode !== (omode(t) === 'bill' && openOrder(t) ? 'bill' : 'menu')) return render();
  var main = $('main'); if(main){ var y = window.scrollY; main.innerHTML = orderView(); window.scrollTo(0, y); }
  var tmp = document.createElement('div'); tmp.innerHTML = orderDock(); var nd = tmp.firstChild;
  ['sres', 'sugs', 'cats'].forEach(function(id){ var old = $(id), nw = nd.querySelector('#' + id); if(old && nw) old.replaceWith(nw); else if(old && !nw) old.remove(); else if(!old && nw){ var anchor = id === 'sres' ? d.firstChild : (id === 'sugs' ? ($('cats') || d.querySelector('.srow')) : d.querySelector('.srow')); d.insertBefore(nw, anchor); } });
  var ob = d.querySelector('.ordbar'), nb = nd.querySelector('.ordbar'); if(ob && nb) ob.replaceWith(nb);
  var sb = d.querySelector('.sbox'), cx = sb && sb.querySelector('.qx2'); if(sb){ if(S.q && !cx) sb.insertAdjacentHTML('beforeend', '<button class="qx2" data-a="qclr" aria-label="clear">✕</button>'); else if(!S.q && cx) cx.remove(); }
  if(S.refresh) try{ S.refresh(); }catch(e){}
  dockSize(); saveUI();
}
/* a refresh (or the app being killed) must lose nothing: the screen, the table, the search and the unsent items come back */
function saveUI(){ lsSet('hayat-cap-ui', { at:Date.now(), view:S.view, table:S.table, q:S.q, cat:S.cat, omodes:S.omodes || {}, me:S.me ? S.me.id : '' }); }
function restoreUI(){ var u = lsGet('hayat-cap-ui', null); if(!u || !S.me || u.me !== S.me.id || Date.now() - u.at > 45 * 60e3) return;
  S.omodes = u.omodes || {}; if(u.view === 'order' && u.table && tableById(u.table)){ S.view = 'order'; S.table = u.table; S.q = u.q || ''; S.cat = u.cat || ''; pushHist('order'); }
  else if(u.view && u.view !== 'login' && u.view !== 'order') S.view = u.view; }

/* ---------------- snackbar with Undo ---------------- */
var SNACK = null;
function snack(msg, undo){
  var el = $('snack'); if(!el){ el = document.createElement('div'); el.id = 'snack'; document.body.appendChild(el); }
  clearTimeout(SNACK); el.innerHTML = '<span>' + msg + '</span>' + (undo ? '<button id="snUndo">UNDO</button>' : '');
  el.className = 'show';
  if(undo) $('snUndo').onclick = function(){ el.className = ''; undo(); };
  SNACK = setTimeout(function(){ el.className = ''; }, 2600);
}
function addAndSnack(t, x, i, q, via){
  var c = x.ch[i] || x.ch[0]; q = q || 1;
  ux('add', { id:x.id, name:x.name, label:c.label || '', q:q, via:via || (S.q ? 'search' : 'quick:' + (S.cat || 'now')), qtext:S.q || undefined, inBill:draftCount(t.id) });
  for(var n = 0; n < q; n++) addDraft(t.id, x, c);
  var k = x.id + '|' + (c.label || '');
  snack('+' + (q > 1 ? q + '× ' : ' ') + esc(x.name) + (c.label ? ' ' + esc(short(c.label)) : '') + ' · ' + rs(c.price * q), function(){ ux('undo', { id:x.id, q:q }); stepDraft(t.id, k, -q); orderRefresh(); });
}
function guestSheet(t){
  var mx = Math.max(t.seats || 4, 4), L = []; for(var n = 1; n <= Math.min(12, mx + 2); n++) L.push(n);
  sheet('<h2>Table ' + esc(t.name) + ' · how many guests?</h2><p class="sub">' + t.seats + ' seats · tap a number</p><div class="qgrid">' + L.map(function(n){ return '<button data-gn="' + n + '"' + (n > t.seats ? ' style="opacity:.6"' : '') + '><b>' + n + '</b><small>' + (n > t.seats ? 'extra chair' : n === 1 ? 'guest' : 'guests') + '</small></button>'; }).join('') + '</div><button class="btn" id="gSkip" style="width:100%;min-height:44px">Skip</button>');
  document.querySelectorAll('[data-gn]').forEach(function(b){ b.onclick = function(){ closeSheet(); ux('pax', { n:+b.dataset.gn }); setPax(t.id, +b.dataset.gn); }; });
  $('gSkip').onclick = function(){ closeSheet(); ux('pax', { n:0 }); };
}
function qtySheet(t, x, i){
  var c = x.ch[i], canStock = S.me && ['captain', 'office', 'cashier'].indexOf(S.me.role) >= 0;
  if(oos(x.id)){ sheet('<h2>' + esc(x.name) + '</h2><p class="sub">🚫 Out of stock today</p>' + (canStock ? '<button class="btn pri" id="stk" style="width:100%">✓ It is back - put it on again</button>' : '<p>Ask a captain to put it back on.</p>')); var b0 = $('stk'); if(b0) b0.onclick = function(){ closeSheet(); toggleStock(x); }; return; }
  sheet('<h2>' + esc(x.name) + (c.label ? ' · ' + esc(c.label) : '') + '</h2><p class="sub">' + rs(c.price) + ' each · how many?</p><div class="qgrid">' + [1,2,3,4,5,6,8,10].map(function(n){ return '<button data-qn="' + n + '"><b>' + n + '</b><small>' + rs(c.price * n) + '</small></button>'; }).join('') + '</div>');
  if(canStock){ var box = document.querySelector('#scrim .sheet'); box.insertAdjacentHTML('beforeend', '<button class="btn bad" id="stk" style="width:100%;margin-top:8px;min-height:44px">🚫 Out of stock today (every phone)</button>'); $('stk').onclick = function(){ closeSheet(); toggleStock(x); }; }
  document.querySelectorAll('[data-qn]').forEach(function(b){ b.onclick = function(){ closeSheet(); addAndSnack(t, x, i, +b.dataset.qn, 'hold'); orderRefresh(); }; });
}

/* ---------------- bills ---------------- */
function billsView(){
  var all = Object.values(S.orders).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
  var open = all.filter(function(o){ return !closed(o); }), paid = all.filter(function(o){ return o.paid && bizDay(o.paidAt || o.at) === bizDay(); });
  var byMode = {}; paid.forEach(function(o){ (o.pays && o.pays.length ? o.pays : [{ mode:o.payMode, amt:o.paidAmt || o.total }]).forEach(function(p){ byMode[p.mode] = (byMode[p.mode] || 0) + (+p.amt || 0); }); });
  var tips = paid.reduce(function(n, o){ return n + (+o.tip || 0); }, 0);
  var row = function(o){ var m = money(o), where = o.mode === 'dinein' ? (o.table || 'Dine') : o.token ? 'T' + o.token : (o.mode || 'order');
    var st = o.paid ? '<span class="badge2 b-paid">paid · ' + esc(payWord(o.payMode)) + '</span>' : o.dueAt ? '<span class="badge2 b-bill">bill given</span>' : '<span class="badge2 b-eat">eating</span>';
    return '<button class="li" data-a="openo" data-id="' + esc(o.id) + '"><span class="tico">' + esc(String(where).slice(0, 4)) + '</span><span class="n">' + esc(o.mode === 'dinein' ? 'Table ' + where : where) + ' ' + st + '<small>' + hm(o.at) + ' · ' + ago(o.at) + ' · ' + live(o).reduce(function(n, l){ return n + l.q; }, 0) + ' items' + (o.by ? ' · ' + esc(o.by) : '') + (o.source && o.source !== 'captain' ? ' · ' + esc(o.source) : '') + '</small></span><span class="v">' + rs(o.paid ? (o.paidAmt || m.total) : m.total) + (o.tip ? '<small>+' + rs(o.tip) + ' tip</small>' : '') + '</span></button>'; };
  var tabs = '<div class="seg" style="margin-bottom:12px"><button class="' + (S.billsTab === 'open' ? 'on' : '') + '" data-a="btab" data-t="open">Open · ' + open.length + '</button><button class="' + (S.billsTab === 'paid' ? 'on' : '') + '" data-a="btab" data-t="paid">Paid today · ' + paid.length + '</button></div>';
  var body = S.billsTab === 'open'
    ? (open.length ? '<div class="sum" style="grid-template-columns:repeat(3,1fr)"><div><small>Open</small><b>' + open.length + '</b></div><div><small>Running</small><b>' + rs(open.reduce(function(n, o){ return n + money(o).total; }, 0)) + '</b></div><div><small>Bill given</small><b>' + open.filter(function(o){ return o.dueAt; }).length + '</b></div></div><div class="list">' + open.map(row).join('') + '</div>' : '<div class="empty"><b>✨</b>No open bills.</div>')
    : '<div class="sum" style="grid-template-columns:repeat(4,1fr)"><div><small>Cash</small><b>' + rs(byMode.cash || 0) + '</b></div><div><small>UPI</small><b>' + rs(byMode.upi || 0) + '</b></div><div><small>Card</small><b>' + rs(byMode.card || 0) + '</b></div><div><small>Tips</small><b>' + rs(tips) + '</b></div></div>' + (paid.length ? '<div class="list">' + paid.map(row).join('') + '</div>' : '<div class="empty"><b>🧾</b>Nothing paid yet today.</div>');
  return '<h1 class="pg">Bills</h1>' + tabs + body;
}

/* ---------------- cleaning ---------------- */
function cleanView(){
  var all = Object.values(S.clean).filter(function(c){ return c.day === bizDay() || c.status === 'open' || c.status === 'taken'; });
  var open = all.filter(function(c){ return c.status === 'open' || c.status === 'taken'; }).sort(function(a, b){ return (b.urgency === 'urgent') - (a.urgency === 'urgent') || (a.at || 0) - (b.at || 0); });
  var done = all.filter(function(c){ return c.status === 'done'; }).sort(function(a, b){ return (b.doneAt || 0) - (a.doneAt || 0); });
  var avg = done.length ? Math.round(done.reduce(function(n, c){ return n + ((c.doneAt || 0) - (c.at || 0)); }, 0) / done.length / 60000) : null;
  var card = function(c){ return '<div class="cl' + (c.urgency === 'urgent' ? ' urgent' : '') + (c.status === 'taken' ? ' taken' : '') + '"><div class="h"><b>' + esc(c.table) + '</b><span class="k">' + kindIc(c.kind) + ' ' + esc(kindName(c.kind)) + '<br><small class="muted">' + esc(c.spaceName || '') + ' · ' + agoT(c.at) + ' · by ' + esc(c.by) + '</small></span>' + (c.urgency === 'urgent' ? '<span class="badge2 b-urg">urgent</span>' : '') + '</div>' +
    (c.note ? '<div>“' + esc(c.note) + '”</div>' : '') + (c.status === 'taken' ? '<div class="muted" style="font-size:13px">🧑‍🔧 ' + esc(c.takenBy) + ' is on it · ' + ago(c.takenAt) + '</div>' : '') +
    '<div class="acts">' + (c.status === 'open' ? '<button class="btn" data-a="ctake" data-id="' + esc(c.id) + '">🙋 On it</button>' : '') + '<button class="btn pri" data-a="cdone" data-id="' + esc(c.id) + '">✓ Done</button></div></div>'; };
  return '<h1 class="pg">Cleaning</h1><div class="sum" style="grid-template-columns:repeat(3,1fr)"><div><small>Waiting</small><b>' + open.filter(function(c){ return c.status === 'open'; }).length + '</b></div><div><small>Done today</small><b>' + done.length + '</b></div><div><small>Avg time</small><b>' + (avg == null ? '–' : avg + 'm') + '</b></div></div>' +
    (S.me.role !== 'cleaner' ? '<p class="muted" style="margin:0 2px 10px;font-size:13px">To call a cleaner: open a table → ⋯ → Call cleaner.</p>' : '') +
    (open.length ? '<div class="list">' + open.map(card).join('') + '</div>' : '<div class="empty"><b>✨</b>All tables clean.</div>') +
    (done.length ? '<div class="sec-t">Done today</div><div class="list">' + done.slice(0, 30).map(function(c){ return '<div class="li"><span class="tico">' + esc(c.table) + '</span><span class="n">' + kindIc(c.kind) + ' ' + esc(kindName(c.kind)) + '<small>' + hm(c.at) + ' → ' + hm(c.doneAt) + ' · ' + Math.max(1, Math.round(((c.doneAt || 0) - (c.at || 0)) / 60000)) + ' min · ' + esc(c.doneBy || '') + '</small></span><span class="v">✓</span></div>'; }).join('') + '</div>' : '');
}

/* ---------------- admin ---------------- */
function adminView(){
  if(S.me.role !== 'office') return '<div class="empty">Office only.</div>';
  var tabs = '<div class="seg" style="margin-bottom:12px">' + [['staff','Staff'],['tables','Tables'],['menu','Menu'],['settings','Settings'],['trial','Trial'],['usage','Usage']].map(function(x){ return '<button class="' + (S.adminTab === x[0] ? 'on' : '') + '" data-a="atab" data-t="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  return '<h1 class="pg">Setup · captain app</h1>' + tabs + (S.adminTab === 'tables' ? tablesAdmin() : S.adminTab === 'menu' ? menuAdmin() : S.adminTab === 'settings' ? settingsAdmin() : S.adminTab === 'trial' ? trialAdmin() : S.adminTab === 'usage' ? usageAdmin() : staffAdmin());
}
function staffAdmin(){
  var P = S.people.slice().sort(function(a, b){ return (a.off ? 1 : 0) - (b.off ? 1 : 0) || APP_ROLES.indexOf(a.role) - APP_ROLES.indexOf(b.role) || String(a.name).localeCompare(b.name); });
  return '<div class="card"><h2>Add a person</h2><p class="sub">Each person gets a code. Any phone works: they pick their name and type the code.</p>' +
    '<div class="adj"><label class="f" style="margin:0">Name<input id="nName" placeholder="e.g. Rafeek" autocomplete="off"></label><label class="f" style="margin:0">Role<select id="nRole">' + ['captain','waiter','runner','cashier','cleaner','kitchen','office'].map(function(r){ return '<option value="' + r + '">' + ROLES[r] + '</option>'; }).join('') + '</select></label>' +
    '<label class="f" style="margin:0">Phone<input id="nPhone" inputmode="tel" placeholder="98xxxxxxxx" autocomplete="off"></label><label class="f" style="margin:0">Code (4–6 digits)<input id="nCode" inputmode="numeric" value="' + (S.newCode || (S.newCode = rcode())) + '" autocomplete="off"></label></div>' +
    '<div style="margin-top:12px"><button class="btn pri" data-a="padd" style="width:100%">+ Add ' + '</button></div></div>' +
    '<div class="card"><h2>Team · ' + P.filter(function(p){ return !p.off; }).length + ' active</h2><p class="sub">Tap a person to change role, phone or code, or to switch them off.</p><div class="list">' +
    P.map(function(p){ return '<button class="li" data-a="pedit" data-id="' + esc(p.id) + '" style="' + (p.off ? 'opacity:.5' : '') + '">' + avatar(p.name) + '<span class="n">' + esc(p.name) + '<small>' + esc(ROLES[p.role || 'office'] || p.role) + (p.phone ? ' · ' + esc(p.phone) : '') + (p.off ? ' · switched off' : '') + '</small></span><span class="v">›</span></button>'; }).join('') + '</div></div>';
}
function menuAdmin(){
  if(!S.posEdit){ S.posBase = clean(POSE || {}); S.posEdit = clean(POSE || {}); }
  var E = S.posEdit; E.price = E.price || {}; E.hide = E.hide || {}; E.add = E.add || [];
  var src = cfg('menuSrc', 'pos'), F = (POSM && POSM.fams || []).concat(E.add), q = (S.mq || '').toLowerCase();
  var shown = F.filter(function(f){ return !q || f.name.toLowerCase().indexOf(q) >= 0 || (f.cat || '').toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return (b.q || 0) - (a.q || 0); }).slice(0, q ? 80 : 40);
  return '<div class="card"><h2>Menu the captains sell from</h2><p class="sub">' + (POSM ? '<b>' + POSM.fams.length + ' dishes</b> learned from <b>' + (POSM.bills || 0) + '</b> VMENU bills (last 7 days + 2 months) · updated ' + agoT(POSM.at) : 'Not learned yet') + '</p>' +
    '<div class="seg"><button class="' + (src !== 'web' ? 'on' : '') + '" data-a="msrc" data-v="pos">VMENU list</button><button class="' + (src === 'web' ? 'on' : '') + '" data-a="msrc" data-v="web">Website menu</button></div>' +
    '<button class="btn" data-a="mrebuild" style="width:100%;margin-top:10px;min-height:44px">↻ Learn again from VMENU now</button></div>' +
    '<div class="card"><h2>Prices & hide</h2><p class="sub">A price typed here wins over VMENU’s. Hidden dishes vanish from every captain phone.</p><input id="mq" placeholder="Find a dish…" value="' + esc(S.mq || '') + '" autocomplete="off" style="margin-bottom:8px">' +
    shown.map(function(f){ var off = E.hide[f.id]; return '<div class="mrow' + (off ? ' off' : '') + '"><div class="mh"><b>' + esc(f.name) + '</b><small>' + esc(f.cat || '') + (f.q ? ' · ' + Math.round(f.q) + ' sold' : '') + (f.kit ? ' · ' + esc(String(f.kit).toLowerCase()) : '') + '</small><button class="mini' + (off ? ' on' : '') + '" data-a="mhide" data-id="' + esc(f.id) + '">' + (off ? 'Hidden' : 'Hide') + '</button></div><div class="mps">' +
      (f.ch || []).map(function(c){ var k = f.id + '|' + c.label, v = E.price[k] != null ? E.price[k] : c.price; return '<label><small>' + esc(c.label || 'Price') + '</small><input data-mp="' + esc(k) + '" inputmode="numeric" value="' + esc(v) + '"' + (E.price[k] != null ? ' class="ed"' : '') + '></label>'; }).join('') + '</div></div>'; }).join('') +
    '<button class="btn pri" data-a="msave" style="width:100%;margin-top:12px">Save menu changes</button></div>' +
    '<div class="card"><h2>Add a dish VMENU has not sold yet</h2><div class="adj"><label class="f" style="margin:0">Name<input id="maName" autocomplete="off"></label><label class="f" style="margin:0">Category<select id="maCat">' + CATS.map(function(c){ return '<option>' + esc(c[0]) + '</option>'; }).join('') + '<option>Others</option></select></label></div>' +
    '<label class="f">Sizes and prices<input id="maCh" placeholder="Qtr 210, Half 380, Full 710   or just   120" autocomplete="off"></label><button class="btn" data-a="madd" style="width:100%">+ Add dish</button></div>';
}
function rcode(){ return String(Math.floor(100000 + Math.random() * 900000)); }
async function writeList(P){ await S.F.setDoc(ref('crew', '_list'), clean({ people:P.map(function(p){ var x = { id:p.id, name:p.name, role:p.role || '' }; if(p.phone) x.phone = p.phone; if(p.off) x.off = true; return x; }) })); S.people = P; }
async function addPerson(){
  var name = $('nName').value.trim(), role = $('nRole').value, phone = $('nPhone').value.replace(/[^\d+]/g, ''), code = $('nCode').value.trim();
  if(!name){ toast('Type a name', 'bad'); return; } if(!/^\d{4,6}$/.test(code)){ toast('Code must be 4 to 6 digits', 'bad'); return; }
  var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5);
  try{ await S.F.setDoc(ref('crew', id), clean({ name:name, role:role, code:code, phone:phone || null })); await writeList(S.people.concat([{ id:id, name:name, role:role, phone:phone }])); }
  catch(e){ toast('Not saved', 'bad', esc(e.message || e)); return; }
  S.newCode = null; S.adminDirty = false; toast(esc(name) + ' added · code ' + esc(code), 'good', 'Tell them the code now'); render();
}
function personSheet(id){
  var p = S.people.filter(function(z){ return z.id === id; })[0]; if(!p) return;
  sheet('<h2>' + esc(p.name) + '</h2><p class="sub">' + esc(ROLES[p.role] || p.role) + '</p>' +
    '<label class="f">Name<input id="pName" value="' + esc(p.name) + '"></label>' +
    '<label class="f">Role<select id="pRole">' + ['captain','waiter','runner','cashier','cleaner','kitchen','office'].map(function(r){ return '<option value="' + r + '"' + ((p.role || 'office') === r ? ' selected' : '') + '>' + ROLES[r] + '</option>'; }).join('') + '</select></label>' +
    '<label class="f">Phone<input id="pPhone" inputmode="tel" value="' + esc(p.phone || '') + '"></label>' +
    '<label class="f">New code <span style="text-transform:none;letter-spacing:0;font-weight:600">(leave empty to keep the old one)</span><div class="row" style="margin:0"><input id="pCode" inputmode="numeric" placeholder="4–6 digits" autocomplete="off"><button class="mini" id="pRnd">Random</button><button class="mini" id="pShow">Show current</button></div></label>' +
    '<div class="row"><button class="btn pri" id="pSave" style="flex:1">Save</button><button class="btn ' + (p.off ? '' : 'bad') + '" id="pOff">' + (p.off ? 'Switch on' : 'Switch off') + '</button></div><button class="btn bad" id="pDel" style="width:100%;margin-top:4px;min-height:40px">Remove for good</button>');
  $('pRnd').onclick = function(){ $('pCode').value = rcode(); };
  $('pShow').onclick = async function(){ try{ var d = await S.F.getDoc(ref('crew', p.id)); var c = d.exists() && d.data().code; toast(c ? esc(p.name) + "'s code: " + esc(c) : 'No code stored', c ? '' : 'bad'); }catch(e){ toast('The rules hide codes - set a new one instead', 'bad'); } };
  $('pSave').onclick = async function(){
    var name = $('pName').value.trim() || p.name, role = $('pRole').value, phone = $('pPhone').value.replace(/[^\d+]/g, ''), code = $('pCode').value.trim();
    if(code && !/^\d{4,6}$/.test(code)){ toast('Code must be 4 to 6 digits', 'bad'); return; }
    var data = { name:name, role:role, phone:phone || null }; if(code) data.code = code;
    try{ await S.F.setDoc(ref('crew', p.id), clean(data), { merge:true }); await writeList(S.people.map(function(z){ return z.id === p.id ? Object.assign({}, z, { name:name, role:role, phone:phone }) : z; })); }
    catch(e){ toast('Not saved', 'bad', esc(e.message || e)); return; }
    closeSheet(); toast('Saved' + (code ? ' · new code ' + esc(code) : ''), 'good'); render(); };
  $('pOff').onclick = async function(){ try{ await S.F.setDoc(ref('crew', p.id), { off:!p.off }, { merge:true }); await writeList(S.people.map(function(z){ return z.id === p.id ? Object.assign({}, z, { off:!p.off }) : z; })); }catch(e){ toast('Not saved', 'bad'); return; } closeSheet(); render(); };
  $('pDel').onclick = async function(){ if(!confirm('Remove ' + p.name + ' for good?')) return; try{ await S.F.deleteDoc(ref('crew', p.id)); await writeList(S.people.filter(function(z){ return z.id !== p.id; })); }catch(e){ toast('Not removed', 'bad'); return; } closeSheet(); render(); };
}
function tablesAdmin(){
  var F = S.floorEdit || (S.floorEdit = clean(floor()));
  var planOf = function(sp){ return '<div class="plan">' + (sp.tables || []).map(function(t){ var u = 9 + (t.seats || 4) * 2.2, w = u, h = u; if(t.shape === 'rect'){ if(t.rot) h = u * 1.7; else w = u * 1.7; } return '<span class="pt" style="width:' + Math.round(w) + 'px;height:' + Math.round(h) + 'px;border-radius:' + (t.shape === 'round' ? '50%' : '8px') + '" title="' + esc(t.name) + ' · ' + t.seats + ' seats">' + esc(t.name) + '</span>'; }).join('') + '</div>'; };
  return F.spaces.map(function(sp, si){
    return '<div class="card"><div class="row" style="margin:0 0 8px"><input data-fs="' + si + '" value="' + esc(sp.name) + '" style="font-weight:800;font-size:17px"><button class="mini bad" data-a="fsdel" data-si="' + si + '">Delete space</button></div>' + planOf(sp) +
      '<div style="margin-top:8px">' + (sp.tables || []).map(function(t, ti){ return '<div class="trow"><input data-ft="' + si + ':' + ti + '" value="' + esc(t.name) + '" aria-label="table name"><div class="seats">' + SEATS.map(function(n){ return '<button class="' + (t.seats === n ? 'on' : '') + '" data-a="fseat" data-x="' + si + ':' + ti + ':' + n + '">' + n + '</button>'; }).join('') + '</div><div class="seats">' + SHAPES.map(function(s){ return '<button class="' + ((t.shape || 'square') === s[0] ? 'on' : '') + '" data-a="fshape" data-x="' + si + ':' + ti + ':' + s[0] + '" title="' + s[0] + '">' + s[1] + '</button>'; }).join('') + (t.shape === 'rect' ? '<button data-a="frot" data-x="' + si + ':' + ti + '" title="landscape / portrait">' + (t.rot ? '↕' : '↔') + '</button>' : '') + '</div><button class="mini bad" data-a="ftdel" data-x="' + si + ':' + ti + '" aria-label="remove table">✕</button></div>'; }).join('') + '</div>' +
      '<button class="mini" data-a="ftadd" data-si="' + si + '" style="margin-top:10px">+ Add table</button></div>';
  }).join('') + '<div class="row"><button class="btn" data-a="fsadd" style="flex:1">+ Add a space</button><button class="btn pri" data-a="fsave" style="flex:1">Save tables</button></div>' +
    '<p class="muted" style="font-size:13px">Seats 2–12 and the shape show on the floor and help the simulator later. Drag-and-drop room design comes later.</p>';
}
function settingsAdmin(){
  var ps = S.print || {}, ks = kitchens();
  var tg = function(k, d, t, s){ var on = cfg(k, d) !== false; return '<button class="opt' + (on ? ' on' : '') + '" data-a="cfgt" data-k="' + k + '" data-d="' + (d ? 1 : 0) + '"><span class="e">' + (on ? '✅' : '⬜') + '</span><span>' + t + (s ? '<br><small class="muted" style="font-weight:600">' + s + '</small>' : '') + '</span></button>'; };
  return '<div class="card"><h2>UPI</h2><p class="sub">The bill screen shows a QR with the amount filled in. Any UPI app can scan it.</p>' +
    '<label class="f">UPI ID<input id="sVpa" placeholder="hayat@okaxis" value="' + esc(cfg('upi', '') || ((C.upi || {}).id || '')) + '" autocomplete="off"></label><label class="f">Name shown in the UPI app<input id="sPn" placeholder="Hayat Fish and Mandi" value="' + esc(cfg('upiName', '') || ((C.upi || {}).name || '')) + '"></label><button class="btn pri" data-a="supi" style="width:100%">Save UPI</button></div>' +
    '<div class="card"><h2>Trial & printing</h2><p class="sub">While VMENU is still the main billing, keep Trial on: the owner app keeps counting VMENU only.</p><div class="opts" style="grid-template-columns:1fr">' +
    tg('trial', true, 'Trial mode', 'bills are marked TRIAL') + tg('printKot', !isTrial(), 'Print KOT in the kitchen', 'off during trial so the kitchen does not cook twice') + tg('kdsTrial', false, 'Show trial orders on the kitchen screen') + tg('printBill', true, 'Print the due bill at the counter') + tg('cleanAfter', true, 'Call the cleaner when a bill is paid') + '</div>' +
    '<p class="muted" style="font-size:13px;margin:0">Printer: ' + (ps.mode === 'agent' ? '✅ shop PC prints (' + ks.map(function(k){ return esc(k.name); }).join(', ') + ')' : '⚠️ not set up - website → Office → Printing → “Shop PC prints”') + '</p></div>';
}

/* ---------------- sheets ---------------- */
var HIST = { skip:0 };
function pushHist(kind){ try{ history.pushState({ cap:kind }, ''); }catch(e){} }
addEventListener('popstate', function(){
  if(HIST.skip){ HIST.skip--; return; }
  if($('scrim')){ closeSheet(true); return; }
  if(S.view === 'order'){ S.view = 'floor'; S.q = ''; render(); }
});
function sheet(html, side){
  closeSheet(); pushHist('sheet');
  var w = document.createElement('div'); w.className = 'scrim' + (side ? ' side' : ''); w.id = 'scrim';
  w.innerHTML = '<div class="sheet" role="dialog"><div class="grab"></div>' + html + '</div>';
  w.addEventListener('click', function(e){ if(e.target === w) closeSheet(); });
  document.body.appendChild(w); return w;
}
function closeSheet(fromBack){ var w = $('scrim'); if(w){ w.remove(); if(!fromBack && history.state && history.state.cap === 'sheet'){ HIST.skip++; history.back(); } } S.refresh = null; }

function billSheet(){
  var t = curTable(); if(!t) return;
  sheet('<div id="bsBody">' + billHtml(t) + '</div>');
  S.refresh = function(){ var b = $('bsBody'); if(b && curTable()) b.innerHTML = billHtml(curTable()); };
}
function meSheet(){
  var th = document.documentElement.dataset.theme || '';
  sheet('<div style="display:flex;align-items:center;gap:12px">' + avatar(S.me.name, 'big') + '<div><h2>' + esc(S.me.name) + '</h2><p class="sub" style="margin:0">' + esc(ROLES[S.me.role]) + ' on this phone</p></div></div>' +
    '<div class="opts" style="grid-template-columns:1fr;margin-top:14px"><button class="opt" id="mSwitch"><span class="e">🔄</span>Switch user</button>' +
    '<button class="opt" id="mTheme"><span class="e">🌗</span>Theme: ' + (th === 'dark' ? 'dark' : th === 'light' ? 'light' : 'auto') + '</button>' +
    (INSTALL ? '<button class="opt" id="mInstall"><span class="e">📲</span>Install the app on this phone</button>' : '<div class="opt" style="font-weight:600"><span class="e">📲</span><span>Install: browser menu → <b>Add to Home screen</b> (iPhone: Share → Add to Home Screen)</span></div>') + '</div>');
  $('mSwitch').onclick = async function(){ closeSheet(); S.me = null; lsSet('hayat-cap-me', null); S.view = 'login'; render(); try{ await S.ctx.au.signOut(S.ctx.auth); }catch(e){} location.reload(); };
  $('mTheme').onclick = function(){ var n = th === '' ? 'dark' : th === 'dark' ? 'light' : ''; if(n) document.documentElement.dataset.theme = n; else delete document.documentElement.dataset.theme; lsSet('hayat-cap-theme', n); meSheet(); };
  var mi = $('mInstall'); if(mi) mi.onclick = function(){ INSTALL.prompt(); INSTALL = null; closeSheet(); };
}
function tableMenu(){
  var t = curTable(); if(!t) return; var s = tstate(t), o = s.o;
  sheet('<h2>Table ' + esc(t.name) + '</h2><p class="sub">' + esc(t.spaceName) + ' · ' + t.seats + ' seats</p><div class="opts" style="grid-template-columns:1fr">' +
    '<button class="opt" id="tmClean"><span class="e">🧹</span>Call cleaner</button>' +
    (o ? '<button class="opt" id="tmMove"><span class="e">↔️</span>Move to another table</button><button class="opt" id="tmBill"><span class="e">🧾</span>' + (o.dueAt ? 'Print bill again' : 'Due bill') + '</button><button class="opt" id="tmCancel" style="color:var(--bad)"><span class="e">⛔</span>Cancel the whole bill</button>' : '') + '</div>');
  $('tmClean').onclick = function(){ cleanSheet(t.id); };
  if(o){ $('tmMove').onclick = function(){ moveSheet(o); }; $('tmBill').onclick = function(){ closeSheet(); dueBill(o.id); };
    $('tmCancel').onclick = function(){ reasonSheet('Cancel bill · Table ' + t.name, 'Every cooked item gets a cancel ticket.', function(r){ cancelBill(o.id, r); }); }; }
}
function cleanSheet(tid){
  var t = tableById(tid), cur = openClean(t), pick = 'clean', urg = 'normal';
  var first = true, put = function(html){ if(first || !$('ccBody')){ sheet('<div id="ccBody">' + html + '</div>'); first = false; } else $('ccBody').innerHTML = html; };
  var draw = function(){
    put('<h2>🧹 Call cleaner · ' + esc(t.name) + '</h2><p class="sub">Goes to the cleaner’s phone at once.</p>' +
      (cur ? '<div class="card" style="background:var(--cleanwash);border-color:var(--clean)">Already asked: <b>' + esc(kindName(cur.kind)) + '</b> ' + agoT(cur.at) + '' + (cur.status === 'taken' ? ' · ' + esc(cur.takenBy) + ' is on it' : '') + '<div class="row"><button class="btn" id="ccDone" style="flex:1">✓ It is clean</button><button class="btn bad" id="ccX" style="flex:1">Cancel request</button></div></div>' : '') +
      '<div class="opts">' + CLEAN_KINDS.map(function(k){ return '<button class="opt' + (pick === k[0] ? ' on' : '') + '" data-ck="' + k[0] + '"><span class="e">' + k[1] + '</span>' + k[2] + '</button>'; }).join('') + '</div>' +
      '<div class="seg"><button class="' + (urg === 'normal' ? 'on' : '') + '" data-cu="normal">Normal</button><button class="' + (urg === 'urgent' ? 'on' : '') + '" data-cu="urgent">🔴 Urgent</button></div>' +
      '<label class="f">Note (optional)<input id="ccNote" placeholder="e.g. guests waiting, kids table" autocomplete="off"></label><button class="btn pri" id="ccGo" style="width:100%">Send to cleaner</button>');
    document.querySelectorAll('[data-ck]').forEach(function(b){ b.onclick = function(){ pick = b.dataset.ck; draw(); }; });
    document.querySelectorAll('[data-cu]').forEach(function(b){ b.onclick = function(){ urg = b.dataset.cu; draw(); }; });
    $('ccGo').onclick = function(){ var n = $('ccNote').value.trim(); closeSheet(); requestClean(tid, pick, urg, n); };
    if(cur){ $('ccDone').onclick = function(){ closeSheet(); cleanStep(cur.id, 'done'); }; $('ccX').onclick = function(){ closeSheet(); cleanStep(cur.id, 'cancelled'); }; }
  };
  draw();
}
function moveSheet(o){
  var free = allTables().filter(function(t){ return t.id !== o.tableId && !openOrder(t); });
  sheet('<h2>Move ' + esc(o.table) + ' to…</h2><p class="sub">Only free tables are shown.</p>' + floor().spaces.map(function(sp){ var f = free.filter(function(t){ return t.space === sp.id; }); return f.length ? '<div class="sec-t">' + esc(sp.name) + '</div><div class="tgrid">' + f.map(function(t){ return '<button class="tb free" data-mv="' + esc(t.id) + '" style="min-height:64px"><span class="tn">' + esc(t.name) + '</span><span class="ts">' + t.seats + ' seats</span></button>'; }).join('') + '</div>' : ''; }).join(''));
  document.querySelectorAll('[data-mv]').forEach(function(b){ b.onclick = function(){ closeSheet(); moveTable(o.id, b.dataset.mv); }; });
}
function reasonSheet(title, sub, cb, extra){
  var pick = '';
  sheet('<h2>' + esc(title) + '</h2><p class="sub">' + esc(sub) + '</p>' + (extra || '') + '<div class="opts">' + REASONS.map(function(r){ return '<button class="opt" data-rs="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '</div><label class="f">Or type the reason<input id="rsTxt" autocomplete="off"></label><button class="btn pri" id="rsGo" style="width:100%" disabled>Confirm</button>');
  var go = $('rsGo'), txt = $('rsTxt'), ready = function(){ go.disabled = !(pick || txt.value.trim()); };
  document.querySelectorAll('[data-rs]').forEach(function(b){ b.onclick = function(){ pick = b.dataset.rs; document.querySelectorAll('[data-rs]').forEach(function(x){ x.classList.toggle('on', x === b); }); ready(); }; });
  txt.oninput = ready;
  go.onclick = function(){ var r = txt.value.trim() || pick; if(!r) return; var q = $('rsQty') ? +$('rsQty').dataset.v : null; closeSheet(); cb(r, q); };
}
function voidSheet(k){
  var t = curTable(), o = t && openOrder(t); if(!o) return; var l = live(o).filter(function(z){ return z.k === k; })[0]; if(!l) return;
  var q = 1;
  var extra = '<div class="row" style="justify-content:space-between;background:var(--bg);border-radius:12px;padding:10px 12px"><span><b>' + esc(l.name) + '</b>' + (l.label ? ' · ' + esc(l.label) : '') + '<br><small class="muted">' + l.q + ' on the bill</small></span><div class="step"><button id="vqm">−</button><span id="rsQty" data-v="1">1</span><button id="vqp">+</button></div></div>';
  reasonSheet('Remove from the bill', 'It was sent to the kitchen, so a cancel ticket prints there.', function(r, n){ voidLine(o.id, k, n || 1, r); }, extra);
  var upd = function(){ var e = $('rsQty'); e.textContent = q; e.dataset.v = q; };
  $('vqm').onclick = function(){ q = Math.max(1, q - 1); upd(); }; $('vqp').onclick = function(){ q = Math.min(l.q, q + 1); upd(); };
}
function noteSheet(k){
  var t = curTable(); var d = S.draft[t.id]; var l = d && d.lines.filter(function(z){ return z.k === k; })[0]; if(!l) return;
  var quick = ['Less spicy', 'Extra spicy', 'Less salt', 'No sugar', 'Less sugar', 'No ice', 'No onion', 'No garlic', 'Extra mayo', 'Well done', 'Kids portion', 'Allergy - ask', 'Parcel', 'Serve first', 'Serve later', 'Serve hot'];
  sheet('<h2>Note for the kitchen</h2><p class="sub">' + esc(l.name) + (l.label ? ' · ' + esc(l.label) : '') + '</p><div class="quick">' + quick.map(function(x){ return '<button data-nq="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div><label class="f">Note<input id="ntTxt" value="' + esc(l.note || '') + '" autocomplete="off"></label><button class="btn pri" id="ntGo" style="width:100%">Save note</button>');
  document.querySelectorAll('[data-nq]').forEach(function(b){ b.onclick = function(){ var v = $('ntTxt').value.trim(); $('ntTxt').value = v ? v + ', ' + b.dataset.nq.toLowerCase() : b.dataset.nq; }; });
  $('ntGo').onclick = function(){ var v = $('ntTxt').value.trim(); l.note = v; l.k = l.id + '|' + l.label + (v ? '|' + v : '');
    var same = d.lines.filter(function(z){ return z !== l && z.k === l.k; })[0]; if(same){ same.q += l.q; d.lines = d.lines.filter(function(z){ return z !== l; }); }
    saveDraft(); closeSheet(); render(); };
}

/* ---------------- pay: our own keypad, so the phone keyboard never covers the bill ----------------
   Active field (received / discount / tip / split part) takes the keypad. Change to give back is
   the biggest thing on screen. "✓ Money received" only - UPI asks once more. */
function upiLink(amt, o){
  var vpa = cfg('upi', '') || ((C.upi || {}).id || ''); if(!vpa) return '';
  var pn = cfg('upiName', '') || ((C.upi || {}).name || 'Hayat Fish and Mandi');
  return 'upi://pay?pa=' + encodeURIComponent(vpa) + '&pn=' + encodeURIComponent(pn) + '&am=' + (Math.round(amt * 100) / 100).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('Hayat ' + (o.table ? 'Table ' + o.table : '') + ' ' + o.id);
}
function notes(pay){ /* exact, then the notes people really hand over */ var v = [pay]; [50, 100, 500].forEach(function(s){ var x = Math.ceil(pay / s) * s; if(x > pay) v.push(x); }); var big = [500, 1000, 2000].filter(function(x){ return x > pay; })[0]; if(big) v.push(big); if(pay < 2000 && v.indexOf(2000) < 0) v.push(2000); return v.filter(function(x, i, a){ return a.indexOf(x) === i; }).sort(function(a, b){ return a - b; }).slice(0, 6); }
function paySheet(oid){
  var o = S.orders[oid]; if(!o) return;
  var payT0 = Date.now(); ux('payopen', { oid:oid });
  var P = { mode:cfg('payDefault', 'cash'), field:'recv', recv:'', dtype:(o.discount && o.discount.type) || 'amt', dval:o.discount && o.discount.value ? String(o.discount.value) : '', tip:o.tip ? String(o.tip) : '', split:['', '', ''], confirm:false, details:false, cleanAfter:cfg('cleanAfter', true) !== false };
  var keep = lsGet('hayat-cap-pay', null);   /* what was typed survives a refresh / an accidental close for 15 min */
  if(keep && keep.oid === oid && Date.now() - keep.at < 15 * 60e3 && keep.P) Object.assign(P, keep.P, { confirm:false });
  if(P.mode !== 'cash' && P.field === 'recv') P.field = '';
  sheet('<div id="payBody" data-oid="' + esc(oid) + '"></div>');
  var sig0 = '', M = null;
  var cur = function(){ return S.orders[oid] || o; };
  var calc = function(){ var d = +P.dval > 0 ? { type:P.dtype, value:+P.dval } : null; return money(cur(), { discount:d, tip:Math.round(+P.tip || 0) }); };
  var fieldVal = function(f){ return f === 'recv' ? P.recv : f === 'disc' ? P.dval : f === 'tip' ? P.tip : /^sp/.test(f) ? P.split[+f.slice(2)] : ''; };
  var setField = function(f, v){ if(f === 'recv') P.recv = v; else if(f === 'disc'){ P.dval = v; if(P.dtype === 'pct' && +v > 100) P.dval = '100'; } else if(f === 'tip') P.tip = v; else if(/^sp/.test(f)) P.split[+f.slice(2)] = v; };
  var draw = function(){
    o = cur(); var m = M = calc(), L = live(o), sp = P.split.map(function(x){ return Math.round(+x || 0); }), spSum = sp.reduce(function(a, b){ return a + b; }, 0), left = m.pay - spSum;
    var sg = [P.mode, P.dval, P.dtype, P.tip, P.split.join(','), m.pay].join('|'); if(sg !== sig0){ if(sig0) P.confirm = false; sig0 = sg; }
    var recv = Math.round(+P.recv || 0), upiAmt = P.mode === 'split' ? sp[1] : m.pay, link = (P.mode === 'upi' || (P.mode === 'split' && sp[1] > 0)) ? upiLink(upiAmt, o) : '';
    var where = o.mode === 'dinein' ? 'Table ' + esc(o.table) : esc(o.token ? 'Token ' + o.token : o.id);
    var pill = function(f, lab, val){ return '<button class="fpill' + (P.field === f ? ' on' : '') + '" data-pf="' + f + '"><small>' + lab + '</small><b>' + val + '</b></button>'; };
    var h = '<div class="payhd"><div><h2>' + where + '</h2><p class="sub" style="margin:0">' + L.reduce(function(n, l){ return n + l.q; }, 0) + ' items · ' + (o.kotN || 1) + ' KOT' + ((o.kotN || 1) > 1 ? 's' : '') + (o.dueCount ? ' · bill printed' : '') + ' · <a href="#" id="pDet">' + (P.details ? 'hide items ▴' : 'items ▾') + '</a></p></div><div class="hero"><small>To pay</small><b>' + rs(m.pay) + '</b></div></div>' +
      (P.details ? '<div class="rcpt">' + L.map(function(l){ return '<div class="rl"><span>' + l.q + '× ' + esc(l.name) + (l.label ? ' <small class="muted">' + esc(l.label) + '</small>' : '') + '</span><span>' + rs(l.q * l.price) + '</span></div>'; }).join('') + '<div class="rl muted"><span>Bill</span><span>' + rs(m.sub) + '</span></div></div>' : '') +
      '<div class="maths">' + rs(m.sub) + (m.off ? ' <span class="good">− ' + rs(m.off) + (P.dtype === 'pct' ? ' (' + P.dval + '%)' : '') + '</span>' : '') + (m.tip ? ' + tip ' + rs(m.tip) : '') + ' = <b>' + rs(m.pay) + '</b></div>' +
      '<div class="frow">' + pill('disc', 'Discount', m.off ? (P.dtype === 'pct' ? P.dval + '%' : rs(m.off)) : '—') + pill('tip', 'Tip', m.tip ? rs(m.tip) : '—') + '</div>' +
      '<div class="seg pm">' + [['cash','💵','Cash'],['upi','📱','UPI'],['card','💳','Card'],['split','➗','Split']].map(function(x){ return '<button class="' + (P.mode === x[0] ? 'on' : '') + '" data-pm="' + x[0] + '"><span>' + x[1] + '</span>' + x[2] + '</button>'; }).join('') + '</div>';
    if(P.mode === 'cash'){
      h += '<button class="recv' + (P.field === 'recv' ? ' on' : '') + '" data-pf="recv"><small>Cash received</small><b>' + (recv ? rs(recv) : '<span class="muted">tap a note or type</span>') + '</b></button>' +
        (recv ? (recv >= m.pay ? '<div class="chg ok"><small>Give back</small><b>' + rs(recv - m.pay) + '</b></div>' : '<div class="chg bad"><small>Still short</small><b>' + rs(m.pay - recv) + '</b></div>') : '');
    }
    if(P.mode === 'card') h += '<div class="cardmsg">Take <b>' + rs(m.pay) + '</b> on the card machine, then tap below.</div>';
    if(P.mode === 'split') h += '<div class="splits">' + ['Cash', 'UPI', 'Card'].map(function(lab, i){ return '<button class="recv sm' + (P.field === 'sp' + i ? ' on' : '') + '" data-pf="sp' + i + '"><small>' + lab + '</small><b>' + (sp[i] ? rs(sp[i]) : '—') + '</b></button>'; }).join('') + '</div><div class="chg ' + (left === 0 ? 'ok' : 'bad') + ' sm"><small>' + (left === 0 ? 'Adds up' : left > 0 ? 'Still to split' : 'Too much') + '</small><b>' + (left === 0 ? '✓' : rs(Math.abs(left))) + '</b></div>';
    if(link && !P.field) h += '<div class="qrbox"><img alt="UPI QR" src="' + window.qrSvg(link, 340) + '"><div><div class="upi">SCAN · ANY UPI APP</div><b>' + rs(upiAmt) + '</b><small>' + esc(cfg('upi', '') || (C.upi || {}).id) + '</small><small>amount is filled in</small></div></div>';
    else if((P.mode === 'upi') && !link && !P.field) h += '<div class="card" style="background:var(--accwash);border-color:var(--acc);margin:10px 0">No UPI ID yet.' + ' Owner app → More → Setup → Settings.' + '</div>';
    if(P.field){
      var qk = P.field === 'recv' ? notes(m.pay).map(function(v){ return '<button data-qv="' + v + '">' + (v === m.pay ? 'Exact ' : '') + rs(v) + '</button>'; }).join('')
        : P.field === 'disc' ? '<span class="dt"><button class="' + (P.dtype === 'amt' ? 'on' : '') + '" data-dt="amt">₹</button><button class="' + (P.dtype === 'pct' ? 'on' : '') + '" data-dt="pct">%</button></span>' + [5, 10, 15, 20].map(function(v){ return '<button data-qd="' + v + '">' + v + '%</button>'; }).join('') + (m.sub % 10 ? '<button data-qro="1">Round off ' + rs(m.sub % 10) + '</button>' : '') + '<button data-qv="">None</button>'
        : P.field === 'tip' ? [10, 20, 50, 100].map(function(v){ return '<button data-qv="' + v + '">' + rs(v) + '</button>'; }).join('') + '<button data-qru="1">Round up</button><button data-qv="">None</button>'
        : /^sp/.test(P.field) ? '<button data-qrest="1">Rest ' + rs(Math.max(0, left + (sp[+P.field.slice(2)] || 0))) + '</button><button data-qv="">0</button>' : '';
      h += '<div class="quick">' + qk + '</div><div class="kpad">' + ['1','2','3','4','5','6','7','8','9','00','0','⌫'].map(function(k){ return '<button data-k="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
        (P.field !== 'recv' ? '<button class="btn" data-kdone="1" style="width:100%;margin-top:8px;min-height:44px">Done</button>' : '');
    }
    if(o.mode === 'dinein') h += '<button class="opt cl' + (P.cleanAfter ? ' on' : '') + '" id="pCl"><span class="e">' + (P.cleanAfter ? '✅' : '⬜') + '</span>Call the cleaner after payment</button>';
    var short_ = (P.mode === 'cash' && recv && recv < m.pay) || (P.mode === 'split' && left !== 0) || (m.total === 0 && m.sub > 0);
    h += '<div class="payact">' + (o.paid ? '<button class="btn" id="pX" style="flex:1">Close · paid</button>' : '<button class="btn" id="pPrint" style="flex:none" aria-label="print bill">🖨</button><button class="btn ' + (P.confirm ? 'acc' : 'pri') + '" id="pGo" style="flex:1"' + (short_ ? ' disabled' : '') + '>' + (m.total === 0 && m.sub > 0 ? 'Total is ₹0 · check the discount' : P.confirm ? 'Yes, ' + rs(upiAmt) + ' arrived in UPI ✓' : '✓ Money received · ' + rs(m.pay)) + '</button>') + '</div>' +
      (o.paid ? '' : '<p class="muted" style="font-size:12px;text-align:center;margin:6px 0 0">' + (P.confirm ? 'Check the UPI app shows success, then tap again.' : 'Tap only after the money is with you.') + '</p>');
    var b = $('payBody'); if(!b) return; b.innerHTML = h; bind(m, left, sp);
    if(!o.paid) lsSet('hayat-cap-pay', { oid:oid, at:Date.now(), P:{ mode:P.mode, field:P.field, recv:P.recv, dtype:P.dtype, dval:P.dval, tip:P.tip, split:P.split, cleanAfter:P.cleanAfter } });
  };
  var bind = function(m, left, sp){
    var q = function(sel, fn){ document.querySelectorAll('#payBody ' + sel).forEach(function(e){ e.onclick = function(ev){ ev.preventDefault(); fn(e); draw(); }; }); };
    q('#pDet', function(){ P.details = !P.details; });
    q('[data-pf]', function(e){ P.field = P.field === e.dataset.pf && e.dataset.pf !== 'recv' ? '' : e.dataset.pf; });
    q('[data-pm]', function(e){ P.mode = e.dataset.pm; P.field = P.mode === 'cash' ? 'recv' : P.mode === 'split' ? 'sp0' : ''; if(P.mode === 'split' && !P.split.some(Boolean)) P.split = ['', '', '']; });
    q('[data-k]', function(e){ var f = P.field, v = fieldVal(f), k = e.dataset.k; v = k === '⌫' ? v.slice(0, -1) : (v + k).replace(/^0+(?=\d)/, '').slice(0, 7); setField(f, v); vib(5); });
    q('[data-qv]', function(e){ setField(P.field, e.dataset.qv); if(P.field !== 'recv' && P.field.indexOf('sp') !== 0) P.field = ''; });
    q('[data-qd]', function(e){ P.dtype = 'pct'; P.dval = e.dataset.qd; P.field = ''; });
    q('[data-dt]', function(e){ P.dtype = e.dataset.dt; if(P.dtype === 'pct' && +P.dval > 100) P.dval = ''; });
    q('[data-qro]', function(){ P.dtype = 'amt'; P.dval = String(m.sub % 10); P.field = ''; });
    q('[data-qru]', function(){ var base = m.total; P.tip = String(Math.ceil((base + 1) / 50) * 50 - base); P.field = ''; });
    q('[data-qrest]', function(){ var i = +P.field.slice(2); P.split[i] = String(Math.max(0, left + (sp[i] || 0))); });
    q('[data-kdone]', function(){ P.field = P.mode === 'cash' ? 'recv' : ''; });
    q('#pCl', function(){ P.cleanAfter = !P.cleanAfter; });
    var x = $('pX'); if(x) x.onclick = closeSheet;
    var pr = $('pPrint'); if(pr) pr.onclick = async function(){ var d = +P.dval > 0 ? { type:P.dtype, value:+P.dval } : null; try{ await txOrder(oid, function(){ return { discount:d, tip:Math.round(+P.tip || 0) }; }); }catch(e){} closeSheet(); dueBill(oid); };
    var go = $('pGo'); if(go) go.onclick = async function(){
      var needs = P.mode === 'upi' || (P.mode === 'split' && sp[1] > 0);
      if(needs && !P.confirm){ P.confirm = true; vib(15); draw(); return; }
      go.disabled = true; S.refresh = null;
      var d = +P.dval > 0 ? { type:P.dtype, value:+P.dval } : null;
      var PP = { mode:P.mode, discount:d, tip:Math.round(+P.tip || 0), tendered:P.mode === 'cash' ? Math.round(+P.recv || 0) : 0, split:[{ mode:'cash', amt:sp[0] }, { mode:'upi', amt:sp[1] }, { mode:'card', amt:sp[2] }], cleanAfter:P.cleanAfter };
      var ok = await markPaid(oid, PP, m.pay); ux('pay', { mode:P.mode, ok:!!ok, ms:Date.now() - payT0, amt:m.pay, tip:PP.tip || undefined, disc:PP.discount ? PP.discount.value + PP.discount.type : undefined }); if(ok){ lsSet('hayat-cap-pay', null); closeSheet(); if(S.view === 'order') S.view = 'floor'; render(); } else { go.disabled = false; S.refresh = refresh; }
    };
  };
  var lastSig = '';
  var refresh = function(){ var c = S.orders[oid]; if(!c) return; var sg = JSON.stringify([c.lines, c.paid, c.dueCount]); if(lastSig && sg !== lastSig) toast('This bill changed on another phone', '', 'the screen is updated'); if(sg !== lastSig){ var first = !lastSig; lastSig = sg; if(!first) draw(); } };
  draw(); refresh(); S.refresh = refresh;
}

/* ---------------- what needs a captain now ---------------- */
function attention(){
  var out = [], now = Date.now();
  allTables().forEach(function(t){ var s = tstate(t), o = s.o;
    if(s.st === 'bill' && now - o.dueAt > 10 * 60e3) out.push({ t:t, w:3, ic:'🧾', txt:'bill given ' + ago(o.dueAt) + ' · not paid' });
    else if(s.st === 'eat'){ var last = Math.max.apply(null, (o.kots || []).map(function(k){ return k.at || 0; }).concat([o.at || 0]));
      if(now - last > 35 * 60e3) out.push({ t:t, w:2, ic:'⏱', txt:'last KOT ' + ago(last) + ' ago · check on them' }); }
    else if(s.st === 'clean' && s.c.status === 'open' && now - s.c.at > 6 * 60e3) out.push({ t:t, w:s.c.urgency === 'urgent' ? 4 : 1, ic:'🧹', txt:'cleaning waiting ' + ago(s.c.at) });
    if(draftCount(t.id) && (S.draft[t.id].at || 0) && now - S.draft[t.id].at > 4 * 60e3) out.push({ t:t, w:5, ic:'⚠️', txt:draftCount(t.id) + ' items NOT sent to the kitchen' });
  });
  return out.sort(function(a, b){ return b.w - a.w; });
}
function attnHtml(){ var A = attention(); if(!A.length) return '';
  return '<div class="attn">' + A.slice(0, 6).map(function(a){ return '<button class="at w' + a.w + '" data-a="table" data-t="' + esc(a.t.id) + '"><b>' + a.ic + ' ' + esc(a.t.name) + '</b><span>' + esc(a.txt) + '</span></button>'; }).join('') + '</div>'; }

/* ---------------- long press ---------------- */
var LP = { tm:null, fired:false, x:0, y:0 };
document.addEventListener('pointerdown', function(e){
  var el = e.target.closest('[data-lp]'); LP.fired = false; clearTimeout(LP.tm); if(!el) return;
  LP.x = e.clientX; LP.y = e.clientY;
  LP.tm = setTimeout(function(){ LP.fired = true; LP.until = Date.now() + 700; vib(25); longPress(el); }, 430);
}, { passive:true });
['pointerup', 'pointercancel'].forEach(function(ev){ document.addEventListener(ev, function(){ clearTimeout(LP.tm); }, { passive:true }); });
document.addEventListener('pointermove', function(e){ if(Math.abs(e.clientX - LP.x) + Math.abs(e.clientY - LP.y) > 12) clearTimeout(LP.tm); }, { passive:true });
document.addEventListener('contextmenu', function(e){ if(e.target.closest('[data-lp]')) e.preventDefault(); });
document.addEventListener('click', function(e){ if(LP.until && Date.now() < LP.until){ e.stopPropagation(); e.preventDefault(); LP.until = 0; LP.fired = false; } }, true);   /* the finger lifting after a hold must not tap the sheet it opened */
function longPress(el){
  var k = el.dataset.lp, t = curTable();
  if(k === 'qty' && t){ var x = BYID[el.dataset.id]; if(x) qtySheet(t, x, +el.dataset.i); }
  if(k === 'table'){ if(S.me && S.me.role === 'cleaner') return; S.table = el.dataset.t; tableMenu(true); }
}

/* ---------------- gestures: swipe a sheet down to close · edge swipes ---------------- */
var SW = null;
document.addEventListener('touchstart', function(e){
  var p = e.touches[0], sh = e.target.closest('.sheet'), sc = $('scrim');
  SW = { x:p.clientX, y:p.clientY, t:Date.now(), sheet:sh && !sc.classList.contains('side') && (sh.scrollTop <= 0 || e.target.closest('.grab,.payhd,h2')) ? sh : null, edge:p.clientX < 22 ? 'l' : p.clientX > innerWidth - 22 ? 'r' : '', inItems:!!e.target.closest('#items') };
}, { passive:true });
document.addEventListener('touchmove', function(e){
  if(!SW || !SW.sheet) return; var dy = e.touches[0].clientY - SW.y; if(dy > 0){ SW.sheet.style.transform = 'translateY(' + dy + 'px)'; SW.sheet.style.transition = 'none'; SW.dy = dy; }
}, { passive:true });
document.addEventListener('touchend', function(e){
  if(!SW) return; var p = e.changedTouches[0], dx = p.clientX - SW.x, dy = p.clientY - SW.y, fast = Date.now() - SW.t < 450;
  if(SW.sheet){ var sh = SW.sheet; sh.style.transition = 'transform .18s'; if((SW.dy || 0) > 110 || ((SW.dy || 0) > 50 && fast)) closeSheet(); else sh.style.transform = ''; }
  else if(!$('scrim') && !SW.edge && S.view === 'order' && SW.inItems && Math.abs(dx) > 60 && Math.abs(dy) < 45 && $('cats')){ stepCat(dx < 0 ? 1 : -1); }
  else if(!$('scrim') && Math.abs(dx) > 70 && Math.abs(dy) < 60){
    if(SW.edge === 'l' && dx > 0 && S.view === 'order'){ S.view = 'floor'; S.q = ''; render(); }
    else if(SW.edge === 'r' && dx < 0 && S.me && S.me.role !== 'cleaner' && (S.view === 'floor' || S.view === 'order')) billsDrawer();
  }
  SW = null;
}, { passive:true });
function billsDrawer(){
  var open = Object.values(S.orders).filter(function(o){ return !closed(o); }).sort(function(a, b){ return (b.dueAt ? 1 : 0) - (a.dueAt ? 1 : 0) || (a.at || 0) - (b.at || 0); });
  sheet('<h2>Open bills · ' + open.length + '</h2><p class="sub">' + rs(open.reduce(function(n, o){ return n + money(o).total; }, 0)) + ' running · swipe in from the right edge any time</p>' +
    (open.length ? '<div class="list">' + open.map(function(o){ var m = money(o); return '<button class="li" data-a="openo" data-id="' + esc(o.id) + '"><span class="tico">' + esc(String(o.table || (o.token ? 'T' + o.token : '•')).slice(0, 4)) + '</span><span class="n">' + esc(o.mode === 'dinein' ? 'Table ' + o.table : o.token ? 'Token ' + o.token : o.mode || 'order') + ' ' + (o.dueAt ? '<span class="badge2 b-bill">bill given</span>' : '<span class="badge2 b-eat">eating</span>') + '<small>' + ago(o.at) + ' · ' + live(o).reduce(function(n, l){ return n + l.q; }, 0) + ' items' + (o.by ? ' · ' + esc(o.by) : '') + '</small></span><span class="v">' + rs(m.total) + '</span></button>'; }).join('') + '</div>' : '<div class="empty"><b>✨</b>No open bills.</div>'), true);
}
/* the keyboard: keep the dock above it */
if(window.visualViewport){ var vvF = function(){ var vv = window.visualViewport, kb = Math.max(0, innerHeight - vv.height - vv.offsetTop); document.documentElement.style.setProperty('--kb', kb + 'px'); document.body.classList.toggle('kbd', kb > 120); dockSize(); }; visualViewport.addEventListener('resize', vvF); visualViewport.addEventListener('scroll', vvF); }
var DRO = window.ResizeObserver ? new ResizeObserver(function(){ dockSize(); }) : null, DOBS = null;
function dockSize(){ var d = $('dock'); document.documentElement.style.setProperty('--dockh', (d ? d.offsetHeight : 0) + 'px'); if(DRO && d && DOBS !== d){ try{ if(DOBS) DRO.unobserve(DOBS); }catch(e){} DRO.observe(d); DOBS = d; } }

/* ---------------- what real people do (usage capture) ----------------
   Every tap (what it hit, where), searches (and how many results), adds and by which route,
   undo, voids, errors, dead taps (nothing there) and rage taps (3 fast taps in one spot).
   Batched to ux_events/{session}_{n}; ux_sessions/{session} holds who / device / counts.
   Setup → Usage reads them back: the struggles, and each session step by step to replay. */
var UX = { sid:'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), buf:[], n:0, cnt:0, t0:Date.now(), taps:[], started:false, q:null };
function uxOn(){ return !SETUP && S.F && S.me && cfg('uxLog', true) !== false; }
function ux(e, d){ if(!uxOn()) return; if(!UX.started) uxStart(); UX.cnt++; UX.buf.push(clean(Object.assign({ t:Date.now() - UX.t0, e:e, v:S.view, tb:S.view === 'order' ? (S.table || undefined) : undefined }, d || {}))); if(UX.buf.length >= 60) uxFlush(); }
function uxStart(){ UX.started = true; S.F.setDoc(ref('ux_sessions', UX.sid), clean({ sid:UX.sid, start:UX.t0, day:bizDay(UX.t0), who:S.me.name, crew:S.me.id, role:S.me.role, w:innerWidth, h:innerHeight, dpr:window.devicePixelRatio || 1, ua:navigator.userAgent.slice(0, 140), standalone:!!(window.matchMedia && matchMedia('(display-mode: standalone)').matches), events:0 })).catch(function(){}); }
function uxFlush(){ if(!UX.buf.length || !S.F || !UX.started) return; var chunk = UX.buf.splice(0), n = UX.n++;
  S.F.setDoc(ref('ux_events', UX.sid + '_' + String(n).padStart(4, '0')), { sid:UX.sid, n:n, at:Date.now(), ev:chunk }).catch(function(){ UX.buf = chunk.concat(UX.buf); UX.n--; });
  S.F.setDoc(ref('ux_sessions', UX.sid), { end:Date.now(), events:UX.cnt }, { merge:true }).catch(function(){}); }
setInterval(uxFlush, 15000);
document.addEventListener('visibilitychange', function(){ if(document.hidden){ ux('hide'); uxFlush(); } else ux('show'); });
addEventListener('pagehide', function(){ uxFlush(); });
document.addEventListener('pointerup', function(e){
  if(!uxOn()) return; var el = e.target.closest('[data-a],button,input,a,[role=button],select,label,.sr,.tb'), x = Math.round(e.clientX), y = Math.round(e.clientY), now = Date.now();
  UX.taps = UX.taps.filter(function(p){ return now - p.t < 800 && Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 30; }); UX.taps.push({ t:now, x:x, y:y });
  if(UX.taps.length === 3) ux('rage', { x:x, y:y, on:el ? (el.dataset.a || el.tagName.toLowerCase()) : 'nothing' });
  if(!el){ ux('dead', { x:x, y:y, w:innerWidth, h:innerHeight, txt:String(e.target.innerText || '').slice(0, 30) }); return; }
  ux('tap', { a:el.dataset.a || el.id || el.tagName.toLowerCase(), id:el.dataset.id || el.dataset.t || el.dataset.k || el.dataset.c || el.dataset.m || el.dataset.v || undefined, i:el.dataset.i, x:x, y:y, lp:LP.fired || undefined, txt:String(el.innerText || el.value || '').replace(/\s+/g, ' ').slice(0, 40) });
}, true);
function uxQuery(){ clearTimeout(UX.q); UX.q = setTimeout(function(){ if(!S.q) return; var r = searchMenu(S.q); ux('search', { q:S.q, n:r.length, best:r[0] ? r[0].x.name : '' }); }, 700); }

/* ---------------- Setup → Trial: replay a real VMENU day into the TRIAL tables ----------------
   Yesterday's dine-in bills, from the hour you pick, played live (same gaps, or faster) as captain
   orders in trial_orders: tables fill, KOTs, add-ons, bills, payments - so the floor and the phones
   can be watched with real-looking traffic. Never touches VMENU data or the real orders. */
var SIM = { ev:[], i:0, tm:null, made:{}, locks:{}, msg:'' };
var SEC_SP = { 'AC':'ac', 'NON AC':'nonac', 'NONAC':'nonac', 'HUT':'hut', 'JUICY HUT':'juicy', 'JUICE HUT':'juicy' };
function tsMs(s){ return s ? new Date(String(s).replace(' ', 'T')).getTime() : 0; }
function choiceFor(vn, p){
  var key = String(vn || '').trim().toUpperCase(), hit = null;
  IDX.forEach(function(x){ x.ch.forEach(function(c, i){ if(!hit && c.vn && String(c.vn).trim().toUpperCase() === key) hit = { x:x, i:i }; }); });
  if(hit) return { k:hit.x.id + '|' + (hit.x.ch[hit.i].label || ''), id:hit.x.id, name:hit.x.name, label:hit.x.ch[hit.i].label || '', price:+p || hit.x.ch[hit.i].price, vn:vn, kit:hit.x.ch[hit.i].kit || hit.x.kit || '' };
  var pn = parseName(vn); return { k:'v-' + slug(pn.fam) + '|' + pn.size, id:'v-' + slug(pn.fam), name:titleCase(pn.fam), label:pn.size, price:+p || 0, vn:vn, kit:'' };
}
async function simPrepare(day, fromH, max, speed){
  var sn = await S.F.getDoc(ref('vm_daylog', day)); if(!sn.exists()) throw new Error('no VMENU day log for ' + day);
  var R = Object.values(sn.data().records || {}).filter(function(r){ return (r.kind === 'dine' || r.kindRaw === 'dine') && r.status !== 'void' && r.status !== 'cancelled' && (r.items || []).length && r.createdAt && new Date(String(r.createdAt).replace(' ', 'T')).getHours() >= fromH; })
    .sort(function(a, b){ return tsMs(a.createdAt) - tsMs(b.createdAt); }).slice(0, max);
  if(!R.length) throw new Error('no dine bills after ' + fromH + ':00 on ' + day);
  var base = tsMs(R[0].createdAt), start = Date.now() + 3000, at = function(s){ return start + (tsMs(s) - base) / speed; }, ev = [];
  R.forEach(function(r, n){ var it = (r.items || []).filter(function(i){ return i.q > 0; }).map(function(i){ return Object.assign(choiceFor(i.n, i.p), { q:+i.q }); });
    var kts = (r.kots || []).map(tsMs).filter(Boolean).sort(), split = kts.length > 1 && it.length > 1 ? it.length - 1 : it.length;
    var sp = SEC_SP[String(r.section || '').toUpperCase().trim()] || 'ac';
    ev.push({ at:at(r.createdAt), k:'open', n:n, sp:sp, pax:r.pax || Math.max(1, Math.min(8, Math.round((+r.total || 0) / 350))), lines:it.slice(0, split), by:r.waiter || 'SIM' });
    if(split < it.length) ev.push({ at:start + (kts[1] - base) / speed, k:'add', n:n, lines:it.slice(split), by:r.waiter || 'SIM' });
    if(r.dueAt) ev.push({ at:at(r.dueAt), k:'due', n:n });
    if(r.settledAt) ev.push({ at:at(r.settledAt), k:'pay', n:n, mode:/card/i.test(r.payMode || '') ? 'card' : /upi|bank|gpay/i.test(r.payMode || '') ? 'upi' : 'cash' });
  });
  ev.sort(function(a, b){ return a.at - b.at; });
  return { ev:ev, bills:R.length, span:Math.round((tsMs(R[R.length - 1].settledAt || R[R.length - 1].createdAt) - base) / 60000) };
}
function simFreeTable(sp){
  var T = allTables(), taken = function(t){ return SIM.locks[t.id] || openOrder(t); };
  return T.filter(function(t){ return t.space === sp && !taken(t); })[0] || T.filter(function(t){ return !taken(t); })[0] || null;
}
async function simStep(){
  var now = Date.now();
  while(SIM.i < SIM.ev.length && SIM.ev[SIM.i].at <= now){
    var e = SIM.ev[SIM.i++], me = 'SIM · ' + e.by;
    try{
      if(e.k === 'open'){ var t = simFreeTable(e.sp); if(!t){ SIM.msg = 'no free table for a ' + e.sp + ' bill - skipped'; continue; }
        var id = 'S' + Date.now().toString(36).toUpperCase() + e.n, o = clean({ id:id, at:now, status:'accepted', log:[{ s:'placed', at:now }], source:'sim', mode:'dinein', kind:'dine', table:t.name, tableId:t.id, space:t.space, section:t.spaceName, pax:e.pax, by:me, byRole:'waiter', crew:'sim', day:bizDay(now),
          lines:e.lines.map(function(l){ return Object.assign({}, l, { at:now, by:me, rounds:[{ n:1, q:l.q, at:now, by:me }] }); }), kots:[{ n:1, kind:'kot', at:now, by:me, lines:e.lines.map(function(l){ return { k:l.k, name:l.name, label:l.label, q:l.q, station:station(l) }; }) }], kotN:1, edits:[], total:linesTotal(e.lines), discount:null, tip:0, trial:true, noKds:true });
        await S.F.setDoc(S.F.doc(S.D, 'trial_orders', id), o); await S.F.setDoc(S.F.doc(S.D, 'trial_tablelock', t.id), { oid:id, at:now, table:t.name });
        SIM.made[e.n] = { id:id, t:t.id }; SIM.locks[t.id] = id; SIM.msg = t.name + ' seated · ' + e.lines.length + ' dishes'; }
      var m = SIM.made[e.n]; if(!m || e.k === 'open') continue;
      var r0 = S.F.doc(S.D, 'trial_orders', m.id), cur = (await S.F.getDoc(r0)).data(); if(!cur) continue;
      if(e.k === 'add'){ var L = cur.lines.concat(e.lines.map(function(l){ return Object.assign({}, l, { at:now, by:me, rounds:[{ n:2, q:l.q, at:now, by:me }] }); }));
        await S.F.updateDoc(r0, clean({ lines:L, kots:cur.kots.concat([{ n:2, kind:'kot', at:now, by:me, lines:e.lines.map(function(l){ return { k:l.k, name:l.name, label:l.label, q:l.q, station:station(l) }; }) }]), kotN:2, total:linesTotal(L) })); SIM.msg = cur.table + ' add-on'; }
      if(e.k === 'due'){ await S.F.updateDoc(r0, { dueAt:now, dueCount:1 }); SIM.msg = cur.table + ' asked for the bill'; }
      if(e.k === 'pay'){ await S.F.updateDoc(r0, clean({ paid:true, payMode:e.mode, paidAt:now, paidBy:me, pays:[{ mode:e.mode, amt:cur.total }], status:'delivered', dueAt:cur.dueAt || now })); delete SIM.locks[m.t]; SIM.msg = cur.table + ' paid ' + rs(cur.total) + ' · ' + e.mode; }
    }catch(err){ SIM.msg = 'error: ' + (err.message || err); }
  }
  if(SIM.i >= SIM.ev.length){ clearInterval(SIM.tm); SIM.tm = null; SIM.msg = 'Replay finished ✓'; }
  var box = $('simStat'); if(box) box.innerHTML = simStatus();
}
function simStatus(){ if(!SIM.ev.length) return 'Not running.'; var nx = SIM.ev[SIM.i]; return '<b>' + SIM.i + ' / ' + SIM.ev.length + '</b> steps · ' + esc(SIM.msg || '') + (nx && SIM.tm ? '<br><small>next: ' + nx.k + ' in ' + Math.max(0, Math.round((nx.at - Date.now()) / 1000)) + ' s</small>' : ''); }
async function clearTrial(){
  var all = Object.values(S.orders), n = 0;
  for(var i = 0; i < all.length; i++){ try{ await S.F.deleteDoc(S.F.doc(S.D, 'trial_orders', all[i].id)); n++; }catch(e){} }
  var T = allTables(); for(var j = 0; j < T.length; j++){ try{ await S.F.setDoc(S.F.doc(S.D, 'trial_tablelock', T[j].id), { oid:null, at:Date.now() }); }catch(e){} }
  var C = Object.values(S.clean); for(var k = 0; k < C.length; k++){ try{ await S.F.deleteDoc(S.F.doc(S.D, 'trial_cleanreq', C[k].id)); }catch(e){} }
  return n;
}
function trialAdmin(){
  var y = new Date(Date.now() - BH0 * 3600e3); y.setDate(y.getDate() - 1); var yd = ymd(y), h = Math.max(11, new Date().getHours() - 1);
  var open = Object.values(S.orders).filter(function(o){ return !closed(o); }).length;
  return '<div class="card"><h2>Replay a real day · live</h2><p class="sub">Real VMENU dine-in bills played as captain orders into the <b>trial tables</b> (trial_orders). Phones in the captain app see tables fill, KOTs, bills and payments. VMENU and the owner app are never touched.</p>' +
    '<div class="adj"><label class="f" style="margin:0">Day<input id="smDay" type="date" value="' + yd + '"></label><label class="f" style="margin:0">From<select id="smH">' + [11,12,13,14,15,16,17,18,19,20,21,22].map(function(x){ return '<option value="' + x + '"' + (x === h ? ' selected' : '') + '>' + x + ':00</option>'; }).join('') + '</select></label>' +
    '<label class="f" style="margin:0">Bills<select id="smN">' + [8, 15, 25, 40].map(function(x){ return '<option' + (x === 15 ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label><label class="f" style="margin:0">Speed<select id="smS"><option value="1">real gaps</option><option value="5" selected>5× faster</option><option value="20">20× faster</option><option value="120">2 min total-ish</option></select></label></div>' +
    '<div class="row" style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-a="simgo" style="flex:2">▶ Start replay</button><button class="btn" data-a="simstop" style="flex:1">■ Stop</button></div><div id="simStat" class="note" style="margin-top:10px">' + simStatus() + '</div><p class="muted" style="font-size:12.5px">Keep this page open while it plays.</p></div>' +
    '<div class="card"><h2>Clear trial data</h2><p class="sub">' + Object.keys(S.orders).length + ' trial bills (' + open + ' open) · ' + Object.keys(S.clean).length + ' cleaning requests in the last 36 h.</p><button class="btn bad" data-a="simclear" style="width:100%">Delete all trial bills, locks and cleaning requests</button></div>';
}
/* ---------------- Setup → Usage: where people struggle ---------------- */
var UXV = { sess:null, busy:false, open:null, ev:{} };
async function uxLoad(){ if(UXV.busy) return; UXV.busy = true;
  try{ var since = Date.now() - 7 * 864e5, out = []; await new Promise(function(ok){ var off = S.F.onSnapshot(S.F.query(col('ux_sessions'), S.F.where('start', '>=', since)), function(sn){ sn.forEach(function(d){ out.push(d.data()); }); try{ off(); }catch(e){} ok(); }, function(){ ok(); }); });
    UXV.sess = out.sort(function(a, b){ return b.start - a.start; });
    for(var i = 0; i < Math.min(30, UXV.sess.length); i++) await uxEvents(UXV.sess[i].sid);
  }catch(e){ UXV.sess = []; } UXV.busy = false; render(); }
async function uxEvents(sid){ if(UXV.ev[sid]) return UXV.ev[sid]; var L = [];
  for(var n = 0; n < 200; n++){ var d = await S.F.getDoc(ref('ux_events', sid + '_' + String(n).padStart(4, '0'))); if(!d.exists()) break; L = L.concat(d.data().ev || []); }
  UXV.ev[sid] = L; return L; }
function med(a){ if(!a.length) return null; var b = a.slice().sort(function(x, y){ return x - y; }); return b[Math.floor(b.length / 2)]; }
function usageAdmin(){
  if(!UXV.sess){ uxLoad(); return '<div class="card"><h2>Usage</h2><p class="sub">Loading the last 7 days…</p></div>'; }
  var S2 = UXV.sess, E = [].concat.apply([], S2.map(function(s){ return (UXV.ev[s.sid] || []).map(function(e){ return Object.assign({ sid:s.sid, who:s.who }, e); }); }));
  var taps = E.filter(function(e){ return e.e === 'tap'; }), dead = E.filter(function(e){ return e.e === 'dead'; }), rage = E.filter(function(e){ return e.e === 'rage'; }), errs = E.filter(function(e){ return e.e === 'err'; });
  var adds = E.filter(function(e){ return e.e === 'add'; }), undo = E.filter(function(e){ return e.e === 'undo'; }), kots = E.filter(function(e){ return e.e === 'kot'; }), pays = E.filter(function(e){ return e.e === 'pay'; }), qs = E.filter(function(e){ return e.e === 'search'; });
  var by = {}; adds.forEach(function(a){ by[a.via || '?'] = (by[a.via || '?'] || 0) + 1; });
  var zero = {}; qs.filter(function(q){ !q.n && (zero[q.q] = (zero[q.q] || 0) + 1); return 0; });
  var tK = med(kots.map(function(k){ return k.ms || 0; }).filter(Boolean)), tP = med(pays.map(function(k){ return k.ms || 0; }).filter(Boolean));
  var pct = function(a, b){ return b ? Math.round(100 * a / b) + '%' : '—'; };
  var errTop = {}; errs.forEach(function(e){ errTop[e.m] = (errTop[e.m] || 0) + 1; });
  var deadSpots = {}; dead.forEach(function(d){ var k = d.v + ' · ' + (d.txt || '(empty)'); deadSpots[k] = (deadSpots[k] || 0) + 1; });
  var top = function(o, n){ return Object.keys(o).sort(function(a, b){ return o[b] - o[a]; }).slice(0, n || 6); };
  var dl = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ sessions:S2, events:UXV.ev }));
  return '<div class="card"><h2>Usage · last 7 days</h2><p class="sub">' + S2.length + ' sessions · ' + [].concat(S2.map(function(s){ return s.who; })).filter(function(v, i, a){ return a.indexOf(v) === i; }).length + ' people · ' + E.length + ' events</p>' +
    '<div class="sum" style="grid-template-columns:repeat(3,1fr)"><div><small>Order → KOT</small><b>' + (tK ? Math.round(tK / 1000) + 's' : '—') + '</b></div><div><small>Pay sheet</small><b>' + (tP ? Math.round(tP / 1000) + 's' : '—') + '</b></div><div><small>Taps / dish</small><b>' + (adds.length ? (taps.length / adds.length).toFixed(1) : '—') + '</b></div>' +
    '<div><small>Dead taps</small><b>' + pct(dead.length, taps.length + dead.length) + '</b></div><div><small>Rage taps</small><b>' + rage.length + '</b></div><div><small>Undo</small><b>' + pct(undo.length, adds.length) + '</b></div></div>' +
    '<table class="tbl"><tr><th>Dishes added by</th><th class="r">n</th></tr>' + top(by, 8).map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="r">' + by[k] + ' · ' + pct(by[k], adds.length) + '</td></tr>'; }).join('') + '</table>' +
    (top(zero).length ? '<h3 class="sec-t">Searches with no result</h3><p>' + top(zero, 12).map(function(k){ return '<span class="badge2 b-urg" style="margin:2px">' + esc(k) + ' ×' + zero[k] + '</span>'; }).join(' ') + '</p>' : '') +
    (top(errTop).length ? '<h3 class="sec-t">Errors people saw</h3><table class="tbl">' + top(errTop).map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="r">' + errTop[k] + '</td></tr>'; }).join('') + '</table>' : '') +
    (top(deadSpots).length ? '<h3 class="sec-t">Taps that hit nothing</h3><table class="tbl">' + top(deadSpots).map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="r">' + deadSpots[k] + '</td></tr>'; }).join('') + '</table>' : '') +
    '<a class="btn" style="width:100%;margin-top:10px;text-decoration:none" download="hayat-usage.json" href="' + dl + '">⬇ Download all of it (for Claude to study)</a></div>' +
    '<div class="card"><h2>Sessions · step by step</h2><div class="list">' + S2.slice(0, 30).map(function(s){ var L = UXV.ev[s.sid] || [], dur = L.length ? Math.round(L[L.length - 1].t / 60000) : 0;
      return '<button class="li" data-a="uxopen" data-id="' + esc(s.sid) + '"><span class="tico">' + esc(initials(s.who)) + '</span><span class="n">' + esc(s.who) + ' · ' + esc(ROLES[s.role] || s.role || '') + '<small>' + new Date(s.start).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) + ' · ' + dur + ' min · ' + L.length + ' events · ' + s.w + '×' + s.h + (s.standalone ? ' · app' : ' · browser') + '</small></span><span class="v">›</span></button>' +
        (UXV.open === s.sid ? '<div class="uxline">' + L.map(function(e){ return '<div><i>' + (e.t / 1000).toFixed(1) + 's</i> <b>' + esc(e.e) + '</b> ' + esc([e.a, e.id, e.txt, e.q, e.via, e.m, e.n != null ? 'n=' + e.n : '', e.ms ? Math.round(e.ms / 1000) + 's' : ''].filter(Boolean).join(' · ')) + (e.tb ? ' <small>' + esc(e.tb) + '</small>' : '') + '</div>'; }).join('') + '</div>' : ''); }).join('') + '</div></div>';
}

/* ---------------- KOT options: note, kitchens, hold & fire, what the waiter brings ----------------
   Kept with the draft (survives a refresh). Kitchens are picked from the dishes automatically;
   the waiter can switch one off/on. NO-KOT dishes (bottled drinks) are listed as "You bring". */
var KFLAGS = [['urgent','⚡ Urgent'],['norush','🐢 No rush'],['hot','🔥 Serve hot'],['starters','🥗 Starters first'],['together','🍽️ Serve together'],['parcel','🛍️ Parcel'],['hold','⏸ Hold · fire later']];
function kopt(tid){ var d = S.draft[tid] = S.draft[tid] || { lines:[] }; return d.kopt = d.kopt || { flags:[], note:'', off:[] }; }
function kotSplit(lines){ var by = {}, self = []; lines.forEach(function(l){ var st = station(l); if(st === 'none') self.push(l); else (by[st] = by[st] || []).push(l); }); return { by:by, self:self }; }
function kotNoteText(ko){ return KFLAGS.filter(function(f){ return ko.flags.indexOf(f[0]) >= 0 && f[0] !== 'hold'; }).map(function(f){ return f[1].replace(/^\S+\s/, ''); }).concat(ko.note ? [ko.note] : []).join(' · '); }
function kotSheet(t){
  var D = draftOf(t.id); if(!D.length) return; var ko = kopt(t.id), sp = kotSplit(D);
  var first = true, put = function(html){ if(first || !$('koBody')){ sheet('<div id="koBody">' + html + '</div>'); first = false; } else $('koBody').innerHTML = html; };   /* update in place: no re-animation, no flicker */
  var draw = function(){
    put('<h2>KOT for ' + esc(t.name) + '</h2><p class="sub">' + draftCount(t.id) + ' items · note and kitchens are optional</p>' +
      '<div class="sec-t">Note for the kitchen</div><div class="quick kf">' + KFLAGS.map(function(f){ return '<button class="' + (ko.flags.indexOf(f[0]) >= 0 ? 'on' : '') + '" data-kf="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<input id="koNote" placeholder="Type anything else… (birthday, allergy, VIP)" value="' + esc(ko.note) + '" autocomplete="off" style="margin-top:6px">' +
      '<div class="sec-t">Kitchens · picked from the dishes</div><div class="kchips">' + Object.keys(sp.by).map(function(k){ var on = ko.off.indexOf(k) < 0; return '<button class="kc' + (on ? ' on' : '') + '" data-kk="' + esc(k) + '"><b>' + (on ? '✓ ' : '') + esc(kname(k)) + '</b><small>' + sp.by[k].map(function(l){ return l.q + '× ' + esc(l.name) + (l.label ? ' ' + esc(short(l.label)) : ''); }).join(', ') + '</small></button>'; }).join('') + '</div>' +
      (sp.self.length ? '<div class="selfb"><b>🥤 You bring</b> (no kitchen ticket): ' + sp.self.map(function(l){ return l.q + '× ' + esc(l.name) + (l.label ? ' ' + esc(short(l.label)) : ''); }).join(', ') + '</div>' : '') +
      '<button class="btn pri" id="koGo" style="width:100%;margin-top:12px">' + (ko.flags.indexOf('hold') >= 0 ? '⏸ Send on hold · ' : 'Send KOT · ') + draftCount(t.id) + '</button>');
    document.querySelectorAll('[data-kf]').forEach(function(b){ b.onclick = function(){ var f = b.dataset.kf, i = ko.flags.indexOf(f); if(i >= 0) ko.flags.splice(i, 1); else { ko.flags.push(f); if(f === 'urgent'){ var j = ko.flags.indexOf('norush'); if(j >= 0) ko.flags.splice(j, 1); } if(f === 'norush'){ var j2 = ko.flags.indexOf('urgent'); if(j2 >= 0) ko.flags.splice(j2, 1); } } ko.note = $('koNote').value; saveDraft(); vib(6); draw(); }; });
    document.querySelectorAll('[data-kk]').forEach(function(b){ b.onclick = function(){ var k = b.dataset.kk, i = ko.off.indexOf(k); if(i >= 0) ko.off.splice(i, 1); else ko.off.push(k); ko.note = $('koNote').value; saveDraft(); draw(); }; });
    $('koNote').oninput = function(){ ko.note = this.value; saveDraft(); };
    $('koGo').onclick = function(){ ko.note = $('koNote').value.trim(); saveDraft(); closeSheet(); sendKot(t.id); };
  };
  draw();
}
async function fireKot(oid, n){
  var now = Date.now(), L = [], o;
  try{ o = await txOrder(oid, function(cur){ var ks = (cur.kots || []).map(function(k){ if(k.kind === 'kot' && String(k.n) === String(n) && k.hold && !k.fireAt){ L = k.lines || []; return Object.assign({}, k, { fireAt:now, fireBy:who() }); } return k; }); return { kots:ks }; }); }
  catch(e){ fail('Not fired', e); return; }
  S.orders[oid] = o; ux('fire', { n:n });
  var full = L.map(function(l){ var src = (o.lines || []).filter(function(z){ return z.k === l.k; })[0] || {}; return Object.assign({}, src, l); });
  var p = await printKot(Object.assign({}, o, { note:'FIRE NOW' }), full, n, false);
  toast('🔥 KOT ' + n + ' fired', 'good', p ? 'printing in the kitchen' : 'the kitchen screen shows it now'); render();
}

/* ---------------- 🚫 out of stock today (hold a dish → toggle) ---------------- */
var STOCK = { day:'', off:{} };
function oos(id){ return STOCK.day === bizDay() && !!(STOCK.off || {})[id]; }
async function toggleStock(x){
  var off = STOCK.day === bizDay() ? Object.assign({}, STOCK.off) : {}; if(off[x.id]) delete off[x.id]; else off[x.id] = { by:who(), at:Date.now(), name:x.name };
  try{ await S.F.setDoc(ref('settings', 'stock'), { day:bizDay(), off:off }); STOCK = { day:bizDay(), off:off }; toast(off[x.id] ? '🚫 ' + esc(x.name) + ' out of stock today' : '✓ ' + esc(x.name) + ' back on', off[x.id] ? 'bad' : 'good', 'every phone sees it now'); ux('stock', { id:x.id, off:!!off[x.id] }); }catch(e){ fail('Not saved', e); }
  orderRefresh();
}

/* ---------------- what the kitchens say (kitchen screen states) ----------------
   kds/{screen_inv_round} = ready (doneAt), kds_state/{same id} = seen (acceptAt) / cooking (prepAt).
   Round = the KOT minute, inv = "w" + order id. The waiter who owns the table hears "ready". */
var KDS = { done:{}, st:{}, seen:null };
function kround(at){ return String(Math.round((at || 0) / 60000)); }
function kotState(o, k){
  var inv = 'w' + o.id, r = kround(k.fireAt || k.at), r2 = kround(k.at), hits = [];
  [KDS.done, KDS.st].forEach(function(M, j){ Object.keys(M).forEach(function(id){ var d = M[id]; if(String(d.inv) !== inv) return; var rp = String(d.round).split('r'), mn = rp[0], rn = rp[1];
    if(rn != null ? String(rn) === String(k.n) : (mn === r || mn === r2)) hits.push(Object.assign({ id:id, kind:j ? 'st' : 'done' }, d)); }); });
  if(!hits.length) return null;
  var screens = {}; hits.forEach(function(h){ var s = screens[h.screen] = screens[h.screen] || {}; if(h.kind === 'done') s.done = h; else s.st = h; });
  var L = Object.keys(screens), done = L.filter(function(s){ return screens[s].done; }).length, prep = L.filter(function(s){ return !screens[s].done && screens[s].st && screens[s].st.prepAt; }), acc = L.filter(function(s){ return !screens[s].done && screens[s].st && screens[s].st.acceptAt && !screens[s].st.prepAt; });
  if(done === L.length) return { s:'ready', txt:'✅ ready' };
  if(prep.length) return { s:'cooking', txt:'🍳 cooking ' + ago(screens[prep[0]].st.prepAt) + (done ? ' · ' + done + ' ready' : '') };
  if(acc.length) return { s:'seen', txt:'👀 kitchen saw it' + (done ? ' · ' + done + ' ready' : '') };
  return { s:'?', txt:'' };
}
function kdsWatch(){
  var since = Date.now() - 14 * 3600e3, F = S.F;
  F.onSnapshot(F.query(col('kds'), F.where('doneAt', '>=', new Date(since))), function(sn){
    var fresh = []; sn.forEach(function(d){ var x = d.data(); if(!KDS.done[d.id] && KDS.seen) fresh.push(Object.assign({ id:d.id }, x)); KDS.done[d.id] = x; });
    KDS.seen = true;
    fresh.forEach(function(x){ var o = Object.values(S.orders).filter(function(z){ return 'w' + z.id === String(x.inv); })[0]; if(!o || closed(o)) return;
      if(S.me && (o.crew === S.me.id || S.me.role === 'office' || S.me.role === 'runner')){ beep(); vib([60, 40, 60]); toast('🍽️ ' + esc(o.table || '') + ' · ready to serve', 'good', esc(x.screen || 'kitchen') + ' · ' + esc((x.items || []).slice(0, 3).join(', '))); ux('ready', { tb:o.tableId, screen:x.screen }); } });
    softRender(); }, function(){});
  F.onSnapshot(F.query(col('kds_state'), F.where('at', '>=', since)), function(sn){ sn.forEach(function(d){ KDS.st[d.id] = d.data(); }); softRender(); }, function(){});
  F.onSnapshot(ref('settings', 'stock'), function(d){ STOCK = d.exists() ? d.data() : { day:'', off:{} }; softRender(); }, function(){});
}

/* ============================================================
   EVENTS
   ============================================================ */
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-a]'); if(!el) return;

  var a = el.dataset.a, t = curTable();
  if(a === 'pick'){ S.pinFor = S.people.filter(function(p){ return p.id === el.dataset.id; })[0]; S.pin = ''; render(); return; }
  if(a === 'pinx'){ e.preventDefault(); S.pinFor = null; S.pin = ''; render(); return; }
  if(a === 'pin'){ pinKey(el.dataset.k); return; }
  if(a === 'rolef'){ S.roleF = el.dataset.r; render(); return; }
  if(a === 'me'){ meSheet(); return; }
  if(a === 'nav'){ var leaving = S.view === 'order'; S.view = el.dataset.v; S.q = ''; if(leaving && history.state && history.state.cap === 'order'){ HIST.skip++; history.back(); } window.scrollTo(0, 0); render(); return; }
  if(a === 'space'){ S.space = el.dataset.s; render(); return; }
  if(a === 'sppick'){ S.pickSp = (mySpaces() || []).slice(); S.view = 'spaces'; render(); return; }
  if(a === 'sptog'){ S.pickSp = S.pickSp || (mySpaces() || []).slice(); var si = S.pickSp.indexOf(el.dataset.s); if(si >= 0) S.pickSp.splice(si, 1); else S.pickSp.push(el.dataset.s); vib(6); render(); return; }
  if(a === 'spall'){ setMySpaces(floor().spaces.map(function(z){ return z.id; })); S.pickSp = null; S.space = 'all'; S.view = 'floor'; render(); return; }
  if(a === 'spgo'){ if(!(S.pickSp || []).length) return; setMySpaces(S.pickSp); S.pickSp = null; S.space = 'mine'; S.view = 'floor'; render(); return; }
  if(a === 'cstep'){ stepCat(+el.dataset.d); return; }
  if(a === 'kopt' && t){ closeSheet(); kotSheet(t); return; }
  if(a === 'fire' && t){ var of = openOrder(t); if(of) fireKot(of.id, el.dataset.n); return; }
  if(a === 'oos'){ var xo = BYID[el.dataset.id]; toast('🚫 ' + esc(xo ? xo.name : 'This dish') + ' is out of stock today', 'bad', 'hold it to put it back on'); return; }
  if(a === 'cgrid'){ catGrid(); return; }
  if(a === 'mine'){ S.mine = !S.mine; render(); return; }
  if(a === 'table'){ var tid = el.dataset.t; if(S.me.role === 'cleaner'){ var c = openClean(tableById(tid)); if(c) cleanStep(c.id, c.status === 'open' ? 'taken' : 'done'); else toast('Nothing to clean at ' + esc(tableById(tid).name)); return; }
    S.table = tid; S.view = 'order'; S.q = ''; S.cat = ''; if(S.omodes) delete S.omodes[tid]; pushHist('order'); window.scrollTo(0, 0); render();
    var tt = tableById(tid); if(tt && !openOrder(tt) && !draftCount(tid) && !(S.draft[tid] && S.draft[tid].pax)) guestSheet(tt);   /* seat them: one tap for how many */
    return; }
  if(a === 'cat'){ S.cat = el.dataset.c; orderRefresh(); window.scrollTo(0, 0); return; }
  if(a === 'omode' && t){ var mm = el.dataset.m; setMode(t, mm === 'search' ? 'menu' : mm); if(mm === 'bill'){ S.q = ''; } render(); window.scrollTo(0, 0); if(mm === 'search'){ var qi = $('q'); if(qi) qi.focus(); } return; }
  if(a === 'add' && t){ var x = BYID[el.dataset.id]; if(!x) return; addAndSnack(t, x, +el.dataset.i, 1, el.closest('#sres') ? 'search' : el.closest('#scrim') ? 'sheet' : 'quick:' + (S.cat || 'now')); orderRefresh(); return; }
  if(a === 'sug' && t){ var xs = BYID[el.dataset.id]; if(!xs) return; addAndSnack(t, xs, +el.dataset.i, +el.dataset.q || 1, 'suggest:' + (el.className.replace('sug', '').trim() || 'pair')); closeSheet(); setMode(t, 'menu'); orderRefresh(); return; }
  if(a === 'rep' && t){ ux('add', { via:'repeat', n:el.dataset.n }); var o4 = openOrder(t), kk = o4 && (o4.kots || []).filter(function(z){ return z.kind === 'kot' && String(z.n) === el.dataset.n; })[0]; if(!kk) return;
    var n0 = 0; kk.lines.forEach(function(l){ var src = (o4.lines || []).filter(function(z){ return z.k === l.k; })[0], id0 = (src && src.id) || l.k.split('|')[0], xm = BYID[id0];
      if(!src && xm){ var cm = xm.ch.filter(function(c){ return c.label === (l.label || ''); })[0]; if(cm) src = { id:id0, label:cm.label, price:cm.price, vn:cm.vn, kit:cm.kit || xm.kit }; }
      if(!src || !(src.price > 0)) return; var xx = xm || { id:id0, name:l.name, kit:src.kit };
      var d = S.draft[t.id] = S.draft[t.id] || { lines:[] }; if(!d.at) d.at = Date.now(); var ex = d.lines.filter(function(z){ return z.k === l.k; })[0]; if(ex) ex.q += l.q; else d.lines.push(clean({ k:l.k, id:xx.id, name:l.name, label:src.label || l.label || '', price:src.price || 0, q:l.q, vn:src.vn, kit:src.kit })); n0 += l.q; });
    saveDraft(); setMode(t, 'menu'); snack('↻ ' + n0 + ' items from KOT ' + kk.n + ' added · not sent yet', function(){ kk.lines.forEach(function(l){ stepDraft(t.id, l.k, -l.q); }); orderRefresh(); }); render(); return; }
  if(a === 'qclr'){ S.q = ''; var qq = $('q'); if(qq){ qq.value = ''; qq.focus(); } orderRefresh(); return; }
  if(a === 'dq' && t){ stepDraft(t.id, el.dataset.k, +el.dataset.d); if($('scrim') && S.refresh) S.refresh(); orderRefresh(); return; }
  if(a === 'dclear' && t){ delete S.draft[t.id]; saveDraft(); closeSheet(); render(); return; }
  if(a === 'note' && t){ noteSheet(el.dataset.k); return; }
  if(a === 'void' && t){ voidSheet(el.dataset.k); return; }
  if(a === 'kot' && t){ closeSheet(); sendKot(t.id); return; }
  if(a === 'due' && t){ var o = openOrder(t); closeSheet(); if(o) dueBill(o.id); return; }
  if(a === 'pay' && t){ var o2 = openOrder(t); closeSheet(); if(o2) paySheet(o2.id); return; }
  if(a === 'billsheet'){ billSheet(); return; }
  if(a === 'pax' && t){ var o3 = openOrder(t); var cur = (o3 && o3.pax) || (S.draft[t.id] && S.draft[t.id].pax) || 0; setPax(t.id, (cur || (+el.dataset.d > 0 ? 0 : 2)) + (+el.dataset.d)); return; }
  if(a === 'tmenu'){ tableMenu(); return; }
  if(a === 'btab'){ S.billsTab = el.dataset.t; render(); return; }
  if(a === 'openo'){ var oo = S.orders[el.dataset.id]; if(!oo) return; closeSheet(); if(oo.mode === 'dinein' && !closed(oo) && oo.tableId && tableById(oo.tableId)){ S.table = oo.tableId; S.view = 'order'; render(); } else paySheet(oo.id); return; }
  if(a === 'ctake'){ cleanStep(el.dataset.id, 'taken'); return; }
  if(a === 'cdone'){ cleanStep(el.dataset.id, 'done'); return; }
  if(a === 'atab'){ S.adminTab = el.dataset.t; S.floorEdit = null; S.posEdit = null; S.adminDirty = false; render(); return; }
  if(a === 'padd'){ addPerson(); return; }
  if(a === 'pedit'){ personSheet(el.dataset.id); return; }
  if(a === 'supi'){ saveCfg({ upi:$('sVpa').value.trim(), upiName:$('sPn').value.trim() }); return; }
  if(a === 'cfgt'){ var k = el.dataset.k, d = el.dataset.d === '1', p = {}; p[k] = !(cfg(k, d) !== false); saveCfg(p); return; }
  /* tables editor */
  var F = S.floorEdit, xs = (el.dataset.x || '').split(':');
  if(a === 'fseat'){ F.spaces[+xs[0]].tables[+xs[1]].seats = +xs[2]; render(); return; }
  if(a === 'fshape'){ F.spaces[+xs[0]].tables[+xs[1]].shape = xs[2]; render(); return; }
  if(a === 'frot'){ var tt = F.spaces[+xs[0]].tables[+xs[1]]; tt.rot = tt.rot ? 0 : 1; render(); return; }
  if(a === 'ftdel'){ F.spaces[+xs[0]].tables.splice(+xs[1], 1); render(); return; }
  if(a === 'ftadd'){ var sp = F.spaces[+el.dataset.si], last = (sp.tables || []).slice(-1)[0], pre = last ? String(last.name).replace(/\d+$/, '') : sp.name.slice(0, 1).toUpperCase(), num = (sp.tables || []).reduce(function(n, z){ var m = String(z.name).match(/(\d+)$/); return Math.max(n, m ? +m[1] : 0); }, 0) + 1;
    (sp.tables = sp.tables || []).push({ id:sp.id + '-' + Date.now().toString(36), name:pre + num, seats:last ? last.seats : 4, shape:last ? last.shape : 'square', rot:0 }); render(); return; }
  if(a === 'fsadd'){ F.spaces.push({ id:'sp' + Date.now().toString(36), name:'New space', tables:[] }); render(); return; }
  if(a === 'fsdel'){ var si = +el.dataset.si; if((F.spaces[si].tables || []).length && !confirm('Delete ' + F.spaces[si].name + ' and its ' + F.spaces[si].tables.length + ' tables?')) return; F.spaces.splice(si, 1); render(); return; }
  if(a === 'fsave'){ saveFloor(); return; }
  if(a === 'simgo'){ if(SIM.tm){ toast('Already playing'); return; } var dy = $('smDay').value, fh = +$('smH').value, nn = +$('smN').value, spd = +$('smS').value; el.disabled = true; el.textContent = 'Loading the day…';
    simPrepare(dy, fh, nn, spd).then(function(P){ SIM.ev = P.ev; SIM.i = 0; SIM.made = {}; SIM.locks = {}; SIM.msg = P.bills + ' bills · about ' + Math.max(1, Math.round(P.span / spd)) + ' min'; SIM.tm = setInterval(simStep, 1000); toast('Replay started · ' + P.bills + ' bills', 'good'); render(); }).catch(function(e){ fail('Could not start', e); render(); }); return; }
  if(a === 'simstop'){ if(SIM.tm){ clearInterval(SIM.tm); SIM.tm = null; SIM.msg = 'Stopped'; } render(); return; }
  if(a === 'simclear'){ if(!confirm('Delete every TRIAL bill, lock and cleaning request? Real VMENU data is not touched.')) return; if(SIM.tm){ clearInterval(SIM.tm); SIM.tm = null; } clearTrial().then(function(n){ toast('Cleared ' + n + ' trial bills', 'good'); render(); }); return; }
  if(a === 'uxopen'){ UXV.open = UXV.open === el.dataset.id ? null : el.dataset.id; render(); return; }
  if(a === 'msrc'){ saveCfg({ menuSrc:el.dataset.v }).then(function(){ if(el.dataset.v === 'web') loadMenu(); else usePos(); render(); }); return; }
  if(a === 'mrebuild'){ el.disabled = true; el.textContent = 'Learning… (reads 7 days of bills)'; buildPosMenu().then(function(b){ if(b.fams.length >= 10){ POSM = b; usePos(); toast('Learned ' + b.fams.length + ' dishes from ' + b.bills + ' bills', 'good'); } else toast('Too few VMENU bills found', 'bad'); render(); }).catch(function(e){ fail('Could not learn', e); render(); }); return; }
  if(a === 'mhide'){ var E = S.posEdit; E.hide[el.dataset.id] = !E.hide[el.dataset.id]; if(!E.hide[el.dataset.id]) delete E.hide[el.dataset.id]; S.adminDirty = true; render(); return; }
  if(a === 'msave'){ var E2 = S.posEdit, B = S.posBase || {}, er = ref('settings', 'pos_edits');
    S.F.runTransaction(S.D, async function(tx){ var sn = await tx.get(er), cur = sn.exists() ? sn.data() : {}, nx = { price:Object.assign({}, cur.price || {}), hide:Object.assign({}, cur.hide || {}), add:(cur.add || []).slice() };
      /* only what THIS phone changed since it opened the page goes over the latest copy */
      var keys = {}; Object.keys(E2.price || {}).concat(Object.keys(B.price || {})).forEach(function(k){ keys[k] = 1; });
      Object.keys(keys).forEach(function(k){ var a1 = (E2.price || {})[k], b1 = (B.price || {})[k]; if(a1 === b1) return; if(a1 == null) delete nx.price[k]; else nx.price[k] = a1; });
      var hk = {}; Object.keys(E2.hide || {}).concat(Object.keys(B.hide || {})).forEach(function(k){ hk[k] = 1; });
      Object.keys(hk).forEach(function(k){ var a2 = !!(E2.hide || {})[k], b2 = !!(B.hide || {})[k]; if(a2 === b2) return; if(a2) nx.hide[k] = true; else delete nx.hide[k]; });
      (E2.add || []).forEach(function(x){ if(!nx.add.some(function(z){ return z.id === x.id; })) nx.add.push(x); });
      nx.at = Date.now(); nx.by = who(); tx.set(er, clean(nx)); return nx; })
    .then(function(nx){ POSE = nx; S.posEdit = null; S.posBase = null; S.adminDirty = false; usePos(); toast('Menu saved ✓', 'good'); render(); }).catch(function(e){ fail('Not saved', e); }); return; }
  if(a === 'madd'){ var nm = $('maName').value.trim(), raw = $('maCh').value.trim(); if(!nm || !raw){ toast('Name and price please', 'bad'); return; }
    var ch = raw.split(',').map(function(z){ var m = z.trim().match(/^(.*?)\s*(\d+)$/); return m ? { label:titleCase(m[1].trim()), price:+m[2] } : null; }).filter(Boolean); if(!ch.length){ toast('Write it like: Qtr 210, Half 380', 'bad'); return; }
    var E3 = S.posEdit; E3.add.push({ id:'m-' + slug(nm) + '-' + Date.now().toString(36).slice(-3), name:nm, cat:$('maCat').value, kit:'', q:0, ch:ch }); S.adminDirty = true; toast('Added · tap Save menu changes', ''); render(); return; }
});
document.addEventListener('input', function(e){
  var el = e.target;
  if(el.id === 'q'){ S.q = el.value; var t = curTable(), d = $('dock'); if(t && d){ var old = $('sres'), tmp = document.createElement('div'); tmp.innerHTML = sresHtml(t); var nw = tmp.firstChild; if(old && nw) old.replaceWith(nw); else if(old) old.remove(); else if(nw) d.insertBefore(nw, d.firstChild); }
    var sb = el.parentNode, cx = sb.querySelector('.qx2'); if(S.q && !cx){ sb.insertAdjacentHTML('beforeend', '<button class="qx2" data-a="qclr" aria-label="clear">✕</button>'); } else if(!S.q && cx) cx.remove(); dockSize(); saveUI(); uxQuery(); return; }
  if(S.view === 'admin') S.adminDirty = true;
  if(el.id === 'mq'){ S.mq = el.value; var c = el.selectionStart; render(); var m = $('mq'); if(m){ m.focus(); try{ m.setSelectionRange(c, c); }catch(x){} } return; }
  if(el.dataset.mp != null && S.posEdit){ var v = el.value.replace(/\D/g, ''); if(v === '') delete S.posEdit.price[el.dataset.mp]; else S.posEdit.price[el.dataset.mp] = +v; return; }
  if(el.dataset.fs != null && S.floorEdit){ S.floorEdit.spaces[+el.dataset.fs].name = el.value; return; }
  if(el.dataset.ft != null && S.floorEdit){ var p = el.dataset.ft.split(':'); S.floorEdit.spaces[+p[0]].tables[+p[1]].name = el.value; return; }
});
/* tapping a result must not take the focus off the search box (the keyboard would drop and the dock jump) */
['pointerdown', 'mousedown'].forEach(function(ev){ document.addEventListener(ev, function(e){ if(e.target.closest('#sres, #snack') && document.activeElement && document.activeElement.id === 'q') e.preventDefault(); }); });
document.addEventListener('focusin', function(e){ if(e.target.id === 'q'){ document.body.classList.add('typing'); dockSize(); } });
document.addEventListener('focusout', function(e){ if(e.target.id === 'q') setTimeout(function(){ if(document.activeElement && document.activeElement.id === 'q') return; document.body.classList.remove('typing'); dockSize(); }, 120); });
document.addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target.id === 'q'){ e.preventDefault(); var b = S.best, t = curTable(); if(!b || !t) return;
  if(b.chs.length === 1 || b.x.ch.length === 1){ addAndSnack(t, b.x, b.chs[0] || 0, 1, 'enter'); S.q = ''; var q = $('q'); if(q){ q.value = ''; q.focus(); } orderRefresh(); } else toast('Pick a size for ' + esc(b.x.name), '', b.x.ch.map(function(c){ return short(c.label); }).join(' · ')); } });

async function saveCfg(p){
  var next = Object.assign({}, S.cfg, p);
  try{ await S.F.setDoc(ref('settings', 'captain'), clean(next), { merge:true }); S.cfg = next; S.adminDirty = false; toast('Saved', 'good'); }catch(e){ toast('Not saved', 'bad', esc(e.message || e)); }
  render();
}
async function saveFloor(){
  var F = S.floorEdit; if(!F) return;
  var names = {}, dup = null;
  F.spaces.forEach(function(sp){ (sp.tables || []).forEach(function(t){ var k = norm(t.name); if(names[k]) dup = t.name; names[k] = 1; }); });
  if(dup){ toast('Two tables are called ' + esc(dup), 'bad', 'give each table its own name'); return; }
  F.spaces.forEach(function(sp){ sp.name = String(sp.name || '').trim() || 'Space'; if(!sp.id) sp.id = 'sp' + Date.now().toString(36); });
  try{ await S.F.setDoc(ref('settings', 'floor'), clean({ v:1, spaces:F.spaces, at:Date.now(), by:who() })); S.floor = clean(F); S.floorEdit = null; S.adminDirty = false; toast('Tables saved ✓', 'good'); }catch(e){ toast('Not saved', 'bad', esc(e.message || e)); }
  render();
}

/* ============================================================
   BOOT
   ============================================================ */
var INSTALL = null;
addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); INSTALL = e; });
addEventListener('online', function(){ S.online = true; render(); });
addEventListener('offline', function(){ S.online = false; render(); });
(function(){ var th = lsGet('hayat-cap-theme', ''); if(th) document.documentElement.dataset.theme = th; })();
setInterval(function(){ if(S.me && !document.querySelector('input:focus') && S.view !== 'admin') render(); }, 30000);   /* the "32m" clocks move */

var CLEAN_SEEN = null;
function onClean(){
  var open = Object.values(S.clean).filter(function(c){ return c.status === 'open'; });
  if(CLEAN_SEEN){
    var fresh = open.filter(function(c){ return !CLEAN_SEEN[c.id]; });
    if(fresh.length && S.me && (S.me.role === 'cleaner' || S.view === 'clean')){
      var u = fresh.some(function(c){ return c.urgency === 'urgent'; });
      beep(u ? 'urgent' : ''); vib(u ? [200, 100, 200, 100, 200] : [120, 60, 120]);
      fresh.slice(0, 3).forEach(function(c){ toast('🧹 ' + esc(c.table) + ' · ' + esc(kindName(c.kind)), 'clean', (c.urgency === 'urgent' ? 'URGENT · ' : '') + 'from ' + esc(c.by) + (c.note ? ' · “' + esc(c.note) + '”' : '')); });
      try{ if(document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Clean ' + fresh[0].table, { body:kindName(fresh[0].kind), tag:'clean' }); }catch(e){}
    }
  }
  CLEAN_SEEN = {}; Object.values(S.clean).forEach(function(c){ CLEAN_SEEN[c.id] = 1; });
}

async function boot(){
  try{ S.ctx = await window.HayatAuth.start({ cache:true }); }
  catch(e){ $('app').innerHTML = '<div class="login"><div class="card"><h2>Cannot connect</h2><p class="sub">' + esc(e.message || e) + '</p></div></div>'; return; }
  S.F = S.ctx.fs; S.D = S.ctx.db;
  var F = S.F, since = Date.now() - 20 * 3600e3;
  /* resume only someone who signed in HERE on this phone - an office sign-in from the website must not open the captain app as Majid */
  var mine = lsGet('hayat-cap-me', null);
  if(S.ctx.crewId && APP_ROLES.indexOf(S.ctx.role) >= 0 && ((mine && mine.id === S.ctx.crewId) || (SETUP && S.ctx.role === 'office'))) S.me = { id:S.ctx.crewId, name:S.ctx.name || S.ctx.crewId, role:S.ctx.role };
  if(S.me && SETUP){ if(S.me.role !== 'office') S.me = null; else S.view = 'admin'; }
  else if(S.me){ S.view = S.me.role === 'cleaner' ? 'clean' : (mySpaces() || S.me.role === 'office' ? 'floor' : 'spaces'); S.space = mySpaces() ? 'mine' : 'all'; restoreUI(); }
  var bad = function(what){ return function(err){ console.warn(what, err); }; };
  F.onSnapshot(ref('crew', '_list'), function(d){ S.people = (d.exists() && d.data().people) || []; if(!S.me) render(); }, bad('crew'));
  F.onSnapshot(ref('settings', 'floor'), function(d){ S.floor = d.exists() ? d.data() : null; softRender(); }, bad('floor'));
  F.onSnapshot(ref('settings', 'captain'), function(d){ var was = cfg('menuSrc', 'pos'), wasT = isTrial(); S.cfg = d.exists() ? d.data() : {}; if(isTrial() !== wasT && S.relisten) S.relisten(); if(cfg('menuSrc', 'pos') !== was){ if(cfg('menuSrc', 'pos') === 'web') loadMenu().then(softRender); else usePos(); } softRender(); }, bad('captain'));
  F.onSnapshot(ref('settings', 'print'), function(d){ S.print = d.exists() ? d.data() : {}; }, bad('print'));
  var subs = [];
  var listen = function(){ subs.forEach(function(u){ try{ u(); }catch(e){} }); subs = []; since = Date.now() - 36 * 3600e3;
  subs.push(F.onSnapshot(F.query(col(C_('orders')), F.where('at', '>=', since)), function(snap){
    var o = {}; snap.forEach(function(d){ o[d.id] = Object.assign({ id:d.id }, d.data()); }); S.orders = o; softRender();
    if(!S.payBack){ S.payBack = true; var pk = lsGet('hayat-cap-pay', null); if(pk && S.me && Date.now() - pk.at < 10 * 60e3 && o[pk.oid] && !closed(o[pk.oid]) && !$('scrim')) paySheet(pk.oid); }   /* back where the waiter was */
  }, bad('orders')));
  subs.push(F.onSnapshot(F.query(col(C_('cleanreq')), F.where('at', '>=', since)), function(snap){
    var c = {}; snap.forEach(function(d){ c[d.id] = Object.assign({ id:d.id }, d.data()); }); S.clean = c; onClean(); softRender(); }, bad('cleanreq'))); };
  S.relisten = listen; listen(); if(!SETUP) kdsWatch(); setInterval(listen, 6 * 3600e3);   /* the window moves on a tablet left running for days */
  await loadMenu();
  render();
  var learn = function(){ ensurePosMenu().then(function(){ if(usePos()) softRender(); }); };
  if(S.me) learn(); else { var iv = setInterval(function(){ if(S.me){ clearInterval(iv); learn(); } }, 1500); }
  setInterval(function(){ if(S.me) learn(); }, 3 * 3600e3);   /* a tablet left on for days still re-learns */
  F.onSnapshot(ref('settings', 'pos_menu'), function(d){ if(d.exists() && d.data().fams){ POSM = d.data(); if(usePos()) softRender(); } }, bad('pos_menu'));
  F.onSnapshot(ref('settings', 'pos_edits'), function(d){ POSE = d.exists() ? d.data() : {}; if(usePos()) softRender(); }, bad('pos_edits'));
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).catch(function(){});
}
window.addEventListener('DOMContentLoaded', boot);
})();
