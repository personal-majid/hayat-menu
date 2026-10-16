/* Hayat · Space planner · v279 "Planner Pro" (Majid, 14 Oct 2026)
   Draw floors of a hotel / restaurant in metres: spaces (rectangle, square, circle, triangle, any polygon),
   doors + windows on their walls, real-size objects (bedroom, bathroom, restaurant, kitchen, store, cleaning,
   lobby) and measurements. 2D plan to edit; 3D (planner3d.js, loaded only when opened) to look, edit and walk.
   PHONE: one-hand dock + sheets (as v278).  LAPTOP / TABLET (900 px+): CAD layout - tool rail, object library
   with 3D pictures (drag onto the plan or into 3D), Properties | Layers panel, status bar, rulers, Split view.
   CAD features: box select (left→right = fully inside, right→left = touching), Shift/Ctrl-click to add,
   group move, align / spread / same size, copy-paste (Ctrl+C/V/D), lock + hide (per item and per layer),
   measure tool, live distances from the selected thing to its walls, room sizes, right-click menu.
   Guest-room spaces carry room no., category, beds, guests and rate: they become the rooms for booking.
   Saved on this device at once (localStorage) and to the cloud (plans/{id}) when signed in. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Math.round(v*100)/100, snapv=(v,g)=>Math.round(v/g)*g, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>Date.now().toString(36).slice(-5)+Math.random().toString(36).slice(2,6);
const fmtL=m=>m<1?Math.round(m*100)+' cm':r2(m).toFixed(2)+' m';

/* ---------------- what can be placed ---------------- */
const STYPES=[
 ['room','Guest room','#e8def7',1],['suite','Suite','#dccff3',1],['bath','Bathroom','#d6ecf3',0],['wash','Wash area','#cfe6ef',0],
 ['corridor','Corridor','#efeae0',0],['lobby','Lobby','#f3e7cf',0],['reception','Reception','#f1dfc0',0],['restaurant','Restaurant','#f8e3d3',0],
 ['kitchen','Kitchen','#f6d9d4',0],['store','Store','#e4e9d3',0],['clean','Housekeeping','#dbeee3',0],['laundry','Laundry','#d9ecea',0],
 ['banquet','Banquet hall','#f6e6ef',0],['office','Office','#e6e6ef',0],['staff','Staff room','#ece4dc',0],['stairs','Stairs / lift','#dddad3',0],
 ['garden','Garden','#d9edcf',0],['parking','Parking','#e2e2e2',0],['other','Other','#eeeeee',0]];
const ST=Object.fromEntries(STYPES.map(t=>[t[0],{k:t[0],n:t[1],c:t[2],guest:!!t[3]}]));
/* objects: [key, name, width m, depth m, height m, colour, shape(box|round), lift (m above floor)] */
const LIB={
 bedroom:{n:'🛏 Bedroom',items:[['bed_k','King bed',1.9,2.1,.55,'#c9a27e'],['bed_q','Queen bed',1.6,2.05,.55,'#c9a27e'],['bed_s','Single bed',.95,2,.5,'#cdb08f'],['wardrobe','Wardrobe',1.2,.6,2.1,'#a58a6c'],['desk','Desk',1.2,.6,.75,'#b49272'],['tv','TV unit',1.6,.45,.6,'#55524c'],['sofa2','Sofa · 2 seat',1.6,.85,.8,'#8f9eb3'],['armch','Arm chair',.8,.8,.85,'#8f9eb3'],['side','Side table',.45,.45,.55,'#b49272'],['chair','Chair',.5,.5,.9,'#9c8165'],['lugg','Luggage rack',.9,.5,.5,'#9c8165'],['mini','Mini fridge',.5,.5,.85,'#e9e9e9'],['ac','AC unit',1,.25,.3,'#f2f2f2','box',2.3]]},
 bath:{n:'🚿 Bathroom',items:[['wc','Toilet',.4,.7,.8,'#f7f7f7'],['basin','Wash basin',.6,.45,.85,'#f3f3f3'],['vanity','Vanity + basin',1.2,.55,.85,'#d9d2c4'],['shower','Shower',.9,.9,2.1,'#bfe0ec'],['tub','Bathtub',1.7,.75,.6,'#f4f4f4'],['geyser','Water heater',.45,.45,.6,'#ececec','round',1.8],['urinal','Urinal',.4,.35,.6,'#f4f4f4','box',.5]]},
 rest:{n:'🍽 Restaurant',items:[['t2','Table for 2',.7,.7,.75,'#a0703c'],['t4','Table for 4',1.2,.8,.75,'#a0703c'],['t6','Table for 6',1.8,.9,.75,'#a0703c'],['tr4','Round table · 4',1,1,.75,'#a0703c','round'],['tr8','Round table · 8',1.6,1.6,.75,'#a0703c','round'],['dchair','Dining chair',.45,.45,.9,'#6f5338'],['booth','Booth seat',1.6,.65,1.1,'#7c4b3b'],['counter','Service counter',2.4,.7,1.05,'#8c6e52'],['cash','Cash desk',1.2,.6,1.05,'#8c6e52'],['buffet','Buffet line',2.4,.8,.9,'#b7a08a'],['hand','Hand wash',.5,.45,.85,'#f0f0f0'],['plant','Plant',.5,.5,1.2,'#5f9e5a','round']]},
 kitchen:{n:'🔥 Kitchen',items:[['range4','Burner range · 4',1.2,.8,.9,'#555d66'],['range2','Burner · 2',.8,.7,.9,'#555d66'],['tandoor','Tandoor',.9,.9,.95,'#a06a4a','round'],['mandi','Mandi oven',1.2,1.2,1.4,'#8a5a3c','round'],['oven','Oven',.9,.8,1.5,'#6c737b'],['fryer','Fryer',.5,.7,.9,'#6c737b'],['grill','Grill',1,.7,.9,'#4d545b'],['prep','Prep table',1.8,.7,.9,'#c0c6cc'],['sink2','Sink · 2 bowls',1.4,.7,.9,'#b8c4cc'],['dish','Dishwasher',.65,.65,1.5,'#aab3ba'],['fridge','Fridge',.8,.75,2,'#e3e6e8'],['freezer','Chest freezer',1.4,.75,.9,'#e3e6e8'],['coldroom','Cold room',2.4,2,2.4,'#d7e3ea'],['hood','Exhaust hood',2,1,.5,'#9aa3aa','box',1.9],['rack','Shelf rack',1.2,.5,1.8,'#a4acb3'],['pass','Pass / pick-up',1.8,.6,1,'#c0c6cc'],['mixer','Mixer / grinder',.6,.6,.9,'#8d969e'],['juice','Juice counter',2,.7,1,'#d9b65a']]},
 store:{n:'📦 Store',items:[['srack','Store rack',1.5,.6,2,'#a4acb3'],['pallet','Sack pallet',1.2,1,.3,'#b98f5b'],['dfreezer','Deep freezer',1.4,.75,.9,'#e3e6e8'],['scale','Weighing scale',.6,.6,.8,'#8d969e'],['gas','Gas cylinders',1.2,.6,1.2,'#c0392b'],['water','Water tank',1.2,1.2,1.6,'#3a7bd5','round']]},
 clean:{n:'🧹 Cleaning',items:[['trolley','Cleaning trolley',1,.5,1,'#4c9a76'],['washer','Washing machine',.6,.6,.85,'#efefef'],['dryer','Dryer',.6,.6,.85,'#e6e6e6'],['iron','Ironing table',1.4,.45,.9,'#b6b0a4'],['linen','Linen rack',1.2,.5,2,'#c9c2b4'],['mop','Mop sink',.6,.6,.5,'#c7d3d9'],['bins','Waste bins',1,.6,1,'#3d6b4f']]},
 lobby:{n:'🛎 Lobby',items:[['recep','Reception desk',2.4,.8,1.1,'#8c6e52'],['lsofa','Lounge sofa',2,.9,.8,'#8f9eb3'],['ctable','Coffee table',1,.6,.45,'#b49272'],['lift','Lift',1.8,1.8,2.6,'#9aa3aa'],['stairs','Stairs',1.2,3,.2,'#c8c2b5'],['locker','Lockers',1.2,.5,1.9,'#9aa3aa'],['bench','Bench',1.5,.45,.45,'#b49272']]}};
const OBJ={}; Object.entries(LIB).forEach(([c,g])=>g.items.forEach(a=>{ OBJ[a[0]]={k:a[0],n:a[1],w:a[2],d:a[3],ht:a[4],c:a[5],shape:a[6]||'box',lift:a[7]||0,cat:c}; }));
const SEAT={dchair:1,booth:3,sofa2:0,chair:0};
const CATS={room:['Standard','Deluxe','Premium','Family'],suite:['Suite','Executive suite']};
const FLOORN=[['auto','Auto · by what it is'],['oak','Oak wood'],['walnut','Dark wood'],['marble','Marble'],['tile','Tile 60 cm'],['smalltile','Tile 30 cm'],['greytile','Grey tile'],['terracotta','Terracotta'],['carpet','Carpet'],['redcarpet','Red carpet'],['concrete','Concrete'],['stone','Stone'],['grass','Grass'],['asphalt','Asphalt']];
const FINN=[['auto','Its own look'],['oak','Light oak'],['walnut','Walnut'],['white','White'],['black','Black'],['steel','Steel'],['fabric','Fabric (colour)']];

/* ---------------- state ---------------- */
const LS='hayat-plan-v1', UIK='hayat-plan-ui', THK='hayat-plan-thumbs-v1';
let P=null, FL=0, SEL=null, SELS=new Set(), TOOL='select', VIEW={s:40,ox:40,oy:40}, MODE='2d', PREWALK='3d', DIRTY=false, CTX=null, CLOUD={at:0,busy:false,err:''}, PRO=false, SPACEDOWN=false, CLIP=null, CUR=null, NORULER=false;
const HIST={u:[],r:[]};
const PREF=Object.assign({lib:true,tab:'props',rulers:true,roomDims:false,snap:true,mag:true,fold:{}},(()=>{ try{ return JSON.parse(localStorage.getItem(UIK)||'{}'); }catch(e){ return {}; } })());
PREF.lay=Object.assign({spaces:[1,0],furn:[1,0],open:[1,0],dims:[1,0],labels:[1,0],grid:[1,0],sketch:[1,0]},PREF.lay||{});
function savePref(){ try{ localStorage.setItem(UIK,JSON.stringify(PREF)); }catch(e){} }
let THUMBS={}; try{ THUMBS=JSON.parse(localStorage.getItem(THK)||'{}')||{}; }catch(e){ THUMBS={}; }
function blank(name){ return {v:1,id:'demo',name:name||'Demo hotel',grid:.1,floors:[{id:uid(),name:'Ground',items:[]}],at:Date.now()}; }
function floor(){ return P.floors[FL]||P.floors[0]; }
function items(){ return floor().items; }
function byId(id){ for(const f of P.floors) for(const it of f.items) if(it.id===id) return it; return null; }
function commit(){ HIST.u.push(JSON.stringify(P)); if(HIST.u.length>80) HIST.u.shift(); HIST.r=[]; }
function fixSel(){ SELS=new Set([...SELS].filter(id=>byId(id))); if(SEL&&!byId(SEL)) SEL=null; if(!SEL&&SELS.size) SEL=[...SELS].pop(); }
function undo(){ if(!HIST.u.length) return; HIST.r.push(JSON.stringify(P)); P=JSON.parse(HIST.u.pop()); if(FL>=P.floors.length) FL=0; fixSel(); changed(true); afterSel(true); }
function redo(){ if(!HIST.r.length) return; HIST.u.push(JSON.stringify(P)); P=JSON.parse(HIST.r.pop()); fixSel(); changed(true); afterSel(true); }
/* selection: SELS = everything selected, SEL = the one the panel / handles show */
function sel1(id){ SEL=id||null; SELS=new Set(id?[id]:[]); }
function selClear(){ SEL=null; SELS=new Set(); }
function selList(){ return [...SELS].map(byId).filter(Boolean); }
/* layers */
const layerOf=it=>it.kind==='space'?'spaces':it.kind==='obj'?'furn':it.kind==='dim'?'dims':'open';
function hiddenSpaces(f){ const hs=new Set(); (f||floor()).items.forEach(s=>{ if(s.kind==='space'&&s.hid) hs.add(s.id); }); return hs; }
function isHidden(it,f,HS){ const L=PREF.lay[layerOf(it)]; if(L&&!L[0]) return true; if(it.hid) return true; HS=HS||hiddenSpaces(f); if(!HS.size) return false;
  if(it.kind==='door'||it.kind==='window') return HS.has(it.sp);
  if(it.kind==='obj'){ const c=ctr(it); for(const s of (f||floor()).items) if(s.kind==='space'&&HS.has(s.id)&&inside(c,worldPts(s))) return true; } return false; }
const layerLocked=it=>{ const L=PREF.lay[layerOf(it)]; return !!(L&&L[1]); };
const isLocked=it=>!!it.lock||layerLocked(it);

/* ---------------- geometry (metres; y grows downwards on the plan) ---------------- */
function ctr(it){ return [it.x+it.w/2,it.y+it.h/2]; }
function rot([x,y],[cx,cy],deg){ const a=deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a), dx=x-cx, dy=y-cy; return [cx+dx*c-dy*s,cy+dx*s+dy*c]; }
function localPts(it){
  if(it.shape==='circle'||it.shape==='round'){ const n=40, out=[]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; out.push([it.w/2+it.w/2*Math.cos(a),it.h/2+it.h/2*Math.sin(a)]); } return out; }
  if(it.shape==='tri') return [[it.w/2,0],[it.w,it.h],[0,it.h]];
  if(it.shape==='poly'&&it.pts&&it.pts.length>2) return it.pts.map(p=>[p[0]*it.w,p[1]*it.h]);
  return [[0,0],[it.w,0],[it.w,it.h],[0,it.h]]; }
function worldPts(it){ const c=ctr(it); return localPts(it).map(p=>rot([it.x+p[0],it.y+p[1]],c,it.r||0)); }
function area(pts){ let a=0; for(let i=0;i<pts.length;i++){ const p=pts[i], q=pts[(i+1)%pts.length]; a+=p[0]*q[1]-q[0]*p[1]; } return Math.abs(a)/2; }
function inside(pt,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i], b=pts[j]; if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
function edges(it){ const P0=worldPts(it); return P0.map((p,i)=>[p,P0[(i+1)%P0.length]]); }
function projSeg(pt,[a,b]){ const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy||1e-9; let t=((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L2; t=Math.max(0,Math.min(1,t)); const q=[a[0]+t*dx,a[1]+t*dy]; return {t,q,d:Math.hypot(pt[0]-q[0],pt[1]-q[1]),len:Math.sqrt(L2)}; }
function overlapPts(A,B){ const axes=[]; [A,B].forEach(P0=>{ for(let i=0;i<P0.length;i++){ const p=P0[i], q=P0[(i+1)%P0.length]; axes.push([-(q[1]-p[1]),q[0]-p[0]]); } });
  let minOv=Infinity; for(const ax of axes){ const L=Math.hypot(ax[0],ax[1])||1, n=[ax[0]/L,ax[1]/L]; let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    A.forEach(p=>{ const v=p[0]*n[0]+p[1]*n[1]; a0=Math.min(a0,v); a1=Math.max(a1,v); }); B.forEach(p=>{ const v=p[0]*n[0]+p[1]*n[1]; b0=Math.min(b0,v); b1=Math.max(b1,v); });
    const ov=Math.min(a1,b1)-Math.max(a0,b0); if(ov<=0.02) return 0; minOv=Math.min(minOv,ov); } return minOv; }
function bbox(pts){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; pts.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }); return [x0,y0,x1,y1]; }
function openingPos(o){ const s=byId(o.sp); if(!s) return null; const E=edges(s)[o.e]; if(!E) return null; const [a,b]=E, len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI, p=[a[0]+(b[0]-a[0])*o.t,a[1]+(b[1]-a[1])*o.t]; return {p,ang,len,a,b,space:s}; }
function spaceOf(pt,fl){ const L=(fl||floor()).items.filter(i=>i.kind==='space'); for(let i=L.length-1;i>=0;i--) if(inside(pt,worldPts(L[i]))) return L[i]; return null; }
function nearestWall(pt,maxD){ let best=null; items().filter(i=>i.kind==='space'&&!isHidden(i)).forEach(s=>{ edges(s).forEach((E,i)=>{ const r=projSeg(pt,E); if(r.d<=maxD&&(!best||r.d<best.d)) best={sp:s.id,e:i,t:r.t,d:r.d,len:r.len}; }); }); return best; }
function centroid(P0){ let x=0,y=0,a=0; for(let i=0;i<P0.length;i++){ const p=P0[i], q=P0[(i+1)%P0.length], c=p[0]*q[1]-q[0]*p[1]; a+=c; x+=(p[0]+q[0])*c; y+=(p[1]+q[1])*c; } if(Math.abs(a)<1e-9){ const b=bbox(P0); return [(b[0]+b[2])/2,(b[1]+b[3])/2]; } return [x/(3*a),y/(3*a)]; }
function raySeg(o,d,p,q){ const ex=q[0]-p[0], ey=q[1]-p[1], den=d[0]*ey-d[1]*ex; if(Math.abs(den)<1e-9) return null; const t=((p[0]-o[0])*ey-(p[1]-o[1])*ex)/den, u=((p[0]-o[0])*d[1]-(p[1]-o[1])*d[0])/den; return (u>=-1e-6&&u<=1+1e-6)?t:null; }
function itemBox(it){ if(it.kind==='door'||it.kind==='window'){ const q=openingPos(it); return q?[q.p[0],q.p[1],q.p[0],q.p[1]]:null; } if(it.kind==='dim') return bbox([it.a,it.b]); return bbox(worldPts(it)); }
function childrenOf(s){ const P0=worldPts(s); return items().filter(o=>o.kind==='obj'&&inside(ctr(o),P0)); }
function spaceLabel(s){ const t=ST[s.type]||ST.other; return t.guest&&s.no?s.no+(s.cat?' · '+s.cat:''):(s.name||t.n); }
function itemName(it){ if(!it) return ''; if(it.kind==='space') return spaceLabel(it); if(it.kind==='obj') return it.name||(OBJ[it.t]||{}).n||'Object'; if(it.kind==='dim') return 'Measure '+fmtL(Math.hypot(it.b[0]-it.a[0],it.b[1]-it.a[1])); return it.kind==='door'?'Door':'Window'; }

