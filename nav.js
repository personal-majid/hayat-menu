/* Hayat · one list of every page (v280, Majid 14 Oct 2026)
   window.HAYAT_APPS is THE map of the site: hub.html draws its tiles from it, every staff page gets
   Ctrl+K (⌘K) "jump to any app" from it, and the office drawer links to hub.html.
   Add a new page here and it appears everywhere. Nothing here reads or writes Firebase. */
(function(){
'use strict';
/* [key, group, icon, name, what it is for, url, roles that use it ('*' = everyone, 'office' = office + cashier)] */
var A=[
 ['pos',    'sell', '⌗',  'Counter',          'Take-away, dine-in and delivery till',            './#/admin/pos',    'office captain waiter'],
 ['call',   'sell', '☎',  'Phone order',      'Take an order on the phone',                      './#/admin/call',   'office'],
 ['orders', 'sell', '▦',  'Orders',           'Every live order, website + counter + phone',     './#/admin',        'office captain'],
 ['captain','sell', '🧑‍🍳','Captain app',      'Waiters: tables, KOT, bills, UPI',                './captain.html',   'office captain waiter cashier'],
 ['wait',   'sell', '⏳', 'Waitlist',         'Guests waiting, quoted time, WhatsApp',           './waitlist.html',  'office captain'],
 ['riders', 'sell', '🏍', 'Riders',           'Delivery riders and their trips',                 './#/admin/riders', 'office'],
 ['rider',  'sell', '🛵', 'Rider app',        'For the riders\' own phones',                     './rider.html',     'rider office'],
 ['kds',    'kitchen','🍳','Kitchen screen',   'Orders for each kitchen, Accept → Ready',         './kds.html',       'office kitchen captain'],
 ['print',  'kitchen','🖨','Printing',         'Kitchen + bill printers, KOT split',              './#/admin/print',  'office'],
 ['clean',  'kitchen','🧹','Cleaning',         'Tables to clean, overdue, cleaners',              './clean.html',     'office cleaner waiter kitchen'],
 ['owner',  'money','📊', 'Owner board',      'Live sales, forecast, spends, replay',            './owner.html',     'office'],
 ['cash',   'money','💵', 'Drawer',           'Float, cash in / out, close the day',             './#/admin/cash',   'office'],
 ['stock',  'money','📦', 'Stock buys',       'Photo of a supplier bill → stock',                './stock.html',     'office kitchen'],
 ['sim',    'money','⏱',  'Service sim',      'Replay our bills on the floor plan',              './sim.html',       'office'],
 ['menu',   'menu', '🍽', 'Menus',            'Import a CSV menu, make it active online, hide',  './#/admin/menu',   'office'],
 ['who',    'menu', '👤', 'Customers',        'Who ordered, phones, addresses',                  './#/admin/who',    'office'],
 ['google', 'menu', 'G',  'Google',           'Reviews and the business profile',                './#/admin/google', 'office'],
 ['site',   'menu', '🌐', 'Customer website', 'What customers see and order from',               './',               '*'],
 ['planner','hotel','📐', 'Space planner',    'Rooms, restaurant, kitchen · 2D, 3D, walk',       './planner.html',   'office'],
 ['rooms',  'hotel','🛏', 'Room booking',     'Coming next · uses the planner\'s rooms',         '',                 'office'],
 ['setup',  'setup','👥', 'Staff & tables',   'Staff codes, halls, tables, captain menu, UPI',   './setup.html',     'office']
];
var G=[['sell','🧾','Selling'],['kitchen','🍳','Kitchen & floor'],['money','📊','Money & numbers'],['menu','🍽','Menu & customers'],['hotel','🏨','Hotel'],['setup','⚙','Setup']];
var APPS=A.map(function(a){ return {key:a[0],group:a[1],ic:a[2],name:a[3],what:a[4],url:a[5],roles:a[6].split(' ')}; });
var RK='hayat-recent';
function recent(){ try{ return JSON.parse(localStorage.getItem(RK)||'[]'); }catch(e){ return []; } }
function remember(k){ if(!k) return; try{ var r=recent().filter(function(x){ return x!==k; }); r.unshift(k); localStorage.setItem(RK,JSON.stringify(r.slice(0,8))); }catch(e){} }
/* which app is this page */
function here(){ var p=(location.pathname.split('/').pop()||'index.html'), h=location.hash||'';
  if(p==='hub.html') return 'hub';
  if(p===''||p==='index.html'){ if(!/^#\/admin/.test(h)) return 'site'; var m=h.match(/^#\/admin\/([a-z]+)/); var k=m?m[1]:'orders'; if(k==='o'||k==='c') k='orders'; return APPS.some(function(a){ return a.key===k; })?k:'orders'; }
  for(var i=0;i<APPS.length;i++){ var u=APPS[i].url.replace('./',''); if(u&&u===p) return APPS[i].key; } return ''; }
function allowed(a,role){ if(!role||role==='office'||role==='cashier') return true; return a.roles.indexOf('*')>=0||a.roles.indexOf(role)>=0; }
window.HAYAT_APPS={apps:APPS,groups:G,recent:recent,remember:remember,here:here,allowed:allowed};
remember(here());
window.addEventListener('hashchange',function(){ remember(here()); });

/* ---------- Ctrl+K: jump to any app (staff pages only, never on the customer website) ---------- */
function staffPage(){ var k=here(); return k&&k!=='site'; }
var box=null, sel=0, list=[];
function css(){ if(document.getElementById('hnav-css')) return; var s=document.createElement('style'); s.id='hnav-css';
  s.textContent='#hnav{position:fixed;inset:0;z-index:2147483000;background:rgba(15,13,10,.45);display:flex;align-items:flex-start;justify-content:center;padding:10vh 12px 12px;font:15px/1.4 Manrope,"Segoe UI",system-ui,sans-serif}'+
  '#hnav .hb{width:min(560px,100%);background:#fbf8f1;color:#1b1a17;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}'+
  '#hnav input{width:100%;border:0;border-bottom:1px solid rgba(27,26,23,.12);padding:16px 18px;font:inherit;font-size:17px;font-weight:600;background:transparent;color:inherit;outline:0}'+
  '#hnav ul{list-style:none;margin:0;padding:6px;max-height:58vh;overflow:auto} #hnav li{display:flex;gap:12px;align-items:center;padding:9px 12px;border-radius:10px;cursor:pointer}'+
  '#hnav li.on{background:#1b1a17;color:#f5f0e4} #hnav li i{font-style:normal;width:28px;text-align:center;font-size:18px} #hnav li b{font-weight:800} #hnav li small{display:block;opacity:.7;font-size:12.5px} #hnav li code{margin-left:auto;font:600 11.5px ui-monospace,monospace;opacity:.6}'+
  '#hnav .ft{padding:8px 14px;font-size:12px;color:#6f6758;border-top:1px solid rgba(27,26,23,.1);display:flex;gap:12px} #hnav .ft a{color:inherit;font-weight:800}'+
  '@media (prefers-color-scheme:dark){#hnav .hb{background:#211e1a;color:#f5f0e4} #hnav li.on{background:#f5f0e4;color:#1b1a17} #hnav .ft{color:#b5ac9a}}';
  document.head.appendChild(s); }
function draw(){ var q=(box.querySelector('input').value||'').trim().toLowerCase(), r=recent(), cur=here();
  list=APPS.filter(function(a){ return a.url&&a.key!==cur&&(!q||(a.name+' '+a.what+' '+a.url).toLowerCase().indexOf(q)>=0); });
  list.unshift({key:'hub',ic:'⌂',name:'All apps',what:'Every page and its link',url:'./hub.html'});
  if(q) list=list.filter(function(a){ return a.key!=='hub'||'all apps hub home'.indexOf(q)>=0; });
  list.sort(function(a,b){ var x=r.indexOf(a.key), y=r.indexOf(b.key); if(a.key==='hub') return -1; if(b.key==='hub') return 1; return (x<0?99:x)-(y<0?99:y); });
  sel=Math.min(sel,Math.max(0,list.length-1));
  box.querySelector('ul').innerHTML=list.map(function(a,i){ return '<li data-i="'+i+'" class="'+(i===sel?'on':'')+'"><i>'+a.ic+'</i><span><b>'+a.name+'</b><small>'+a.what+'</small></span><code>'+a.url.replace('./','/')+'</code></li>'; }).join('')||'<li>Nothing called that</li>'; }
function go(a){ if(!a) return; close(); remember(a.key); location.href=a.url; }
function open(){ if(box) return; css(); box=document.createElement('div'); box.id='hnav';
  box.innerHTML='<div class="hb" role="dialog" aria-label="Jump to an app"><input placeholder="Jump to… counter, owner, kitchen, planner" autocomplete="off"><ul></ul><div class="ft"><span>↑ ↓ choose · Enter open · Esc close</span><a href="./hub.html">⌂ All apps</a></div></div>';
  document.body.appendChild(box); var inp=box.querySelector('input'); sel=0; draw(); inp.focus();
  inp.oninput=function(){ sel=0; draw(); };
  inp.onkeydown=function(e){ if(e.key==='ArrowDown'){ sel=Math.min(list.length-1,sel+1); draw(); e.preventDefault(); } else if(e.key==='ArrowUp'){ sel=Math.max(0,sel-1); draw(); e.preventDefault(); } else if(e.key==='Enter'){ go(list[sel]); } else if(e.key==='Escape'){ close(); } };
  box.addEventListener('mousedown',function(e){ var li=e.target.closest('li[data-i]'); if(li){ go(list[+li.dataset.i]); return; } if(e.target===box) close(); }); }
function close(){ if(box){ box.remove(); box=null; } }
document.addEventListener('keydown',function(e){ if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&(e.key==='k'||e.key==='K')&&staffPage()){ e.preventDefault(); e.stopPropagation(); box?close():open(); } },true);
window.HAYAT_APPS.open=open; window.HAYAT_APPS.close=close;
})();
