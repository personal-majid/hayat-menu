/* Hayat road-traffic collector — a Cloudflare Worker on the FREE plan, run by a cron every 15 minutes,
   whether or not anyone has the owner app open.

   Each run (≈ 3 TomTom requests, ≈ 288 a day, well inside TomTom's free 2,500 a day):
   1. Route times (TomTom Routing, the same request the owner app makes): drive time now vs with no traffic,
      for the routes in settings/traffic.routes (default Perinthalmanna ↔ Malappuram).
      → settings/trf_YYYY-MM  {d:{day:{"HH:MM":{at, src:'cron', r:[{n,now,free,delay}]}}}}  — the SAME place and shape the
        app's own readings use, so Traffic history, "usual for this hour" and the forecast hint fill in on their own.
   2. Road speed (TomTom Flow Segment Data) at points on the highway: current speed, free-flow speed, travel times,
      confidence, closure. → traffic_flow/{day} {s:{"HH:MM":{pointId:{sp,ff,tt,ftt,cf,cl}}}, pts:{pointId:name}, at}
      NOTE: this is SPEED / CONGESTION, not the number of vehicles. A free licensed vehicle-count feed for this road
      was not found; fast traffic can still be heavy, slow traffic is not more customers.
   3. Health → settings/trf_health {at, ok, routes, points, err}.

   Day = business day (05:00 cut, India time); slot = the 15-minute slot it ran in. Writing the same slot twice just
   overwrites it (safe to retry). Nothing is ever deleted.

   Keys — nothing has to be typed in: both are read from the site's public config.js (SITE_CONFIG, default
   https://personal-majid.github.io/hayat-menu/config.js) when not set on the worker:
     FIREBASE_API_KEY  the web API key (config.js firebase.apiKey)
     TOMTOM_KEY        secret if set; else the key saved in the owner app (settings/traffic.key); else config.js traffic.tomtomKey
     FIREBASE_PROJECT  h-menu (optional)
   Writes go through the Firestore REST API with the web key, which works because the live rules are open
   (Majid's choice). If the rules are ever made strict, this worker needs a service-account token instead. */
const TT = 'https://api.tomtom.com';
const DEF_ROUTES = [{ n: 'Perinthalmanna → Malappuram', a: [10.9764, 76.2269], b: [11.0509, 76.0711] }, { n: 'Malappuram → Perinthalmanna', a: [11.0509, 76.0711], b: [10.9764, 76.2269] }];
const DEF_POINTS = [{ id: 'shop', n: 'NH 966 at Hayat', p: [11.0065785, 76.1270507] }];

export default {
  async scheduled(ev, env, ctx){ ctx.waitUntil(run(env)); },
  /* GET / = the last run's result; it runs now only when the last run is over 10 minutes old (the URL is public, so
     opening it repeatedly never spends extra TomTom calls) */
  async fetch(req, env){ const J = o => new Response(JSON.stringify(o, null, 1), { headers: { 'content-type': 'application/json' } });
    try{ const site = await siteKeys(env), h = await firestore(Object.assign({}, env, { FIREBASE_API_KEY: env.FIREBASE_API_KEY || site.fb })).get('settings/trf_health');
      if(h && h.at && Date.now() - new Date(h.at).getTime() < 10 * 60000) return J(Object.assign({ note: 'last run (runs by itself every 15 minutes)' }, h)); }catch(e){}
    return J(await run(env)); }
};