/* ---------------- drawing the plan (screen pixels, so lines and text stay crisp at any zoom) ---------------- */
const svg=$('svg');
const W2S=p=>[p[0]*VIEW.s+VIEW.ox,p[1]*VIEW.s+VIEW.oy];
function S2W(cx,cy){ const r=svg.getBoundingClientRect(); return [(cx-r.left-VIEW.ox)/VIEW.s,(cy-r.top-VIEW.oy)/VIEW.s]; }
const ptsAttr=P0=>P0.map(p=>{ const q=W2S(p); return q[0].toFixed(1)+','+q[1].toFixed(1); }).join(' ');
let WARN={list:[],ids:new Set()}, DRAFT=null;
function glyph(o){ const w=o.w, d=o.h, x0=-w/2, y0=-d/2, L=[]; const k=o.t;
  const rect=(x,y,ww,hh,f,rx)=>L.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${rx||0}" fill="${f||'none'}" class="ob"/>`);
  const line=(a,b,c,dd)=>L.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${dd}" class="ob"/>`);
  const circ=(x,y,r,f)=>L.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${f||'none'}" class="ob"/>`);
  if(/^bed/.test(k)){ const two=k!=='bed_s'; const pw=two?w/2-.12:w-.2; for(let i=0;i<(two?2:1);i++) rect(x0+.08+i*(pw+.08),y0+.08,pw,.32,'rgba(255,255,255,.85)',.06); line(x0,y0+.55,x0+w,y0+.55); }
  else if(k==='wc'){ rect(x0+.04,y0,w-.08,.18,'rgba(255,255,255,.9)',.03); L.push(`<ellipse cx="0" cy="${y0+.18+(d-.18)/2}" rx="${w/2-.04}" ry="${(d-.18)/2-.02}" fill="rgba(255,255,255,.9)" class="ob"/>`); }
  else if(k==='basin'||k==='vanity'||k==='hand'||k==='mop') L.push(`<ellipse cx="0" cy="0" rx="${Math.min(w,1)/2-.08}" ry="${d/2-.08}" fill="rgba(255,255,255,.8)" class="ob"/>`);
  else if(k==='shower'){ line(x0,y0,x0+w,y0+d); line(x0+w,y0,x0,y0+d); circ(0,0,.06); }
  else if(k==='tub') rect(x0+.07,y0+.07,w-.14,d-.14,'rgba(255,255,255,.85)',.25);
  else if(k==='range4'||k==='range2'){ const n=k==='range4'?2:1; for(let i=0;i<n;i++) for(let j=0;j<2;j++) circ(x0+w*(n===1?.5:(i+.5)/n),y0+d*(j+.5)/2,Math.min(w/n,d/2)*.32); }
  else if(k==='sink2'){ rect(x0+.08,y0+.1,w/2-.12,d-.2,'rgba(255,255,255,.6)',.04); rect(.04,y0+.1,w/2-.12,d-.2,'rgba(255,255,255,.6)',.04); }
  else if(k==='prep'||k==='pass'||k==='counter'||k==='buffet'||k==='recep'||k==='juice') line(x0,y0+.12,x0+w,y0+.12);
  else if(k==='stairs'){ const n=Math.max(4,Math.round(d/.28)); for(let i=1;i<n;i++) line(x0,y0+d*i/n,x0+w,y0+d*i/n); line(0,y0+d-.1,0,y0+.2); }
  else if(k==='dchair'||k==='chair'||k==='armch') rect(x0,y0,w,.1,'rgba(0,0,0,.25)');
  else if(k==='sofa2'||k==='lsofa'||k==='booth'){ rect(x0,y0,w,.2,'rgba(0,0,0,.18)'); }
  else if(k==='hood'||k==='lift'){ line(x0,y0,x0+w,y0+d); line(x0+w,y0,x0,y0+d); }
  else if(k==='tandoor'||k==='mandi') circ(0,0,Math.min(w,d)/2*.55,'rgba(0,0,0,.35)');
  else if(k==='fridge'||k==='freezer'||k==='dfreezer'||k==='coldroom') line(x0+.06,y0+d-.08,x0+w-.06,y0+d-.08);
  else if(k==='srack'||k==='rack'||k==='linen'){ for(let i=1;i<4;i++) line(x0,y0+d*i/4,x0+w,y0+d*i/4); }
  return L.join(''); }
/* an architect's dimension line between two plan points: ticks at the ends, the length in the middle */
function dimSvg(a,b,txt,cls,off,id){ const A=W2S(a), B=W2S(b); const dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy); if(L<10) return ''; const ux=dx/L, uy=dy/L, nx=-uy, ny=ux, o=off||0;
  const a1=[A[0]+nx*o,A[1]+ny*o], b1=[B[0]+nx*o,B[1]+ny*o], t=4.5, tx=(ux+nx)*t*.707, ty=(uy+ny)*t*.707; let ang=Math.atan2(dy,dx)*180/Math.PI; if(ang>90) ang-=180; if(ang<=-90) ang+=180;
  const m=[(a1[0]+b1[0])/2,(a1[1]+b1[1])/2];
  let s=`<g class="${cls}"${id?` data-id="${id}"`:''}>`; if(o) s+=`<line x1="${A[0]}" y1="${A[1]}" x2="${a1[0]+nx*Math.sign(o)*3}" y2="${a1[1]+ny*Math.sign(o)*3}"/><line x1="${B[0]}" y1="${B[1]}" x2="${b1[0]+nx*Math.sign(o)*3}" y2="${b1[1]+ny*Math.sign(o)*3}"/>`;
  s+=`<line x1="${a1[0]}" y1="${a1[1]}" x2="${b1[0]}" y2="${b1[1]}"/><line x1="${a1[0]-tx}" y1="${a1[1]-ty}" x2="${a1[0]+tx}" y2="${a1[1]+ty}"/><line x1="${b1[0]-tx}" y1="${b1[1]-ty}" x2="${b1[0]+tx}" y2="${b1[1]+ty}"/>`;
  if(L>txt.length*6.4+8) s+=`<text x="${m[0]}" y="${m[1]-4}" text-anchor="middle" transform="rotate(${ang.toFixed(1)} ${m[0]} ${m[1]})">${esc(txt)}</text>`;
  if(id) s+=`<line x1="${a1[0]}" y1="${a1[1]}" x2="${b1[0]}" y2="${b1[1]}" stroke="transparent" stroke-width="16" style="stroke:transparent"/>`;
  return s+'</g>'; }
/* distances from the selected object to the walls of its room, live while dragging */
function autoDims(it){ if(it.kind!=='obj') return ''; const host=spaceOf(ctr(it)); if(!host) return ''; const b=bbox(worldPts(it)), E=edges(host), cy=(b[1]+b[3])/2, cx=(b[0]+b[2])/2, out=[];
  [[[b[0],cy],[-1,0]],[[b[2],cy],[1,0]],[[cx,b[1]],[0,-1]],[[cx,b[3]],[0,1]]].forEach(([o,dir])=>{ let t=Infinity; E.forEach(([p,q])=>{ const v=raySeg(o,dir,p,q); if(v!=null&&v>-1e-6&&v<t) t=v; }); if(isFinite(t)&&t>.02&&t<40) out.push(dimSvg(o,[o[0]+dir[0]*t,o[1]+dir[1]*t],fmtL(t),'dima')); });
  return out.join(''); }
function spaceDims(s){ const P0=worldPts(s), b=bbox(P0); return dimSvg([b[0],b[1]],[b[2],b[1]],fmtL(b[2]-b[0]),'dima',-18)+dimSvg([b[0],b[3]],[b[0],b[1]],fmtL(b[3]-b[1]),'dima',-18); }
function rulers(r){ const S=VIEW.s, out=['<g class="ruler" pointer-events="none">'], band=18, steps=[.5,1,2,5,10,20,50,100]; const st=steps.find(v=>v*S>=56)||100, minor=st/5;
  out.push(`<rect x="0" y="0" width="${r.width}" height="${band}"/><rect x="0" y="0" width="${band}" height="${r.height}"/><line class="rb" x1="0" y1="${band}" x2="${r.width}" y2="${band}"/><line class="rb" x1="${band}" y1="0" x2="${band}" y2="${r.height}"/>`);
  const w0=(band-VIEW.ox)/S, w1=(r.width-VIEW.ox)/S; for(let v=Math.floor(w0/minor)*minor;v<=w1;v+=minor){ const x=v*S+VIEW.ox; if(x<band) continue; const maj=Math.abs(v/st-Math.round(v/st))<1e-6; out.push(`<line x1="${x}" y1="${maj?6:12}" x2="${x}" y2="${band}"/>`); if(maj) out.push(`<text x="${x+3}" y="10">${+v.toFixed(1)}</text>`); }
  const h0=(band-VIEW.oy)/S, h1=(r.height-VIEW.oy)/S; for(let v=Math.floor(h0/minor)*minor;v<=h1;v+=minor){ const y=v*S+VIEW.oy; if(y<band) continue; const maj=Math.abs(v/st-Math.round(v/st))<1e-6; out.push(`<line x1="${maj?6:12}" y1="${y}" x2="${band}" y2="${y}"/>`); if(maj) out.push(`<text x="10" y="${y-3}" transform="rotate(-90 10 ${y-3})">${+v.toFixed(1)}</text>`); }
  out.push(`<rect x="0" y="0" width="${band}" height="${band}"/><text x="3" y="12">m</text></g>`); return out.join(''); }
