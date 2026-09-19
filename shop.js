/* ============================================================
   HAYAT — CART, ORDERS, RIDERS
   ------------------------------------------------------------
   Three consoles share one store:

     customer   #/cart  #/checkout  #/o/<id>
     business   #/admin            (orders + riders)
     rider      #/drive/<id>

   STORAGE
   Right now everything lives in this browser (localStorage) and
   syncs between tabs, so the whole flow can be tried on one
   machine with three tabs open. Nothing leaves the device.

   To go live, replace the STORE object below with Firestore. The
   rest of this file only ever calls STORE.* and never touches
   localStorage directly, so nothing else has to change.
   ============================================================ */
(function(){
"use strict";

/* ---------- the store -------------------------------------
   One shape, two backings.

     no firebase in config.js  -> this browser only (localStorage),
                                  synced between tabs. Good for a demo
                                  on one machine.
     firebase in config.js     -> Firestore. The three screens can then
                                  be three different phones.

   Everything below the store only ever calls STORE.*, so nothing else
   in this file knows or cares which one is running.
   ----------------------------------------------------------- */
var PASS = "1234";     /* TEMPORARY — replaced by a real login before go-live */
var KEY = "hayat_shop_v1";
var CH  = null;
try{ CH = new BroadcastChannel("hayat_shop"); }catch(e){}

var watchers = [];
function fire(){ watchers.slice().forEach(function(f){ try{ f(); }catch(e){} }); }
try{ if(CH) CH.onmessage = fire; }catch(e){}

/* the working copy every view reads from */
var DB = { orders:{}, riders:{}, seq:100 };
var LIVE  = false;             /* true only once the SERVER has answered */
var FAULT = null;              /* why it is not live, in one word */

/* ----- local backing ----- */
function lsRead(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || { orders:{}, riders:{}, seq:100 }; }
  catch(e){ return { orders:{}, riders:{}, seq:100 }; }
}
function lsWrite(){
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){}
  try{ if(CH) CH.postMessage("x"); }catch(e){}
  fire();
}
DB = lsRead();
window.addEventListener("storage", function(e){
  if(e.key === KEY && !LIVE){ DB = lsRead(); fire(); }
});
if(CH) { var _on = CH.onmessage; CH.onmessage = function(){ if(!LIVE) DB = lsRead(); fire(); }; }

/* ----- Firestore backing ----- */
var FB = null;                 /* { db, api } once loaded */

function orderId(){
  /* short, readable, and unique enough for a restaurant's day */
  var d = new Date();
  return "H" + String(d.getDate()).padStart(2,"0") +
         Math.random().toString(36).slice(2,5).toUpperCase();
}

async function connectFirebase(cfg){
  var appMod  = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js");
  var fsMod   = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
  var app = appMod.initializeApp(cfg);
  var db  = fsMod.getFirestore(app);
  FB = { db: db, api: fsMod };

  /* A snapshot straight from the local cache is NOT proof the database
     exists — Firestore answers offline and queues the writes forever.
     Only a snapshot the server actually sent counts as live. */
  function watch(name, into){
    fsMod.onSnapshot(fsMod.collection(db, name), function(snap){
      var next = {};
      snap.forEach(function(d){ next[d.id] = Object.assign({ id:d.id }, d.data()); });
      DB[into] = next;
      if(!snap.metadata.fromCache) LIVE = true;
      fire();
    }, function(err){ FAULT = err && (err.code || err.message); LIVE = false; fire(); });
  }
  watch("orders", "orders");
  watch("riders", "riders");

  /* ask the REST endpoint once, so a missing database is named plainly
     instead of showing up later as writes that quietly disappear */
  fetch("https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
        "/databases/(default)/documents/riders?pageSize=1&key=" + cfg.apiKey)
    .then(function(r){
      if(r.status === 404) FAULT = "no-database";
      else if(r.status === 403) FAULT = "rules-deny";
      else if(r.ok) { FAULT = null; LIVE = true; }
      fire();
    }).catch(function(){});
}

