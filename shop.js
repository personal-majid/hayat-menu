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
/* The fallback way in.

   This is readable by anyone who views the page source, so it is
   a stopgap, not a lock. It exists so the office is never shut
   out - offline, or before the crew list has been set up in the
   console. The real login is crew/<id> in Firestore, where the
   code never reaches the browser at all and the rules do the
   checking. Set that up and this stops mattering. */
function PASSCODE(){
  /* read when needed, not at parse time: C is a function
     expression defined further down, so it does not exist yet
     up here - which is exactly how this broke once already */
  return ((window.CONFIG || {}).adminCode) || "112233";
}
var KEY = "hayat_shop_v1";
var CH  = null;
try{ CH = new BroadcastChannel("hayat_shop"); }catch(e){}

var watchers = [];
function fire(){ watchers.slice().forEach(function(f){ try{ f(); }catch(e){} }); }
try{ if(CH) CH.onmessage = fire; }catch(e){}

/* the working copy every view reads from */
var DB = { orders:{}, riders:{}, customers:{}, verify:{}, pings:{}, seq:100 };
var LIVE  = false;             /* true only once the SERVER has answered */
var FAULT = null;              /* why it is not live, in one word */

/* ----- local backing ----- */
function lsRead(){
  try{ var d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { orders:d.orders||{}, riders:d.riders||{}, customers:d.customers||{},
             verify:d.verify||{}, pings:d.pings||{}, seq:d.seq||100 }; }
  catch(e){ return { orders:{}, riders:{}, customers:{}, verify:{}, pings:{}, seq:100 }; }
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

/* ------------------------------------------------------------
   ONE PERSON, ONE KEY

   The same number gets typed four ways:

     9844326842        as they say it
     09844326842       with the trunk zero
     +91 98443 26842   as the phone book has it
     91 9844326842     as WhatsApp shows it

   digitsOnly gave four different strings, so it gave four
   different customers - four sets of orders, four addresses, and
   a checkout that prefilled nothing because the number "had
   never ordered before".

   The key is the ten digits that actually identify an Indian
   mobile. Country code and trunk zero are spelling, not
   identity, so they come off. Anything that is not a ten-digit
   number is left exactly as typed rather than mangled into one -
   a landline or a foreign number should stay wrong-looking
   rather than silently become somebody else.
   ------------------------------------------------------------ */
function phoneKey(v){
  var d = digitsOnly(v);
  if(d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);   /* +91... */
  else if(d.length === 11 && d.charAt(0) === "0") d = d.slice(1); /* 0...  */
  else if(d.length === 13 && d.indexOf("091") === 0) d = d.slice(3);
  return d;
}

/* For dialling and for wa.me, which want the country code back. */
function phoneWa(v){
  var d = digitsOnly(v);
  if(d.length === 10) return "91" + d;
  if(d.length === 11 && d.charAt(0) === "0") return "91" + d.slice(1);
  return d;
}

/* A name for this browser, so a customer who never signs in
   still has an identity the office can link orders to. Made once
   and kept; it is not a login and proves nothing on its own,
   which is why the office does the approving. */
function deviceId(){
  try{
    var d = localStorage.getItem("hayat_device");
    if(!d){
      d = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("hayat_device", d);
    }
    return d;
  }catch(e){ return null; }
}

/* who this browser is, signed in or not */
function meId(){ return ME.uid || deviceId(); }

/* What this browser has ordered. Kept locally, because somebody
   who never signs in still deserves to find their own order. */
function localOrderIds(){
  try{ return JSON.parse(localStorage.getItem("hayat_mine")) || []; }catch(e){ return []; }
}
function rememberOrderId(id){
  try{
    var all = localOrderIds();
    if(all.indexOf(id) < 0) all.push(id);
    localStorage.setItem("hayat_mine", JSON.stringify(all.slice(-40)));
  }catch(e){}
}

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
  return "https://wa.me/" + phoneWa(r.phone) + "?text=" + encodeURIComponent(t);
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
  watch("customers", "customers");
  watch("verify", "verify");
  watch("pings",  "pings");

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

  /* The orders this person can see.

     Two ways to own an order: signed in, and it carries your id -
     which follows you to any phone; or this browser placed it,
     which it wrote down at the time. The second is what makes
     the app useful to somebody who never signs in at all. */
  myOrders: function(){
    var me = meId();
    var here = localOrderIds();
    return Object.keys(DB.orders).map(function(k){ return DB.orders[k]; })
      .filter(function(o){
        if(me && o.custUid && o.custUid === me) return true;
        return here.indexOf(o.id) >= 0;
      })
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
    var id = phoneKey(phone);
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
    /* An empty order is a mistake - unless it is a ticket, which
       is somebody saying "call me, I will tell you what I want".
       Those are meant to arrive empty and be filled in by the
       office. Everything else must carry what it is for. */
    if(!o) return null;
    if(o.kind !== "ticket" && !(o.lines || []).length) return null;
    var id = orderId();
    /* who placed it, so it can be found again on another phone */
    o.custUid = meId();
    if(myVoice() === "customer") rememberOrderId(id);
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
    /* An order edited down to nothing cannot be sent out. A ticket
       may be accepted while still empty - that is the office
       picking up the phone - but nothing goes on a bike until
       somebody has written down what it is. */
    if(s === "cancelled") { /* always allowed */ }
    else if(!(o.lines || []).length){
      var justAccepting = (o.kind === "ticket" && s === "accepted");
      if(!justAccepting) return null;
    }
    o.status = s;
    if(extra) for(var k in extra) o[k] = extra[k];
    (o.log = o.log || []).push({ s:s, at:Date.now() });

    /* The job is over: stop holding on to where the rider was. */
    /* The rider is standing at the door right now and their phone
       knows where that is. This is the only moment in the whole
       flow when the address is a fact rather than a description,
       so it is the only moment worth learning from. */
    if(s === "delivered"){
      var fresh = staleness(o.rAt);
      if(o.rLat && fresh.state === "live"){
        /* The doorstep rides on the order, not straight into the
           book. A rider may write to their own delivery; nobody
           but the office may touch the customer records. The
           office promotes it the next time it looks. */
        o.doorLat = o.rLat; o.doorLng = o.rLng; o.doorAt = Date.now();
      }
      if(ME.role === "office" || !LIVE) learnDoorsteps();
    }

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

  /* ---- proving a number on a new phone ---------------------
     Somebody on a new device wants their old orders back. A
     phone number alone cannot prove that - anyone can type any
     number - so the shop decides, not the browser.

     The customer asks. The office either recognises them and
     approves, or WhatsApps them a code to read back. Either way
     the office does the approving, and the office is what links
     the orders to the new device afterwards - which is why no
     new read permission is needed anywhere. */
  askToSee: function(phone, uid){
    var id = phoneKey(phone);
    if(!id) return null;
    var row = { id:id, phone:phone, uid: uid || meId(),
                at: Date.now(), ok:false, code:null, codeTry:null };
    DB.verify[id] = row;
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "verify", id), row)
        .catch(function(e){ console.warn("askToSee", e); });
      fire();
    } else lsWrite();
    return row;
  },

  waiting: function(){
    return Object.keys(DB.verify).map(function(k){ return DB.verify[k]; })
      .filter(function(v){ return !v.ok; })
      .sort(function(a,b){ return b.at - a.at; });
  },

  verifyRow: function(phone){
    var id = phoneKey(phone);
    return id ? (DB.verify[id] || null) : null;
  },

  /* the office issues a code to read back over WhatsApp */
  issueCode: function(id){
    var v = DB.verify[id];
    if(!v) return null;
    var code = String(Math.floor(Math.random() * 9000) + 1000);
    v.code = code; v.sentAt = Date.now();
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "verify", id),
        { code:code, sentAt:v.sentAt })
        .catch(function(e){ console.warn("issueCode", e); });
      fire();
    } else lsWrite();
    return code;
  },

  /* the customer types it back; they never get to read it */
  tryCode: function(id, code){
    var v = DB.verify[id];
    if(!v) return false;
    if(FB){
      return FB.api.updateDoc(FB.api.doc(FB.db, "verify", id),
        { codeTry: String(code).trim(), triedAt: Date.now() })
        .then(function(){ return true; })
        .catch(function(){ return false; });
    }
    /* offline: compare here, because there are no rules to do it */
    if(String(code).trim() === v.code){ v.ok = true; lsWrite(); return true; }
    return false;
  },

  /* The office says yes, and links every order on that number to
     the device that asked. Done here because the office may write
     orders and a customer may not - so nobody needs a new read
     permission for any of this to work. */
  approveSight: function(id){
    var v = DB.verify[id];
    if(!v || !v.uid) return 0;
    v.ok = true; v.okAt = Date.now();
    var n = 0;
    Object.keys(DB.orders).forEach(function(k){
      var o = DB.orders[k];
      if(phoneKey(o.phone) !== id) return;
      if(o.custUid === v.uid) return;
      o.custUid = v.uid; n++;
      if(FB) FB.api.updateDoc(FB.api.doc(FB.db, "orders", k), { custUid: v.uid })
              .catch(function(e){ console.warn("link", e); });
    });
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "verify", id), { ok:true, okAt:v.okAt })
        .catch(function(e){ console.warn("approveSight", e); });
      fire();
    } else lsWrite();
    return n;
  },

  dropSight: function(id){
    delete DB.verify[id];
    if(FB){
      FB.api.deleteDoc(FB.api.doc(FB.db, "verify", id))
        .catch(function(e){ console.warn("dropSight", e); });
      fire();
    } else lsWrite();
  },

  /* ---- the customer book ----------------------------------
     Every order teaches us something about a customer, and the
     most valuable lesson arrives at the end: the rider is
     standing at their door, and the phone in their pocket knows
     exactly where that is.

     So a delivered order writes the doorstep back. Next time
     the same number rings, the office already knows where to
     send somebody - no pin to drop, no landmark to describe.

     Keyed by phone, digits only, because that is the one thing
     a caller always gives you. */
  customer: function(phone){
    var id = phoneKey(phone);
    return id ? (DB.customers[id] || null) : null;
  },
  customers: function(){
    return Object.keys(DB.customers).map(function(k){ return DB.customers[k]; })
      .sort(function(a,b){ return (b.lastAt || 0) - (a.lastAt || 0); });
  },

  /* ---- where they were when they last opened the app -----
     Not the delivery address and never allowed to become it. A
     doorstep is a rider standing at a door; this is a phone
     saying roughly where its owner was, and it is only ever
     read as a hint. It rides in its own collection because a
     customer may not write to the customer book - the office
     promotes it, exactly like the doorstep. */
  pingSeen: function(phone, lat, lng){
    var id = phoneKey(phone);
    if(!id || lat == null || lng == null) return null;
    var row = { id:id, phone:phone, lat:+(+lat).toFixed(5),
                lng:+(+lng).toFixed(5), at:Date.now() };
    DB.pings[id] = row;
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "pings", id), row, { merge:true })
        .catch(function(e){ console.warn("pingSeen", e); });
    } else lsWrite();
    return row;
  },

  pings: function(){ return DB.pings; },

  /* ---- is this really them? ------------------------------
     Two ways a number becomes trusted. Either they typed the
     code we WhatsApped them, which the verify row records, or
     somebody in the office rang them and said so. The office
     one is a judgement, so it is signed and dated. */
  isVerified: function(c){
    if(!c) return false;
    if(c.verified) return true;
    var v = DB.verify[c.id];
    return !!(v && v.ok);
  },

  setVerified: function(phone, yes, how){
    var id = phoneKey(phone);
    var c = DB.customers[id];
    if(!c) return null;
    var patch = {
      verified: !!yes,
      verifiedAt: yes ? Date.now() : null,
      verifiedBy: yes ? (myVoice() + (how ? " \u00b7 " + how : "")) : null
    };
    for(var k in patch) c[k] = patch[k];
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "customers", id), patch)
        .catch(function(e){ console.warn("setVerified", e); });
      fire();
    } else lsWrite();
    return c;
  },

  /* what we know, merged with what we just learned */
  rememberCustomer: function(o, extra){
    var id = phoneKey(o && o.phone);
    if(!id) return null;

    var was = DB.customers[id] || { id:id, phone:o.phone, firstAt: o.at || Date.now() };
    /* An empty field on a new order is not news - it is somebody
       who did not retype what they already told us. Only real
       values replace what the book already holds. */
    var now = Object.assign({}, was, {
      id: id,
      phone: (o.phone || was.phone),
      name:  (o.name && o.name.trim()) || was.name || "",
      addr:  (o.addr && o.addr.trim()) || was.addr || "",
      lastAt: Math.max(was.lastAt || 0, o.at || Date.now()),
      orders: (was.orders || 0) + (extra && extra.counted ? 1 : 0)
    }, extra || {});

    /* a position the rider stood at beats a pin dropped from a
       sofa, so it is only overwritten by another delivery */
    if(!extra || !extra.lat){
      if(was.locFrom !== "delivered" && o.lat){
        now.lat = o.lat; now.lng = o.lng; now.locFrom = "pin";
      }
    }

    DB.customers[id] = now;
    if(FB){
      FB.api.setDoc(FB.api.doc(FB.db, "customers", id), now, { merge:true })
        .catch(function(e){ console.warn("rememberCustomer", e); });
      fire();
    } else lsWrite();
    return now;
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
    var id = phoneKey(phone);
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

  /* A rider saying whether they are working.

     The office should never have to guess. A rider who has gone
     home is not "quiet", they are off, and an order assigned to
     them is an order nobody is carrying. */
  setAvailable: function(id, on){
    var r = DB.riders[id];
    if(!r) return null;
    r.avail = !!on;
    r.availAt = Date.now();
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "riders", id),
        { avail: !!on, availAt: r.availAt })
        .catch(function(e){ console.warn("setAvailable", e); });
      fire();
    } else lsWrite();
    return r.avail;
  },

  /* Sign a rider's phone out from the office.

     Clearing the claimed device is what actually ends a session:
     their app finds itself unknown and asks for the code again.
     The code survives, so an honest rider gets straight back in
     and a phone left in a drawer does not. */
  signOutRider: function(id, keepCode){
    var r = DB.riders[id];
    if(!r) return null;
    var patch = { uid:null, claimedAt:null, avail:false, kicked: Date.now() };
    if(!keepCode) patch.code = sixDigits();
    for(var k in patch) r[k] = patch[k];
    if(FB){
      FB.api.updateDoc(FB.api.doc(FB.db, "riders", id), patch)
        .catch(function(e){ console.warn("signOutRider", e); });
      fire();
    } else lsWrite();
    return patch.code || r.code;
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

    var moved = patch.phone && phoneKey(patch.phone) !== id;
    if(!moved){
      Object.keys(patch).forEach(function(k){ r[k] = patch[k]; });
      if(FB){
        FB.api.updateDoc(FB.api.doc(FB.db, "riders", id), patch)
          .catch(function(e){ console.warn("editRider", e); });
        fire();
      } else lsWrite();
      return id;
    }

    var nid = phoneKey(patch.phone);
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
  /* wa.me will not accept a bare ten-digit Indian number - it
     needs the country code, which is exactly the part phoneKey
     strips off to decide identity. Same number, two spellings,
     each for its own job. */
  return "https://wa.me/" + phoneWa(number) +
         "?text=" + encodeURIComponent(text);
}

/* ---------- the cart (this browser only) ------------------- */
var CART = [];

/* ------------------------------------------------------------
   CHANGING AN ORDER THAT IS ALREADY IN

   Somebody forgot the bread. Until the kitchen has said yes, that
   is their order to change, and making them cancel and start
   again - or ring - is a small cruelty we do not need. So the
   order's lines come back into the cart, and when they send it
   the same order is updated. Once it is accepted the door shuts
   and the button becomes a phone number.
   ------------------------------------------------------------ */
var AMEND = null;
try{ AMEND = sessionStorage.getItem("hayat_amend") || null; }catch(e){}
function setAmend(id){
  AMEND = id || null;
  try{ if(AMEND) sessionStorage.setItem("hayat_amend", AMEND);
       else sessionStorage.removeItem("hayat_amend"); }catch(e){}
}
/* still allowed? the order must exist, be theirs, and be untouched */
function amendable(){
  if(!AMEND) return null;
  var o = STORE.order(AMEND);
  if(!o || o.status !== "placed"){ setAmend(null); return null; }
  return o;
}
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
  var d = phoneKey(v);
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

/* Assigning from inside a map popup.

   Leaflet builds a popup when it is opened, long after the view
   was painted, so nothing wired at paint time can reach it. One
   delegated listener covers every popup there will ever be. */
document.addEventListener("change", function(e){
  var sel = e.target;
  if(!sel || !sel.dataset || !sel.dataset.massign) return;
  if(!sel.value) return;
  var id = sel.dataset.massign;
  var o = STORE.setStatus(id, "assigned", { riderId: sel.value });
  var r = STORE.rider(sel.value);
  if(o && r){
    shopToast(r.name + " is on " + id + ".");
    window.open(wa(r.phone, riderMsg(o, r)), "_blank");
  }
  try{ AMAP && AMAP.closePopup(); }catch(err){}
});

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

/* ------------------------------------------------------------
   THE SEARCH PALETTE

   A search box at the foot of a long form is a search box you
   scroll past. This opens over the page, in the middle of the
   screen, with the caret already in it - so adding a dish is
   one tap, type, one tap, and it stays open for the next one.

   Escape closes it. So does the backdrop. The arrow keys move
   through the results, because the office runs on a desktop
   with a keyboard and should not have to reach for the mouse.
   ------------------------------------------------------------ */
var PAL = null;