function draw(){
  if(MODE==='3d'||MODE==='walk') return;
  const S=VIEW.s, L=items(), out=[], HS=hiddenSpaces(), vis=it=>!isHidden(it,null,HS), lk=it=>layerLocked(it)?' lk':'';
  if(PREF.lay.grid[0]){ const g1=S*.5, g5=S*5, ox=((VIEW.ox%g1)+g1)%g1, oy=((VIEW.oy%g1)+g1)%g1, ox5=((VIEW.ox%g5)+g5)%g5, oy5=((VIEW.oy%g5)+g5)%g5;
    out.push(`<defs><pattern id="pg1" width="${g1}" height="${g1}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M ${g1} 0 L 0 0 0 ${g1}" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern><pattern id="pg5" width="${g5}" height="${g5}" patternUnits="userSpaceOnUse" x="${ox5}" y="${oy5}"><path d="M ${g5} 0 L 0 0 0 ${g5}" fill="none" stroke="var(--grid2)" stroke-width="1"/></pattern></defs>`);
    out.push(`<rect width="100%" height="100%" fill="url(#pg1)" data-bg="1"/><rect width="100%" height="100%" fill="url(#pg5)" data-bg="1"/>`); }
  const U=floor().under; if(U&&U.src&&PREF.lay.sketch[0]){ const a=W2S([U.x,U.y]); out.push(`<image href="${U.src}" x="${a[0].toFixed(1)}" y="${a[1].toFixed(1)}" width="${(U.w*S).toFixed(1)}" height="${(U.h*S).toFixed(1)}" opacity="${U.op==null?.35:U.op}" preserveAspectRatio="none" pointer-events="none"/>`); }
  const UO=U&&U.src&&PREF.lay.sketch[0]?' fill-opacity=".55"':'';
  L.filter(i=>i.kind==='space'&&vis(i)).forEach(s=>{ const t=ST[s.type]||ST.other, P0=worldPts(s); out.push(`<g data-id="${s.id}" class="${WARN.ids.has(s.id)?'bad':''}${lk(s)}"><polygon points="${ptsAttr(P0)}" fill="${t.c}"${UO} class="sp"/></g>`); });
  L.filter(i=>i.kind==='obj'&&vis(i)).forEach(o=>{ const T=OBJ[o.t]||{}, P0=worldPts(o), c=W2S(ctr(o));
    out.push(`<g data-id="${o.id}" class="${WARN.ids.has(o.id)?'bad':''}${lk(o)}"><polygon points="${ptsAttr(P0)}" fill="${o.c||T.c||'#bbb'}" class="ob${WARN.ids.has(o.id)?' bad':''}" fill-opacity="${T.lift?'.45':'1'}"/><g transform="translate(${c[0].toFixed(1)},${c[1].toFixed(1)}) rotate(${o.r||0}) scale(${S})" pointer-events="none">${glyph(o)}</g></g>`); });
  L.filter(i=>(i.kind==='door'||i.kind==='window')&&vis(i)).forEach(o=>{ const q=openingPos(o); if(!q) return; const a=q.ang*Math.PI/180, ux=Math.cos(a), uy=Math.sin(a), hw=o.w/2;
    const A=W2S([q.p[0]-ux*hw,q.p[1]-uy*hw]), B=W2S([q.p[0]+ux*hw,q.p[1]+uy*hw]), side=o.side||1, nx=-uy*side, ny=ux*side, sw=Math.max(5,S*.14);
    let g=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="var(--paper)" stroke-width="${sw}" class="op"/>`;
    if(o.kind==='door'){ const hinge=o.flip?B:A, other=o.flip?A:B, leaf=[hinge[0]+nx*o.w*S,hinge[1]+ny*o.w*S], sweep=(side>0)!==!!o.flip?1:0;
      g+=`<line x1="${hinge[0]}" y1="${hinge[1]}" x2="${leaf[0]}" y2="${leaf[1]}" stroke="var(--ink)" stroke-width="2" class="op"/><path d="M ${leaf[0]} ${leaf[1]} A ${o.w*S} ${o.w*S} 0 0 ${sweep} ${other[0]} ${other[1]}" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" class="op"/>`; }
    else { const off=Math.max(2,S*.04); g+=`<line x1="${A[0]+nx*off}" y1="${A[1]+ny*off}" x2="${B[0]+nx*off}" y2="${B[1]+ny*off}" stroke="#3a7bd5" stroke-width="2" class="op"/><line x1="${A[0]-nx*off}" y1="${A[1]-ny*off}" x2="${B[0]-nx*off}" y2="${B[1]-ny*off}" stroke="#3a7bd5" stroke-width="2" class="op"/>`; }
    const hit=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="transparent" stroke-width="${Math.max(18,sw+10)}"/>`;
    out.push(`<g data-id="${o.id}" class="${WARN.ids.has(o.id)?'bad':''}${lk(o)}">${g}${hit}</g>`); });
  L.filter(i=>i.kind==='dim'&&vis(i)).forEach(d=>{ out.push(dimSvg(d.a,d.b,fmtL(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])),'dimg'+(SELS.has(d.id)?' sel':'')+lk(d),0,d.id)); });
  if(PREF.lay.labels[0]){ L.filter(i=>i.kind==='space'&&vis(i)).forEach(s=>{ const P0=worldPts(s), b=bbox(P0.map(W2S)), bw=b[2]-b[0]-8, bh=b[3]-b[1]; if(bw<22||bh<18) return; const c=W2S(centroid(P0)), a=area(P0), fs=Math.max(11,Math.min(15,S*.32));
      let t=spaceLabel(s); if(t.length*fs*.6>bw) t=s.no||String(s.name||(ST[s.type]||ST.other).n).split(/\s+/)[0]; if(t.length*fs*.6>bw) return;
      const ar=a.toFixed(1)+' m²', showA=bh>=34&&ar.length*11*.58<=bw;
      out.push(`<text x="${c[0]}" y="${c[1]+(showA?-3:4)}" text-anchor="middle" class="lbl" font-size="${fs}">${esc(t)}</text>`+(showA?`<text x="${c[0]}" y="${c[1]+12}" text-anchor="middle" class="lbl2" font-size="11">${ar}</text>`:'')); });
    if(S>=34) L.filter(i=>i.kind==='obj'&&vis(i)).forEach(o=>{ const b=bbox(worldPts(o).map(W2S)); if(b[2]-b[0]<60) return; const c=W2S(ctr(o)); out.push(`<text x="${c[0]}" y="${c[1]+4}" text-anchor="middle" class="lbl2" font-size="10.5">${esc(o.name||(OBJ[o.t]||{}).n||'')}</text>`); }); }
  if(PREF.roomDims&&S>=14) L.filter(i=>i.kind==='space'&&vis(i)&&(i.shape==='rect'||!i.shape)&&!((i.r||0)%90)).forEach(s=>{ const b=bbox(worldPts(s)); if((b[2]-b[0])*S<70||(b[3]-b[1])*S<50) return; out.push(dimSvg([b[0],b[1]],[b[2],b[1]],fmtL(b[2]-b[0]),'dimr',11)+dimSvg([b[0],b[3]],[b[0],b[1]],fmtL(b[3]-b[1]),'dimr',11)); });
  /* selection */
  const sel=SELS.size===1&&SEL&&byId(SEL);
  if(SELS.size>1){ let B0=null; selList().forEach(it=>{ const b=itemBox(it); if(!b) return; B0=B0?[Math.min(B0[0],b[0]),Math.min(B0[1],b[1]),Math.max(B0[2],b[2]),Math.max(B0[3],b[3])]:b.slice();
      if(it.kind==='space'||it.kind==='obj') out.push(`<polygon points="${ptsAttr(worldPts(it))}" class="selm"/>`); else { const c=W2S([(b[0]+b[2])/2,(b[1]+b[3])/2]); out.push(`<circle cx="${c[0]}" cy="${c[1]}" r="10" class="selm"/>`); } });
    if(B0){ const A=W2S([B0[0],B0[1]]), Bq=W2S([B0[2],B0[3]]); out.push(`<rect x="${A[0]-6}" y="${A[1]-6}" width="${Bq[0]-A[0]+12}" height="${Bq[1]-A[1]+12}" class="selb"/><text x="${(A[0]+Bq[0])/2}" y="${Bq[1]+20}" text-anchor="middle" class="dim" font-size="12">${SELS.size} selected · ${fmtL(B0[2]-B0[0])} × ${fmtL(B0[3]-B0[1])}</text>`); } }
  else if(sel&&(sel.kind==='space'||sel.kind==='obj')){ const box={x:sel.x,y:sel.y,w:sel.w,h:sel.h,r:sel.r||0}, P0=worldPts(box).map(W2S);
    out.push(`<polygon points="${P0.map(p=>p.join(',')).join(' ')}" class="selb"/>`);
    if(!isLocked(sel)){ P0.forEach((p,i)=>out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="9" class="hd" data-h="${i}"/>`));
      const c=ctr(sel), top=rot([c[0],sel.y-Math.max(.5,22/S)],c,sel.r||0), T=W2S(top), M=W2S(rot([c[0],sel.y],c,sel.r||0));
      out.push(`<line x1="${M[0]}" y1="${M[1]}" x2="${T[0]}" y2="${T[1]}" class="selb"/><circle cx="${T[0]}" cy="${T[1]}" r="10" class="hd" data-h="rot"/><text x="${T[0]}" y="${T[1]+4}" text-anchor="middle" font-size="12" pointer-events="none" fill="var(--sel)">⟳</text>`); }
    const bb=bbox(P0); out.push(`<text x="${(bb[0]+bb[2])/2}" y="${bb[3]+18}" text-anchor="middle" class="dim" font-size="12">${isLocked(sel)?'🔒 ':''}${r2(sel.w)} × ${r2(sel.h)} m${sel.r?' · '+Math.round(sel.r)+'°':''}</text>`);
    if(PRO||DRAG&&DRAG.moved) out.push(sel.kind==='obj'?autoDims(sel):spaceDims(sel)); }
  else if(sel&&(sel.kind==='door'||sel.kind==='window')){ const q=openingPos(sel); if(q){ const c=W2S(q.p); out.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${Math.max(14,sel.w*S/2+6)}" class="selb"/><text x="${c[0]}" y="${c[1]-Math.max(16,sel.w*S/2+10)}" text-anchor="middle" class="dim" font-size="12">${sel.kind==='door'?'Door':'Window'} ${r2(sel.w)} m</text>`); } }
  else if(sel&&sel.kind==='dim'&&!isLocked(sel)){ [['da',sel.a],['db',sel.b]].forEach(([h,p])=>{ const q=W2S(p); out.push(`<circle cx="${q[0]}" cy="${q[1]}" r="8" class="hd" data-h="${h}"/>`); }); }
  /* drafts */
  if(DRAFT){ if(DRAFT.pts){ const Q=DRAFT.pts.concat(DRAFT.hover?[DRAFT.hover]:[]); out.push(`<polyline points="${ptsAttr(Q)}" class="ghost" fill="rgba(42,120,214,.10)"/>`); DRAFT.pts.forEach((p,i)=>{ const q=W2S(p); out.push(`<circle cx="${q[0]}" cy="${q[1]}" r="${i?5:8}" fill="${i?'var(--sel)':'#fff'}" stroke="var(--sel)" stroke-width="2"/>`); }); }
    else if(DRAFT.box){ const b=DRAFT.box; out.push(`<polygon points="${ptsAttr(worldPts(b))}" class="ghost"/>`); const q=W2S([b.x+b.w/2,b.y+b.h]); out.push(`<text x="${q[0]}" y="${q[1]+18}" text-anchor="middle" class="dim" font-size="12">${r2(b.w)} × ${r2(b.h)} m</text>`); }
    else if(DRAFT.meas){ const M=DRAFT.meas; if(M.hover){ const q=W2S(M.hover); out.push(`<circle cx="${q[0]}" cy="${q[1]}" r="${M.snapped?7:4}" class="snapdot"/>`); } if(M.a&&M.hover) out.push(dimSvg(M.a,M.hover,fmtL(Math.hypot(M.hover[0]-M.a[0],M.hover[1]-M.a[1])),'dima')); }
    else if(DRAFT.drop){ const T=OBJ[DRAFT.drop.k]; if(T){ const b={x:DRAFT.drop.x-T.w/2,y:DRAFT.drop.y-T.d/2,w:T.w,h:T.d,shape:T.shape==='round'?'round':'rect'}; out.push(`<polygon points="${ptsAttr(worldPts(b))}" class="ghost"/>`); } } }
  if(DRAG&&DRAG.k==='box'){ const a=DRAG.a, b=DRAG.b, cr=b[0]<a[0]; out.push(`<rect x="${Math.min(a[0],b[0])}" y="${Math.min(a[1],b[1])}" width="${Math.abs(b[0]-a[0])}" height="${Math.abs(b[1]-a[1])}" class="mq${cr?' cross':''}"/>`); }
  if(PRO&&PREF.rulers&&!NORULER) out.push(rulers(svg.getBoundingClientRect()));
  svg.innerHTML=out.join(''); }

/* ---------------- touching the plan ---------------- */
const PTR=new Map(); let DRAG=null, PINCH=null;
const SNAP=()=>PREF.snap?(P.grid||.1):.01;
function setView(s,ax,ay){ s=Math.max(6,Math.min(400,s)); const k=s/VIEW.s; VIEW.ox=ax-(ax-VIEW.ox)*k; VIEW.oy=ay-(ay-VIEW.oy)*k; VIEW.s=s; draw(); status(); }
function fit(){ if(svg.style.display==='none') return; const L=items().filter(i=>i.kind!=='door'&&i.kind!=='window'&&i.kind!=='dim'&&!isHidden(i)); const r=svg.getBoundingClientRect(); if(!L.length){ VIEW={s:40,ox:r.width/2-200,oy:r.height/2-160}; draw(); return; }
  const b=bbox(L.flatMap(worldPts)), pad=PRO?48:36, s=Math.min((r.width-pad*2)/Math.max(1,b[2]-b[0]),(r.height-pad*2)/Math.max(1,b[3]-b[1]));
  VIEW.s=Math.max(6,Math.min(160,s)); VIEW.ox=(r.width-(b[2]-b[0])*VIEW.s)/2-b[0]*VIEW.s; VIEW.oy=(r.height-(b[3]-b[1])*VIEW.s)/2-b[1]*VIEW.s; draw(); status(); }
function centerOn(p){ const r=svg.getBoundingClientRect(); VIEW.s=Math.max(VIEW.s,40); VIEW.ox=r.width/2-p[0]*VIEW.s; VIEW.oy=r.height*(PRO?.5:.35)-p[1]*VIEW.s; }
/* magnets: a straight item's edges stick to nearby edges of other straight spaces (rooms side by side) and of the wall it stands in */
function magnet(it,moving){ if(!PREF.mag||((it.r||0)%90)!==0) return; const tol=Math.max(.12,10/VIEW.s), b=bbox(worldPts(it));
  const others=items().filter(o=>o!==it&&o.kind==='space'&&!isHidden(o)&&((o.r||0)%90)===0&&(it.kind==='space'||inside(ctr(it),worldPts(o))));
  let bx=null, by=null;
  others.forEach(o=>{ const q=bbox(worldPts(o)), xs=[q[0],q[2]], ys=[q[1],q[3]];
    xs.forEach(X=>[b[0],b[2]].forEach(v=>{ const d=X-v; if(Math.abs(d)<tol&&(bx==null||Math.abs(d)<Math.abs(bx))) bx=d; }));
    ys.forEach(Y=>[b[1],b[3]].forEach(v=>{ const d=Y-v; if(Math.abs(d)<tol&&(by==null||Math.abs(d)<Math.abs(by))) by=d; })); });
  if(moving){ if(bx!=null) it.x=r2(it.x+bx); if(by!=null) it.y=r2(it.y+by); } }
/* measuring sticks to corners of rooms and things */
function snapPt(w,from,ortho){ const tol=12/VIEW.s; let best=null, bd=tol; const HS=hiddenSpaces();
  items().forEach(it=>{ if(isHidden(it,null,HS)) return; let pts=[]; if(it.kind==='space'||it.kind==='obj') pts=it.kind==='obj'?(()=>{ const b=bbox(worldPts(it)); return [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]; })():worldPts(it).length<=12?worldPts(it):[]; else if(it.kind==='dim') pts=[it.a,it.b];
    pts.forEach(p=>{ const d=Math.hypot(p[0]-w[0],p[1]-w[1]); if(d<bd){ bd=d; best=p; } }); });
  let p=best?[r2(best[0]),r2(best[1])]:[r2(snapv(w[0],SNAP())),r2(snapv(w[1],SNAP()))];
  if(ortho&&from){ if(Math.abs(p[0]-from[0])>Math.abs(p[1]-from[1])) p=[p[0],from[1]]; else p=[from[0],p[1]]; }
  return {p,snapped:!!best}; }
function hitOf(e){ const t=e.target; if(t.closest('[data-h]')) return {h:t.closest('[data-h]').dataset.h}; const g=t.closest('[data-id]'); return g?{id:g.dataset.id}:{}; }
function boxSelect(a,b,add){ const x0=Math.min(a[0],b[0]), x1=Math.max(a[0],b[0]), y0=Math.min(a[1],b[1]), y1=Math.max(a[1],b[1]), crossing=b[0]<a[0], HS=hiddenSpaces(), pick=[];
  items().forEach(it=>{ if(isHidden(it,null,HS)||layerLocked(it)) return; const bb=itemBox(it); if(!bb) return; const A=W2S([bb[0],bb[1]]), B=W2S([bb[2],bb[3]]);
    const inn=A[0]>=x0&&B[0]<=x1&&A[1]>=y0&&B[1]<=y1, over=!(B[0]<x0||A[0]>x1||B[1]<y0||A[1]>y1);
    if(it.kind==='space'?inn:(crossing?over:inn)) pick.push(it.id); });   /* a room only when the box holds all of it */
  if(!add) SELS=new Set(); pick.forEach(id=>SELS.add(id)); SEL=SELS.size?[...SELS].pop():null; }
function snapPositions(){ const m={}; selList().forEach(it=>{ m[it.id]=it.kind==='dim'?{a:it.a.slice(),b:it.b.slice()}:{x:it.x,y:it.y}; if(it.kind==='space') childrenOf(it).forEach(c=>{ if(!SELS.has(c.id)&&!m[c.id]) m[c.id]={x:c.x,y:c.y}; }); }); return m; }
svg.addEventListener('contextmenu',e=>e.preventDefault());
svg.addEventListener('pointerdown',e=>{
  hideCtx(); svg.setPointerCapture(e.pointerId); PTR.set(e.pointerId,[e.clientX,e.clientY]);
  if(PTR.size===2){ const [a,b]=[...PTR.values()]; PINCH={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:VIEW.s,mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2,ox:VIEW.ox,oy:VIEW.oy}; DRAG=null; DRAFT=DRAFT&&(DRAFT.pts||DRAFT.meas)?DRAFT:null; draw(); return; }
  const r=svg.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top, w=S2W(e.clientX,e.clientY), sw=[snapv(w[0],SNAP()),snapv(w[1],SNAP())], hit=hitOf(e), mouse=e.pointerType==='mouse';
  if(e.button===1||e.button===2||SPACEDOWN||TOOL==='hand'){ DRAG={k:'pan',x:e.clientX,y:e.clientY,ox:VIEW.ox,oy:VIEW.oy,btn:e.button,moved:false,hit}; return; }
  if(TOOL==='measure'){ const s=snapPt(w,DRAFT&&DRAFT.meas&&DRAFT.meas.a,e.shiftKey); DRAFT=DRAFT&&DRAFT.meas?DRAFT:{meas:{}};
    if(!DRAFT.meas.a){ DRAFT.meas={a:s.p,hover:s.p,snapped:s.snapped}; hint('Tap the end point · Shift = straight','Cancel'); draw(); return; }
    const a=DRAFT.meas.a, b=s.p; if(Math.hypot(b[0]-a[0],b[1]-a[1])<.05){ toast('Too short · tap a second point'); return; }
    commit(); const d={id:uid(),kind:'dim',a,b}; items().push(d); DRAFT={meas:{}}; hint('Measured '+fmtL(Math.hypot(b[0]-a[0],b[1]-a[1]))+' · tap again for another','Done'); changed(); return; }
  if(TOOL==='poly'){ DRAFT=DRAFT&&DRAFT.pts?DRAFT:{pts:[]}; const f=DRAFT.pts[0]; if(f&&DRAFT.pts.length>=3&&Math.hypot(f[0]-sw[0],f[1]-sw[1])*VIEW.s<18){ finishPoly(); return; } DRAFT.pts.push(sw); hint(DRAFT.pts.length<3?'Tap the corners · '+DRAFT.pts.length+' so far':'Tap the first corner (or Done) to close',DRAFT.pts.length>=3?'Done':''); draw(); return; }
  if(TOOL==='rect'||TOOL==='square'||TOOL==='circle'||TOOL==='tri'){ DRAG={k:'draw',a:sw}; DRAFT={box:{x:sw[0],y:sw[1],w:0,h:0,shape:TOOL==='circle'?'circle':TOOL==='tri'?'tri':'rect'}}; return; }
  if(TOOL==='door'||TOOL==='window'){ const n=nearestWall(w,Math.max(.6,24/VIEW.s)); if(!n){ toast('Tap ON a wall to put the '+TOOL+' there'); return; }
    commit(); const wd=TOOL==='door'?.9:1.2, half=Math.min(.45,wd/2/Math.max(n.len,wd)); const o={id:uid(),kind:TOOL,sp:n.sp,e:n.e,t:Math.max(half,Math.min(1-half,n.t)),w:Math.min(wd,n.len*.9),side:1};
    items().push(o); sel1(o.id); changed(); openInspector(); return; }
  /* select tool */
  if(hit.h!=null){ const it=SEL&&byId(SEL); if(!it) return; commitLazy();
    if(hit.h==='da'||hit.h==='db'){ DRAG={k:'dimpt',which:hit.h==='da'?'a':'b',moved:false}; return; }
    DRAG={k:hit.h==='rot'?'rot':'size',c:+hit.h,orig:JSON.parse(JSON.stringify(it)),opp:hit.h==='rot'?null:worldPts({x:it.x,y:it.y,w:it.w,h:it.h,r:it.r||0})[(+hit.h+2)%4]}; return; }
  if(hit.id){ const it=byId(hit.id); if(!it) return;
    if(e.shiftKey||e.ctrlKey||e.metaKey){ if(SELS.has(it.id)){ SELS.delete(it.id); SEL=SELS.size?[...SELS].pop():null; } else { SELS.add(it.id); SEL=it.id; } DRAG=null; afterSel(); return; }
    if(SELS.size>1&&SELS.has(it.id)){ commitLazy(); DRAG={k:'gmove',w0:w,lead:it.id,orig:snapPositions(),moved:false}; return; }
    if(PRO&&mouse&&it.kind==='space'&&SEL!==it.id){ DRAG={k:'pend',id:it.id,a:[sx,sy],b:[sx,sy]}; return; }
    if(SEL!==it.id||SELS.size!==1){ sel1(it.id); afterSel(); }
    if(isLocked(it)){ DRAG={k:'locked',x:e.clientX,y:e.clientY}; return; }
    commitLazy(); DRAG={k:'move',id:it.id,w0:w,orig:JSON.parse(JSON.stringify(it)),kids:it.kind==='space'?childrenOf(it).map(c=>[c,c.x,c.y]):[],moved:false}; return; }
  if(PRO&&mouse){ DRAG={k:'box',a:[sx,sy],b:[sx,sy],add:e.shiftKey||e.ctrlKey||e.metaKey}; return; }
  if(SELS.size){ selClear(); closeSheet(); afterSel(true); }
  DRAG={k:'pan',x:e.clientX,y:e.clientY,ox:VIEW.ox,oy:VIEW.oy,btn:0,moved:false};
});
let LAZY=false; function commitLazy(){ LAZY=true; }
function lazyCommit(){ if(LAZY){ commit(); LAZY=false; } }
svg.addEventListener('pointermove',e=>{
  if(PTR.has(e.pointerId)) PTR.set(e.pointerId,[e.clientX,e.clientY]);
  const r=svg.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top; CUR=S2W(e.clientX,e.clientY); cursorMarks(sx,sy);
  if(PINCH&&PTR.size>=2){ const [a,b]=[...PTR.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); const s=Math.max(6,Math.min(400,PINCH.s*d/PINCH.d)), mx=(a[0]+b[0])/2-r.left, my=(a[1]+b[1])/2-r.top, m0x=PINCH.mx-r.left, m0y=PINCH.my-r.top;
    VIEW.s=s; VIEW.ox=mx-(m0x-PINCH.ox)*s/PINCH.s; VIEW.oy=my-(m0y-PINCH.oy)*s/PINCH.s; draw(); return; }
  const w=CUR, g=SNAP();
  if(DRAFT&&DRAFT.pts&&TOOL==='poly'){ DRAFT.hover=[snapv(w[0],g),snapv(w[1],g)]; draw(); return; }
  if(DRAFT&&DRAFT.meas&&TOOL==='measure'){ const s=snapPt(w,DRAFT.meas.a,e.shiftKey); DRAFT.meas.hover=s.p; DRAFT.meas.snapped=s.snapped; draw(); return; }
  if(!DRAG) return;
  if(DRAG.k==='pan'){ if(Math.hypot(e.clientX-DRAG.x,e.clientY-DRAG.y)>4) DRAG.moved=true; VIEW.ox=DRAG.ox+e.clientX-DRAG.x; VIEW.oy=DRAG.oy+e.clientY-DRAG.y; draw(); return; }
  if(DRAG.k==='box'){ DRAG.b=[sx,sy]; draw(); return; }
  if(DRAG.k==='pend'){ if(Math.hypot(sx-DRAG.a[0],sy-DRAG.a[1])>5){ DRAG={k:'box',a:DRAG.a,b:[sx,sy],add:false}; draw(); } return; }
  if(DRAG.k==='locked'){ if(!DRAG.told&&Math.hypot(e.clientX-DRAG.x,e.clientY-DRAG.y)>8){ DRAG.told=1; toast('🔒 Locked · unlock it in its panel to move it'); } return; }
  if(DRAG.k==='draw'){ const a=DRAG.a; let x1=snapv(w[0],g), y1=snapv(w[1],g); let W=x1-a[0], H=y1-a[1];
    if(TOOL==='square'||TOOL==='circle'){ const m=Math.max(Math.abs(W),Math.abs(H)); W=Math.sign(W||1)*m; H=Math.sign(H||1)*m; }
    if(TOOL==='circle'){ DRAFT.box={x:a[0]-Math.abs(W),y:a[1]-Math.abs(W),w:Math.abs(W)*2,h:Math.abs(W)*2,shape:'circle'}; }
    else DRAFT.box={x:Math.min(a[0],a[0]+W),y:Math.min(a[1],a[1]+H),w:Math.abs(W),h:Math.abs(H),shape:DRAFT.box.shape}; draw(); return; }
  if(DRAG.k==='gmove'){ const lead=byId(DRAG.lead), o0=DRAG.orig[DRAG.lead]; if(!lead||!o0) return; let dx=w[0]-DRAG.w0[0], dy=w[1]-DRAG.w0[1]; if(!DRAG.moved&&Math.hypot(dx,dy)*VIEW.s<4) return; if(!DRAG.moved){ lazyCommit(); DRAG.moved=true; }
    if(o0.x!=null){ dx=snapv(o0.x+dx,g)-o0.x; dy=snapv(o0.y+dy,g)-o0.y; } else { dx=snapv(dx,g); dy=snapv(dy,g); }
    Object.entries(DRAG.orig).forEach(([id,o])=>{ const it=byId(id); if(!it) return; if(it.kind==='dim'){ it.a=[r2(o.a[0]+dx),r2(o.a[1]+dy)]; it.b=[r2(o.b[0]+dx),r2(o.b[1]+dy)]; } else if(it.kind==='space'||it.kind==='obj'){ it.x=r2(o.x+dx); it.y=r2(o.y+dy); } }); draw(); return; }
  const it=SEL&&byId(SEL); if(!it) return;
  if(DRAG.k==='dimpt'){ lazyCommit(); DRAG.moved=true; const s=snapPt(w,DRAG.which==='a'?it.b:it.a,e.shiftKey); it[DRAG.which]=s.p; draw(); return; }
  if(DRAG.k==='move'){ const dx=w[0]-DRAG.w0[0], dy=w[1]-DRAG.w0[1]; if(!DRAG.moved&&Math.hypot(dx,dy)*VIEW.s<4) return; if(!DRAG.moved){ lazyCommit(); DRAG.moved=true; }
    if(it.kind==='door'||it.kind==='window'){ const n=nearestWall(w,Math.max(1,40/VIEW.s)); if(n){ const half=it.w/2/Math.max(n.len,it.w); it.sp=n.sp; it.e=n.e; it.t=Math.max(half,Math.min(1-half,n.t)); } draw(); return; }
    if(it.kind==='dim'){ const o=DRAG.orig, ddx=snapv(dx,g), ddy=snapv(dy,g); it.a=[r2(o.a[0]+ddx),r2(o.a[1]+ddy)]; it.b=[r2(o.b[0]+ddx),r2(o.b[1]+ddy)]; draw(); return; }
    it.x=r2(snapv(DRAG.orig.x+dx,g)); it.y=r2(snapv(DRAG.orig.y+dy,g)); magnet(it,true);
    const mx=it.x-DRAG.orig.x, my=it.y-DRAG.orig.y; DRAG.kids.forEach(([c,x,y])=>{ c.x=r2(x+mx); c.y=r2(y+my); }); draw(); return; }
  if(DRAG.k==='rot'){ const c=ctr(it); let a=Math.atan2(w[1]-c[1],w[0]-c[0])*180/Math.PI+90; a=e.shiftKey?a:snapv(a,15); it.r=((Math.round(a)%360)+360)%360; draw(); return; }
  if(DRAG.k==='size'){ lazyCommit(); const o=DRAG.orig, rr=(o.r||0)*Math.PI/180, sxn=[-1,1,1,-1][DRAG.c], syn=[-1,-1,1,1][DRAG.c], opp=DRAG.opp;
    const vx=w[0]-opp[0], vy=w[1]-opp[1], lx=vx*Math.cos(-rr)-vy*Math.sin(-rr), ly=vx*Math.sin(-rr)+vy*Math.cos(-rr), mn=it.kind==='obj'?.2:.5;
    let W=Math.max(mn,snapv(lx*sxn,g)), H=Math.max(mn,snapv(ly*syn,g)); if(it.shape==='circle'||(it.kind==='obj'&&it.shape==='round'&&o.w===o.h)) { W=H=Math.max(W,H); }
    const cx=opp[0]+(sxn*W/2)*Math.cos(rr)-(syn*H/2)*Math.sin(rr), cy=opp[1]+(sxn*W/2)*Math.sin(rr)+(syn*H/2)*Math.cos(rr);
    it.w=r2(W); it.h=r2(H); it.x=r2(cx-W/2); it.y=r2(cy-H/2); draw(); return; }
});
function endPtr(e){ PTR.delete(e.pointerId); if(PTR.size<2) PINCH=null;
  if(DRAG&&DRAG.k==='draw'&&DRAFT&&DRAFT.box){ const b=DRAFT.box; DRAFT=null; DRAG=null;
    if(b.w>=.5&&b.h>=.5){ commit(); const s={id:uid(),kind:'space',type:NEWTYPE,shape:b.shape,x:r2(b.x),y:r2(b.y),w:r2(b.w),h:r2(b.h),r:0}; autoName(s); items().push(s); sel1(s.id); setTool('select'); changed(); openInspector(); }
    else { draw(); hint('Drag to draw · at least 0.5 m'); setTimeout(()=>{ if(/rect|square|circle|tri/.test(TOOL)) setTool(TOOL); },1600); } return; }
  if(DRAG&&DRAG.k==='pan'&&DRAG.btn===2&&!DRAG.moved&&e.type==='pointerup'){ const h=DRAG.hit||{}; DRAG=null; showCtx(e.clientX,e.clientY,h.id&&byId(h.id)); return; }
  if(DRAG&&DRAG.k==='pan'&&DRAG.moved) status();
  if(DRAG&&DRAG.k==='box'){ const a=DRAG.a, b=DRAG.b, add=DRAG.add; DRAG=null; if(Math.hypot(b[0]-a[0],b[1]-a[1])>5){ boxSelect(a,b,add); } else if(!add){ selClear(); } afterSel(); return; }
  if(DRAG&&DRAG.k==='pend'){ const id=DRAG.id; DRAG=null; sel1(id); afterSel(); return; }
  if(DRAG&&(DRAG.k==='gmove'||DRAG.k==='dimpt')){ const m=DRAG.moved; DRAG=null; LAZY=false; if(m){ changed(); renderPanel(); } else draw(); return; }
  if(DRAG&&(DRAG.moved||DRAG.k==='size'||DRAG.k==='rot')){ DRAG=null; LAZY=false; changed(); openInspector(true); return; }
  if(DRAG&&DRAG.k==='move'&&!DRAG.moved&&!PRO&&!$('sheet').classList.contains('on')) openInspector();
  DRAG=null; LAZY=false; }
svg.addEventListener('pointerup',endPtr); svg.addEventListener('pointercancel',endPtr);
svg.addEventListener('pointerleave',()=>{ cursorMarks(-99,-99); });
svg.addEventListener('wheel',e=>{ e.preventDefault(); const r=svg.getBoundingClientRect(); if(e.shiftKey&&!e.ctrlKey){ VIEW.ox-=e.deltaY; draw(); return; } setView(VIEW.s*Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top); },{passive:false});
svg.addEventListener('dblclick',e=>{ if(TOOL==='poly'&&DRAFT&&DRAFT.pts&&DRAFT.pts.length>=3) finishPoly(); });
function finishPoly(){ const Q=DRAFT&&DRAFT.pts; if(!Q||Q.length<3){ toast('A shape needs 3 corners or more'); return; }
  const b=bbox(Q), W=Math.max(.5,b[2]-b[0]), H=Math.max(.5,b[3]-b[1]); commit();
  const s={id:uid(),kind:'space',type:NEWTYPE,shape:'poly',x:r2(b[0]),y:r2(b[1]),w:r2(W),h:r2(H),r:0,pts:Q.map(p=>[r2((p[0]-b[0])/W),r2((p[1]-b[1])/H)])};
  if(area(worldPts(s))<.25){ HIST.u.pop(); toast('That shape has no area · try again'); DRAFT=null; draw(); return; }
  autoName(s); items().push(s); DRAFT=null; sel1(s.id); setTool('select'); hint(''); changed(); openInspector(); }
function autoName(s){ const t=ST[s.type]||ST.other; if(!t.guest) return; const base=(FL||0)*100+1, used=new Set(P.floors.flatMap(f=>f.items).filter(i=>i.no&&i!==s).map(i=>String(i.no))); let n=base; while(used.has(String(n))) n++; s.no=String(n); s.cat=s.cat&&(CATS[s.type]||[]).includes(s.cat)?s.cat:(CATS[s.type]||['Standard'])[0]; s.beds=s.beds||'1 king'; s.guests=s.guests||2; s.rate=s.rate||(s.type==='suite'?4500:2500); }
let NEWTYPE='room';
function placeObj(k,at){ const T=OBJ[k]; if(!T) return; let c=at, host=null;
  if(!c){ const r=svg.getBoundingClientRect(); c=S2W(r.left+r.width/2,r.top+r.height/2); const h=SEL&&byId(SEL); if(h&&h.kind==='space'){ c=ctr(h); host=h; } else if(h&&h.kind==='obj'){ const s=spaceOf(ctr(h)); if(s){ c=ctr(s); host=s; } } }
  commit(); const o={id:uid(),kind:'obj',t:k,shape:T.shape==='round'?'round':'box',x:r2(snapv(c[0]-T.w/2,SNAP())),y:r2(snapv(c[1]-T.d/2,SNAP())),w:T.w,h:T.d,r:0}; items().push(o); if(at) magnet(o,true);
  sel1(o.id); setTool('select'); changed(); openInspector(); toast(T.n+' · drag it into place · corners resize · ⟳ turns');
  if(PRO&&document.body.classList.contains('libfloat')){ PREF.lib=false; layout(); } }

/* ---------------- keys ---------------- */
document.addEventListener('keydown',e=>{ if(MODE==='walk') return; const typing=/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||''); if(typing) return;
  const mod=e.ctrlKey||e.metaKey, k=e.key.toLowerCase();
  if(e.key===' '){ if(!SPACEDOWN){ SPACEDOWN=true; svg.style.cursor='grab'; } e.preventDefault(); return; }
  if(mod&&k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; } if(mod&&k==='y'){ e.preventDefault(); redo(); return; }
  if(mod&&k==='a'){ e.preventDefault(); const HS=hiddenSpaces(); SELS=new Set(items().filter(i=>!isHidden(i,null,HS)&&!layerLocked(i)).map(i=>i.id)); SEL=SELS.size?[...SELS].pop():null; afterSel(); return; }
  if(mod&&k==='c'){ if(SELS.size){ e.preventDefault(); copySel(); } return; }
  if(mod&&k==='v'){ if(CLIP){ e.preventDefault(); paste(CUR); } return; }
  if(mod&&k==='d'){ e.preventDefault(); dup(); return; }
  if(e.key==='Escape'){ hideCtx(); if(DRAFT){ DRAFT=null; hint(''); if(TOOL==='measure'||TOOL==='poly') setTool('select'); else draw(); } else if(TOOL!=='select') setTool('select'); else { selClear(); closeSheet(); afterSel(true); } return; }
  if(e.key==='Enter'&&TOOL==='poly'){ finishPoly(); return; }
  if(!mod&&!e.altKey&&MODE!=='3d'){ const tool={v:'select',h:'hand',d:'door',w:'window',m:'measure'}[k];
    if(tool&&(tool!=='hand'||PRO)){ setTool(tool); return; } if(k==='s'){ shapeSheet(); return; } if(k==='o'){ libOpen(); return; } if(k==='f'){ fit(); return; } if(e.key==='?'){ helpSheet(); return; } }
  if(!SELS.size) return;
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); del(); return; }
  if(k==='r'&&!mod){ const L=selList().filter(i=>(i.kind==='obj'||i.kind==='space')&&!isLocked(i)); if(!L.length) return; commit(); L.forEach(it=>{ it.r=((it.r||0)+(e.shiftKey?-90:90)+360)%360; }); changed(); renderPanel(); return; }
  const step=e.shiftKey?1:SNAP(), mv={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
  if(mv){ const L=selList().filter(i=>i.kind!=='door'&&i.kind!=='window'&&!isLocked(i)); if(!L.length) return; e.preventDefault(); commit(); L.forEach(i=>moveBy(i,mv[0],mv[1])); changed(); } });
