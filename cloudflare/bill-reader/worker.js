/* Hayat bill reader - a Cloudflare Worker on the FREE plan, using Cloudflare's own Workers AI (free allowance).
   No API key, no card, no paid AI. The free plan includes 10,000 "neurons" a day (about 200 bill photos);
   past that it simply answers "limit reached" until tomorrow - the free plan never bills you.

   The Stock page (stock.html) sends a photo here ONLY when the free on-phone reader is unsure.

   Setup (Cloudflare dashboard, no code tools needed):
     Worker -> Settings -> Bindings -> Add -> Workers AI -> Variable name: AI
     Worker -> Settings -> Variables -> ALLOW_ORIGIN (Text) = https://personal-majid.github.io
   Model: Meta Llama 3.2 11B Vision (reads photos). Meta's licence is accepted automatically on the first call
   (Cloudflare asks every account to send "agree" once).

   Reply: {is_bill, why, supplier, date (YYYY-MM-DD), bill_no, total, lines:[{raw, name, category, qty, unit, rate, amount}]} */
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
export default {
  async fetch(req, env){
    const origin = req.headers.get('Origin') || '';
    const allow = (env.ALLOW_ORIGIN || 'https://personal-majid.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };
    const out = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ 'content-type': 'application/json' }, cors) });
    if(req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if(req.method !== 'POST') return out({ error: 'POST a bill photo' }, 405);
    if(!allow.includes(origin)) return out({ error: 'not allowed from ' + origin }, 403);
    if(!env.AI) return out({ error: 'Workers AI binding "AI" is missing (Settings -> Bindings -> Workers AI)' }, 500);

    let body; try{ body = await req.json(); }catch(e){ return out({ error: 'bad JSON' }, 400); }
    const img = String(body.image || '');
    if(!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return out({ error: 'image must be a data: URL (jpeg/png/webp)' }, 400);
    if(img.length > 4e6) return out({ error: 'photo too big' }, 413);
    const items = (body.items || []).slice(0, 250).join(', '), sups = (body.suppliers || []).slice(0, 40).join(', ');
    const cats = (body.cats || []).join(', ') || 'Meat, Fish, Vegetables, Fruit, Grocery, Rice & flour, Oil & ghee, Dairy & eggs, Spices, Drinks, Packing, Cleaning, Gas & fuel, Other';

    const system = 'You read supplier bills for a restaurant in Kerala, India and answer with JSON only.';
    const prompt = `Is this photo a supplier bill / purchase invoice (handwritten or printed) with items and amounts?
If NOT, answer exactly: {"is_bill": false, "why": "short reason"}
If it is, answer with ONLY this JSON, nothing else:
{"is_bill": true, "supplier": "", "date": "YYYY-MM-DD or empty", "bill_no": "", "total": number or null,
 "lines": [{"raw": "item text as written", "name": "clean English item name", "category": "one of: ${cats}", "qty": number, "unit": "kg|g|L|ml|nos|pkt|box|tray|bag|tin|bottle|cyl|bundle|dozen", "rate": number, "amount": number}]}
Rules: rupees, no commas. If rate is missing use amount/qty. Fix spelling and expand short or Malayalam names (thakkali=Tomato, savala=Onion, inji=Ginger, kozhi=Chicken).
Use these exact names when the item is one of ours: ${items || '(none yet)'}. Known suppliers: ${sups || '(none yet)'}.
Leave tax, discount, round-off and total rows out of "lines". Never invent lines you cannot see.`;

    const ask = () => env.AI.run(MODEL, { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], image: img, max_tokens: 1500, temperature: 0.1 });
    let r;
    try{ r = await ask(); }
    catch(e){
      const msg = String(e && e.message || e);
      if(/agree|licen[cs]e/i.test(msg)){ try{ await env.AI.run(MODEL, { prompt: 'agree' }); r = await ask(); }catch(e2){ return out({ error: 'AI: ' + String(e2.message || e2).slice(0, 200) }, 502); } }
      else if(/neuron|limit|quota|429|capacity/i.test(msg)) return out({ error: 'free daily AI limit reached - try again tomorrow' }, 429);
      else return out({ error: 'AI: ' + msg.slice(0, 200) }, 502);
    }
    const txt = typeof r === 'string' ? r : (r && (r.response || r.result || '')) || '';
    const s = String(txt).indexOf('{'), e = String(txt).lastIndexOf('}');
    try{ return out(JSON.parse(String(txt).slice(s, e + 1))); }catch(err){ return out({ error: 'could not read the AI answer', raw: String(txt).slice(0, 300) }, 502); }
  }
};
