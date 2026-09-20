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
var AU = null;                 /* { auth, api } once loaded */

/* ---------- who is holding this phone ----------------------
   office    signed in with Google, and listed in staff/<uid>
   rider     signed in silently, then proved a 6-digit code
   guest     signed in silently, nothing more

   Riders and customers never see a login screen. The silent
   sign-in exists only so the rules can tell one phone from
   another; without it every phone looks identical to the
   database and no rule can protect anything.
   ----------------------------------------------------------- */
var ME = { uid:null, role:"guest", name:"", riderPhone:null, ready:false };
var mewatch = [];
function onMe(f){ mewatch.push(f); if(ME.ready) try{ f(); }catch(e){} }
function meFire(){ mewatch.slice().forEach(function(f){ try{ f(); }catch(e){} }); fire(); }

function digitsOnly(v){ return String(v || "").replace(/[^0-9]/g, ""); }

/* six digits, never starting with a zero so it cannot be
   mistyped as five, and never a run the eye will slip on */
function sixDigits(){
  var n = Math.floor(Math.random() * 900000) + 100000;
  return String(n);
}

/* where this site lives, so an invite link works from any host */
function siteRoot(){
  return location.href.split("#")[0].replace(/[^\/]*$/, "");
}
function riderLink(id){ return siteRoot() + "rider.html#join=" + id; }

/* the message the office sends a new rider on WhatsApp */
function riderInvite(r){
  var t = "*Hayat Fish and Mandi*\n\n" +
          "You are set up as a rider" + (r.name ? ", " + r.name : "") + ".\n\n" +
          "Open this once and add it to your home screen:\n" +
          riderLink(r.id) + "\n\n" +
          "Your code: *" + r.code + "*\n\n" +
          "Type your number and that code the first time. " +
          "After that it just opens.";
  return "https://wa.me/" + digitsOnly(r.phone) + "?text=" + encodeURIComponent(t);
}

/* Which of the three is speaking.

   When Firebase is connected this comes from who is signed in,
   so a rider cannot post as the restaurant however they reach
   the page. With no Firebase there is no identity to check at
   all — the whole thing is one device in demo mode — so the
   console you are standing in is the only answer available. */
function myVoice(){
  if(LIVE || ME.uid){
    if(ME.role === "office") return "office";
    if(ME.role === "rider")  return "rider";
    return "customer";
  }
  try{ if(sessionStorage.getItem("hayat_admin") === "1") return "office"; }catch(e){}
  if(riderPhone()) return "rider";
  return "customer";
}

/* The phone this device claimed as a rider lives in one place
   only: riderPhone() / setRiderPhone(), defined with the rider
   console further down. Declaring a second pair here shadowed
   those and quietly broke the rider's identity. One store. */

function orderId(){
  /* short, readable, and unique enough for a restaurant's day */
  var d = new Date();
  return "H" + String(d.getDate()).padStart(2,"0") +
         Math.random().toString(36).slice(2,5).toUpperCase();
}

async function connectFirebase(cfg){
  var appMod  = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js");
  var fsMod   = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
  var auMod   = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");
  var app = appMod.initializeApp(cfg);
  var db  = fsMod.getFirestore(app);
  var auth = auMod.getAuth(app);
  FB = { db: db, api: fsMod };
  AU = { auth: auth, api: auMod };

  /* Everyone gets an identity, quietly. A customer never notices;
     the office replaces theirs with Google when they sign in. */
  auMod.onAuthStateChanged(auth, function(user){
    if(!user){
      ME.uid = null; ME.role = "guest"; ME.name = ""; ME.ready = true;
      meFire();
      auMod.signInAnonymously(auth).catch(function(e){
        FAULT = (e && e.code) || "no-anon-signin"; meFire();
      });
      return;
    }
    ME.uid  = user.uid;
    ME.name = user.displayName || "";
    ME.riderPhone = riderPhone() || null;

    if(user.isAnonymous){
      ME.role = ME.riderPhone ? "rider" : "guest";
      ME.ready = true; meFire(); return;
    }

    /* a real Google account: the office only if the console says so */
    fsMod.getDoc(fsMod.doc(db, "staff", user.uid)).then(function(d){
      var r = d.exists() ? (d.data().role || "") : "";
      ME.role = (r === "office") ? "office" : "signed-in";
      ME.name = (d.exists() && d.data().name) || ME.name;
      ME.ready = true; meFire();
    }).catch(function(){
      ME.role = "signed-in"; ME.ready = true; meFire();
    });
  });

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

  /* ---- who is holding this phone ---- */
  me:      function(){ return ME; },
  onMe:    onMe,
  isOffice:function(){ return ME.role === "office"; },

  /* the names for the dropdown - codes are never sent here */
  crew: function(){
    if(!FB) return Promise.resolve([]);
    return FB.api.getDoc(FB.api.doc(FB.db, "crew", "_list"))
      .then(function(d){ return (d.exists() && d.data().people) || []; })
      .catch(function(){ return []; });
  },

  /* Signing in to the office: pick a name, type the code.
     The browser never learns the code. It offers one, and the
     rules accept the sign-in only if it matches the one stored
     beside that name. A wrong code is simply a refused write. */
  signInOffice: function(who, code){
    if(!FB || !AU) return Promise.reject(new Error("offline"));
    if(!ME.uid) return Promise.reject(new Error("no-identity"));
    return FB.api.setDoc(FB.api.doc(FB.db, "staff", ME.uid), {
      crew: String(who),
      code: String(code).trim(),
      role: "office",
      at: Date.now()
    }).then(function(){
      ME.role = "office";
      ME.name = String(who);
      try{ sessionStorage.setItem("hayat_admin", "1"); }catch(e){}
      meFire();
      return true;
    });
  },

  /* A customer signing in with Google.

     Their orders are already tied to the quiet anonymous identity
     this browser was given. linkWithPopup keeps that same identity
     and simply attaches Google to it, so nothing they have ordered
     is orphaned - the orders do not move, the account grows.

     If that Google account was already linked on another phone,
     Firebase refuses the link. Then we sign in to the older
     account instead, which is the one carrying their history. */
  signInGoogle: function(){
    if(!AU) return Promise.reject(new Error("offline"));
    var api = AU.api, auth = AU.auth;
    var prov = new api.GoogleAuthProvider();
    var user = auth.currentUser;

    var finish = function(res){
      ME.uid  = res.user.uid;
      ME.name = res.user.displayName || "";
      meFire();
      return res.user;
    };

    if(user && user.isAnonymous){
      return api.linkWithPopup(user, prov).then(finish).catch(function(e){
        var code = e && e.code;
        if(code === "auth/credential-already-in-use" ||
           code === "auth/email-already-in-use" ||
           code === "auth/provider-already-linked"){
          return api.signInWithPopup(auth, prov).then(finish);
        }
        throw e;
      });
    }
    return api.signInWithPopup(auth, prov).then(finish);
  },

  /* the orders this person can see: theirs, on any device they
     have signed in on */
  myOrders: function(){
    var me = ME.uid;
    if(!me) return [];
    return Object.keys(DB.orders).map(function(k){ return DB.orders[k]; })
      .filter(function(o){ return o.custUid && o.custUid === me; })
      .sort(function(a,b){ return b.at - a.at; });
  },

  signedInName: function(){ return ME.name || ""; },
  isGuest: function(){ return !ME.name; },
  signOut: function(){
    setRiderPhone(null);
    ME.role = "guest"; ME.name = "";
    try{ sessionStorage.removeItem("hayat_admin"); }catch(e){}
    meFire();
    if(!AU) return Promise.resolve();
    return AU.api.signOut(AU.auth);
  },

  /* A rider proves the 6-digit code without ever reading it.
     The write carries the code they typed; the rules compare it
     with the stored one and only then accept the claim. */
  claimRider: function(phone, code){
    var id = digitsOnly(phone);
    if(!FB) return Promise.reject(new Error("offline"));
    if(!ME.uid) return Promise.reject(new Error("no-identity"));
    return FB.api.updateDoc(FB.api.doc(FB.db, "riders", id), {
      codeTry: String(code).trim(),
      uid: ME.uid,
      claimedAt: Date.now()
    }).then(function(){
      setRiderPhone(id);
      ME.role = "rider";
      meFire();
      return id;
    });
  },
  onChange: function(f){ watchers.push(f);
    return function(){ watchers = watchers.filter(function(g){ return g!==f; }); }; },

  orders: function(){
    return Object.keys(DB.orders).map(function(k){ return DB.orders[k]; })
      .sort(function(a,b){ return (b.at||0) - (a.at||0); });
  },
  order: function(id){ return DB.orders[id] || null; },

  place: function(o){
    /* The last line of defence. The checkout guards this too, but
       an order with nothing in it must never reach the kitchen
       however it got here - a stale tab, a double tap, a cart
       emptied in another window. */
    if(!o || !(o.lines || []).length) return null;
    var id = orderId();
    /* who placed it, so it can be found again on another phone */
    o.custUid = ME.uid || null;
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
    /* An order edited down to nothing cannot be accepted or sent.
       Cancelling it is always allowed - that is how it is closed. */
    if(s !== "cancelled" && !(o.lines || []).length) return null;
    o.status = s;
    if(extra) for(var k in extra) o[k] = extra[k];
    (o.log = o.log || []).push({ s:s, at:Date.now() });

    /* The job is over: stop holding on to where the rider was. */
    var done = (s === "delivered" || s === "cancelled");
    if(done){ o.rLat = null; o.rLng = null; o.rAt = null; }

    if(FB){
      var patch = { status:s, log:o.log };
      if(done){ patch.rLat = null; patch.rLng = null; patch.rAt = null; }
      if(extra) for(var j in extra) patch[j] = extra[j];
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id), patch)
        .catch(function(e){ console.warn("setStatus", e); });
      fire();
    } else lsWrite();
    return o;
  },

  /* the office corrected something: lines, discount, address, phone */
  edit: function(id, patch){
    var o = DB.orders[id];
    if(!o) return null;
    for(var k in patch) o[k] = patch[k];
    o.total = money(o).total;
    o.editedAt = Date.now();
    if(FB){
      patch.total = o.total; patch.editedAt = o.editedAt;
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id), patch)
        .catch(function(e){ console.warn("edit", e); });
      fire();
    } else lsWrite();
    return o;
  },

  cancel: function(id, by, why){
    var o = DB.orders[id];
    if(!o) return null;
    o.status = "cancelled";
    o.cancelBy = by; o.cancelWhy = why || "";
    (o.log = o.log || []).push({ s:"cancelled", at:Date.now() });
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id),
        { status:"cancelled", cancelBy:by, cancelWhy:o.cancelWhy, log:o.log })
        .catch(function(e){ console.warn("cancel", e); });
      fire();
    } else lsWrite();
    return o;
  },

  /* a measured road distance, written once */
  setRoad: function(id, km, min){
    var o = DB.orders[id];
    if(!o) return;
    o.roadKm = +km.toFixed(2); o.roadMin = min;
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id), { roadKm:o.roadKm, roadMin:o.roadMin })
        .catch(function(e){ console.warn("setRoad", e); });
      fire();
    } else lsWrite();
  },

  /* the rider's phone, dropped onto the order every few seconds */
  ping: function(id, lat, lng){
    var o = DB.orders[id];
    if(!o) return;
    o.rLat = +lat.toFixed(6); o.rLng = +lng.toFixed(6); o.rAt = Date.now();
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id),
        { rLat:o.rLat, rLng:o.rLng, rAt:o.rAt })
        .catch(function(e){ console.warn("ping", e); });
      fire();
    } else lsWrite();
  },

  /* ---- the conversation on an order ----------------------
     One thread, three voices. The office, the rider and the
     customer all write into the same list, and all three see
     it. Nothing is deleted: an order's history should read
     the same to everyone later. */
  say: function(id, text){
    var o = DB.orders[id];
    var t = String(text || "").trim().slice(0, 600);
    if(!o || !t) return null;

    var n = { by: myVoice(), at: Date.now(), text: t,
              name: (ME.name || "").slice(0, 40) };

    o.notes = (o.notes || []).concat([n]);
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id),
        { notes: FB.api.arrayUnion(n) })
        .catch(function(e){ console.warn("say", e); });
      fire();
    } else lsWrite();
    return n;
  },

  /* ---- the money ------------------------------------------
     Marked by a person, never guessed. UPI cannot tell a web
     page that it was paid, so whoever saw the money says so. */
  setPaid: function(id, paid, mode){
    var o = DB.orders[id];
    if(!o) return null;
    var who = myVoice();
    var patch = {
      paid: !!paid,
      payMode: paid ? (mode || "cash") : null,
      paidAt: paid ? Date.now() : null,
      paidBy: paid ? who : null
    };
    for(var k in patch) o[k] = patch[k];
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "orders", id), patch)
        .catch(function(e){ console.warn("setPaid", e); });
      fire();
    } else lsWrite();
    return patch;
  },

  riders: function(){
    return Object.keys(DB.riders).map(function(k){ return DB.riders[k]; })
      .filter(function(r){ return !r.off; });
  },
  rider: function(id){ return DB.riders[id] || null; },

  /* The document id IS the phone, digits only. That is what lets a
     rider reach their own record without being able to list anyone
     else's — they address it directly, they never search for it. */
  addRider: function(name, phone){
    var id = digitsOnly(phone);
    if(!id) return null;
    var r = { id:id, name:name, phone:phone,
              code: sixDigits(), uid:null, claimedAt:null };
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "riders", id), r)
        .catch(function(e){ console.warn("addRider", e); });
      DB.riders[id] = r; fire();
    } else { DB.riders[id] = r; lsWrite(); }
    return id;
  },

  /* a fresh code, for a rider who lost the message or left */
  newCode: function(id){
    var r = DB.riders[id];
    if(!r) return null;
    var code = sixDigits();
    r.code = code; r.uid = null; r.claimedAt = null;
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "riders", id),
        { code:code, uid:null, claimedAt:null })
        .catch(function(e){ console.warn("newCode", e); });
      fire();
    } else lsWrite();
    return code;
  },

  invite: riderInvite,
  /* A name change is a plain edit. A phone change is a move:
     the phone is the document id, so the record is rewritten
     under the new number and every order pointing at the old
     one is repointed. The code survives, so a rider who has
     already claimed does not have to claim again — but their
     device did claim the OLD record, so they are asked once
     more. That is the honest trade for changing the number. */
  editRider: function(id, patch){
    var r = DB.riders[id];
    if(!r) return id;

    var moved = patch.phone && digitsOnly(patch.phone) !== id;
    if(!moved){
      Object.keys(patch).forEach(function(k){ r[k] = patch[k]; });
      if(FB){
        FB.api.updateDoc(FB.api.doc(FB.db, "riders", id), patch)
          .catch(function(e){ console.warn("editRider", e); });
        fire();
      } else lsWrite();
      return id;
    }

    var nid = digitsOnly(patch.phone);
    var moving = Object.assign({}, r, patch, { id:nid, uid:null, claimedAt:null });
    DB.riders[nid] = moving;
    delete DB.riders[id];

    var repoint = Object.keys(DB.orders).filter(function(k){
      return DB.orders[k].riderId === id;
    });
    repoint.forEach(function(k){ DB.orders[k].riderId = nid; });

    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "riders", nid), moving)
        .then(function(){ return FB.api.deleteDoc(FB.api.doc(FB.db, "riders", id)); })
        .catch(function(e){ console.warn("editRider move", e); });
      repoint.forEach(function(k){
        FB.api.updateDoc(FB.api.doc(FB.db, "orders", k), { riderId:nid })
          .catch(function(e){ console.warn("repoint", e); });
      });
      fire();
    } else lsWrite();
    return nid;
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
  delivered: { t:"Delivered",     s:"Enjoy it." },
  /* cancelled is not a step along the way: it is where the order stops */
  cancelled: { t:"Cancelled",     s:"This order was cancelled." }
};