document.addEventListener('keyup',e=>{ if(e.key===' '){ SPACEDOWN=false; svg.style.cursor=''; } });
function moveBy(i,dx,dy){ if(i.kind==='dim'){ i.a=[r2(i.a[0]+dx),r2(i.a[1]+dy)]; i.b=[r2(i.b[0]+dx),r2(i.b[1]+dy)]; return; } if(i.kind==='door'||i.kind==='window') return;
  if(i.kind==='space') childrenOf(i).forEach(c=>{ if(!SELS.has(c.id)){ c.x=r2(c.x+dx); c.y=r2(c.y+dy); } }); i.x=r2(i.x+dx); i.y=r2(i.y+dy); }

/* ---------------- actions on the selection ---------------- */
function del(){ const L=selList(); if(!L.length) return; commit(); const f=floor(), gone=new Set(L.map(i=>i.id)); let ops=0;
  L.forEach(it=>{ if(it.kind==='space') f.items.forEach(o=>{ if((o.kind==='door'||o.kind==='window')&&o.sp===it.id&&!gone.has(o.id)){ gone.add(o.id); ops++; } }); });
  f.items=f.items.filter(o=>!gone.has(o.id)); selClear(); closeSheet(); changed(); afterSel(true);
  toast((L.length>1?'Removed '+L.length:'Removed')+(ops?' with '+ops+' door/window'+(ops>1?'s':''):'')+' · ↶ to bring back'); }
/* a copy of the selection, rooms with what is inside them and their doors */
function gather(ids){ const f=floor(), seen=new Set(), out=[], add=o=>{ if(!seen.has(o.id)){ seen.add(o.id); out.push(JSON.parse(JSON.stringify(o))); } };
  ids.forEach(id=>{ const it=byId(id); if(!it) return; add(it); if(it.kind==='space'){ const P0=worldPts(it); f.items.forEach(o=>{ if(o.kind==='obj'&&inside(ctr(o),P0)) add(o); if((o.kind==='door'||o.kind==='window')&&o.sp===it.id) add(o); }); } }); return out; }
function pasteList(list,dx,dy,tops){ const map={}; list.forEach(o=>{ map[o.id]=uid(); }); const added=[];
  list.forEach(o=>{ const k=JSON.parse(JSON.stringify(o)); k.id=map[o.id]; if(k.kind==='door'||k.kind==='window'){ if(!map[o.sp]) return; k.sp=map[o.sp]; } else if(k.kind==='dim'){ k.a=[r2(k.a[0]+dx),r2(k.a[1]+dy)]; k.b=[r2(k.b[0]+dx),r2(k.b[1]+dy)]; } else { k.x=r2(k.x+dx); k.y=r2(k.y+dy); }
    if(k.no){ delete k.no; } items().push(k); if(k.kind==='space'&&(ST[k.type]||{}).guest) autoName(k); added.push(k); });
  const top=(tops||list.map(o=>o.id)).map(id=>map[id]).filter(Boolean); SELS=new Set(top); SEL=top.length?top[top.length-1]:null; return added; }
function dup(){ const L=selList().filter(i=>i.kind!=='door'&&i.kind!=='window'); if(!L.length) return; commit();
  const bb=bbox(L.flatMap(i=>{ const b=itemBox(i); return [[b[0],b[1]],[b[2],b[3]]]; })), sp=L.some(i=>i.kind==='space'), dx=sp?r2(bb[2]-bb[0]):.3, dy=sp?0:.3;
  const ids=L.map(i=>i.id), list=gather(ids); pasteList(list,dx,dy,ids); changed(); afterSel(); toast((L.length>1?L.length+' copied':'Copied')+(sp?' with everything inside':'')); }
function copySel(){ const ids=selList().filter(i=>i.kind!=='door'&&i.kind!=='window').map(i=>i.id); if(!ids.length) return; const list=gather(ids), bb=bbox(list.filter(o=>o.kind!=='door'&&o.kind!=='window').flatMap(o=>{ const b=o.kind==='dim'?bbox([o.a,o.b]):bbox(worldPts(o)); return [[b[0],b[1]],[b[2],b[3]]]; }));
  CLIP={list,tops:ids,c:[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2]}; toast('Copied '+ids.length+' · Ctrl+V pastes where the mouse is'); }
function paste(at){ if(!CLIP) return; commit(); const p=at||[CLIP.c[0]+.5,CLIP.c[1]+.5], dx=r2(snapv(p[0]-CLIP.c[0],SNAP())), dy=r2(snapv(p[1]-CLIP.c[1],SNAP())); pasteList(CLIP.list,dx,dy,CLIP.tops); changed(); afterSel(); toast('Pasted'); }
function alignSel(k){ const L=selList().filter(i=>(i.kind==='space'||i.kind==='obj')&&!isLocked(i)); if(L.length<2){ toast('Pick 2 or more to line up'); return; } commit();
  const B=L.map(i=>({i,b:bbox(worldPts(i))})), A=[Math.min(...B.map(x=>x.b[0])),Math.min(...B.map(x=>x.b[1])),Math.max(...B.map(x=>x.b[2])),Math.max(...B.map(x=>x.b[3]))];
  if(k==='dh'||k==='dv'){ if(L.length<3){ toast('Spreading needs 3 or more'); HIST.u.pop(); return; } const ax=k==='dh'?0:1; B.sort((p,q)=>(p.b[ax]+p.b[ax+2])-(q.b[ax]+q.b[ax+2])); const span=B[B.length-1].b[ax+2]-B[0].b[ax], used=B.reduce((n,x)=>n+x.b[ax+2]-x.b[ax],0), gap=(span-used)/(B.length-1); let pos=B[0].b[ax+2]+gap;
    B.slice(1,-1).forEach(x=>{ const d=r2(pos-x.b[ax]); moveBy(x.i,ax?0:d,ax?d:0); pos+=x.b[ax+2]-x.b[ax]+gap; }); }
  else if(k==='sw'||k==='sh'){ const lead=byId(SEL)||L[0]; L.forEach(i=>{ if(i===lead) return; const c=ctr(i); if(k==='sw') i.w=lead.w; else i.h=lead.h; i.x=r2(c[0]-i.w/2); i.y=r2(c[1]-i.h/2); }); }
  else B.forEach(({i,b})=>{ let dx=0, dy=0; if(k==='l') dx=A[0]-b[0]; if(k==='r') dx=A[2]-b[2]; if(k==='c') dx=(A[0]+A[2])/2-(b[0]+b[2])/2; if(k==='t') dy=A[1]-b[1]; if(k==='b') dy=A[3]-b[3]; if(k==='m') dy=(A[1]+A[3])/2-(b[1]+b[3])/2; moveBy(i,r2(dx),r2(dy)); });
  changed(); renderPanel(); }
function setFlag(f,v){ const L=selList(); if(!L.length) return; commit(); L.forEach(i=>{ if(v) i[f]=true; else delete i[f]; }); if(f==='hid'&&v){ selClear(); } changed(); afterSel(true); toast(f==='lock'?(v?'🔒 Locked':'🔓 Unlocked'):(v?'Hidden · Layers tab shows it again':'Shown')); }
function selectSame(it){ const HS=hiddenSpaces(); SELS=new Set(items().filter(o=>o.kind==='obj'&&o.t===it.t&&!isHidden(o,null,HS)).map(o=>o.id)); SEL=it.id; afterSel(); toast(SELS.size+' × '+itemName(it)+' selected'); }
/* right-click menu */
function showCtx(x,y,it){ const m=$('ctx'); let h='';
  if(it){ if(!SELS.has(it.id)){ sel1(it.id); afterSel(); } const n=SELS.size, op=it.kind==='door'||it.kind==='window';
    h=`<button data-c="dup">⧉ Copy here${n>1?' ('+n+')':''}<kbd>Ctrl D</kbd></button><button data-c="copy">📋 Copy<kbd>Ctrl C</kbd></button>${op?'':'<button data-c="rot">⟳ Turn 90°<kbd>R</kbd></button>'}<button data-c="${isLocked(it)?'unlock':'lock'}">${isLocked(it)?'🔓 Unlock':'🔒 Lock'}</button><button data-c="hide">🙈 Hide</button>${it.kind==='obj'?`<button data-c="same">◎ Select every “${esc(itemName(it))}”</button>`:''}${MODE==='split'?'<button data-c="fly">🎯 Show in 3D</button>':''}<hr><button data-c="del" style="color:var(--bad)">🗑 Remove${n>1?' '+n:''}<kbd>Del</kbd></button>`; }
  else h=`${CLIP?'<button data-c="paste">📋 Paste here<kbd>Ctrl V</kbd></button>':''}<button data-c="all">▣ Select all<kbd>Ctrl A</kbd></button><button data-c="fit">⤢ Fit to screen<kbd>F</kbd></button><button data-c="meas">📏 Measure<kbd>M</kbd></button>`;
  m.innerHTML=h; m.hidden=false; const W=m.offsetWidth, H=m.offsetHeight; m.style.left=Math.min(x,innerWidth-W-8)+'px'; m.style.top=Math.min(y,innerHeight-H-8)+'px';
  const at=S2W(x,y); m.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ hideCtx(); const c=b.dataset.c;
    if(c==='dup') dup(); else if(c==='copy') copySel(); else if(c==='rot'){ const L=selList().filter(i=>(i.kind==='obj'||i.kind==='space')&&!isLocked(i)); if(L.length){ commit(); L.forEach(i=>{ i.r=((i.r||0)+90)%360; }); changed(); } }
    else if(c==='lock') setFlag('lock',true); else if(c==='unlock') setFlag('lock',false); else if(c==='hide') setFlag('hid',true); else if(c==='same') selectSame(it); else if(c==='del') del();
    else if(c==='paste') paste(at); else if(c==='all'){ const HS=hiddenSpaces(); SELS=new Set(items().filter(i=>!isHidden(i,null,HS)&&!layerLocked(i)).map(i=>i.id)); SEL=[...SELS].pop()||null; afterSel(); } else if(c==='fit') fit(); else if(c==='meas') setTool('measure'); else if(c==='fly'&&V3) V3.focus(it.id); }); }
function hideCtx(){ $('ctx').hidden=true; }
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('#ctx')) hideCtx(); },true);

