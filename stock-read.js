/* Hayat · reading a supplier bill from a photo (stock.html).
   1. ocr()      free, on the phone: Tesseract (bundled in assets/ocr/, nothing leaves the phone)
   2. parse()    text -> is it a bill? supplier, date, bill no, lines {raw, q, u, r, a}, total
   3. match()    every line name -> our item name + category: learned aliases, built-in list with
                 Malayalam / short names, spelling-tolerant scoring. Unsure lines are marked, never guessed silently.
   4. ai()       ONLY when the free read is unsure and an AI reader URL is set (a Cloudflare Worker that
                 holds the API key - the key is never in this app).
   Works in the browser (window.StockRead) and in node (module.exports) for tests. */
(function(root){
  'use strict';
  var CATS = ['Meat','Fish','Vegetables','Fruit','Grocery','Rice & flour','Oil & ghee','Dairy & eggs','Spices','Drinks','Packing','Cleaning','Gas & fuel','Other'];
  /* [name, category, aliases...]  aliases = other spellings, short forms, Malayalam / Manglish names */
  var DICT = [
    ['Chicken (whole)','Meat','chicken','chiken','chkn','kozhi','koli','broiler','chicken whole','k p chicken','kp chicken'],
    ['Chicken breast','Meat','boneless chicken','chicken boneless'],['Chicken leg','Meat','leg piece','chicken legs'],['Chicken liver','Meat','liver'],
    ['Beef','Meat','pothu','pothirachi','buffalo','beef meat'],['Mutton','Meat','aadu','goat','mutton meat'],['Quail','Meat','kaada'],
    ['Fish','Fish','meen'],['King fish','Fish','neymeen','seer fish','vanjiram'],['Sardine','Fish','mathi','chaala','chala'],['Mackerel','Fish','ayala','aila'],
    ['Pomfret','Fish','avoli'],['Prawns','Fish','chemmeen','shrimp','prawn'],['Squid','Fish','koonthal','kanava'],['Tuna','Fish','choora'],['Anchovy','Fish','netholi','kozhuva'],['Pearl spot','Fish','karimeen'],
    ['Tomato','Vegetables','thakkali','tomatto','tamato'],['Onion','Vegetables','savala','sawala','big onion','vellulli onion'],['Small onion','Vegetables','ulli','cheriya ulli','shallot','savala small','small savala','sambar onion'],
    ['Potato','Vegetables','urulakizhangu','urulakkizhangu','aloo'],['Carrot','Vegetables','carot'],['Beetroot','Vegetables','beet'],['Cabbage','Vegetables','cabage','kabage'],['Cauliflower','Vegetables','cauli','gobi'],
    ['Beans','Vegetables','beens'],['Green chilli','Vegetables','pacha mulaku','pachamulaku','green chilly','g chilli','chilli green','mulaku'],['Ginger','Vegetables','inji','inchi'],['Garlic','Vegetables','veluthulli','vellulli','poondu'],
    ['Coriander leaves','Vegetables','malliyila','coriander leaf','cilantro','kothamalli','coriander'],['Curry leaves','Vegetables','karivepila','kariveppila','curry leaf'],['Mint','Vegetables','pudina','mint leaves'],
    ['Lemon','Fruit','naranga','lime','cherunaranga'],['Cucumber','Vegetables','vellari','kakkiri'],['Capsicum','Vegetables','bell pepper','capsicam'],['Brinjal','Vegetables','vazhuthananga','eggplant'],
    ['Lady finger','Vegetables','vendakka','okra','bhindi'],['Drumstick','Vegetables','muringakka'],['Pumpkin','Vegetables','mathanga'],['Ash gourd','Vegetables','kumbalanga'],['Plantain','Vegetables','pacha kaya','raw banana','kaya'],
    ['Lettuce','Vegetables','letuce'],['Cabbage purple','Vegetables','red cabbage'],['Spring onion','Vegetables','spring onions'],['Mushroom','Vegetables','koon'],
    ['Banana','Fruit','pazham','nendran','poovan'],['Apple','Fruit'],['Orange','Fruit','orenge'],['Pineapple','Fruit','kaithachakka','pinapple'],['Watermelon','Fruit','thannimathan','water melon'],
    ['Mango','Fruit','manga'],['Grapes','Fruit','munthiri'],['Pomegranate','Fruit','mathalam','anar'],['Papaya','Fruit','kappalanga','omakka'],['Avocado','Fruit','butter fruit'],['Musambi','Fruit','mosambi','sweet lime'],
    ['Strawberry','Fruit'],['Dates','Fruit','eenthapazham','khajoor'],['Coconut','Grocery','thenga','tenga'],
    ['Basmati rice','Rice & flour','basmati','basmathi','biriyani rice','mandi rice','sella rice'],['Rice','Rice & flour','ari','matta rice','jeerakasala','kaima rice','ponni rice'],
    ['Atta','Rice & flour','wheat flour','gothambu podi','chakki atta'],['Maida','Rice & flour','all purpose flour','maida flour'],['Rava','Rice & flour','sooji','semolina','ravva'],['Corn flour','Rice & flour','cornflour','corn starch'],
    ['Bread crumbs','Rice & flour','breadcrumb','bread crumb'],['Bread','Grocery','bun','kuboos','khubz'],['Porotta','Grocery','parotta','frozen porotta'],
    ['Sugar','Grocery','panchasara','pancharsara'],['Salt','Grocery','uppu','crystal salt','table salt'],['Tea powder','Grocery','chaya podi','tea dust','tea'],['Coffee powder','Grocery','kappi podi','coffee'],
    ['Mayonnaise','Grocery','mayo','mayonaise','mayonese'],['Tomato ketchup','Grocery','ketchup','sauce','tomato sauce'],['Soy sauce','Grocery','soya sauce'],['Vinegar','Grocery','vineger'],['Chilli sauce','Grocery','chilly sauce','red chilli sauce'],
    ['Honey','Grocery','then'],['Noodles','Grocery','hakka noodles'],['Cashew','Grocery','kashuvandi','kaju','cashewnut'],['Raisins','Grocery','kismis','kishmish','dry grapes'],['Almond','Grocery','badam'],
    ['Sunflower oil','Oil & ghee','sunflwr oil','sunflower','sf oil','refined oil'],['Coconut oil','Oil & ghee','velichenna','thenga enna'],['Palm oil','Oil & ghee','palmolein','palmolin','palmolein oil'],['Oil','Oil & ghee','enna','cooking oil'],
    ['Ghee','Oil & ghee','neyy','ney','pure ghee'],['Butter','Dairy & eggs','vennai','amul butter'],['Milk','Dairy & eggs','pal','paal','milma'],['Curd','Dairy & eggs','thairu','dahi','yogurt'],
    ['Cheese','Dairy & eggs','cheese slice','mozzarella'],['Fresh cream','Dairy & eggs','cream'],['Paneer','Dairy & eggs','cottage cheese'],['Eggs','Dairy & eggs','egg','mutta','egg tray','eggs tray'],
    ['Chilli powder','Spices','mulaku podi','mulakupodi','red chilli powder','kashmiri chilli'],['Turmeric powder','Spices','manjal podi','manjal','turmeric'],['Coriander powder','Spices','malli podi','mallipodi','dhaniya powder'],
    ['Garam masala','Spices','masala','garam masala powder'],['Chicken masala','Spices'],['Mandi masala','Spices','mandi spice','arabic spice','kabsa masala'],['Pepper','Spices','kurumulaku','black pepper','pepper powder'],
    ['Cardamom','Spices','elakka','elaichi','elakkai'],['Cinnamon','Spices','karuvapatta','patta'],['Clove','Spices','grambu','karayampoo','cloves'],['Cumin','Spices','jeerakam','jeera','cumin seed'],
    ['Fennel','Spices','perumjeerakam','saunf'],['Mustard','Spices','kaduku'],['Bay leaf','Spices','vazhanayila','bay leaves'],['Dry red chilli','Spices','kollamulaku','unakka mulaku','dry chilli'],
    ['Saffron','Spices','kungumapoo'],['Food colour','Spices','food color','colour powder','kesari powder'],['Ajinomoto','Spices','msg'],['Baking soda','Spices','soda podi','cooking soda'],
    ['Pepsi','Drinks','pepsi cola'],['7Up','Drinks','7 up','seven up'],['Mirinda','Drinks','mirinda orange'],['Coca-Cola','Drinks','coke','coca cola','cocacola'],['Sprite','Drinks'],['Mountain Dew','Drinks','dew'],
    ['Mineral water','Drinks','water bottle','kinley','bisleri','aquafina','drinking water','meneral water'],['Soda','Drinks','club soda','soda water'],['Juice','Drinks','frooti','maaza','real juice'],['Ice','Drinks','ice cubes','ice block','ice cube'],
    ['Parcel cover','Packing','carry bag','cover','plastic cover','parcel bag','kitt'],['Foil container','Packing','aluminium container','foil box','silver container','container'],['Butter paper','Packing','butterpaper'],
    ['Aluminium foil','Packing','foil','silver foil','foil roll'],['Tissue','Packing','tissue paper','napkin'],['Paper cup','Packing','cup','glass cup'],['Straw','Packing','straws'],['Cling film','Packing','cling wrap','wrap'],
    ['Spoon','Packing','plastic spoon'],['Box','Packing','parcel box','meal box'],['Gloves','Cleaning','glove','hand gloves'],['Soap','Cleaning','sope'],['Dish wash','Cleaning','vim','pril','dishwash'],
    ['Floor cleaner','Cleaning','phenyl','lizol','harpic'],['Garbage bag','Cleaning','garbage cover','waste bag'],['Scrubber','Cleaning','scotch brite'],['Hand wash','Cleaning','handwash'],
    ['Gas cylinder','Gas & fuel','gas','lpg','cylinder','commercial gas','gas cyl'],['Charcoal','Gas & fuel','kari','kaari','coal','char coal'],['Firewood','Gas & fuel','viraku','wood'],['Diesel','Gas & fuel'],['Petrol','Gas & fuel']
  ];
  var UNITS = {kg:'kg',kgs:'kg',kilo:'kg',g:'g',gm:'g',gms:'g',gram:'g',grams:'g',l:'L',lt:'L',ltr:'L',ltrs:'L',litre:'L',liter:'L',ml:'ml',nos:'nos',no:'nos',pcs:'nos',pc:'nos',piece:'nos',pieces:'nos',
    pkt:'pkt',pkts:'pkt',packet:'pkt',pack:'pkt',box:'box',boxes:'box',tray:'tray',trays:'tray',bag:'bag',bags:'bag',tin:'tin',tins:'tin',btl:'bottle',bottle:'bottle',bottles:'bottle',cyl:'cyl',bundle:'bundle',dozen:'dozen',doz:'dozen',case:'case',crate:'crate',
    kq:'kg',kgq:'kg',kq5:'kg',kgs5:'kg',ka:'kg',lit:'L',litr:'L',ltre:'L',ltrs5:'L',nas:'nos',n0s:'nos',pkts5:'pkt',pk:'pkt',kettu:'bundle',kattu:'bundle'};

  function norm(s){ return String(s || '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function slug(s){ return norm(s).replace(/ /g,'-') || 'x'; }
  function titleCase(s){ return String(s || '').toLowerCase().replace(/\s+/g,' ').trim().replace(/(^|[\s(\/-])([a-z])/g, function(m, a, b){ return a + b.toUpperCase(); }); }
  function lev(a, b){ if(a === b) return 0; var m = a.length, n = b.length; if(!m) return n; if(!n) return m; var p = new Array(n + 1), c = new Array(n + 1), i, j;
    for(j = 0; j <= n; j++) p[j] = j;
    for(i = 1; i <= m; i++){ c[0] = i; for(j = 1; j <= n; j++){ var x = a[i-1] === b[j-1] ? 0 : 1; c[j] = Math.min(p[j] + 1, c[j-1] + 1, p[j-1] + x); if(i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) c[j] = Math.min(c[j], p[j-2] + 1); } var t = p; p = c; c = t; }
    return p[n]; }
  /* OCR mixes up look-alike letters: compare on a folded form too */
  function fold(s){ return s.replace(/q/g,'o').replace(/0/g,'o').replace(/1/g,'l').replace(/i/g,'l').replace(/5/g,'s').replace(/rn/g,'m').replace(/vv/g,'w').replace(/(.)\1+/g,'$1'); }
  function tokSim(a, b){ if(a === b) return 1; if(!a || !b) return 0;
    var fa = fold(a), fb = fold(b); if(fa === fb) return 0.97;
    var L = Math.max(a.length, b.length), s = 1 - Math.min(lev(a, b), lev(fa, fb)) / L;
    if(a.length >= 3 && b.indexOf(a) === 0) s = Math.max(s, 0.86 + 0.1 * a.length / b.length);       /* "tom" -> "tomato", "sunfl" -> "sunflower" */
    if(a.length >= 3 && a[0] === b[0]){ var k = 0; for(var i = 0; i < b.length && k < a.length; i++) if(b[i] === a[k]) k++; if(k === a.length) s = Math.max(s, 0.84); }   /* "chkn" -> "chicken", "sunflwr" */
    return s; }
  /* phrase vs phrase: every word of the candidate should find a partner; extra raw words cost a little */
  var STOP = {and:1,of:1,the:1,fresh:1,new:1,best:1,quality:1,brand:1,no:1,s:1};
  function words(s){ return norm(s).split(' ').filter(function(w){ return w && !STOP[w] && !/^\d+$/.test(w) && !UNITS[w] && !/^\d+(kg|g|gm|l|ltr|ml)$/.test(w); }); }
  function phraseSim(raw, cand){ var R = words(raw), C = words(cand); if(!R.length || !C.length) return 0;
    var whole = tokSim(R.join(''), C.join(''));
    var used = {}, tot = 0; C.forEach(function(c){ var best = 0, bi = -1; R.forEach(function(r, i){ if(used[i]) return; var v = tokSim(r, c); if(v > best){ best = v; bi = i; } }); if(bi >= 0) used[bi] = 1; tot += best; });
    var cov = tot / C.length, extra = R.length - Object.keys(used).length;
    return Math.max(whole * 0.98, cov - 0.06 * extra); }

  /* the item list to match against: our saved items (they win), then the built-in list */
  function catalog(items){ var out = [], seen = {};
    Object.keys(items || {}).forEach(function(k){ var it = items[k]; if(!it || !it.n) return; var d = DICT.find(function(x){ return slug(x[0]) === slug(it.n); }); out.push({n:it.n, c:it.c || (d ? d[1] : ''), al:(d ? d.slice(2) : []).concat(it.al || []), own:1}); seen[slug(it.n)] = 1; });
    DICT.forEach(function(d){ if(!seen[slug(d[0])]) out.push({n:d[0], c:d[1], al:d.slice(2)}); });
    return out; }
  function guessCat(raw, u){ var s = norm(raw);
    if(/chicken|beef|mutton|meat|liver/.test(s)) return 'Meat'; if(/fish|prawn|squid|meen/.test(s)) return 'Fish';
    if(/oil|ghee/.test(s)) return 'Oil & ghee'; if(/powder|masala|podi|seed/.test(s)) return 'Spices'; if(/rice|flour|atta|maida/.test(s)) return 'Rice & flour';
    if(/cover|box|container|foil|tissue|cup|bag|paper/.test(s)) return 'Packing'; if(/clean|soap|wash|phenyl/.test(s)) return 'Cleaning';
    if(/juice|water|soda|cola|\d+ ?ml|\d+ ?l\b/.test(s) || u === 'bottle' || u === 'case') return 'Drinks';
    if(u === 'kg') return 'Vegetables'; return 'Other'; }
  /* -> {n, c, score, via, raw}. score >= 0.82 auto, 0.62-0.82 "check", below = new item (cleaned raw name) */
  function match(raw, opt){ opt = opt || {}; var key = norm(raw).replace(/ /g,'_'), A = opt.alias || {};
    if(A[key] && opt.items && opt.items[A[key]]) return {n:opt.items[A[key]].n, c:opt.items[A[key]].c || '', score:1, via:'learned', raw:raw};
    var best = null, cat = catalog(opt.items), all = [];
    cat.forEach(function(it){ var s = phraseSim(raw, it.n), via = 'name'; it.al.forEach(function(a){ var v = phraseSim(raw, a); if(v > s){ s = v; via = 'alias'; } }); if(it.own) s += 0.02;
      all.push({n:it.n, c:it.c, score:Math.min(1, s)}); if(!best || s > best.score) best = {n:it.n, c:it.c, score:Math.min(1, s), via:via, raw:raw}; });
    /* the next nearest names, so a person can pick the right one with one tap (Majid, 15 Oct) */
    var alts = []; all.sort(function(a, b){ return b.score - a.score; }).forEach(function(x){ if(alts.length < 3 && x.score >= 0.45 && (!best || x.n !== best.n) && !alts.some(function(y){ return y.n === x.n; })) alts.push(x); });
    if(best) best.alts = alts;
    /* a weak match NEVER swaps in one of our names: the line keeps what was written (Majid, 13 Oct: "it imports something that is not on the bill") */
    if(!best || best.score < 0.78){ var nm = titleCase(words(raw).join(' ') || raw); return {n:nm, c:guessCat(raw, opt.u), score:best ? best.score : 0, via:'new', raw:raw, near:best && best.score >= 0.6 ? best.n : '', alts:best && best.score >= 0.45 ? [{n:best.n, c:best.c, score:best.score}].concat(alts).slice(0, 3) : alts}; }
    return best; }

  /* ---------- text -> bill ---------- */
  var RX_TOTAL = /\b(grand\s*total|net\s*amount|net\s*total|total\s*amount|amount\s*payable|bill\s*amount|total|net|t[o0]ta[l1i]?|[o0]ta[l1]|tota|totl|t[o0]t|g\.?\s*t[o0]tal)\b/i;
  var RX_OURS = /\bhayat\b|\bm\/s\b|\bsignature\b/i;
  var RX_SKIP = /\b(gst|gstin|fssai|ph|phone|mob|mobile|tel|thank|visit|cash|change|balance|cgst|sgst|igst|tax|discount|round|qty|rate|amount|particulars|item|description|sl\b|s\.no|address)\b/i;
  /* printing that sits AROUND a bill in a real photo: packets, labels, newspaper - never a bill line */
  var RX_JUNK = /\b(mrp|best\s*before|use\s*by|exp(iry)?|mfg|mfd|batch|lot\s*no|net\s*(wt|weight|qty)|incl(usive)?\s*of|www|http|\.com|customer\s*care|toll\s*free|ingredients|nutrition|barcode|off\b)/i;
  /* a real item name: some word of 3+ letters with a vowel, and mostly letters (not "{1 ~ | ey") */
  function wordy(n){ var w = String(n || '').split(/\s+/).filter(function(x){ return /^[a-z][a-z().'\/-]{2,}$/i.test(x) && /[aeiouy]/i.test(x); }); if(!w.length) return false;
    var raw = String(n).replace(/\s+/g, ''), letters = (raw.match(/[a-z]/ig) || []).length; return letters / Math.max(1, raw.length) >= 0.6; }
  var RX_DATE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  /* OCR look-alikes inside numbers (no lookbehind: older iPhones cannot parse it) */
  function fixNum(t){ return t.replace(/(\d)[oO](?=\d|\b)/g,'$10').replace(/(\d)[oO](?=\d|\b)/g,'$10').replace(/(\d)[lI|](?=\d)/g,'$11').replace(/(^|\s)[oO](?=\d)/g,'$10').replace(/(\d),(?=\d{3}\b)/g,'$1').replace(/(\d),(?=\d{2},)/g,'$1').replace(/(\d),(?=\d{3})/g,'$1'); }
  var LOOK = {s:'5',S:'5',o:'0',O:'0',l:'1',I:'1','|':'1','!':'1',B:'8',z:'2',Z:'2',G:'6',b:'6',g:'9',q:'9',Y:'4',y:'4','¢':'6',D:'0',Q:'0',T:'7'};
  /* a token that is mostly digits with a few look-alike letters is a number ("2s6" -> 256, "Y4o" -> 440); never touches real words */
  function fixLook(t){ return t.split(/(\s+)/).map(function(w){ var core = w.replace(/^[(\[{]+|[)\]}.,:;]+$/g, '').replace(/\/-$/, ''), d = (core.match(/\d/g) || []).length;
      if(d >= 1 && core.length >= 2 && core.length <= 7 && !/^\d+(\.\d+)?(g|l|L|gm)$/.test(core) && /^[0-9sSoOlI|!BzZGbgqYy¢DQT.,]+$/.test(core) && d >= core.length - 2 && !/^\d+$/.test(core)){ var f = core.split('').map(function(ch){ return LOOK[ch] || ch; }).join(''); return w.replace(core, f); }
      return w; }).join(''); }
  function toks(line){ var out = []; var re = /(\d+(?:\.\d+)?)\s*([a-zA-Z]{1,6}\b)?|([^\s\d]+)/g, m;
    var s = fixNum(fixLook(line.replace(/[₹]|rs\.?(?=\s*\d)/gi,' ').replace(/(\d)\s*\/-/g,'$1 ').replace(/\b([SsGOoIlZB])\s*(kg|kq|kgs|ltr|lit|l|pkt|nos)\b/g, function(m0, a, u){ return (LOOK[a] || a) + ' ' + u; }))); while((m = re.exec(s))){
      if(m[1] != null){ var u = m[2] && UNITS[m[2].toLowerCase()] ? UNITS[m[2].toLowerCase()] : null; out.push({num:+m[1], u:u, txt:m[0], i:m.index}); if(m[2] && !u){ out.push({w:m[2], i:m.index + m[0].length - m[2].length}); } }
      else out.push({w:m[3], i:m.index}); }
    return out; }
  var CONF = {'0':'689','1':'74','2':'783','3':'85','4':'91','5':'63','6':'508','7':'12','8':'3062','9':'40'};
  /* every number one handwriting slip away: one digit swapped for a look-alike, or one stray digit removed */
  function edits(n){ var t = String(n), out = {}; if(!/^\d+(\.\d+)?$/.test(t)) return []; for(var i = 0; i < t.length; i++){ var c = t[i], alt = CONF[c] || '';
      for(var k = 0; k < alt.length; k++){ var x = t.slice(0, i) + alt[k] + t.slice(i + 1); if(!/^0\d/.test(x)) out[x] = 1; }
      if(t.length >= 2 && c !== '.'){ var y = t.slice(0, i) + t.slice(i + 1); if(y && !/^0\d/.test(y) && !/^\./.test(y)) out[y] = 1; } }
    return Object.keys(out).map(Number).filter(function(v){ return v > 0 && v !== +t; }); }
  /* 'YYYY-MM-DD' only for a real calendar day (31/02 or a 3-digit year is no date), else '' */
  function isoDay(y, m, d){ y = +y; m = +m; d = +d; var t = new Date(Date.UTC(y, m - 1, d)); return y >= 1000 && y <= 9999 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : ''; }
  function isoOf(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim()); return m ? isoDay(m[1], m[2], m[3]) : ''; }
  function near(a, b){ return Math.abs(a - b) <= Math.max(1.01, 0.02 * Math.abs(b)); }
  /* -> {raw, q, u, r, a, ok, how}. how: '3' qty, rate and amount all read and they agree · '2' qty + amount read, rate worked out ·
     'mm' qty x rate != amount (one of them misread; alt = qty x rate) · '1' only an amount */
  function parseLine(line){ var T = toks(line), N = T.filter(function(t){ return t.num != null; }); if(!N.length) return null;
    var last = N[N.length - 1]; if(last.u) return null;   /* "Onion 25kg" with no amount is not a line we can trust */
    if(!(last.num >= 1 && last.num <= 300000)) return null;
    var firstW = T.findIndex(function(t){ return t.w && /[a-z]{2,}/i.test(t.w); }); if(firstW < 0) return null;
    var a = last, q = null, r = null, how = '1', B = N.slice(0, -1);
    /* 1. a number written with a unit (10 kg, 2 L, 5 pkt) is the qty */
    var qu = B.filter(function(t){ return t.u; }); if(qu.length) q = qu[qu.length - 1];
    if(q){ var mid = B.filter(function(t){ return t.i > q.i; });
      if(mid.length){ var rr = mid.find(function(t){ return near(q.num * t.num, a.num); }); if(rr){ r = rr; how = '3'; } else { r = mid[mid.length - 1]; how = 'mm'; } }
      else { r = {num:+(a.num / (q.num || 1)).toFixed(2)}; how = '2'; } }
    else {
      /* 2. no unit: look for qty x rate = amount among the numbers before the amount */
      for(var i = B.length - 1; i >= 0 && !r; i--) for(var j = i - 1; j >= 0; j--){ if(near(B[j].num * B[i].num, a.num)){ q = B[j]; r = B[i]; how = '3'; break; } }
      if(!r && B.length >= 2){ q = B[B.length - 2]; r = B[B.length - 1]; how = 'mm'; }
      else if(!r && B.length === 1){ var p = B[0]; if(p.num < a.num / 2){ q = p; r = {num:+(a.num / (p.num || 1)).toFixed(2)}; how = '2'; } } }
    if(how === 'mm' && !(q.num > 0 && q.num < 10000 && r.num > 0)) { q = null; r = null; how = '1'; }
    var qi = q && q.i != null ? q.i : a.i, name = T.filter(function(t){ return t.i < qi && (t.w || t.num != null); }).map(function(t){ return t.w != null ? t.w : t.txt; }).join(' ')
      .replace(/\s+x\s*$/i,'').replace(/[:\-–=@*#|]+\s*$/,'').replace(/^[^a-z0-9]+/i,'').replace(/\s+\d+(\.\d+)?$/,'').trim();
    if(!/[a-z]{2,}/i.test(name) || !wordy(name)) return null;
    var u = (q && q.u) || null; if(!u && q){ var after = T.find(function(t){ return t.i > q.i && t.w; }); if(after && UNITS[after.w.toLowerCase()] && (!r || after.i < (r.i || 1e9))) u = UNITS[after.w.toLowerCase()]; }
    var o = {raw:name, q:q ? q.num : 1, u:u || 'nos', r:r ? r.num : a.num, a:a.num, ok:how === '3', how:how};
    if(how === 'mm'){ o.alt = Math.round(q.num * r.num * 100) / 100; o.altR = +(a.num / (q.num || 1)).toFixed(2);
      /* one slip in the RATE or QTY that makes the three numbers agree, with the amount as read: the line proves itself */
      var r2 = edits(r.num).filter(function(v){ return near(q.num * v, a.num); }), q2 = edits(q.num).filter(function(v){ return near(v * r.num, a.num); });
      var aE = edits(a.num).some(function(v){ return near(v, o.alt); }) || edits(Math.round(o.alt)).some(function(v){ return near(v, a.num); });   /* 130 vs 180, 440 vs 1440 */
      if((r2.length === 1 || q2.length === 1) && !aE){ if(r2.length === 1){ o.readR = o.r; o.r = r2[0]; } else { o.readQ = o.q; o.q = q2[0]; } o.how = 'self'; o.ok = true; }
      else if(aE){ o.sugA = o.alt; if(r2.length || q2.length) o.amb = 1; }   /* the amount is one slip from qty x rate: suggest it (amb = a rate slip would also fit), the total decides */ }
    return o; }
  /* opt.lines = [{t, c}] from the reader: each line with its confidence (unsure words already removed) */
  function parse(text, opt){ opt = opt || {}; var CL = opt.lines && opt.lines.length ? opt.lines : null;
    var L = CL ? CL.map(function(x){ return x.t; }) : String(text || '').split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean), out = {supplier:'', date:'', billNo:'', lines:[], total:null, isBill:false, why:'', dropped:0};
    var seenItem = false;
    L.forEach(function(l, idx){ var lc = CL ? CL[idx].c : 90; if(RX_JUNK.test(l)){ if(/\d/.test(l)) out.dropped++; return; }
      var d = l.match(RX_DATE); if(d && !out.date){ var y = +d[3]; if(y < 100) y += 2000; out.date = isoDay(y, d[2], d[1]); }
      var bn = l.match(/\b(?:bill|inv(?:oice)?|receipt)\s*(?:no\.?|number|#)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-\/]{0,12})/i) || (!seenItem && l.match(/^\s*no\.?\s*[:#]?\s*(\d{1,8})\b/i)); if(bn && !out.billNo && !/^\d{1,2}[\/\-.]/.test(bn[1])) out.billNo = bn[1];
      if(RX_TOTAL.test(l) && /\d/.test(l)){ var n = toks(l).filter(function(t){ return t.num != null && !t.u; }); if(n.length) out.total = n[n.length - 1].num; return; }
      var headerish = RX_DATE.test(l) || /\b\d{1,2}:\d{2}\b/.test(l) || (bn && !seenItem) || RX_OURS.test(l) || (!seenItem && /\b\d{1,2}\s*[\/\-.]\s*\d{1,2}\b/.test(l) && !/\d\s*(kg|ltr|l|pkt|nos)\b/i.test(l));   /* a date / time / bill-no / "Hayat" line is never an item */
      if(!out.date && !seenItem){ var d2 = l.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\b/); if(d2 && opt.year) out.date = isoDay(opt.year, d2[2], d2[1]); }
      var it = !headerish && (!RX_SKIP.test(l) || /\d+\s*(kg|ltr|l|pkt|nos)\b/i.test(l)) ? parseLine(l) : null;
      if(it){ if(lc < 55){ out.dropped++; return; } it.conf = Math.round(lc); seenItem = true; out.lines.push(it); return; }
      if(!headerish && /\d/.test(l) && /[a-z]{3,}/i.test(l) && seenItem) out.dropped++;
      if(!seenItem && !out.supplier && /[a-z]{3,}/i.test(l) && !RX_SKIP.test(l) && !RX_DATE.test(l) && !RX_OURS.test(l) && !/\d{5,}/.test(l) && !/\b(bill|inv|no)\b/i.test(l)) out.supplier = titleCase(l.replace(/[^a-z0-9&.' -]/gi,' ').replace(/\s+/g,' '));
    });
    /* the last line before the end that is ONLY a number and equals the lines = the total, even when the word "Total" was not read */
    if(out.total == null && out.lines.length >= 2){ var lt = out.lines[out.lines.length - 1], rest = out.lines.slice(0, -1).reduce(function(n, x){ return n + x.a; }, 0); if(lt.how === '1' && Math.abs(rest - lt.a) <= 1.01 && !/[a-z]{4,}/i.test(lt.raw.replace(/t[o0]?ta?l?/i, ''))){ out.total = lt.a; out.lines.pop(); } }
    repair(out);
    var sum = out.lines.reduce(function(n, x){ return n + x.a; }, 0); out.sum = Math.round(sum * 100) / 100;
    out.isBill = out.lines.length >= 2 || (out.lines.length >= 1 && out.total != null);
    out.why = out.isBill ? '' : (out.lines.length ? 'only one line and no total' : 'no item lines with amounts');
    out.totalOk = out.total != null ? Math.abs(sum - out.total) <= 1.01 : null;   /* the lines must add up to the bill total exactly (₹1 for paise) — 0.5% let a ₹230 misread through */
    out.rounded = out.total != null && !out.totalOk && Math.abs(sum - out.total) <= 10;
    return out; }
  /* a misread amount is fixed ONLY when the bill total proves it: each line where qty x rate != amount may take qty x rate instead;
     if exactly one choice of those makes the lines equal the total, use it. The bill total is the referee, never a guess. */
  function repair(out){ if(out.total == null || !out.lines.length) return; var L = out.lines;
    var base = L.reduce(function(n, l){ return n + l.a; }, 0); if(Math.abs(base - out.total) <= 1.01) return;   /* already adds up */
    /* choices per doubtful line (cost = how unlikely): mm lines may be right as read or = qty x rate; the bill total may itself have one slip */
    var U = [], C = [];
    var nice = function(v){ return Math.abs(v * 4 - Math.round(v * 4)) < 0.01; };   /* rates are whole rupees, halves or quarters */
    L.forEach(function(l, i){ if(l.how === 'mm'){ var c = [{a:l.alt, c:l.sugA != null ? (l.amb ? 1 : 0.5) : 1.5, k:'a'}]; if(nice(l.altR)) c.push({a:l.a, c:1.5, k:'r'}); U.push(i); C.push(c); } });
    if(!U.length || U.length > 10) return;
    var tE = edits(out.total), best = null, ties = 0;
    var tMatch = function(s){ if(Math.abs(s - out.total) <= 1.01) return {t:out.total, c:0}; var r = Math.round(s); if(Math.abs(r - s) < 0.01 && (tE.indexOf(r) >= 0 || edits(r).indexOf(out.total) >= 0)) return {t:r, c:2}; return null; };   /* the total itself may have one slip (8105 read as 810) */
    var n = 1; C.forEach(function(c){ n *= c.length; }); if(n > 5000) return;
    for(var k = 0; k < n; k++){ var s = base, cost = 0, x = k, pick = []; for(var u = 0; u < U.length; u++){ var ch = C[u][x % C[u].length]; x = Math.floor(x / C[u].length); s += ch.a - L[U[u]].a; cost += ch.c; pick.push(ch); }
      var T = tMatch(s); if(T){ var c2 = cost + T.c; if(!best || c2 < best.c - 1e-9){ best = {c:c2, pick:pick, t:T.t}; ties = 0; } else if(Math.abs(c2 - best.c) < 1e-9) ties++; } }
    if(!best || ties) return;   /* no answer, or two equally good answers: leave it to the person */
    var weak = best.pick.filter(function(ch){ return ch.c > 0.5; }).length;
    if(best.t !== out.total && weak) return;   /* the total may only be corrected when every line change is one clear slip */
    if(weak > 1) return;   /* at most ONE line resting on a weaker guess */
    if(best.t !== out.total){ out.totalRead = out.total; out.total = best.t; }
    best.pick.forEach(function(ch, u){ var l = L[U[u]]; if(ch.k === 'a'){ l.read = l.a; l.a = ch.a; l.how = 'fix'; } else { l.readR = l.r; l.r = l.altR; l.how = 'fixr'; } l.ok = true; }); }

  /* how sure are we? used to decide on the AI fallback */
  function sure(p, conf){ if(!p.isBill) return 0; var s = Math.min(1, (conf || 70) / 100);
    if(p.totalOk === false) s -= 0.3; if(p.totalOk === true) s += 0.1;
    var weak = p.lines.filter(function(l){ return !(l.ok || l.how === 'fix' || l.how === 'fixr') || ((l.conf || 90) < 75 && l.how !== '3'); }).length / Math.max(1, p.lines.length); s -= 0.3 * weak;
    if(p.total == null) s -= 0.15; if(p.dropped) s -= Math.min(0.3, 0.06 * p.dropped);
    return Math.max(0, Math.min(1, s)); }

  /* ---------- the free reader (browser): bundled Tesseract, loaded only when first needed ---------- */
  var BASE = (root.document && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^\/]*$/, '') : './';
  var WORKER = null;
  function loadScript(src){ return new Promise(function(ok, no){ var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function(){ no(new Error('could not load ' + src)); }; document.head.appendChild(s); }); }
  async function ocr(img, onProg){
    if(!root.Tesseract) await loadScript(BASE + 'assets/ocr/tesseract.min.js');
    if(!WORKER){ WORKER = await root.Tesseract.createWorker('eng', 1, {workerPath:BASE + 'assets/ocr/worker.min.js', corePath:BASE + 'assets/ocr/', langPath:BASE + 'assets/ocr/', gzip:true,
      logger:function(m){ if(onProg && m && typeof m.progress === 'number') onProg(m.status || '', m.progress); }}); }
    var src = img; try{ src = await prep(img); }catch(e){}
    var r = await WORKER.recognize(src), d = r.data;
    return {text:d.text, conf:d.confidence, lines:ocrLines(d)}; }
  /* the reader's lines with their confidence. Faint SYMBOLS / NUMBERS are dropped ("{1", "90:4.", a number read at 4%);
     a faint WORD is kept (it may be the item name, e.g. "Inji" at 39%) but the line is then marked "check" (confidence capped at 62) */
  function ocrLines(d){ return (d.lines || []).map(function(l){ var ws = l.words || [], hasNum = ws.some(function(w){ return w.confidence >= 60 && /\d/.test(w.text); });
      var W = ws.filter(function(w){ return w.confidence >= 45 || (hasNum && (/^[a-z]{3,}$/i.test(w.text) || UNITS[String(w.text).toLowerCase().replace(/[^a-z]/g,'')] || (/\d/.test(w.text) && w.confidence >= 25))); });   /* faint words only survive on item lines (names, units, amounts in handwriting) */
      var t = W.map(function(w){ return w.text; }).join(' ').trim(), c = W.length ? W.reduce(function(n, w){ return n + w.confidence; }, 0) / W.length : 0;
      if(W.some(function(w){ return w.confidence < 45; })) c = Math.min(c, 62); return {t:t, c:c}; }).filter(function(x){ return x.t; }); }
  /* a phone photo: make small text bigger, drop the colour, stretch the contrast (shadows and yellow paper read better) */
  async function prep(dataUrl){ var im = await new Promise(function(ok, no){ var i = new Image(); i.onload = function(){ ok(i); }; i.onerror = no; i.src = dataUrl; });
    var k = Math.max(1, Math.min(2, 1800 / Math.max(im.width, im.height))), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    var g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height); var D = g.getImageData(0, 0, c.width, c.height), a = D.data, H = new Array(256).fill(0), n = a.length / 4;
    for(var i = 0; i < a.length; i += 4){ var y = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0; a[i] = y; H[y]++; }
    var lo = 0, hi = 255, acc = 0; for(; lo < 255 && (acc += H[lo]) < n * 0.02; lo++); acc = 0; for(; hi > 0 && (acc += H[hi]) < n * 0.02; hi--);
    var sc = 255 / Math.max(1, hi - lo); for(var j = 0; j < a.length; j += 4){ var v = Math.max(0, Math.min(255, (a[j] - lo) * sc)); a[j] = a[j + 1] = a[j + 2] = v; }
    g.putImageData(D, 0, 0); return c.toDataURL('image/png'); }
  /* the AI reader: POST the photo to OUR Cloudflare Worker (it holds the key). hints help it name things our way */
  async function ai(img, url, hints){ var res = await fetch(url, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({image:img, items:(hints && hints.items) || [], suppliers:(hints && hints.suppliers) || [], cats:CATS})});
    if(!res.ok) throw new Error('AI reader: ' + res.status); var j = await res.json(); if(j.error) throw new Error(j.error);
    return {supplier:j.supplier || '', date:isoOf(j.date), billNo:j.bill_no || j.billNo || '', total:j.total != null ? +j.total : null, isBill:j.is_bill !== false, why:j.why || '',
      lines:(j.lines || []).map(function(l){ var q = +l.qty || 1, a = +l.amount || 0, rw = l.rate_written != null ? +l.rate_written : (+l.rate || 0), r = rw || (q ? a / q : 0), how;
        /* the AI can misread or invent too: its numbers must prove themselves like the free reader's (qty x rate = amount, or the bill total) */
        if(!a) how = '1'; else if(rw && near(q * rw, a)) how = '3'; else if(rw && q) how = 'mm'; else how = '2';
        var o = {raw:l.raw || l.name || '', name:l.name || '', cat:l.category || '', q:q, u:UNITS[String(l.unit || '').toLowerCase()] || l.unit || 'nos', r:+(+r).toFixed(2), a:a || +(q * r).toFixed(2), ok:how === '3', how:how, conf:l.unsure ? 50 : 80};
        if(how === 'mm'){ o.alt = Math.round(q * rw * 100) / 100; o.altR = +(a / q).toFixed(2); if(edits(a).some(function(v){ return near(v, o.alt); }) || edits(Math.round(o.alt)).some(function(v){ return near(v, a); })) o.sugA = o.alt; }
        return o; })}; }
  /* the whole read: free first; the AI only if the free read is unsure (and a reader URL is set) */
  async function read(img, opt){ opt = opt || {}; var prog = opt.onProg || function(){};
    var p = null, conf = 0, via = 'free';
    try{ prog('Reading on this phone…', 0); var o = await ocr(img, function(s, f){ prog('Reading on this phone… ' + Math.round(f * 100) + '%', f); }); conf = o.conf; p = parse(o.text, {lines:o.lines, year:new Date().getFullYear()}); p.text = o.text; p.cl = o.lines.map(function(x){ return x.t + ' @' + Math.round(x.c); }); }catch(e){ p = {isBill:false, lines:[], why:'free reader failed: ' + e.message}; }
    var sc = sure(p, conf);
    if(sc < (opt.minSure || 0.7) && opt.aiUrl){ try{ prog('Asking the AI reader…', 0.9); var A = await ai(img, opt.aiUrl, {items:Object.values(opt.items || {}).map(function(i){ return i.n; }), suppliers:opt.suppliers || []}); repair(A); A.sum = A.lines.reduce(function(n, l){ return n + l.a; }, 0); A.totalOk = A.total != null ? Math.abs(A.sum - A.total) <= 1.01 : null; A.rounded = A.total != null && !A.totalOk && Math.abs(A.sum - A.total) <= 10; p = A; via = 'ai'; sc = A.isBill ? 0.9 : 0; }catch(e){ p.aiError = e.message; } }
    p.via = via; p.sure = sc; p.conf = conf;
    (p.lines || []).forEach(function(l){ var m = match(l.name || l.raw, {items:opt.items, alias:opt.alias, u:l.u}); if(l.name && via === 'ai' && m.score < 0.82){ m = {n:titleCase(l.name), c:l.cat || guessCat(l.name, l.u), score:0.8, via:'ai', raw:l.raw}; } l.m = m; });
    return p; }


  /* ---------- SPEAK THE BILL: one spoken line -> one bill line ("thakkali pathu kilo 320", "തക്കാളി പത്ത് കിലോ മുന്നൂറ്റി ഇരുപത്") ---------- */
  var ML_NAMES = [['തക്കാളി','tomato'],['സവാള','onion'],['ചെറിയ ഉള്ളി','small onion'],['ചുവന്നുള്ളി','small onion'],['ഉള്ളി','small onion'],['ഇഞ്ചി','ginger'],['വെളുത്തുള്ളി','garlic'],['പച്ചമുളക്','green chilli'],['പച്ച മുളക്','green chilli'],
    ['മല്ലിയില','coriander leaves'],['കറിവേപ്പില','curry leaves'],['പുതിന','mint'],['ഉരുളക്കിഴങ്ങ്','potato'],['കാരറ്റ്','carrot'],['ബീറ്റ്റൂട്ട്','beetroot'],['കാബേജ്','cabbage'],['ബീൻസ്','beans'],['നാരങ്ങ','lemon'],['വെള്ളരി','cucumber'],['കാപ്സിക്കം','capsicum'],['വഴുതന','brinjal'],['വെണ്ടക്ക','lady finger'],['മുരിങ്ങക്ക','drumstick'],['തേങ്ങ','coconut'],
    ['ചിക്കൻ','chicken'],['കോഴി','chicken'],['കരൾ','liver'],['ബീഫ്','beef'],['പോത്ത്','beef'],['മട്ടൻ','mutton'],['ആട്','mutton'],['മത്തി','sardine'],['ചാള','sardine'],['അയല','mackerel'],['നെയ്മീൻ','king fish'],['ചെമ്മീൻ','prawns'],['കൂന്തൽ','squid'],['കണവ','squid'],['ആവോലി','pomfret'],['മീൻ','fish'],['മുട്ട','eggs'],
    ['പഞ്ചസാര','sugar'],['ഉപ്പ്','salt'],['അരി','rice'],['ബസുമതി','basmati rice'],['മൈദ','maida'],['ആട്ട','atta'],['റവ','rava'],['ചായപ്പൊടി','tea powder'],['ചായ പൊടി','tea powder'],['എണ്ണ','oil'],['വെളിച്ചെണ്ണ','coconut oil'],['സൺഫ്ലവർ','sunflower oil'],['നെയ്യ്','ghee'],['പാൽ','milk'],['തൈര്','curd'],
    ['മുളകുപൊടി','chilli powder'],['മുളക് പൊടി','chilli powder'],['മഞ്ഞൾ','turmeric powder'],['മല്ലിപ്പൊടി','coriander powder'],['ഗ്യാസ്','gas cylinder'],['കവർ','parcel cover'],['ടിഷ്യു','tissue'],['ഐസ്','ice']];
  var ML_UNITS = [['കിലോ','kg'],['കി.ഗ്രാ','kg'],['ഗ്രാം','g'],['ലിറ്റർ','L'],['ലിറ്റര്','L'],['എണ്ണം','nos'],['പാക്കറ്റ്','pkt'],['പെട്ടി','box'],['ചാക്ക്','bag'],['കെട്ട്','bundle'],['കുപ്പി','bottle'],['ട്രേ','tray'],['രൂപ',''],['റുപ്പീസ്','']];
  /* number words: [word, value, kind] kind 1 = units/teens, 10 = tens, 100 = hundreds, 1000 = thousands ("x thousand") */
  var NUMW = (function(){ var L = [];
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ').forEach(function(w, i){ L.push([w, i, 1]); });
    'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ').forEach(function(w, i){ L.push([w, 20 + 10 * i, 10]); });
    L.push(['hundred', 100, 'h'], ['thousand', 1000, 'k'], ['lakh', 100000, 'k'], ['half', 0.5, 1]);
    /* Manglish */
    [['onnu',1],['oru',1],['randu',2],['rendu',2],['moonu',3],['munnu',3],['naalu',4],['nalu',4],['anchu',5],['aaru',6],['aru',6],['ezhu',7],['ettu',8],['ombathu',9],['onpathu',9],['pathu',10],['pathinonnu',11],['panthrandu',12],['pathimoonu',13],['pathinalu',14],['pathinanchu',15],['pathinaaru',16],['pathinezhu',17],['pathinettu',18],['pathombathu',19],['ara',0.5],['kaal',0.25],['onnara',1.5],['randara',2.5],['moonara',3.5],['yonnu',1],['yanchu',5],['yaaru',6],['yezhu',7],['yettu',8],['yombathu',9]].forEach(function(x){ L.push([x[0], x[1], 1]); });
    [['irupathu',20],['muppathu',30],['nalpathu',40],['ambathu',50],['anpathu',50],['arupathu',60],['ezhupathu',70],['enpathu',80],['embathu',80],['thonnooru',90]].forEach(function(x){ L.push([x[0], x[1], 10]); L.push([x[0].replace(/u$/, 'i'), x[1], 10]); L.push([x[0].replace(/u$/, 'iya'), x[1], 10]); });
    [['nooru',100],['irunooru',200],['munnooru',300],['naanooru',400],['nanooru',400],['annooru',500],['arunooru',600],['ezhunooru',700],['ennooru',800],['thollayiram',900]].forEach(function(x){ L.push([x[0], x[1], 100]); ['ti','tti','tiya','ttiya'].forEach(function(e){ L.push([x[0].replace(/ru$/, e).replace(/m$/, 'thi'), x[1], 100]); L.push([x[0].replace(/ooru$/, 'oo' + e), x[1], 100]); }); });
    [['aayiram',1000],['ayiram',1000],['randayiram',2000],['moovayiram',3000],['naalayiram',4000],['ayyayiram',5000],['aarayiram',6000],['ezhayiram',7000],['ennayiram',8000],['ombathinayiram',9000],['pathinayiram',10000]].forEach(function(x){ L.push([x[0], x[1], 1000]); L.push([x[0].replace(/m$/, 'thi'), x[1], 1000]); L.push([x[0].replace(/m$/, 'thiya'), x[1], 1000]); });
    /* Malayalam script (with the joining forms used inside a number) */
    [['ഒന്ന്',1],['ഒരു',1],['രണ്ട്',2],['മൂന്ന്',3],['നാല്',4],['അഞ്ച്',5],['ആറ്',6],['ഏഴ്',7],['എട്ട്',8],['ഒമ്പത്',9],['ഒൻപത്',9],['പത്ത്',10],['പതിനൊന്ന്',11],['പന്ത്രണ്ട്',12],['പതിമൂന്ന്',13],['പതിനാല്',14],['പതിനഞ്ച്',15],['പതിനാറ്',16],['പതിനേഴ്',17],['പതിനെട്ട്',18],['പത്തൊമ്പത്',19],['അര',0.5],['കാൽ',0.25],['ഒന്നര',1.5],['രണ്ടര',2.5],
     ['യൊന്ന്',1],['യഞ്ച്',5],['യാറ്',6],['യേഴ്',7],['യെട്ട്',8],['യൊമ്പത്',9]].forEach(function(x){ L.push([x[0], x[1], 1]); });
    [['ഇരുപത്',20],['മുപ്പത്',30],['നാല്പത്',40],['നാൽപത്',40],['അമ്പത്',50],['അൻപത്',50],['അറുപത്',60],['എഴുപത്',70],['എൺപത്',80],['എമ്പത്',80],['തൊണ്ണൂറ്',90]].forEach(function(x){ L.push([x[0], x[1], 10]); L.push([x[0].replace(/ത്$/, 'ത്തി'), x[1], 10]); L.push([x[0].replace(/റ്$/, 'റ്റി'), x[1], 10]); });
    [['നൂറ്',100],['ഇരുനൂറ്',200],['മുന്നൂറ്',300],['നാനൂറ്',400],['അഞ്ഞൂറ്',500],['അറുനൂറ്',600],['എഴുനൂറ്',700],['എണ്ണൂറ്',800],['തൊള്ളായിരം',900]].forEach(function(x){ L.push([x[0], x[1], 100]); L.push([x[0].replace(/റ്$/, 'റ്റി').replace(/ം$/, 'ത്തി'), x[1], 100]); });
    [['ആയിരം',1000],['രണ്ടായിരം',2000],['മൂവായിരം',3000],['നാലായിരം',4000],['അയ്യായിരം',5000],['ആറായിരം',6000],['ഏഴായിരം',7000],['എണ്ണായിരം',8000],['ഒമ്പതിനായിരം',9000],['പതിനായിരം',10000]].forEach(function(x){ L.push([x[0], x[1], 1000]); L.push([x[0].replace(/ം$/, 'ത്തി'), x[1], 1000]); });
    return L.sort(function(a, b){ return b[0].length - a[0].length; }); })();
  /* a run of number words -> digits: "munnootti irupathu" = 320, "two thousand four hundred fifty" = 2450, "മുന്നൂറ്റി ഇരുപത്തിയഞ്ച്" = 325 */
  function wordsToNum(seq){ var total = 0, cur = 0, any = false; seq.forEach(function(x){ any = true; if(x[2] === 'h'){ cur = (cur || 1) * 100; } else if(x[2] === 'k'){ total += (cur || 1) * x[1]; cur = 0; } else if(x[2] === 1000){ total += x[1]; } else cur += x[1]; }); return any ? total + cur : null; }
  function splitNumWord(w){ var go = function(rest, d){ if(!rest) return []; if(d > 6) return null; for(var i = 0; i < NUMW.length; i++){ if(rest.indexOf(NUMW[i][0]) === 0){ var tail = go(rest.slice(NUMW[i][0].length).replace(/^(-|and|um)/, ''), d + 1); if(tail) return [NUMW[i]].concat(tail); } } return null; };   /* tries every split: "irupathi|yanchu" */
    return go(String(w).toLowerCase(), 0); }
  function spokenToText(t){ var s = ' ' + String(t || '').replace(/[,]/g, ' ') + ' ';
    ML_NAMES.forEach(function(x){ s = s.split(x[0]).join(' ' + x[1] + ' '); }); ML_UNITS.forEach(function(x){ s = s.split(x[0]).join(' ' + x[1] + ' '); });
    s = s.replace(/\b(kilo|kilos|kilogram|kilograms|kg)\b/gi, ' kg ').replace(/\b(litre|litres|liter|liters)\b/gi, ' L ').replace(/\b(rupees?|rs|roopa|rupa)\b/gi, ' ').replace(/\b(at|rate|each|per kilo|per kg)\b/gi, ' ');
    var W = s.split(/\s+/).filter(Boolean), out = [], run = [];
    var flush = function(){ if(run.length){ var v = wordsToNum(run); if(v != null) out.push(String(+v.toFixed(2))); run = []; } };
    W.forEach(function(w){ if(/^\d+(\.\d+)?$/.test(w)){ flush(); out.push(w); return; } if(/^(and|um)$/i.test(w) && run.length) return;
      var parts = splitNumWord(w); if(parts){ /* a new number starts when the run already has units and this word is not a bigger place */
        if(run.length && parts[0][2] !== 'h' && parts[0][2] !== 'k' && run[run.length - 1][2] === 1 && parts[0][2] !== 1) flush();
        else if(run.length && run[run.length - 1][2] === 1 && parts[0][2] === 1 && !(run[run.length - 1][1] === 0.5)) flush();
        run = run.concat(parts); return; }
      flush(); out.push(w); }); flush();
    return out.join(' ').replace(/\s+/g, ' ').trim(); }
  function parseSpoken(t){ var x = spokenToText(t), l = parseLine(x); if(!l){ var m = x.match(/^(.*?)(\d+(\.\d+)?)\s*(kg|g|L|nos|pkt|box|bag|bundle|bottle|tray)?\s*$/i); if(m && /[a-z]{2,}/i.test(m[1])) l = {raw:m[1].trim(), q:1, u:'nos', r:+m[2], a:+m[2], ok:false, how:'1'}; }
    if(l){ l.spoken = t; l.text = x; } return l; }
  /* "kozhi pathu kilo, ari irupathiyanchu kilo" / "12 kg chicken" -> [{raw, q, u}] : quantities only (kitchen release, closing count).
     "nothing / illa / theernnu / kaali" = 0. Several items in one breath are split at each number. */
  var ZERO = /^(nothing|none|zero|nil|illa|onnumilla|onnum|theernnu|theernu|theerno|kaali|kali|empty|finished|over)$/i;
  var FILL = /^(baaki|baki|balance|left|remaining|undu|und|ullathu|kodukku|kodukkuka|release|give|send|kitchen|store|ottu|count|is|are|have|we|still|in|the)$/i;
  function parseQtys(t){ var x = spokenToText(t).replace(/[.,;]+(\s|$)/g, ' ').trim(), W = x.split(/\s+/).filter(Boolean), out = [], name = [], q = null, u = null, pend = null;
    function emit(){ var raw = name.join(' ').trim(); if(raw && /[a-z]{2,}/i.test(raw) && q != null) out.push({raw:raw, q:q, u:u}); name = []; q = null; u = null; }
    for(var i = 0; i < W.length; i++){ var w = W[i], lw = w.toLowerCase();
      if(/^\d+(\.\d+)?$/.test(w) || ZERO.test(lw)){ var v = ZERO.test(lw) ? 0 : +w;
        if(name.length && q == null){ q = v; var nx = (W[i + 1] || '').toLowerCase(); if(UNITS[nx]){ u = UNITS[nx]; i++; } if(FILL.test((W[i + 1] || '').toLowerCase())) i++; emit(); }
        else if(!name.length){ pend = {q:v, u:null}; var nx2 = (W[i + 1] || '').toLowerCase(); if(UNITS[nx2]){ pend.u = UNITS[nx2]; i++; } }
        continue; }
      if(FILL.test(lw)) continue;
      if(pend && !name.length){ name.push(w); var j = i + 1; while(j < W.length && !/^\d/.test(W[j]) && !ZERO.test(W[j]) && !FILL.test(W[j]) && !UNITS[W[j].toLowerCase()]) name.push(W[j++]); q = pend.q; u = pend.u; pend = null; i = j - 1; emit(); continue; }
      name.push(w); }
    return out; }
  var API = {parseQtys:parseQtys, spokenToText:spokenToText, parseSpoken:parseSpoken, edits:edits, repair:repair, fixLook:fixLook, CATS:CATS, DICT:DICT, norm:norm, slug:slug, titleCase:titleCase, lev:lev, tokSim:tokSim, phraseSim:phraseSim, match:match, parse:parse, ocrLines:ocrLines, parseLine:parseLine, sure:sure, guessCat:guessCat, ocr:ocr, ai:ai, read:read};
  if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.StockRead = API;
})(typeof window !== 'undefined' ? window : globalThis);