var STORE = {
  live:  function(){ return LIVE; },
  fault: function(){ return FAULT; },
  onChange: function(f){ watchers.push(f);
    return function(){ watchers = watchers.filter(function(g){ return g!==f; }); }; },

  orders: function(){
    return Object.keys(DB.orders).map(function(k){ return DB.orders[k]; })
      .sort(function(a,b){ return (b.at||0) - (a.at||0); });
  },
  order: function(id){ return DB.orders[id] || null; },

  place: function(o){
    var id = orderId();
    o.id = id; o.at = Date.now(); o.status = "placed";
    o.log = [{ s:"placed", at:o.at }];
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "orders", id), o)
        .catch(function(e){ console.warn("place", e); });
      DB.orders[id] = o; fire();                 /* show it at once */
    } else {
      DB.orders[id] = o; lsWrite();
    }
    return id;
  },

  setStatus: function(id, s, extra){
    var o = DB.orders[id];
    if(!o) return null;
    o.status = s;
    if(extra) for(var k in extra) o[k] = extra[k];
    (o.log = o.log || []).push({ s:s, at:Date.now() });
    if(FB){
      var patch = { status:s, log:o.log };
      if(extra) for(var j in extra) patch[j] = extra[j];
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id), patch)
        .catch(function(e){ console.warn("setStatus", e); });
      fire();
    } else lsWrite();
    return o;
  },

  riders: function(){
    return Object.keys(DB.riders).map(function(k){ return DB.riders[k]; })
      .filter(function(r){ return !r.off; });
  },
  rider: function(id){ return DB.riders[id] || null; },

  addRider: function(name, phone){
    var id = "r" + Date.now().toString(36);
    var r = { id:id, name:name, phone:phone };
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "riders", id), r)
        .catch(function(e){ console.warn("addRider", e); });
      DB.riders[id] = r; fire();
    } else { DB.riders[id] = r; lsWrite(); }
    return id;
  },
  dropRider: function(id){
    if(DB.riders[id]) DB.riders[id].off = true;
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "riders", id), { off:true })
        .catch(function(e){ console.warn("dropRider", e); });
      fire();
    } else lsWrite();
  }
};

/* ---------- the steps an order goes through ---------------- */
var FLOW = ["placed","accepted","assigned","on_way","delivered"];
var STEP = {
  placed:    { t:"Order placed",  s:"We have it. Confirming now." },
  accepted:  { t:"Accepted",      s:"The kitchen has started." },
  assigned:  { t:"Rider assigned",s:"Picking it up from us." },
  on_way:    { t:"On the way",    s:"Almost with you." },
  delivered: { t:"Delivered",     s:"Enjoy it." }
};