/* ---------------- tools, floors, sheets ---------------- */
const IC={select:'<path d="M5 3l14 8-6 1.5L10 19z"/>',hand:'<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 14a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',space:'<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 12h6"/>',door:'<path d="M5 20V4h9v16"/><path d="M14 4a10 10 0 0 1 5 9"/><circle cx="11.5" cy="12.5" r=".8"/>',window:'<rect x="4" y="6" width="16" height="12"/><path d="M12 6v12M4 12h16"/>',measure:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',obj:'<path d="M3 13h18v4H3zM5 13V9a2 2 0 0 1 2-2h4v6M13 13V8h4a2 2 0 0 1 2 2v3M5 17v2M19 17v2"/>',warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'};
const svgI=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function dock(){ const n=WARN.list.length;
  const T=PRO?[['select','Select','V'],['hand','Pan','H'],['-'],['space','Space','S'],['door','Door','D'],['window','Window','W'],['measure','Measure','M'],['-'],['obj','Objects','O']]:[['select','Select'],['space','Space'],['door','Door'],['window','Window'],['obj','Objects'],['measure','Measure']];
  const html=T.map(([k,l,key])=>k==='-'?'<span class="tool sep"></span>':`<button class="tool${TOOL===k||(k==='space'&&/rect|square|circle|tri|poly/.test(TOOL))||(k==='obj'&&PRO&&PREF.lib)?' on':''}" data-tool="${k}"${PRO?` data-tip="${l} · ${key}"`:''}>${svgI(k)}${l}</button>`).join('')+
    `<button class="tool warn${n?'':' ok'}" data-tool="warn"${PRO?' data-tip="Checks"':''}>${svgI('warn')}${n?n+(PRO?'':' to check'):(PRO?'OK':'All good')}</button>`;
  if($('dock').dataset.h===html) return; $('dock').dataset.h=html; $('dock').innerHTML=html;
  $('dock').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ const k=b.dataset.tool; if(k==='space') shapeSheet(); else if(k==='obj') libOpen(); else if(k==='warn') warnSheet(); else setTool(k); }); }
function setTool(k){ if(MODE==='3d'&&k!=='select'&&k!=='hand') setMode(PRO?'split':'2d'); TOOL=k; DRAFT=k==='measure'?{meas:{}}:null; if(k!=='select'&&k!=='hand'){ selClear(); closeSheet(); }
  hint(k==='door'?'Tap on a wall to put a door':k==='window'?'Tap on a wall to put a window':k==='poly'?'Tap the corners · tap the first one to close':k==='measure'?'Tap the start point · it sticks to corners':/rect|square|circle|tri/.test(k)?'Drag on the plan to draw · '+(ST[NEWTYPE]||{}).n:'', k==='select'||k==='hand'?'':'Cancel');
  svg.style.cursor=k==='hand'?'grab':/door|window|measure|rect|square|circle|tri|poly/.test(k)?'crosshair':'';
  dock(); draw(); status(); }
function floors(){ const html=P.floors.map((f,i)=>`<button class="chip${i===FL?' on':''}" data-fl="${i}">${esc(f.name)}</button>`).join('')+`<button class="chip" data-fl="+" title="add a floor">＋</button>`;
  if($('floors').dataset.h===html) return; $('floors').dataset.h=html; $('floors').innerHTML=html;
  $('floors').querySelectorAll('[data-fl]').forEach(b=>b.onclick=()=>{ const v=b.dataset.fl; if(v==='+'){ floorSheet(-1); return; } const i=+v; if(i===FL){ floorSheet(i); return; } FL=i; selClear(); closeSheet(); if(MODE!=='2d') show3d(true); if(MODE!=='3d'&&MODE!=='walk') fit(); floors(); dock(); renderPanel(); }); }
function hint(t,btn){ const h=$('hint'); if(!t){ h.classList.remove('on'); return; } h.innerHTML=esc(t)+(btn?`<button id="hintB">${esc(btn)}</button>`:''); h.classList.add('on'); const b=$('hintB'); if(b) b.onclick=()=>{ if(btn==='Done'&&TOOL==='poly') finishPoly(); else setTool('select'); }; }
let TT=null; function toast(t){ const e=$('toast'); e.textContent=t; e.classList.add('on'); clearTimeout(TT); TT=setTimeout(()=>e.classList.remove('on'),2600); }
function sheet(html,onWire){ $('sheetBody').innerHTML=html; $('sheet').classList.add('on'); if(onWire) onWire($('sheetBody')); const x=$('sheet').querySelector('[data-x]'); if(x) x.onclick=closeSheet; }
function closeSheet(){ $('sheet').classList.remove('on'); }
(function(){ const sh=$('sheet'); let y0=null; sh.addEventListener('touchstart',e=>{ if(sh.scrollTop<=0) y0=e.touches[0].clientY; },{passive:true}); sh.addEventListener('touchend',e=>{ if(y0!=null&&e.changedTouches[0].clientY-y0>80) closeSheet(); y0=null; },{passive:true}); })();
function shapeSheet(){ if(MODE==='3d') setMode(PRO?'split':'2d'); const sh=[['rect','Rectangle','<rect x="6" y="10" width="44" height="22" rx="1"/>'],['square','Square','<rect x="16" y="6" width="26" height="26"/>'],['circle','Circle','<circle cx="29" cy="20" r="14"/>'],['tri','Triangle','<path d="M29 5l17 30H12z"/>'],['poly','Any shape','<path d="M8 32l6-24 18 6 16-8-2 26z"/>']];
  sheet(`<h2>Draw a space <button class="ib x" data-x>✕</button></h2><button class="btn" data-sketch style="width:100%;margin:0 0 10px;text-align:left">📷 Plan from a paper sketch <small style="color:var(--muted);font-weight:600">· take a photo, the rooms are found for you</small></button><p style="margin:0 0 8px;color:var(--muted);font-size:13px">1 · what is it</p><div class="types">${STYPES.map(t=>`<button class="tp${NEWTYPE===t[0]?' on':''}" data-nt="${t[0]}"><i style="background:${t[2]}"></i>${esc(t[1])}</button>`).join('')}</div>
    <p style="margin:12px 0 8px;color:var(--muted);font-size:13px">2 · its shape, then drag on the plan</p><div class="shapes">${sh.map(s=>`<button class="li" data-sh="${s[0]}"><svg viewBox="0 0 58 40" fill="${(ST[NEWTYPE]||ST.other).c}" stroke="currentColor" stroke-width="2">${s[2]}</svg>${s[1]}</button>`).join('')}</div>`,root=>{
    root.querySelector('[data-sketch]').onclick=()=>{ closeSheet(); openSketch(); };
    root.querySelectorAll('[data-nt]').forEach(b=>b.onclick=()=>{ NEWTYPE=b.dataset.nt; shapeSheet(); });
    root.querySelectorAll('[data-sh]').forEach(b=>b.onclick=()=>{ closeSheet(); setTool(b.dataset.sh); }); }); }

/* ---------------- object library (phone sheet + laptop panel), pictures rendered in 3D ---------------- */
let LIBCAT='bedroom', LIBQ='';
function topSvg(T){ const sc=Math.min(48/T.w,32/T.d), w=T.w*sc, d=T.d*sc; return `<svg viewBox="0 0 56 40"><g transform="translate(28,20)">${T.shape==='round'?`<ellipse rx="${w/2}" ry="${d/2}" fill="${T.c}" stroke="rgba(0,0,0,.5)"/>`:`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="1.5" fill="${T.c}" stroke="rgba(0,0,0,.5)"/>`}</g></svg>`; }
const card=k=>{ const T=OBJ[k]; return `<button class="li" data-ob="${k}" title="${esc(T.n)} · ${T.w} × ${T.d} m · drag onto the plan"><span class="th">${THUMBS[k]?`<img alt="" src="${THUMBS[k]}">`:topSvg(T)}</span>${esc(T.n)}<small>${T.w} × ${T.d} m</small></button>`; };
function libOpen(){ if(PRO){ PREF.lib=!PREF.lib; savePref(); layout(); if(PREF.lib){ const q=$('libQ'); if(q&&document.body.classList.contains('libfloat')) q.focus(); } return; } libSheet(); }
function libSheet(){ const host=SEL&&byId(SEL); const cat=LIB[LIBCAT];
  sheet(`<h2>Objects <small style="font-size:12px;color:var(--muted);font-weight:600">real sizes${host&&host.kind==='space'?' · goes into '+esc(spaceLabel(host)):''}</small><button class="ib x" data-x>✕</button></h2><div class="cats">${Object.entries(LIB).map(([k,g])=>`<button class="chip${k===LIBCAT?' on':''}" data-lc="${k}">${g.n}</button>`).join('')}</div>
    <div class="lib">${cat.items.map(a=>card(a[0])).join('')}</div>`,root=>{ root.querySelectorAll('[data-lc]').forEach(b=>b.onclick=()=>{ LIBCAT=b.dataset.lc; libSheet(); }); });
  makeThumbs(cat.items.map(a=>a[0])); }
function libPanel(){ const el=$('lpanel'); if(!PRO){ el.innerHTML=''; return; }
  if(!el.dataset.built){ el.dataset.built=1; el.innerHTML=`<div class="lhead"><b>Objects <small>real sizes · drag onto the plan or into 3D</small></b><input class="lq" id="libQ" placeholder="Search · bed, sink, table…" autocomplete="off"></div><div class="lcats" id="lcats"></div><div class="lgrid" id="lgrid"></div><div class="lfoot" id="lfoot"></div>`;
    $('libQ').oninput=()=>{ LIBQ=$('libQ').value.trim().toLowerCase(); libGrid(); }; $('libQ').onkeydown=e=>{ if(e.key==='Enter'){ const f=$('lgrid').querySelector('[data-ob]'); if(f) placeObj(f.dataset.ob); } if(e.key==='Escape') $('libQ').blur(); }; }
  $('lcats').innerHTML=[['all','All']].concat(Object.entries(LIB).map(([k,g])=>[k,g.n])).map(([k,n])=>`<button class="chip${(LIBCAT===k||k==='all'&&LIBCAT==='all')?' on':''}" data-lc="${k}">${n}</button>`).join('');
  $('lcats').querySelectorAll('[data-lc]').forEach(b=>b.onclick=()=>{ LIBCAT=b.dataset.lc; libPanel(); });
  libGrid(); libFoot(); }
function libGrid(){ const g=$('lgrid'); if(!g) return; const q=LIBQ, out=[], keys=[];
  Object.entries(LIB).forEach(([ck,c])=>{ if(!q&&LIBCAT!=='all'&&LIBCAT!==ck) return; const its=c.items.filter(a=>!q||(a[1]+' '+c.n+' '+a[0]).toLowerCase().includes(q)); if(!its.length) return; if(q||LIBCAT==='all') out.push(`<h4>${c.n}</h4>`); its.forEach(a=>{ out.push(card(a[0])); keys.push(a[0]); }); });
  g.innerHTML=out.join('')||'<p style="grid-column:1/-1;color:var(--muted);font-size:13px">Nothing called that · try “bed”, “sink”, “table”.</p>'; makeThumbs(keys); }
function libFoot(){ const f=$('lfoot'); if(!f) return; const h=SEL&&byId(SEL), s=h&&(h.kind==='space'?h:h.kind==='obj'?spaceOf(ctr(h)):null); f.innerHTML=s?`Tap = into <b>${esc(spaceLabel(s))}</b> · or drag where you want it`:'Tap = middle of the screen · or drag where you want it'; }
let THBUSY=false; const THQ=new Set();
async function makeThumbs(keys){ keys.forEach(k=>{ if(!THUMBS[k]) THQ.add(k); }); if(THBUSY||!THQ.size) return; THBUSY=true;
  try{ V3=V3||await import('./planner3d.js'); while(THQ.size){ const batch=[...THQ].slice(0,6); batch.forEach(k=>THQ.delete(k)); await V3.thumbs(batch.map(k=>({k,T:OBJ[k]})),(k,url)=>{ THUMBS[k]=url; document.querySelectorAll(`[data-ob="${k}"] .th`).forEach(t=>{ t.innerHTML=`<img alt="" src="${url}">`; }); }); }
    try{ localStorage.setItem(THK,JSON.stringify(THUMBS)); }catch(e){} }catch(e){ /* no WebGL: the drawings stay */ } THBUSY=false; }
/* tap a card = add it; drag a card = drop it where you let go (plan or 3D) */
let LD=null;
document.addEventListener('pointerdown',e=>{ const c=e.target.closest('.li[data-ob]'); if(!c||e.button>0) return; LD={k:c.dataset.ob,x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,el:null}; });
document.addEventListener('pointermove',e=>{ if(!LD||e.pointerId!==LD.id) return; if(!LD.moved&&Math.hypot(e.clientX-LD.x,e.clientY-LD.y)<8) return;
  if(!LD.moved){ LD.moved=true; const d=document.createElement('div'); d.className='dragimg'; d.innerHTML=THUMBS[LD.k]?`<img alt="" src="${THUMBS[LD.k]}">`:topSvg(OBJ[LD.k]); document.body.appendChild(d); LD.el=d; if(!PRO) closeSheet(); }
  LD.el.style.left=e.clientX+'px'; LD.el.style.top=e.clientY+'px'; const r=svg.getBoundingClientRect(), on2=svg.style.display!=='none'&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  if(on2){ const w=S2W(e.clientX,e.clientY); DRAFT={drop:{k:LD.k,x:snapv(w[0],SNAP()),y:snapv(w[1],SNAP())}}; draw(); } else if(DRAFT&&DRAFT.drop){ DRAFT=null; draw(); } });
function ldEnd(e){ if(!LD||e.pointerId!==LD.id) return; const L=LD; LD=null; if(L.el) L.el.remove(); if(DRAFT&&DRAFT.drop){ DRAFT=null; }
  if(!L.moved){ if(e.type!=='pointerup') return; if(!PRO) closeSheet(); placeObj(L.k); return; }
  const r=svg.getBoundingClientRect(); if(svg.style.display!=='none'&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){ placeObj(L.k,S2W(e.clientX,e.clientY)); return; }
  if(V3&&MODE!=='2d'){ const p=V3.pickFloor(e.clientX,e.clientY); if(p){ placeObj(L.k,p); return; } } draw(); }
document.addEventListener('pointerup',ldEnd); document.addEventListener('pointercancel',ldEnd);

