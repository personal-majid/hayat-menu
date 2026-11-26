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
    if(new URL(req.url).pathname === '/ai') return ai(req, env);   /* v323: Ask Gemini from the owner app */
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
  /* 3. v350: news & events, at most once an hour */
  try{ const nh = await fs.get('settings/news_health'); if(!nh || !nh.at || now.getTime() - new Date(nh.at).getTime() > 55 * 60000) res.news = await news(fs, now); }catch(e){ res.err.push('news: ' + e.message); }
  await health(fs, res); return res;
}
/* v350 NEWS & EVENTS (ChatGPT review P05-001/005/007/010/020/023): free Google News RSS searches for what can move a day at
   Hayat - hartal / bandh, district school holidays, rain alerts, NH 966 road trouble, football / cricket, Gulf jobs, food prices,
   local news. One doc per business day news/{day} {items:{id:{t,l,s,p,c,q,seen}}}; only NEW items are written (1 read + 1 write).
   Headlines are shown in the app for the owner to confirm; they never change the forecast by themselves. */
export const NEWS_Q = [
  ['local', 'Malappuram'], ['local', 'Perinthalmanna OR Makkaraparamba OR Mankada OR Kottakkal'],
  ['shutdown', 'hartal Kerala OR bandh Kerala OR harthal Malappuram'], ['school', 'Malappuram collector holiday schools'],
  ['weather', 'Malappuram rain alert'], ['road', 'NH 966 OR "Kozhikode Palakkad highway" accident OR block'],
  ['football', 'Kerala Blasters match'], ['football', 'sevens football Malappuram'], ['cricket', 'India cricket match today'],
  ['gulf', 'Gulf Malayali jobs OR Saudi expatriates Kerala'], ['price', 'Kerala chicken price'],
  ['shutdown', 'ഹർത്താൽ'], ['school', 'മലപ്പുറം അവധി']
];
/* a headline must name what matters for its kind, else it is dropped (first dry run 26 Nov: "Eagle Thane Strikers" under
   hartal, car-sale ads under local, cricket team pages under cricket) */
const PLACE = /Malappuram|Perinthalmanna|Makkaraparamba|Mankada|Kottakkal|Manjeri|Valanchery|Kerala|Keralam|മലപ്പുറം|കേരള/i;
export const CAT_RULES = [
  ['shutdown', t => /hartal|harthal|bandh|ഹർത്താൽ/i.test(t) && !/cricket|T20|strikers/i.test(t)],
  ['school', t => /holiday|അവധി/i.test(t) && /school|college|collector|educational|വിദ്യാലയ/i.test(t)],
  ['weather', t => /alert|heavy rain|downpour|flood|cyclone|മഴ/i.test(t) && PLACE.test(t)],
  ['road', t => /accidents?|road block|blocked|diversion|traffic jam|landslide|അപകടം|ഗതാഗത/i.test(t) && !/firing|shooting/i.test(t) && /NH ?966|highway|Malappuram|Perinthalmanna|Mankada|Kottakkal|Palakkad|Kozhikode/i.test(t) && !/Ras Al|UAE|Saudi|Dubai/i.test(t)],
  ['football', t => /Kerala Blasters|sevens|Malappuram FC|Santosh Trophy|Super League Kerala|ഫുട്ബോൾ/i.test(t)],
  ['cricket', t => /\bIndia\b|\bIND\b|IPL|Kerala Cricket League|Sanju/i.test(t) && /vs|match|final|series|World Cup/i.test(t) && !/scorecards|statistics|squads/i.test(t)],
  ['gulf', t => /Gulf|Saudi|UAE|Qatar|Oman|Kuwait|Bahrain|expat|pravasi|NRK|പ്രവാസി/i.test(t) && /Kerala|Keralam|Malayali|Indian|India|മലയാളി/i.test(t)],
  ['price', t => /price|rate|cost|inflation|വില/i.test(t) && /chicken|broiler|biryani|sadya|food|catering|LPG|fuel|petrol|diesel|vegetable|rice|egg/i.test(t)],
  ['local', t => /Malappuram|Perinthalmanna|Makkaraparamba|Mankada|Kottakkal|മലപ്പുറം/i.test(t) && !/for sale|second hand|gold rate|cartrade|prediction & tips/i.test(t)]];