/* ---------- small helpers --------------------------------- */
var C = function(){ return window.CONFIG || {}; };
function esc(s){ return String(s==null?"":s)
  .replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function rupee(n){ return "₹" + Number(n||0).toLocaleString("en-IN"); }
function el(id){ return document.getElementById(id); }
function when(ts){ try{ return new Date(ts).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
                   catch(e){ return ""; } }
function base(){ return location.href.split("#")[0].split("?")[0]; }
function wa(number, text){
  return "https://wa.me/" + String(number||"").replace(/\D/g,"") +
         "?text=" + encodeURIComponent(text);
}

/* ---------- the cart (this browser only) ------------------- */
var CART = [];
try{ CART = JSON.parse(localStorage.getItem("hayat_cart")) || []; }catch(e){ CART = []; }
function saveCart(){
  try{ localStorage.setItem("hayat_cart", JSON.stringify(CART)); }catch(e){}
  paintFab();
}
function cartCount(){ return CART.reduce(function(n,l){ return n + l.q; }, 0); }
function cartTotal(){ return CART.reduce(function(n,l){ return n + l.q * l.price; }, 0); }
function addLine(id, name, label, price){
  var k = id + "|" + label;
  var hit = CART.filter(function(l){ return l.k===k; })[0];
  if(hit) hit.q++;
  else CART.push({ k:k, id:id, name:name, label:label, price:price, q:1 });
  saveCart();
}
function bump(k, d){
  CART = CART.map(function(l){ if(l.k===k) l.q += d; return l; })
             .filter(function(l){ return l.q > 0; });
  saveCart();
}

/* menu-data speaks in keys like QUARTER; lang.js turns them into words */
function label(k){
  try{ if(window.T){ var v = T(String(k)); if(v && v !== String(k)) return v; } }catch(e){}
  var t = String(k).replace(/_/g," ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* every way a dish can be priced, flattened into buyable choices */
function choices(it){
  var out = [];
  if(it.price != null && typeof it.price === "number") out.push({ label:"", price:it.price });
  if(it.opts) it.opts.forEach(function(o){
    if(typeof o[1] === "number") out.push({ label:label(o[0]), price:o[1] });
  });
  if(it.matrix){
    /* One row means the row name carries nothing ("Price"), so the column
       alone is the label. Several rows and both halves matter. */
    var many = it.matrix.rows.length > 1;
    it.matrix.rows.forEach(function(r){
      (r[1]||[]).forEach(function(p,i){
        if(typeof p !== "number") return;
        var col = label(it.matrix.cols[i]);
        out.push({ label: many ? (label(r[0]) + " · " + col) : col, price:p });
      });
    });
  }
  return out;
}

/* ---------- the floating cart button ----------------------- */
function paintFab(){
  var f = el("cartfab");
  if(!f){
    f = document.createElement("button");
    f.id = "cartfab";
    f.onclick = function(){ location.hash = "#/cart"; };
    document.body.appendChild(f);
  }
  var n = cartCount();
  f.hidden = (n === 0) || /^#\/(admin|drive|o)\b/.test(location.hash||"");
  f.innerHTML = '<span class="b">' + n + '</span> View cart · ' + rupee(cartTotal());
  /* the button floats over the page, so the page has to end above it */
  try{ document.body.classList.toggle("hascart", !f.hidden); }catch(e){}
}

/* ============================================================
   CUSTOMER
   ============================================================ */
function viewCart(main){
  if(!CART.length){
    main.innerHTML = shell("Your cart",
      '<p class="shopsub">Nothing in it yet.</p>' +
      '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');
    return;
  }
  main.innerHTML = shell("Your cart",
    '<div class="lines">' + CART.map(function(l){
      return '<div class="line">' +
        '<div class="ln"><b>' + esc(l.name) + '</b>' +
          (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</div>' +
        '<div class="qty">' +
          '<button data-q="' + esc(l.k) + '|-1">−</button>' +
          '<span>' + l.q + '</span>' +
          '<button data-q="' + esc(l.k) + '|1">+</button>' +
        '</div>' +
        '<div class="lp">' + rupee(l.q * l.price) + '</div></div>';
    }).join("") + '</div>' +
    '<div class="total"><span>Total</span><b>' + rupee(cartTotal()) + '</b></div>' +
    '<button class="shopbtn" data-go="#/checkout">Checkout</button>' +
    '<button class="shopbtn ghost" data-go="#/">Add something else</button>');
}

function viewCheckout(main){
  if(!CART.length){ location.hash = "#/"; return; }
  var saved = {};
  try{ saved = JSON.parse(localStorage.getItem("hayat_me")) || {}; }catch(e){}

  main.innerHTML = shell("Where is it going?",
    '<input class="fld" id="coName"  placeholder="Your name" value="' + esc(saved.name||"") + '">' +
    '<input class="fld" id="coPhone" placeholder="Phone number" inputmode="tel" value="' + esc(saved.phone||"") + '">' +
    '<textarea class="fld" id="coAddr" placeholder="Address — house, landmark, area">' + esc(saved.addr||"") + '</textarea>' +
    '<div class="pinwrap">' +
      '<div class="pinhead"><b>Drop the pin on your gate</b>' +
        '<button class="pinme" id="coHere">Use my location</button></div>' +
      '<div id="comap" class="comap"></div>' +
      '<div class="pinnote" id="coPinTxt">Drag the map so the pin sits on your door. ' +
        'The rider follows this, not the address.</div>' +
    '</div>' +
    '<input class="fld" id="coNote"  placeholder="Anything we should know? (optional)">' +
    '<div class="total"><span>' + cartCount() + ' item(s)</span><b>' + rupee(cartTotal()) + '</b></div>' +
    '<button class="shopbtn" id="coGo">Place the order</button>' +
    '<p class="shopnote">Pay on delivery. We will call if anything is unclear.</p>' +
    '<button class="shopbtn ghost" data-go="#/cart">Back to the cart</button>');

  mountMap(saved);

  el("coGo").onclick = function(){
    var name  = el("coName").value.trim(),
        phone = el("coPhone").value.trim(),
        addr  = el("coAddr").value.trim();
    if(!name || !phone || !addr){ shopToast("Name, phone and address, please."); return; }
    try{ localStorage.setItem("hayat_me", JSON.stringify(
      { name:name, phone:phone, addr:addr, lat:PIN&&PIN.lat, lng:PIN&&PIN.lng })); }catch(e){}

    var o = {
      name:name, phone:phone, addr:addr,
      note: el("coNote").value.trim(),
      lines: CART.slice(),
      total: cartTotal()
    };
    if(PIN){ o.lat = +PIN.lat.toFixed(6); o.lng = +PIN.lng.toFixed(6); }
    var id = STORE.place(o);
    CART = []; saveCart();
    location.hash = "#/o/" + id;
  };
}

/* ---------- the pin -----------------------------------------
   Leaflet on OpenStreetMap tiles: free, no key, no billing.
   An address in Makkaraparamba is a landmark, not a house number,
   so the pin is what the rider actually follows.
   ------------------------------------------------------------ */
var PIN = null, MAP = null;
var HOME = { lat: 11.0065785, lng: 76.1270507 };   /* the restaurant */

function loadLeaflet(){
  if(window.L) return Promise.resolve();
  if(loadLeaflet._p) return loadLeaflet._p;

  /* three mirrors: a blocked or flaky CDN should not cost us the map */
  var HOSTS = [
    "https://unpkg.com/leaflet@1.9.4/dist/",
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/",
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/"
  ];

  function one(base){
    return new Promise(function(done, fail){
      var css = document.createElement("link");
      css.rel = "stylesheet"; css.href = base + "leaflet.css";
      document.head.appendChild(css);
      var js = document.createElement("script");
      js.src = base + "leaflet.js";
      js.onload  = function(){ window.L ? done() : fail(new Error("loaded but no L")); };
      js.onerror = function(){ fail(new Error("blocked: " + base)); };
      document.head.appendChild(js);
      setTimeout(function(){ if(!window.L) fail(new Error("timed out: " + base)); }, 9000);
    });
  }

  loadLeaflet._p = HOSTS.reduce(function(chain, base){
    return chain.catch(function(){ return one(base); });
  }, Promise.reject())
  .catch(function(e){
    loadLeaflet._p = null;        /* never cache a failure — let the next
                                     visit to checkout try again */
    throw e;
  });
  return loadLeaflet._p;
}

function pinText(msg){ var t = el("coPinTxt"); if(t) t.textContent = msg; }

function mountMap(saved){
  var box = el("comap");
  if(!box) return;
  PIN = (saved && saved.lat && saved.lng) ? { lat:saved.lat, lng:saved.lng } : null;

  loadLeaflet().then(function(){
    var at = PIN || HOME;
    /* a container Leaflet has already claimed cannot be reused */
    try{ if(box._leaflet_id){ box._leaflet_id = null; box.innerHTML = ""; } }catch(e){}
    MAP = L.map(box, { zoomControl:true, attributionControl:true })
           .setView([at.lat, at.lng], PIN ? 17 : 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(MAP);

    /* the pin is fixed to the centre of the box; the map moves under it */
    MAP.on("move", function(){ PIN = MAP.getCenter(); });
    MAP.on("moveend", function(){
      PIN = MAP.getCenter();
      pinText("Pin set \u00b7 " + PIN.lat.toFixed(5) + ", " + PIN.lng.toFixed(5));
    });
    setTimeout(function(){ MAP.invalidateSize(); }, 200);
  }).catch(function(err){
    /* say what actually went wrong — a blanket message hides real faults */
    box.innerHTML = '<div class="mapfail">The map is not loading here.<br>' +
      'Use <b>my location</b> above, or just the address \u2014 we will call if ' +
      'we cannot find it.<br><small>' + esc(String(err && err.message || err)) +
      '</small></div>';
  });

  var here = el("coHere");
  if(here) here.onclick = function(){
    if(!navigator.geolocation){ pinText("This browser will not share a location."); return; }
    pinText("Finding you\u2026");
    navigator.geolocation.getCurrentPosition(function(pos){
      PIN = { lat:pos.coords.latitude, lng:pos.coords.longitude };
      if(MAP) MAP.setView([PIN.lat, PIN.lng], 18);
      pinText("Pin set \u00b7 " + PIN.lat.toFixed(5) + ", " + PIN.lng.toFixed(5));
    }, function(){
      pinText("Could not get your location \u2014 drag the map instead.");
    }, { enableHighAccuracy:true, timeout:10000 });
  };
}

function viewOrder(main, id){
  var o = STORE.order(id);
  if(!o){
    main.innerHTML = shell("Order not found",
      '<p class="shopsub">This link does not match an order on this device.</p>' +
      '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');
    return;
  }
  var at = FLOW.indexOf(o.status);
  var rider = o.riderId ? STORE.rider(o.riderId) : null;

  main.innerHTML = shell("Order " + esc(o.id),
    '<div class="track">' + FLOW.map(function(s,i){
      var done = i <= at;
      var hit  = (o.log||[]).filter(function(l){ return l.s===s; })[0];
      return '<div class="tstep' + (done ? " on" : "") + (i===at ? " now" : "") + '">' +
        '<span class="dot"></span>' +
        '<div><b>' + esc(STEP[s].t) + '</b>' +
          '<small>' + (done ? esc(STEP[s].s) : "") + '</small></div>' +
        '<span class="tt">' + (hit ? when(hit.at) : "") + '</span></div>';
    }).join("") + '</div>' +

    (rider && at >= 2
      ? '<div class="ridercard"><div><b>' + esc(rider.name) + '</b><small>Your rider</small></div>' +
        '<a class="callbtn" href="tel:' + esc(rider.phone) + '">Call</a></div>'
      : '') +

    '<div class="lines">' + (o.lines||[]).map(function(l){
      return '<div class="line"><div class="ln"><b>' + esc(l.name) + '</b>' +
        (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</div>' +
        '<div class="lq">×' + l.q + '</div>' +
        '<div class="lp">' + rupee(l.q * l.price) + '</div></div>';
    }).join("") + '</div>' +
    '<div class="total"><span>Total</span><b>' + rupee(o.total) + '</b></div>' +
    '<p class="shopnote">' + esc(o.addr) + '</p>' +
    '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');
}

/* ============================================================
   BUSINESS
   ============================================================ */
function unlocked(){ try{ return sessionStorage.getItem("hayat_admin")==="1"; }catch(e){ return false; } }

function gate(main, then){
  if(unlocked()) return then();
  main.innerHTML = shell("Staff only",
    '<input class="fld" id="pw" type="password" placeholder="Passcode" inputmode="numeric">' +
    '<button class="shopbtn" id="pwGo">Unlock</button>' +
    '<p class="shopnote">Temporary. A real login replaces this before go-live.</p>');
  el("pwGo").onclick = function(){
    if(el("pw").value === PASS){
      try{ sessionStorage.setItem("hayat_admin","1"); }catch(e){}
      then();
    } else shopToast("Wrong passcode.");
  };
}

function viewAdmin(main){
  gate(main, function(){ paintAdmin(main); });
}

function paintAdmin(main){
  var orders = STORE.orders(), riders = STORE.riders();
  var live = orders.filter(function(o){ return o.status !== "delivered"; });
  var done = orders.filter(function(o){ return o.status === "delivered"; });

  main.innerHTML = shell("Orders",
    connBanner() +
    '<div class="adminbar">' +
      '<span class="pill">' + live.length + ' live</span>' +
      '<span class="pill quiet">' + done.length + ' delivered</span>' +
      '<button class="linky" data-go="#/admin/riders">Riders (' + riders.length + ')</button>' +
    '</div>' +
    (orders.length ? orders.map(orderCard).join("")
                   : '<p class="shopsub">No orders yet. Place one from the menu to try it.</p>') +
    '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');

  main.querySelectorAll("[data-adv]").forEach(function(b){
    b.onclick = function(){
      var p = b.dataset.adv.split("|");
      STORE.setStatus(p[0], p[1]);
    };
  });
  main.querySelectorAll("[data-assign]").forEach(function(sel){
    sel.onchange = function(){
      if(!sel.value) return;
      var o = STORE.setStatus(sel.dataset.assign, "assigned", { riderId: sel.value });
      var r = STORE.rider(sel.value);
      if(o && r) window.open(wa(r.phone, riderMsg(o, r)), "_blank");
    };
  });
}

/* the pin if we have one, otherwise the words */
function dirTo(o){
  var d = (o.lat && o.lng) ? (o.lat + "," + o.lng) : o.addr;
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(d);
}

function riderMsg(o, r){
  return "Hayat — delivery " + o.id + "\n\n" +
    o.lines.map(function(l){ return l.q + " × " + l.name + (l.label ? " (" + l.label + ")" : ""); }).join("\n") +
    "\n\nTotal " + rupee(o.total) + " (collect on delivery)" +
    "\n\n" + o.name + " — " + o.phone +
    "\n" + o.addr +
    (o.lat ? "\nPin: " + dirTo(o) : "") +
    (o.note ? "\nNote: " + o.note : "") +
    "\n\nYour page: " + base() + "#/drive/" + o.id;
}

function orderCard(o){
  var at = FLOW.indexOf(o.status);
  var next = FLOW[at+1];
  var riders = STORE.riders();
  var rider = o.riderId ? STORE.rider(o.riderId) : null;

  var action = "";
  if(o.status === "placed")
    action = '<button class="shopbtn small" data-adv="' + o.id + '|accepted">Accept</button>';
  else if(o.status === "accepted")
    action = riders.length
      ? '<select class="fld sel" data-assign="' + o.id + '"><option value="">Assign a rider…</option>' +
        riders.map(function(r){ return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join("") +
        '</select>'
      : '<button class="shopbtn small ghost" data-go="#/admin/riders">Add a rider first</button>';
  else if(next)
    action = '<button class="shopbtn small" data-adv="' + o.id + '|' + next + '">' +
             esc(STEP[next].t) + '</button>';

  return '<div class="ocard">' +
    '<div class="orow"><b>' + esc(o.id) + '</b>' +
      '<span class="status s-' + o.status + '">' + esc(STEP[o.status].t) + '</span>' +
      '<span class="otime">' + when(o.at) + '</span></div>' +
    '<div class="who">' + esc(o.name) + ' · <a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></div>' +
    '<div class="addr">' + esc(o.addr) + '</div>' +
    (o.note ? '<div class="addr note">' + esc(o.note) + '</div>' : '') +
    (o.lat ? '<a class="pinlink" target="_blank" rel="noopener" href="' + esc(dirTo(o)) + '">\u25CE Pin dropped \u2014 open in Maps</a>'
           : '<div class="addr nopin">No pin \u2014 address only</div>') +
    '<div class="items">' + (o.lines||[]).map(function(l){
      return l.q + "× " + esc(l.name) + (l.label ? " <i>" + esc(l.label) + "</i>" : "");
    }).join(" · ") + '</div>' +
    '<div class="orow"><span class="tot">' + rupee(o.total) + '</span>' +
      (rider ? '<span class="rname">' + esc(rider.name) + '</span>' : '') + '</div>' +
    action + '</div>';
}

/* Never let a broken database hide behind a normal-looking screen. */
function connBanner(){
  if(!C().firebase || !C().firebase.projectId)
    return '<div class="conn warn">Demo mode \u2014 orders stay on this device only.</div>';
  if(STORE.live()) return '<div class="conn ok">Live \u00b7 shared with every device</div>';
  var f = STORE.fault();
  if(f === "no-database")
    return '<div class="conn bad"><b>The Firestore database has not been created.</b>' +
           'Anything saved now disappears on refresh. Firebase console \u2192 ' +
           'Firestore Database \u2192 Create database \u2192 test mode.</div>';
  if(f === "rules-deny")
    return '<div class="conn bad"><b>Firestore is refusing this app.</b>' +
           'The security rules are blocking reads and writes.</div>';
  return '<div class="conn warn">Connecting\u2026 nothing is saved to the cloud yet.</div>';
}

function viewRiders(main){
  gate(main, function(){ paintRiders(main); });
}
function paintRiders(main){
  var riders = STORE.riders();
  main.innerHTML = shell("Riders",
    connBanner() +
    (riders.length ? '<div class="lines">' + riders.map(function(r){
        return '<div class="line"><div class="ln"><b>' + esc(r.name) + '</b>' +
          '<small>' + esc(r.phone) + '</small></div>' +
          '<button class="linky warn" data-drop="' + esc(r.id) + '">Remove</button></div>';
      }).join("") + '</div>'
     : '<p class="shopsub">No riders yet.</p>') +
    '<input class="fld" id="rName"  placeholder="Rider name">' +
    '<input class="fld" id="rPhone" placeholder="Phone with country code, e.g. 919844326842" inputmode="tel">' +
    '<button class="shopbtn" id="rAdd">Add rider</button>' +
    '<button class="shopbtn ghost" data-go="#/admin">Back to orders</button>');

  el("rAdd").onclick = function(){
    var n = el("rName").value.trim(), p = el("rPhone").value.trim();
    if(!n || !p){ shopToast("Name and phone, please."); return; }
    STORE.addRider(n, p);
  };
  main.querySelectorAll("[data-drop]").forEach(function(b){
    b.onclick = function(){ STORE.dropRider(b.dataset.drop); };
  });
}

/* ============================================================
   RIDER
   ============================================================ */
function viewDrive(main, id){
  var o = STORE.order(id);
  if(!o){
    main.innerHTML = shell("Not found", '<p class="shopsub">No order with that number on this device.</p>');
    return;
  }
  var at = FLOW.indexOf(o.status), next = FLOW[at+1];

  main.innerHTML = shell("Delivery " + esc(o.id),
    '<div class="who big">' + esc(o.name) + '</div>' +
    '<div class="addr">' + esc(o.addr) + '</div>' +
    (o.note ? '<div class="addr note">' + esc(o.note) + '</div>' : '') +
    '<div class="rowbtns">' +
      '<a class="shopbtn small" href="tel:' + esc(o.phone) + '">Call</a>' +
      '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' + esc(dirTo(o)) + '">Directions</a>' +
    '</div>' +
    '<div class="items">' + (o.lines||[]).map(function(l){
      return l.q + "× " + esc(l.name);
    }).join(" · ") + '</div>' +
    '<div class="total"><span>Collect</span><b>' + rupee(o.total) + '</b></div>' +
    '<div class="status big s-' + o.status + '">' + esc(STEP[o.status].t) + '</div>' +
    (next ? '<button class="shopbtn" id="dvGo">' + esc(STEP[next].t) + '</button>'
          : '<p class="shopnote">Done. Thank you.</p>'));

  if(next) el("dvGo").onclick = function(){ STORE.setStatus(id, next); };
}

/* ============================================================
   chrome
   ============================================================ */
function shell(title, body){
  return '<div class="backbar">' +
      '<button class="back" data-go="#/"><span class="a">‹</span>Menu</button>' +
      '<span class="crumbtxt">' + esc(title) + '</span></div>' +
    '<div class="shopwrap"><h2 class="shoph">' + esc(title) + '</h2>' + body + '</div>';
}
function shopToast(m){
  try{ if(window.toast) return window.toast(m); }catch(e){}
  alert(m);
}

/* ---------- add to order, on a dish page ------------------- *
   ADD until they tap it, then a stepper in the same footprint.
   Nobody should have to open the cart to order a second one.    */
function qtyOf(id, lbl){
  var hit = CART.filter(function(l){ return l.k === id + "|" + lbl; })[0];
  return hit ? hit.q : 0;
}

function addControl(id, lbl, price){
  var q = qtyOf(id, lbl);
  if(!q) return '<button class="add" data-add="' + esc(id) + '|' + esc(lbl) + '|' + price + '">Add</button>';
  return '<span class="step">' +
    '<button data-q="' + esc(id + "|" + lbl) + '|-1" aria-label="one less">&minus;</button>' +
    '<b>' + q + '</b>' +
    '<button data-q="' + esc(id + "|" + lbl) + '|1" aria-label="one more">+</button></span>';
}

function dishButtons(it){
  var cs = choices(it);
  if(!cs.length) return "";
  return '<h3 class="mini addhead">' + (cs.length === 1 ? "Order it" : "Choose a size") + '</h3>' +
    '<div class="addwrap">' + cs.map(function(c){
      return '<div class="arow" data-row="' + esc(it.id) + '|' + esc(c.label) + '">' +
        '<span class="an">' + (c.label ? esc(c.label) : esc(it.name)) + '</span>' +
        '<span class="ap">' + rupee(c.price) + '</span>' +
        addControl(it.id, c.label, c.price) + '</div>';
    }).join("") + '</div>';
}

/* redraw the rows in place, so the stepper appears where ADD was */
function repaintRows(){
  var rows = document.querySelectorAll("[data-row]");
  if(!rows.length) return;
  rows.forEach(function(row){
    var parts = row.dataset.row.split("|");
    var id = parts[0], lbl = parts.slice(1).join("|"), price = 0;
    try{
      (window.MENU||[]).forEach(function(c){ c.items.forEach(function(x){
        if(x.id === id) choices(x).forEach(function(ch){ if(ch.label === lbl) price = ch.price; });
      }); });
    }catch(e){}
    var ctrl = row.querySelector(".add, .step");
    if(ctrl) ctrl.outerHTML = addControl(id, lbl, price);
  });
}

/* ---------- routing ---------------------------------------- */
var REPAINT = null;
function route(p, main){
  REPAINT = null;
  if(p[0] === "cart")     { viewCart(main); return true; }
  if(p[0] === "checkout") { viewCheckout(main); return true; }
  if(p[0] === "o")        { REPAINT = function(){ viewOrder(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "drive")    { REPAINT = function(){ viewDrive(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "admin"){
    if(p[1] === "riders") { REPAINT = function(){ viewRiders(main); }; REPAINT(); return true; }
    REPAINT = function(){ viewAdmin(main); }; REPAINT(); return true;
  }
  return false;
}
STORE.onChange(function(){ if(REPAINT) REPAINT(); });

document.addEventListener("click", function(e){
  var a = e.target.closest("[data-add]");
  if(a){
    var p = a.dataset.add.split("|");
    var it = null;
    try{ (window.MENU||[]).forEach(function(c){
      c.items.forEach(function(x){ if(x.id === p[0]) it = x; }); }); }catch(err){}
    addLine(p[0], it ? it.name : p[0], p[1], Number(p[2]));
    repaintRows();
    return;
  }
  var q = e.target.closest("[data-q]");
  if(q){
    var parts = q.dataset.q.split("|");
    bump(parts.slice(0, parts.length-1).join("|"), Number(parts[parts.length-1]));
    if(/^#\/cart/.test(location.hash)) viewCart(document.getElementById("main"));
    else repaintRows();
  }
});

window.addEventListener("hashchange", paintFab);

/* ---------- boot ------------------------------------------- */
(function(){
  var cfg = C().firebase;
  if(!cfg || !cfg.projectId) return;          /* demo mode, this browser only */
  connectFirebase(cfg).then(function(){
    console.log("[hayat] orders are live on Firestore");
    fire();
  }).catch(function(e){
    console.warn("[hayat] Firestore did not connect, staying local:", e && e.message);
  });
})();

window.SHOP = {
  route: route,
  dishButtons: dishButtons,
  repaintRows: repaintRows,
  paintFab: paintFab,
  store: STORE,
  flow: FLOW
};
paintFab();

})();