/* ---------------- what is selected: the panel (laptop) or the sheet (phone) ---------------- */
function inspector(it){ const num=(k,lab,v,st)=>`<label class="f">${lab}<input data-k="${k}" type="number" inputmode="decimal" step="${st||.1}" value="${v}"></label>`;
  const txt=(k,lab,v,ph)=>`<label class="f">${lab}<input data-k="${k}" value="${esc(v||'')}" placeholder="${esc(ph||'')}" maxlength="40"></label>`;
  const pick=(k,lab,opts,v)=>`<label class="f">${lab}<select data-k="${k}">${opts.map(([a,b])=>`<option value="${a}"${a===(v||'auto')?' selected':''}>${esc(b)}</option>`).join('')}</select></label>`;
  const col=(k,lab,v)=>`<label class="f">${lab}<input type="color" data-k="${k}" value="${v}"></label>`;
  const flags=`<div class="row"><label class="tgl"><input type="checkbox" data-k="lock"${it.lock?' checked':''}>🔒 Locked</label><label class="tgl"><input type="checkbox" data-k="hid"${it.hid?' checked':''}>🙈 Hidden</label></div>`;
  const XY=PRO&&it.kind!=='door'&&it.kind!=='window'&&it.kind!=='dim'?`<div class="row">${num('x','X m',r2(it.x))}${num('y','Y m',r2(it.y))}</div>`:'';
  let h='';
  if(it.kind==='space'){ const t=ST[it.type]||ST.other, A=area(worldPts(it));
    h=`<h2><i style="width:14px;height:14px;border-radius:4px;background:${t.c};border:1px solid var(--line2)"></i>${esc(spaceLabel(it))}<small style="font-size:12px;color:var(--muted);font-weight:600">${A.toFixed(1)} m²</small>${PRO?'':'<button class="ib x" data-x>✕</button>'}</h2>
      <label class="f">What is it<select data-k="type">${STYPES.map(s=>`<option value="${s[0]}"${s[0]===it.type?' selected':''}>${esc(s[1])}</option>`).join('')}</select></label>
      ${t.guest?`<div class="row">${txt('no','Room no.',it.no,'101')}<label class="f">Category<select data-k="cat">${(CATS[it.type]||CATS.room).map(c=>`<option${c===it.cat?' selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
      <div class="row">${txt('beds','Beds',it.beds,'1 king')}${num('guests','Max guests',it.guests||2,1)}${num('rate','Rate / night ₹',it.rate||0,50)}</div>`:`<div class="row">${txt('name','Name',it.name,t.n)}</div>`}
      ${XY}<div class="row">${num('w','Width m',r2(it.w))}${num('h','Depth m',r2(it.h))}${num('r','Turn °',Math.round(it.r||0),15)}</div>
      ${PRO?'<p class="ph">Look (3D)</p>':''}<div class="row">${pick('fl','Floor',FLOORN,it.fl)}</div><div class="row">${col('wc','Wall colour',it.wc||'#f3eee6')}${num('wh','Wall height m',it.wh||2.8,.1)}</div>${flags}`; }
  else if(it.kind==='obj'){ const T=OBJ[it.t]||{n:'Object',c:'#bbbbbb',ht:.8};
    h=`<h2>${esc(it.name||T.n)}<small style="font-size:12px;color:var(--muted);font-weight:600">${esc((LIB[T.cat]||{}).n||'')}</small>${PRO?'':'<button class="ib x" data-x>✕</button>'}</h2>
      <div class="row">${txt('name','Name',it.name,T.n)}</div>${XY}<div class="row">${num('w','Width m',r2(it.w))}${num('h','Depth m',r2(it.h))}${num('r','Turn °',Math.round(it.r||0),15)}</div>
      ${PRO?'<p class="ph">Look (3D)</p>':''}<div class="row">${num('ht','Height m',r2(it.ht||T.ht||.8),.05)}${col('c','Colour',it.c||T.c||'#bbbbbb')}</div><div class="row">${pick('fin','Finish',FINN,it.fin)}</div>${flags}`; }
  else if(it.kind==='dim'){ const L=Math.hypot(it.b[0]-it.a[0],it.b[1]-it.a[1]); h=`<h2>📏 Measure<small style="font-size:12px;color:var(--muted);font-weight:600">${fmtL(L)}</small>${PRO?'':'<button class="ib x" data-x>✕</button>'}</h2><div class="row">${num('len','Length m',r2(L),.05)}</div><p style="font-size:12.5px;color:var(--muted);margin:4px 0">Drag a round end to move it · it sticks to corners.</p>${flags}`; }
  else { const q=openingPos(it), off=q?r2(it.t*q.len-it.w/2):0;
    h=`<h2>${it.kind==='door'?'🚪 Door':'🪟 Window'}<small style="font-size:12px;color:var(--muted);font-weight:600">on ${esc(q?spaceLabel(q.space):'?')} · drag along the wall</small>${PRO?'':'<button class="ib x" data-x>✕</button>'}</h2>
      <div class="row">${num('w','Width m',r2(it.w))}${num('off','From the corner m',off,.05)}${it.kind==='door'?num('dh','Height m',r2(it.dh||2.1),.05):''}</div>${it.kind==='door'?`<div class="btns"><button class="btn" data-a="flip">⇆ Hinge side</button><button class="btn" data-a="swing">⇅ Opens in / out</button></div>`:''}${flags}`; }
  h+=`<div class="btns">${it.kind==='door'||it.kind==='window'||it.kind==='dim'?'':'<button class="btn" data-a="rot">⟳ Turn 90°</button><button class="btn" data-a="dup">⧉ Copy</button>'}${it.kind==='space'?'<button class="btn" data-a="obj">＋ Object inside</button><button class="btn" data-a="door">🚪 Add door</button>':''}${MODE!=='2d'&&V3?'<button class="btn" data-a="fly">🎯 Show in 3D</button>':''}<button class="btn bad" data-a="del">🗑 Remove</button></div>`;
  const ws=WARN.list.filter(w=>w.id===it.id); if(ws.length) h+=`<div class="wl" style="margin-top:10px">${ws.map(w=>`<div class="wi"><b>⚠ ${esc(w.t)}</b><small>${esc(w.fix||'')}</small></div>`).join('')}</div>`;
  return h; }
function wireInspector(root,it){
  root.querySelectorAll('[data-k]').forEach(inp=>{ const k=inp.dataset.k, apply=()=>{ const v=inp.type==='checkbox'?inp.checked:inp.value; commit();
      if(k==='w'||k==='h'){ const n=Math.max(.1,Math.min(200,+v||0)); const c=ctr(it); it[k]=r2(n); if(it.kind!=='door'&&it.kind!=='window'){ if(it.shape==='circle'){ it.w=it.h=r2(n); } it.x=r2(c[0]-it.w/2); it.y=r2(c[1]-it.h/2); } }
      else if(k==='x'||k==='y'){ const n=r2(+v||0), d=n-it[k]; if(it.kind==='space') childrenOf(it).forEach(c=>{ c[k]=r2(c[k]+d); }); it[k]=n; }
      else if(k==='r') it.r=((Math.round(+v||0)%360)+360)%360;
      else if(k==='guests'||k==='rate') it[k]=Math.max(0,Math.round(+v||0));
      else if(k==='type'){ it.type=v; if(ST[v].guest&&!it.no) autoName(it); if(ST[v].guest&&!(CATS[v]||[]).includes(it.cat)) it.cat=(CATS[v]||CATS.room)[0]; changed(); openInspector(); return; }
      else if(k==='ht'){ const T=OBJ[it.t]||{}, n=clamp(+v||0,.05,6); if(Math.abs(n-(T.ht||.8))<.005) delete it.ht; else it.ht=r2(n); }
      else if(k==='wh'){ const n=clamp(+v||2.8,2,6); if(Math.abs(n-2.8)<.005) delete it.wh; else it.wh=r2(n); }
      else if(k==='dh'){ const n=clamp(+v||2.1,1.8,2.8); if(Math.abs(n-2.1)<.005) delete it.dh; else it.dh=r2(n); }
      else if(k==='c'||k==='wc'){ it[k]=String(v).slice(0,7); }
      else if(k==='fin'||k==='fl'){ if(v==='auto') delete it[k]; else it[k]=v; }
      else if(k==='lock'||k==='hid'){ if(v) it[k]=true; else delete it[k]; if(k==='hid'&&v){ selClear(); } }
      else if(k==='off'){ const q=openingPos(it); if(q){ const half=it.w/2/Math.max(q.len,it.w); it.t=clamp(((+v||0)+it.w/2)/q.len,half,1-half); } }
      else if(k==='len'){ const L=Math.hypot(it.b[0]-it.a[0],it.b[1]-it.a[1])||1, n=Math.max(.05,+v||0); it.b=[r2(it.a[0]+(it.b[0]-it.a[0])/L*n),r2(it.a[1]+(it.b[1]-it.a[1])/L*n)]; }
      else it[k]=String(v).trim().slice(0,40);
      changed(); if(PRO||k==='lock'||k==='hid') afterSel(true); };
    inp.onchange=apply; if(inp.tagName==='INPUT'&&inp.type!=='checkbox'&&inp.type!=='color') inp.onkeydown=e=>{ if(e.key==='Enter'){ inp.blur(); } }; });
  root.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='del') del(); else if(a==='dup') dup(); else if(a==='rot'){ if(isLocked(it)){ toast('🔒 Locked'); return; } commit(); it.r=((it.r||0)+90)%360; changed(); openInspector(); }
    else if(a==='obj'){ if(PRO){ if(!PREF.lib) libOpen(); else libFoot(); } else libSheet(); } else if(a==='door'){ closeSheet(); setTool('door'); }
    else if(a==='flip'){ commit(); it.flip=!it.flip; changed(); } else if(a==='swing'){ commit(); it.side=-(it.side||1); changed(); } else if(a==='fly'&&V3) V3.focus(it.id); }); }
function openInspector(soft){ if(PRO){ renderPanel(); return; } const it=SEL&&byId(SEL); if(!it){ closeSheet(); return; } if(soft&&!$('sheet').classList.contains('on')) return;
  sheet(inspector(it),root=>wireInspector(root,it)); }
/* ---------------- laptop panels ---------------- */
const ALIC={l:'<path d="M4 3v18M8 7h10v4H8zM8 13h6v4H8z"/>',c:'<path d="M12 3v18M6 7h12v4H6zM8 13h8v4H8z"/>',r:'<path d="M20 3v18M6 7h10v4H6zM10 13h6v4h-6z"/>',t:'<path d="M3 4h18M7 8v10h4V8zM13 8v6h4V8z"/>',m:'<path d="M3 12h18M7 6v12h4V6zM13 8v8h4V8z"/>',b:'<path d="M3 20h18M7 6v10h4V6zM13 10v6h4v-6z"/>'};
function renderPanel(){ if(!PRO) return; document.querySelectorAll('.rtabs [data-rt]').forEach(b=>b.classList.toggle('on',b.dataset.rt===PREF.tab)); $('propsBody').hidden=PREF.tab!=='props'; $('layersBody').hidden=PREF.tab!=='layers';
  if(PREF.tab==='layers') layersPanel(); else propsPanel(); libFoot(); status(); }
function propsPanel(){ const root=$('propsBody'), L=selList();
  if(L.length>1){ const kinds={}; L.forEach(i=>{ const n=i.kind==='space'?'spaces':i.kind==='obj'?'objects':i.kind==='dim'?'measures':'doors / windows'; kinds[n]=(kinds[n]||0)+1; });
    root.innerHTML=`<h2>▣ ${L.length} selected</h2><p style="margin:0;color:var(--muted);font-size:12.5px">${Object.entries(kinds).map(([k,n])=>n+' '+k).join(' · ')}</p>
      <p class="ph">Line up</p><div class="al">${['l','c','r','t','m','b'].map(k=>`<button data-al="${k}" title="${{l:'left edges',c:'centres across',r:'right edges',t:'top edges',m:'middles',b:'bottom edges'}[k]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ALIC[k]}</svg></button>`).join('')}</div>
      <div class="btns"><button class="btn sm" data-al="dh">↔ Spread across</button><button class="btn sm" data-al="dv">↕ Spread down</button><button class="btn sm" data-al="sw">Same width</button><button class="btn sm" data-al="sh">Same depth</button></div>
      <p class="ph">Do</p><div class="btns"><button class="btn sm" data-ma="rot">⟳ Turn 90°</button><button class="btn sm" data-ma="dup">⧉ Copy</button><button class="btn sm" data-ma="lock">🔒 Lock</button><button class="btn sm" data-ma="unlock">🔓 Unlock</button><button class="btn sm" data-ma="hide">🙈 Hide</button><button class="btn sm bad" data-ma="del">🗑 Remove ${L.length}</button></div>
      <p class="ph">Tip</p><p class="keys">Shift / Ctrl + click adds or removes one · drag any of them to move all · arrows nudge (Shift = 1 m)</p>`;
    root.querySelectorAll('[data-al]').forEach(b=>b.onclick=()=>alignSel(b.dataset.al));
    root.querySelectorAll('[data-ma]').forEach(b=>b.onclick=()=>{ const a=b.dataset.ma; if(a==='rot'){ const M=L.filter(i=>(i.kind==='obj'||i.kind==='space')&&!isLocked(i)); if(M.length){ commit(); M.forEach(i=>{ i.r=((i.r||0)+90)%360; }); changed(); } } else if(a==='dup') dup(); else if(a==='lock') setFlag('lock',true); else if(a==='unlock') setFlag('lock',false); else if(a==='hide') setFlag('hid',true); else if(a==='del') del(); }); return; }
  const it=L[0]; if(it){ root.innerHTML=inspector(it); wireInspector(root,it); return; }
  const F=floor(), SP=F.items.filter(i=>i.kind==='space'), A=SP.reduce((n,s)=>n+area(worldPts(s)),0), rooms=SP.filter(s=>(ST[s.type]||{}).guest).length, seats=F.items.filter(o=>o.kind==='obj').reduce((n,o)=>n+(SEAT[o.t]||0),0);
  root.innerHTML=`<h2>🏢 ${esc(F.name)} <small style="font-size:12px;color:var(--muted);font-weight:600">${esc(P.name)}</small></h2>
    <div class="row"><label class="f">Floor name<input data-pf="fname" value="${esc(F.name)}" maxlength="24"></label><label class="f">Plan name<input data-pf="pname" value="${esc(P.name)}" maxlength="40"></label></div>
    <p class="ph">This floor</p><div class="stat"><div><small>Spaces</small><b>${SP.length}</b></div><div><small>Guest rooms</small><b>${rooms}</b></div><div><small>Seats</small><b>${seats}</b></div><div><small>Area</small><b>${Math.round(A)} m²</b></div></div>
    <p class="ph">From paper</p><div class="btns" style="margin-top:0"><button class="btn sm" data-q="sketch">📷 Plan from a sketch photo</button></div>${F.under?`<div class="row"><label class="f" style="flex:1">Sketch under the plan<input type="range" min="0" max="1" step=".05" data-und="op" value="${F.under.op==null?.35:F.under.op}"></label></div><div class="btns" style="margin-top:0"><button class="btn sm" data-und="hide">${PREF.lay.sketch[0]?'🙈 Hide sketch':'👁 Show sketch'}</button><button class="btn sm bad" data-und="del">🗑 Remove sketch</button></div>`:''}
    <p class="ph">Grid + snapping</p><div class="btns" style="margin-top:0">${[.05,.1,.25,.5].map(g=>`<button class="btn sm${Math.abs((P.grid||.1)-g)<1e-6?' on':''}" data-grid="${g}">${g*100} cm</button>`).join('')}</div>
    <label class="tgl"><input type="checkbox" data-pt="snap"${PREF.snap?' checked':''}># Snap to the grid</label><label class="tgl"><input type="checkbox" data-pt="mag"${PREF.mag?' checked':''}>🧲 Stick to walls (magnets)</label><label class="tgl"><input type="checkbox" data-pt="rulers"${PREF.rulers?' checked':''}>📏 Rulers</label><label class="tgl"><input type="checkbox" data-pt="roomDims"${PREF.roomDims?' checked':''}>↔ Room sizes on the plan</label>
    <p class="ph">Quick</p><div class="btns" style="margin-top:0"><button class="btn sm" data-q="fit">⤢ Fit</button><button class="btn sm" data-q="sum">📊 Summary</button><button class="btn sm" data-q="rooms">🛏 Rooms</button><button class="btn sm" data-q="warn">⚠ Checks · ${WARN.list.length}</button><button class="btn sm" data-q="split">◫ Split 2D + 3D</button></div>
    <p class="ph">Keys</p><div class="keys"><kbd>V</kbd> select · <kbd>H</kbd> pan · <kbd>S</kbd> space · <kbd>D</kbd> door · <kbd>W</kbd> window · <kbd>M</kbd> measure · <kbd>O</kbd> objects<br>drag empty paper = box select (← touching, → fully inside) · <kbd>Space</kbd>+drag or right-drag = move around · wheel = zoom<br><kbd>Shift</kbd>/<kbd>Ctrl</kbd>+click add · <kbd>Ctrl</kbd> <kbd>A</kbd> <kbd>C</kbd> <kbd>V</kbd> <kbd>D</kbd> <kbd>Z</kbd> <kbd>Y</kbd> · <kbd>R</kbd> turn · <kbd>Del</kbd> · arrows nudge · <kbd>F</kbd> fit · right-click = menu</div>`;
  root.querySelectorAll('[data-pf]').forEach(i=>i.onchange=()=>{ commit(); if(i.dataset.pf==='fname') F.name=i.value.trim()||F.name; else P.name=i.value.trim()||P.name; changed(); renderPanel(); });
  root.querySelectorAll('[data-grid]').forEach(b=>b.onclick=()=>{ commit(); P.grid=+b.dataset.grid; changed(); renderPanel(); });
  root.querySelectorAll('[data-pt]').forEach(i=>i.onchange=()=>{ PREF[i.dataset.pt]=i.checked; savePref(); layout(); draw(); renderPanel(); });
  root.querySelectorAll('[data-und]').forEach(b=>{ const k=b.dataset.und; if(k==='op'){ b.oninput=()=>{ F.under.op=+b.value; draw(); }; b.onchange=()=>{ changed(true); }; return; } b.onclick=()=>underAct(k); });
  root.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ const q=b.dataset.q; if(q==='sketch'){ openSketch(); return; } if(q==='fit') fit(); else if(q==='sum') sumSheet(); else if(q==='rooms') roomsSheet(); else if(q==='warn') warnSheet(); else if(q==='split') setMode('split'); }); }
function layersPanel(){ const root=$('layersBody'), F=floor(), HS=hiddenSpaces(), cnt=k=>F.items.filter(i=>layerOf(i)===k).length;
  const LN=[['spaces','Spaces · walls'],['furn','Furniture + things'],['open','Doors + windows'],['dims','Measures'],['labels','Names'],['grid','Grid']].concat(floor().under?[['sketch','Sketch photo']]:[]);
  let h=`<p class="ph">Layers</p><div class="lay">${LN.map(([k,n])=>{ const L=PREF.lay[k]; const c=k==='labels'||k==='grid'||k==='sketch'?'':`<small>${cnt(k)}</small>`; return `<div class="lr"><button class="e${L[0]?'':' off'}" data-le="${k}" title="show / hide">👁</button>${k==='labels'||k==='grid'||k==='sketch'?'<span style="width:24px"></span>':`<button class="k${L[1]?'':' off'}" data-lk="${k}" title="lock: can't be picked or moved">🔒</button>`}<span class="n">${n}</span>${c}</div>`; }).join('')}</div>`;
  const SP=F.items.filter(i=>i.kind==='space').slice().sort((a,b)=>{ const ga=(ST[a.type]||{}).guest?1:0, gb=(ST[b.type]||{}).guest?1:0; return ga-gb||String(spaceLabel(a)).localeCompare(String(spaceLabel(b)),undefined,{numeric:true}); });
  const kidsOf=s=>{ const P0=worldPts(s); return F.items.filter(o=>(o.kind==='obj'&&inside(ctr(o),P0))||((o.kind==='door'||o.kind==='window')&&o.sp===s.id)); };
  const used=new Set(); const selHost=SEL&&byId(SEL); const row=(it,kid)=>{ const hidden=isHidden(it,null,HS)&&!PREF.lay[layerOf(it)][0]?true:!!it.hid; const ic=it.kind==='space'?`<i class="sw" style="background:${(ST[it.type]||ST.other).c}"></i>`:it.kind==='obj'?'▪':it.kind==='door'?'🚪':it.kind==='window'?'🪟':'📏';
    return `<div class="lr${kid?' kid':''}${SELS.has(it.id)?' sel':''}" data-row="${it.id}">${!kid&&it.kind==='space'?`<button class="fo" data-fo="${it.id}">${PREF.fold[it.id]?'▾':'▸'}</button>`:''}<button class="e${it.hid?' off':''}" data-ie="${it.id}" title="show / hide">👁</button><button class="k${it.lock?'':' off'}" data-ik="${it.id}" title="lock">🔒</button>${ic}<span class="n" data-pick="${it.id}">${esc(itemName(it))}</span>${it.kind==='space'?`<small>${area(worldPts(it)).toFixed(0)} m²</small>`:''}</div>`; };
  h+=`<p class="ph">On this floor · ${F.items.length}</p><div class="lay">`;
  SP.forEach(s=>{ used.add(s.id); h+=row(s); const kids=kidsOf(s); kids.forEach(k=>used.add(k.id)); const open=PREF.fold[s.id]||(selHost&&selHost!==s&&kids.includes(selHost)); if(open) kids.forEach(k=>{ h+=row(k,true); }); });
  const rest=F.items.filter(i=>!used.has(i.id)); if(rest.length){ h+=`<div class="lr"><span class="n" style="color:var(--muted)">Outside any space · ${rest.length}</span></div>`; rest.forEach(i=>{ h+=row(i,true); }); }
  h+='</div>'; root.innerHTML=h;
  root.querySelectorAll('[data-le]').forEach(b=>b.onclick=()=>{ const L=PREF.lay[b.dataset.le]; L[0]=L[0]?0:1; savePref(); selClear(); changed(true); afterSel(true); });
  root.querySelectorAll('[data-lk]').forEach(b=>b.onclick=()=>{ const L=PREF.lay[b.dataset.lk]; L[1]=L[1]?0:1; savePref(); fixSel(); draw(); renderPanel(); toast(L[1]?'🔒 '+b.closest('.lr').querySelector('.n').textContent+' locked · they can’t be picked':'🔓 Unlocked'); });
  root.querySelectorAll('[data-fo]').forEach(b=>b.onclick=()=>{ const id=b.dataset.fo; PREF.fold[id]=!PREF.fold[id]; savePref(); layersPanel(); });
  root.querySelectorAll('[data-ie]').forEach(b=>b.onclick=()=>{ const it=byId(b.dataset.ie); if(!it) return; commit(); if(it.hid) delete it.hid; else it.hid=true; if(it.hid&&SELS.has(it.id)) selClear(); changed(); afterSel(true); });
  root.querySelectorAll('[data-ik]').forEach(b=>b.onclick=()=>{ const it=byId(b.dataset.ik); if(!it) return; commit(); if(it.lock) delete it.lock; else it.lock=true; changed(); afterSel(true); });
  root.querySelectorAll('[data-pick]').forEach(s=>{ s.onclick=e=>{ const it=byId(s.dataset.pick); if(!it) return; if(e.shiftKey||e.ctrlKey||e.metaKey){ if(SELS.has(it.id)) SELS.delete(it.id); else SELS.add(it.id); SEL=it.id; } else sel1(it.id);
      const b=itemBox(it); if(b&&MODE!=='3d'&&MODE!=='walk'){ const r=svg.getBoundingClientRect(), A=W2S([b[0],b[1]]), B=W2S([b[2],b[3]]); if(A[0]<20||A[1]<20||B[0]>r.width-20||B[1]>r.height-20) centerOn([(b[0]+b[2])/2,(b[1]+b[3])/2]); } afterSel(); };
    s.ondblclick=()=>{ if(V3&&MODE!=='2d') V3.focus(s.dataset.pick); }; }); }
document.querySelectorAll('.rtabs [data-rt]').forEach(b=>b.onclick=()=>{ PREF.tab=b.dataset.rt; savePref(); renderPanel(); });
function status(){ if(!PRO) return; const el=$('status'); if(!el.dataset.built){ el.dataset.built=1; el.innerHTML=`<span class="sp1" id="stTool"></span><span id="stPos">—</span><span id="stSel"></span><span id="stZoom"></span><button data-st="snap"></button><button data-st="mag">🧲 Magnets</button><button data-st="rulers">📏 Rulers</button><span id="stSave"></span>`;
    el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ const k=b.dataset.st; PREF[k]=!PREF[k]; savePref(); layout(); draw(); status(); renderPanel(); }); }
  const tips={select:'Select · drag empty paper = box select · Space+drag or right-drag = move around',hand:'Pan · drag to move around',door:'Door · click a wall',window:'Window · click a wall',measure:'Measure · click two points (sticks to corners, Shift = straight)',poly:'Any shape · click the corners, click the first to close',rect:'Draw · drag',square:'Draw · drag',circle:'Draw · drag from the centre',tri:'Draw · drag'};
  $('stTool').textContent=MODE==='3d'?'3D · click a thing to edit it · double-click = fly to':(tips[TOOL]||TOOL);
  const s=selList(); $('stSel').textContent=s.length>1?s.length+' selected':s.length?itemName(s[0]):'';
  $('stZoom').textContent=Math.round(VIEW.s/40*100)+'%'; const sb=el.querySelector('[data-st="snap"]'); sb.textContent='# Grid '+Math.round((P.grid||.1)*100)+' cm'; sb.classList.toggle('on',!!PREF.snap);
  el.querySelector('[data-st="mag"]').classList.toggle('on',!!PREF.mag); el.querySelector('[data-st="rulers"]').classList.toggle('on',!!PREF.rulers); $('stSave').textContent=($('saved')||{}).textContent||''; }
function cursorMarks(sx,sy){ if(!PRO) return; const x=$('rmx'), y=$('rmy'); x.style.left=sx+'px'; y.style.top=sy+'px'; const p=$('stPos'); if(p&&CUR&&sx>0) p.textContent='x '+CUR[0].toFixed(2)+' · y '+CUR[1].toFixed(2)+' m'; }
/* after the selection changes: plan, panel or sheet, 3D, dock */
function afterSel(quiet){ draw(); dock(); if(PRO) renderPanel(); else if(!quiet) openInspector(); sync3d(); }
function sync3d(){ if(V3&&MODE!=='2d'&&MODE!=='walk'&&V3.setSel) V3.setSel(SELS.size===1?SEL:null); }
function floorSheet(i){ const f=i>=0?P.floors[i]:null;
  sheet(`<h2>${f?'Floor · '+esc(f.name):'Add a floor'}<button class="ib x" data-x>✕</button></h2><label class="f">Name<input id="flN" value="${esc(f?f.name:(['Ground','First','Second','Third','Fourth','Terrace'][P.floors.length]||'Floor '+P.floors.length))}" maxlength="24"></label>
    ${f&&f.under?`<div class="btns"><button class="btn" data-und="hide">${PREF.lay.sketch[0]?'🙈 Hide the sketch photo':'👁 Show the sketch photo'}</button><button class="btn bad" data-und="del">🗑 Remove the sketch photo</button></div>`:''}
    <div class="btns"><button class="btn pri" id="flGo">${f?'Rename':'＋ Empty floor'}</button>${f?'':`<button class="btn" id="flCopy">⧉ Copy “${esc(floor().name)}”</button>`}${f&&P.floors.length>1?'<button class="btn bad" id="flDel">🗑 Remove floor</button>':''}</div>${f?'':'<p style="font-size:12.5px;color:var(--muted)">Copy keeps rooms, doors and objects; room numbers move up by 100 (101 → 201).</p>'}`,()=>{
    document.querySelectorAll('#sheetBody [data-und]').forEach(b=>b.onclick=()=>{ underAct(b.dataset.und); closeSheet(); });
    $('flGo').onclick=()=>{ const n=$('flN').value.trim()||'Floor'; commit(); if(f) f.name=n; else { P.floors.push({id:uid(),name:n,items:[]}); FL=P.floors.length-1; } closeSheet(); selClear(); changed(); floors(); fit(); renderPanel(); };
    const c=$('flCopy'); if(c) c.onclick=()=>{ commit(); const src=floor(), map={}, step=100*(P.floors.length-FL);
      const nf={id:uid(),name:$('flN').value.trim()||'Floor',items:src.items.map(o=>{ const k=JSON.parse(JSON.stringify(o)); map[o.id]=k.id=uid(); if(k.no&&/^\d+$/.test(k.no)) k.no=String(+k.no+step); return k; })};
      nf.items.forEach(o=>{ if(o.sp) o.sp=map[o.sp]||o.sp; }); P.floors.push(nf); FL=P.floors.length-1; closeSheet(); selClear(); changed(); floors(); fit(); renderPanel(); toast('Floor copied · '+nf.items.filter(o=>o.no).length+' rooms renumbered'); };
    const d=$('flDel'); if(d) d.onclick=()=>{ if(d.dataset.sure!=='1'){ d.dataset.sure='1'; d.textContent='Tap again to remove '+f.items.length+' things'; return; } commit(); P.floors.splice(i,1); FL=0; closeSheet(); selClear(); changed(); floors(); fit(); renderPanel(); }; }); }

/* ---------------- checks: what a hotel person would spot on the drawing ---------------- */
const isCook=t=>/^(range4|range2|tandoor|mandi|grill|fryer|oven)$/.test(t);
function onBoundary(pt,s,tol){ return edges(s).some(E=>projSeg(pt,E).d<=tol); }
function checks(){ const out=[], L=items(), SP=L.filter(i=>i.kind==='space'), OB=L.filter(i=>i.kind==='obj'), DOORS=L.filter(i=>i.kind==='door'), WINS=L.filter(i=>i.kind==='window');
  const oname=o=>o.name||(OBJ[o.t]||{}).n||'Object', add=(id,t,fix)=>out.push({id,t,fix});
  const doorPts=DOORS.map(d=>{ const q=openingPos(d); return q?{d,p:q.p,q}:null; }).filter(Boolean), winPts=WINS.map(w=>{ const q=openingPos(w); return q?q.p:null; }).filter(Boolean);
  OB.forEach(o=>{ const host=spaceOf(ctr(o)); if(!host){ add(o.id,oname(o)+' is outside every space','Drag it into a room, or draw the room around it'); return; }
    const HP=worldPts(host); if(worldPts(o).some(p=>!inside(p,HP)&&!onBoundary(p,host,.06))) add(o.id,oname(o)+' goes through the wall of '+spaceLabel(host),'Move it in a little or make it smaller'); });
  const solid=OB.filter(o=>!(OBJ[o.t]||{}).lift&&o.t!=='stairs');
  for(let i=0;i<solid.length;i++) for(let j=i+1;j<solid.length;j++){ const a=solid[i], b=solid[j]; if(overlapPts(worldPts(a),worldPts(b))>.05) add(a.id,oname(a)+' sits on '+oname(b),'Move one of them'); }
  const nos={}; P.floors.forEach(f=>f.items.forEach(s=>{ if(s.kind==='space'&&(ST[s.type]||{}).guest&&s.no){ (nos[s.no]=nos[s.no]||[]).push(s); } }));
  SP.forEach(s=>{ const t=ST[s.type]||ST.other, PP=worldPts(s), A=area(PP), inS=OB.filter(o=>inside(ctr(o),PP));
    const hasDoor=doorPts.some(x=>onBoundary(x.p,s,.15)), hasWin=winPts.some(p=>onBoundary(p,s,.15));
    if(!hasDoor&&!/garden|parking|corridor|stairs/.test(s.type)) add(s.id,spaceLabel(s)+' has no door','Door tool → tap its wall');
    if(t.guest){ if(nos[s.no]&&nos[s.no].length>1) add(s.id,'Room no. '+s.no+' is used '+nos[s.no].length+' times','Give each room its own number');
      if(!s.no) add(s.id,'Guest room without a number','Tap it → Room no.');
      if(A<9) add(s.id,spaceLabel(s)+' is only '+A.toFixed(1)+' m²','Guest rooms are usually 12 m² or more');
      if(!inS.some(o=>/^bed/.test(o.t))) add(s.id,spaceLabel(s)+' has no bed','Objects → Bedroom → bed');
      const bath=SP.some(b=>(b.type==='bath')&&(inside(centroid(worldPts(b)),PP)||worldPts(b).some(p=>onBoundary(p,s,.25)||inside(p,PP))));
      if(!bath) add(s.id,spaceLabel(s)+' has no bathroom','Draw a Bathroom space inside or next to it');
      if(!hasWin) add(s.id,spaceLabel(s)+' has no window','Window tool → tap an outside wall'); }
    if(s.type==='bath'&&!inS.some(o=>o.t==='wc')) add(s.id,spaceLabel(s)+' has no toilet','Objects → Bathroom');
    if(s.type==='kitchen'){ const need=[['sink2','a sink'],['fridge|freezer|coldroom|dfreezer','a fridge'],['hood','an exhaust hood']]; if(!inS.some(o=>isCook(o.t))) add(s.id,'Kitchen has no cooking range','Objects → Kitchen');
      need.forEach(([re,n])=>{ if(!inS.some(o=>new RegExp('^('+re+')$').test(o.t))) add(s.id,'Kitchen has no '+n,'Objects → Kitchen'); });
      inS.filter(o=>isCook(o.t)).forEach(c=>{ if(!inS.some(h=>h.t==='hood'&&overlapPts(worldPts(h),worldPts(c))>0)) add(c.id,oname(c)+' is not under the exhaust hood','Put the hood over it'); }); }
    if(t.guest||s.type==='restaurant'||s.type==='kitchen') SP.forEach(o=>{ if(o!==s&&(ST[o.type]||{}).guest&&t.guest&&o.id>s.id&&overlapPts(PP,worldPts(o))>.3) add(s.id,spaceLabel(s)+' overlaps '+spaceLabel(o),'Move them apart'); }); });
  doorPts.forEach(x=>{ const a=x.q.ang*Math.PI/180, n=[-Math.sin(a),Math.cos(a)]; [1,-1].forEach(sg=>{ const p=[x.p[0]+n[0]*.55*sg,x.p[1]+n[1]*.55*sg]; const b=solid.find(o=>inside(p,worldPts(o))); if(b) add(x.d.id,'Door of '+spaceLabel(x.q.space)+' blocked by '+oname(b),'Keep 60 cm free on both sides'); }); });
  WARN={list:out,ids:new Set(out.map(w=>w.id))}; }
function warnSheet(){ const L=WARN.list;
  sheet(`<h2>${L.length?'⚠ '+L.length+' to check':'✓ All good'} <small style="font-size:12px;color:var(--muted);font-weight:600">${esc(floor().name)}</small><button class="ib x" data-x>✕</button></h2>${L.length?`<div class="wl">${L.map((w,i)=>`<button class="wi" data-w="${i}"><b>${esc(w.t)}</b><small>${esc(w.fix||'')}</small></button>`).join('')}</div>`:'<p style="color:var(--muted)">Doors, bathrooms, beds, kitchen basics, overlaps and walls all look right on this floor.</p>'}`,root=>{
    root.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ const w=L[+b.dataset.w], it=byId(w.id); if(!it) return; sel1(it.id); const p=it.kind==='door'||it.kind==='window'?(openingPos(it)||{}).p:ctr(it); if(p&&MODE!=='3d') centerOn(p); if(PRO) closeSheet(); afterSel(); if(V3&&MODE!=='2d') V3.focus(it.id); }); }); }
/* ---------------- summary + rooms ---------------- */
function roomsAll(){ const out=[]; P.floors.forEach((f,fi)=>f.items.forEach(s=>{ if(s.kind==='space'&&(ST[s.type]||{}).guest) out.push({s,f,fi,A:area(worldPts(s))}); })); return out.sort((a,b)=>String(a.s.no).localeCompare(String(b.s.no),undefined,{numeric:true})); }
function sumSheet(){ const R=roomsAll(), all=P.floors.flatMap(f=>f.items), seats=all.filter(o=>o.kind==='obj').reduce((n,o)=>n+(SEAT[o.t]||0),0), byT={};
  P.floors.forEach(f=>f.items.filter(i=>i.kind==='space').forEach(s=>{ const k=s.type; byT[k]=(byT[k]||0)+area(worldPts(s)); }));
  const cats={}; R.forEach(r=>{ const c=r.s.cat||'—'; cats[c]=(cats[c]||0)+1; });
  sheet(`<h2>📊 Summary · ${esc(P.name)}<button class="ib x" data-x>✕</button></h2><div class="sum"><div><small>Guest rooms</small><b>${R.length}</b></div><div><small>Guests max</small><b>${R.reduce((n,r)=>n+(+r.s.guests||0),0)}</b></div><div><small>Restaurant seats</small><b>${seats}</b></div><div><small>Floors</small><b>${P.floors.length}</b></div><div><small>Full night</small><b>₹${R.reduce((n,r)=>n+(+r.s.rate||0),0).toLocaleString('en-IN')}</b></div><div><small>Built area</small><b>${Math.round(Object.values(byT).reduce((a,b)=>a+b,0))} m²</b></div></div>
    ${R.length?`<p style="margin:10px 0 4px;font-weight:800">Rooms by category</p><div class="sum">${Object.entries(cats).map(([c,n])=>`<div><small>${esc(c)}</small><b>${n}</b></div>`).join('')}</div>`:''}
    <p style="margin:10px 0 4px;font-weight:800">Area by space</p><table class="t"><tr><th>Space</th><th>m²</th></tr>${Object.entries(byT).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${(ST[k]||ST.other).c};margin-right:6px"></i>${esc((ST[k]||ST.other).n)}</td><td>${v.toFixed(1)}</td></tr>`).join('')}</table>`); }
function roomsSheet(){ const R=roomsAll();
  sheet(`<h2>🛏 Rooms for booking · ${R.length}<button class="ib x" data-x>✕</button></h2><p style="font-size:12.5px;color:var(--muted);margin:0 0 8px">Every Guest room / Suite on the plan. Room booking (next) uses this list, so change numbers, categories and rates here or by tapping the room.</p>
    ${R.length?`<table class="t"><tr><th>No.</th><th>Floor</th><th>Category</th><th>Beds</th><th>Guests</th><th>₹ / night</th><th>m²</th></tr>${R.map((r,i)=>`<tr data-ri="${i}" style="cursor:pointer"><td><b>${esc(r.s.no||'—')}</b></td><td>${esc(r.f.name)}</td><td>${esc(r.s.cat||'')}</td><td>${esc(r.s.beds||'')}</td><td>${r.s.guests||''}</td><td>${(+r.s.rate||0).toLocaleString('en-IN')}</td><td>${r.A.toFixed(1)}</td></tr>`).join('')}</table>`:'<p>No guest rooms yet. Space → Guest room, then draw.</p>'}`,root=>{
    root.querySelectorAll('[data-ri]').forEach(tr=>tr.onclick=()=>{ const r=R[+tr.dataset.ri]; FL=r.fi; sel1(r.s.id); floors(); if(MODE!=='3d'&&MODE!=='walk') centerOn(ctr(r.s)); changed(true); if(PRO) closeSheet(); afterSel(); if(V3&&MODE!=='2d') V3.focus(r.s.id); }); }); }
function helpSheet(){ sheet(`<h2>❓ How to use<button class="ib x" data-x>✕</button></h2><ul style="padding-left:18px;margin:0;line-height:1.7;font-size:14px">
  <li><b>Space</b> → what it is (guest room, kitchen, store…) and a shape, then drag on the plan. Any shape = tap the corners.</li>
  <li><b>Door / Window</b> → tap on a wall. Drag it along the wall; its panel flips the hinge or the swing, sets the height.</li>
  <li><b>Objects</b> → real sizes with 3D pictures. Tap = into the selected room. On a laptop: drag a picture onto the plan or into 3D.</li>
  <li>Tap anything to select: drag to move (10 cm snap + sticks to walls), corners resize, ⟳ turns. Distances to the walls show while you move.</li>
  <li><b>Measure</b> → tap two points (sticks to corners). It stays on the plan; drag its ends.</li>
  <li>Laptop: drag on empty paper = box select (right → left catches anything it touches). Shift/Ctrl+click adds. Right-click = menu. <b>Layers</b> tab hides or locks spaces, furniture, doors, measures.</li>
  <li><b>3D</b> → Cutaway / Full / Low walls, sun by the hour, all floors. Tap a thing → Move / Turn / Size handles. Double-tap flies to it.</li>
  <li><b>🚶 Walk</b> → walk through at eye height: W A S D or the stick, drag to look, the mini map jumps.</li>
  <li><b>Split</b> (laptop) = plan and 3D side by side, both live.</li>
  <li>Keys: V select · H pan · S space · D door · W window · M measure · O objects · F fit · R turn · Del · Ctrl+Z/Y · Ctrl+C/V/D · Ctrl+A · arrows (Shift = 1 m) · Esc.</li></ul>`); }
/* ---------------- the demo hotel (2 room floors x 10 rooms, restaurant, kitchen, store, housekeeping) ---------------- */
function demoHotel(){ const D=blank('Demo hotel'); D.floors=[];
  const sp=(type,x,y,w,h,ex)=>Object.assign({id:uid(),kind:'space',type,shape:'rect',x,y,w,h,r:0},ex||{});
  const ob=(t,x,y,r,ex)=>{ const T=OBJ[t]; return Object.assign({id:uid(),kind:'obj',t,shape:T.shape==='round'?'round':'box',x,y,w:T.w,h:T.d,r:r||0},ex||{}); };
  const door=(s,e,t,w,ex)=>Object.assign({id:uid(),kind:'door',sp:s.id,e,t,w:w||.9,side:1},ex||{}), win=(s,e,t,w)=>({id:uid(),kind:'window',sp:s.id,e,t,w:w||1.4});
  const G=[]; const lobby=sp('lobby',0,0,12,9,{name:'Lobby'}), rest=sp('restaurant',12,0,14,11,{name:'Restaurant'}), kit=sp('kitchen',26,0,9,7,{name:'Kitchen'}), store=sp('store',26,7,4.5,4,{name:'Store'}), hk=sp('clean',30.5,7,4.5,4,{name:'Housekeeping'}),
    wcM=sp('wash',0,9,3,3,{name:'Gents'}), wcL=sp('wash',3,9,3,3,{name:'Ladies'}), stair=sp('stairs',6,9,6,3,{name:'Stairs + lift'}), cor=sp('corridor',12,11,23,2,{name:'Service corridor'});
  G.push(lobby,rest,kit,store,hk,wcM,wcL,stair,cor);
  G.push(door(lobby,0,.5,1.8),win(lobby,0,.2,2),win(lobby,0,.8,2),door(lobby,1,.5,1.8),door(rest,0,.7,1.2),win(rest,0,.3,2.4),win(rest,1,.5,2.4),door(kit,3,.22,1.1),door(rest,2,.5,1.4),door(store,2,.5,.9),door(hk,2,.5,.9),door(wcM,0,.5,.8),door(wcL,0,.5,.8),door(stair,0,.5,1.2),door(kit,2,.3,1),win(kit,0,.5,1.6));
  G.push(ob('recep',4.8,1.2),ob('lsofa',1,5.5),ob('lsofa',5,5.5),ob('ctable',3.3,6.7),ob('plant',.4,.4),ob('plant',11.1,.4),ob('wc',.6,9.3),ob('basin',2,10.9),ob('wc',3.6,9.3),ob('basin',5,10.9),ob('stairs',7.2,9,90,{w:1.2,h:3}),ob('lift',10,9.6));
  for(let c=0;c<4;c++){ for(let r=0;r<3;r++){ const x=13+c*3.1, y=1.2+r*3; G.push(ob('t4',x+.4,y+.6)); G.push(ob('dchair',x+.55,y+.1),ob('dchair',x+1.05,y+.1),ob('dchair',x+.55,y+1.45,180),ob('dchair',x+1.05,y+1.45,180)); } }
  G.push(ob('counter',22.8,9.6),ob('hand',25.4,.2),ob('cash',19.4,10.0));
  G.push(ob('range4',26.2,.15),ob('range4',27.5,.15),ob('hood',26.1,.05,0,{w:2.7,h:1}),ob('tandoor',29.2,.2),ob('mandi',30.4,.1),ob('hood',29,.05,0,{w:2.8,h:1.3}),ob('prep',26.4,3),ob('prep',28.6,3),ob('sink2',33.4,.15),ob('dish',32.6,.2),ob('fridge',34.1,2.2,90),ob('freezer',33.4,4.9),ob('pass',26.3,6.25),ob('rack',33.6,6.3));
  G.push(ob('srack',26.2,7.2),ob('srack',28.8,7.2),ob('pallet',26.4,9.4),ob('gas',29.1,10.2),ob('linen',30.8,7.2),ob('washer',33.9,7.2),ob('dryer',33.9,7.9),ob('trolley',31,10.2),ob('iron',32.6,9.2),ob('mop',34.2,10.2));
  D.floors.push({id:uid(),name:'Ground',items:G});
  const roomKit=(deluxe)=>{ const O=[]; if(deluxe) O.push(['bed_k',.25,.1,0]); else O.push(['bed_s',.15,.1,0],['bed_s',1.25,.1,0]);
    O.push(['side',deluxe?2.25:2.3,.15,0],['wardrobe',3.3,.7,90],['lugg',3.4,1.85,90],['desk',1.3,3.3,90],['chair',1.05,3.35,0],['ac',1,0,0],['wc',2.35,4.15,270],['basin',3.675,3.075,90],['shower',3.25,4.05,0]); return O; };
  const mirrorY=(H0,y,h)=>H0-y-h, mirR=r=>((180-(r||0))%360+360)%360;
  [1,2].forEach(fl=>{ const I=[]; const cor2=sp('corridor',0,5,21,2,{name:'Corridor'}), st2=sp('stairs',21,5,4,2,{name:'Stairs + lift'}); I.push(cor2,st2,door(st2,3,.5,1.2));
    for(let i=0;i<10;i++){ const north=i<5, k=north?i:i-5, x=k*4.2, y0=north?0:7, no=String(fl*100+i+1), deluxe=k%2===1,
        rm=sp('room',x,y0,4.2,5,{no,cat:deluxe?'Deluxe':'Standard',beds:deluxe?'1 king':'2 single',guests:2,rate:deluxe?3200:2400}),
        bt=sp('bath',x+2.2,north?2.8:7,2,2.2,{name:'Bath '+no}); I.push(rm,bt);
      I.push(door(rm,north?2:0,north?.75:.25,.9),win(rm,north?0:2,.5,1.6),door(bt,north?0:2,north?.3:.7,.75,{side:north?-1:1}));
      roomKit(deluxe).forEach(([t,ox,oy,r])=>{ const T=OBJ[t], d=T.d; const yy=north?oy:mirrorY(5,oy,d); I.push(ob(t,r2(x+ox),r2(y0+yy),north?r:mirR(r))); }); }
    D.floors.push({id:uid(),name:fl===1?'First':'Second',items:I}); });
  return D; }
/* ---------------- saving: this device at once, the cloud when signed in as office ---------------- */
let ST1=null, ST2=null;
function changed(silent){ DIRTY=true; checks(); draw(); dock(); floors(); $('undo').disabled=!HIST.u.length; $('redo').disabled=!HIST.r.length; $('pname').textContent=P.name;
  clearTimeout(ST1); ST1=setTimeout(saveLocal,350); clearTimeout(ST2); ST2=setTimeout(saveCloud,2500); if(MODE!=='2d') show3d(); if(PRO&&PREF.tab==='layers') layersPanel(); status(); }
function saveLocal(){ P.at=Date.now(); try{ localStorage.setItem(LS,JSON.stringify(P)); savedNote('saved on this device'+(cloudOk()?' · cloud…':'')); }catch(e){ savedNote('⚠ storage full — save the plan file (⋯)'); } }
function cloudOk(){ return !!(CTX&&CTX.fs&&CTX.db&&/office|cashier/.test(CTX.role||'')); }
async function saveCloud(){ if(!cloudOk()) return; if(CLOUD.busy){ CLOUD.again=true; return; }   /* edits made during an upload are sent right after it */
  const s=JSON.stringify(P); if(s.length>900000){ savedNote('⚠ plan too big for the cloud — save the plan file'); return; }
  CLOUD.busy=true; let ok=false; try{ await CTX.fs.setDoc(CTX.fs.doc(CTX.db,'plans',P.id||'demo'),{v:1,name:P.name,at:P.at||Date.now(),by:CTX.name||'',json:s}); ok=true; CLOUD.at=P.at; if(!CLOUD.again) DIRTY=false; savedNote('saved · cloud ✓ '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})); }
  catch(e){ savedNote('saved on this device · cloud failed, will retry'); setTimeout(saveCloud,15000); } CLOUD.busy=false; if(CLOUD.again){ CLOUD.again=false; if(ok) saveCloud(); } }
function savedNote(t){ const e=$('saved'); if(e) e.textContent=t; const s=$('stSave'); if(s) s.textContent=t; }
function load(obj,why){ if(!obj||!obj.floors||!obj.floors.length) return false; P=obj; P.floors.forEach(f=>{ f.items=(f.items||[]).filter(i=>i&&i.kind&&(i.kind!=='dim'||(Array.isArray(i.a)&&Array.isArray(i.b)))); });
  P.floors.forEach(f=>{ const ids=new Set(f.items.map(i=>i.id)); f.items=f.items.filter(i=>!(i.kind==='door'||i.kind==='window')||ids.has(i.sp)); });
  FL=Math.min(FL,P.floors.length-1); selClear(); if(why) toast(why); return true; }
function download(name,href){ const a=document.createElement('a'); a.href=href; a.download=name; a.click(); }
function savePng(){ if(MODE==='3d'||MODE==='walk'){ const u=V3&&V3.snapshot&&V3.snapshot(); if(u) download((P.name+'-'+floor().name+'-3D').replace(/\W+/g,'-')+'.png',u); return; }
  NORULER=true; draw(); const r=svg.getBoundingClientRect(), cs=getComputedStyle(document.documentElement); let s=svg.outerHTML.replace(/var\((--[a-z0-9]+)\)/gi,(m,v)=>cs.getPropertyValue(v).trim()||'#888'); NORULER=false; draw();
  const css=[...document.styleSheets].flatMap(sh=>{ try{ return [...sh.cssRules].map(x=>x.cssText).filter(t=>/^\.(sp|ob|op|lbl|lbl2|selb|selm|hd|dim|dimg|dima|dimr|ghost)\b/.test(t)); }catch(e){ return []; } }).join('').replace(/var\((--[a-z0-9]+)\)/gi,(m,v)=>cs.getPropertyValue(v).trim()||'#888');
  s=s.replace('<svg ',`<svg width="${r.width}" height="${r.height}" `).replace(/^(<svg[^>]*>)/,`$1<style>${css}</style><rect width="100%" height="100%" fill="${cs.getPropertyValue('--paper').trim()||'#fff'}"/>`);
  const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=r.width*2; c.height=r.height*2; const g=c.getContext('2d'); g.scale(2,2); g.drawImage(img,0,0); g.fillStyle='#555'; g.font='bold 13px sans-serif'; g.fillText(P.name+' · '+floor().name,12,r.height-12);
    c.toBlob(b=>{ const u=URL.createObjectURL(b); download((P.name+'-'+floor().name).replace(/\W+/g,'-')+'.png',u); setTimeout(()=>URL.revokeObjectURL(u),4000); }); };
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s); }
function saveJson(){ const b=new Blob([JSON.stringify(P,null,1)],{type:'application/json'}), u=URL.createObjectURL(b); download(P.name.replace(/\W+/g,'-')+'.plan.json',u); setTimeout(()=>URL.revokeObjectURL(u),4000); }
$('file').onchange=()=>{ const f=$('file').files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ try{ const o=JSON.parse(rd.result); commit(); if(load(o,'Plan opened · '+(o.name||''))){ changed(); fit(); afterSel(true); } else toast('That file is not a plan'); }catch(e){ toast('That file is not a plan'); } $('file').value=''; }; rd.readAsText(f); };
/* ---------------- menu + 2D / 3D / Split / Walk ---------------- */
$('more').onclick=e=>{ e.stopPropagation(); $('menu').classList.toggle('on'); };
document.addEventListener('click',e=>{ if(!e.target.closest('#menu,#more')) $('menu').classList.remove('on'); });
$('menu').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ $('menu').classList.remove('on'); const m=b.dataset.m;
  if(m==='sketch'){ openSketch(); return; }
  if(m==='sum') sumSheet(); else if(m==='rooms') roomsSheet(); else if(m==='help') helpSheet(); else if(m==='png') savePng(); else if(m==='json') saveJson(); else if(m==='import') $('file').click();
  else if(m==='tpl'||m==='blank'){ sheet(`<h2>${m==='tpl'?'Start from the demo hotel':'Start a blank plan'}<button class="ib x" data-x>✕</button></h2><p>This replaces the plan on screen (${P.floors.reduce((n,f)=>n+f.items.length,0)} things). ↶ brings it back.</p><div class="btns"><button class="btn pri" id="tGo">Yes, start</button></div>`,()=>{ $('tGo').onclick=()=>{ commit(); P=m==='tpl'?demoHotel():blank('My hotel'); FL=0; selClear(); closeSheet(); changed(); fit(); afterSel(true); if(MODE!=='2d') show3d(true); }; }); }
  else if(m==='name'){ sheet(`<h2>Rename<button class="ib x" data-x>✕</button></h2><label class="f">Plan name<input id="pN" value="${esc(P.name)}" maxlength="40"></label><div class="btns"><button class="btn pri" id="pGo">Save</button></div>`,()=>{ $('pGo').onclick=()=>{ commit(); P.name=$('pN').value.trim()||'My hotel'; closeSheet(); changed(); renderPanel(); }; }); } });