const ent = t => String(t || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
export function parseRss(xml){ const out = []; const re = /<item>([\s\S]*?)<\/item>/g; let m; while((m = re.exec(xml))){ const g = tag => { const x = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(m[1]); return x ? ent(x[1]) : ''; };
    out.push({ t: g('title'), l: g('link'), p: g('pubDate'), s: g('source') }); } return out; }
const hid = s => { let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export async function news(fs, now){ const { day } = slotOf(now), have = ((await fs.get('news/' + day)) || {}).items || {}, add = {}, seen = now.toISOString(); let n = 0, err = 0;
  for(const [q0, q] of NEWS_Q){ const ml = /[\u0D00-\u0D7F]/.test(q), u = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + (ml ? '&hl=ml&gl=IN&ceid=IN:ml' : '&hl=en-IN&gl=IN&ceid=IN:en');
    try{ const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (hayat-news)' } }); if(!r.ok){ err++; continue; } const L = parseRss(await r.text()).slice(0, 12);
      for(const it of L){ if(!it.t) continue; const pt = new Date(it.p).getTime(); if(pt && now.getTime() - pt > 72 * 3600e3) continue; const id = hid(it.t.toLowerCase().replace(/\s+-\s+[^-]+$/, ''));
        if(have[id] || add[id]) continue; const cr = CAT_RULES.find(([k, f]) => f(it.t)); if(!cr) continue; const c = cr[0]; add[id] = { t: it.t.slice(0, 220), l: it.l, s: it.s.slice(0, 60), p: pt ? new Date(pt).toISOString() : '', c, q: q0, seen }; n++; } }catch(e){ err++; } }
  const ids = Object.keys(add); if(ids.length) await fs.patch('news/' + day, { items: add, day }, ids.map(k => 'items.`' + k + '`').concat(['day']));
  await fs.patch('settings/news_health', { at: seen, n: Object.keys(have).length + ids.length, new: ids.length, err }); return { new: ids.length, err }; }
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

/* ---------------- v323: ASK GEMINI ----------------
   POST /ai {prompt, data} from the owner app (https://personal-majid.github.io only) -> Gemini -> {text, model}.
   The key is the Worker secret GEMINI_KEY (from https://aistudio.google.com/apikey), set once with
     npx wrangler secret put GEMINI_KEY        (in cloudflare/traffic)
   It never reaches the browser. Model: env.GEMINI_MODEL or gemini-flash-latest; busy (503) / rate-limited (429)
   -> one retry, then env.GEMINI_FALLBACK or gemini-flash-lite-latest (same pattern as the scheduler project). */
const AI_ORIGINS = ['https://personal-majid.github.io', 'http://localhost:8125'];
async function ai(req, env){
  const origin = req.headers.get('origin') || '', ok = AI_ORIGINS.includes(origin);
  const H = { 'content-type': 'application/json', 'access-control-allow-origin': ok ? origin : AI_ORIGINS[0], 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
  const out = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: H });
  if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  if(req.method !== 'POST') return out({ error: 'POST only' }, 405);
  if(!ok) return out({ error: 'not allowed from this site' }, 403);
  const KEY = env.GEMINI_KEY || env.GEMINI_API_KEY;   /* either name (BoardReady uses GEMINI_API_KEY) */
  if(!KEY) return out({ error: 'Gemini is not set up yet: run "npx wrangler secret put GEMINI_KEY" in cloudflare/traffic and paste the key from aistudio.google.com/apikey' }, 503);
  let b; try{ b = await req.json(); }catch(e){ return out({ error: 'bad request' }, 400); }
  const prompt = String(b.prompt || '').slice(0, 8000), data = String(b.data || '').slice(0, 200000);
  if(!prompt) return out({ error: 'empty prompt' }, 400);
  const body = { contents: [{ role: 'user', parts: [{ text: prompt + '\n\n=== DATA (from the Hayat owner app) ===\n' + data }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4096 } };
  const models = [env.GEMINI_MODEL || 'gemini-flash-latest', env.GEMINI_FALLBACK || 'gemini-flash-lite-latest'];
  let last = '';
  for(const m of models){ for(let i = 0; i < 2; i++){
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) });
    if(r.ok){ const j = await r.json(); const text = (((j.candidates || [])[0] || {}).content || {}).parts ? j.candidates[0].content.parts.map(x => x.text || '').join('') : ''; return out({ text: text || '(empty answer)', model: m }); }
    last = r.status + ' ' + (await r.text()).slice(0, 200);
    if(r.status !== 503 && r.status !== 429) return out({ error: 'Gemini: ' + last }, 502);
    await new Promise(z => setTimeout(z, 1500)); } }
  return out({ error: 'Gemini is busy right now, try again in a minute (' + last + ')' }, 503); }