/* what an order costs once a discount is applied */
function money(o){
  var sub = (o.lines || []).reduce(function(n,l){ return n + l.q * l.price; }, 0);
  var d = o.discount || null, off = 0;
  if(d && d.value > 0){
    off = (d.type === "pct") ? sub * Math.min(d.value, 100) / 100 : Math.min(d.value, sub);
  }
  off = Math.round(off);
  return { sub: sub, off: off, total: Math.max(0, sub - off) };
}
function discountLabel(o){
  var d = o.discount;
  if(!d || !d.value) return "";
  return d.type === "pct" ? d.value + "% off" : rupee(d.value) + " off";
}

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

/* ============================================================
   THE DISH FINDER
   ------------------------------------------------------------
   One flat list of everything that can be ordered, built once
   from the menu: every dish crossed with every size it comes
   in. Both the customer and the office search the same list,
   because a dish the office cannot find is a dish that never
   gets added to an order.
   ============================================================ */
var FIND = null;

/* ------------------------------------------------------------
   CALLING SOMEBODY

   tel: is right on a phone and wrong on a desktop, where it
   throws up "choose an app" for software nobody has installed.
   On a desktop the useful thing is the number itself, big
   enough to read out and one click to copy.
   ------------------------------------------------------------ */
function canDial(){
  try{
    if(navigator.maxTouchPoints > 1) return true;
    return window.matchMedia("(hover:none) and (pointer:coarse)").matches;
  }catch(e){ return false; }
}

function prettyPhone(v){
  var d = digitsOnly(v);
  if(d.length === 12 && d.indexOf("91") === 0)
    return "+91 " + d.slice(2,7) + " " + d.slice(7);
  if(d.length === 10) return d.slice(0,5) + " " + d.slice(5);
  return v;
}

/* a call control that does the right thing on whatever it is on */
function callBtn(phone, text, cls){
  if(!phone) return "";
  var c = cls || "shopbtn small";
  if(canDial())
    return '<a class="' + c + '" href="tel:' + esc(phone) + '">' + esc(text || "Call") + '</a>';
  return '<button class="' + c + ' shownum" data-num="' + esc(phone) + '">' +
         esc(text || "Call") + '</button>';
}

/* one delegated handler for every one of them */
document.addEventListener("click", function(e){
  var b = e.target.closest && e.target.closest("[data-num]");
  if(!b) return;
  e.preventDefault();
  var num = b.dataset.num;
  if(b.classList.contains("showing")){
    try{
      navigator.clipboard.writeText(num);
      shopToast("Number copied.");
    }catch(err){ shopToast(prettyPhone(num)); }
    return;
  }
  b.classList.add("showing");
  b.textContent = prettyPhone(num);
  b.title = "Click to copy";
});

/* ------------------------------------------------------------
   UPI

   upi://pay?... is a plain deep link every Indian payment app
   understands. Drawn as a QR the customer scans it from their
   own phone; tapped on a phone it opens their app directly.

   Free, no gateway, no percentage. The one thing it cannot do
   is tell this page the money arrived - so it never claims to.
   ------------------------------------------------------------ */
function upiCfg(){
  var u = (C().upi) || {};
  return (u.id && String(u.id).indexOf("@") > 0) ? u : null;
}

function upiLink(o){
  var u = upiCfg();
  if(!u) return "";
  var m = money(o);
  return "upi://pay" +
    "?pa=" + encodeURIComponent(u.id) +
    "&pn=" + encodeURIComponent(u.name || "Hayat") +
    "&am=" + encodeURIComponent(String(m.total)) +
    "&cu=INR" +
    "&tn=" + encodeURIComponent("Order " + o.id);
}

function payBlock(o, who){
  var u = upiCfg();
  var m = money(o);

  if(o.paid){
    return '<div class="paid on">' +
      '<span class="pdot">\u2713</span>' +
      '<div class="pt"><b>Paid</b><small>' +
        esc(o.payMode === "upi" ? "By UPI" : "Cash") + ' \u00b7 ' + when(o.paidAt) +
        (o.paidBy ? ' \u00b7 ' + esc((VOICE[o.paidBy]||{}).t || o.paidBy) : '') +
      '</small></div>' +
      (who === "customer" ? '' :
        '<button class="linky" data-paid="' + esc(o.id) + '|0">Not paid</button>') +
    '</div>';
  }

  var qr = "";
  if(u){
    var link = upiLink(o);
    try{
      qr = '<div class="upi">' +
        '<img class="upiqr" alt="Scan to pay ' + esc(rupee(m.total)) + '" src="' +
          esc(window.qrSvg(link, 320)) + '">' +
        '<div class="upit"><b>' + esc(rupee(m.total)) + '</b>' +
          '<small>Scan with Google Pay, PhonePe or Paytm</small>' +
          (canDial() ? '<a class="shopbtn small" href="' + esc(link) + '">Open my UPI app</a>' : '') +
        '</div>' +
      '</div>';
    }catch(e){ qr = ""; }
  }

  return '<div class="paid off">' +
    '<div class="pt"><b>Not paid yet</b><small>' +
      (u ? "Scan the code, or hand over cash." : "Cash on delivery.") + '</small></div>' +
    (who === "customer" ? '' :
      '<div class="prow">' +
        '<button class="shopbtn small" data-paid="' + esc(o.id) + '|1|cash">Cash taken</button>' +
        (u ? '<button class="shopbtn small ghost" data-paid="' + esc(o.id) + '|1|upi">Paid by UPI</button>' : '') +
      '</div>') +
  '</div>' + qr;
}

/* one handler for every Paid button anywhere */
function wirePaid(main, after){
  main.querySelectorAll("[data-paid]").forEach(function(b){
    b.onclick = function(){
      var p = b.dataset.paid.split("|");
      STORE.setPaid(p[0], p[1] === "1", p[2]);
      shopToast(p[1] === "1" ? "Marked paid." : "Marked unpaid.");
      if(after) after();
    };
  });
}

function dishById(id){
  var menu = (window.MENU || []);
  for(var i = 0; i < menu.length; i++){
    var items = menu[i].items || [];
    for(var j = 0; j < items.length; j++){
      if(items[j].id === id) return items[j];
    }
  }
  return null;
}

function findIndex(){
  if(FIND) return FIND;
  FIND = [];
  var menu = (window.MENU || []);
  menu.forEach(function(cat){
    (cat.items || []).forEach(function(it){
      choices(it).forEach(function(c){
        FIND.push({
          id: it.id,
          name: label(it.name),
          sub: it.sub ? label(it.sub) : "",
          cat: label(cat.name),
          catId: cat.id,
          label: c.label,
          price: c.price,
          hay: (label(it.name) + " " + (it.sub ? label(it.sub) : "") + " " +
                label(cat.name) + " " + c.label).toLowerCase()
        });
      });
    });
  });
  return FIND;
}

/* Words in any order, each one has to appear somewhere. Typing
   "mandi chicken" finds Chicken Mandi, which is how people
   actually remember a dish. */
function findDishes(q, cap){
  var words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length) return [];
  var hits = findIndex().filter(function(r){
    return words.every(function(w){ return r.hay.indexOf(w) >= 0; });
  });
  /* a name that starts with what they typed belongs at the top */
  var first = words[0];
  hits.sort(function(a,b){
    var an = a.name.toLowerCase().indexOf(first) === 0 ? 0 : 1;
    var bn = b.name.toLowerCase().indexOf(first) === 0 ? 0 : 1;
    if(an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });
  return hits.slice(0, cap || 24);
}

function findRowHtml(r, action){
  return '<button class="findrow" data-find="' + esc(r.id + "|" + r.label + "|" + r.price) + '">' +
    '<span class="fnd">' +
      '<b>' + esc(r.name) + '</b>' +
      (r.label ? '<span class="fsize">' + esc(r.label) + '</span>' : '') +
      '<small>' + esc(r.cat) + '</small>' +
    '</span>' +
    '<span class="fpr">' + rupee(r.price) + '</span>' +
    '<span class="fadd">' + esc(action || "Add") + '</span>' +
  '</button>';
}

/* Wires a search box to a results panel. onPick gets
   (dishId, sizeLabel, price, row). */