$('undo').onclick=undo; $('redo').onclick=redo;
$('zin').onclick=()=>{ const r=svg.getBoundingClientRect(); setView(VIEW.s*1.3,r.width/2,r.height/2); }; $('zout').onclick=()=>{ const r=svg.getBoundingClientRect(); setView(VIEW.s/1.3,r.width/2,r.height/2); }; $('zfit').onclick=()=>{ if(MODE==='3d') show3d(true); else fit(); };
/* ---------------- plan from a paper sketch (planner-sketch.js, loaded when opened) ---------------- */
let SK=null;
function underAct(k){ const F=floor(); if(!F.under) return; if(k==='hide'){ PREF.lay.sketch[0]=PREF.lay.sketch[0]?0:1; savePref(); draw(); renderPanel(); return; } if(k==='del'){ commit(); delete F.under; changed(); renderPanel(); toast('Sketch photo removed · ↶ brings it back'); } }
function skHooks(){ return {ST,STYPES,uid,toast,
  floorEmpty:()=>!items().some(i=>i.kind==='space'), floorName:()=>floor().name,
  usedNos:()=>new Set(P.floors.flatMap(f=>f.items).filter(i=>i.no).map(i=>String(i.no))),
  nextRoomNo:()=>{ const used=new Set(P.floors.flatMap(f=>f.items).filter(i=>i.no).map(i=>String(i.no))); let n=(P.floors.length&&!items().some(i=>i.kind==='space')?FL:P.floors.length)*100+1; if(n<101) n=101; while(used.has(String(n))) n++; return String(n); },
  create:(list,under,where)=>{ commit();
    if(where==='new'){ P.floors.push({id:uid(),name:'From sketch'+(P.floors.some(f=>/^From sketch/.test(f.name))?' '+(P.floors.length+1):''),items:[]}); FL=P.floors.length-1; }
    else if(where==='replace'){ floor().items=[]; }
    const F=floor(); list.forEach(o=>F.items.push(o)); if(under) F.under=under; PREF.lay.sketch[0]=1; selClear(); setMode('2d'); changed(); floors(); fit(); afterSel(true);
    const sp=list.filter(o=>o.kind==='space').length, dr=list.filter(o=>o.kind==='door').length, wn=list.filter(o=>o.kind==='window').length;
    toast(`✓ ${sp} rooms · ${dr} doors · ${wn} windows made`+(WARN.list.length?` · ⚠ ${WARN.list.length} to check`:''));
    if(WARN.list.length) setTimeout(()=>warnSheet(),900); } }; }
