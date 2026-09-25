/* The bookmarklet body for a phone: open a place in Google Maps,
   tap the bookmark, and this reads the bars and posts them. */
(function(){
  var S = {}; try{ S = JSON.parse(localStorage.getItem("hayatcrowd") || "{}"); }catch(e){}
  function go(){
    var r = self.HayatCrowd.readCrowd(document);
    if(!r.ok){ alert("Hayat Crowd: " + (r.why || "could not read this page")); return; }
    var key = (S.key || prompt("Short key for this place (e.g. nahl):", r.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12)) || "").trim();
    if(!key) return;
    var robot = S.robot || prompt("Robot word (from firestore.rules):", "") || "";
    try{ localStorage.setItem("hayatcrowd", JSON.stringify({ robot: robot })); }catch(e){}
    self.HayatCrowd.writeCrowd(S.project || "h-menu", key, {
      name: r.name, now: r.now, usual: r.usual, margin: r.margin, verdict: r.verdict, live: r.live,
      hour: r.hour, day: r.day, at: r.at, bars: r.bars.slice(0, 24), us: key === "hayat"
    }, robot).then(function(){
      alert(r.name + "\nnow " + (r.now == null ? "?" : r.now + "%") + " · usual " + (r.usual == null ? "?" : r.usual + "%") +
            (r.margin == null ? "" : " · " + (r.margin > 0 ? "+" : "") + r.margin) + "\n" + (r.live || r.verdict) + "\n\nSaved.");
    }).catch(function(e){ alert("Saved nowhere: " + e.message); });
  }
  if(self.HayatCrowd) return go();
  var s = document.createElement("script");
  s.src = "https://personal-majid.github.io/hayat-menu/crowd-ext/reader.js?" + Date.now();
  s.onload = go; s.onerror = function(){ alert("Could not load the reader."); };
  document.head.appendChild(s);
})();