function wireFinder(inputId, panelId, onPick, action){
  var box = el(inputId), panel = el(panelId);
  if(!box || !panel) return;

  var draw = function(){
    var q = box.value.trim();
    if(!q){ panel.innerHTML = ""; panel.classList.remove("on"); return; }
    var hits = findDishes(q);
    panel.classList.add("on");
    panel.innerHTML = hits.length
      ? hits.map(function(r){ return findRowHtml(r, action); }).join("")
      : '<p class="shopnote fnone">Nothing matches \u201c' + esc(q) + '\u201d.</p>';
    panel.querySelectorAll("[data-find]").forEach(function(b){
      b.onclick = function(){
        var parts = b.dataset.find.split("|");
        var price = +parts[parts.length - 1];
        var lbl   = parts.slice(1, -1).join("|");
        onPick(parts[0], lbl, price, b);
      };
    });
  };

  var job = null;
  box.addEventListener("input", function(){
    clearTimeout(job);
    job = setTimeout(draw, 110);      /* let them finish the word */
  });
  box.addEventListener("focus", draw);
  box.addEventListener("keydown", function(e){
    if(e.key === "Escape"){ box.value = ""; draw(); box.blur(); }
  });
  return draw;
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

/* ------------------------------------------------------------
   YOUR ORDERS

   Someone who closes the tab has lost their order, and the only
   free way to hand it back on a new phone is an account they
   already have. Nearly every Android here has Google on it, so
   that is one tap and no SMS to pay for.

   It is only ever for finding your own orders. No lookup by
   phone number: a stranger who knew a customer's number would
   otherwise be reading their home address.
   ------------------------------------------------------------ */
function signInStrip(){
  if(!STORE.live()) return "";
  if(!STORE.isGuest())
    return '<div class="youare"><span>Signed in as <b>' +
      esc(STORE.signedInName()) + '</b></span>' +
      '<a class="linky" href="#/orders">Your orders</a></div>';
  return '<div class="youare guest">' +
    '<div class="yt"><b>Keep your orders</b>' +
      '<small>Sign in once and you can follow them from any phone.</small></div>' +
    '<button class="shopbtn small" id="gIn">Sign in with Google</button>' +
  '</div>';
}

function wireSignIn(main, after){
  var b = el("gIn");
  if(!b) return;
  b.onclick = function(){
    b.disabled = true;
    b.textContent = "Opening\u2026";
    STORE.signInGoogle().then(function(){
      shopToast("Signed in. Your orders will follow you now.");
      if(after) after();
    }).catch(function(e){
      b.disabled = false;
      b.textContent = "Sign in with Google";
      var code = (e && e.code) || "";
      if(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      shopToast("That did not work. You can still use the link we send you.");
    });
  };
}

function viewMyOrders(main){
  var mine = STORE.myOrders();
  var open = mine.filter(function(o){
    return o.status !== "delivered" && o.status !== "cancelled";
  });
  var past = mine.filter(function(o){
    return o.status === "delivered" || o.status === "cancelled";
  });

  var card = function(o){
    return '<a class="jobcard" href="#/o/' + esc(o.id) + '">' +
      '<div class="brow"><b>' + esc(o.id) + '</b>' +
        '<span class="status s-' + o.status + '">' + esc(STEP[o.status].t) + '</span>' +
        '<span class="btime">' + when(o.at) + '</span></div>' +
      '<div class="baddr">' + (o.lines||[]).map(function(l){
        return l.q + "\u00d7 " + esc(l.name);
      }).join(" \u00b7 ") + '</div>' +
      '<div class="brow"><span class="btot">' + rupee(o.total) + '</span>' +
        noteTag(o) + '</div></a>';
  };

  main.innerHTML = shell("Your orders",
    signInStrip() +
    (STORE.isGuest()
      ? '<p class="shopsub">Sign in above and any order you place will be ' +
        'here, on whichever phone you use.</p>'
      : (open.length
          ? '<h3 class="mini">Still going</h3>' + open.map(card).join("")
          : '<p class="shopsub">Nothing on the way right now.</p>') +
        (past.length ? '<h3 class="mini">Before this</h3>' + past.slice(0,20).map(card).join("") : '')
    ) +
    '<button class="shopbtn ghost" data-go="#/">Browse the menu</button>');

  wireSignIn(main, function(){ viewMyOrders(main); });
}

/* Search sits at the top of the cart. Someone who has just
   added one thing usually knows exactly what the second thing
   is - making them walk back through the categories to find it
   is the slowest possible way to take their money. */
function cartFinder(){
  return '<div class="finder cartfind">' +
    '<input class="fld" id="ctFind" autocomplete="off" ' +
      'placeholder="Search the menu\u2026 chicken, mandi, juice">' +
    '<div class="findpanel" id="ctFindOut"></div>' +
  '</div>';
}

function wireCartFinder(main){
  wireFinder("ctFind", "ctFindOut", function(did, lbl, price, btn){
    var it = dishById(did);
    addLine(did, it ? label(it.name) : did, lbl, price);
    btn.classList.add("done");
    btn.querySelector(".fadd").textContent = "Added \u2713";
    paintFab();
    setTimeout(function(){ viewCart(main); }, 260);
  }, "Add");
}

function viewCart(main){
  if(!CART.length){
    main.innerHTML = shell("Your cart",
      '<p class="shopsub">Nothing in it yet.</p>' +
      cartFinder() +
      '<button class="shopbtn ghost" data-go="#/">Browse the menu</button>');
    wireCartFinder(main);
    return;
  }
  main.innerHTML = shell("Your cart",
    signInStrip() +
    cartFinder() +
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
    '<button class="shopbtn ghost" data-go="#/">Browse the menu</button>');

  wireCartFinder(main);
  wireSignIn(main, function(){ viewCart(main); });
}

function viewCheckout(main){
  if(!CART.length){ location.hash = "#/"; return; }
  var saved = {};
  try{ saved = JSON.parse(localStorage.getItem("hayat_me")) || {}; }catch(e){}

  main.innerHTML = shell("Where is it going?",
    /* A browser will offer the number it already has, in one tap,
       but only if the field says what it is. name and autocomplete
       are what turn three fields into a single autofill. */
    '<input class="fld" id="coName" name="name" autocomplete="name" ' +
      'placeholder="Your name" value="' + esc(saved.name||"") + '">' +
    '<input class="fld" id="coPhone" name="tel" type="tel" autocomplete="tel" ' +
      'inputmode="tel" placeholder="Phone number" value="' + esc(saved.phone||"") + '">' +
    '<textarea class="fld" id="coAddr" name="street-address" autocomplete="street-address" ' +
      'placeholder="Address \u2014 house, landmark, area">' + esc(saved.addr||"") + '</textarea>' +
    '<div class="pinwrap">' +
      '<div class="pinhead"><b>Drop the pin on your gate</b>' +
        '<button class="pinme" id="coHere">Use my location</button></div>' +
      '<div id="comap" class="comap"></div>' +
      '<div class="pinnote" id="coPinTxt">Drag the map so the pin sits on your door. ' +
        'The rider follows this, not the address.</div>' +
    '</div>' +
    '<input class="fld" id="coNote"  placeholder="Anything we should know? (optional)">' +
    '<div class="total"><span>' + cartCount() + ' item(s)</span><b>' + rupee(cartTotal()) + '</b></div>' +
    (STORE.live() && STORE.isGuest()
      ? '<div class="youare guest">' +
          '<div class="yt"><b>One tap before you order</b>' +
            '<small>So this order comes back to you on any phone, ' +
            'and we know who to call.</small></div>' +
          '<button class="shopbtn small" id="coIn">Sign in with Google</button>' +
        '</div>'
      : '') +
    '<button class="shopbtn" id="coGo">Place the order</button>' +
    '<p class="shopnote">Pay on delivery. We will call if anything is unclear.</p>' +
    '<button class="shopbtn ghost" data-go="#/cart">Back to the cart</button>');

  mountMap(saved);

  var gi = el("coIn");
  if(gi) gi.onclick = function(){
    gi.disabled = true; gi.textContent = "Opening\u2026";
    STORE.signInGoogle().then(function(){
      shopToast("Thank you. You can order now.");
      viewCheckout(main);
    }).catch(function(e){
      gi.disabled = false; gi.textContent = "Sign in with Google";
      var code = (e && e.code) || "";
      if(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      shopToast("That did not work. Try again.");
    });
  };

  el("coGo").onclick = function(){
    /* Browsing and filling the cart ask nothing of anybody. The
       line is here, at the point where an order becomes a promise
       the kitchen has to keep: we want to be able to hand it back
       to them later, on whatever phone they pick up next. */
    if(STORE.live() && STORE.isGuest()){
      shopToast("Sign in first, so you can follow this order.");
      var g = el("coIn");
      if(g){ g.scrollIntoView({ behavior:"smooth", block:"center" }); g.focus(); }
      return;
    }
    var name  = el("coName").value.trim(),
        phone = el("coPhone").value.trim(),
        addr  = el("coAddr").value.trim();
    if(!CART.length){
      shopToast("Your cart is empty.");
      location.hash = "#/cart";
      return;
    }
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
    if(!id){ shopToast("Something went wrong. Nothing was ordered."); return; }
    CART = []; saveCart();
    location.hash = "#/o/" + id;
  };
}

/* ---------- the pin -----------------------------------------
   Leaflet on OpenStreetMap tiles: free, no key, no billing.
   An address in Makkaraparamba is a landmark, not a house number,
   so the pin is what the rider actually follows.
   ------------------------------------------------------------ */
/* index.html declares  let L  for the language code. A top-level let
   shadows window.L for every later script, so Leaflet is ALWAYS reached
   as window.L here — a bare L is the string "en". */
var PIN = null, MAP = null;
/* Where Hayat Fish and Mandi actually is. Every map opens here,
   every distance is measured from here, and the recentre button
   comes back here.

   To set it exactly: open Google Maps, right-click the shop's
   front door, click the numbers at the top of the menu - that
   copies "11.0065785, 76.1270507" - and paste it into
   config.js as  shop: { lat: ..., lng: ... }. */
var HOME = (function(){
  var c = ((window.CONFIG || {}).shop) || null;
  if(c && typeof c.lat === "number" && typeof c.lng === "number") return c;
  return { lat: 11.0065785, lng: 76.1270507 };
})();
var HOMEZOOM = (((window.CONFIG || {}).shop) || {}).zoom || 14;

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

/* A map built while its box is still zero-wide draws nothing and stays
   blank — a phone rotating, a panel mid-open, a tab restored in the
   background. Re-measure whenever the box changes size. */
function watchSize(box, map){
  var kick = function(){ try{ map.invalidateSize(); }catch(e){} };
  setTimeout(kick, 60);
  setTimeout(kick, 400);
  setTimeout(kick, 1200);
  try{
    if(window.ResizeObserver){
      var ro = new ResizeObserver(kick);
      ro.observe(box);
      map.on("unload", function(){ try{ ro.disconnect(); }catch(e){} });
    }
  }catch(e){}
  window.addEventListener("orientationchange", kick);
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
    var LF = window.L;                 /* never the bare L: see note above */
    MAP = LF.map(box, { zoomControl:true, attributionControl:true })
           .setView([at.lat, at.lng], PIN ? 17 : 15);
    tameMap(MAP, box);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(MAP);

    /* the pin is fixed to the centre of the box; the map moves under it */
    MAP.on("move", function(){ PIN = MAP.getCenter(); });
    MAP.on("moveend", function(){
      PIN = MAP.getCenter();
      pinText("Pin set \u00b7 " + PIN.lat.toFixed(5) + ", " + PIN.lng.toFixed(5));
    });
    watchSize(box, MAP);
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
  var m = money(o);
  var shop = ((C().delivery || [])[0] || {}).number || C().whatsapp || "";

  /* Cancelling is theirs to do only while nothing has been cooked or
     sent. After that it is a phone call, not a button. */
  var canCancel = (o.status === "placed" || o.status === "accepted");

  if(o.status === "cancelled"){
    main.innerHTML = shell("Order " + esc(o.id),
      '<div class="revwrap" style="text-align:center;padding:34px 10px">' +
        '<div style="font-size:40px">\u2298</div>' +
        '<h3 class="revh">This order was cancelled</h3>' +
        '<p class="revsub">' + (o.cancelBy === "customer" ? "You cancelled it."
            : "We cancelled it.") + (o.cancelWhy ? ' ' + esc(o.cancelWhy) : '') + '</p>' +
      '</div>' +
      '<div class="rowbtns">' +
        callBtn(shop, "Call the restaurant") +
        '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
          esc(wa(C().whatsapp, "Hayat \u2014 about order " + o.id + "\n\n")) + '">WhatsApp</a>' +
      '</div>' +
      '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');
    return;
  }

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
        callBtn(rider.phone, "Call", "callbtn") + '</div>'
      : '') +

    /* once the rider is moving, show them moving */
    (o.rLat && at >= 2 && o.status !== "delivered"
      ? '<div id="trackmap" class="comap trackmap"></div>' +
        '<p class="pinnote" id="trackNote">' +
          (function(){
            if(!o.lat) return "Updated " + when(o.rAt);
            var R = 6371, rad = Math.PI/180;
            var dLat = (o.rLat - o.lat) * rad, dLng = (o.rLng - o.lng) * rad;
            var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                    Math.cos(o.lat*rad)*Math.cos(o.rLat*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);
            var km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return (km < 0.2 ? "Almost at your door"
                  : km < 1   ? Math.round(km*1000) + " m away"
                             : km.toFixed(1) + " km away") + " \u00b7 " + when(o.rAt);
          })() + '</p>'
      : '') +

    '<div class="lines">' + (o.lines||[]).map(function(l){
      return '<div class="line"><div class="ln"><b>' + esc(l.name) + '</b>' +
        (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</div>' +
        '<div class="lq">×' + l.q + '</div>' +
        '<div class="lp">' + rupee(l.q * l.price) + '</div></div>';
    }).join("") + '</div>' +
    (m.off ? '<div class="total sub"><span>Subtotal</span><b>' + rupee(m.sub) + '</b></div>' +
             '<div class="total sub off"><span>' + esc(discountLabel(o)) + '</span><b>\u2212 ' +
             rupee(m.off) + '</b></div>' : '') +
    '<div class="total"><span>Total</span><b>' + rupee(m.total) + '</b></div>' +
    '<p class="shopnote">' + esc(o.addr) + '</p>' +
    '<div class="rowbtns">' +
      callBtn(shop, "Call us") +
      '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
        esc(wa(C().whatsapp, "Hayat \u2014 about order " + o.id + "\n\n")) + '">WhatsApp</a>' +
      (o.lat ? '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
        esc(mapsPin(o)) + '">Pin in Maps</a>' : '') +
    '</div>' +
    payBlock(o, "customer") +
    noteThread(o, "Anything we should know? Gate code, landmark\u2026") +
    (canCancel
      ? '<button class="shopbtn ghost danger" id="obCancel">Cancel this order</button>'
      : '<p class="shopnote">To change anything now, please call us.</p>') +
    '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');

  wireNotes(main, id, function(){ viewOrder(main, id); });

  var cb = el("obCancel");
  if(cb) cb.onclick = function(){
    if(!window.confirm("Cancel order " + o.id + "?")) return;
    STORE.cancel(o.id, "customer", "");
    viewOrder(main, id);
  };

  if(o.rLat && at >= 2 && o.status !== "delivered") drawTrackMap(o);
}

/* the customer's own little map: their pin, and the rider closing in */
var TMAP = null, TDOTS = null;
function drawTrackMap(o){
  var box = el("trackmap");
  if(!box || !o.rLat) return;
  loadLeaflet().then(function(){
    var LF = window.L;
    try{ if(box._leaflet_id){ box._leaflet_id = null; box.innerHTML = ""; } }catch(e){}
    TMAP = LF.map(box, { zoomControl:false, attributionControl:true, dragging:true });
    tameMap(TMAP, box);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:19, attribution:"&copy; OpenStreetMap" }).addTo(TMAP);

    var dest = (o.lat && o.lng) ? [o.lat, o.lng] : [HOME.lat, HOME.lng];
    LF.marker(dest, { icon: LF.divIcon({ className:"omark",
      html:'<span class="dot" style="background:#E4705A"></span><span class="tag">You</span>',
      iconSize:null, iconAnchor:[7,7] }) }).addTo(TMAP);

    var r = o.riderId ? STORE.rider(o.riderId) : null;
    var ride = LF.marker([o.rLat, o.rLng], { zIndexOffset:500, icon: LF.divIcon({
      className:"omark bike",
      html:'<span class="bikedot">\uD83C\uDFCD</span>' +
           '<span class="tag">' + esc(r ? shortName(r.name) : "Rider") + '</span>',
      iconSize:null, iconAnchor:[14,14] }) }).addTo(TMAP)
      .bindPopup("<b>" + esc(r ? r.name : "Your rider") + "</b><br>" +
                 "last seen " + when(o.rAt));
    TDOTS = ride;

    TMAP.fitBounds([dest, [o.rLat, o.rLng]], { padding:[40,40], maxZoom:16 });
    watchSize(box, TMAP);
  }).catch(function(){});
}