async function openSketch(){ try{ SK=SK||await import('./planner-sketch.js'); SK.open(skHooks()); }catch(e){ toast('The sketch reader could not start: '+(e.message||e)); } }

let V3=null;
function H3(reset){ return {reset,ST,OBJ,worldPts,openingPos,edges,area,centroid,spaceLabel,inside,hidden:(it,f)=>isHidden(it,f),layers:{furn:!!PREF.lay.furn[0],open:!!PREF.lay.open[0]},
  onSelect:id=>{ if(id) sel1(id); else selClear(); draw(); dock(); if(PRO) renderPanel(); else if(id) openInspector(); else closeSheet(); },
  onEdit:(id,v)=>{ const it=byId(id); if(!it) return; commit(); it.w=Math.max(.05,v.w); it.h=Math.max(.05,v.h); it.x=r2(v.cx-it.w/2); it.y=r2(v.cy-it.h/2); it.r=v.r; magnet(it,true); changed(); if(PRO) renderPanel(); else openInspector(true); },
  onWalk:on=>{ if(on){ if(MODE!=='walk') PREWALK=MODE; setMode('walk'); } else setMode(PREWALK&&PREWALK!=='walk'?PREWALK:'3d'); }}; }
async function show3d(reset){ const el=$('v3'); el.classList.add('on'); try{ V3=V3||await import('./planner3d.js'); V3.show(el,P,FL,H3(!!reset)); return true; }catch(e){ el.innerHTML='<p style="padding:20px">3D could not start on this device: '+esc(e.message||e)+'</p>'; return false; } }
async function setMode(m){ if(m==='split'&&!PRO) m='3d'; const prev=MODE; if(prev===m&&m!=='2d') return; MODE=m; document.body.dataset.mode=m;
  [['m2d','2d'],['m3d','3d'],['mSplit','split'],['mWalk','walk']].forEach(([id,k])=>$(id).classList.toggle('on',k===m));
  const s2=m==='2d'||m==='split', s3=m!=='2d'; svg.style.display=s2?'':'none'; $('v3').classList.toggle('on',s3);
  $('dock').style.visibility=(!PRO&&s3)?'hidden':''; if(!s2){ hint(''); DRAFT=null; if(TOOL!=='select'&&TOOL!=='hand') TOOL='select'; } if(!PRO&&s3) closeSheet();
  layout();
  if(s3){ const ok=await show3d(prev==='2d'); if(ok&&V3){ V3.walk(m==='walk',SEL); if(m!=='walk') V3.setSel(SELS.size===1?SEL:null); } }
  else if(V3){ V3.walk(false); V3.pause(); }
  if(s2){ requestAnimationFrame(()=>{ if(prev==='3d'||prev==='walk') fit(); else draw(); }); } dock(); status(); }
$('m2d').onclick=()=>setMode('2d'); $('m3d').onclick=()=>setMode('3d'); $('mSplit').onclick=()=>setMode('split'); $('mWalk').onclick=()=>{ if(MODE!=='walk') PREWALK=MODE==='2d'?'3d':MODE; setMode('walk'); };
function topH(){ const t=document.querySelector('.top'); if(t) document.documentElement.style.setProperty('--toph',t.offsetHeight+'px'); }
function layout(){ const was=PRO; PRO=innerWidth>=900; const B=document.body; B.classList.toggle('pro',PRO); const float=innerWidth<1240; B.classList.toggle('libfloat',float); B.classList.toggle('rulers',PRO&&!!PREF.rulers&&MODE!=='3d'&&MODE!=='walk');
  const open=PRO&&PREF.lib&&MODE!=='walk'; $('lpanel').classList.toggle('closed',!open); document.documentElement.style.setProperty('--lpw',open&&!float?'var(--lw)':'0px');
  topH(); if(PRO!==was){ closeSheet(); $('dock').dataset.h=''; $('status').dataset.built=''; } if(PRO){ libPanel(); renderPanel(); status(); } dock(); }
let RZ=null; window.addEventListener('resize',()=>{ clearTimeout(RZ); RZ=setTimeout(()=>{ const was=PRO; layout(); if(MODE!=='3d'&&MODE!=='walk'){ if(was!==PRO) fit(); else draw(); } },60); });
/* tests + console */
window.PLANNER={get P(){ return P; },get SEL(){ return SEL; },set SEL(v){ sel1(v); },get SELS(){ return [...SELS]; },set SELS(v){ SELS=new Set(v||[]); SEL=v&&v.length?v[v.length-1]:null; },get VIEW(){ return VIEW; },get WARN(){ return WARN; },get TOOL(){ return TOOL; },get FL(){ return FL; },set FL(v){ FL=v; selClear(); floors(); if(MODE!=='2d') show3d(true); fit(); renderPanel(); },get MODE(){ return MODE; },get PRO(){ return PRO; },get PREF(){ return PREF; },get THUMBS(){ return THUMBS; },get V3(){ return V3; },
  load:o=>{ if(load(o)){ changed(); fit(); } },demoHotel,checks,worldPts,openingPos,byId,undo,redo,fit,setMode,placeObj,setTool,changed,W2S,S2W,roomsAll,alignSel,dup,del,copySel,paste,afterSel,makeThumbs,openSketch,get SK(){ return SK; },get HIST(){ return HIST; }};
/* ---------------- start ---------------- */
(async function boot(){
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){}
  if(!load(saved)) P=demoHotel();
  document.body.dataset.mode=MODE; layout(); checks(); floors(); dock(); fit(); $('undo').disabled=true; $('redo').disabled=true; $('pname').textContent=P.name;
  savedNote(saved?'saved on this device':'demo hotel · nothing saved yet'); renderPanel();
  if(!window.HayatAuth) return;
  try{ CTX=await HayatAuth.start({cache:true}); }catch(e){ CTX=null; }
  if(!cloudOk()){ savedNote((saved?'saved on this device':'demo hotel')+' · sign in as office (admin app) to keep it in the cloud'); return; }
  CTX.fs.onSnapshot(CTX.fs.doc(CTX.db,'plans',P.id||'demo'),d=>{ if(!d.exists()){ saveCloud(); return; } const x=d.data(); if(!x||!x.json||(x.at||0)<=(P.at||0)) return;
    if(DIRTY&&(P.at||0)>CLOUD.at){ toast('This plan was changed on another device · yours is kept'); return; }
    try{ if(load(JSON.parse(x.json),'Newer plan from '+(x.by||'another device'))){ CLOUD.at=x.at; checks(); draw(); dock(); floors(); renderPanel(); try{ localStorage.setItem(LS,x.json); }catch(e){} if(MODE!=='2d') show3d(); } }catch(e){} },()=>{});
})();
})();