function openFinder(onPick, action){
  closeFinder();

  var wrap = document.createElement("div");
  wrap.className = "palette";
  wrap.innerHTML =
    '<div class="palbox" role="dialog" aria-label="Search the menu">' +
      '<div class="palhead">' +
        '<input class="palin" id="palIn" autocomplete="off" ' +
          'placeholder="Search the menu\u2026 chicken, mandi, juice">' +
        '<button class="palx" id="palX" aria-label="Close">\u00d7</button>' +
      '</div>' +
      '<div class="palout" id="palOut">' +
        '<p class="shopnote fnone">Start typing a dish.</p>' +
      '</div>' +
      '<div class="palfoot"><span>\u2191\u2193 to move \u00b7 Enter to add \u00b7 Esc to close</span></div>' +
    '</div>';
  document.body.appendChild(wrap);
  document.body.classList.add("palopen");
  PAL = wrap;

  var box = wrap.querySelector("#palIn");
  var out = wrap.querySelector("#palOut");
  var at  = 0;

  function rows(){ return [].slice.call(out.querySelectorAll("[data-find]")); }
  function mark(){
    rows().forEach(function(r, i){
      r.classList.toggle("on", i === at);
      if(i === at && r.scrollIntoView) r.scrollIntoView({ block:"nearest" });
    });
  }

  function draw(){
    var q = box.value.trim();
    if(!q){
      out.innerHTML = '<p class="shopnote fnone">Start typing a dish.</p>';
      return;
    }
    var hits = findDishes(q, 40);
    out.innerHTML = hits.length
      ? hits.map(function(r){ return findRowHtml(r, action || "Add"); }).join("")
      : '<p class="shopnote fnone">Nothing matches \u201c' + esc(q) + '\u201d.</p>';
    at = 0; mark();
    rows().forEach(function(r, i){
      r.onmouseenter = function(){ at = i; mark(); };
      r.onclick = function(){ take(r); };
    });
  }

  function take(r){
    var parts = r.dataset.find.split("|");
    var price = +parts[parts.length - 1];
    var lbl   = parts.slice(1, -1).join("|");
    onPick(parts[0], lbl, price, r);
    /* stay open: nobody adds exactly one thing to an order */
    r.classList.add("done");
    var tag = r.querySelector(".fadd");
    if(tag) tag.textContent = "Added \u2713";
    box.focus();
    box.select();
  }

  var job = null;
  box.addEventListener("input", function(){
    clearTimeout(job); job = setTimeout(draw, 100);
  });
  box.addEventListener("keydown", function(e){
    var list = rows();
    if(e.key === "Escape"){ e.preventDefault(); closeFinder(); return; }
    if(e.key === "ArrowDown"){ e.preventDefault(); at = Math.min(at + 1, list.length - 1); mark(); return; }
    if(e.key === "ArrowUp"){ e.preventDefault(); at = Math.max(at - 1, 0); mark(); return; }
    if(e.key === "Enter"){ e.preventDefault(); if(list[at]) take(list[at]); return; }
  });

  wrap.querySelector("#palX").onclick = closeFinder;
  wrap.addEventListener("mousedown", function(e){
    if(e.target === wrap) closeFinder();
  });

  setTimeout(function(){ box.focus(); }, 30);
}