/* ============================================================
   MAKING A MAP BEHAVE INSIDE A SCROLLING PAGE
   ------------------------------------------------------------
   A Leaflet map swallows every gesture that lands on it. On a
   phone that means the page stops scrolling the moment your
   thumb crosses the map, which feels broken - because it is.

   So we do what Google's own embeds do:

     one finger   scrolls the page, and a hint says why
     two fingers  move the map
     wheel        scrolls the page
     ctrl + wheel zooms the map

   Nothing is taken away. Everything is still reachable, it
   just stops fighting the page.
   ============================================================ */
function tameMap(map, box){
  if(!map || !box) return;
  var LB = (window.L && window.L.Browser) || {};
  var touch = !!(LB.mobile || ("ontouchstart" in window) || navigator.maxTouchPoints > 0);

  /* ---- the hint that appears only when it is needed ---- */
  var hint = document.createElement("div");
  hint.className = "maphint";
  hint.textContent = touch ? "Use two fingers to move the map"
                           : "Hold ctrl and scroll to zoom";
  box.appendChild(hint);
  var hideJob = null;
  function flash(){
    hint.classList.add("on");
    clearTimeout(hideJob);
    hideJob = setTimeout(function(){ hint.classList.remove("on"); }, 1400);
  }
  function calm(){ clearTimeout(hideJob); hint.classList.remove("on"); }

  /* ---- the wheel ---- */
  map.scrollWheelZoom.disable();
  box.addEventListener("wheel", function(e){
    if(e.ctrlKey || e.metaKey){
      if(!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      calm();
    } else {
      if(map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
      flash();          /* the page scrolls; say why the map did not */
    }
  }, { passive:true });

  /* ---- fingers ---- */
  if(touch){
    map.dragging.disable();
    box.addEventListener("touchstart", function(e){
      if(e.touches.length > 1){ map.dragging.enable(); calm(); }
      else { map.dragging.disable(); }
    }, { passive:true });
    box.addEventListener("touchmove", function(e){
      if(e.touches.length === 1) flash();
    }, { passive:true });
    box.addEventListener("touchend", function(){
      if(!map._hayatHold) map.dragging.disable();
    }, { passive:true });
  }

  /* ---- back to the shop, always in reach ---- */
  var home = document.createElement("button");
  home.type = "button";
  home.className = "maphome";
  home.title = "Back to the restaurant";
  home.setAttribute("aria-label", "Back to the restaurant");
  home.innerHTML = "\u2302";
  home.onclick = function(){
    try{ map.setView([HOME.lat, HOME.lng], HOMEZOOM, { animate:true }); }catch(e){}
  };
  box.appendChild(home);

  /* ---- a way to give the map the whole gesture, deliberately ---- */
  var hold = document.createElement("button");
  hold.type = "button";
  hold.className = "maphold";
  hold.textContent = "Move the map";
  hold.setAttribute("aria-pressed", "false");
  hold.onclick = function(){
    map._hayatHold = !map._hayatHold;
    hold.classList.toggle("on", map._hayatHold);
    hold.setAttribute("aria-pressed", map._hayatHold ? "true" : "false");
    hold.textContent = map._hayatHold ? "Done" : "Move the map";
    box.classList.toggle("held", map._hayatHold);
    if(map._hayatHold){ map.dragging.enable(); map.scrollWheelZoom.enable(); calm(); }
    else { if(touch) map.dragging.disable(); map.scrollWheelZoom.disable(); }
  };
  box.appendChild(hold);

  return map;
}

/* ============================================================
   THE THREAD ON AN ORDER
   ------------------------------------------------------------
   The same component in all three consoles. Who is speaking is
   decided by who is signed in, never by which page you are on,
   so a rider cannot post as the restaurant.
   ============================================================ */
var VOICE = {
  office:   { t:"Restaurant", c:"vo" },
  rider:    { t:"Rider",      c:"vr" },
  customer: { t:"Customer",   c:"vc" }
};

/* how many messages an order carries, for the board */
/* the money, at a glance, on a card */
function payTag(o){
  if(o.status !== "delivered" && !o.paid) return "";
  return o.paid
    ? '<span class="ptag on">\u2713 paid</span>'
    : '<span class="ptag off">unpaid</span>';
}

function noteTag(o){
  var n = (o.notes || []).length;
  return n ? '<span class="nbadge" title="' + n + ' message' + (n>1?'s':'') +
             '">\uD83D\uDCAC ' + n + '</span>' : '';
}

/* What someone has typed but not yet sent, kept per order.
   Belt and braces beside isTyping(): if a repaint does slip
   through, the words are still there afterwards. */
var DRAFT = {};

function noteThread(o, placeholder){
  var notes = (o.notes || []).slice().sort(function(a,b){ return a.at - b.at; });
  return '<div class="notes">' +
    '<div class="noteshead">Messages</div>' +
    (notes.length
      ? notes.map(function(n){
          var v = VOICE[n.by] || VOICE.customer;
          return '<div class="note ' + v.c + '">' +
            '<div class="nwho"><b>' + esc(v.t) + '</b>' +
            (n.name ? ' <span class="nrole">' + esc(n.name) + '</span>' : '') +
            '<span class="nat">' + when(n.at) + '</span></div>' +
            '<p>' + esc(n.text) + '</p></div>';
        }).join("")
      : '<p class="shopnote nonotes">Nothing here yet.</p>') +
    '<div class="notebox">' +
      '<textarea class="fld" id="noteTxt" rows="2" placeholder="' +
        esc(placeholder || "Write a message\u2026") + '">' +
        esc(DRAFT[o.id] || "") + '</textarea>' +
      '<button class="shopbtn small" id="noteAdd">Send</button>' +
    '</div>' +
  '</div>';
}

function wireNotes(main, id, after){
  var box = el("noteTxt"), btn = el("noteAdd");
  if(!box || !btn) return;

  /* if they were mid-sentence when something redrew the page,
     put the caret back where they left it */
  if(DRAFT[id]){
    try{ box.setSelectionRange(box.value.length, box.value.length); }catch(e){}
  }
  box.addEventListener("input", function(){
    if(box.value) DRAFT[id] = box.value; else delete DRAFT[id];
  });

  var send = function(){
    var t = box.value.trim();
    if(!t){ box.focus(); return; }
    STORE.say(id, t);
    box.value = "";
    delete DRAFT[id];
    if(after) after();
  };
  btn.onclick = send;
  box.addEventListener("keydown", function(e){
    /* Enter sends, Shift+Enter makes a new line - what everyone
       already expects from every chat they use */
    if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); }
  });
}

/* ============================================================
   BUSINESS
   ============================================================ */
function unlocked(){ try{ return sessionStorage.getItem("hayat_admin")==="1"; }catch(e){ return false; } }

/* ------------------------------------------------------------
   The office door.

   With Firebase up: pick your name, type your code. The code
   is checked by the security rules, not by this file, so
   reading this source tells an attacker nothing.

   With Firebase down: the old passcode, so the demo still runs
   on one machine with no network. That path can only ever reach
   this browser's own data, which is why it is safe to keep.
   ------------------------------------------------------------ */
function gate(main, then){
  if(unlocked() || STORE.isOffice()) return then();

  if(!STORE.live()){
    main.innerHTML = shell("Staff only",
      '<input class="fld" id="pw" type="password" placeholder="Passcode" inputmode="numeric">' +
      '<button class="shopbtn" id="pwGo">Unlock</button>' +
      '<p class="shopnote">Offline. This unlocks the copy held on this ' +
      'device only \u2014 nothing here reaches the restaurant.</p>');
    var unlock = function(){
      if(el("pw").value === PASS){
        try{ sessionStorage.setItem("hayat_admin","1"); }catch(e){}
        then();
      } else shopToast("Wrong passcode.");
    };
    el("pwGo").onclick = unlock;
    onEnter(el("pw"), unlock);
    el("pw").focus();
    return;
  }

  main.innerHTML = shell("Staff only",
    '<div id="crewWrap"><p class="shopsub">Loading\u2026</p></div>');

  STORE.crew().then(function(people){
    if(!people.length){
      el("crewWrap").innerHTML =
        '<p class="shopsub">No staff have been set up yet.</p>' +
        '<p class="shopnote">Firebase console \u2192 Firestore \u2192 crew ' +
        '\u2192 add a person, and crew/_list to show them here.</p>';
      return;
    }
    el("crewWrap").innerHTML =
      '<select class="fld" id="crewWho">' +
        people.map(function(p){
          return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
        }).join("") +
      '</select>' +
      '<input class="fld" id="crewCode" type="password" inputmode="numeric" ' +
        'autocomplete="off" placeholder="Your code">' +
      '<button class="shopbtn" id="crewGo">Sign in</button>' +
      '<p class="shopnote" id="crewNote">Ask Majid if you do not have a code.</p>';

    var busy = false;
    var go = function(){
      if(busy) return;
      var who = el("crewWho").value, code = el("crewCode").value.trim();
      if(!code){ el("crewCode").focus(); return; }
      busy = true;
      el("crewGo").textContent = "Checking\u2026";
      STORE.signInOffice(who, code).then(function(){
        then();
      }).catch(function(){
        busy = false;
        el("crewGo").textContent = "Sign in";
        el("crewCode").value = "";
        el("crewCode").focus();
        el("crewNote").textContent = "That code did not match. Try again.";
      });
    };
    el("crewGo").onclick = go;
    onEnter(el("crewCode"), go);
    onEnter(el("crewWho"), go);
    el("crewCode").focus();
  });
}

function viewAdmin(main){
  gate(main, function(){ paintAdmin(main); });
}

