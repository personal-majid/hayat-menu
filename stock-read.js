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
    pkt:'pkt',pkts:'pkt',packet:'pkt',pack:'pkt',box:'box',boxes:'box',tray:'tray',trays:'tray',bag:'bag',bags:'bag',tin:'tin',tins:'tin',btl:'bottle',bottle:'bottle',bottles:'bottle',cyl:'cyl',bundle:'bundle',dozen:'dozen',doz:'dozen',case:'case',crate:'crate'};

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
    var best = null, cat = catalog(opt.items);
    cat.forEach(function(it){ var s = phraseSim(raw, it.n), via = 'name'; it.al.forEach(function(a){ var v = phraseSim(raw, a); if(v > s){ s = v; via = 'alias'; } }); if(it.own) s += 0.02;
      if(!best || s > best.score) best = {n:it.n, c:it.c, score:Math.min(1, s), via:via, raw:raw}; });
    if(!best || best.score < 0.62){ var nm = titleCase(words(raw).join(' ') || raw); return {n:nm, c:guessCat(raw, opt.u), score:best ? best.score : 0, via:'new', raw:raw, near:best && best.score >= 0.5 ? best.n : ''}; }
    return best; }

  /* ---------- text -> bill ---------- */
  var RX_TOTAL = /\b(grand\s*total|net\s*amount|net\s*total|total\s*amount|amount\s*payable|bill\s*amount|total|net)\b/i;
  var RX_SKIP = /\b(gst|gstin|fssai|ph|phone|mob|mobile|tel|thank|visit|cash|change|balance|cgst|sgst|igst|tax|discount|round|qty|rate|amount|particulars|item|description|sl\b|s\.no|address)\b/i;
  var RX_DATE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  /* OCR look-alikes inside numbers (no lookbehind: older iPhones cannot parse it) */
  function fixNum(t){ return t.replace(/(\d)[oO](?=\d|\b)/g,'$10').replace(/(\d)[oO](?=\d|\b)/g,'$10').replace(/(\d)[lI|](?=\d)/g,'$11').replace(/(^|\s)[oO](?=\d)/g,'$10').replace(/(\d),(?=\d{3}\b)/g,'$1').replace(/(\d),(?=\d{2},)/g,'$1').replace(/(\d),(?=\d{3})/g,'$1'); }
  function toks(line){ var out = []; var re = /(\d+(?:\.\d+)?)\s*([a-zA-Z]{1,6}\b)?|([^\s\d]+)/g, m;
    var s = fixNum(line.replace(/[₹]|rs\.?(?=\s*\d)/gi,' ')); while((m = re.exec(s))){
      if(m[1] != null){ var u = m[2] && UNITS[m[2].toLowerCase()] ? UNITS[m[2].toLowerCase()] : null; out.push({num:+m[1], u:u, txt:m[0], i:m.index}); if(m[2] && !u){ out.push({w:m[2], i:m.index + m[0].length - m[2].length}); } }
      else out.push({w:m[3], i:m.index}); }
    return out; }
  function near(a, b){ return Math.abs(a - b) <= Math.max(1.01, 0.02 * Math.abs(b)); }
  function parseLine(line){ var T = toks(line), N = T.filter(function(t){ return t.num != null; }); if(!N.length) return null;
    var firstW = T.findIndex(function(t){ return t.w && /[a-z]{2,}/i.test(t.w); }); if(firstW < 0) return null;
    var a = N[N.length - 1], q = null, r = null;
    /* look for qty x rate = amount among the numbers before the amount */
    for(var i = N.length - 2; i >= 0 && !r; i--) for(var j = i - 1; j >= 0; j--){ if(near(N[j].num * N[i].num, a.num)){ q = N[j]; r = N[i]; break; } }
    if(!r && N.length >= 2){ var p = N[N.length - 2]; if(p.u || p.num < a.num / 2){ q = p; r = {num:+(a.num / (p.num || 1)).toFixed(2)}; } }
    var qi = q && q.i != null ? q.i : a.i, name = T.filter(function(t){ return t.i < qi && (t.w || t.num != null); }).map(function(t){ return t.w != null ? t.w : t.txt; }).join(' ').replace(/\s+x\s*$/i,'').replace(/[:\-–@*#|]+\s*$/,'').trim();
    if(!/[a-z]{2,}/i.test(name)) return null;
    var u = (q && q.u) || null; if(!u && q){ var after = T.find(function(t){ return t.i > q.i && t.w; }); if(after && UNITS[after.w.toLowerCase()] && (!r || after.i < (r.i || 1e9))) u = UNITS[after.w.toLowerCase()]; }
    return {raw:name, q:q ? q.num : 1, u:u || 'nos', r:r ? r.num : a.num, a:a.num, ok:!!(q && r && near(q.num * r.num, a.num))}; }
  function parse(text){ var L = String(text || '').split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean), out = {supplier:'', date:'', billNo:'', lines:[], total:null, isBill:false, why:''};
    var seenItem = false;
    L.forEach(function(l, idx){
      var d = l.match(RX_DATE); if(d && !out.date){ var y = +d[3]; if(y < 100) y += 2000; if(+d[2] >= 1 && +d[2] <= 12 && +d[1] >= 1 && +d[1] <= 31) out.date = y + '-' + String(d[2]).padStart(2,'0') + '-' + String(d[1]).padStart(2,'0'); }
      var bn = l.match(/\b(?:bill|inv(?:oice)?|receipt)\s*(?:no\.?|number|#)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-\/]{0,12})/i) || (!seenItem && l.match(/^\s*no\.?\s*[:#]?\s*(\d{1,8})\b/i)); if(bn && !out.billNo && !/^\d{1,2}[\/\-.]/.test(bn[1])) out.billNo = bn[1];
      if(RX_TOTAL.test(l) && /\d/.test(l)){ var n = toks(l).filter(function(t){ return t.num != null; }); if(n.length) out.total = n[n.length - 1].num; return; }
      var headerish = RX_DATE.test(l) || /\b\d{1,2}:\d{2}\b/.test(l) || (bn && !seenItem);   /* a date / time / bill-no line is never an item */
      var it = !headerish && (!RX_SKIP.test(l) || /\d+\s*(kg|ltr|l|pkt|nos)\b/i.test(l)) ? parseLine(l) : null;
      if(it){ seenItem = true; out.lines.push(it); return; }
      if(!seenItem && !out.supplier && /[a-z]{3,}/i.test(l) && !RX_SKIP.test(l) && !RX_DATE.test(l) && !/\d{5,}/.test(l) && !/\b(bill|inv|no)\b/i.test(l)) out.supplier = titleCase(l.replace(/[^a-z0-9&.' -]/gi,' ').replace(/\s+/g,' '));
    });
    var sum = out.lines.reduce(function(n, x){ return n + x.a; }, 0); out.sum = Math.round(sum * 100) / 100;
    out.isBill = out.lines.length >= 2 || (out.lines.length >= 1 && out.total != null);
    out.why = out.isBill ? '' : (out.lines.length ? 'only one line and no total' : 'no item lines with amounts');
    out.totalOk = out.total != null ? Math.abs(sum - out.total) <= Math.max(1.01, 0.005 * out.total) : null;   /* totals must agree closely: 6,642 vs 6,600 is a misread */
    return out; }

  /* how sure are we? used to decide on the AI fallback */
  function sure(p, conf){ if(!p.isBill) return 0; var s = Math.min(1, (conf || 70) / 100);
    if(p.totalOk === false) s -= 0.3; if(p.totalOk === true) s += 0.1;
    var weak = p.lines.filter(function(l){ return !l.ok; }).length / Math.max(1, p.lines.length); s -= 0.25 * weak;
    return Math.max(0, Math.min(1, s)); }

  /* ---------- the free reader (browser): bundled Tesseract, loaded only when first needed ---------- */
  var BASE = (root.document && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^\/]*$/, '') : './';
  var WORKER = null;
  function loadScript(src){ return new Promise(function(ok, no){ var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function(){ no(new Error('could not load ' + src)); }; document.head.appendChild(s); }); }
  async function ocr(img, onProg){
    if(!root.Tesseract) await loadScript(BASE + 'assets/ocr/tesseract.min.js');
    if(!WORKER){ WORKER = await root.Tesseract.createWorker('eng', 1, {workerPath:BASE + 'assets/ocr/worker.min.js', corePath:BASE + 'assets/ocr/', langPath:BASE + 'assets/ocr/', gzip:true,
      logger:function(m){ if(onProg && m && typeof m.progress === 'number') onProg(m.status || '', m.progress); }}); }
    var r = await WORKER.recognize(img); return {text:r.data.text, conf:r.data.confidence}; }
  /* the AI reader: POST the photo to OUR Cloudflare Worker (it holds the key). hints help it name things our way */
  async function ai(img, url, hints){ var res = await fetch(url, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({image:img, items:(hints && hints.items) || [], suppliers:(hints && hints.suppliers) || [], cats:CATS})});
    if(!res.ok) throw new Error('AI reader: ' + res.status); var j = await res.json(); if(j.error) throw new Error(j.error);
    return {supplier:j.supplier || '', date:j.date || '', billNo:j.bill_no || j.billNo || '', total:j.total != null ? +j.total : null, isBill:j.is_bill !== false, why:j.why || '',
      lines:(j.lines || []).map(function(l){ var q = +l.qty || 1, a = +l.amount || 0, r = +l.rate || (q ? a / q : 0); return {raw:l.raw || l.name || '', name:l.name || '', cat:l.category || '', q:q, u:UNITS[String(l.unit || '').toLowerCase()] || l.unit || 'nos', r:+r.toFixed(2), a:a || +(q * r).toFixed(2), ok:true}; })}; }
  /* the whole read: free first; the AI only if the free read is unsure (and a reader URL is set) */
  async function read(img, opt){ opt = opt || {}; var prog = opt.onProg || function(){};
    var p = null, conf = 0, via = 'free';
    try{ prog('Reading on this phone…', 0); var o = await ocr(img, function(s, f){ prog('Reading on this phone… ' + Math.round(f * 100) + '%', f); }); conf = o.conf; p = parse(o.text); p.text = o.text; }catch(e){ p = {isBill:false, lines:[], why:'free reader failed: ' + e.message}; }
    var sc = sure(p, conf);
    if(sc < (opt.minSure || 0.7) && opt.aiUrl){ try{ prog('Asking the AI reader…', 0.9); var A = await ai(img, opt.aiUrl, {items:Object.values(opt.items || {}).map(function(i){ return i.n; }), suppliers:opt.suppliers || []}); A.sum = A.lines.reduce(function(n, l){ return n + l.a; }, 0); A.totalOk = A.total != null ? Math.abs(A.sum - A.total) <= Math.max(1.01, 0.005 * A.total) : null; p = A; via = 'ai'; sc = A.isBill ? 0.9 : 0; }catch(e){ p.aiError = e.message; } }
    p.via = via; p.sure = sc; p.conf = conf;
    (p.lines || []).forEach(function(l){ var m = match(l.name || l.raw, {items:opt.items, alias:opt.alias, u:l.u}); if(l.name && via === 'ai' && m.score < 0.82){ m = {n:titleCase(l.name), c:l.cat || guessCat(l.name, l.u), score:0.8, via:'ai', raw:l.raw}; } l.m = m; });
    return p; }

  var API = {CATS:CATS, DICT:DICT, norm:norm, slug:slug, titleCase:titleCase, lev:lev, tokSim:tokSim, phraseSim:phraseSim, match:match, parse:parse, parseLine:parseLine, sure:sure, guessCat:guessCat, ocr:ocr, ai:ai, read:read};
  if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.StockRead = API;
})(typeof window !== 'undefined' ? window : globalThis);
