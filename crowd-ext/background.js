importScripts("reader.js", "places.js");

var DEFAULTS = { project:"h-menu", robot:"", every:30, places: self.HAYAT_PLACES, results:{}, log:[], mapsBase:"" };

function settings(){
  return new Promise(function(done){ chrome.storage.local.get(DEFAULTS, done); });
}
function save(patch){ return new Promise(function(done){ chrome.storage.local.set(patch, done); }); }
function note(line){
  return settings().then(function(s){
    var log = [new Date().toLocaleTimeString() + "  " + line].concat(s.log || []).slice(0, 60);
    return save({ log: log });
  });
}

var MAPS = "https://www.google.com/maps/place/?q=place_id:";
function placeUrl(p){ return MAPS + encodeURIComponent(p.id) + "&hl=en"; }

/* open the place in a background tab, inject the reader, ask it,
   close the tab. Injecting from here (rather than trusting the
   content script to have loaded) works on a tab in any state. */
function readOnce(tabId){
  return chrome.scripting.executeScript({ target:{ tabId: tabId }, files:["reader.js"] })
    .then(function(){ return chrome.scripting.executeScript({ target:{ tabId: tabId },
      func: function(){ return self.HayatCrowd.readCrowd(document); } }); })
    .then(function(res){ return (res && res[0] && res[0].result) || { ok:false, why:"no answer" }; })
    .catch(function(e){ return { ok:false, why: String(e && e.message || e) }; });
}
function readPlace(p){
  return new Promise(function(done){
    chrome.tabs.create({ url: placeUrl(p), active:false }, function(tab){
      var tries = 0;
      var ask = function(){
        tries++;
        readOnce(tab.id).then(function(res){
          /* bars not drawn yet: wait and ask again, up to ~25 s */
          if(!res.ok && tries < 10) return setTimeout(ask, 2500);
          chrome.tabs.remove(tab.id, function(){ void chrome.runtime.lastError; });
          done(res);
        });
      };
      setTimeout(ask, 4000);
    });
  });
}

function sweep(){
  return settings().then(function(s){
    if(s.mapsBase) MAPS = s.mapsBase;                 /* tests point this at a fake */
    var list = s.places || [];
    var results = Object.assign({}, s.results);
    var chain = Promise.resolve();
    list.forEach(function(p){
      chain = chain.then(function(){
        return readPlace(p).then(function(r){
          r.key = p.key; r.place = p.name; r.us = !!p.us;
          results[p.key] = r;
          var line = p.name + (r.ok
            ? "  now " + (r.now == null ? "?" : r.now + "%") + "  usual " + (r.usual == null ? "?" : r.usual + "%") +
              (r.margin == null ? "" : "  (" + (r.margin > 0 ? "+" : "") + r.margin + ")") + "  " + r.verdict + (r.live ? "  · " + r.live : "")
            : "  — " + (r.why || "not read"));
          return save({ results: results }).then(function(){ return note(line); })
            .then(function(){
              if(!r.ok) return;
              return self.HayatCrowd.writeCrowd(s.project, p.key, {
                name: p.name, us: !!p.us, now: r.now, usual: r.usual, margin: r.margin, verdict: r.verdict,
                live: r.live, hour: r.hour, day: r.day, at: r.at, bars: r.bars.slice(0, 24)
              }, s.robot).catch(function(e){ return note("  Firestore refused " + p.name + ": " + e.message); });
            });
        });
      }).then(function(){ return new Promise(function(d){ setTimeout(d, 6000); }); });   /* be a person about it */
    });
    return chain.then(function(){ return note("sweep done · " + list.length + " places"); });
  });
}

chrome.runtime.onInstalled.addListener(function(){
  settings().then(function(s){ chrome.alarms.create("sweep", { periodInMinutes: Math.max(10, s.every || 30) }); });
});
chrome.alarms.onAlarm.addListener(function(a){ if(a.name === "sweep") sweep(); });
chrome.runtime.onMessage.addListener(function(msg, sender, reply){
  if(msg && msg.type === "sweep"){ sweep().then(function(){ reply({ ok:true }); }); return true; }
  if(msg && msg.type === "reschedule"){
    chrome.alarms.create("sweep", { periodInMinutes: Math.max(10, msg.every || 30) }); reply({ ok:true });
  }
});
