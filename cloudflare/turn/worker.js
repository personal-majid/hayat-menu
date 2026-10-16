/* Hayat in-app calls: hands out short-lived TURN (relay) credentials so rider <-> customer
   calls connect even on strict mobile networks. Cloudflare TURN: first 1,000 GB a month free;
   a voice minute is ~0.75 MB, so the shop never gets near it. The long-term key stays here.
   Variables (Settings -> Variables and Secrets):
     TURN_KEY_ID         text   - the TURN key's ID (Realtime -> TURN)
     TURN_KEY_API_TOKEN  secret - that key's API token
     ALLOW_ORIGIN        text   - https://personal-majid.github.io (who may ask) */
export default {
  async fetch(req, env){
    const allow = env.ALLOW_ORIGIN || 'https://personal-majid.github.io';
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if(req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if(origin && origin !== allow) return json({ error: 'not allowed from ' + origin }, 403);
    if(req.method !== 'POST') return json({ error: 'POST only' }, 405);
    if(!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ error: 'TURN_KEY_ID / TURN_KEY_API_TOKEN not set' }, 500);
    const r = await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/' + env.TURN_KEY_ID + '/credentials/generate-ice-servers', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 43200 }) });
    if(!r.ok) return json({ error: 'cloudflare said ' + r.status }, 502);
    const j = await r.json();
    /* browsers refuse port 53; drop those addresses so the phone does not wait on them */
    const ice = [].concat(j.iceServers || []).map(s => Object.assign({}, s, { urls: [].concat(s.urls || []).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
    return json({ iceServers: ice });
  }
};
