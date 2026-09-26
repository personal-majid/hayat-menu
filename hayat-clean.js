/* Hayat master cleaning schedule + the maths of "what is due now".
   Shared by clean.html (cleaners, office), kds.html (overdue banner at the pass)
   and mirrored in the shop PC service (phone reminders).

   Times are minutes of the business day (5 am start): 660 = 11:00, 1470 = 00:30.
   Frequency, one of:
     every:60, rushEvery:30 [, from, to] [, rushOnly]   repeating (faster in rush hours)
     at:[645, 960]                                     fixed times every day
     weekly:[1], at:[960]                              days of week (0 Sun … 6 Sat)
     monthly:1, months:1|3|6, at:[900]                 day of month, every n months
   Cloth colours follow the UK/BICSc code: red toilets, blue dining, yellow kitchen, green public. */
(function(){
  var COL = {
    red:   {hex:'#C2362C', en:'Red cloth · toilets only',     ml:'ചുവപ്പ് തുണി · ശുചിമുറി മാത്രം'},
    blue:  {hex:'#2F6FB0', en:'Blue cloth · dining halls',    ml:'നീല തുണി · ഡൈനിംഗ് ഹാൾ'},
    yellow:{hex:'#D39B2A', en:'Yellow cloth · kitchens',      ml:'മഞ്ഞ തുണി · അടുക്കള'},
    green: {hex:'#2E7D5B', en:'Green cloth · entrance, glass, outside', ml:'പച്ച തുണി · പ്രവേശനം, ഗ്ലാസ്, പുറം'}
  };
  var HOW = {
    wc:['Put the wet-floor sign out first','Flush, then clean seat, bowl and rim with toilet cleaner (red cloth)','Wipe tap, basin, mirror, door handle','Refill soap, tissue, hand paper','Empty the bin if it is ¾ full','Mop the floor, mop your way out','Tap ✓ and take a photo'],
    glass:['Spray the cloth, not the glass','Wipe top to bottom','Buff dry with a clean microfibre cloth','Door handles and push plates too'],
    floor:['Put the wet-floor sign out first','Sweep first, under tables too','Two buckets: soapy water and rinse water','Mop from the far corner towards the door','Leave the sign until dry'],
    tables:['Clean first: wipe crumbs and grease','Then spray sanitiser and leave it wet for the time on the label','Chairs: seat, back and legs','Menus and condiment bottles too'],
    kitchen:['Scrape and wash surfaces with hot soapy water (yellow cloth)','Rinse, then sanitiser, leave the label time','Wipe handles, switches, fridge doors','Nothing on the floor: lift, clean under'],
    drains:['Remove the grating, scrub out food','Hot water and degreaser','Put the grating back, check the trap'],
    bins:['Tie and take the bag out','Wash the bin inside and out','Dry and put a new bag in','Lid closed'],
    restock:['Plates, glasses, water bottles full','Tissues, cutlery, bill folders','Mayo and chutney tubs topped up','Wipe the shelf'],
    record:['Check it, write what you found','Take a photo of the log or report']
  };
  var DEFAULT_PLAN = {
    v:1, open:660, close:1470, rush:[[750,870],[1170,1320]],
    areas:[
      {id:'wc',   name:'Washrooms',            ml:'ശുചിമുറി',            icon:'🚻', color:'red'},
      {id:'hw',   name:'Hand-wash area',       ml:'കൈ കഴുകുന്ന സ്ഥലം',   icon:'🧼', color:'green'},
      {id:'entr', name:'Entrance & glass',     ml:'പ്രവേശനം, ഗ്ലാസ്',     icon:'🚪', color:'green'},
      {id:'ac',   name:'AC hall',              ml:'എസി ഹാൾ',              icon:'❄️', color:'blue'},
      {id:'nac',  name:'Non-AC hall',          ml:'നോൺ-എസി ഹാൾ',          icon:'🍽️', color:'blue'},
      {id:'huts', name:'Huts',                 ml:'കുടിലുകൾ',             icon:'🛖', color:'blue'},
      {id:'jh',   name:'Juice Hut dining',     ml:'ജ്യൂസ് ഹട്ട്',          icon:'🥤', color:'blue'},
      {id:'svc',  name:'Service station',      ml:'സർവീസ് സ്റ്റേഷൻ',      icon:'🧺', color:'blue'},
      {id:'mk',   name:'Mandi kitchen',        ml:'മന്തി അടുക്കള',        icon:'🍗', color:'yellow'},
      {id:'main', name:'Main kitchen',         ml:'പ്രധാന അടുക്കള',       icon:'🍛', color:'yellow'},
      {id:'wblk', name:'Juice Hut block kitchen', ml:'ജ്യൂസ് ഹട്ട് അടുക്കള', icon:'🐟', color:'yellow'},
      {id:'dish', name:'Dish wash',            ml:'പാത്രം കഴുകൽ',         icon:'🧽', color:'yellow'},
      {id:'bins', name:'Waste & bins',         ml:'മാലിന്യം',             icon:'🗑️', color:'green'},
      {id:'out',  name:'Outside & parking',    ml:'പുറം, പാർക്കിംഗ്',      icon:'🅿️', color:'green'},
      {id:'pray', name:'Prayer hall & store',  ml:'പ്രാർത്ഥനാ ഹാൾ, സ്റ്റോർ', icon:'🕌', color:'green'},
      {id:'water',name:'Water & pest control', ml:'വെള്ളം, കീടനിയന്ത്രണം', icon:'💧', color:'green'}
    ],
    tasks:[
      {id:'wc-check',   area:'wc',   role:'cleaner', photo:true,  every:60, rushEvery:30, how:'wc',    name:'Check & clean washrooms',          ml:'ശുചിമുറി പരിശോധിച്ച് വൃത്തിയാക്കുക'},
      {id:'hw-basin',   area:'hw',   role:'cleaner', photo:false, every:120, rushEvery:60, how:'wc',   name:'Basins, soap, tissue, mirror',     ml:'വാഷ് ബേസിൻ, സോപ്പ്, ടിഷ്യു, കണ്ണാടി'},
      {id:'entr-glass', area:'entr', role:'cleaner', photo:true,  at:[645,960,1140],     how:'glass',  name:'Glass doors & front glass',        ml:'ഗ്ലാസ് വാതിലുകൾ തുടയ്ക്കുക'},
      {id:'ac-windows', area:'ac',   role:'cleaner', photo:false, at:[990],              how:'glass',  name:'AC hall windows & glass',          ml:'എസി ഹാൾ ജനൽ, ഗ്ലാസ്'},
      {id:'ac-floor',   area:'ac',   role:'cleaner', photo:false, at:[630,945,1470],     how:'floor',  name:'Sweep & mop AC hall',              ml:'എസി ഹാൾ അടിച്ചുവാരി തുടയ്ക്കുക'},
      {id:'nac-floor',  area:'nac',  role:'cleaner', photo:false, at:[640,955,1475],     how:'floor',  name:'Sweep & mop non-AC hall',          ml:'നോൺ-എസി ഹാൾ അടിച്ചുവാരി തുടയ്ക്കുക'},
      {id:'spot-mop',   area:'nac',  role:'cleaner', photo:false, every:30, rushEvery:30, rushOnly:true, how:'floor', name:'Rush: check both halls for spills', ml:'തിരക്ക്: രണ്ട് ഹാളിലും ചോർച്ച നോക്കുക'},
      {id:'tables',     area:'svc',  role:'waiter',  photo:false, at:[650,960],          how:'tables', name:'Sanitise all tables & chairs',     ml:'മേശകളും കസേരകളും അണുവിമുക്തമാക്കുക'},
      {id:'svc-stock',  area:'svc',  role:'waiter',  photo:false, at:[720,990,1140],     how:'restock',name:'Restock service station',          ml:'സർവീസ് സ്റ്റേഷൻ നിറയ്ക്കുക'},
      {id:'huts',       area:'huts', role:'cleaner', photo:false, at:[645],              how:'tables', name:'Clean huts (closed in quiet hours)', ml:'കുടിലുകൾ വൃത്തിയാക്കുക'},
      {id:'jh-clean',   area:'jh',   role:'cleaner', photo:false, at:[650,960],          how:'tables', name:'Juice Hut tables & floor',         ml:'ജ്യൂസ് ഹട്ട് മേശ, തറ'},
      {id:'mk-surf',    area:'mk',   role:'kitchen', photo:true,  at:[930,1470],         how:'kitchen',name:'Mandi kitchen surfaces',           ml:'മന്തി അടുക്കള പ്രതലങ്ങൾ'},
      {id:'main-surf',  area:'main', role:'kitchen', photo:true,  at:[930,1470],         how:'kitchen',name:'Main kitchen surfaces',            ml:'പ്രധാന അടുക്കള പ്രതലങ്ങൾ'},
      {id:'wblk-surf',  area:'wblk', role:'kitchen', photo:true,  at:[930,1470],         how:'kitchen',name:'Juice Hut block surfaces',         ml:'ജ്യൂസ് ഹട്ട് അടുക്കള പ്രതലങ്ങൾ'},
      {id:'k-floors',   area:'main', role:'cleaner', photo:true,  at:[1480],             how:'drains', name:'Kitchen floors & drains, all 3',   ml:'മൂന്ന് അടുക്കളയുടെയും തറ, ഓവുചാൽ'},
      {id:'dish',       area:'dish', role:'cleaner', photo:false, at:[945,1480],         how:'kitchen',name:'Dish wash area',                   ml:'പാത്രം കഴുകുന്ന സ്ഥലം'},
      {id:'bins',       area:'bins', role:'cleaner', photo:false, at:[945,1480],         how:'bins',   name:'Empty & wash waste bins',          ml:'ബിന്നുകൾ കാലിയാക്കി കഴുകുക'},
      {id:'outside',    area:'out',  role:'cleaner', photo:false, at:[630],              how:'floor',  name:'Outside, entrance & parking',      ml:'പുറം, പ്രവേശനം, പാർക്കിംഗ്'},
      {id:'prayer',     area:'pray', role:'cleaner', photo:false, at:[650],              how:'floor',  name:'Prayer hall & store',              ml:'പ്രാർത്ഥനാ ഹാൾ, സ്റ്റോർ'},
      {id:'hoods',      area:'mk',   role:'kitchen', photo:true,  weekly:[1], at:[960],  how:'kitchen',name:'Wash hood / chimney filters',      ml:'ചിമ്മിനി ഫിൽട്ടർ കഴുകുക'},
      {id:'fridges',    area:'main', role:'kitchen', photo:false, weekly:[2], at:[960],  how:'kitchen',name:'Fridge seals & shelves',           ml:'ഫ്രിഡ്ജ് റബ്ബർ, ഷെൽഫ്'},
      {id:'fans',       area:'ac',   role:'cleaner', photo:false, weekly:[3], at:[930],  how:'tables', name:'Dust fans & lights, both halls',   ml:'ഫാൻ, ലൈറ്റ് പൊടി തുടയ്ക്കുക'},
      {id:'walls',      area:'nac',  role:'cleaner', photo:false, weekly:[5], at:[930],  how:'tables', name:'Walls, corners, cobwebs',          ml:'ചുമർ, മൂലകൾ, മാറാല'},
      {id:'ac-filter',  area:'ac',   role:'cleaner', photo:true,  monthly:1, months:1, at:[930], how:'record', name:'Clean AC filters',          ml:'എസി ഫിൽട്ടർ വൃത്തിയാക്കുക'},
      {id:'tank-check', area:'water',role:'cleaner', photo:true,  monthly:1, months:1, at:[900], how:'record', name:'Water tank: lid closed, clean', ml:'വാട്ടർ ടാങ്ക് അടപ്പ് പരിശോധിക്കുക'},
      {id:'pest',       area:'water',role:'office',  photo:true,  monthly:5, months:1, at:[900], how:'record', name:'Pest control visit + report',   ml:'കീടനിയന്ത്രണം + റിപ്പോർട്ട്'},
      {id:'tank-clean', area:'water',role:'office',  photo:true,  monthly:10, months:6, at:[900], how:'record', name:'Water tank clean + water test (FSSAI, every 6 months)', ml:'ടാങ്ക് ശുചീകരണം + വെള്ളം പരിശോധന'}
    ],
    phones:{}
  };
  var ROLE = {cleaner:'Cleaner', waiter:'Waiter', kitchen:'Kitchen', captain:'Captain', office:'Office'};
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function shopNow(ms){ var d = new Date((ms == null ? Date.now() : ms) + 5.5 * 3600e3); return d; }   /* a Date whose UTC fields are shop time */
  function bizDate(ms){ return shopNow((ms == null ? Date.now() : ms) - 5 * 3600e3).toISOString().slice(0, 10); }
  function bizMin(ms){ var d = shopNow(ms), m = d.getUTCHours() * 60 + d.getUTCMinutes(); return d.toISOString().slice(0, 10) > bizDate(ms) ? m + 1440 : (m < 300 ? m + 1440 : m); }
  function hm(m){ m = Math.round(m) % 1440; var h = Math.floor(m / 60), mm = m % 60; return ((h % 12) || 12) + ':' + pad(mm) + (h < 12 ? ' am' : ' pm'); }
  function inRush(p, m){ return (p.rush || []).some(function(w){ return m >= w[0] && m < w[1]; }); }
  function onDay(t, date){ var d = new Date(date + 'T12:00:00Z');
    if(t.weekly) return t.weekly.indexOf(d.getUTCDay()) >= 0;
    if(t.monthly){ var n = t.months || 1; return d.getUTCDate() === t.monthly && (d.getUTCMonth() % n) === 0; }
    return true; }
  /* every time this task falls due on a business date */
  function times(p, t, date){
    if(!onDay(t, date)) return [];
    if(t.at) return t.at.slice().sort(function(a, b){ return a - b; });
    if(t.every){ var out = [], from = t.from != null ? t.from : p.open, to = t.to != null ? t.to : p.close, m = from;
      while(m <= to){ var r = inRush(p, m); if(!t.rushOnly || r) out.push(m);
        var nx = m + (r ? (t.rushEvery || t.every) : t.every);
        if(!r){ var rs = (p.rush || []).map(function(w){ return w[0]; }).filter(function(x){ return x > m && x < nx; })[0]; if(rs != null) nx = rs; }   /* start each rush on time */
        m = nx; }
      return out; }
    return []; }
  function grace(t){ return t.every ? Math.min(20, Math.round((t.rushEvery || t.every) / 2)) : (t.weekly || t.monthly) ? 600 : 30; }
  function occId(t, date, m){ return t.id + '@' + date + '@' + m; }
  /* the state of every task right now: the occurrence that matters, and its status */
  function state(p, date, logs, now){
    var byId = {}; (logs || []).forEach(function(l){ if(l.verified === false) return; var k = l.occ || l.id, p = byId[k]; if(!p || (l.photo && !p.photo)) byId[k] = l; });   /* a rejected clean does not count */
    var out = [], due = 0, done = 0;
    p.tasks.forEach(function(t){
      var T = times(p, t, date); if(!T.length) return;
      var cur = null;
      for(var i = 0; i < T.length; i++){
        var m = T[i], id = occId(t, date, m), next = T[i + 1];
        if(m <= now){ due++; if(byId[id]) done++; }
        if(byId[id]) continue;
        if(m <= now + 15 && (next == null || next > now)){ cur = {m: m, id: id, next: next}; }
      }
      var st, g = grace(t);
      if(cur){ st = now < cur.m ? 'soon' : now > cur.m + g ? 'overdue' : 'due'; }
      else {
        var up = T.filter(function(m){ return m > now + 15 && !byId[occId(t, date, m)]; })[0];
        if(up != null) cur = {m: up, id: occId(t, date, up)}, st = 'later';
        else { var last = T.slice().reverse().filter(function(m){ return byId[occId(t, date, m)]; })[0]; cur = {m: last != null ? last : T[T.length - 1], id: occId(t, date, last != null ? last : T[T.length - 1])}; st = last != null ? 'done' : 'missed'; }
      }
      var lastLog = T.map(function(m){ return byId[occId(t, date, m)]; }).filter(Boolean).pop() || null;
      out.push({t: t, m: cur.m, id: cur.id, st: st, late: st === 'overdue' ? now - cur.m : 0, last: lastLog, count: T.length,
        doneN: T.filter(function(m){ return byId[occId(t, date, m)]; }).length});
    });
    var order = {overdue: 0, due: 1, soon: 2, later: 3, missed: 4, done: 5};
    out.sort(function(a, b){ return order[a.st] - order[b.st] || a.m - b.m; });
    return {rows: out, due: due, done: done, pct: due ? Math.round(done / due * 100) : 100};
  }
  function area(p, id){ return (p.areas || []).filter(function(a){ return a.id === id; })[0] || {id: id, name: id, icon: '🧹', color: 'green'}; }
  function freqText(t){
    if(t.every) return (t.rushOnly ? 'In rush hours, every ' + (t.rushEvery || t.every) + ' min' : 'Every ' + t.every + ' min' + (t.rushEvery && t.rushEvery !== t.every ? ', every ' + t.rushEvery + ' in rush' : ''));
    var at = (t.at || []).map(hm).join(', ');
    if(t.weekly) return 'Every ' + t.weekly.map(function(d){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }).join(', ') + ' at ' + at;
    if(t.monthly) return 'Day ' + t.monthly + ' of every ' + ((t.months || 1) === 1 ? 'month' : (t.months + ' months')) + ' at ' + at;
    return 'Daily at ' + at; }
  window.HayatClean = {DEFAULT_PLAN: DEFAULT_PLAN, COL: COL, HOW: HOW, ROLE: ROLE, bizDate: bizDate, bizMin: bizMin, hm: hm, times: times, state: state, occId: occId, area: area, freqText: freqText, inRush: inRush, grace: grace};
})();