function closeFinder(){
  if(!PAL) return;
  try{ PAL.remove(); }catch(e){}
  PAL = null;
  document.body.classList.remove("palopen");
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

/* A way in for somebody who will not read a menu. It sits
   opposite the cart, disappears the moment there is anything in
   that cart - at which point they clearly are reading the menu -
   and never shows on the office or rider screens. */
function paintCallFab(){
  if(riderApp()) return;
  var f = el("callfab");
  if(!f){
    f = document.createElement("button");
    f.id = "callfab";
    f.innerHTML = '<span class="ci">\u260E</span> Order food';
    f.onclick = function(){ location.hash = "#/quick"; };
    document.body.appendChild(f);
  }
  var h = location.hash || "";
  /* The landing already has this as its one big button; a second
     copy floating over it is exactly the clutter it replaced. It
     shows only once they have gone into the menu. */
  var onLanding = (h === "" || h === "#" || h === "#/") && wantsLanding();
  f.hidden = cartCount() > 0 || onLanding ||
             /^#\/(admin|drive|o|quick|checkout|cart|orders|seen)\b/.test(h);
}

/* ---------- the floating cart button ----------------------- */
function paintFab(){
  paintCallFab();
  var f = el("cartfab");
  if(!f){
    f = document.createElement("button");
    f.id = "cartfab";
    f.onclick = function(){ location.hash = "#/cart"; };
    document.body.appendChild(f);
  }
  var n = cartCount();
  /* On the cart and the checkout it is not a way forward, it is
     a way back to where they already are - and on the address
     screen it reads as a second button competing with Place. */
  f.hidden = (n === 0) ||
    /^#\/(admin|drive|o|cart|checkout)\b/.test(location.hash||"");
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

/* The customer's side of proving a number on a new phone. */
function viewSeeOld(main){
  var v = SEEKING ? STORE.verifyRow(SEEKING) : null;
  var asked = !!v;
  var sent  = !!(v && v.code);

  main.innerHTML = shell("Your past orders",
    (!asked
      ? '<p class="revsub">On a new phone? Two ways to get your ' +
        'orders back.</p>' +

        /* Instant, if they ever signed in: nobody has to approve
           anything, because Google already proved who they are. */
        (STORE.live() && STORE.isGuest()
          ? '<button class="shopbtn" id="soGoogle">Sign in with Google</button>' +
            '<p class="opt">Instant, if you used it before.</p>' +
            '<div class="orline"><span>or</span></div>'
          : '') +

        '<input class="fld big" id="soPhone" type="tel" inputmode="tel" ' +
          'autocomplete="tel" placeholder="Phone number">' +
        '<button class="shopbtn' + (STORE.live() ? " ghost" : "") + '" id="soGo">' +
          'Ask the restaurant</button>' +
        '<p class="opt">We will check it is you and confirm.</p>'

      : '<div class="waitbox">' +
          '<b>' + (sent ? "We sent you a code on WhatsApp"
                        : "We are checking with the restaurant") + '</b>' +
          '<small>' + (sent
            ? "Type the four digits below."
            : "Someone will approve it in a moment. If it is busy, give us a ring.") +
          '</small>' +
        '</div>' +
        (sent
          ? '<input class="fld big" id="soCode" inputmode="numeric" ' +
              'autocomplete="one-time-code" maxlength="4" placeholder="4-digit code">' +
            '<button class="shopbtn" id="soCheck">That is the code</button>'
          : '<div class="waiting"><span></span><span></span><span></span></div>') +
        '<button class="shopbtn ghost" id="soStop">Start again</button>') +

    '<button class="shopbtn ghost" data-go="#/">Back</button>');

  var gg = el("soGoogle");
  if(gg) gg.onclick = function(){
    gg.disabled = true; gg.textContent = "Opening\u2026";
    STORE.signInGoogle().then(function(){
      shopToast("Welcome back.");
      location.hash = "#/orders";
    }).catch(function(e){
      gg.disabled = false; gg.textContent = "Sign in with Google";
      var code = (e && e.code) || "";
      if(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      shopToast("That did not work \u2014 use your number instead.");
    });
  };

  var go = el("soGo");
  if(go) go.onclick = function(){
    var ph = el("soPhone").value.trim();
    if(!digitsOnly(ph)){ shopToast("A phone number, please."); return; }
    STORE.askToSee(ph);
    SEEKING = phoneKey(ph);
    shopToast("Asked. We will confirm in a moment.");
    viewSeeOld(main);
  };
  if(el("soPhone")) onEnter(el("soPhone"), function(){ go.onclick(); });

  var ck = el("soCheck");
  if(ck) ck.onclick = function(){
    var code = el("soCode").value.trim();
    if(code.length < 4){ shopToast("Four digits."); return; }
    Promise.resolve(STORE.tryCode(SEEKING, code)).then(function(){
      shopToast("Checking\u2026");
      setTimeout(function(){ viewSeeOld(main); }, 900);
    });
  };
  if(el("soCode")) onEnter(el("soCode"), function(){ ck.onclick(); });

  var st = el("soStop");
  if(st) st.onclick = function(){
    if(SEEKING) STORE.dropSight(SEEKING);
    SEEKING = null;
    viewSeeOld(main);
  };

  /* the moment the office says yes, their orders are theirs */
  if(v && v.ok){
    SEEKING = null;
    shopToast("That is you \u2014 here are your orders.");
    location.hash = "#/orders";
  }
}

var SEEKING = null;

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
      ? '<p class="shopsub">Orders you place on this phone appear here.</p>' +
        '<button class="shopbtn ghost" data-go="#/seen">Ordered before on another phone?</button>'
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
  return '<button class="shopbtn ghost findbtn" id="ctFind">' +
    '<span class="fi">\uD83D\uDD0D</span> Search the menu' +
  '</button>';
}

function wireCartFinder(main){
  var b = el("ctFind");
  if(!b) return;
  b.onclick = function(){
    openFinder(function(did, lbl, price){
      var it = dishById(did);
      addLine(did, it ? label(it.name) : did, lbl, price);
      paintFab();
      viewCart(main);       /* the list behind keeps up */
    }, "Add");
  };
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
  var am = amendable();
  main.innerHTML = shell(am ? "Changing order " + esc(am.id) : "Your cart",
    (am ? '<div class="amendbar"><b>You are changing order ' + esc(am.id) + '</b>' +
          '<small>Add or remove, then send it again. It replaces what we have.</small>' +
          '<button class="linky" id="amendNo">Leave it as it was</button></div>' : '') +
    (am ? '' : signInStrip()) +
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
    '<button class="shopbtn" data-go="#/checkout">' + (am ? "Update the order" : "Checkout") + '</button>' +
    '<button class="shopbtn ghost" data-go="#/">Browse the menu</button>');

  wireCartFinder(main);
  wireSignIn(main, function(){ viewCart(main); });
  var an = el("amendNo");
  if(an) an.onclick = function(){
    var id = AMEND; setAmend(null);
    CART = []; saveCart(); paintFab();
    location.hash = "#/o/" + id;
  };
}

/* What we already know about the person ordering.

   Two sources, in order of trust. Their own last order, which
   follows them to any phone they sign in on - and which their
   browser is allowed to read, because it is theirs. Then this
   device's memory, for the far commoner case of somebody
   ordering again from the same phone.

   Never the customer book. That is the office's record of
   everyone, and a browser that could read it by typing a number
   would hand a stranger's home address to anybody who guessed
   their phone. The rules forbid it; so does this. */
function knownMe(){
  var mine = STORE.myOrders();
  var last = mine[0];
  var dev = {};
  try{ dev = JSON.parse(localStorage.getItem("hayat_me")) || {}; }catch(e){}

  if(!last) return dev;
  return {
    name:  last.name || dev.name || "",
    phone: last.phone || dev.phone || "",
    addr:  last.addr || dev.addr || "",
    lat:   last.lat != null ? last.lat : dev.lat,
    lng:   last.lng != null ? last.lng : dev.lng,
    from:  "last order"
  };
}

/* ------------------------------------------------------------
   ORDER FOOD, WITHOUT READING A MENU

   Plenty of people will not scroll a menu on a phone. They know
   what they want, or they want to be asked. So: a number, a
   place to send it, and the kitchen rings them back.

   The ticket lands on the board empty and says so. The office
   fills it in while they are on the phone, and the customer's
   own page fills in with it, live - so they can see what was
   written down without having to remember the call.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   THE FRONT DOOR

   One file, two front doors.

   The tablet on a table is a menu: the intro, the gallery, the
   categories. Browsing is the job there, and a guest waiting for
   their food should be looking at pictures of it.

   A phone arriving from a WhatsApp link is not browsing. It is
   hungry. It wants to know you are open, how long you take, and
   how to order - in that order, without scrolling past eleven
   categories to find out.
   ------------------------------------------------------------ */
function kiosk(){ return !!window.HAYAT_KIOSK; }

function wantsLanding(){
  if(riderApp() || kiosk()) return false;
  /* There used to be a "browsing" flag here that, once set, handed
     #/ back to the tablet's home page - so a phone had two home
     screens, and an empty cart could land you on "Watch the
     intro". On a phone, #/ is this screen. Always. */
  /* a desk is for looking; a phone in a hand is for ordering */
  try{ return window.matchMedia("(max-width: 820px)").matches; }catch(e){ return false; }
}

/* "11:00" is a machine talking. People say eleven, and one in the
   morning, so that is what the landing page says. */
function clockWords(t){
  var p = String(t).split(":");
  var h = +p[0], m = +(p[1] || 0);
  var ampm = h >= 12 ? "pm" : "am";
  var hh = h % 12; if(hh === 0) hh = 12;
  return hh + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ampm;
}

function openNow(){
  var h = C().hours;
  if(!h || !h.open || !h.close) return { open:true, txt:"" };
  var now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  var toM = function(t){ var p = String(t).split(":"); return (+p[0]) * 60 + (+p[1] || 0); };
  var a = toM(h.open), b = toM(h.close);
  /* A kitchen that closes after midnight has a closing time
     smaller than its opening one, so the window wraps round. */
  var on = (b > a) ? (mins >= a && mins < b) : (mins >= a || mins < b);
  return { open: on,
           txt: on ? ("Open until " + clockWords(h.close))
                   : ("Opens at " + clockWords(h.open)) };
}

/* ------------------------------------------------------------
   THE FRONT DOOR ON A PHONE

   Two buttons of equal weight is a question, and a hungry person
   at ten at night did not come here to answer a question. So
   there is one obvious thing to press - tell us your number, we
   ring you back - and underneath it the categories, in words,
   for anybody who would rather pick for themselves.

   No photographs on this screen. Pictures sell a dish once
   somebody is looking at dishes; on the way in they are weight
   on a phone outside the shop, and they make ten categories
   look like a wall. The thumbnails start where they earn their
   keep, on the dish list.
   ------------------------------------------------------------ */
function viewLanding(main){
  var shop = ((C().delivery || [])[0] || {}).number || C().whatsapp || "";
  var st   = openNow();
  var mine = STORE.myOrders();
  var live = mine.filter(function(o){
    return o.status !== "delivered" && o.status !== "cancelled";
  })[0];
  var last = mine.filter(function(o){
    return o.status === "delivered" && (o.lines || []).length;
  })[0];

  var cats = (window.MENU || []).filter(function(c){
    return c && c.id && (c.items || []).length;
  });

  main.innerHTML =
    '<div class="land">' +

      '<div class="landtop">' +
        '<h1 class="landh">Hayat</h1>' +
        '<p class="landsub">Fish and Mandi \u00b7 Makkaraparamba</p>' +
        '<div class="landstate' + (st.open ? " on" : " off") + '">' +
          '<span class="ldot"></span>' + esc(st.txt || (st.open ? "Open" : "Closed")) +
        '</div>' +
      '</div>' +

      /* If something is already on its way, that is the only thing
         they came here to see. */
      (live
        ? '<a class="landlive" href="#/o/' + esc(live.id) + '">' +
            '<div><b>' + esc(STEP[live.status] ? STEP[live.status].t : "On its way") + '</b>' +
            '<small>Order ' + esc(live.id) + ' \u00b7 tap to follow it</small></div>' +
            '<span class="lgo">\u203A</span>' +
          '</a>'
        : '') +

      /* The one button. Everything else on this screen is smaller
         than it on purpose. */
      '<button class="hero" id="ldCall">' +
        '<b>Order food</b>' +
        '<small>Give us your number \u2014 we call you straight back</small>' +
      '</button>' +

      (last
        ? '<button class="landagain" id="ldAgain">' +
            '\u21BA Same as last time \u00b7 ' +
            esc((last.lines || []).map(function(l){ return l.q + "\u00d7 " + l.name; })
                  .join(", ")) +
          '</button>'
        : '') +

      '<div class="catwrap">' +
        '<div class="catcap">Or choose it yourself</div>' +
        '<div class="catlist">' +
          cats.map(function(c){
            return '<button class="catrow" data-cat="' + esc(c.id) + '">' +
              '<span class="catn">' + esc(c.name) + '</span>' +
              '<span class="catc">' + (c.items || []).length + '</span>' +
              '<span class="catgo">\u203A</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</div>' +

      '<div class="landfoot">' +
        (shop ? callBtn(shop, "Call the restaurant", "landlink") : '') +
        (mine.length ? '<a class="landlink" href="#/orders">Your orders</a>' : '') +
        installLink() +
      '</div>' +

      installBar() +
    '</div>';

  /* index.html owns the menu, and it only draws once this screen
     has stood aside. The flag is what stops it drawing over us
     again on the next repaint. */
  var browse = function(hash){
    REPAINT = null;
    location.hash = hash || "#/";
    try{ window.dispatchEvent(new HashChangeEvent("hashchange")); }catch(e){
      try{ window.dispatchEvent(new Event("hashchange")); }catch(err){}
    }
  };

  el("ldCall").onclick = function(){ location.hash = "#/quick"; };

  main.querySelectorAll("[data-cat]").forEach(function(b){
    b.onclick = function(){ browse("#/c/" + b.dataset.cat); };
  });

  var ag = el("ldAgain");
  if(ag) ag.onclick = function(){
    CART = (last.lines || []).map(function(l){
      return { k: l.id + "|" + (l.label || ""), id: l.id, name: l.name,
               label: l.label || "", price: l.price, q: l.q };
    });
    saveCart(); paintFab();
    shopToast("Same as last time \u2014 check it and send.");
    location.hash = "#/cart";
  };

  wireInstall(function(){ viewLanding(main); });
  wireInstallLink(function(){ viewLanding(main); });
}

function viewQuick(main){
  var form = knownMe();
  var here = (form.lat != null && form.lng != null)
    ? { lat: form.lat, lng: form.lng } : null;

  /* Sharing a location redraws this form, and a redraw that reads
     from anywhere but the boxes themselves throws away whatever
     was typed before it. Read first, then draw. */
  var grab = function(){
    ["qName","qPhone","qAddr","qNote"].forEach(function(id){
      var n = el(id);
      if(n) form[id.slice(1).toLowerCase()] = n.value;
    });
  };

  var draw = function(){
    var saved = form;
    main.innerHTML = shell("Order food",
      '<p class="revsub">Your number is all we need. We will call you ' +
      'straight back and take it from there.</p>' +

      '<input class="fld big" id="qPhone" name="tel" type="tel" autocomplete="tel" ' +
        'inputmode="tel" placeholder="Phone number" value="' + esc(saved.phone || "") + '">' +

      '<p class="opt">The rest is optional \u2014 it just saves time on the call.</p>' +

      '<input class="fld" id="qName" name="name" autocomplete="name" ' +
        'placeholder="Your name (optional)" value="' + esc(saved.name || "") + '">' +
      '<textarea class="fld" id="qAddr" name="street-address" autocomplete="street-address" ' +
        'placeholder="Address (optional)">' + esc(saved.addr || "") + '</textarea>' +

      /* If they will not type an address, their phone knows where
         they are, and that is better than a description anyway. */
      '<button class="spotcard' + (here ? " set" : "") + '" id="qHere">' +
        '<span class="spi">\uD83D\uDCCD</span>' +
        '<span class="spt"><b>' +
          (here ? "Location shared" : "Share my location instead") + '</b>' +
          '<small>' + (here
            ? here.lat.toFixed(5) + ", " + here.lng.toFixed(5) + " \u00b7 the rider will find you"
            : "Quicker than typing, and the rider follows it exactly") +
          '</small></span>' +
        '<span class="spgo">' + (here ? "Change" : "Share") + '</span>' +
      '</button>' +

      '<input class="fld" id="qNote" placeholder="Anything to tell the kitchen? (optional)" ' +
        'value="' + esc(saved.note || "") + '">' +

      '<button class="shopbtn" id="qGo">Ask us to call</button>' +
      '<p class="opt tiny">We only ever use it for this order.</p>' +
      '<button class="shopbtn ghost" data-go="#/">Browse the menu instead</button>');

    el("qHere").onclick = function(){
      grab();
      var b = el("qHere");
      b.querySelector(".spgo").textContent = "\u2026";
      askGps().then(function(pos){
        if(!pos || !pos.coords){
          shopToast("Could not get your location \u2014 type the address instead.");
          draw(); return;
        }
        here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        draw();
        shopToast("Got it \u2014 that is enough for the rider.");
      });
    };

    el("qGo").onclick = function(){
      var name  = el("qName").value.trim(),
          phone = el("qPhone").value.trim(),
          addr  = el("qAddr").value.trim(),
          note  = el("qNote").value.trim();

      /* A number is the whole requirement. Everything else can be
         settled on the call, which is the point of a ticket -
         asking for more before we have even spoken is how you
         lose somebody who is hungry and in a hurry. */
      if(!digitsOnly(phone)){
        shopToast("Just your number, and we will call you.");
        el("qPhone").focus();
        return;
      }

      var o = {
        kind:  "ticket",
        name:  name,
        phone: phone,
        addr:  addr || (here ? "Shared their location" : "\u2014 ask on the call"),
        note:  note,
        lines: [],
        total: 0,
        source: "ticket"
      };
      if(here){ o.lat = +here.lat.toFixed(6); o.lng = +here.lng.toFixed(6); }

      var id = STORE.place(o);
      if(!id){ shopToast("Something went wrong. Please call us."); return; }

      try{ localStorage.setItem("hayat_me", JSON.stringify(
        { name:name, phone:phone, addr:addr, lat:here && here.lat, lng:here && here.lng })); }catch(e){}

      location.hash = "#/o/" + id;
    };
  };

  draw();
}

/* ------------------------------------------------------------
   CHECKOUT

   Two different people arrive here. Somebody ordering for the
   first time has to be asked where they live. Somebody ordering
   for the fourth time has already told us, twice, and asking
   again is just a form standing between them and dinner.

   So the second kind sees what we already know, one line, with a
   way to change it, and one button. No sign-in offer - a phone
   number is enough to order and always was, and the Google popup
   was rendering as a black rectangle anyway; it lives on the
   "find my old orders on a new phone" screen, which is the only
   place it earns its keep.
   ------------------------------------------------------------ */
function viewCheckout(main){
  if(!CART.length){ location.hash = "#/"; return; }
  var saved = knownMe();

  /* Known means we could send a rider right now without asking
     anything. A pin counts instead of an address - it is better
     than an address. */
  var known = !!(digitsOnly(saved.phone) && ((saved.addr || "").trim() ||
                 (saved.lat != null && saved.lng != null)));

  if(known && !CO_EDIT) return drawKnown();
  return drawForm();

  /* ---- the repeat order: everything we know, and Place ------ */
  function drawKnown(){
    if(saved.lat != null && saved.lng != null && !PIN){
      PIN = { lat: saved.lat, lng: saved.lng };
    }
    var where = (saved.addr || "").trim() ||
                (PIN ? "The spot you pinned last time" : "");

    main.innerHTML = shell("Send it",
      '<div class="cosum">' +
        '<span>' + cartCount() + ' item(s)</span>' +
        '<b>' + rupee(cartTotal()) + '</b>' +
      '</div>' +

      '<div class="coto">' +
        '<div class="cotol">Deliver to</div>' +
        '<div class="cotow">' + esc(where) + '</div>' +
        (saved.name ? '<div class="coton">' + esc(saved.name) + ' \u00b7 ' +
                      esc(prettyPhone(saved.phone)) + '</div>'
                    : '<div class="coton">' + esc(prettyPhone(saved.phone)) + '</div>') +
        '<button class="linky cotoc" id="coChange">Change this</button>' +
      '</div>' +

      '<input class="fld" id="coNote" placeholder="Anything we should know? (optional)">' +
      '<button class="shopbtn big" id="coGo">' + (AMEND ? "Update the order" : "Place the order") + '</button>' +
      '<p class="shopnote">Pay on delivery. We will call if anything is unclear.</p>');

    el("coChange").onclick = function(){
      CO_EDIT = true;
      viewCheckout(main);
    };
    el("coGo").onclick = function(){
      send(saved.name || "", saved.phone, saved.addr || "");
    };
  }

  /* ---- the first order, or a correction -------------------- */
  function drawForm(){
    main.innerHTML = shell("Where is it going?",
      /* A browser will offer the number it already has, in one tap,
         but only if the field says what it is. name and autocomplete
         are what turn three fields into a single autofill. */
      '<input class="fld big" id="coPhone" name="tel" type="tel" autocomplete="tel" ' +
        'inputmode="tel" placeholder="Phone number" value="' + esc(saved.phone||"") + '">' +
      '<input class="fld" id="coName" name="name" autocomplete="name" ' +
        'placeholder="Your name (optional)" value="' + esc(saved.name||"") + '">' +
      '<textarea class="fld" id="coAddr" name="street-address" autocomplete="street-address" ' +
        'placeholder="Address \u2014 house, landmark, area">' + esc(saved.addr||"") + '</textarea>' +

      /* A card, not a map. Tapping opens a picker that fills the
         screen, where dragging actually works. */
      '<button class="spotcard' + (PIN ? " set" : "") + '" id="coSpot">' +
        '<span class="spi">\uD83D\uDCCD</span>' +
        '<span class="spt"><b id="coSpotT">' +
          (PIN ? "Your spot is set" : "Show us where to bring it") + '</b>' +
          '<small id="coSpotS">' +
          (PIN ? PIN.lat.toFixed(5) + ", " + PIN.lng.toFixed(5)
               : "The rider follows this, not the address.") +
          '</small></span>' +
        '<span class="spgo">' + (PIN ? "Change" : "Set on map") + '</span>' +
      '</button>' +

      '<input class="fld" id="coNote"  placeholder="Anything we should know? (optional)">' +
      '<div class="total"><span>' + cartCount() + ' item(s)</span><b>' +
        rupee(cartTotal()) + '</b></div>' +
      '<button class="shopbtn big" id="coGo">Place the order</button>' +
      '<p class="shopnote">Pay on delivery. We will call if anything is unclear.</p>');

    mountMap(saved);

    el("coGo").onclick = function(){
      var name  = el("coName").value.trim(),
          phone = el("coPhone").value.trim(),
          addr  = el("coAddr").value.trim();
      /* The number is the whole account. Everything else can be
         sorted out on the phone, but without a number nobody can
         be called back. */
      if(!digitsOnly(phone)){ shopToast("We need a phone number."); return; }
      if(!addr && !PIN){ shopToast("An address or a pin on the map, please."); return; }
      send(name, phone, addr);
    };
  }

  /* ---- one way out, used by both --------------------------- */
  function send(name, phone, addr){
    if(!CART.length){
      shopToast("Your cart is empty.");
      location.hash = "#/cart";
      return;
    }
    /* Changing an order that is in: the same order is rewritten,
       so the board shows one card, not two. If the kitchen said
       yes while they were choosing, the door has shut, and the
       change becomes a phone call rather than a silent surprise. */
    if(AMEND){
      var was = STORE.order(AMEND);
      if(!was){ setAmend(null); }
      else if(was.status !== "placed"){
        setAmend(null);
        CART = []; saveCart(); paintFab();
        shopToast("That order has already been accepted \u2014 please call us to change it.");
        location.hash = "#/o/" + was.id;
        return;
      } else {
        var note2 = el("coNote");
        STORE.edit(was.id, {
          lines: CART.slice(), total: cartTotal(),
          note: (note2 && note2.value.trim()) || was.note || "",
          changedAt: Date.now(), changedBy: "customer"
        });
        var id2 = was.id;
        setAmend(null);
        CART = []; saveCart(); paintFab(); CO_EDIT = false;
        shopToast("Order updated.");
        location.hash = "#/o/" + id2;
        return;
      }
    }
    try{ localStorage.setItem("hayat_me", JSON.stringify(
      { name:name, phone:phone, addr:addr,
        lat:PIN&&PIN.lat, lng:PIN&&PIN.lng })); }catch(e){}

    var note = el("coNote");
    var o = {
      name:name, phone:phone, addr:addr,
      note: note ? note.value.trim() : "",
      lines: CART.slice(),
      total: cartTotal()
    };
    if(PIN){ o.lat = +PIN.lat.toFixed(6); o.lng = +PIN.lng.toFixed(6); }
    var id = STORE.place(o);
    if(!id){ shopToast("Something went wrong. Nothing was ordered."); return; }
    CART = []; saveCart();
    CO_EDIT = false;
    location.hash = "#/o/" + id;
  }
}

/* set while they are correcting a remembered address, so the
   short screen does not immediately draw over the long one */
var CO_EDIT = false;

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

/* ------------------------------------------------------------
   PICKING A SPOT ON A MAP

   The inline picker fought itself. Every map on a scrolling page
   is taught to ignore one finger, so the page can still scroll -
   but on a picker, dragging IS the whole point, and the thing
   would not move.

   A map that fills the screen has no such conflict: there is
   nothing behind it to scroll. So the picker opens as a sheet,
   takes every gesture, and hands back one point.
   ------------------------------------------------------------ */
var PICK = null;

function openPinPicker(start, onPick){
  closePinPicker();

  var wrap = document.createElement("div");
  wrap.className = "picker";
  wrap.innerHTML =
    '<div class="pkmap" id="pkMap"></div>' +
    '<div class="pkcross" aria-hidden="true"><span></span></div>' +
    '<div class="pkbar">' +
      '<button class="pkx" id="pkX" aria-label="Close">\u00d7</button>' +
      '<div class="pkt" id="pkTxt">Move the map so the pin sits on your door</div>' +
      '<button class="pkme" id="pkMe" title="Use my location">\u25CE</button>' +
    '</div>' +
    '<div class="pkfoot">' +
      '<button class="shopbtn" id="pkGo">Confirm this spot</button>' +
    '</div>';
  document.body.appendChild(wrap);
  document.body.classList.add("pkopen");
  PICK = wrap;

  var at = (start && start.lat) ? start : HOME;
  var here = { lat: at.lat, lng: at.lng };

  el("pkX").onclick = closePinPicker;
  el("pkGo").onclick = function(){
    closePinPicker();
    onPick(here);
  };

  loadLeaflet().then(function(){
    var LF = window.L;
    var box = el("pkMap");
    var map = LF.map(box, { zoomControl:false, attributionControl:true })
                .setView([at.lat, at.lng], start && start.lat ? 18 : 16);
    LF.control.zoom({ position:"bottomleft" }).addTo(map);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:19, attribution:"&copy; OpenStreetMap" }).addTo(map);

    /* Full screen: every gesture is the map's. No taming here -
       that is what broke it. */
    map.on("move", function(){ here = map.getCenter(); });
    map.on("moveend", function(){
      here = map.getCenter();
      var t = el("pkTxt");
      if(t) t.textContent = here.lat.toFixed(5) + ", " + here.lng.toFixed(5);
    });

    var me = el("pkMe");
    if(me) me.onclick = function(){
      if(!navigator.geolocation) return;
      me.classList.add("busy");
      navigator.geolocation.getCurrentPosition(function(pos){
        me.classList.remove("busy");
        map.setView([pos.coords.latitude, pos.coords.longitude], 18);
      }, function(){
        me.classList.remove("busy");
        shopToast("Could not get your location.");
      }, { enableHighAccuracy:true, timeout:12000 });
    };

    setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 60);
  }).catch(function(){
    var t = el("pkTxt");
    if(t) t.textContent = "The map is not loading. Close this and use the address.";
  });
}

function closePinPicker(){
  if(!PICK) return;
  try{ PICK.remove(); }catch(e){}
  PICK = null;
  document.body.classList.remove("pkopen");
}

/* The checkout no longer carries a map of its own - it carries a
   card that opens the full-screen picker, where a single finger
   moves the map because nothing else on screen wants that gesture. */
function mountMap(saved){
  PIN = (saved && saved.lat && saved.lng) ? { lat:saved.lat, lng:saved.lng } : null;

  var card = el("coSpot");
  if(!card) return;

  card.onclick = function(){
    openPinPicker(PIN, function(spot){
      PIN = { lat: spot.lat, lng: spot.lng };
      card.classList.add("set");
      var t = el("coSpotT"), sm = el("coSpotS");
      if(t) t.textContent = "Your spot is set";
      if(sm) sm.textContent = PIN.lat.toFixed(5) + ", " + PIN.lng.toFixed(5);
      var go = card.querySelector(".spgo");
      if(go) go.textContent = "Change";
      shopToast("Thank you \u2014 the rider will find you.");
    });
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
            if(!o.lat) return "Updated " + staleness(o.rAt).txt;
            var R = 6371, rad = Math.PI/180;
            var dLat = (o.rLat - o.lat) * rad, dLng = (o.rLng - o.lng) * rad;
            var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                    Math.cos(o.lat*rad)*Math.cos(o.rLat*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);
            var km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var f = staleness(o.rAt);
            var where = (km < 0.2 ? "Almost at your door"
                       : km < 1   ? Math.round(km*1000) + " m away"
                                  : km.toFixed(1) + " km away");
            /* do not claim a distance from a fix that has gone cold */
            if(f.state !== "live") return "Last seen " + f.txt;
            return where + " \u00b7 " + f.txt;
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
    (o.kind === "ticket" && !(o.lines || []).length
      ? '<div class="ticket"><b>\u260E We are calling you back</b>' +
        '<small>Tell us what you would like and it will appear here, ' +
        'so you can check it without having to remember the call.</small></div>'
      : '') +
    (isLater(o)
      ? '<div class="sched"><b>\u23F1 Coming ' + esc(whenWanted(o)) + '</b>' +
        '<small>We will start it in good time.</small></div>'
      : '') +
    installBar() +
    payBlock(o, "customer") +
    noteThread(o, "Anything we should know? Gate code, landmark\u2026") +
    (o.status === "placed" && (o.lines || []).length
      ? '<button class="shopbtn ghost" id="obChange">Change this order</button>'
      : '') +
    (canCancel
      ? '<button class="shopbtn ghost danger" id="obCancel">Cancel this order</button>'
      : '<p class="shopnote">To change anything now, please call us.</p>') +
    '<button class="shopbtn ghost" data-go="#/">Back to the menu</button>');

  var ch = el("obChange");
  if(ch) ch.onclick = function(){
    CART = (o.lines || []).map(function(l){
      return { k: l.id + "|" + (l.label || ""), id: l.id, name: l.name,
               label: l.label || "", price: l.price, q: l.q };
    });
    saveCart(); setAmend(o.id); paintFab();
    location.hash = "#/cart";
  };

  wireNotes(main, id, function(){ viewOrder(main, id); });
  wireInstall(function(){ viewOrder(main, id); });

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

/* How long ago a position was sent, and whether it can still be
   believed.

   A web page loses its GPS when the phone sleeps, so the dot on
   the office map stops moving while the rider keeps riding. A
   frozen dot that looks live is worse than no dot: the shop
   tells a customer "two minutes away" from a fix taken twenty
   minutes ago. So anything older than a minute says so. */
var FRESH_MS = 60000;

function staleness(at){
  if(!at) return { state:"none", txt:"no position yet" };
  var age = Date.now() - at;
  if(age < FRESH_MS)   return { state:"live",  txt:"just now" };
  if(age < 5 * 60000)  return { state:"stale", txt:Math.round(age/60000) + " min ago" };
  if(age < 60 * 60000) return { state:"cold",  txt:Math.round(age/60000) + " min ago" };
  return { state:"cold", txt:when(at) };
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
    /* back to the standard picture: the shop and its three km */
    try{ frameMap(map, []); }catch(e){
      try{ map.setView([HOME.lat, HOME.lng], HOMEZOOM); }catch(err){}
    }
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
/* A rider's real state, from what they said and what their
   phone has actually been doing. "Available" a week ago with no
   position since is not available. */
function riderState(r){
  if(!r) return { k:"gone", t:"unknown" };
  if(!r.uid && !r.claimedAt) return { k:"gone", t:"not signed in" };
  if(r.avail === false)      return { k:"off",  t:"off duty" };

  var carrying = STORE.orders().filter(function(o){
    return o.riderId === r.id &&
           (o.status === "assigned" || o.status === "on_way");
  });
  if(carrying.length){
    var newest = carrying.reduce(function(a,o){
      return (o.rAt || 0) > (a.rAt || 0) ? o : a;
    }, carrying[0]);
    var f = staleness(newest.rAt);
    return { k: f.state === "live" ? "busy" : "quiet",
             t: carrying.length + (carrying.length > 1 ? " deliveries" : " delivery") +
                " · " + f.txt,
             lat: newest.rLat, lng: newest.rLng, at: newest.rAt,
             jobs: carrying };
  }
  return { k:"free", t: r.avail ? "free" : "free · not marked available",
           jobs: [] };
}

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
      if(el("pw").value.trim() === PASSCODE()){
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
    /* No crew set up yet? Fall back to the code rather than
       locking the office out of its own board. A staff door that
       can refuse everybody is worse than a weak one. */
    if(!people.length){
      el("crewWrap").innerHTML =
        '<input class="fld" id="pw" type="password" inputmode="numeric" ' +
          'autocomplete="off" placeholder="Admin code">' +
        '<button class="shopbtn" id="pwGo">Unlock</button>' +
        '<p class="shopnote">No staff list yet, so this is the shared code. ' +
        'Firebase console \u2192 Firestore \u2192 <b>crew</b> to give ' +
        'each person their own.</p>';
      var un = function(){
        if(el("pw").value.trim() === PASSCODE()){
          try{ sessionStorage.setItem("hayat_admin","1"); }catch(e){}
          then();
        } else shopToast("Wrong code.");
      };
      el("pwGo").onclick = un;
      onEnter(el("pw"), un);
      el("pw").focus();
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

/* Somebody on a new phone asking for their own orders back.
   The office decides: recognise them and approve, or WhatsApp a
   code for them to read back. One tap either way - a wa.me link
   fills the message in, it can never send it by itself. */
function seenBar(){
  var q = STORE.waiting();
  if(!q.length) return "";
  return '<div class="seenbar">' + q.map(function(v){
    var c = STORE.customer(v.id);
    return '<div class="seenrow">' +
      '<div class="st"><b>' + esc(c && c.name ? c.name : prettyPhone(v.phone)) + '</b>' +
        '<small>wants their past orders on a new phone' +
        (c ? " \u00b7 " + custOrders(v.id).length + " on file" : " \u00b7 not in the book") +
        (v.code ? " \u00b7 code " + esc(v.code) + " sent" : "") + '</small></div>' +
      (v.code
        ? '<a class="linky" target="_blank" rel="noopener" href="' +
          esc(wa(v.phone, "Hayat \u2014 your code is " + v.code +
               "\n\nType it into the app to see your past orders.")) +
          '">Send again</a>'
        : '<button class="linky" data-sendcode="' + esc(v.id) + '">WhatsApp a code</button>') +
      '<button class="linky go" data-approve="' + esc(v.id) + '">Approve</button>' +
      '<button class="linky warn" data-refuse="' + esc(v.id) + '">No</button>' +
    '</div>';
  }).join("") + '</div>';
}

function wireSeen(main){
  main.querySelectorAll("[data-sendcode]").forEach(function(b){
    b.onclick = function(){
      var id = b.dataset.sendcode;
      var code = STORE.issueCode(id);
      var v = STORE.verifyRow(id);
      if(!code || !v) return;
      window.open(wa(v.phone, "Hayat \u2014 your code is " + code +
        "\n\nType it into the app to see your past orders."), "_blank");
      shopToast("Code " + code + " \u2014 tap send in WhatsApp.");
    };
  });
  main.querySelectorAll("[data-approve]").forEach(function(b){
    b.onclick = function(){
      var n = STORE.approveSight(b.dataset.approve);
      shopToast(n ? ("Approved \u2014 " + n + " order" + (n>1?"s":"") + " linked.")
                  : "Approved.");
    };
  });
  main.querySelectorAll("[data-refuse]").forEach(function(b){
    b.onclick = function(){ STORE.dropSight(b.dataset.refuse); shopToast("Dismissed."); };
  });
}

/* ------------------------------------------------------------
   THE BUSINESS DAY

   The shop opens at eleven and closes at one in the morning, so
   "today" on the board is not midnight to midnight - an order
   delivered at half past midnight belongs to the evening that
   is still going. The day starts at opening time; before that,
   we are still in yesterday's.
   ------------------------------------------------------------ */
function shiftStart(){
  var h = ((C().hours || {}).open || "11:00").split(":");
  var d = new Date();
  d.setHours(+h[0] || 11, +h[1] || 0, 0, 0);
  if(Date.now() < d.getTime()) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/* Delivered and settled, and from a day that is over: off the
   board. It is still in the book and the list; the board is for
   what is happening, not what happened. Unpaid stays until it is
   paid, because unpaid is still happening. */
function onBoard(o){
  if(o.status === "cancelled") return false;
  if(o.status !== "delivered") return true;
  if(!o.paid) return true;
  var when = (o.log || []).filter(function(l){ return l.s === "delivered"; }).pop();
  var t = when ? when.at : o.at;
  return t >= shiftStart();
}

/* what the day has done so far */
function takings(orders){
  var since = shiftStart();
  var t = { n:0, sum:0, paid:0, open:0, openSum:0 };
  orders.forEach(function(o){
    if(o.status === "cancelled") return;
    if(o.status !== "delivered" && o.status !== "cancelled"){ t.open++; t.openSum += (o.total || 0); }
    if(o.at < since && o.status !== "delivered") return;
    var when = (o.log || []).filter(function(l){ return l.s === "delivered"; }).pop();
    var at = when ? when.at : o.at;
    if(at < since) return;
    t.n++; t.sum += (o.total || 0);
    if(o.paid) t.paid += (o.total || 0);
  });
  return t;
}

function paintAdmin(main){
  learnDoorsteps();
  checkCodes();
  var orders = STORE.orders(), riders = STORE.riders();
  var gone   = orders.filter(function(o){ return o.status === "cancelled"; });
  var live   = orders.filter(function(o){ return o.status !== "delivered" && o.status !== "cancelled"; });
  var done   = orders.filter(function(o){ return o.status === "delivered"; });
  var pinned = orders.filter(function(o){ return o.lat && o.lng && o.status !== "cancelled"; });
  var tk     = takings(orders);
  var shown  = mapMatches(orders);
  var blind  = mapBlind(orders);

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
          '<span class="pill money" title="Delivered since opening today">' +
            'Today <b>' + rupee(tk.sum) + '</b><small>' + tk.n + (tk.n === 1 ? ' order' : ' orders') +
            (tk.sum > tk.paid ? ' \u00b7 ' + rupee(tk.sum - tk.paid) + ' to collect' : '') + '</small></span>' +
          '<span class="pill">' + live.length + ' live' +
            (live.length ? '<small>' + rupee(tk.openSum) + '</small>' : '') + '</span>' +
          (gone.length ? '<span class="pill gone" title="Cancelled">' + gone.length + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="conbody' + (ADVIEW === "map" ? " nomargin" : "") + '">' +
        (ADVIEW === "map"
          ? '<div id="admap" class="admap"></div>' +
            mapFilterBar(shown, blind) +
            (orders.length
              ? ''
              : '<p class="shopsub floatnote">No orders yet.</p>')

          : ADVIEW === "board"
          ? (orders.length ? boardHtml(orders.filter(onBoard))
                           : '<p class="shopsub">No orders yet.</p>')

          : '<div class="conscroll">' +
            (orders.length ? orders.map(orderCard).join("")
                           : '<p class="shopsub">No orders yet.</p>') + '</div>') +
      '</div>' +

      /* the two things you reach for, always in the same corner */
      /* No way out to the customer's menu. This is a till, and a
         till does not have a browse button on it. */
      '<div class="condock">' +
        '<button class="dockbtn wide" data-go="#/admin/call" title="Take an order by phone">' +
          '\u260E<span class="dlab">Phone order</span></button>' +
        '<button class="dockbtn" data-go="#/admin/who" title="Customers">\uD83D\uDC64</button>' +
        '<button class="dockbtn" data-go="#/admin/riders" title="Riders">' +
          '\uD83C\uDFCD<span class="dockn">' + riders.length + '</span></button>' +
      '</div>' +

      /* Out of the flow entirely. It used to sit in the column
         above the board and landed on the first column head. It
         is a status line: it belongs in a corner, not in the way. */
      connBanner() +
      seenBar() +
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

  if(ADVIEW === "map") drawAdminMap(shown, blind);
  pinned.forEach(measureRoad);
  /* a rider's dot only has to be chased while a ride is under way,
     and only while the office is actually looking at one */
  liveWatch(ADVIEW === "map" && shown.concat(blind).some(function(o){
    return o.status === "assigned" || o.status === "on_way";
  }), main);

  wireSeen(main);

  /* the filters */
  main.querySelectorAll("[data-mf]").forEach(function(b){
    b.onclick = function(){
      var k = b.dataset.mf;
      MFILT.on[k] = !MFILT.on[k];
      saveFilter();
      AVIEW = null;              /* a new question deserves a fresh view */
      paintAdmin(main);
    };
  });
  var hb = el("mfHeat");
  if(hb) hb.onclick = function(){
    HEAT = !HEAT;
    try{ localStorage.setItem("hayat_mapheat", HEAT ? "1" : "0"); }catch(e){}
    AVIEW = null;
    paintAdmin(main);
  };

  main.querySelectorAll("[data-mr]").forEach(function(b){
    b.onclick = function(){
      MFILT.range = b.dataset.mr;
      saveFilter();
      AVIEW = null;
      paintAdmin(main);
    };
  });
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
    var col = orders.filter(function(o){ return o.status === st; })
                    .sort(function(a,b){ return wantedAt(a) - wantedAt(b); });
    /* the head stays put, the cards under it scroll on their own,
       so a busy column never pushes the others off the screen */
    var money = col.reduce(function(n,o){ return n + (o.total || 0); }, 0);
    return '<div class="col">' +
      '<div class="colhead"><b>' + esc(STEP[st].t) + '</b>' +
        (col.length ? '<span class="colsum">' + rupee(money) + '</span>' : '') +
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

  var empty  = !(o.lines || []).length;
  var ticket = (o.kind === "ticket") && empty;

  var act = "";
  if(ticket){
    /* This is not a broken order. It is somebody asking to be
       rung back, and the only useful next move is to ring them. */
    act = '<div class="tkact">' +
      callBtn(o.phone, "Call them", "mini go") +
      '<a class="mini" href="#/admin/o/' + esc(o.id) + '">Write it down</a>' +
    '</div>';
  } else if(empty){
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
     to agree. That is the same WhatsApp button, carrying a
     different sentence; it is not a second row of the same three
     buttons, which is what the card used to show. */
  var waText = (o.status === "placed") ? msgAsk(o)
             : (o.status === "accepted") ? msgAccepted(o)
             : msgOnWay(o);

  return '<div class="bcard' + (ticket ? " ticket" : empty ? " empty" : "") +
      (isLater(o) ? " later" : "") + '">' +
    (ticket ? '<div class="tkflag">\u260E Wants a call \u00b7 nothing written down yet</div>' : '') +
    '<div class="brow"><b>' + esc(o.id) + '</b>' +
      (isLater(o)
        ? '<span class="latertag">\u23F1 ' + esc(whenWanted(o)) + '</span>'
        : '<span class="btime">' + when(o.at) + '</span>') + '</div>' +
    '<div class="bname">' + esc(o.name || prettyPhone(o.phone)) + '</div>' +
    /* What is IN the order is what the kitchen and the rider talk
       about; the whole address is noise on a board. One line of
       items on the card, and the full address plus every line in
       the tooltip for anybody who hovers or presses and holds. */
    (empty ? '' : '<div class="bitems" title="' + esc(orderLine(o)) + '">' + esc(orderLine(o)) + '</div>') +
    '<div class="baddr" title="' + esc(o.addr || "") + '">' + esc(shortAddr(o.addr)) + '</div>' +
    (distLabel(o) ? '<div class="bdist">' + esc(distLabel(o)) + ' away</div>' : '') +
    '<div class="brow"><span class="btot">' + rupee(o.total) + '</span>' +
      payTag(o) +
      (discountLabel(o) ? '<span class="offtag">' + esc(discountLabel(o)) + '</span>' : '') +
      (rider ? '<span class="rname">' + esc(rider.name) + '</span>' : '') + '</div>' +
    /* The contact row is four small words, not four buttons. The
       one button on a card is the thing that moves the order on;
       everything else is there when you need it and quiet when
       you do not. */
    '<div class="quick">' +
      '<a class="qbtn wa" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, waText)) +
        '" title="Message the customer">WhatsApp</a>' +
      callBtn(o.phone, "Call", "qbtn") +
      (o.lat ? '<a class="qbtn gm" target="_blank" rel="noopener" href="' + esc(mapsFromShop(o)) +
        '" title="Route from the shop">Maps</a>' : '') +
      '<a class="qbtn ed" href="#/admin/o/' + esc(o.id) + '" title="Edit or cancel">Edit' +
        noteTag(o) + '</a>' +
    '</div>' +
    act +
    /* Decline lives under Accept, small, and asks why - the reason
       is what the customer is told, so it has to be a real one. It
       is never the first thing on the card. */
    (o.status === "placed" && !ticket
      ? '<button class="declink" data-decline="' + esc(o.id) + '">Decline\u2026</button>'
      : '') +
    '</div>';
}

/* ------------------------------------------------------------
   SAYING NO PROPERLY

   Zomato's merchant app found that asking for a reason cut
   rejections and support calls: the customer hears something
   true instead of nothing. Each reason here writes the message
   the customer gets, and one of them - out of stock - is worth
   the office knowing about tomorrow too.
   ------------------------------------------------------------ */
var DECLINE_WHY = [
  { k:"stock",  t:"Something is out of stock",
    msg:"Sorry \u2014 one of the items you ordered has run out tonight. Call us and we will sort out something else." },
  { k:"far",    t:"Too far to deliver",
    msg:"Sorry \u2014 that address is outside where we can deliver tonight." },
  { k:"busy",   t:"Kitchen is full right now",
    msg:"Sorry \u2014 the kitchen is full right now and we cannot take this in time. Please try again in a while." },
  { k:"closed", t:"We are closed",
    msg:"Sorry \u2014 we are closed at the moment. We open at 11 am." },
  { k:"reach",  t:"Cannot reach the customer",
    msg:"We tried to call about your order and could not reach you. Call us when you are free and we will make it." }
];

function declineSheet(id){
  var o = STORE.order(id);
  if(!o) return;
  var old = el("declSheet"); if(old) old.remove();
  var box = document.createElement("div");
  box.className = "sheetwrap"; box.id = "declSheet";
  box.innerHTML =
    '<div class="sheet">' +
      '<div class="sheeth"><b>Decline ' + esc(o.id) + '</b>' +
        '<button class="linky" id="declX">Keep it</button></div>' +
      '<p class="sheetsub">Why? The customer is told this.</p>' +
      DECLINE_WHY.map(function(w){
        return '<button class="sheetopt" data-why="' + w.k + '">' + esc(w.t) + '</button>';
      }).join("") +
    '</div>';
  document.body.appendChild(box);
  el("declX").onclick = function(){ box.remove(); };
  box.onclick = function(e){ if(e.target === box) box.remove(); };
  box.querySelectorAll("[data-why]").forEach(function(b){
    b.onclick = function(){
      var w = DECLINE_WHY.filter(function(x){ return x.k === b.dataset.why; })[0];
      STORE.setStatus(id, "cancelled", { declined: w.k, declinedAt: Date.now() });
      box.remove();
      /* the customer hears why, in their WhatsApp, in one tap */
      try{ window.open(waCustomer(o, "Hayat \u2014 order " + o.id + "\n\n" + w.msg), "_blank", "noopener"); }catch(e){}
      shopToast("Declined \u2014 " + w.t.toLowerCase() + ".");
    };
  });
}

/* both views use the same buttons, so they are wired in one place */
function wireCards(main){
  main.querySelectorAll("[data-adv]").forEach(function(b){
    b.onclick = function(){
      var p = b.dataset.adv.split("|");
      STORE.setStatus(p[0], p[1]);
    };
  });
  main.querySelectorAll("[data-decline]").forEach(function(b){
    b.onclick = function(){ declineSheet(b.dataset.decline); };
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

/* The first landmark, not the whole essay. Makkaraparamba
   addresses are directions, and directions belong to the rider's
   screen, not a card that has to sit beside six others. */
function shortAddr(a){
  a = String(a || "").trim();
  if(!a) return "";
  var first = a.split(/[,\n]/)[0].trim();
  if(first.length > 44) first = first.slice(0, 42) + "\u2026";
  return first;
}

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

/* What the office read back to them on the phone, in writing.
   A call is easy to mishear; this is the same thing they can
   check afterwards. */
function msgTaken(o){
  var m = money(o);
  return "Hayat \u2014 order " + o.id + "\n\n" +
    "Thank you" + (o.name ? " " + o.name : "") + ". This is what we have:\n\n" +
    (o.lines || []).map(function(l){
      return "\u2022 " + l.q + " \u00d7 " + l.name +
             (l.label ? " (" + l.label + ")" : "") + "  " + rupee(l.q * l.price);
    }).join("\n") +
    (m.off ? "\n\nLess " + discountLabel(o) + ": \u2212" + rupee(m.off) : "") +
    "\n\nTotal " + rupee(m.total) + " (cash on delivery)" +
    "\nTo: " + (o.addr || "") +
    (o.wantAt ? "\nFor: " + whenWanted(o) : "") +
    "\n\nFollow it here: " + base() + "#/o/" + o.id;
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
  if(o.kind === "ticket" && empty)
    action = '<div class="tkact">' + callBtn(o.phone, "Call them", "shopbtn small") +
      '<a class="shopbtn small ghost" href="#/admin/o/' + esc(o.id) + '">Write it down</a></div>';
  else if(empty)
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
      (isLater(o) ? '<span class="latertag">\u23F1 ' + esc(whenWanted(o)) + '</span>' : '') +
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
/* ------------------------------------------------------------
   FRAMING A MAP

   The office wants the same picture every time it looks: the
   restaurant, and roughly three kilometres around it - which is
   most of what this kitchen delivers to. Anything further out
   pulls the frame with it rather than being left off the edge.

   Degrees of longitude shrink as you leave the equator, so the
   east-west half-width is divided by the cosine of the latitude
   or the box comes out visibly taller than it is wide.
   ------------------------------------------------------------ */
function homeRadiusKm(){
  var r = ((window.CONFIG || {}).shop || {}).radiusKm;
  return (typeof r === "number" && r > 0) ? r : 3;
}

function homeBox(km){
  var r = km || homeRadiusKm();
  var dLat = r / 111;
  var dLng = r / (111 * Math.max(0.2, Math.cos(HOME.lat * Math.PI / 180)));
  return { s: HOME.lat - dLat, n: HOME.lat + dLat,
           w: HOME.lng - dLng, e: HOME.lng + dLng };
}

/* pts is [[lat,lng], ...] - anything outside the default box
   stretches it, so a rider halfway to the next town is still on
   screen instead of just off it */
function frameMap(map, pts){
  var b = homeBox();
  (pts || []).forEach(function(p){
    if(!p || typeof p[0] !== "number" || typeof p[1] !== "number") return;
    if(p[0] < b.s) b.s = p[0];
    if(p[0] > b.n) b.n = p[0];
    if(p[1] < b.w) b.w = p[1];
    if(p[1] > b.e) b.e = p[1];
  });
  try{
    map.fitBounds([[b.s, b.w], [b.n, b.e]], { padding:[46,46], maxZoom:17 });
  }catch(e){
    try{ map.setView([HOME.lat, HOME.lng], 14); }catch(err){}
  }
}

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
  /* the ~ goes in front: "~1.3 km away" reads; "1.3 km ~ away" does not */
  return "\u2248 " + (km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km");
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

/* Waiting for a rider is the one state the office has to act on,
   so it gets a colour of its own and a ring that pulses. Every
   other pin is information; this one is a job. */
function statusColour(s){
  return s === "placed"    ? "#E4705A"
       : s === "accepted"  ? "#F2A33C"
       : s === "delivered" ? "#9A8A6C"
       : s === "on_way"    ? "#8FBE43"
                           : "#C9A24B";
}

function needsRider(o){
  return (o.status === "placed" || o.status === "accepted") && !o.riderId;
}

/* ------------------------------------------------------------
   READING THE MAP

   Live orders answer "where is dinner". Delivered ones answer a
   different and more useful question: where does our business
   actually come from. Same pins, different window on them.

   Both the statuses and the stretch of time are the office's to
   choose, and the choice is remembered, because whoever opens
   this in the morning wants the same view they left.
   ------------------------------------------------------------ */
var RANGES = [
  { k:"today",     t:"Today" },
  { k:"yesterday", t:"Yesterday" },
  { k:"week",      t:"7 days" },
  { k:"month",     t:"30 days" },
  { k:"all",       t:"All" }
];

var MFILT = (function(){
  var d = { on: { placed:true, accepted:true, assigned:true, on_way:true, delivered:false },
            range: "today" };
  try{
    var raw = JSON.parse(localStorage.getItem("hayat_mapfilter"));
    if(raw && raw.on) return raw;
  }catch(e){}
  return d;
})();

function saveFilter(){
  try{ localStorage.setItem("hayat_mapfilter", JSON.stringify(MFILT)); }catch(e){}
}

function dayStart(d){
  var x = new Date(d);
  x.setHours(0,0,0,0);
  return x.getTime();
}

function inRange(at, range){
  if(!at) return false;
  if(range === "all") return true;
  var today = dayStart(Date.now());
  if(range === "today")     return at >= today;
  if(range === "yesterday") return at >= today - 86400000 && at < today;
  if(range === "week")      return at >= today - 6 * 86400000;
  if(range === "month")     return at >= today - 29 * 86400000;
  return true;
}

/* ------------------------------------------------------------
   WANTED FOR LATER

   A lunch order taken at nine in the morning is not late; it is
   early. The board sorts by when it is wanted, not when it was
   typed, and an order the kitchen should not start yet says so
   instead of sitting at the top looking neglected.
   ------------------------------------------------------------ */
function wantedAt(o){ return o.wantAt || o.at; }

/* datetime-local speaks local time with no zone on the end */
function localStamp(ms){
  var d = new Date(ms);
  var p = function(n){ return String(n).padStart(2, "0"); };
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate()) +
         "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

function isLater(o){
  return !!(o.wantAt && o.wantAt > Date.now() + 60000);
}

function whenWanted(o){
  if(!o.wantAt) return "";
  var mins = Math.round((o.wantAt - Date.now()) / 60000);
  if(mins <= 0) return "due now";
  if(mins < 60) return "in " + mins + " min";
  var d = new Date(o.wantAt), today = new Date();
  var sameDay = d.toDateString() === today.toDateString();
  var t = when(o.wantAt);
  return sameDay ? "at " + t : d.getDate() + "/" + (d.getMonth()+1) + " " + t;
}

function mapPasses(o){
  if(o.status === "cancelled") return false;
  if(!MFILT.on[o.status]) return false;
  return inRange(o.at, MFILT.range);
}

function mapMatches(orders){
  return orders.filter(function(o){ return mapPasses(o) && o.lat && o.lng; });
}

/* orders the filters accept but that carry no pin - they exist,
   they simply cannot be drawn, and saying so is the whole point */
function mapBlind(orders){
  return orders.filter(function(o){ return mapPasses(o) && !(o.lat && o.lng); });
}

/* what the office is actually looking at, in one line */
function mapTally(list, blind){
  var money = list.reduce(function(n,o){ return n + (o.total || 0); }, 0);
  var label = (RANGES.filter(function(r){ return r.k === MFILT.range; })[0] || {}).t || "";
  var tail = blind
    ? " \u00b7 " + blind + " with no pin"
    : "";
  /* "Nothing matches" was a lie when the orders existed and simply
     had no pin on them. The office needs to know the difference:
     one means change the filter, the other means chase the pin. */
  if(!list.length)
    return blind
      ? blind + (blind === 1 ? " order" : " orders") +
        " \u00b7 none has a pin, so none can be drawn"
      : "Nothing matches \u00b7 " + label.toLowerCase();

  return list.length + (list.length === 1 ? " order" : " orders") +
    " \u00b7 " + rupee(money) + " \u00b7 " + label.toLowerCase() + tail;
}

function mapFilterBar(list, blind){
  var steps = [["placed","New"],["accepted","Kitchen"],["assigned","Rider"],
               ["on_way","On the way"],["delivered","Delivered"]];
  return '<div class="mapfilt">' +
    '<div class="mfrow chips">' +
      steps.map(function(p){
        return '<button class="mfchip s-' + p[0] + (MFILT.on[p[0]] ? " on" : "") +
          '" data-mf="' + p[0] + '" aria-pressed="' + (MFILT.on[p[0]] ? "true" : "false") + '">' +
          '<span class="mfdot" style="background:' + statusColour(p[0]) + '"></span>' +
          esc(p[1]) + '</button>';
      }).join("") +
    '</div>' +
    '<div class="mfrow times">' +
      RANGES.map(function(r){
        return '<button class="mftime' + (MFILT.range === r.k ? " on" : "") +
          '" data-mr="' + r.k + '">' + esc(r.t) + '</button>';
      }).join("") +
      '<span class="mfsep"></span>' +
      '<button class="mftime heat' + (HEAT ? " on" : "") + '" id="mfHeat" ' +
        'title="Group orders into neighbourhoods">' +
        (HEAT ? "Pins" : "Concentration") + '</button>' +
    '</div>' +
    '<div class="mftally' + ((blind && blind.length) ? " warn" : "") + '">' +
      esc(mapTally(list, (blind || []).length)) + '</div>' +
    (HEAT ? heatTop(list) : '') +
  '</div>';
}

/* ------------------------------------------------------------
   WHERE THE MONEY COMES FROM

   Two hundred pins tell you nothing. The same two hundred orders
   grouped into the streets they came from tell you where to put
   a leaflet, which road is worth a second rider, and which
   direction is quietly carrying the business.

   Squares of roughly 400 metres, because that is about a
   neighbourhood here. Each one sized by how many orders and
   shaded by what they were worth.
   ------------------------------------------------------------ */
var HEAT = false;
try{ HEAT = localStorage.getItem("hayat_mapheat") === "1"; }catch(e){}

function clusters(list){
  var CELL = 0.0036;          /* ~400m of latitude */
  var bins = {};
  list.forEach(function(o){
    if(!o.lat) return;
    var gy = Math.floor(o.lat / CELL), gx = Math.floor(o.lng / CELL);
    var k = gy + ":" + gx;
    var b = bins[k] || (bins[k] = { n:0, sum:0, lat:0, lng:0 });
    b.n++; b.sum += (o.total || 0);
    b.lat += o.lat; b.lng += o.lng;
  });
  var out = Object.keys(bins).map(function(k){
    var b = bins[k];
    return { n:b.n, sum:b.sum, lat:b.lat / b.n, lng:b.lng / b.n,
             avg: Math.round(b.sum / b.n) };
  });
  out.sort(function(a,b){ return b.sum - a.sum; });
  return out;
}

function heatColour(share){
  /* one hue, four steps: readable, and colour-blind safe */
  return share > 0.66 ? "#C0491F"
       : share > 0.40 ? "#E4705A"
       : share > 0.18 ? "#E8A33C"
                      : "#C9A24B";
}

function drawClusters(map, list){
  var LF = window.L;
  var cells = clusters(list);
  if(!cells.length) return;
  var top = cells[0].sum || 1;

  cells.forEach(function(c){
    var share = c.sum / top;
    var r = 16 + Math.sqrt(c.n) * 11;
    LF.circleMarker([c.lat, c.lng], {
      radius: Math.min(r, 62),
      color: "#fff", weight: 1.5, opacity: .85,
      fillColor: heatColour(share), fillOpacity: .45
    }).addTo(map).bindPopup(
      "<b>" + c.n + (c.n === 1 ? " order" : " orders") + "</b><br>" +
      rupee(c.sum) + " in total<br>" +
      rupee(c.avg) + " on average"
    );

    LF.marker([c.lat, c.lng], { icon: LF.divIcon({
      className: "heatlab",
      html: '<span>' + c.n + '</span><small>' + rupee(c.sum) + '</small>',
      iconSize:null, iconAnchor:[0,0] }) }).addTo(map);
  });
}

/* the three places worth knowing about, in words */
function heatTop(list){
  var cells = clusters(list).slice(0, 3);
  if(!cells.length) return "";
  var all = list.reduce(function(n,o){ return n + (o.total || 0); }, 0) || 1;
  return '<div class="heattop">' +
    cells.map(function(c, i){
      return '<span class="ht"><b>#' + (i+1) + '</b> ' + c.n +
        (c.n === 1 ? " order" : " orders") + ' \u00b7 ' + rupee(c.sum) +
        ' \u00b7 ' + Math.round(c.sum / all * 100) + '%</span>';
    }).join("") +
  '</div>';
}

function drawAdminMap(list, blind){
  var box = el("admap");
  if(!box) return;
  list = list || [];
  /* A rider carrying an order with no customer pin still has a
     position of their own, and the office still wants to see it.
     The order cannot be drawn; the rider can. */
  var riding = list.concat(blind || []);

  loadLeaflet().then(function(){
    try{ if(box._leaflet_id){ box._leaflet_id = null; box.innerHTML = ""; } }catch(e){}
    var LF = window.L;
    /* Always open on the restaurant. Whatever happened last time,
       wherever yesterday's orders were, the office looks at its
       own kitchen first and moves out from there. */
    /* Leaflet puts zoom top-left by default, which is exactly
       where the Board / List / Map tabs float. Moved out of
       their way rather than asking the office to aim. */
    AMAP = LF.map(box, { zoomControl:false })
             .setView([HOME.lat, HOME.lng], HOMEZOOM);   /* replaced by frameMap below */
    LF.control.zoom({ position:"topright" }).addTo(AMAP);
    tameMap(AMAP, box);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(AMAP);

    if(HEAT) drawClusters(AMAP, list);

    /* the restaurant, so the office can see how far each one is */
    LF.circleMarker([HOME.lat, HOME.lng], {
      radius:7, color:"#FFFFFF", weight:2, fillColor:"#1B2410", fillOpacity:1
    }).addTo(AMAP).bindPopup("Hayat \u2014 the kitchen");

    var pts = [[HOME.lat, HOME.lng]];

    /* a rider on the road, only while the ride is actually live */
    riding.filter(function(o){
      return o.rLat && (o.status === "assigned" || o.status === "on_way");
    }).forEach(function(o){
      var r = o.riderId ? STORE.rider(o.riderId) : null;
      var fresh = staleness(o.rAt);
      pts.push([o.rLat, o.rLng]);
      LF.marker([o.rLat, o.rLng], { zIndexOffset: 500, icon: LF.divIcon({
        className: "omark bike f-" + fresh.state,
        html: '<span class="bikedot">\uD83C\uDFCD</span>' +
              '<span class="tag">' + esc(r ? shortName(r.name) : "Rider") +
              ' \u00b7 ' + esc(o.id) + '</span>',
        iconSize: null, iconAnchor: [14, 14] }) })
        .addTo(AMAP).bindPopup(
          "<b>" + esc(r ? r.name : "Rider") + "</b><br>" +
          "carrying " + esc(o.id) + "<br>" +
          "last seen " + esc(fresh.txt) +
          (fresh.state === "live" ? "" : " \u2014 the phone may have slept") + "<br>" +
          '<a href="#/admin/o/' + esc(o.id) + '">Open the order</a>');
    });

    list.forEach(function(o){
      pts.push([o.lat, o.lng]);
      if(HEAT) return;          /* the clusters are the picture now */
      var wants = needsRider(o);

      /* Assigning from the pin, because the map is where you can
         see which rider is nearest to it. Walking back to the
         board to do the same thing is the long way round. */
      var free = STORE.riders().filter(function(r){
        return r.avail !== false && (r.uid || r.claimedAt);
      });
      var picker = "";
      if(wants){
        picker = free.length
          ? '<div class="mpick"><select class="fld sel mini" data-massign="' + esc(o.id) + '">' +
              '<option value="">Send a rider\u2026</option>' +
              free.map(function(r){
                var st = riderState(r);
                return '<option value="' + esc(r.id) + '">' + esc(r.name) +
                       ' \u00b7 ' + esc(st.t) + '</option>';
              }).join("") +
            '</select></div>'
          : '<div class="mpick"><a href="#/admin/riders">No rider is available</a></div>';
      }

      LF.marker([o.lat, o.lng], {
        zIndexOffset: wants ? 400 : 0,
        icon: LF.divIcon({
          className: "omark" + (wants ? " wants" : ""),
          html: '<span class="dot" style="background:' + statusColour(o.status) + '"></span>' +
                '<span class="tag">' + (wants ? '\u25CF ' : '') +
                esc(shortName(o.name)) + ' \u00b7 ' + rupee(o.total) + '</span>',
          iconSize: null, iconAnchor: [7, 7]
        })
      }).addTo(AMAP).bindPopup(
        "<b>" + esc(o.id) + "</b> \u00b7 " + esc(STEP[o.status].t) +
        (wants ? ' \u00b7 <b class="wantsr">no rider yet</b>' : "") + "<br>" +
        esc(o.name) + "<br>" + rupee(o.total) +
        (distLabel(o) ? " \u00b7 " + distLabel(o) + " away" : "") + "<br>" +
        picker +
        '<a href="#/admin/o/' + esc(o.id) + '"><b>Open the order</b></a><br>' +
        '<a href="' + esc(mapsFromShop(o)) + '" target="_blank" rel="noopener">Google Maps</a>' +
        ' &middot; ' +
        '<a href="' + esc(waCustomer(o, msgOnWay(o))) + '" target="_blank" rel="noopener">WhatsApp</a>'
      );
    });

    /* the kitchen sits in the middle: the office reads distance from it */
    /* Three kilometres round the shop, stretched to hold anyone
       further out. The office's view of its own patch, every time. */
    if(AVIEW) AMAP.setView(AVIEW.c, AVIEW.z);
    else frameMap(AMAP, pts);
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

/* Delivered orders carry a doorstep the rider's phone recorded.
   Only the office may write the customer book, so the office is
   what moves them across - quietly, whenever it looks at the
   board. Each order is promoted once and then marked. */
/* With Firestore live the rules do this comparison. Without it -
   one machine, demo mode - somebody has to, and the office is the
   only party allowed to see both halves. */
/* Somebody sitting at the office board IS the office, whether
   they signed in with a Firebase staff account or opened the
   door with the passcode. Only checking the signed-in role
   meant a passcode admin silently learned nothing: the customer
   book never filled and codes were never approved. */
function atTheDesk(){ return STORE.isOffice() || unlocked(); }

var CHECKING = false;

function checkCodes(){
  if(!atTheDesk() && STORE.live()) return;
  /* same trap as learnDoorsteps: approving redraws the board, and
     the redraw calls this again */
  if(CHECKING) return;
  CHECKING = true;
  try{
  STORE.waiting().forEach(function(v){
    if(v.code && v.codeTry && String(v.codeTry) === String(v.code)){
      STORE.approveSight(v.id);
    }
  });
  } finally { CHECKING = false; }
}

/* Writing to the book redraws the board, and redrawing the board
   runs this function. Marking the order only AFTER the write meant
   the redraw arrived while the order still looked unlearned, and it
   learned it again, for ever - Firestore gave up with "too much
   recursion". The flag goes down first, and this will not re-enter
   itself while it is still running. */
var LEARNING = false;

function learnDoorsteps(){
  if(!atTheDesk() && STORE.live()) return;
  if(LEARNING) return;
  LEARNING = true;
  try{
    STORE.orders().forEach(function(o){
      if(o.doorLearned) return;

      /* Everything the office has ever been told about this number,
         gathered under one record. An order placed from the website
         teaches us a name and an address; a delivered one teaches us
         the doorstep, which is worth more. */
      if(o.status === "delivered" && o.doorLat){
        STORE.edit(o.id, { doorLearned: true });
        STORE.rememberCustomer(o, {
          lat: o.doorLat, lng: o.doorLng,
          locFrom: "delivered", locAt: o.doorAt || Date.now()
        });
        return;
      }

      /* not delivered yet: still worth recording who they are */
      if(!o.custLearned && phoneKey(o.phone)){
        STORE.edit(o.id, { custLearned: true });
        STORE.rememberCustomer(o);
      }
    });

    /* Where their phone last was, moved into the book. It goes
       into its own three fields and never near lat/lng, which is
       where a rider is supposed to ride to. */
    var pings = STORE.pings();
    Object.keys(pings).forEach(function(id){
      var p = pings[id], c = STORE.customer(id);
      if(!c || !p.at) return;
      if((c.seenAt || 0) >= p.at) return;
      /* at: c.lastAt on purpose. rememberCustomer moves lastAt
         to now when it is not told otherwise, and opening the app
         is not ordering - without this every ping would make a
         customer look recently active and "gone quiet" would
         never find anybody. */
      STORE.rememberCustomer({ phone: c.phone, at: c.lastAt || 0 },
        { seenLat: p.lat, seenLng: p.lng, seenAt: p.at });
    });
  } finally { LEARNING = false; }
}

/* ------------------------------------------------------------
   THE CUSTOMER BOOK

   Everyone who has ever ordered, wherever they came from, with
   what we know about where they live. Two ways to read it: a
   list to search when the phone rings, and a map to look at
   when you are deciding where to put a leaflet.
   ------------------------------------------------------------ */
var CQ = "";        /* what the office is searching for */
var CVIEW = "list";
/* recent | quiet | orders | spend - how the book is stacked */
var CSORT = "recent";
/* when true the list is a job to work through, not a directory */
var CONLY = false;

try{ CSORT = localStorage.getItem("hayat_csort") || "recent"; }catch(e){}

/* Somebody who has not ordered in this long has gone quiet. Six
   weeks is roughly "missed a month of Fridays" for a restaurant
   people use a couple of times a month. */
var QUIET_DAYS = 42;

function daysSince(t){
  if(!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function lastSeenWords(c){
  var d = daysSince(c.lastAt);
  if(d === null) return "never ordered";
  if(d === 0) return "today";
  if(d === 1) return "yesterday";
  if(d < 30)  return d + " days ago";
  if(d < 60)  return "a month ago";
  return Math.floor(d / 30) + " months ago";
}

function isQuiet(c){
  var d = daysSince(c.lastAt);
  return d !== null && d >= QUIET_DAYS;
}

function custStats(c){
  var mine = STORE.orders().filter(function(o){
    return phoneKey(o.phone) === c.id && o.status !== "cancelled";
  });
  var spend = mine.reduce(function(n,o){ return n + (o.total || 0); }, 0);
  return { n: mine.length, spend: spend, last: mine[0] };
}

function viewCustomers(main){
  gate(main, function(){ paintCustomers(main); });
}

function paintCustomers(main){
  learnDoorsteps();
  var all = STORE.customers();
  var q = CQ.trim().toLowerCase();
  /* "".indexOf("") is 0, so an all-letters search matched every
     phone number in the book. Only compare numbers when the
     office actually typed some. */
  var qd = digitsOnly(q);
  var list = q
    ? all.filter(function(c){
        if((c.name || "").toLowerCase().indexOf(q) >= 0) return true;
        if((c.addr || "").toLowerCase().indexOf(q) >= 0) return true;
        return qd ? phoneKey(c.phone).indexOf(qd) >= 0 : false;
      })
    : all;

  /* The queue. Turning this on stops the page being a directory
     and makes it a job: everyone we have not confirmed is a real
     person, oldest first, so the office can work down it. */
  var unver = all.filter(function(c){ return !STORE.isVerified(c); });
  if(CONLY) list = list.filter(function(c){ return !STORE.isVerified(c); });

  list = list.slice().sort(function(a,b){
    if(CSORT === "quiet")  return (a.lastAt || 0) - (b.lastAt || 0);
    if(CSORT === "orders") return custStats(b).n - custStats(a).n;
    if(CSORT === "spend")  return custStats(b).spend - custStats(a).spend;
    return (b.lastAt || 0) - (a.lastAt || 0);      /* recent */
  });

  /* the map draws what is on screen; the tally counts the book,
     or turning the queue on would look like customers had lost
     their locations */
  var placed  = list.filter(function(c){ return c.lat && c.lng; });
  var located = all.filter(function(c){ return c.lat && c.lng; }).length;

  main.innerHTML =
    '<div class="console">' +
      '<div class="conbar">' +
        '<div class="tabs">' +
          '<button class="tab' + (CVIEW==="list"?" on":"") + '" data-cv="list">List</button>' +
          '<button class="tab' + (CVIEW==="map" ?" on":"") + '" data-cv="map">Map</button>' +
        '</div>' +
        '<div class="adminbar">' +
          '<span class="pill">' + all.length + ' customers</span>' +
          '<button class="pill' + (CONLY ? " on" : " warn") + '" id="cOnly" ' +
            'title="Show only the ones nobody has confirmed yet">' +
            unver.length + ' unverified</button>' +
          '<span class="pill quiet">' + located + ' located</span>' +
        '</div>' +
      '</div>' +

      '<div class="conbody' + (CVIEW === "map" ? " nomargin" : "") + '">' +
        (CVIEW === "map"
          ? '<div id="custmap" class="admap"></div>' +
            '<div class="mapfilt"><div class="mftally">' +
              esc(placed.length + (placed.length === 1 ? " customer" : " customers") +
                  " we can find again") + '</div></div>'
          : '<div class="conscroll">' +
              '<input class="fld cfind" id="cFind" autocomplete="off" ' +
                'placeholder="Search a number, a name, a place\u2026" value="' + esc(CQ) + '">' +
              '<div class="csort">' +
                [["recent","Recently active"],["quiet","Gone quiet"],
                 ["orders","Most orders"],["spend","Most spent"]]
                  .map(function(p){
                    return '<button class="chip' + (CSORT===p[0]?" on":"") +
                      '" data-cs="' + p[0] + '">' + p[1] + '</button>';
                  }).join("") +
              '</div>' +
              (CONLY
                ? '<p class="cqhint">' + unver.length + ' to confirm. Ring them, ' +
                  'or WhatsApp the code \u2014 then mark them verified.</p>'
                : '') +
              offerBar(list) +
              (list.length
                ? '<div class="lines">' + list.map(custRow).join("") + '</div>'
                : '<p class="shopsub">' + (q ? "Nobody matches that." : "Nobody yet.") + '</p>') +
            '</div>') +
      '</div>' +

      '<div class="condock">' +
        '<button class="dockbtn" data-go="#/admin/call" title="Order by phone">\u260E</button>' +
        '<button class="dockbtn" data-go="#/admin" title="Orders">\u25A6</button>' +
      '</div>' +
    '</div>';

  main.querySelectorAll("[data-cv]").forEach(function(b){
    b.onclick = function(){ CVIEW = b.dataset.cv; paintCustomers(main); };
  });

  main.querySelectorAll("[data-cs]").forEach(function(b){
    b.onclick = function(){
      CSORT = b.dataset.cs;
      try{ localStorage.setItem("hayat_csort", CSORT); }catch(e){}
      paintCustomers(main);
    };
  });

  var on = el("cOnly");
  if(on) on.onclick = function(){ CONLY = !CONLY; paintCustomers(main); };

  var os = el("oStart");
  if(os) os.onclick = function(){
    BLAST = offerDefault(); BSENT = {}; offerSave();
    paintCustomers(main);
    var t = el("oText"); if(t){ t.focus(); t.select(); }
  };
  var ox = el("oStop");
  if(ox) ox.onclick = function(){ BLAST = null; BSENT = {}; offerSave(); paintCustomers(main); };
  var ot = el("oText");
  if(ot) ot.oninput = function(){ BLAST = ot.value; offerSave(); };

  main.querySelectorAll("[data-off]").forEach(function(b){
    b.onclick = function(){
      /* marked before the window opens - if it is blocked or they
         close it, the office still knows where they had got to */
      BSENT[b.dataset.off] = true; offerSave();
      b.classList.add("done"); b.textContent = "Sent";
      var n = el("oText"); if(n) BLAST = n.value;
      window.open(wa(b.dataset.offp, BLAST || ""), "_blank", "noopener");
    };
  });

  main.querySelectorAll("[data-ver]").forEach(function(b){
    b.onclick = function(){
      STORE.setVerified(b.dataset.ver, true, "office");
      shopToast("Marked verified.");
      paintCustomers(main);
    };
  });

  var f = el("cFind");
  if(f){
    f.oninput = function(){
      CQ = f.value;
      var at = f.selectionStart;
      paintCustomers(main);
      var n = el("cFind");
      if(n){ n.focus(); try{ n.setSelectionRange(at, at); }catch(e){} }
    };
  }

  main.querySelectorAll("[data-again]").forEach(function(b){
    b.onclick = function(){
      var c = STORE.customer(b.dataset.again);
      if(!c) return;
      CALL = { lines: [], phone: c.phone, name: c.name || "", addr: c.addr || "",
               lat: c.lat, lng: c.lng };
      location.hash = "#/admin/call";
    };
  });

  if(CVIEW === "map") drawCustomerMap(placed);
}

/* ------------------------------------------------------------
   AN BLAST, SENT BY HAND, FOR NOTHING

   The WhatsApp Business API charges per marketing message and
   has no free tier. A wa.me link costs nothing, because it is
   not a broadcast at all - it opens WhatsApp with the message
   already typed and the office presses send. That is one tap per
   customer, which is slow, and it is the honest price of free.

   So the list itself is the tool: sort the book by Gone quiet,
   write the offer once, and work down the list. Who has already
   been sent to is remembered, because the office will be
   interrupted halfway and there is nothing worse than losing
   your place and sending the same thing twice.
   ------------------------------------------------------------ */
var BLAST = null;      /* the text being sent, or null when closed */
var BSENT = {};        /* phone -> true, for the run in progress */

try{ BLAST = sessionStorage.getItem("hayat_offer") || null; }catch(e){}
try{ BSENT = JSON.parse(sessionStorage.getItem("hayat_osent") || "{}"); }catch(e){}

function offerSave(){
  try{
    if(BLAST === null) sessionStorage.removeItem("hayat_offer");
    else sessionStorage.setItem("hayat_offer", BLAST);
    sessionStorage.setItem("hayat_osent", JSON.stringify(BSENT));
  }catch(e){}
}

function offerDefault(){
  var sh = (C().name || "Hayat");
  return sh + "\n\nSpecial this week: [write the offer here]\n\n" +
         "Order: " + base();
}

function offerBar(list){
  if(BLAST === null){
    return '<div class="offbar">' +
      '<button class="chip offgo" id="oStart">\u2709 Send an offer to these ' +
        list.length + '</button>' +
    '</div>';
  }
  var left = list.filter(function(c){ return !BSENT[c.id]; }).length;
  return '<div class="offbox">' +
    '<div class="offhead"><b>Offer to ' + list.length + ' customers</b>' +
      '<button class="linky" id="oStop">Done</button></div>' +
    '<textarea class="fld" id="oText" rows="4">' + esc(BLAST) + '</textarea>' +
    '<p class="offnote">' + left + ' still to send. WhatsApp opens with this ' +
      'already typed \u2014 you press send. Free, one at a time.</p>' +
  '</div>';
}

function custRow(c){
  var st  = custStats(c);
  var ok  = STORE.isVerified(c);
  var where = c.locFrom === "delivered" ? "doorstep known"
            : c.lat ? "pin saved"
                    : "no location yet";
  /* A hint, kept visibly separate from the address a rider rides
     to - it is where the phone was, not where the food goes. */
  var seen = c.seenAt
    ? '<a class="linky seen" target="_blank" rel="noopener" href="' +
      'https://www.google.com/maps/search/?api=1&query=' + c.seenLat + ',' + c.seenLng +
      '" title="Where their phone was when they last opened the app">' +
      'Last seen ' + esc(lastSeenWords({ lastAt: c.seenAt })) + '</a>'
    : '';
  return '<div class="line cline' + (c.lat ? "" : " noloc") +
      (ok ? "" : " unver") + (isQuiet(c) ? " quiethere" : "") + '">' +
    '<a class="ln" href="#/admin/c/' + esc(c.id) + '"><b>' +
      esc(c.name || prettyPhone(c.phone)) +
      (ok ? '<span class="vtick" title="Confirmed">\u2713</span>' : '') + '</b>' +
      '<small>' + esc(prettyPhone(c.phone)) +
        ' \u00b7 ' + esc(lastSeenWords(c)) +
        ' \u00b7 ' + esc(where) + '</small>' +
      (c.addr ? '<small class="caddr">' + esc(c.addr) + '</small>' : '') +
    '</a>' +
    '<div class="cstat"><b>' + st.n + '</b><small>' +
      (st.n === 1 ? "order" : "orders") + '</small></div>' +
    '<div class="cstat"><b>' + rupee(st.spend) + '</b><small>spent</small></div>' +
    (c.lat
      ? '<a class="linky" target="_blank" rel="noopener" ' +
        'href="https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng +
        '">Map</a>'
      : '') +
    seen +
    (BLAST !== null
      ? '<button class="linky off' + (BSENT[c.id] ? " done" : "") + '" ' +
        'data-off="' + esc(c.id) + '" data-offp="' + esc(c.phone) + '">' +
        (BSENT[c.id] ? "Sent" : "Send") + '</button>'
      : '') +
    callBtn(c.phone, "Call", "linky") +
    (ok ? '' : '<button class="linky ver" data-ver="' + esc(c.id) +
                '" title="You have spoken to them - this is a real number">' +
                'Verify</button>') +
    '<button class="linky go" data-again="' + esc(c.id) + '">Order</button>' +
  '</div>';
}

/* ------------------------------------------------------------
   ONE CUSTOMER, EVERYTHING WE KNOW

   Opened from the book or straight from a phone number. Every
   order they ever placed, what they spend, what they order
   most, and how long since they last did - which is the number
   that tells you who is drifting away.
   ------------------------------------------------------------ */
function viewCustomer(main, phone){
  gate(main, function(){ paintCustomer(main, phone); });
}

function custOrders(id){
  return STORE.orders().filter(function(o){ return phoneKey(o.phone) === id; })
    .sort(function(a,b){ return b.at - a.at; });
}

function favourites(list){
  var tally = {};
  list.forEach(function(o){
    (o.lines || []).forEach(function(l){
      var k = l.name + (l.label ? " \u00b7 " + l.label : "");
      tally[k] = (tally[k] || 0) + l.q;
    });
  });
  return Object.keys(tally).map(function(k){ return { k:k, n:tally[k] }; })
    .sort(function(a,b){ return b.n - a.n; }).slice(0, 5);
}

function paintCustomer(main, phone){
  var id = phoneKey(phone);
  var c = STORE.customer(id);
  var mine = custOrders(id);
  var live = mine.filter(function(o){ return o.status !== "cancelled"; });
  var spend = live.reduce(function(n,o){ return n + (o.total || 0); }, 0);
  var gone = mine.filter(function(o){ return o.status === "cancelled"; }).length;
  var since = mine.length ? Math.floor((Date.now() - mine[0].at) / 86400000) : null;
  var fav = favourites(live);

  if(!c && !mine.length){
    main.innerHTML = shell("Not in the book",
      '<p class="shopsub">Nothing recorded for that number yet.</p>' +
      '<button class="shopbtn ghost" data-go="#/admin/who">The customer book</button>', true);
    return;
  }

  main.innerHTML = shell(c && c.name ? c.name : prettyPhone(phone),
    '<div class="profile">' +

      '<div class="pstats">' +
        '<div class="ps"><b>' + live.length + '</b><small>orders</small></div>' +
        '<div class="ps"><b>' + rupee(spend) + '</b><small>lifetime</small></div>' +
        '<div class="ps"><b>' + rupee(live.length ? Math.round(spend / live.length) : 0) +
          '</b><small>average</small></div>' +
        '<div class="ps' + (since !== null && since > 30 ? " cold" : "") + '"><b>' +
          (since === null ? "\u2014" : since === 0 ? "today" : since + "d") +
          '</b><small>since last</small></div>' +
        (gone ? '<div class="ps"><b>' + gone + '</b><small>cancelled</small></div>' : '') +
      '</div>' +

      '<div class="prow">' +
        callBtn(phone, "Call", "shopbtn small") +
        '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
          esc(wa(phone, "Hayat \u2014 hello" + (c && c.name ? " " + c.name : "") + "\n\n")) +
          '">WhatsApp</a>' +
        (c && c.lat
          ? '<a class="shopbtn small ghost" target="_blank" rel="noopener" href="' +
            'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng +
            '">Where they are</a>'
          : '') +
        '<button class="shopbtn small" data-again="' + esc(id) + '">Order for them</button>' +
      '</div>' +

      (c && c.addr ? '<p class="shopnote paddr">' + esc(c.addr) +
        (c.locFrom === "delivered" ? ' \u00b7 doorstep known from a delivery'
         : c.lat ? ' \u00b7 pin saved' : ' \u00b7 no location yet') + '</p>' : '') +

      (fav.length
        ? '<h3 class="mini">What they order</h3>' +
          '<div class="favs">' + fav.map(function(f){
            return '<span class="fav"><b>' + f.n + '\u00d7</b> ' + esc(f.k) + '</span>';
          }).join("") + '</div>'
        : '') +

      '<h3 class="mini">Every order</h3>' +
      (mine.length
        ? '<div class="lines">' + mine.map(function(o){
            return '<a class="line oline" href="#/admin/o/' + esc(o.id) + '">' +
              '<div class="ln"><b>' + esc(o.id) + '</b>' +
                '<small>' + esc(stamp(o.at)) + ' \u00b7 ' +
                  esc(STEP[o.status] ? STEP[o.status].t : o.status) +
                  (o.source === "phone" ? " \u00b7 by phone" : "") + '</small>' +
                '<small class="oitems">' + esc((o.lines||[]).map(function(l){
                  return l.q + "\u00d7 " + l.name; }).join(", ")) + '</small>' +
              '</div>' +
              '<div class="lp">' + rupee(o.total || 0) + '</div>' +
              payTag(o) +
            '</a>';
          }).join("") + '</div>'
        : '<p class="shopsub">No orders recorded.</p>') +

      '<button class="shopbtn ghost" data-go="#/admin/who">Back to the book</button>' +
    '</div>', true);

  main.querySelectorAll("[data-again]").forEach(function(b){
    b.onclick = function(){
      CALL = { lines: [], phone: (c && c.phone) || phone, name: (c && c.name) || "",
               addr: (c && c.addr) || "", lat: c && c.lat, lng: c && c.lng };
      location.hash = "#/admin/call";
    };
  });
}

/* a date a person can read */
function stamp(ms){
  var d = new Date(ms);
  var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.getDate() + " " + M[d.getMonth()] + " \u00b7 " + when(ms);
}

var CMAP = null;
function drawCustomerMap(list){
  var box = el("custmap");
  if(!box) return;
  loadLeaflet().then(function(){
    try{ if(box._leaflet_id){ box._leaflet_id = null; box.innerHTML = ""; } }catch(e){}
    var LF = window.L;
    CMAP = LF.map(box, { zoomControl:false });
    LF.control.zoom({ position:"topright" }).addTo(CMAP);
    tameMap(CMAP, box);
    LF.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(CMAP);

    LF.circleMarker([HOME.lat, HOME.lng], {
      radius:7, color:"#FFFFFF", weight:2, fillColor:"#1B2410", fillOpacity:1
    }).addTo(CMAP).bindPopup("Hayat \u2014 the kitchen");

    list.forEach(function(c){
      var st = custStats(c);
      /* a doorstep the rider actually stood on is worth more than
         a pin somebody dropped, so it is drawn as the solid one */
      var solid = c.locFrom === "delivered";
      LF.marker([c.lat, c.lng], { icon: LF.divIcon({
        className: "omark cust" + (solid ? " sure" : ""),
        html: '<span class="dot" style="background:' +
                (solid ? "#5B8C2A" : "#C9A24B") + '"></span>' +
              '<span class="tag">' + esc(shortName(c.name || c.phone)) +
              (st.n > 1 ? ' \u00b7 ' + st.n : '') + '</span>',
        iconSize:null, iconAnchor:[7,7] }) })
        .addTo(CMAP).bindPopup(
          "<b>" + esc(c.name || prettyPhone(c.phone)) + "</b><br>" +
          esc(prettyPhone(c.phone)) + "<br>" +
          st.n + (st.n === 1 ? " order" : " orders") + " \u00b7 " + rupee(st.spend) + "<br>" +
          (c.addr ? esc(c.addr) + "<br>" : "") +
          (solid ? "<i>doorstep from a delivery</i>" : "<i>pin they dropped</i>"));
    });
    frameMap(CMAP, list.map(function(c){ return [c.lat, c.lng]; }));
    watchSize(box, CMAP);
  }).catch(function(){});
}

/* ------------------------------------------------------------
   AN ORDER TAKEN OVER THE PHONE

   Most of this restaurant's business arrives as a ringing
   phone, not as a tap on a website. Those orders were invisible
   to everything here - no board card, no rider, no record that
   the customer exists. So the office can write one down.

   And because the book remembers, a number that has ordered
   before fills in its own name, address and doorstep the moment
   it is typed. The person on the phone is not asked again for
   something they already told us.
   ------------------------------------------------------------ */
var CALL = { lines: [] };

function viewCall(main){
  gate(main, function(){ paintCall(main); });
}

function paintCall(main){
  var known = CALL.phone ? STORE.customer(CALL.phone) : null;
  var sub = CALL.lines.reduce(function(n,l){ return n + l.q * l.price; }, 0);

  main.innerHTML = shell("Order by phone",
    '<div class="callwrap">' +

      '<input class="fld" id="clPhone" inputmode="tel" autocomplete="off" ' +
        'placeholder="Their phone number" value="' + esc(CALL.phone || "") + '">' +

      (known
        ? '<div class="knownbox">' +
            '<div class="kt"><b>' + esc(known.name || "This number has ordered before") + '</b>' +
            '<small>' + esc(known.addr || "no address saved") +
            (known.locFrom === "delivered"
              ? ' \u00b7 doorstep known from a delivery'
              : known.lat ? ' \u00b7 pin saved' : '') +
            '</small></div>' +
            '<a class="linky" href="#/admin/c/' + esc(known.id) + '">History</a>' +
            '<button class="linky go" id="clUse">Use it</button>' +
          '</div>'
        : '') +

      '<input class="fld" id="clName" autocomplete="off" placeholder="Name" value="' +
        esc(CALL.name || "") + '">' +
      '<textarea class="fld" id="clAddr" placeholder="Address \u2014 house, landmark, area">' +
        esc(CALL.addr || "") + '</textarea>' +
      '<input class="fld" id="clNote" autocomplete="off" placeholder="Note for the kitchen (optional)" value="' +
        esc(CALL.note || "") + '">' +

      '<h3 class="mini">What did they ask for?</h3>' +
      (CALL.lines.length
        ? '<div class="lines">' + CALL.lines.map(function(l, i){
            return '<div class="line"><div class="ln"><b>' + esc(l.name) + '</b>' +
              (l.label ? '<small>' + esc(l.label) + '</small>' : '') + '</div>' +
              '<div class="qty">' +
                '<button data-cq="' + i + '|-1">\u2212</button>' +
                '<span>' + l.q + '</span>' +
                '<button data-cq="' + i + '|1">+</button>' +
              '</div>' +
              '<div class="lp">' + rupee(l.q * l.price) + '</div></div>';
          }).join("") + '</div>' +
          '<div class="total"><span>Total</span><b>' + rupee(sub) + '</b></div>'
        : '<p class="shopsub">Nothing added yet.</p>') +

      '<button class="shopbtn ghost findbtn" id="clFind">' +
        '<span class="fi">\uD83D\uDD0D</span> Add from the menu</button>' +

      '<button class="shopbtn" id="clGo">Put it on the board</button>' +
      '<button class="shopbtn ghost" data-go="#/admin">Back to orders</button>' +
    '</div>', true);

  /* typing a number is the lookup; no button to press */
  var ph = el("clPhone");
  ph.oninput = function(){
    CALL.phone = ph.value;
    var hit = STORE.customer(ph.value);
    if(hit && digitsOnly(ph.value).length >= 10 && !CALL.name && !CALL.addr) useKnown(hit);
    else paintCall(main);
  };

  function useKnown(k){
    CALL.name = k.name || "";
    CALL.addr = k.addr || "";
    if(k.lat){ CALL.lat = k.lat; CALL.lng = k.lng; }
    paintCall(main);
    shopToast("Filled in from their last order.");
  }
  var use = el("clUse");
  if(use) use.onclick = function(){ useKnown(known); };

  ["clName","clAddr","clNote"].forEach(function(id){
    var n = el(id);
    if(n) n.oninput = function(){ CALL[id.slice(2).toLowerCase()] = n.value; };
  });

  el("clFind").onclick = function(){
    openFinder(function(did, lbl, price){
      var it = dishById(did);
      var k = did + "|" + lbl;
      var hit = CALL.lines.filter(function(l){ return l.k === k; })[0];
      if(hit) hit.q += 1;
      else CALL.lines.push({ k:k, id:did, name: it ? label(it.name) : did,
                             label:lbl, price:price, q:1 });
      paintCall(main);
    }, "Add");
  };

  main.querySelectorAll("[data-cq]").forEach(function(b){
    b.onclick = function(){
      var p = b.dataset.cq.split("|"), i = +p[0], d = +p[1];
      CALL.lines[i].q += d;
      CALL.lines = CALL.lines.filter(function(l){ return l.q > 0; });
      paintCall(main);
    };
  });

  el("clGo").onclick = function(){
    if(!CALL.lines.length){ shopToast("Add what they ordered first."); return; }
    if(!digitsOnly(CALL.phone)){ shopToast("A phone number, please."); return; }
    if(!CALL.addr){ shopToast("Where is it going?"); return; }

    var o = {
      name: CALL.name || "",
      phone: CALL.phone,
      addr: CALL.addr,
      note: CALL.note || "",
      lines: CALL.lines.slice(),
      total: sub,
      source: "phone",
      custUid: null
    };
    if(CALL.lat){ o.lat = CALL.lat; o.lng = CALL.lng; }

    var id = STORE.place(o);
    if(!id){ shopToast("Something went wrong."); return; }
    STORE.setStatus(id, "accepted");      /* the office took it, so it is accepted */
    STORE.rememberCustomer(STORE.order(id));
    CALL = { lines: [] };
    shopToast("Order " + id + " is on the board.");
    location.hash = "#/admin";
  };
}

/* ---- the office editing one order -------------------------- */
function viewEdit(main, id){
  gate(main, function(){ paintEdit(main, id); });
}

function paintEdit(main, id){
  var o = STORE.order(id);
  if(!o){
    main.innerHTML = shell("Not found", '<p class="shopsub">That order is gone.</p>' +
      '<button class="shopbtn ghost" data-go="#/admin/who">The customer book</button>' +
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

      (o.kind === "ticket" && !(o.lines||[]).length
        ? '<div class="tkhead"><b>\u260E They asked us to call</b>' +
          '<small>Ring them, tap the items in as they say them, then ' +
          'send it back on WhatsApp so they can check it.</small>' +
          '<div class="tkrow">' + callBtn(o.phone, "Call " + (o.name || "them"), "shopbtn small") +
          '</div></div>'
        : '') +

      /* One button, and the search opens over the middle of the
         screen. A box down here is a box you scroll past. */
      '<button class="shopbtn ghost findbtn" id="edFind">' +
        '<span class="fi">\uD83D\uDD0D</span> Add something from the menu' +
      '</button>' +

      /* when the customer wants it, not when they asked */
      '<h3 class="mini">Wanted for</h3>' +
      '<div class="whenrow">' +
        '<button class="wbtn' + (!o.wantAt ? " on" : "") + '" data-when="now">As soon as possible</button>' +
        '<input class="fld" id="edWhen" type="datetime-local" value="' +
          esc(o.wantAt ? localStamp(o.wantAt) : "") + '">' +
      '</div>' +

      '<h3 class="mini">Where it goes</h3>' +
      '<input class="fld" id="edName"  placeholder="Name" value="' + esc(o.name) + '">' +
      '<input class="fld" id="edPhone" placeholder="Phone" inputmode="tel" value="' + esc(o.phone) + '">' +
      '<textarea class="fld" id="edAddr" placeholder="Address">' + esc(o.addr) + '</textarea>' +
      '<input class="fld" id="edNote"  placeholder="Note" value="' + esc(o.note||"") + '">' +

      '<button class="shopbtn" id="edSave">Save the changes</button>' +
      /* A ticket has never been told anything yet, so the message
         is the whole order rather than a list of changes. */
      '<a class="shopbtn' + (o.kind === "ticket" ? "" : " ghost") +
        '" id="edTell" target="_blank" rel="noopener" href="' +
        esc(waCustomer(o, o.kind === "ticket" ? msgTaken(o) : msgChanged(o))) + '">' +
        (o.kind === "ticket" ? "Send it to them on WhatsApp" : "Tell the customer on WhatsApp") +
      '</a>' +
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

  el("edFind").onclick = function(){
    openFinder(function(did, lbl, price){
      var live  = STORE.order(id);
      var lines = (live.lines || []).slice();
      var it    = dishById(did);
      var k     = did + "|" + lbl;
      var hit = lines.filter(function(l){ return (l.id + "|" + (l.label||"")) === k; })[0];
      if(hit) hit.q += 1;
      else lines.push({ k:k, id:did, name: it ? label(it.name) : did,
                        label:lbl, price:price, q:1 });
      STORE.edit(id, { lines: lines });
      /* the form behind is repainted so the total is honest even
         while the palette is still open */
      paintEdit(main, id);
    }, "Add");
  };

  main.querySelectorAll("[data-when]").forEach(function(b){
    b.onclick = function(){
      STORE.edit(id, { wantAt: null });
      paintEdit(main, id);
    };
  });
  var ew = el("edWhen");
  if(ew) ew.onchange = function(){
    var v = ew.value ? new Date(ew.value).getTime() : null;
    STORE.edit(id, { wantAt: v || null });
    paintEdit(main, id);
  };

  el("edSave").onclick = function(){
    STORE.edit(id, {
      name:  el("edName").value.trim(),
      phone: el("edPhone").value.trim(),
      addr:  el("edAddr").value.trim(),
      note:  el("edNote").value.trim(),
      discount: { type: d.type, value: +(el("edDisc").value || 0) }
    });
    /* A correction typed here is usually the office fixing what
       the customer got wrong, so it belongs in the book too -
       otherwise the same bad address comes back next time. */
    STORE.rememberCustomer(STORE.order(id));
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
        var st = riderState(r);
        return '<div class="line rline s-' + st.k + '">' +
          '<span class="rdot" title="' + esc(st.t) + '"></span>' +
          '<div class="ln"><b>' + esc(r.name) + '</b>' +
            '<small>' + esc(prettyPhone(r.phone)) + ' \u00b7 ' + esc(st.t) + '</small>' +
            (r.uid || r.claimedAt ? '' :
              '<small class="pend">Has not signed in \u2014 code ' +
              esc(r.code || "?") + '</small>') +
          '</div>' +
          /* where they are, if their phone has said recently */
          (st.lat
            ? '<a class="linky" target="_blank" rel="noopener" ' +
              'href="https://www.google.com/maps/search/?api=1&query=' +
              st.lat + ',' + st.lng + '" title="Where they were last seen">Locate</a>'
            : '') +
          /* the office's two levers over a rider's phone */
          '<button class="linky" data-toggle="' + esc(r.id) + '" title="' +
            (r.avail === false ? "Put them back on duty" : "Take them off duty") + '">' +
            (r.avail === false ? "On duty" : "Off duty") + '</button>' +
          (r.uid || r.claimedAt
            ? '<button class="linky warn" data-kick="' + esc(r.id) + '" ' +
              'title="Sign their phone out and issue a new code">Sign out</button>' +
              '<a class="linky" href="' + esc(riderInvite(r)) + '" target="_blank" ' +
              'rel="noopener" title="Send the link again">Resend</a>'
            : '<a class="linky go" href="' + esc(riderInvite(r)) + '" target="_blank" ' +
              'rel="noopener">Send code</a>') +
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
  main.querySelectorAll("[data-toggle]").forEach(function(b){
    b.onclick = function(){
      var r = STORE.rider(b.dataset.toggle);
      if(!r) return;
      var now = STORE.setAvailable(r.id, r.avail === false);
      shopToast(r.name + (now ? " is on duty." : " is off duty."));
    };
  });

  main.querySelectorAll("[data-kick]").forEach(function(b){
    b.onclick = function(){
      var r = STORE.rider(b.dataset.kick);
      if(!r) return;
      if(!window.confirm("Sign " + r.name + "'s phone out?\n\n" +
         "Their app will ask for a code again, and they get a new one. " +
         "Anything they are carrying stays assigned to them.")) return;
      var code = STORE.signOutRider(r.id);
      shopToast(r.name + " signed out. New code " + code + " \u2014 send it when they are back.");
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
  var r = STORE.riders().filter(function(r){ return digits(r.phone) === mine; })[0] || null;

  /* The office signed this phone out. Let go quietly rather than
     carrying on as somebody the shop no longer recognises. */
  if(r && r.kicked && !r.uid && !r.claimedAt){
    var seen = 0;
    try{ seen = +localStorage.getItem("hayat_kicked") || 0; }catch(e){}
    if(r.kicked > seen){
      try{ localStorage.setItem("hayat_kicked", String(r.kicked)); }catch(e){}
      setRiderPhone("");
      stopPing();
      return null;
    }
  }
  return r;
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

/* Resolves with the position itself, not just a yes. Asking a
   second time to actually get the coordinates is how this stalled
   once: the permission prompt is one thing, the fix is another,
   and the second request can sit there for a long time. */
function askGps(){
  return new Promise(function(done){
    if(!navigator.geolocation) return done(false);
    navigator.geolocation.getCurrentPosition(
      function(pos){ GPSOK = true;  done(pos); },
      function(){ GPSOK = false; done(false); },
      { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  });
}

/* ------------------------------------------------------------
   WHERE THEY WERE WHEN THEY LAST LOOKED

   Useful to the office: somebody rings, and the book can say
   "their phone was near the bypass an hour ago" instead of
   nothing. But it is their location, so there are three rules,
   and all three are load-bearing.

   1. It NEVER asks. If the browser has not already been given
      permission - for a delivery pin, usually - this does
      nothing at all and shows no prompt. Asking a hungry person
      for their location on the way in is how apps get deleted.
   2. It only runs for somebody we can already name, because a
      location with no phone number attached is surveillance
      with no purpose.
   3. Once an hour at most, and it never touches the delivery
      address.
   ------------------------------------------------------------ */
var SEEN_EVERY = 3600000;        /* an hour */

/* Named pingWhereabouts and not markSeen: the rider code above
   already has a markSeen(ids) that remembers which jobs have been
   rung for. v100 shipped a second markSeen() here, the later one
   won, and every rider check found nothing remembered and rang
   again - on every phone that had ever signed in as a rider,
   including the owner's, in the customer app. */
function pingWhereabouts(){
  if(riderApp() || kiosk()) return;              /* customers only */
  if(!navigator.geolocation || !navigator.permissions) return;

  var me = knownMe();
  var phone = phoneKey(me && me.phone);
  if(!phone) return;                             /* rule 2 */

  var last = 0;
  try{ last = +localStorage.getItem("hayat_seen_at") || 0; }catch(e){}
  if(Date.now() - last < SEEN_EVERY) return;     /* rule 3 */

  navigator.permissions.query({ name: "geolocation" }).then(function(st){
    /* rule 1: granted, not prompt, not denied */
    if(st.state !== "granted") return;
    navigator.geolocation.getCurrentPosition(function(pos){
      try{ localStorage.setItem("hayat_seen_at", String(Date.now())); }catch(e){}
      STORE.pingSeen(phone, pos.coords.latitude, pos.coords.longitude);
    }, function(){}, { enableHighAccuracy:false, timeout:8000, maximumAge:300000 });
  }).catch(function(){});
}

/* ------------------------------------------------------------
   TROUBLE, AND ONLY TROUBLE

   This screen used to carry a panel explaining that the app was
   running in a browser, that location was needed, that alerts
   were needed - a wall of machinery on the front page of a
   working app. A rider cannot act on most of it and should not
   have to read any of it.

   So: nothing at all when things work. One line, and a button
   that fixes it, when something is genuinely broken. Permission
   is asked once at sign-in, where a tap is already happening.
   ------------------------------------------------------------ */
function troubleStrip(){
  if(GPSOK === false)
    return '<div class="trouble" id="troubleBox">' +
      '<div class="tt"><b>Location is off</b>' +
      '<small>The shop cannot see you, and the customer cannot follow you.</small></div>' +
      '<button class="shopbtn small" id="tbFix">Turn on</button>' +
    '</div>';
  return '<div id="troubleBox"></div>';
}

function paintTrouble(main, again){
  var box = el("troubleBox");
  if(!box) return;

  gpsState().then(function(st){
    var bad = (st === "denied") || (st === "none") || GPSOK === false;
    if(!bad){ box.innerHTML = ""; return; }

    box.className = "trouble";
    box.innerHTML =
      '<div class="tt"><b>Location is off</b>' +
      '<small>' + (st === "none"
        ? "This phone cannot share a position."
        : "The shop cannot see you, and the customer cannot follow you.") +
      '</small></div>' +
      (st === "none" ? "" : '<button class="shopbtn small" id="tbFix">Turn on</button>');

    var fix = el("tbFix");
    if(fix) fix.onclick = function(){
      fix.disabled = true;
      fix.textContent = "Waiting\u2026";
      askGps().then(function(ok){
        if(!ok) shopToast("Still blocked. Allow location for this site in your browser settings.");
        if(again) again();
      });
    };
  });
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
      backToMenu());
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

  var on = me.avail !== false;

  main.innerHTML = shell("Your deliveries",
    installBar() +
    '<div class="adminbar"><span class="pill">' + mine.length + ' to go</span>' +
      '<span class="pill quiet">' + done + ' done</span>' +
      '<button class="linky" id="rvOut">Not ' + esc(me.name) + '?</button></div>' +

    /* One switch, and the shop knows. A rider who has finished
       for the day should not have to answer the phone to say so. */
    '<button class="avail ' + (on ? "on" : "off") + '" id="rvAvail" ' +
      'aria-pressed="' + (on ? "true" : "false") + '">' +
      '<span class="adot"></span>' +
      '<span class="at"><b>' + (on ? "Available" : "Off duty") + '</b>' +
      '<small>' + (on ? "The shop can send you deliveries."
                      : "The shop will not assign you anything.") + '</small></span>' +
      '<span class="asw"></span>' +
    '</button>' +

    troubleStrip() +
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
    backToMenu());

  el("rvOut").onclick = function(){ setRiderPhone(""); viewDriveHome(main); };

  wireInstall(function(){ viewDriveHome(main); });

  el("rvAvail").onclick = function(){
    var now = STORE.setAvailable(me.id, me.avail === false);
    shopToast(now ? "You are available." : "Marked off duty.");
    viewDriveHome(main);
  };

  paintTrouble(main, function(){ viewDriveHome(main); });

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
        if(!o.rAt) return native() ? "Starting\u2026" : "Sharing while this screen is on";
        var f = staleness(o.rAt);
        if(native()) return "Position shared " + f.txt + " \u00b7 keeps going with the screen off";
        return f.state === "live"
          ? "Position shared just now \u00b7 keep this screen on"
          : "Last sent " + f.txt + " \u2014 the screen slept, tap to resume";
      })()) + '</span></div>' +
    troubleStrip() +
    noteThread(o, "Held up? Cannot find the door? Say so here\u2026") +
    '<button class="shopbtn ghost" data-go="#/drive">Your other deliveries</button>');

  wireNotes(main, id, function(){ viewDrive(main, id); });
  wirePaid(main, function(){ viewDrive(main, id); });
  paintTrouble(main, function(){ viewDrive(main, id); });

  if(next) el("dvGo").onclick = function(){
    /* This tap is a gesture, and a gesture is the only moment a
       browser will show a location prompt. Starting to track on
       a repaint asks silently, gets refused silently, and the
       shop then watches a rider who never appears to move -
       which is exactly what happened. So ask here, out loud. */
    var moving = (next === "assigned" || next === "on_way");

    /* Move the order first. Waiting on a GPS fix before changing
       the status makes the button look dead for up to fifteen
       seconds, which is how a rider decides the app is broken.
       The permission ask still rides on this same tap. */
    STORE.setStatus(id, next);

    if(moving && !native()){
      askGps().then(function(ok){
        if(!ok){
          shopToast("Location is off - turn it on so the shop can see you.");
          paintTrouble(main, function(){ viewDrive(main, id); });
        }
      });
    }
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
  /* The crumb bar belongs to the customer's app, where there is
     a menu behind you. In the rider's app there is nothing
     behind you, so it is a button that lies. */
  if(riderApp())
    return '<div class="shopwrap' + (wide ? " wide" : "") + '">' +
      '<h2 class="shoph">' + esc(title) + '</h2>' + body + '</div>';

  return '<div class="backbar">' +
      '<button class="back" data-go="#/"><span class="a">‹</span>Menu</button>' +
      '<span class="crumbtxt">' + esc(title) + '</span></div>' +
    '<div class="shopwrap' + (wide ? " wide" : "") + '">' +
      '<h2 class="shoph">' + esc(title) + '</h2>' + body + '</div>';
}

/* The office runs on a desktop all day. It gets the whole window:
   no category rail, no menu chrome, just the work. */
/* Two different office screens, two different layouts.

   deskwork  any office screen: no menu chrome, wide
   deskboard the board, list and map only: a fixed frame that
             owns the window and scrolls inside itself

   Editing an order is an ordinary page and must scroll like one,
   or the message thread at the foot of it cannot be reached. */
function deskMode(on, board){
  try{
    document.body.classList.toggle("deskwork", !!on);
    document.body.classList.toggle("deskboard", !!on && !!board);
    /* the same flag on <html>, so the no-scroll rule does not
       depend on :has() being understood */
    document.documentElement.classList.toggle("deskboard", !!on && !!board);
  }catch(e){}
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
   INSTALLING, IN ONE TAP

   No browser lets a page install itself. Chrome will not even
   let us open its own prompt without a tap to answer for, and
   iOS has no prompt at all - Apple only offers Share -> Add to
   Home Screen, by hand, forever.

   So one tap is the floor, and this is how we get there: catch
   Chrome's offer the moment it arrives, keep it, and put our
   own button in front of the person. Their tap opens the real
   prompt. No digging through a three-dot menu.

   On iPhone there is nothing to catch, so we show the two
   steps instead - and only on the rider's app, where an icon
   is the point. Nagging a customer who wants dinner is how you
   stop them ordering dinner.
   ------------------------------------------------------------ */
var OFFER = null;                 /* Chrome's deferred prompt */
var INSTALLWATCH = [];

function onOffer(f){ INSTALLWATCH.push(f); }
function offerFire(){ INSTALLWATCH.slice().forEach(function(f){ try{ f(); }catch(e){} }); }

function installed(){
  try{
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  }catch(e){ return false; }
}
function isApple(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
/* "Not now" used to mean "never again", which is how the owner
   himself ended up unable to find the install offer. Now it means
   a week. And the footer keeps a small permanent link, so nobody
   has to wait for a bar to come back. */
var INSTALL_SNOOZE = 7 * 86400000;
function installDismissed(){
  try{
    var v = localStorage.getItem("hayat_noinstall");
    if(!v) return false;
    if(v === "1") return false;                /* the old forever flag: forgiven */
    return (Date.now() - (+v || 0)) < INSTALL_SNOOZE;
  }catch(e){ return false; }
}
function dismissInstall(){
  try{ localStorage.setItem("hayat_noinstall", String(Date.now())); }catch(e){}
  offerFire();
}
/* the always-there way in, for the footer */
function installLink(){
  if(installed()) return "";
  if(!theOffer() && !isApple()) return "";
  return '<button class="landlink" id="getAppLink">Install the app</button>';
}
function wireInstallLink(repaint){
  var l = el("getAppLink");
  if(!l) return;
  l.onclick = function(){
    try{ localStorage.removeItem("hayat_noinstall"); }catch(e){}
    if(theOffer()){
      OFFER.prompt();
      OFFER.userChoice.then(function(r){
        if(r && r.outcome === "accepted") OFFER = null;
        if(repaint) repaint();
      });
    } else if(repaint) repaint();              /* Apple: the bar with the two steps */
  };
}

/* The page caught this in its head, before we existed - Chrome
   fires it early and it is gone if nobody is listening. Take
   whatever is waiting, and keep listening for a later one. */
function takeOffer(){
  if(window.__hayatOffer && OFFER !== window.__hayatOffer){
    OFFER = window.__hayatOffer;
    offerFire();
  }
}
takeOffer();
window.addEventListener("hayat-offer", takeOffer);
window.addEventListener("beforeinstallprompt", function(e){
  e.preventDefault();             /* keep it; we will open it ourselves */
  OFFER = e;
  offerFire();
});

window.addEventListener("appinstalled", function(){
  OFFER = null;
  try{ localStorage.removeItem("hayat_noinstall"); }catch(e){}
  offerFire();
  shopToast("Installed. Open it from your home screen.");
});

/* Read the head's catch every time rather than trusting an
   event to arrive after we started listening. shop.js and that
   snippet race on a big page, and a race decided the offer
   never appeared. */
function theOffer(){
  if(!OFFER && window.__hayatOffer) OFFER = window.__hayatOffer;
  return OFFER;
}

/* true when there is something worth showing a person */
function canOfferInstall(){
  if(installed() || installDismissed()) return false;
  /* Android hands us a prompt to open. Apple never will - Safari
     has no install prompt and never has - so there the offer is
     the two steps, written out, for the customer as well as the
     rider. Nobody gets left without a way to keep this. */
  return !!theOffer() || isApple();
}

function installBar(){
  if(!canOfferInstall()) return "";
  var rider = riderApp();
  if(theOffer()){
    return '<div class="getapp" id="getApp">' +
      '<div class="gt"><b>' + (rider ? "Install the rider app" : "Add Hayat to your phone") + '</b>' +
        '<small>' + (rider
          ? "One tap. Opens from your home screen, and location keeps working."
          : "One tap. Order again without hunting for the link.") + '</small></div>' +
      '<button class="shopbtn small" id="getAppGo">Install</button>' +
      '<button class="gx" id="getAppNo" aria-label="Not now">\u00d7</button>' +
    '</div>';
  }
  /* an iPhone: no prompt exists, so say the two steps plainly.
     Only Safari can do it, so say that too rather than let
     somebody tap Share in Chrome and find nothing there. */
  var safari = /safari/i.test(navigator.userAgent) &&
               !/crios|fxios|edgios/i.test(navigator.userAgent);
  return '<div class="getapp ios" id="getApp">' +
    '<div class="gt"><b>' + (rider ? "Keep the rider app" : "Add Hayat to your phone") + '</b>' +
      '<small>' + (safari
        ? "Tap <b>Share</b> at the bottom, then <b>Add to Home Screen</b>."
        : "Open this page in <b>Safari</b>, then Share \u2192 Add to Home Screen.") +
      '</small></div>' +
    '<button class="gx" id="getAppNo" aria-label="Not now">\u00d7</button>' +
  '</div>';
}

function wireInstall(repaint){
  var go = el("getAppGo"), no = el("getAppNo");
  if(go) go.onclick = function(){
    if(!theOffer()) return;
    go.disabled = true;
    OFFER.prompt();
    OFFER.userChoice.then(function(r){
      if(r && r.outcome === "accepted"){ OFFER = null; }
      else { go.disabled = false; }
      if(repaint) repaint();
    }).catch(function(){ go.disabled = false; });
  };
  if(no) no.onclick = function(){ dismissInstall(); if(repaint) repaint(); };
}

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
  /* the board owns the window; every other office page does not */
  deskMode(p[0] === "admin",
           p[0] === "admin" && p[1] !== "o" && p[1] !== "riders" &&
           p[1] !== "call" && p[1] !== "c");
  rideMode(p[0] === "drive");
  if(p[0] !== "admin") liveWatch(false, main);
  if(p[0] !== "drive") stopPing();      /* never track off the job page */
  if(!p.length && wantsLanding()){
    REPAINT = function(){ viewLanding(main); };
    REPAINT();
    return true;
  }
  if(p[0] === "quick")    { REPAINT = function(){ if(isTyping()) return; viewQuick(main); }; REPAINT(); return true; }
  if(p[0] === "seen")     { REPAINT = function(){ if(isTyping()) return; viewSeeOld(main); }; REPAINT(); return true; }
  if(p[0] === "orders")   { REPAINT = function(){ viewMyOrders(main); }; REPAINT(); return true; }
  if(p[0] === "cart")     { viewCart(main); return true; }
  if(p[0] === "checkout") { viewCheckout(main); return true; }
  if(p[0] === "o")        { REPAINT = function(){ viewOrder(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "drive")    { REPAINT = function(){ viewDrive(main, p[1]); }; REPAINT(); return true; }
  if(p[0] === "admin"){
    if(p[1] === "riders") { REPAINT = function(){ if(REDIT) return; viewRiders(main); }; REPAINT(); return true; }
    if(p[1] === "call")   { REPAINT = function(){ if(isTyping()) return; viewCall(main); }; REPAINT(); return true; }
    if(p[1] === "who")    { REPAINT = function(){ if(isTyping()) return; viewCustomers(main); }; REPAINT(); return true; }
    if(p[1] === "c" && p[2]) { REPAINT = function(){ viewCustomer(main, p[2]); }; REPAINT(); return true; }
    if(p[1] === "o" && p[2]) { REPAINT = function(){ viewEdit(main, p[2]); }; REPAINT(); return true; }
    REPAINT = function(){ viewAdmin(main); }; REPAINT(); return true;
  }
  return false;
}
STORE.onChange(function(){
  repaintNow();
  /* a rider signed in on this phone gets told about work wherever
     they are in the RIDER app. The customer app is a different
     front door; a phone that once signed in as a rider must not
     ring like one when its owner is ordering dinner. */
  try{ if(riderApp() && riderPhone()) checkForWork(); }catch(e){}
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

/* Chrome decides when a site is installable, and tells us late.
   Repaint when it does, so the offer appears rather than waiting
   for the next thing the person happens to tap. */
onOffer(function(){ repaintNow(); });
document.addEventListener("visibilitychange", function(){
  if(document.visibilityState === "visible" && PINGJOB) holdScreen();
});

/* ------------------------------------------------------------
   THE RIDER APP DRIVES ITSELF

   In the customer's app, index.html owns the router and calls
   SHOP.route for the ordering screens. rider.html has no menu
   and no router of its own, so when shop.js finds itself there
   it takes the wheel - and answers only to rider routes. A
   delivery app that can be navigated to a biryani page is not
   a delivery app.
   ------------------------------------------------------------ */
function riderApp(){ return !!window.HAYAT_RIDER_APP; }

/* In the rider's own app there is no menu to go back to, so the
   button should not be there at all. Redirecting it was papering
   over an offer that never made sense on that screen. */
function backToMenu(txt){
  if(riderApp()) return "";
  return '<button class="shopbtn ghost" data-go="#/">' +
         esc(txt || "Back to the menu") + '</button>';
}

if(riderApp()){
  (function(){
    var main = document.getElementById("main");

    var bar = '<div class="ridebar"><b>Hayat \u00b7 deliveries</b></div>';

    function paint(){
      var h = (location.hash || "").replace(/^#\/?/, "");
      var p = h.split("/").filter(Boolean);

      /* a rider app has exactly two screens */
      if(p[0] === "drive" && p[1]){
        REPAINT = function(){ viewDrive(main, p[1]); };
      } else {
        REPAINT = function(){ viewDriveHome(main); };
        if(p[0] !== "drive"){ location.replace("#/drive"); }
      }
      stopPing();
      repaintNow();

      /* the bar sits above whatever was just drawn */
      if(main.firstChild && !main.querySelector(".ridebar")){
        main.insertAdjacentHTML("afterbegin", bar);
      }
    }

    window.addEventListener("hashchange", paint);
    document.addEventListener("DOMContentLoaded", paint);
    if(document.readyState !== "loading") paint();

    /* data-go is how every button in shop.js navigates */
    document.addEventListener("click", function(e){
      var g = e.target.closest && e.target.closest("[data-go]");
      if(!g) return;
      e.preventDefault();
      var to = g.dataset.go;
      /* anything pointing back at the menu means nothing here */
      location.hash = /^#\/drive/.test(to) ? to : "#/drive";
    });
  })();
}

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

/* For a category row on a phone: a dish with one price gets Add
   right there; a dish with sizes says Choose and opens. The row
   is a [data-row] so repaintRows() turns Add into a stepper in
   place after the first tap. */
function rowControl(it){
  var ch = choices(it);
  if(ch.length === 1) return '<span class="rowadd" data-row="' + esc(it.id) + '|' +
    esc(ch[0].label) + '">' + addControl(it.id, ch[0].label, ch[0].price) + '</span>';
  return '<span class="rowpick">Choose \u203A</span>';
}

window.SHOP = {
  route: route,
  dishButtons: dishButtons,
  rowControl: rowControl,
  repaintRows: repaintRows,
  paintFab: paintFab,
  store: STORE,
  flow: FLOW
};
paintFab();

/* After the page is up and doing its job, not before. Nothing on
   screen waits for this and nothing breaks if it never runs. */
try{ setTimeout(pingWhereabouts, 4000); }catch(e){}

})();
