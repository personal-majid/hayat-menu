"""Re-applies: office dock 'More' drawer (Menu, Google, Service sim) + map-repaint fix + cache bump.
Run in the hayat-menu folder:  python apply_dock_patch.py"""
import re, sys
s=open("shop.js",encoding="utf-8").read()
if "dockdrawer" in s: print("shop.js already patched")
else:
  def rep(a,b):
    global s
    if s.count(a)!=1: sys.exit("shop.js changed shape near: "+a[:60])
    s=s.replace(a,b)
  rep('''    ["riders", "#/admin/riders", "\\uD83C\\uDFCD", "Riders"],
    ["menu",   "#/admin/menu",   "\\uD83C\\uDF7D", "Menu"],
    ["google", "#/admin/google", "G",             "Google"]
  ];
  return '<div class="condock">' + B.map(function(b){''','''    ["riders", "#/admin/riders", "\\uD83C\\uDFCD", "Riders"]
  ];
  /* the rest live in a drawer, so the dock fits any screen */
  var M = [
    ["menu",   "#/admin/menu",   "\\uD83C\\uDF7D", "Menu",        "Import, arrange, hide dishes"],
    ["google", "#/admin/google", "G",             "Google",      "Reviews and the business profile"],
    ["sim",    "sim.html",       "\\u23F1",       "Service sim", "Replay our bills on the floor plan"],
    ["kds",    "kds.html",       "\\uD83C\\uDF73", "Kitchen screen", "Orders for each kitchen, tap Done"],
    ["wait",   "waitlist.html",  "\\u23F3",       "Waitlist",    "Guests waiting, quoted time, WhatsApp"],
    ["clean",  "clean.html",     "\\uD83E\\uDDF9", "Cleaning",    "Today's cleaning, overdue, staff codes"]
  ];
  var inMore = M.some(function(m){ return m[0] === here; });
  var more = '<div class="dockmore">' +
    '<div class="dockdrawer" role="menu" hidden>' + M.map(function(m){
      var on = m[0] === here, inner = '<span class="ddic">' + m[2] + '</span><span class="ddtx"><b>' + m[3] + '</b><small>' + m[4] + '</small></span>';
      return m[1].charAt(0) === "#"
        ? '<button class="dditem' + (on ? " on" : "") + '" role="menuitem" data-go="' + m[1] + '"' + (on ? ' aria-current="page"' : '') + '>' + inner + '</button>'
        : '<a class="dditem" role="menuitem" href="' + m[1] + '">' + inner + '</a>';
    }).join("") + '</div>' +
    '<button class="dockbtn wide dmore' + (inMore ? " on" : "") + '" aria-haspopup="menu" aria-expanded="false" title="More">' +
      '\\u22EF<span class="dlab">' + (inMore ? M.filter(function(m){ return m[0] === here; })[0][3] : "More") + '</span></button>' +
  '</div>';
  return '<div class="condock">' + B.map(function(b){''')
  rep('''      (b[0] === "riders" && n ? '<span class="dockn">' + n + '</span>' : '') +
      '</button>';
  }).join("") + '</div>';
}''','''      (b[0] === "riders" && n ? '<span class="dockn">' + n + '</span>' : '') +
      '</button>';
  }).join("") + more + '</div>';
}
/* the More drawer: one handler for every repaint of the dock */
document.addEventListener("click", function(e){
  var t = e.target, btn = t.closest && t.closest(".dmore");
  var open = document.querySelectorAll(".dockdrawer:not([hidden])");
  if(btn){
    var d = btn.parentNode.querySelector(".dockdrawer"), was = !d.hidden;
    open.forEach(function(x){ x.hidden = true; });
    d.hidden = was; btn.setAttribute("aria-expanded", was ? "false" : "true");
    return;
  }
  if(t.closest && t.closest(".dockdrawer") && !t.closest(".dditem")) return;
  open.forEach(function(x){ x.hidden = true; var b = x.parentNode.querySelector(".dmore"); if(b) b.setAttribute("aria-expanded","false"); });
});
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") document.querySelectorAll(".dockdrawer:not([hidden])").forEach(function(x){ x.hidden = true; });
});''')
  if("setInterval(function(){ paintAdmin(main); }, 15000)" in s): rep('''function liveWatch(on, main){
  if(on && !LIVETIMER){
    LIVETIMER = setInterval(function(){ paintAdmin(main); }, 15000);''','''function onBoardPage(){
  var h = (location.hash || "").replace(/^#\\/?/, "").split("/").filter(Boolean);
  return h[0] === "admin" && !/^(riders|call|who|menu|google|c|o)$/.test(h[1] || "");
}
function liveWatch(on, main){
  if(on && !LIVETIMER){
    LIVETIMER = setInterval(function(){
      /* only the board repaints itself. Opened the Menu (or any other
         office page) from the map? Stop, or the map paints over it. */
      if(!onBoardPage()) return liveWatch(false);
      paintAdmin(main);
    }, 15000);''')
  if("function onBoardPage" in s): rep('''  if(p[0] !== "admin") liveWatch(false, main);''','''  if(!onBoardPage()) liveWatch(false, main);''')
  open("shop.js","w",encoding="utf-8").write(s); print("shop.js patched")
c=open("app.css",encoding="utf-8").read()
if "dockdrawer" in c: print("app.css already patched")
else:
  c+='''
/* ---- dock: the More drawer (Menu, Google, Service sim) ---- */
.dockmore{position:relative;display:flex}
.dockdrawer{position:absolute;right:0;bottom:calc(100% + 10px);min-width:270px;max-width:calc(100vw - 24px);
  background:var(--card);border:1px solid var(--line2);border-radius:16px;box-shadow:var(--shadow);
  padding:6px;display:grid;gap:2px;z-index:710}
.dockdrawer[hidden]{display:none}
.dditem{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:center;text-align:left;
  width:100%;border:0;background:transparent;color:var(--cream);padding:10px 12px;border-radius:12px;
  font:inherit;cursor:pointer;text-decoration:none}
.dditem:hover,.dditem:focus-visible{background:color-mix(in srgb,var(--gold) 14%,transparent);outline:none}
.dditem.on{background:color-mix(in srgb,var(--gold) 20%,transparent)}
.ddic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:18px;font-weight:800;
  border:1px solid var(--line2)}
.ddtx b{display:block;font-weight:700} .ddtx small{display:block;color:var(--muted);font-size:var(--t-small)}
html[data-theme="paper"] .dockdrawer{background:var(--card);border-color:var(--line2)}
html[data-theme="paper"] .dditem{color:var(--ink)}
'''
  open("app.css","w",encoding="utf-8").write(c); print("app.css patched")
w=open("sw.js").read(); m=re.search(r'hayat-v(\d+)',w); n=int(m.group(1))+1
open("sw.js","w").write(w.replace(m.group(0),"hayat-v%d"%n)); print("cache ->","hayat-v%d"%n)