function paintAdmin(main){
  var orders = STORE.orders(), riders = STORE.riders();
  var gone   = orders.filter(function(o){ return o.status === "cancelled"; });
  var live   = orders.filter(function(o){ return o.status !== "delivered" && o.status !== "cancelled"; });
  var done   = orders.filter(function(o){ return o.status === "delivered"; });
  var pinned = orders.filter(function(o){ return o.lat && o.lng && o.status !== "cancelled"; });

  /* The office is a console, not a page. It fills the window and
     never scrolls as a whole: the board scrolls inside its columns,
     the list inside itself, and the map simply takes what is left.
     Nothing important slides off the top while you work. */
  main.innerHTML =
    '<div class="console">' +
      /* The controls float over the work rather than sitting in a
         band above it. A kitchen screen has one job on it, and
         every row of chrome is a row of orders nobody can see. */
      '<div class="conbar">' +
        '<div class="tabs">' +
          ['board','list','map'].map(function(v){
            return '<button class="tab' + (ADVIEW===v ? " on" : "") + '" data-view="' + v + '">' +
              (v==="board" ? "Board" : v==="list" ? "List" : "Map") + '</button>';
          }).join("") +
        '</div>' +
        '<div class="adminbar">' +
          '<span class="pill">' + live.length + ' live</span>' +
          '<span class="pill quiet">' + done.length + '</span>' +
          (gone.length ? '<span class="pill gone">' + gone.length + '</span>' : '') +
        '</div>' +
      '</div>' +

      connBanner() +

      '<div class="conbody' + (ADVIEW === "map" ? " nomargin" : "") + '">' +
        (ADVIEW === "map"
          ? '<div id="admap" class="admap"></div>' +
            '<div class="admaplegend">' +
              '<span class="lg s-placed">new</span>' +
              '<span class="lg s-accepted">kitchen</span>' +
              '<span class="lg s-on_way">on the way</span>' +
              '<span class="lg s-delivered">delivered</span>' +
            '</div>' +
            (pinned.length ? '' : '<p class="shopsub floatnote">No order has a pin yet.</p>')

          : ADVIEW === "board"
          ? (orders.length ? boardHtml(orders.filter(function(o){ return o.status !== "cancelled"; }))
                           : '<p class="shopsub">No orders yet.</p>')

          : '<div class="conscroll">' +
            (orders.length ? orders.map(orderCard).join("")
                           : '<p class="shopsub">No orders yet.</p>') + '</div>') +
      '</div>' +

      /* the two things you reach for, always in the same corner */
      /* No way out to the customer's menu. This is a till, and a
         till does not have a browse button on it. */
      '<div class="condock">' +
        '<button class="dockbtn" data-go="#/admin/riders" title="Riders">' +
          '\uD83C\uDFCD<span class="dockn">' + riders.length + '</span></button>' +
      '</div>' +
    '</div>';

  main.querySelectorAll("[data-view]").forEach(function(b){
    b.onclick = function(){
      /* Opening the map is a fresh look, so it starts on the
         restaurant. Panning about while it is already open is
         remembered, so a repaint does not yank it back. */
      if(b.dataset.view === "map" && ADVIEW !== "map") AVIEW = null;
      ADVIEW = b.dataset.view;
      try{ localStorage.setItem("hayat_adview", ADVIEW); }catch(e){}
      paintAdmin(main);
    };
  });

  if(ADVIEW === "map") drawAdminMap(pinned);
  pinned.forEach(measureRoad);
  /* a rider's dot only has to be chased while a ride is under way */
  liveWatch(ADVIEW === "map" && pinned.some(function(o){
    return o.status === "assigned" || o.status === "on_way";
  }), main);
  wireCards(main);
}

/* Firestore already pushes a change the moment it happens, so this is
   only a safety net for a connection that fell asleep. It runs while a
   ride is live and the map is open, and stops the moment it is not. */
var LIVETIMER = null;
function liveWatch(on, main){
  if(on && !LIVETIMER){
    LIVETIMER = setInterval(function(){ paintAdmin(main); }, 15000);
  } else if(!on && LIVETIMER){
    clearInterval(LIVETIMER); LIVETIMER = null;
  }
}

/* ---- the board: one column per step, newest at the top ---- */
function boardHtml(orders){
  return '<div class="board">' + FLOW.map(function(st){
    var col = orders.filter(function(o){ return o.status === st; });
    /* the head stays put, the cards under it scroll on their own,
       so a busy column never pushes the others off the screen */
    return '<div class="col">' +
      '<div class="colhead"><b>' + esc(STEP[st].t) + '</b>' +
        '<span class="cnt">' + col.length + '</span></div>' +
      '<div class="colbody">' +
        (col.length ? col.map(boardCard).join("")
                    : '<div class="colempty">\u2014</div>') +
      '</div>' +
    '</div>';
  }).join("") + '</div>';
}

