function $(id){ return document.getElementById(id); }
function sign(n){ return n == null ? "—" : (n > 0 ? "+" : "") + n; }
function paint(s){
  var list = s.places || [], rs = s.results || {};
  var rows = list.map(function(p){
    var r = rs[p.key];
    if(!r) return '<tr class="' + (p.us ? "us" : "") + '"><td>' + p.name + '</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="usual">not read yet</td></tr>';
    if(!r.ok) return '<tr class="' + (p.us ? "us" : "") + '"><td>' + p.name + '</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="usual">' + (r.why || "") + '</td></tr>';
    return '<tr class="' + (p.us ? "us" : "") + '"><td>' + p.name + '</td>' +
      '<td class="n">' + (r.now == null ? "—" : r.now + "%") + '</td>' +
      '<td class="n">' + (r.usual == null ? "—" : r.usual + "%") + '</td>' +
      '<td class="n ' + r.verdict + '">' + sign(r.margin) + '</td>' +
      '<td class="' + r.verdict + '">' + (r.live || r.verdict) + '</td></tr>';
  });
  $("rows").innerHTML = rows.join("");
  var read = list.map(function(p){ return rs[p.key]; }).filter(function(r){ return r && r.ok && r.margin != null; });
  var newest = Object.keys(rs).reduce(function(m, k){ return Math.max(m, rs[k].at || 0); }, 0);
  $("stamp").textContent = newest ? "read " + new Date(newest).toLocaleTimeString() : "";
  if(read.length){
    var busier = read.filter(function(r){ return r.verdict === "busier"; }).length;
    var quieter = read.filter(function(r){ return r.verdict === "quieter"; }).length;
    var avg = Math.round(read.reduce(function(n, r){ return n + r.margin; }, 0) / read.length);
    $("summary").textContent = "Around us: " + busier + " busier, " + quieter + " quieter, " + (read.length - busier - quieter) +
      " as usual · average " + sign(avg) + " points vs a normal " + new Date().toLocaleDateString(undefined, { weekday:"long" }) + " at this hour.";
  }
  $("log").textContent = (s.log || []).slice(0, 12).join("\n");
  $("project").value = s.project || "h-menu"; $("robot").value = s.robot || ""; $("every").value = s.every || 30;
  $("places").value = list.map(function(p){ return [p.key, p.name, p.id].concat(p.us ? ["us"] : []).join(" | "); }).join("\n");
}
function load(){ chrome.storage.local.get(null, function(s){ if(!s.places){ chrome.runtime.sendMessage({ type:"noop" }); } paint(s); }); }
chrome.storage.onChanged.addListener(load);
$("go").onclick = function(){
  $("busy").textContent = "Reading… tabs open and close by themselves.";
  chrome.runtime.sendMessage({ type:"sweep" }, function(){ $("busy").textContent = ""; load(); });
};
$("cfg").onclick = function(){ $("settings").hidden = !$("settings").hidden; };
$("saveBtn").onclick = function(){
  var places = $("places").value.split("\n").map(function(l){ return l.split("|").map(function(x){ return x.trim(); }); })
    .filter(function(p){ return p.length >= 3 && p[0] && p[2]; })
    .map(function(p){ return { key:p[0], name:p[1], id:p[2], us: p[3] === "us" }; });
  var every = Math.max(10, +$("every").value || 30);
  chrome.storage.local.set({ project:$("project").value.trim() || "h-menu", robot:$("robot").value.trim(), every:every, places:places }, function(){
    chrome.runtime.sendMessage({ type:"reschedule", every:every }); $("settings").hidden = true; load();
  });
};
load();