export async function run(env, now){
  now = now || new Date();
  const site = await siteKeys(env), fs = firestore(Object.assign({}, env, { FIREBASE_API_KEY: env.FIREBASE_API_KEY || site.fb })), { day, slot } = slotOf(now), at = now.toISOString();
  const res = { at, day, slot, routes: 0, points: 0, err: [] };
  let cfg = {}; try{ cfg = (await fs.get('settings/traffic')) || {}; }catch(e){ res.err.push('read settings: ' + e.message); }
  const key = env.TOMTOM_KEY || cfg.key || site.tt; if(!key){ res.err.push('no TomTom key (TOMTOM_KEY secret or the key saved in the owner app)'); await health(fs, res); return res; }
  /* 1. route times */
  const routes = Array.isArray(cfg.routes) && cfg.routes.length ? cfg.routes : DEF_ROUTES, R = [];
  for(const r of routes){ try{
      const j = await getJson(`${TT}/routing/1/calculateRoute/${r.a.join(',')}:${r.b.join(',')}/json?traffic=true&travelMode=car&computeTravelTimeFor=all&key=${encodeURIComponent(key)}`);
      const x = j && j.routes && j.routes[0] && j.routes[0].summary; if(!x) throw new Error('no route');
      const now_ = Math.round(x.travelTimeInSeconds / 60), free = Math.round((x.noTrafficTravelTimeInSeconds || x.travelTimeInSeconds) / 60);
      R.push({ n: r.n, now: now_, free, delay: Math.max(Math.round((x.trafficDelayInSeconds || 0) / 60), now_ - free) });
    }catch(e){ res.err.push(r.n + ': ' + e.message); } }
  if(R.length){ try{ await fs.patch(`settings/trf_${day.slice(0, 7)}`, { d: { [day]: { [slot]: { at, src: 'cron', r: R } } } }, [`d.\`${day}\`.\`${slot}\``]); res.routes = R.length; }catch(e){ res.err.push('write routes: ' + e.message); } }
  /* 2. road speed at points */
  const pts = Array.isArray(cfg.flow) && cfg.flow.length ? cfg.flow : DEF_POINTS, S = {}, names = {};
  for(const p of pts){ try{
      const j = await getJson(`${TT}/traffic/services/4/flowSegmentData/absolute/10/json?point=${p.p.join(',')}&unit=KMPH&key=${encodeURIComponent(key)}`);
      const f = j && j.flowSegmentData; if(!f) throw new Error('no flow data');
      S[p.id] = { sp: f.currentSpeed, ff: f.freeFlowSpeed, tt: f.currentTravelTime, ftt: f.freeFlowTravelTime, cf: f.confidence, cl: !!f.roadClosure }; names[p.id] = p.n;
    }catch(e){ res.err.push((p.n || p.id) + ': ' + e.message); } }
  if(Object.keys(S).length){ try{ await fs.patch(`traffic_flow/${day}`, { s: { [slot]: S }, pts: names, at }, [`s.\`${slot}\``, ...Object.keys(names).map(k => `pts.\`${k}\``), 'at']); res.points = Object.keys(S).length; }catch(e){ res.err.push('write flow: ' + e.message); } }
  await health(fs, res); return res;
}
/* the public site config: firebase apiKey and traffic.tomtomKey (both already visible to anyone who opens the site) */
async function siteKeys(env){ if(env.FIREBASE_API_KEY && env.TOMTOM_KEY) return {}; try{
    const t = await (await fetch(env.SITE_CONFIG || 'https://personal-majid.github.io/hayat-menu/config.js', { cf: { cacheTtl: 3600 } })).text();
    const m = (re) => { const x = t.match(re); return x ? x[1] : ''; };
    return { fb: m(/apiKey\s*:\s*["']([^"']+)["']/), tt: m(/tomtomKey\s*:\s*["']([^"']+)["']/) }; }catch(e){ return {}; } }
async function health(fs, res){ try{ await fs.patch('settings/trf_health', { at: res.at, ok: !res.err.length, routes: res.routes, points: res.points, err: res.err.join(' · ').slice(0, 500), day: res.day, slot: res.slot }, null); }catch(e){} }

/* business day (05:00 cut) and 15-minute slot, India time (UTC+5:30, no DST) */
export function slotOf(d){ const ist = new Date(d.getTime() + 330 * 60000), h = ist.getUTCHours(), m = ist.getUTCMinutes();
  const bd = new Date(ist.getTime() - (h < 5 ? 86400000 : 0)), day = bd.toISOString().slice(0, 10);
  return { day, slot: String(h).padStart(2, '0') + ':' + String(Math.floor(m / 15) * 15).padStart(2, '0') }; }

async function getJson(u, tries = 2){ let last; for(let i = 0; i < tries; i++){ try{ const r = await fetch(u); if(r.status === 429 || r.status >= 500){ last = new Error('HTTP ' + r.status); await new Promise(s => setTimeout(s, 1500)); continue; }
      const j = await r.json(); if(!r.ok) throw new Error((j && (j.detailedError && j.detailedError.message || j.error)) || 'HTTP ' + r.status); return j; }catch(e){ last = e; } } throw last; }

/* the smallest Firestore REST client: read a doc as plain JSON, merge fields into a doc (updateMask) */
function firestore(env){ const P = env.FIREBASE_PROJECT || 'h-menu', K = env.FIREBASE_API_KEY, base = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/`;
  if(!K) throw new Error('FIREBASE_API_KEY is missing');
  return {
    async get(path){ const r = await fetch(base + path + '?key=' + K); if(r.status === 404) return null; const j = await r.json(); if(!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status); return dec({ mapValue: { fields: j.fields || {} } }); },
    async patch(path, obj, mask){ const fields = enc(obj).mapValue.fields, q = (mask || Object.keys(obj)).map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
      const r = await fetch(base + path + '?' + q + '&key=' + K, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
      if(!r.ok){ const j = await r.json().catch(() => ({})); throw new Error((j.error && j.error.message) || 'HTTP ' + r.status); } } };
}
export function enc(v){ if(v === null || v === undefined) return { nullValue: null }; if(typeof v === 'boolean') return { booleanValue: v };
  if(typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; if(typeof v === 'string') return { stringValue: v };
  if(Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }; const f = {}; Object.keys(v).forEach(k => f[k] = enc(v[k])); return { mapValue: { fields: f } }; }
export function dec(v){ if('mapValue' in v){ const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => o[k] = dec(x)); return o; }
  if('arrayValue' in v) return (v.arrayValue.values || []).map(dec); if('integerValue' in v) return +v.integerValue; if('doubleValue' in v) return v.doubleValue;
  if('stringValue' in v) return v.stringValue; if('booleanValue' in v) return v.booleanValue; return null; }
