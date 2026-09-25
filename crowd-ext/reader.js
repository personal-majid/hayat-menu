/* Hayat Crowd — reads Google Maps' "Popular times" off the page
   that is open in front of you. Same file runs as the extension's
   content script and as the bookmarklet on a phone.

   It looks for what Google puts on the bars for screen readers:
     "Currently 45% busy, usually 60% busy."   (this hour, live)
     "60% busy at 7 PM."                        (any hour)
   and the live chip: "Live: Busier than usual" / "Not too busy" /
   "As busy as it gets" / "Usually not busy". Layout can move;
   those labels have been stable for years. */
(function(root){
  function readCrowd(doc){
    doc = doc || document;
    var out = { at: Date.now(), name: "", now: null, usual: null, live: "", hour: new Date().getHours(),
                day: new Date().getDay(), bars: [], ok: false, why: "" };
    var h1 = doc.querySelector("h1");
    out.name = h1 ? h1.textContent.trim() : "";

    var els = doc.querySelectorAll("[aria-label]");
    for(var i = 0; i < els.length; i++){
      var a = els[i].getAttribute("aria-label") || "";
      var cur = a.match(/currently\s+(\d+)%\s+busy,?\s+usually\s+(\d+)%/i);
      if(cur){ out.now = +cur[1]; out.usual = +cur[2]; continue; }
      var any = a.match(/^(\d+)%\s+busy\s+at\s+(\d{1,2})\s*(am|pm)\.?$/i);
      if(any){
        var hh = (+any[2]) % 12 + (/pm/i.test(any[3]) ? 12 : 0);
        out.bars.push({ h: hh, pct: +any[1] });
      }
    }
    /* Google skips "usually" when it has no live figure; the bar for
       this hour still says what is normal */
    if(out.usual == null && out.bars.length){
      for(var j = 0; j < out.bars.length; j++) if(out.bars[j].h === out.hour) out.usual = out.bars[j].pct;
    }
    var txt = (doc.body && doc.body.innerText) || "";
    var lv = txt.match(/\bLive\b[^\n]{0,4}\n?\s*([^\n]{3,40})/);
    var chip = txt.match(/(busier than usual|less busy than usual|not too busy|as busy as it gets|usually not busy|a little busy|not busy|usually busy)/i);
    out.live = chip ? chip[1] : (lv ? lv[1].trim() : "");

    if(out.now == null && out.usual == null && !out.bars.length){
      out.why = /popular times/i.test(txt) ? "bars not readable" : "no popular times on this page";
      return out;
    }
    out.ok = true;
    if(out.now != null && out.usual != null){
      out.margin = out.now - out.usual;
      out.verdict = out.margin >= 10 ? "busier" : out.margin <= -10 ? "quieter" : "usual";
    } else {
      out.margin = null;
      out.verdict = out.usual == null ? "unknown" : out.usual >= 60 ? "usually busy" : out.usual <= 25 ? "usually quiet" : "usual";
    }
    return out;
  }

  /* Firestore over REST, no SDK, no secrets: the site's public
     project and a word the rules check. */
  function fsValue(v){
    if(v === null || v === undefined) return { nullValue: null };
    if(typeof v === "boolean") return { booleanValue: v };
    if(typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if(Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
    if(typeof v === "object") return { mapValue: { fields: fsFields(v) } };
    return { stringValue: String(v) };
  }
  function fsFields(o){ var f = {}; for(var k in o) f[k] = fsValue(o[k]); return f; }

  function writeCrowd(project, key, data, robot){
    var doc = Object.assign({}, data, { robot: robot || "", key: key });
    var url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(project) +
              "/databases/(default)/documents/crowd/" + encodeURIComponent(key);
    return fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fields: fsFields(doc) }) })
      .then(function(r){ return r.ok ? r.json() : r.text().then(function(t){ throw new Error(r.status + " " + t.slice(0, 120)); }); });
  }

  root.HayatCrowd = { readCrowd: readCrowd, writeCrowd: writeCrowd };
})(typeof self !== "undefined" ? self : this);