function boardCard(o){
  var at = FLOW.indexOf(o.status), next = FLOW[at+1];
  var rider = o.riderId ? STORE.rider(o.riderId) : null;
  var riders = STORE.riders();

  var empty = !(o.lines || []).length;

  var act = "";
  if(empty){
    act = '<p class="shopnote emptyord">No items. Sort it out with the customer.</p>';
  } else if(o.status === "accepted"){
    act = riders.length
      ? '<select class="fld sel mini" data-assign="' + o.id + '">' +
          '<option value="">Assign\u2026</option>' +
          riders.map(function(r){ return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join("") +
        '</select>'
      : '<button class="mini ghostmini" data-go="#/admin/riders">Add a rider</button>';
  } else if(next){
    act = '<button class="mini" data-adv="' + o.id + '|' + next + '">' +
          esc(STEP[next].t) + '</button>';
  }

  /* Before it is accepted the office may still want to talk to the
     customer - a missing item, an address that reads oddly, a price
     to agree. Those three sit on the card, not behind Accept. */
  var before = (o.status === "placed")
    ? '<div class="preact">' +
        '<a class="qbtn wa" target="_blank" rel="noopener" href="' +
          esc(waCustomer(o, msgAsk(o))) + '" title="Ask the customer something">Message</a>' +
        callBtn(o.phone, "Call", "qbtn") +
        '<a class="qbtn ed" href="#/admin/o/' + esc(o.id) + '">Edit' + noteTag(o) + '</a>' +
      '</div>'
    : '';

  return '<div class="bcard' + (empty ? " empty" : "") + '">' +
    '<div class="brow"><b>' + esc(o.id) + '</b><span class="btime">' + when(o.at) + '</span></div>' +
    '<div class="bname">' + esc(o.name) + '</div>' +
    '<div class="baddr">' + esc(o.addr) + '</div>' +
    (distLabel(o) ? '<div class="bdist">' + esc(distLabel(o)) + ' from us</div>' : '') +
    '<div class="brow"><span class="btot">' + rupee(o.total) + '</span>' +
      payTag(o) +
      (discountLabel(o) ? '<span class="offtag">' + esc(discountLabel(o)) + '</span>' : '') +
      (rider ? '<span class="rname">' + esc(rider.name) + '</span>' : '') + '</div>' +
    '<div class="quick">' +
      '<a class="qbtn wa" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, o.status === "placed" ? msgAccepted(o) : msgOnWay(o))) +
        '" title="Message the customer">WhatsApp</a>' +
      (o.lat ? '<a class="qbtn gm" target="_blank" rel="noopener" href="' + esc(mapsFromShop(o)) +
        '" title="Route from the shop">Maps</a>' : '') +
      callBtn(o.phone, "Call", "qbtn") +
      '<a class="qbtn ed" href="#/admin/o/' + esc(o.id) + '" title="Edit or cancel">Edit' +
        noteTag(o) + '</a>' +
    '</div>' +
    before + act + '</div>';
}

/* both views use the same buttons, so they are wired in one place */
function wireCards(main){
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

/* ---- handing off to the apps people already have ------------
   Google Maps for anything to do with getting there, WhatsApp for
   anything to do with talking. Both open the real app on a phone.
   ------------------------------------------------------------ */
function mapsPin(o){
  var q = (o.lat && o.lng) ? (o.lat + "," + o.lng) : o.addr;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}
function mapsFromShop(o){
  var d = (o.lat && o.lng) ? (o.lat + "," + o.lng) : o.addr;
  return "https://www.google.com/maps/dir/?api=1" +
         "&origin=" + encodeURIComponent(HOME.lat + "," + HOME.lng) +
         "&destination=" + encodeURIComponent(d) + "&travelmode=driving";
}
function waCustomer(o, text){ return wa(o.phone, text); }

function orderLine(o){
  return (o.lines || []).map(function(l){
    return l.q + " \u00d7 " + l.name + (l.label ? " (" + l.label + ")" : "");
  }).join(", ");
}
function msgOnWay(o){
  return "Hayat \u2014 order " + o.id + "\n\n" + orderLine(o) +
         "\nTotal " + rupee(o.total) + " (cash on delivery)" +
         "\n\nYour food is on the way." +
         "\nFollow it here: " + base() + "#/o/" + o.id;
}
function msgAccepted(o){
  return "Hayat \u2014 order " + o.id + "\n\nWe have your order and the kitchen has started." +
         "\n" + orderLine(o) + "\nTotal " + rupee(o.total) +
         "\n\nTrack it here: " + base() + "#/o/" + o.id;
}
/* Before accepting: a question, not a confirmation. Nothing here
   promises the customer anything the kitchen has not agreed to. */
function msgAsk(o){
  return "Hayat \u2014 order " + o.id + "\n\n" +
         "Hello" + (o.name ? " " + o.name : "") + ", we have your order and " +
         "wanted to check one thing before we start.\n\n" +
         orderLine(o) + "\nTotal " + rupee(o.total) +
         "\n\nYou can also reply on the order page: " + base() + "#/o/" + o.id;
}

function msgChanged(o){
  var m = money(o);
  return "Hayat \u2014 order " + o.id + "\n\nWe have updated your order:\n" +
    (o.lines||[]).map(function(l){
      return "  " + l.q + " \u00d7 " + l.name + (l.label ? " (" + l.label + ")" : "") +
             "  " + rupee(l.q * l.price);
    }).join("\n") +
    (m.off ? "\n\nSubtotal " + rupee(m.sub) + "\nDiscount \u2212" + rupee(m.off) +
             " (" + discountLabel(o) + ")" : "") +
    "\n\nTotal " + rupee(m.total) + " (cash on delivery)" +
    "\n\nThe latest is always here: " + base() + "#/o/" + o.id;
}

function msgRiderHere(o){
  return "Hayat \u2014 order " + o.id + "\n\nI am outside with your order." +
         "\nPlease collect " + rupee(o.total) + ".";
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

  var empty = !(o.lines || []).length;

  var action = "";
  if(empty)
    /* nothing to cook: the only honest move is to sort it out
       with the customer, or close it */
    action = '<p class="shopnote emptyord">This order has no items. ' +
             'Call or message the customer, or cancel it.</p>';
  else if(o.status === "placed")
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
    '<div class="who">' + esc(o.name) + ' \u00b7 ' +
      (canDial() ? '<a href="tel:' + esc(o.phone) + '">' + esc(prettyPhone(o.phone)) + '</a>'
                 : '<b class="numtxt" data-num="' + esc(o.phone) + '">' +
                   esc(prettyPhone(o.phone)) + '</b>') + '</div>' +
    '<div class="addr">' + esc(o.addr) +
      (distLabel(o) ? ' <b class="dist">\u00b7 ' + esc(distLabel(o)) + '</b>' : '') + '</div>' +
    (o.note ? '<div class="addr note">' + esc(o.note) + '</div>' : '') +
    (o.lat ? '' : '<div class="addr nopin">No pin \u2014 address only</div>') +
    '<div class="items">' + (o.lines||[]).map(function(l){
      return l.q + "× " + esc(l.name) + (l.label ? " <i>" + esc(l.label) + "</i>" : "");
    }).join(" · ") + '</div>' +
    '<div class="orow"><span class="tot">' + rupee(o.total) + '</span>' + payTag(o) +
      (discountLabel(o) ? '<span class="offtag">' + esc(discountLabel(o)) + '</span>' : '') +
      (rider ? '<span class="rname">' + esc(rider.name) + '</span>' : '') + '</div>' +
    '<div class="quick">' +
      '<a class="qbtn wa" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, o.status === "placed" ? msgAccepted(o) : msgOnWay(o))) + '">WhatsApp</a>' +
      (o.lat ? '<a class="qbtn gm" target="_blank" rel="noopener" href="' + esc(mapsFromShop(o)) +
        '">Open in Maps</a>' : '') +
      callBtn(o.phone, "Call", "qbtn") +
      '<a class="qbtn ed" href="#/admin/o/' + esc(o.id) + '">Edit' + noteTag(o) + '</a>' +
    '</div>' +
    action + '</div>';
}

/* ---------- every live order on one map ---------------------
   The office cares about one thing here: where the food has to go,
   and which of those are still waiting. Colour carries the status;
   the view survives a repaint so a status change does not yank the
   map back to the start.
   ------------------------------------------------------------ */
var AMAP = null, AVIEW = null;
var ADVIEW = "board";
try{ ADVIEW = localStorage.getItem("hayat_adview") || "board"; }catch(e){}

/* Straight line from the kitchen. Roads are longer, so this reads low —
   but it sorts and compares correctly, which is what the office needs. */
function kmFrom(lat, lng){
  var R = 6371, rad = Math.PI / 180;
  var dLat = (lat - HOME.lat) * rad, dLng = (lng - HOME.lng) * rad;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
          Math.cos(HOME.lat*rad)*Math.cos(lat*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function distLabel(o){
  /* a measured road distance beats the straight line whenever we have one */
  if(o.roadKm) return o.roadKm.toFixed(1) + " km" + (o.roadMin ? " \u00b7 " + o.roadMin + " min" : "");
  if(!o.lat || !o.lng) return "";
  var km = kmFrom(o.lat, o.lng);
  return (km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km") + " \u2248";
}

/* ---- real road distance, once, when the order arrives --------
   Straight line is free and instant but always reads short. If a
   routing service is named in config.js we ask it once per order
   and keep the answer on the order for good.

   Google's own Distance Matrix needs a billing account on the
   project, so it is not the default. Any service that answers with
   a distance in metres works; the reader below handles OSRM's
   shape, which several free hosts speak.
   ------------------------------------------------------------ */
function measureRoad(o){
  var r = (C().routing) || {};
  if(!r.enabled || !o.lat || !o.lng || o.roadKm || o.roadTried) return;
  o.roadTried = true;

  var base = r.osrm || "https://router.project-osrm.org";
  var url = base + "/route/v1/driving/" +
            HOME.lng + "," + HOME.lat + ";" + o.lng + "," + o.lat +
            "?overview=false";

  fetch(url).then(function(x){ return x.json(); }).then(function(j){
    var leg = j && j.routes && j.routes[0];
    if(!leg) return;
    STORE.setRoad(o.id, leg.distance / 1000, Math.round(leg.duration / 60));
  }).catch(function(){ /* the straight line still stands */ });
}
/* first name, or the first word, for a map label */
function shortName(n){
  var w = String(n || "").trim().split(/\s+/)[0] || "?";
  return w.length > 10 ? w.slice(0, 9) + "\u2026" : w;
}

function statusColour(s){
  return s === "placed"    ? "#E4705A"
       : s === "delivered" ? "#9A8A6C"
       : s === "on_way"    ? "#8FBE43"
                           : "#C9A24B";
}

function drawAdminMap(list){
  var box = el("admap");
  if(!box) return;
  list = list || [];

  loadLeaflet().then(function(){
    try{ if(box._leaflet_id){ box._leaflet_id = null; box.innerHTML = ""; } }catch(e){}
    var LF = window.L;
    /* Always open on the restaurant. Whatever happened last time,
       wherever yesterday's orders were, the office looks at its
       own kitchen first and moves out from there. */
    AMAP = LF.map(box, { zoomControl:true })
             .setView([HOME.lat, HOME.lng], HOMEZOOM);
    tameMap(AMAP, box);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(AMAP);

    /* the restaurant, so the office can see how far each one is */
    LF.circleMarker([HOME.lat, HOME.lng], {
      radius:7, color:"#FFFFFF", weight:2, fillColor:"#1B2410", fillOpacity:1
    }).addTo(AMAP).bindPopup("Hayat \u2014 the kitchen");

    var pts = [[HOME.lat, HOME.lng]];

    /* a rider on the road, only while the ride is actually live */
    list.filter(function(o){
      return o.rLat && (o.status === "assigned" || o.status === "on_way");
    }).forEach(function(o){
      var r = o.riderId ? STORE.rider(o.riderId) : null;
      pts.push([o.rLat, o.rLng]);
      LF.marker([o.rLat, o.rLng], { zIndexOffset: 500, icon: LF.divIcon({
        className: "omark bike",
        html: '<span class="bikedot">\uD83C\uDFCD</span>' +
              '<span class="tag">' + esc(r ? shortName(r.name) : "Rider") +
              ' \u00b7 ' + esc(o.id) + '</span>',
        iconSize: null, iconAnchor: [14, 14] }) })
        .addTo(AMAP).bindPopup(
          "<b>" + esc(r ? r.name : "Rider") + "</b><br>" +
          "carrying " + esc(o.id) + "<br>" +
          "last seen " + when(o.rAt) + "<br>" +
          '<a href="#/admin/o/' + esc(o.id) + '">Open the order</a>');
    });

    list.forEach(function(o){
      pts.push([o.lat, o.lng]);
      LF.marker([o.lat, o.lng], {
        icon: LF.divIcon({
          className: "omark",
          html: '<span class="dot" style="background:' + statusColour(o.status) + '"></span>' +
                '<span class="tag">' + esc(shortName(o.name)) + ' \u00b7 ' +
                rupee(o.total) + '</span>',
          iconSize: null, iconAnchor: [7, 7]
        })
      }).addTo(AMAP).bindPopup(
        "<b>" + esc(o.id) + "</b> \u00b7 " + esc(STEP[o.status].t) + "<br>" +
        esc(o.name) + "<br>" + rupee(o.total) +
        (distLabel(o) ? " \u00b7 " + distLabel(o) + " away" : "") + "<br>" +
        '<a href="#/admin/o/' + esc(o.id) + '"><b>Open the order</b></a><br>' +
        '<a href="' + esc(mapsFromShop(o)) + '" target="_blank" rel="noopener">Google Maps</a>' +
        ' &middot; ' +
        '<a href="' + esc(waCustomer(o, msgOnWay(o))) + '" target="_blank" rel="noopener">WhatsApp</a>'
      );
    });

    /* the kitchen sits in the middle: the office reads distance from it */
    if(AVIEW) AMAP.setView(AVIEW.c, AVIEW.z);
    else if(pts.length > 1){
      var far = 0;
      list.forEach(function(o){
        far = Math.max(far, Math.abs(o.lat - HOME.lat), Math.abs(o.lng - HOME.lng));
      });
      far = Math.max(far, 0.004) * 1.25;
      AMAP.fitBounds([[HOME.lat - far, HOME.lng - far],
                      [HOME.lat + far, HOME.lng + far]], { maxZoom:16 });
    } else AMAP.setView([HOME.lat, HOME.lng], 15);
    AMAP.on("moveend", function(){ AVIEW = { c: AMAP.getCenter(), z: AMAP.getZoom() }; });
    watchSize(box, AMAP);
  }).catch(function(err){
    box.innerHTML = '<div class="mapfail">The map is not loading here.<br><small>' +
      esc(String(err && err.message || err)) + '</small></div>';
  });
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

/* ---- the office editing one order -------------------------- */
function viewEdit(main, id){
  gate(main, function(){ paintEdit(main, id); });
}

function paintEdit(main, id){
  var o = STORE.order(id);
  if(!o){
    main.innerHTML = shell("Not found", '<p class="shopsub">That order is gone.</p>' +
      '<button class="shopbtn ghost" data-go="#/admin">Back to orders</button>', true);
    return;
  }
  var m = money(o), d = o.discount || { type:"pct", value:0 };

  main.innerHTML = shell("Edit " + esc(o.id),
    '<div class="editwrap">' +
      '<h3 class="mini">What they ordered</h3>' +
      '<div class="lines">' + (o.lines||[]).map(function(l,i){
        return '<div class="line"><div class="ln"><b>' + esc(l.name) + '</b>' +
          (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</div>' +
          '<div class="qty">' +
            '<button data-eq="' + i + '|-1">&minus;</button><span>' + l.q + '</span>' +
            '<button data-eq="' + i + '|1">+</button></div>' +
          '<div class="lp">' + rupee(l.q * l.price) + '</div></div>';
      }).join("") + '</div>' +
      (o.lines && o.lines.length ? '' : '<p class="shopsub">Every line was removed.</p>') +

      '<h3 class="mini">Discount</h3>' +
      '<div class="disc">' +
        '<button class="dtab' + (d.type==="pct"?" on":"") + '" data-dt="pct">%</button>' +
        '<button class="dtab' + (d.type==="rs"?" on":"") + '" data-dt="rs">\u20B9</button>' +
        '<input class="fld" id="edDisc" inputmode="numeric" placeholder="0" value="' +
          (d.value || "") + '">' +
      '</div>' +
      '<p class="shopnote" style="text-align:left;margin:4px 0 0">' +
        'Subtotal ' + rupee(m.sub) +
        (m.off ? ' \u2212 ' + rupee(m.off) + ' (' + esc(discountLabel(o)) + ')' : '') +
        ' = <b>' + rupee(m.total) + '</b></p>' +

      /* Adding a dish has to be one search and one tap. Anything
         slower and the phone gets picked up instead. */
      '<h3 class="mini">Add something</h3>' +
      '<div class="finder">' +
        '<input class="fld" id="edFind" autocomplete="off" ' +
          'placeholder="Search the menu\u2026 chicken, mandi, juice">' +
        '<div class="findpanel" id="edFindOut"></div>' +
      '</div>' +

      '<h3 class="mini">Where it goes</h3>' +
      '<input class="fld" id="edName"  placeholder="Name" value="' + esc(o.name) + '">' +
      '<input class="fld" id="edPhone" placeholder="Phone" inputmode="tel" value="' + esc(o.phone) + '">' +
      '<textarea class="fld" id="edAddr" placeholder="Address">' + esc(o.addr) + '</textarea>' +
      '<input class="fld" id="edNote"  placeholder="Note" value="' + esc(o.note||"") + '">' +

      '<button class="shopbtn" id="edSave">Save the changes</button>' +
      '<a class="shopbtn ghost" id="edTell" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, msgChanged(o))) + '">Tell the customer on WhatsApp</a>' +
      '<button class="shopbtn ghost" data-go="#/admin">Back without saving</button>' +
      (o.status !== "cancelled" && o.status !== "delivered"
        ? '<button class="shopbtn danger" id="edCancel">Cancel this order</button>' : '') +
      payBlock(o, "office") +
      noteThread(o, "A note for the rider or the customer\u2026") +
    '</div>', true);

  wireNotes(main, id, function(){ paintEdit(main, id); });
  wirePaid(main, function(){ paintEdit(main, id); });

  /* quantities change in place so the total is always honest */
  main.querySelectorAll("[data-eq]").forEach(function(b){
    b.onclick = function(){
      var p = b.dataset.eq.split("|"), i = +p[0], step = +p[1];
      var lines = (o.lines||[]).slice();
      lines[i] = Object.assign({}, lines[i], { q: lines[i].q + step });
      lines = lines.filter(function(l){ return l.q > 0; });
      STORE.edit(id, { lines: lines });
      paintEdit(main, id);
    };
  });
  main.querySelectorAll("[data-dt]").forEach(function(b){
    b.onclick = function(){
      STORE.edit(id, { discount: { type: b.dataset.dt, value: +(el("edDisc").value || 0) } });
      paintEdit(main, id);
    };
  });

  wireFinder("edFind", "edFindOut", function(did, lbl, price){
    var it = dishById(did);
    var lines = (o.lines || []).slice();
    var k = did + "|" + lbl;
    var hit = lines.filter(function(l){ return (l.id + "|" + (l.label||"")) === k; })[0];
    if(hit) hit.q += 1;
    else lines.push({ k:k, id:did, name: it ? label(it.name) : did,
                      label:lbl, price:price, q:1 });
    STORE.edit(id, { lines: lines });
    shopToast((it ? label(it.name) : "Item") + " added.");
    paintEdit(main, id);
  }, "Add");

  el("edSave").onclick = function(){
    STORE.edit(id, {
      name:  el("edName").value.trim(),
      phone: el("edPhone").value.trim(),
      addr:  el("edAddr").value.trim(),
      note:  el("edNote").value.trim(),
      discount: { type: d.type, value: +(el("edDisc").value || 0) }
    });
    location.hash = "#/admin";
  };

  var cx = el("edCancel");
  if(cx) cx.onclick = function(){
    var why = window.prompt("Why is it cancelled? (optional)") || "";
    STORE.cancel(id, "office", why);
    location.hash = "#/admin";
  };
}

/* the id of the rider whose row is open for editing, or null */
var REDIT = null;

function viewRiders(main){
  gate(main, function(){ paintRiders(main); });
}
function paintRiders(main){
  var riders = STORE.riders();
  main.innerHTML = shell("Riders",
    connBanner() +
    (riders.length ? '<div class="lines">' + riders.map(function(r){
        if(REDIT === r.id){
          return '<div class="line redit"><div class="ln">' +
            '<input class="fld" id="e_' + esc(r.id) + '_n" value="' + esc(r.name) + '">' +
            '<input class="fld" id="e_' + esc(r.id) + '_p" value="' + esc(r.phone) + '" inputmode="tel">' +
            '</div>' +
            '<button class="linky" data-save="' + esc(r.id) + '">Save</button>' +
            '<button class="linky" data-rcancel="1">Cancel</button></div>';
        }
        return '<div class="line"><div class="ln"><b>' + esc(r.name) + '</b>' +
          '<small>' + esc(r.phone) + '</small></div>' +
          '<button class="linky" data-edit="' + esc(r.id) + '">Edit</button>' +
          '<button class="linky warn" data-drop="' + esc(r.id) + '">Remove</button></div>';
      }).join("") + '</div>'
     : '<p class="shopsub">No riders yet.</p>') +
    '<input class="fld" id="rName"  placeholder="Rider name">' +
    '<input class="fld" id="rPhone" placeholder="Phone with country code, e.g. 919844326842" inputmode="tel">' +
    '<button class="shopbtn" id="rAdd">Add rider</button>' +
    '<button class="shopbtn ghost" data-go="#/admin">Back to orders</button>');

  var addRider = function(){
    var n = el("rName").value.trim(), p = el("rPhone").value.trim();
    if(!n || !p){ shopToast("Name and phone, please."); return; }
    var id = STORE.addRider(n, p);
    if(id){ el("rName").value = ""; el("rPhone").value = ""; }
  };
  el("rAdd").onclick = addRider;
  onEnter(el("rName"),  addRider);
  onEnter(el("rPhone"), addRider);
  main.querySelectorAll("[data-edit]").forEach(function(b){
    b.onclick = function(){ REDIT = b.dataset.edit; paintRiders(main); };
  });
  main.querySelectorAll("[data-rcancel]").forEach(function(b){
    b.onclick = function(){ REDIT = null; paintRiders(main); };
  });
  main.querySelectorAll("[data-save]").forEach(function(b){
    b.onclick = function(){
      var id = b.dataset.save;
      var n = el("e_" + id + "_n").value.trim();
      var p = el("e_" + id + "_p").value.trim();
      if(!n || !p){ shopToast("Name and phone, please."); return; }
      var was = STORE.rider(id);
      var moved = was && digits(was.phone) !== digits(p);
      STORE.editRider(id, { name:n, phone:p });
      REDIT = null;
      paintRiders(main);
      shopToast(moved ? "Saved. They sign in with the new number now."
                      : "Rider updated.");
    };
  });
  main.querySelectorAll("[data-drop]").forEach(function(b){
    b.onclick = function(){ REDIT = null; STORE.dropRider(b.dataset.drop); };
  });
}

/* ============================================================
   RIDER
   ------------------------------------------------------------
   The rider signs in once with the phone number the office
   registered, and from then on this phone shows only their own
   jobs. Installed from the browser menu it opens like an app.

   While a job is open the phone posts its position every few
   seconds so the customer's map moves. A browser stops that the
   moment the screen locks — that is the rule on every phone, and
   the honest limit of a web app. Nothing is sent when there is no
   live job, and nothing is kept once the job is delivered.
   ============================================================ */
/* ---- the alarm -------------------------------------------
   A rider is not staring at the screen. When a job lands their
   phone has to make a noise they cannot miss, and keep making it
   until they look.

   A browser will not make a sound until the person has tapped
   something, so the audio is armed on the sign-in tap and kept
   alive from then on. The tone is generated, not a file — one
   less thing to load on a bad connection.

   None of this reaches a phone with the app fully closed. That
   needs a push server, which needs a paid Firebase plan. Until
   then the office's WhatsApp message is what wakes them.
   ---------------------------------------------------------- */
var AC = null, RINGING = false, RINGSTOP = null;

function armSound(){
  try{
    if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === "suspended") AC.resume();
  }catch(e){}
}

function beep(at, freq, len){
  if(!AC) return;
  var osc = AC.createOscillator(), gain = AC.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, at);
  /* a hard edge carries across a road; a soft tail stops it grating */
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain); gain.connect(AC.destination);
  osc.start(at); osc.stop(at + len + 0.02);
}

function ring(){
  if(RINGING) return;
  RINGING = true;
  armSound();

  var round = function(){
    if(!RINGING || !AC) return;
    var t = AC.currentTime;
    /* two rising pairs, like a doorbell that means business */
    beep(t,        880, 0.18);
    beep(t + 0.22, 1175, 0.18);
    beep(t + 0.60, 880, 0.18);
    beep(t + 0.82, 1175, 0.30);
    try{ navigator.vibrate && navigator.vibrate([300,120,300,120,500]); }catch(e){}
  };
  round();
  RINGSTOP = setInterval(round, 2600);   /* until they look at it */
}

function hush(){
  RINGING = false;
  if(RINGSTOP){ clearInterval(RINGSTOP); RINGSTOP = null; }
  try{ navigator.vibrate && navigator.vibrate(0); }catch(e){}
}

/* the phone's own notification, for when the app is behind something */
function nudge(o){
  try{
    if(!("Notification" in window) || Notification.permission !== "granted") return;
    var n = new Notification("New delivery \u00b7 " + o.id, {
      body: o.name + "\n" + o.addr + "\n" + rupee(o.total) + " to collect",
      icon: "assets/icon-192.png",
      badge: "assets/icon-192.png",
      tag: "job-" + o.id,
      requireInteraction: true,
      vibrate: [300,120,300,120,500]
    });
    n.onclick = function(){
      window.focus();
      location.hash = "#/drive/" + o.id;
      hush();
      n.close();
    };
  }catch(e){}
}

/* ---- watching for work ---- */
var SEEN = null;
function seenJobs(){
  if(SEEN) return SEEN;
  try{ SEEN = JSON.parse(localStorage.getItem("hayat_seen") || "[]"); }
  catch(e){ SEEN = []; }
  return SEEN;
}
function markSeen(ids){
  SEEN = ids;
  try{ localStorage.setItem("hayat_seen", JSON.stringify(ids.slice(-60))); }catch(e){}
}

function checkForWork(){
  var me = whoAmI();
  if(!me) return;
  var mine = STORE.orders().filter(function(o){
    return o.riderId === me.id && (o.status === "assigned" || o.status === "on_way");
  });
  var ids = mine.map(function(o){ return o.id; });
  var known = seenJobs();
  var fresh = mine.filter(function(o){ return known.indexOf(o.id) < 0; });

  if(fresh.length){
    ring();
    fresh.forEach(nudge);
    showAlert(fresh);
  }
  markSeen(known.concat(ids.filter(function(i){ return known.indexOf(i) < 0; })));
}

/* the banner that will not be ignored */
function showAlert(jobs){
  var o = jobs[0];
  var box = el("jobalert");
  if(!box){
    box = document.createElement("div");
    box.id = "jobalert";
    document.body.appendChild(box);
  }
  box.innerHTML =
    '<div class="jacard">' +
      '<div class="jah">New delivery</div>' +
      '<div class="jaid">' + esc(o.id) + '</div>' +
      '<div class="janame">' + esc(o.name) + '</div>' +
      '<div class="jaaddr">' + esc(o.addr) + '</div>' +
      '<div class="jatot">' + rupee(o.total) + ' to collect</div>' +
      (jobs.length > 1 ? '<div class="jamore">and ' + (jobs.length-1) + ' more</div>' : '') +
      '<button class="shopbtn" id="jaGo">Open it</button>' +
      '<button class="shopbtn ghost" id="jaLater">Later</button>' +
    '</div>';
  box.hidden = false;
  el("jaGo").onclick = function(){
    hush(); box.hidden = true; location.hash = "#/drive/" + o.id;
  };
  el("jaLater").onclick = function(){ hush(); box.hidden = true; };
}

function riderPhone(){
  try{ return localStorage.getItem("hayat_rider") || ""; }catch(e){ return ""; }
}
function setRiderPhone(p){
  try{ p ? localStorage.setItem("hayat_rider", p) : localStorage.removeItem("hayat_rider"); }catch(e){}
  ME.riderPhone = p || null;
  if(ME.role !== "office") ME.role = p ? "rider" : "guest";
}
function digits(p){ return String(p || "").replace(/\D/g, "").slice(-10); }

function whoAmI(){
  var mine = digits(riderPhone());
  if(!mine) return null;
  return STORE.riders().filter(function(r){ return digits(r.phone) === mine; })[0] || null;
}

/* ------------------------------------------------------------
   IS THIS PHONE ACTUALLY READY TO WORK

   A web app is only asked for GPS the first time it needs it,
   which without this panel was halfway through a delivery, with
   a customer waiting. That is the worst possible moment. So the
   rider is asked at sign-in instead, told plainly why, and shown
   whether it worked.
   ------------------------------------------------------------ */
var GPSOK = null;          /* null unknown, true granted, false refused */

function gpsState(){
  return new Promise(function(done){
    if(!navigator.geolocation) return done("none");
    if(!navigator.permissions || !navigator.permissions.query) return done("ask");
    navigator.permissions.query({ name:"geolocation" })
      .then(function(r){ done(r.state); })      /* granted | prompt | denied */
      .catch(function(){ done("ask"); });
  });
}

function askGps(){
  return new Promise(function(done){
    if(!navigator.geolocation) return done(false);
    navigator.geolocation.getCurrentPosition(
      function(){ GPSOK = true;  done(true); },
      function(){ GPSOK = false; done(false); },
      { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  });
}

function readyPanel(){
  var inApp = !!native();
  return '<div class="ready" id="readyBox">' +
    (inApp
      ? '<div class="rdrow ok"><span class="rdi">\uD83D\uDEF5</span>' +
        '<div class="rdt"><b>Hayat rider app</b>' +
        '<small>Your position keeps going with the screen off.</small></div></div>'
      : '<div class="rdrow warn"><span class="rdi">\uD83C\uDF10</span>' +
        '<div class="rdt"><b>Running in the browser</b>' +
        '<small>Position stops when the screen sleeps. The app fixes that.</small></div></div>') +
    '<div class="rdrow" id="rdGps"><span class="rdi">\uD83D\uDCCD</span>' +
      '<div class="rdt"><b>Location</b><small>Checking\u2026</small></div>' +
      '<button class="linky" id="rdGpsGo" hidden>Allow</button></div>' +
    '<div class="rdrow" id="rdBell"><span class="rdi">\uD83D\uDD14</span>' +
      '<div class="rdt"><b>Alerts</b><small>Checking\u2026</small></div>' +
      '<button class="linky" id="rdBellGo" hidden>Allow</button></div>' +
  '</div>';
}

function paintReady(){
  var row = el("rdGps"), note = row && row.querySelector("small"),
      btn = el("rdGpsGo");
  if(!row) return;

  gpsState().then(function(st){
    if(st === "none"){
      row.className = "rdrow bad";
      note.textContent = "This phone cannot share a position.";
      btn.hidden = true;
    } else if(st === "granted" || GPSOK === true){
      row.className = "rdrow ok";
      note.textContent = "Shared while a delivery is open.";
      btn.hidden = true;
    } else if(st === "denied" || GPSOK === false){
      row.className = "rdrow bad";
      note.textContent = "Blocked. Open the site settings and allow location.";
      btn.hidden = false;
      btn.textContent = "Try again";
    } else {
      row.className = "rdrow warn";
      note.textContent = "Needed so the shop and the customer can see you.";
      btn.hidden = false;
      btn.textContent = "Allow";
    }
  });

  if(btn) btn.onclick = function(){
    btn.textContent = "Waiting\u2026";
    askGps().then(function(){ paintReady(); });
  };

  var brow = el("rdBell"), bnote = brow && brow.querySelector("small"),
      bbtn = el("rdBellGo");
  if(brow){
    var has = ("Notification" in window);
    var pm = has ? Notification.permission : "denied";
    if(!has || pm === "denied"){
      brow.className = "rdrow bad";
      bnote.textContent = has ? "Blocked. New jobs will not ring."
                              : "This phone cannot show alerts.";
      bbtn.hidden = true;
    } else if(pm === "granted"){
      brow.className = "rdrow ok";
      bnote.textContent = "You will hear a new delivery.";
      bbtn.hidden = true;
    } else {
      brow.className = "rdrow warn";
      bnote.textContent = "So a new delivery reaches you.";
      bbtn.hidden = false;
      bbtn.textContent = "Allow";
      bbtn.onclick = function(){
        try{ Notification.requestPermission().then(function(){ paintReady(); }); }catch(e){}
      };
    }
  }
}

/* ---- the sign-in and the job list ---- */
function viewDriveHome(main){
  var me = whoAmI();

  if(!me){
    main.innerHTML = shell("Rider",
      '<p class="revsub">Sign in with the number the restaurant registered for you.</p>' +
      '<input class="fld" id="rvPhone" placeholder="Your phone number" inputmode="tel" value="' +
        esc(riderPhone()) + '">' +
      '<button class="shopbtn" id="rvGo">Sign in</button>' +
      (riderPhone() ? '<p class="shopnote">That number is not on the rider list. ' +
        'Ask the office to add it.</p>' : '') +
      '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');
    var signIn = function(){
      /* This tap is the only gesture the browser will let us spend.
         Sound, alerts and location all have to be asked for here,
         while a finger is still on the screen - not later, in the
         middle of a delivery. */
      armSound();
      try{ if("Notification" in window && Notification.permission === "default")
             Notification.requestPermission(); }catch(e){}
      setRiderPhone(el("rvPhone").value.trim());
      askGps().then(function(){ viewDriveHome(main); });
      viewDriveHome(main);
    };
    el("rvGo").onclick = signIn;
    onEnter(el("rvPhone"), signIn);
    el("rvPhone").focus();
    return;
  }

  var mine = STORE.orders().filter(function(o){
    return o.riderId === me.id && o.status !== "delivered" && o.status !== "cancelled";
  });
  var done = STORE.orders().filter(function(o){
    return o.riderId === me.id && o.status === "delivered";
  }).length;

  main.innerHTML = shell("Your deliveries",
    '<div class="adminbar"><span class="pill">' + mine.length + ' to go</span>' +
      '<span class="pill quiet">' + done + ' done</span>' +
      '<button class="linky" id="rvOut">Not ' + esc(me.name) + '?</button></div>' +
    readyPanel() +
    (mine.length ? mine.map(function(o){
        return '<a class="jobcard" href="#/drive/' + esc(o.id) + '">' +
          '<div class="brow"><b>' + esc(o.id) + '</b>' +
            '<span class="status s-' + o.status + '">' + esc(STEP[o.status].t) + '</span>' +
            '<span class="btime">' + when(o.at) + '</span></div>' +
          '<div class="bname">' + esc(o.name) + '</div>' +
          '<div class="baddr">' + esc(o.addr) + '</div>' +
          (distLabel(o) ? '<div class="bdist">' + esc(distLabel(o)) + ' from the shop</div>' : '') +
          '<div class="brow"><span class="btot">' + rupee(o.total) + '</span>' +
            '<span class="rname">collect on delivery</span></div></a>';
      }).join("")
      : '<p class="shopsub">Nothing assigned to you right now.</p>') +
    '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');

  el("rvOut").onclick = function(){ setRiderPhone(""); viewDriveHome(main); };
  paintReady();

  armSound();
  checkForWork();
}

/* ---- one job ---- */
function viewDrive(main, id){
  if(!id) return viewDriveHome(main);

  var o = STORE.order(id);
  if(!o){
    main.innerHTML = shell("Not found",
      '<p class="shopsub">No order with that number.</p>' +
      '<button class="shopbtn ghost" data-go="#/drive">Your deliveries</button>');
    return;
  }
  var at = FLOW.indexOf(o.status), next = FLOW[at+1];

  main.innerHTML = shell("Delivery " + esc(o.id),
    '<div class="who big">' + esc(o.name) + '</div>' +
    '<div class="addr">' + esc(o.addr) +
      (distLabel(o) ? ' <b class="dist">\u00b7 ' + esc(distLabel(o)) + '</b>' : '') + '</div>' +
    (o.note ? '<div class="addr note">' + esc(o.note) + '</div>' : '') +
    '<div class="rowbtns">' +
      '<a class="shopbtn small" target="_blank" rel="noopener" href="' + esc(mapsPin(o)) +
        '">Navigate</a>' +
      '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, msgRiderHere(o))) + '">WhatsApp</a>' +
      callBtn(o.phone, "Call", "shopbtn small ghost") +
    '</div>' +
    '<div class="items">' + (o.lines||[]).map(function(l){
      return l.q + "\u00d7 " + esc(l.name) + (l.label ? " <i>" + esc(l.label) + "</i>" : "");
    }).join(" \u00b7 ") + '</div>' +
    '<div class="total"><span>Collect</span><b>' + rupee(o.total) + '</b></div>' +
    '<div class="status big s-' + o.status + '">' + esc(STEP[o.status].t) + '</div>' +
    payBlock(o, "rider") +
    (next ? '<button class="shopbtn" id="dvGo">' + esc(STEP[next].t) + '</button>'
          : '<p class="shopnote">Done. Thank you.</p>') +
    /* Read from the order, not set by hand, so a repaint cannot
       quietly undo it - that is how the last one went wrong. */
    '<div class="gpsrow"><span class="gpsdot' + (o.rAt ? " on" : "") + '" id="gpsDot"></span>' +
      '<span id="gpsTxt">' + esc((function(){
        if(!next) return "Not sharing";
        if(!o.rAt) return native() ? "Starting\u2026" : "Sharing while this is open";
        return "Position shared \u00b7 " + when(o.rAt) +
               (native() ? " \u00b7 keeps going with the screen off" : "");
      })()) + '</span></div>' +
    noteThread(o, "Held up? Cannot find the door? Say so here\u2026") +
    '<button class="shopbtn ghost" data-go="#/drive">Your other deliveries</button>');

  wireNotes(main, id, function(){ viewDrive(main, id); });
  wirePaid(main, function(){ viewDrive(main, id); });

  if(next) el("dvGo").onclick = function(){
    STORE.setStatus(id, next);
    /* the money is the last thing on their mind and the first
       thing the shop will ask about, so say it once, here */
    if(next === "delivered" && !STORE.order(id).paid)
      shopToast("Delivered. Now mark how it was paid.");
  };

  hush();                       /* they are looking at it now */
  if(o.status === "assigned" || o.status === "on_way") startPing(id);
  else stopPing();
}

/* ---- the position, while the job is open ---- */
var PINGID = null, PINGJOB = null, WAKE = null;

/* Android and iOS both stop a browser's GPS when the screen sleeps.
   Holding a wake lock while a delivery is live is the only thing a web
   app can do about it. A real always-on tracker needs the native app
   and a foreground service. */
function holdScreen(){
  try{
    if(navigator.wakeLock && !WAKE){
      navigator.wakeLock.request("screen").then(function(w){
        WAKE = w;
        w.addEventListener("release", function(){ WAKE = null; });
      }).catch(function(){});
    }
  }catch(e){}
}
function releaseScreen(){
  try{ if(WAKE){ WAKE.release(); WAKE = null; } }catch(e){}
}

function stopPing(){
  if(PINGID != null){ try{ navigator.geolocation.clearWatch(PINGID); }catch(e){} }
  PINGID = null; PINGJOB = null;

  /* the notification must go the moment the delivery does - a
     tracker that outlives the job is the thing riders rightly
     resent about every app like this */
  if(NATIVEJOB){ clearInterval(NATIVEJOB); NATIVEJOB = null; }
  var N = native();
  if(N){ try{ N.stop(); }catch(e){} }

  releaseScreen();
}
/* The native tracker, if this is the rider app rather than a
   browser tab. It is the only thing that keeps a position
   flowing once the screen sleeps. */
function native(){
  try{ return (window.HayatTrack && typeof window.HayatTrack.start === "function")
         ? window.HayatTrack : null; }catch(e){ return null; }
}

var NATIVEJOB = null;

function startPing(id){
  if(PINGJOB === id) return;
  stopPing();

  /* ---- the app: hand the job to the foreground service ---- */
  var N = native();
  if(N){
    PINGJOB = id;
    try{ N.start(id); }catch(e){}
    var seen = 0;
    NATIVEJOB = setInterval(function(){
      var raw = "";
      try{ raw = N.fix() || ""; }catch(e){}
      if(!raw){
        var t = el("gpsTxt");
        if(t && !STORE.order(id).rAt) t.textContent = "Waiting for a fix\u2026";
        return;
      }
      var p = raw.split(",");
      var at = +p[2];
      if(at === seen) return;          /* nothing new since last look */
      seen = at;
      STORE.ping(id, +p[0], +p[1]);   /* the repaint draws the rest */
    }, 5000);
    return;
  }

  /* ---- a browser: the best a web page is allowed to do ---- */
  if(!navigator.geolocation) return;
  PINGJOB = id;
  holdScreen();
  var last = 0;
  PINGID = navigator.geolocation.watchPosition(function(pos){
    var now = Date.now();
    if(now - last < 5000) return;         /* five seconds, as agreed */
    last = now;
    STORE.ping(id, pos.coords.latitude, pos.coords.longitude);
  }, function(){
    var t = el("gpsTxt");
    if(t) t.textContent = "Location is off \u2014 the customer cannot see you move";
  }, { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
}

/* ============================================================
   chrome
   ============================================================ */
function shell(title, body, wide){
  return '<div class="backbar">' +
      '<button class="back" data-go="#/"><span class="a">‹</span>Menu</button>' +
      '<span class="crumbtxt">' + esc(title) + '</span></div>' +
    '<div class="shopwrap' + (wide ? " wide" : "") + '">' +
      '<h2 class="shoph">' + esc(title) + '</h2>' + body + '</div>';
}

/* The office runs on a desktop all day. It gets the whole window:
   no category rail, no menu chrome, just the work. */
function deskMode(on){
  try{ document.body.classList.toggle("deskwork", !!on); }catch(e){}
}

/* The rider is not browsing a restaurant. They are working, on a
   phone, one-handed, often in the sun. Everything that belongs to
   the customer's menu - the category rail, the search, the footer,
   the cart button - is noise on their screen, so it goes away. */
function rideMode(on){
  try{ document.body.classList.toggle("ridework", !!on); }catch(e){}
}
/* Enter should submit. Every single-field form in this app is
   someone standing up, one-handed, wanting to be done - making
   them reach for a button is a small rudeness repeated all day. */
function onEnter(node, run){
  if(!node) return;
  node.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    if(e.shiftKey && node.tagName === "TEXTAREA") return;
    e.preventDefault();
    /* Let go of the field before acting. Submitting leaves the
       caret sitting in the input, and the repaint guard quite
       rightly refuses to redraw a page somebody is typing into -
       so without this the list never refreshes and the keyboard
       stays up over the result. */
    try{ node.blur(); }catch(err){}
    run();
  });
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

/* ------------------------------------------------------------
   THE CUSTOMER SIDE IS A WEBSITE, NOT AN APP TO INSTALL

   A customer ordering dinner should not be asked to install
   anything. Chrome offers it anyway once a site has a manifest
   and a service worker, so we decline on the customer's behalf.

   The rider is the opposite case and keeps its own front door
   at rider.html, which stays installable - that one IS a tool
   somebody uses every day, and an icon is the point of it.
   ------------------------------------------------------------ */
window.addEventListener("beforeinstallprompt", function(e){
  var onRider = /rider\.html/.test(location.pathname) ||
                /^#\/drive\b/.test(location.hash || "");
  if(onRider) return;              /* let the rider be installed */
  e.preventDefault();
});

/* ---------- routing ---------------------------------------- */

/* Something is being typed right now.

   The rider's page repaints every time their position is sent,
   which is every five seconds. A repaint replaces the whole
   view, so a half-written message was being thrown away and
   the keyboard closed with it. Nothing may redraw the page
   while a field has focus; the next event repaints instead. */
function isTyping(){
  try{
    var a = document.activeElement;
    if(!a) return false;
    var t = (a.tagName || "").toLowerCase();
    return t === "textarea" || t === "select" ||
           (t === "input" && !/^(button|submit|checkbox|radio)$/i.test(a.type || "text"));
  }catch(e){ return false; }
}

var REPAINT = null;
var MISSED  = false;

/* every repaint goes through here, so the rule holds everywhere */
function repaintNow(){
  if(!REPAINT) return;
  if(isTyping()){ MISSED = true; return; }
  MISSED = false;
  REPAINT();
}

/* when they finish typing, catch up on whatever was held back */
document.addEventListener("focusout", function(){
  setTimeout(function(){ if(MISSED && !isTyping()) repaintNow(); }, 60);
}, true);

function route(p, main){
  REPAINT = null;
  deskMode(p[0] === "admin");
  rideMode(p[0] === "drive");
  if(p[0] !== "admin") liveWatch(false, main);
  if(p[0] !== "drive") stopPing();      /* never track off the job page */
  if(p[0] === "orders")   { REPAINT = function(){ viewMyOrders(main); }; REPAINT(); return true; }
  if(p[0] === "cart")     { viewCart(main); return true; }
  if(p[0] === "checkout") { viewCheckout(main); return true; }
  if(p[0] === "o")        { REPAINT = function(){ viewOrder(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "drive")    { REPAINT = function(){ viewDrive(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "admin"){
    if(p[1] === "riders") { REPAINT = function(){ if(REDIT) return; viewRiders(main); }; REPAINT(); return true; }
    if(p[1] === "o" && p[2]) { REPAINT = function(){ viewEdit(main, p[2]); }; REPAINT(); return true; }
    REPAINT = function(){ viewAdmin(main); }; REPAINT(); return true;
  }
  return false;
}
STORE.onChange(function(){
  repaintNow();
  /* a rider signed in on this phone gets told about work wherever
     they are in the app, not only on the deliveries page */
  try{ if(riderPhone()) checkForWork(); }catch(e){}
});

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
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible" && PINGJOB) holdScreen();
});

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
