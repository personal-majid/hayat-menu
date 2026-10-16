/* Hayat Instagram reader - a Cloudflare Worker on the FREE plan.
   It keeps your Instagram token (secret IG_TOKEN), refreshes it before it expires (KV binding IGKV), and gives the owner
   page your daily reach / followers and every post's views, so the app can see whether a reel moved sales.
   Uses the official "Instagram API with Instagram Login" (Business or Creator account, no Facebook Page needed). Free.
   GET /?days=90  ->  {at, account:{username, followers}, daily:[{d, reach, follower_count}],
                       posts:[{id, ts, type, caption, url, views, reach, likes, comments, saved, shares}]}  */
const G = 'https://graph.instagram.com', V = 'v21.0';
export default {
  async fetch(req, env, ctx){
    const origin = req.headers.get('Origin') || '', allow = (env.ALLOW_ORIGIN || 'https://personal-majid.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0], 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' };
    const out = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ 'content-type': 'application/json' }, cors) });
    if(req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if(!allow.includes(origin)) return out({ error: 'not allowed from ' + origin }, 403);
    const tok = await token(env); if(!tok) return out({ error: 'IG_TOKEN secret is missing (Settings -> Variables and Secrets)' }, 500);
    const days = Math.min(180, Math.max(7, +new URL(req.url).searchParams.get('days') || 90));
    const ck = 'cache:' + days; if(env.IGKV){ const c = await env.IGKV.get(ck); if(c){ const j = JSON.parse(c); if(Date.now() - j.at < 3600e3) return out(j); } }
    try{
      const me = await ig(`/${V}/me?fields=user_id,username,followers_count`, tok);
      /* account insights: 30 days per call, newest first */
      const daily = {}, now = Math.floor(Date.now() / 1000);
      for(let end = now; end > now - days * 86400; end -= 30 * 86400){ const since = Math.max(now - days * 86400, end - 30 * 86400);
        for(const m of ['reach', 'follower_count']){ try{ const r = await ig(`/${V}/me/insights?metric=${m}&period=day&since=${since}&until=${end}`, tok); (r.data || []).forEach(s => (s.values || []).forEach(v => { const d = String(v.end_time || '').slice(0, 10); if(d) (daily[d] = daily[d] || { d })[s.name] = v.value; })); }catch(e){} }
      }
      /* posts: up to 100 newest, each with its own numbers */
      const posts = []; let next = `/${V}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&limit=50`;
      while(next && posts.length < 100){ const r = await ig(next, tok); (r.data || []).forEach(p => posts.push(p)); next = r.paging && r.paging.next ? r.paging.next.replace(G, '') : null;
        if(posts.length && posts[posts.length - 1].timestamp < new Date((now - days * 86400) * 1000).toISOString()) break; }
      const P = await Promise.all(posts.map(async p => { const o = { id: p.id, ts: p.timestamp, type: p.media_product_type || p.media_type, caption: String(p.caption || '').slice(0, 140), url: p.permalink, likes: p.like_count || 0, comments: p.comments_count || 0 };
        try{ const r = await ig(`/${V}/${p.id}/insights?metric=views,reach,saved,shares`, tok); (r.data || []).forEach(m => { o[m.name] = (m.values && m.values[0] && m.values[0].value) || m.total_value && m.total_value.value || 0; }); }catch(e){}
        return o; }));
      const res = { at: Date.now(), account: { username: me.username, followers: me.followers_count }, daily: Object.values(daily).sort((a, b) => a.d < b.d ? -1 : 1), posts: P };
      if(env.IGKV) ctx.waitUntil(env.IGKV.put(ck, JSON.stringify(res), { expirationTtl: 7200 }));
      return out(res);
    }catch(e){ const m = String(e.message || e); return out({ error: /190|expired|session/i.test(m) ? 'Instagram token expired - make a new one (README step 3, paste it in step 5)' : 'Instagram: ' + m.slice(0, 200) }, 502); }
  },
  /* free cron (Triggers -> Cron: 0 3 * * 1): keeps the token alive */
  async scheduled(ev, env){ await token(env, true); }
};
async function ig(path, tok){ const u = (path.startsWith('http') ? path : G + path) + (path.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(tok);
  const r = await fetch(u); const j = await r.json(); if(j.error) throw new Error((j.error.code || '') + ' ' + (j.error.message || 'error')); return j; }
/* the token lasts 60 days; refresh it when it is over a week old and keep the new one in KV */
async function token(env, force){ let t = env.IGKV ? await env.IGKV.get('token') : null, at = env.IGKV ? +(await env.IGKV.get('token_at') || 0) : 0; t = t || env.IG_TOKEN; if(!t) return null;
  if(env.IGKV && (force || Date.now() - at > 7 * 864e5)){ try{ const r = await fetch(`${G}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t)}`); const j = await r.json(); if(j.access_token){ t = j.access_token; await env.IGKV.put('token', t); await env.IGKV.put('token_at', String(Date.now())); } }catch(e){} }
  return t; }
