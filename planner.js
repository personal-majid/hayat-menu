/* Hayat · Space planner (Majid, 14 Oct 2026)
   Draw floors of a hotel / restaurant in metres: spaces (rectangle, square, circle, triangle, any polygon),
   doors + windows on their walls, and simple real-size objects (beds, bathroom, restaurant, kitchen, store,
   cleaning, lobby). 2D plan to edit, 3D view to look at (planner3d.js, loaded only when opened).
   Guest-room spaces carry room no., category, beds, guests and rate: they become the rooms for booking.
   Saved on this phone at once (localStorage) and to the cloud (plans/{id}) when signed in. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Math.round(v*100)/100, snapv=(v,g)=>Math.round(v/g)*g;
const uid=()=>Date.now().toString(36).slice(-5)+Math.random().toString(36).slice(2,6);

/* ---------------- what can be placed ---------------- */
/* space types: [key, name, colour, is it a guest room] */
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
const SEAT={dchair:1,booth:3,sofa2:0,chair:0};   /* restaurant seats are counted from these */
const CATS={room:['Standard','Deluxe','Premium','Family'],suite:['Suite','Executive suite']};

/* ---------------- state ---------------- */
const LS='hayat-plan-v1';
let P=null, FL=0, SEL=null, TOOL='select', VIEW={s:40,ox:40,oy:40}, MODE='2d', DIRTY=false, CTX=null, CLOUD={at:0,busy:false,err:''};
const HIST={u:[],r:[]};
function blank(name){ return {v:1,id:'demo',name:name||'Demo hotel',grid:.1,floors:[{id:uid(),name:'Ground',items:[]}],at:Date.now()}; }
function floor(){ return P.floors[FL]||P.floors[0]; }
function items(){ return floor().items; }
function byId(id){ for(const f of P.floors) for(const it of f.items) if(it.id===id) return it; return null; }
function commit(){ HIST.u.push(JSON.stringify(P)); if(HIST.u.length>80) HIST.u.shift(); HIST.r=[]; }
function undo(){ if(!HIST.u.length) return; HIST.r.push(JSON.stringify(P)); P=JSON.parse(HIST.u.pop()); if(FL>=P.floors.length) FL=0; if(SEL&&!byId(SEL)) SEL=null; changed(true); }
function redo(){ if(!HIST.r.length) return; HIST.u.push(JSON.stringify(P)); P=JSON.parse(HIST.r.pop()); if(SEL&&!byId(SEL)) SEL=null; changed(true); }

/* ---------------- geometry (metres; y grows downwards on the plan) ---------------- */
function ctr(it){ return [it.x+it.w/2,it.y+it.h/2]; }
function rot([x,y],[cx,cy],deg){ const a=deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a), dx=x-cx, dy=y-cy; return [cx+dx*c-dy*s,cy+dx*s+dy*c]; }
/* outline of a space or object in its own box (0..w, 0..h), before rotation */
function localPts(it){
  if(it.shape==='circle'||it.shape==='round'){ const n=40, out=[]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; out.push([it.w/2+it.w/2*Math.cos(a),it.h/2+it.h/2*Math.sin(a)]); } return out; }
  if(it.shape==='tri') return [[it.w/2,0],[it.w,it.h],[0,it.h]];
  if(it.shape==='poly'&&it.pts&&it.pts.length>2) return it.pts.map(p=>[p[0]*it.w,p[1]*it.h]);
  return [[0,0],[it.w,0],[it.w,it.h],[0,it.h]];
}
function worldPts(it){ const c=ctr(it); return localPts(it).map(p=>rot([it.x+p[0],it.y+p[1]],c,it.r||0)); }
function area(pts){ let a=0; for(let i=0;i<pts.length;i++){ const p=pts[i], q=pts[(i+1)%pts.length]; a+=p[0]*q[1]-q[0]*p[1]; } return Math.abs(a)/2; }
function inside(pt,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i], b=pts[j]; if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
function edges(it){ const P0=worldPts(it); return P0.map((p,i)=>[p,P0[(i+1)%P0.length]]); }
function projSeg(pt,[a,b]){ const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy||1e-9; let t=((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L2; t=Math.max(0,Math.min(1,t)); const q=[a[0]+t*dx,a[1]+t*dy]; return {t,q,d:Math.hypot(pt[0]-q[0],pt[1]-q[1]),len:Math.sqrt(L2)}; }
/* separating-axis test for two convex outlines (objects are boxes or near-boxes) */
function overlapPts(A,B){ const axes=[]; [A,B].forEach(P0=>{ for(let i=0;i<P0.length;i++){ const p=P0[i], q=P0[(i+1)%P0.length]; axes.push([-(q[1]-p[1]),q[0]-p[0]]); } });
  let minOv=Infinity; for(const ax of axes){ const L=Math.hypot(ax[0],ax[1])||1, n=[ax[0]/L,ax[1]/L]; let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    A.forEach(p=>{ const v=p[0]*n[0]+p[1]*n[1]; a0=Math.min(a0,v); a1=Math.max(a1,v); }); B.forEach(p=>{ const v=p[0]*n[0]+p[1]*n[1]; b0=Math.min(b0,v); b1=Math.max(b1,v); });
    const ov=Math.min(a1,b1)-Math.max(a0,b0); if(ov<=0.02) return 0; minOv=Math.min(minOv,ov); } return minOv; }
function bbox(pts){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; pts.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }); return [x0,y0,x1,y1]; }
/* openings sit on a wall of a space: {sp, e (edge), t (0..1 along it), w} -> where they are now */
function openingPos(o){ const s=byId(o.sp); if(!s) return null; const E=edges(s)[o.e]; if(!E) return null; const [a,b]=E, len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI, p=[a[0]+(b[0]-a[0])*o.t,a[1]+(b[1]-a[1])*o.t]; return {p,ang,len,a,b,space:s}; }
function spaceOf(pt,fl){ const L=(fl||floor()).items.filter(i=>i.kind==='space'); for(let i=L.length-1;i>=0;i--) if(inside(pt,worldPts(L[i]))) return L[i]; return null; }
function nearestWall(pt,maxD){ let best=null; items().filter(i=>i.kind==='space').forEach(s=>{ edges(s).forEach((E,i)=>{ const r=projSeg(pt,E); if(r.d<=maxD&&(!best||r.d<best.d)) best={sp:s.id,e:i,t:r.t,d:r.d,len:r.len}; }); }); return best; }

/* ---------------- drawing the plan (screen pixels, so lines and text stay crisp at any zoom) ---------------- */
const svg=$('svg');
const W2S=p=>[p[0]*VIEW.s+VIEW.ox,p[1]*VIEW.s+VIEW.oy];
function S2W(cx,cy){ const r=svg.getBoundingClientRect(); return [(cx-r.left-VIEW.ox)/VIEW.s,(cy-r.top-VIEW.oy)/VIEW.s]; }
const ptsAttr=P0=>P0.map(p=>{ const q=W2S(p); return q[0].toFixed(1)+','+q[1].toFixed(1); }).join(' ');
let WARN={list:[],ids:new Set()}, DRAFT=null;
function centroid(P0){ let x=0,y=0,a=0; for(let i=0;i<P0.length;i++){ const p=P0[i], q=P0[(i+1)%P0.length], c=p[0]*q[1]-q[0]*p[1]; a+=c; x+=(p[0]+q[0])*c; y+=(p[1]+q[1])*c; } if(Math.abs(a)<1e-9){ const b=bbox(P0); return [(b[0]+b[2])/2,(b[1]+b[3])/2]; } return [x/(3*a),y/(3*a)]; }
function spaceLabel(s){ const t=ST[s.type]||ST.other; return t.guest&&s.no?s.no+(s.cat?' · '+s.cat:''):(s.name||t.n); }
/* little drawings inside an object, in its own metres around its centre */
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
  else if(k==='hood'){ line(x0,y0,x0+w,y0+d); line(x0+w,y0,x0,y0+d); }
  else if(k==='lift'){ line(x0,y0,x0+w,y0+d); line(x0+w,y0,x0,y0+d); }
  else if(k==='tandoor'||k==='mandi') circ(0,0,Math.min(w,d)/2*.55,'rgba(0,0,0,.35)');
  else if(k==='fridge'||k==='freezer'||k==='dfreezer'||k==='coldroom') line(x0+.06,y0+d-.08,x0+w-.06,y0+d-.08);
  else if(k==='srack'||k==='rack'||k==='linen'){ for(let i=1;i<4;i++) line(x0,y0+d*i/4,x0+w,y0+d*i/4); }
  return L.join('');
}
function draw(){
  if(MODE!=='2d') return;
  const S=VIEW.s, L=items(), out=[];
  const g1=S*.5, g5=S*5, ox=((VIEW.ox%g1)+g1)%g1, oy=((VIEW.oy%g1)+g1)%g1, ox5=((VIEW.ox%g5)+g5)%g5, oy5=((VIEW.oy%g5)+g5)%g5;
  out.push(`<defs><pattern id="pg1" width="${g1}" height="${g1}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M ${g1} 0 L 0 0 0 ${g1}" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern><pattern id="pg5" width="${g5}" height="${g5}" patternUnits="userSpaceOnUse" x="${ox5}" y="${oy5}"><path d="M ${g5} 0 L 0 0 0 ${g5}" fill="none" stroke="var(--grid2)" stroke-width="1"/></pattern></defs>`);
  out.push(`<rect width="100%" height="100%" fill="url(#pg1)" data-bg="1"/><rect width="100%" height="100%" fill="url(#pg5)" data-bg="1"/>`);
  /* spaces first (floors + walls), then objects, then doors/windows on top of the walls */
  L.filter(i=>i.kind==='space').forEach(s=>{ const t=ST[s.type]||ST.other, P0=worldPts(s); out.push(`<g data-id="${s.id}" class="${WARN.ids.has(s.id)?'bad':''}"><polygon points="${ptsAttr(P0)}" fill="${t.c}" class="sp"/></g>`); });
  L.filter(i=>i.kind==='obj').forEach(o=>{ const T=OBJ[o.t]||{}, P0=worldPts(o), c=W2S(ctr(o));
    out.push(`<g data-id="${o.id}" class="${WARN.ids.has(o.id)?'bad':''}"><polygon points="${ptsAttr(P0)}" fill="${o.c||T.c||'#bbb'}" class="ob${WARN.ids.has(o.id)?' bad':''}" fill-opacity="${T.lift?'.45':'1'}"/><g transform="translate(${c[0].toFixed(1)},${c[1].toFixed(1)}) rotate(${o.r||0}) scale(${S})" pointer-events="none">${glyph(o)}</g></g>`); });
  L.filter(i=>i.kind==='door'||i.kind==='window').forEach(o=>{ const q=openingPos(o); if(!q) return; const a=q.ang*Math.PI/180, ux=Math.cos(a), uy=Math.sin(a), hw=o.w/2;
    const A=W2S([q.p[0]-ux*hw,q.p[1]-uy*hw]), B=W2S([q.p[0]+ux*hw,q.p[1]+uy*hw]), side=o.side||1, nx=-uy*side, ny=ux*side, sw=Math.max(5,S*.14);
    let g=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="var(--paper)" stroke-width="${sw}" class="op"/>`;
    if(o.kind==='door'){ const hinge=o.flip?B:A, other=o.flip?A:B, leaf=[hinge[0]+nx*o.w*S,hinge[1]+ny*o.w*S], sweep=(side>0)!==!!o.flip?1:0;
      g+=`<line x1="${hinge[0]}" y1="${hinge[1]}" x2="${leaf[0]}" y2="${leaf[1]}" stroke="var(--ink)" stroke-width="2" class="op"/><path d="M ${leaf[0]} ${leaf[1]} A ${o.w*S} ${o.w*S} 0 0 ${sweep} ${other[0]} ${other[1]}" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" class="op"/>`; }
    else { const off=Math.max(2,S*.04); g+=`<line x1="${A[0]+nx*off}" y1="${A[1]+ny*off}" x2="${B[0]+nx*off}" y2="${B[1]+ny*off}" stroke="#3a7bd5" stroke-width="2" class="op"/><line x1="${A[0]-nx*off}" y1="${A[1]-ny*off}" x2="${B[0]-nx*off}" y2="${B[1]-ny*off}" stroke="#3a7bd5" stroke-width="2" class="op"/>`; }
    const hit=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="transparent" stroke-width="${Math.max(18,sw+10)}"/>`;
    out.push(`<g data-id="${o.id}" class="${WARN.ids.has(o.id)?'bad':''}">${g}${hit}</g>`); });
  /* labels (never hide the plan: drawn last, no pointer events) */
  L.filter(i=>i.kind==='space').forEach(s=>{ const P0=worldPts(s), b=bbox(P0.map(W2S)), bw=b[2]-b[0]-8, bh=b[3]-b[1]; if(bw<22||bh<18) return; const c=W2S(centroid(P0)), a=area(P0), fs=Math.max(11,Math.min(15,S*.32));
    /* the full label only when it fits; else the room no. / first word; else nothing - labels never run into each other */
    let t=spaceLabel(s); if(t.length*fs*.6>bw) t=s.no||String(s.name||(ST[s.type]||ST.other).n).split(/\s+/)[0]; if(t.length*fs*.6>bw) return;
    const ar=a.toFixed(1)+' m²', showA=bh>=34&&ar.length*11*.58<=bw;
    out.push(`<text x="${c[0]}" y="${c[1]+(showA?-3:4)}" text-anchor="middle" class="lbl" font-size="${fs}">${esc(t)}</text>`+(showA?`<text x="${c[0]}" y="${c[1]+12}" text-anchor="middle" class="lbl2" font-size="11">${ar}</text>`:'')); });
  if(S>=34) L.filter(i=>i.kind==='obj').forEach(o=>{ const b=bbox(worldPts(o).map(W2S)); if(b[2]-b[0]<60) return; const c=W2S(ctr(o)); out.push(`<text x="${c[0]}" y="${c[1]+4}" text-anchor="middle" class="lbl2" font-size="10.5">${esc(o.name||(OBJ[o.t]||{}).n||'')}</text>`); });
  /* selection: dashed box, 4 corner handles, rotate handle, size */
  const sel=SEL&&byId(SEL);
  if(sel&&(sel.kind==='space'||sel.kind==='obj')){ const box={x:sel.x,y:sel.y,w:sel.w,h:sel.h,r:sel.r||0}, P0=worldPts(box).map(W2S);
    out.push(`<polygon points="${P0.map(p=>p.join(',')).join(' ')}" class="selb"/>`);
    P0.forEach((p,i)=>out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="9" class="hd" data-h="${i}"/>`));
    const c=ctr(sel), top=rot([c[0],sel.y-Math.max(.5,22/S)],c,sel.r||0), T=W2S(top), M=W2S(rot([c[0],sel.y],c,sel.r||0));
    out.push(`<line x1="${M[0]}" y1="${M[1]}" x2="${T[0]}" y2="${T[1]}" class="selb"/><circle cx="${T[0]}" cy="${T[1]}" r="10" class="hd" data-h="rot"/><text x="${T[0]}" y="${T[1]+4}" text-anchor="middle" font-size="12" pointer-events="none" fill="var(--sel)">⟳</text>`);
    const bb=bbox(P0); out.push(`<text x="${(bb[0]+bb[2])/2}" y="${bb[3]+18}" text-anchor="middle" class="dim" font-size="12">${r2(sel.w)} × ${r2(sel.h)} m${sel.r?' · '+Math.round(sel.r)+'°':''}</text>`); }
  else if(sel&&(sel.kind==='door'||sel.kind==='window')){ const q=openingPos(sel); if(q){ const c=W2S(q.p); out.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${Math.max(14,sel.w*S/2+6)}" class="selb"/><text x="${c[0]}" y="${c[1]-Math.max(16,sel.w*S/2+10)}" text-anchor="middle" class="dim" font-size="12">${sel.kind==='door'?'Door':'Window'} ${r2(sel.w)} m</text>`); } }
  if(DRAFT){ if(DRAFT.pts){ const Q=DRAFT.pts.concat(DRAFT.hover?[DRAFT.hover]:[]); out.push(`<polyline points="${ptsAttr(Q)}" class="ghost" fill="rgba(42,120,214,.10)"/>`); DRAFT.pts.forEach((p,i)=>{ const q=W2S(p); out.push(`<circle cx="${q[0]}" cy="${q[1]}" r="${i?5:8}" fill="${i?'var(--sel)':'#fff'}" stroke="var(--sel)" stroke-width="2"/>`); }); }
    else if(DRAFT.box){ const b=DRAFT.box; out.push(`<polygon points="${ptsAttr(worldPts(b))}" class="ghost"/>`); const q=W2S([b.x+b.w/2,b.y+b.h]); out.push(`<text x="${q[0]}" y="${q[1]+18}" text-anchor="middle" class="dim" font-size="12">${r2(b.w)} × ${r2(b.h)} m</text>`); } }
  svg.innerHTML=out.join('');
}

/* ---------------- touching the plan ---------------- */
const PTR=new Map(); let DRAG=null, PINCH=null;
const SNAP=()=>P.grid||.1;
function setView(s,ax,ay){ s=Math.max(6,Math.min(400,s)); const k=s/VIEW.s; VIEW.ox=ax-(ax-VIEW.ox)*k; VIEW.oy=ay-(ay-VIEW.oy)*k; VIEW.s=s; draw(); }
function fit(){ const L=items(); const r=svg.getBoundingClientRect(); if(!L.length){ VIEW={s:40,ox:r.width/2-200,oy:r.height/2-160}; draw(); return; }
  const b=bbox(L.filter(i=>i.kind!=='door'&&i.kind!=='window').flatMap(worldPts)); const pad=36, s=Math.min((r.width-pad*2)/Math.max(1,b[2]-b[0]),(r.height-pad*2)/Math.max(1,b[3]-b[1]));
  VIEW.s=Math.max(6,Math.min(160,s)); VIEW.ox=(r.width-(b[2]-b[0])*VIEW.s)/2-b[0]*VIEW.s; VIEW.oy=(r.height-(b[3]-b[1])*VIEW.s)/2-b[1]*VIEW.s; draw(); }
/* magnets: a straight item's edges stick to nearby edges of other straight spaces (rooms side by side) and of the wall it stands in */
function magnet(it,moving){ if(((it.r||0)%90)!==0) return; const tol=Math.max(.12,10/VIEW.s), b=bbox(worldPts(it));
  const others=items().filter(o=>o!==it&&o.kind==='space'&&((o.r||0)%90)===0&&(it.kind==='space'||inside(ctr(it),worldPts(o))));
  let bx=null, by=null;
  others.forEach(o=>{ const q=bbox(worldPts(o)), xs=it.kind==='space'?[q[0],q[2]]:[q[0],q[2]], ys=[q[1],q[3]];
    xs.forEach(X=>[[b[0],0],[b[2],1]].forEach(([v])=>{ const d=X-v; if(Math.abs(d)<tol&&(bx==null||Math.abs(d)<Math.abs(bx))) bx=d; }));
    ys.forEach(Y=>[[b[1]],[b[3]]].forEach(([v])=>{ const d=Y-v; if(Math.abs(d)<tol&&(by==null||Math.abs(d)<Math.abs(by))) by=d; })); });
  if(moving){ if(bx!=null) it.x+=bx; if(by!=null) it.y+=by; } }
function hitOf(e){ const t=e.target; if(t.closest('[data-h]')) return {h:t.closest('[data-h]').dataset.h}; const g=t.closest('[data-id]'); return g?{id:g.dataset.id}:{}; }
svg.addEventListener('pointerdown',e=>{
  svg.setPointerCapture(e.pointerId); PTR.set(e.pointerId,[e.clientX,e.clientY]);
  if(PTR.size===2){ const [a,b]=[...PTR.values()]; PINCH={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:VIEW.s,mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2,ox:VIEW.ox,oy:VIEW.oy}; DRAG=null; DRAFT=DRAFT&&DRAFT.pts?DRAFT:null; draw(); return; }
  const w=S2W(e.clientX,e.clientY), sw=[snapv(w[0],SNAP()),snapv(w[1],SNAP())], hit=hitOf(e);
  if(TOOL==='poly'){ DRAFT=DRAFT||{pts:[]}; const f=DRAFT.pts[0]; if(f&&DRAFT.pts.length>=3&&Math.hypot(f[0]-sw[0],f[1]-sw[1])*VIEW.s<18){ finishPoly(); return; } DRAFT.pts.push(sw); hint(DRAFT.pts.length<3?'Tap the corners · '+DRAFT.pts.length+' so far':'Tap the first corner (or Done) to close',DRAFT.pts.length>=3?'Done':''); draw(); return; }
  if(TOOL==='rect'||TOOL==='square'||TOOL==='circle'||TOOL==='tri'){ DRAG={k:'draw',a:sw}; DRAFT={box:{x:sw[0],y:sw[1],w:0,h:0,shape:TOOL==='circle'?'circle':TOOL==='tri'?'tri':'rect'}}; return; }
  if(TOOL==='door'||TOOL==='window'){ const n=nearestWall(w,Math.max(.6,24/VIEW.s)); if(!n){ toast('Tap ON a wall to put the '+TOOL+' there'); return; }
    commit(); const wd=TOOL==='door'?.9:1.2, half=Math.min(.45,wd/2/Math.max(n.len,wd)); const o={id:uid(),kind:TOOL,sp:n.sp,e:n.e,t:Math.max(half,Math.min(1-half,n.t)),w:Math.min(wd,n.len*.9),side:1};
    items().push(o); SEL=o.id; changed(); openInspector(); return; }
  /* select tool */
  if(hit.h!=null&&SEL){ const it=byId(SEL); commitLazy(); DRAG={k:hit.h==='rot'?'rot':'size',c:+hit.h,orig:JSON.parse(JSON.stringify(it)),opp:hit.h==='rot'?null:worldPts({x:it.x,y:it.y,w:it.w,h:it.h,r:it.r||0})[(+hit.h+2)%4]}; return; }
  if(hit.id){ const it=byId(hit.id); if(SEL!==hit.id){ SEL=hit.id; draw(); openInspector(); } commitLazy(); DRAG={k:'move',id:hit.id,w0:w,orig:JSON.parse(JSON.stringify(it)),kids:it.kind==='space'?childrenOf(it).map(c=>[c,c.x,c.y]):[],moved:false}; return; }
  if(SEL){ SEL=null; closeSheet(); draw(); }
  DRAG={k:'pan',x:e.clientX,y:e.clientY,ox:VIEW.ox,oy:VIEW.oy};
});
let LAZY=false; function commitLazy(){ LAZY=true; }
function lazyCommit(){ if(LAZY){ commit(); LAZY=false; } }
/* objects standing in a space move with it (beds go with the room) */
function childrenOf(s){ const P0=worldPts(s); return items().filter(o=>o.kind==='obj'&&inside(ctr(o),P0)); }
svg.addEventListener('pointermove',e=>{
  if(PTR.has(e.pointerId)) PTR.set(e.pointerId,[e.clientX,e.clientY]);
  if(PINCH&&PTR.size>=2){ const [a,b]=[...PTR.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]), r=svg.getBoundingClientRect(); const s=Math.max(6,Math.min(400,PINCH.s*d/PINCH.d)), mx=(a[0]+b[0])/2-r.left, my=(a[1]+b[1])/2-r.top, m0x=PINCH.mx-r.left, m0y=PINCH.my-r.top;
    VIEW.s=s; VIEW.ox=mx-(m0x-PINCH.ox)*s/PINCH.s; VIEW.oy=my-(m0y-PINCH.oy)*s/PINCH.s; draw(); return; }
  const w=S2W(e.clientX,e.clientY), g=SNAP();
  if(DRAFT&&DRAFT.pts&&TOOL==='poly'){ DRAFT.hover=[snapv(w[0],g),snapv(w[1],g)]; draw(); return; }
  if(!DRAG) return;
  if(DRAG.k==='pan'){ VIEW.ox=DRAG.ox+e.clientX-DRAG.x; VIEW.oy=DRAG.oy+e.clientY-DRAG.y; draw(); return; }
  if(DRAG.k==='draw'){ const a=DRAG.a; let x1=snapv(w[0],g), y1=snapv(w[1],g); let W=x1-a[0], H=y1-a[1];
    if(TOOL==='square'||TOOL==='circle'){ const m=Math.max(Math.abs(W),Math.abs(H)); W=Math.sign(W||1)*m; H=Math.sign(H||1)*m; }
    if(TOOL==='circle'){ DRAFT.box={x:a[0]-Math.abs(W),y:a[1]-Math.abs(W),w:Math.abs(W)*2,h:Math.abs(W)*2,shape:'circle'}; }
    else DRAFT.box={x:Math.min(a[0],a[0]+W),y:Math.min(a[1],a[1]+H),w:Math.abs(W),h:Math.abs(H),shape:DRAFT.box.shape}; draw(); return; }
  const it=SEL&&byId(SEL); if(!it) return;
  if(DRAG.k==='move'){ const dx=w[0]-DRAG.w0[0], dy=w[1]-DRAG.w0[1]; if(!DRAG.moved&&Math.hypot(dx,dy)*VIEW.s<4) return; if(!DRAG.moved){ lazyCommit(); DRAG.moved=true; }
    if(it.kind==='door'||it.kind==='window'){ const n=nearestWall(w,Math.max(1,40/VIEW.s)); if(n){ const half=it.w/2/Math.max(n.len,it.w); it.sp=n.sp; it.e=n.e; it.t=Math.max(half,Math.min(1-half,n.t)); } draw(); return; }
    it.x=snapv(DRAG.orig.x+dx,g); it.y=snapv(DRAG.orig.y+dy,g); magnet(it,true);
    const mx=it.x-DRAG.orig.x, my=it.y-DRAG.orig.y; DRAG.kids.forEach(([c,x,y])=>{ c.x=x+mx; c.y=y+my; }); draw(); return; }
  if(DRAG.k==='rot'){ const c=ctr(it); let a=Math.atan2(w[1]-c[1],w[0]-c[0])*180/Math.PI+90; a=e.shiftKey?a:snapv(a,15); it.r=((Math.round(a)%360)+360)%360; draw(); return; }
  if(DRAG.k==='size'){ lazyCommit(); const o=DRAG.orig, r=(o.r||0)*Math.PI/180, sx=[-1,1,1,-1][DRAG.c], sy=[-1,-1,1,1][DRAG.c], opp=DRAG.opp;
    const vx=w[0]-opp[0], vy=w[1]-opp[1], lx=vx*Math.cos(-r)-vy*Math.sin(-r), ly=vx*Math.sin(-r)+vy*Math.cos(-r), mn=it.kind==='obj'?.2:.5;
    let W=Math.max(mn,snapv(lx*sx,g)), H=Math.max(mn,snapv(ly*sy,g)); if(it.shape==='circle'||(it.kind==='obj'&&it.shape==='round'&&o.w===o.h)) { W=H=Math.max(W,H); }
    const cx=opp[0]+(sx*W/2)*Math.cos(r)-(sy*H/2)*Math.sin(r), cy=opp[1]+(sx*W/2)*Math.sin(r)+(sy*H/2)*Math.cos(r);
    it.w=r2(W); it.h=r2(H); it.x=r2(cx-W/2); it.y=r2(cy-H/2); draw(); return; }
});
function endPtr(e){ PTR.delete(e.pointerId); if(PTR.size<2) PINCH=null;
  if(DRAG&&DRAG.k==='draw'&&DRAFT&&DRAFT.box){ const b=DRAFT.box; DRAFT=null; DRAG=null;
    if(b.w>=.5&&b.h>=.5){ commit(); const s={id:uid(),kind:'space',type:NEWTYPE,shape:b.shape,x:r2(b.x),y:r2(b.y),w:r2(b.w),h:r2(b.h),r:0}; autoName(s); items().push(s); SEL=s.id; setTool('select'); changed(); openInspector(); }
    else { draw(); hint('Drag to draw · at least 0.5 m'); setTimeout(()=>hint(''),1600); } return; }
  if(DRAG&&(DRAG.moved||DRAG.k==='size'||DRAG.k==='rot')){ DRAG=null; LAZY=false; changed(); openInspector(true); return; }
  if(DRAG&&DRAG.k==='move'&&!DRAG.moved&&!$('sheet').classList.contains('on')) openInspector();   /* tap again = its panel again */
  DRAG=null; LAZY=false; }
svg.addEventListener('pointerup',endPtr); svg.addEventListener('pointercancel',endPtr);
svg.addEventListener('wheel',e=>{ e.preventDefault(); const r=svg.getBoundingClientRect(); setView(VIEW.s*Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top); },{passive:false});
svg.addEventListener('dblclick',e=>{ if(TOOL==='poly'&&DRAFT&&DRAFT.pts&&DRAFT.pts.length>=3) finishPoly(); });
function finishPoly(){ const Q=DRAFT&&DRAFT.pts; if(!Q||Q.length<3){ toast('A shape needs 3 corners or more'); return; }
  const b=bbox(Q), W=Math.max(.5,b[2]-b[0]), H=Math.max(.5,b[3]-b[1]); commit();
  const s={id:uid(),kind:'space',type:NEWTYPE,shape:'poly',x:r2(b[0]),y:r2(b[1]),w:r2(W),h:r2(H),r:0,pts:Q.map(p=>[r2((p[0]-b[0])/W),r2((p[1]-b[1])/H)])};
  if(area(worldPts(s))<.25){ HIST.u.pop(); toast('That shape has no area · try again'); DRAFT=null; draw(); return; }
  autoName(s); items().push(s); DRAFT=null; SEL=s.id; setTool('select'); hint(''); changed(); openInspector(); }
/* the next free room number on this floor (floor 0 → 1, first → 101 …) */
function autoName(s){ const t=ST[s.type]||ST.other; if(!t.guest) return; const base=(FL||0)*100+1, used=new Set(P.floors.flatMap(f=>f.items).filter(i=>i.no).map(i=>String(i.no))); let n=base; while(used.has(String(n))) n++; s.no=String(n); s.cat=(CATS[s.type]||['Standard'])[0]; s.beds=s.beds||'1 king'; s.guests=s.guests||2; s.rate=s.rate||(s.type==='suite'?4500:2500); }
let NEWTYPE='room';
function placeObj(k){ const T=OBJ[k]; if(!T) return; const r=svg.getBoundingClientRect(); let c=S2W(r.left+r.width/2,r.top+r.height/2); const host=SEL&&byId(SEL); if(host&&host.kind==='space') c=ctr(host);
  commit(); const o={id:uid(),kind:'obj',t:k,shape:T.shape==='round'?'round':'box',x:r2(snapv(c[0]-T.w/2,SNAP())),y:r2(snapv(c[1]-T.d/2,SNAP())),w:T.w,h:T.d,r:0}; items().push(o); SEL=o.id; setTool('select'); changed(); openInspector(); toast('Drag it into place · corners resize · ⟳ turns'); }
document.addEventListener('keydown',e=>{ const typing=/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||''); if(typing) return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; } if(mod&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if(e.key==='Escape'){ if(DRAFT){ DRAFT=null; hint(''); draw(); } else if(TOOL!=='select') setTool('select'); else { SEL=null; closeSheet(); draw(); } return; }
  if(e.key==='Enter'&&TOOL==='poly'){ finishPoly(); return; }
  const it=SEL&&byId(SEL); if(!it) return;
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); del(); return; }
  if(mod&&e.key.toLowerCase()==='d'){ e.preventDefault(); dup(); return; }
  if(e.key.toLowerCase()==='r'&&(it.kind==='obj'||it.kind==='space')){ commit(); it.r=((it.r||0)+(e.shiftKey?-90:90)+360)%360; changed(); return; }
  const step=e.shiftKey?1:SNAP(), mv={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
  if(mv&&it.kind!=='door'&&it.kind!=='window'){ e.preventDefault(); commit(); it.x=r2(it.x+mv[0]); it.y=r2(it.y+mv[1]); if(it.kind==='space') childrenOf(Object.assign({},it,{x:it.x-mv[0],y:it.y-mv[1]})).forEach(c=>{ c.x=r2(c.x+mv[0]); c.y=r2(c.y+mv[1]); }); changed(); } });
function del(){ const it=SEL&&byId(SEL); if(!it) return; commit(); const f=floor(); const gone=new Set([it.id]); if(it.kind==='space') f.items.forEach(o=>{ if((o.kind==='door'||o.kind==='window')&&o.sp===it.id) gone.add(o.id); });
  f.items=f.items.filter(o=>!gone.has(o.id)); SEL=null; closeSheet(); changed(); toast((gone.size>1?'Removed with its '+(gone.size-1)+' door/window'+(gone.size>2?'s':''):'Removed')+' · ↶ to bring back'); }
function dup(){ const it=SEL&&byId(SEL); if(!it||it.kind==='door'||it.kind==='window') return; commit(); const c=JSON.parse(JSON.stringify(it)); c.id=uid(); c.x=r2(c.x+(it.kind==='space'?it.w:.3)); c.y=r2(c.y+(it.kind==='space'?0:.3)); if(c.no){ delete c.no; autoName(c); } items().push(c);
  if(it.kind==='space'){ const dx=c.x-it.x, dy=c.y-it.y, P0=worldPts(it), map={}; map[it.id]=c.id;
    items().filter(o=>o.kind==='obj'&&inside(ctr(o),P0)).forEach(o=>{ const k=JSON.parse(JSON.stringify(o)); k.id=uid(); k.x=r2(k.x+dx); k.y=r2(k.y+dy); items().push(k); });
    items().filter(o=>(o.kind==='door'||o.kind==='window')&&o.sp===it.id).forEach(o=>{ const k=JSON.parse(JSON.stringify(o)); k.id=uid(); k.sp=c.id; items().push(k); }); }
  SEL=c.id; changed(); openInspector(); toast('Copied'+(it.kind==='space'?' with everything inside':'')); }

/* ---------------- tools, floors, sheets ---------------- */
const IC={select:'<path d="M5 3l14 8-6 1.5L10 19z"/>',space:'<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 12h6"/>',door:'<path d="M5 20V4h9v16"/><path d="M14 4a10 10 0 0 1 5 9"/><circle cx="11.5" cy="12.5" r=".8"/>',window:'<rect x="4" y="6" width="16" height="12"/><path d="M12 6v12M4 12h16"/>',obj:'<path d="M3 13h18v4H3zM5 13V9a2 2 0 0 1 2-2h4v6M13 13V8h4a2 2 0 0 1 2 2v3M5 17v2M19 17v2"/>',warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',cube:'<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>'};
const svgI=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function dock(){ const n=WARN.list.length;
  const html=[['select','Select'],['space','Space'],['door','Door'],['window','Window'],['obj','Objects']].map(([k,l])=>`<button class="tool${TOOL===k||(k==='space'&&/rect|square|circle|tri|poly/.test(TOOL))?' on':''}" data-tool="${k}">${svgI(k)}${l}</button>`).join('')+
    `<button class="tool warn${n?'':' ok'}" data-tool="warn">${svgI('warn')}${n?n+' to check':'All good'}</button>`;
  if($('dock').dataset.h===html) return; $('dock').dataset.h=html; $('dock').innerHTML=html;   /* same buttons = leave them, so a tap in progress is never lost */
  $('dock').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ const k=b.dataset.tool; if(k==='space') shapeSheet(); else if(k==='obj') libSheet(); else if(k==='warn') warnSheet(); else setTool(k); }); }
function setTool(k){ TOOL=k; DRAFT=null; if(k!=='select'){ SEL=null; closeSheet(); }
  hint(k==='door'?'Tap on a wall to put a door':k==='window'?'Tap on a wall to put a window':k==='poly'?'Tap the corners · tap the first one to close':/rect|square|circle|tri/.test(k)?'Drag on the plan to draw · '+(ST[NEWTYPE]||{}).n:'', k==='select'?'':'Cancel');
  dock(); draw(); }
function floors(){ const html=P.floors.map((f,i)=>`<button class="chip${i===FL?' on':''}" data-fl="${i}">${esc(f.name)}</button>`).join('')+`<button class="chip" data-fl="+" title="add a floor">＋</button>`;
  if($('floors').dataset.h===html) return; $('floors').dataset.h=html; $('floors').innerHTML=html;
  $('floors').querySelectorAll('[data-fl]').forEach(b=>b.onclick=()=>{ const v=b.dataset.fl; if(v==='+'){ floorSheet(-1); return; } const i=+v; if(i===FL){ floorSheet(i); return; } FL=i; SEL=null; closeSheet(); if(MODE==='3d') show3d(); else fit(); floors(); dock(); }); }
let HINTCB=null;
function hint(t,btn){ const h=$('hint'); if(!t){ h.classList.remove('on'); return; } h.innerHTML=esc(t)+(btn?`<button id="hintB">${esc(btn)}</button>`:''); h.classList.add('on'); const b=$('hintB'); if(b) b.onclick=()=>{ if(btn==='Done') finishPoly(); else setTool('select'); }; }
let TT=null; function toast(t){ const e=$('toast'); e.textContent=t; e.classList.add('on'); clearTimeout(TT); TT=setTimeout(()=>e.classList.remove('on'),2600); }
function sheet(html,onWire){ $('sheetBody').innerHTML=html; $('sheet').classList.add('on'); if(onWire) onWire(); const x=$('sheet').querySelector('[data-x]'); if(x) x.onclick=closeSheet; }
function closeSheet(){ $('sheet').classList.remove('on'); }
/* swipe the sheet down to close */
(function(){ const sh=$('sheet'); let y0=null; sh.addEventListener('touchstart',e=>{ if(sh.scrollTop<=0) y0=e.touches[0].clientY; },{passive:true}); sh.addEventListener('touchend',e=>{ if(y0!=null&&e.changedTouches[0].clientY-y0>80) closeSheet(); y0=null; },{passive:true}); })();
function shapeSheet(){ const sh=[['rect','Rectangle','<rect x="6" y="10" width="44" height="22" rx="1"/>'],['square','Square','<rect x="16" y="6" width="26" height="26"/>'],['circle','Circle','<circle cx="29" cy="20" r="14"/>'],['tri','Triangle','<path d="M29 5l17 30H12z"/>'],['poly','Any shape','<path d="M8 32l6-24 18 6 16-8-2 26z"/>']];
  sheet(`<h2>Draw a space <button class="ib x" data-x>✕</button></h2><p style="margin:0 0 8px;color:var(--muted);font-size:13px">1 · what is it</p><div class="types">${STYPES.map(t=>`<button class="tp${NEWTYPE===t[0]?' on':''}" data-nt="${t[0]}"><i style="background:${t[2]}"></i>${esc(t[1])}</button>`).join('')}</div>
    <p style="margin:12px 0 8px;color:var(--muted);font-size:13px">2 · its shape, then drag on the plan</p><div class="shapes">${sh.map(s=>`<button class="li" data-sh="${s[0]}"><svg viewBox="0 0 58 40" fill="${(ST[NEWTYPE]||ST.other).c}" stroke="currentColor" stroke-width="2">${s[2]}</svg>${s[1]}</button>`).join('')}</div>`,()=>{
    document.querySelectorAll('[data-nt]').forEach(b=>b.onclick=()=>{ NEWTYPE=b.dataset.nt; shapeSheet(); });
    document.querySelectorAll('[data-sh]').forEach(b=>b.onclick=()=>{ closeSheet(); setTool(b.dataset.sh); }); }); }
let LIBCAT='bedroom';
function libSheet(){ const host=SEL&&byId(SEL); const cat=LIB[LIBCAT];
  sheet(`<h2>Objects <small style="font-size:12px;color:var(--muted);font-weight:600">real sizes${host&&host.kind==='space'?' · goes into '+esc(spaceLabel(host)):''}</small><button class="ib x" data-x>✕</button></h2><div class="cats">${Object.entries(LIB).map(([k,g])=>`<button class="chip${k===LIBCAT?' on':''}" data-lc="${k}">${g.n}</button>`).join('')}</div>
    <div class="lib">${cat.items.map(a=>{ const T=OBJ[a[0]], sc=Math.min(48/T.w,32/T.d), w=T.w*sc, d=T.d*sc; return `<button class="li" data-ob="${a[0]}"><svg viewBox="0 0 56 40"><g transform="translate(28,20)">${T.shape==='round'?`<ellipse rx="${w/2}" ry="${d/2}" fill="${T.c}" stroke="rgba(0,0,0,.5)"/>`:`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="1.5" fill="${T.c}" stroke="rgba(0,0,0,.5)"/>`}</g></svg>${esc(T.n)}<small>${T.w} × ${T.d} m</small></button>`; }).join('')}</div>`,()=>{
    document.querySelectorAll('[data-lc]').forEach(b=>b.onclick=()=>{ LIBCAT=b.dataset.lc; libSheet(); });
    document.querySelectorAll('[data-ob]').forEach(b=>b.onclick=()=>{ closeSheet(); placeObj(b.dataset.ob); }); }); }
/* what is selected: type, name, size, turn, room details, and the actions */
function openInspector(soft){ const it=SEL&&byId(SEL); if(!it){ closeSheet(); return; } if(soft&&!$('sheet').classList.contains('on')) return;
  const num=(k,lab,v,st)=>`<label class="f">${lab}<input data-k="${k}" type="number" inputmode="decimal" step="${st||.1}" value="${v}"></label>`;
  const txt=(k,lab,v,ph)=>`<label class="f">${lab}<input data-k="${k}" value="${esc(v||'')}" placeholder="${esc(ph||'')}" maxlength="40"></label>`;
  let h='';
  if(it.kind==='space'){ const t=ST[it.type]||ST.other, A=area(worldPts(it));
    h=`<h2><i style="width:14px;height:14px;border-radius:4px;background:${t.c};border:1px solid var(--line2)"></i>${esc(spaceLabel(it))}<small style="font-size:12px;color:var(--muted);font-weight:600">${A.toFixed(1)} m²</small><button class="ib x" data-x>✕</button></h2>
      <label class="f">What is it<select data-k="type">${STYPES.map(s=>`<option value="${s[0]}"${s[0]===it.type?' selected':''}>${esc(s[1])}</option>`).join('')}</select></label>
      ${t.guest?`<div class="row">${txt('no','Room no.',it.no,'101')}<label class="f">Category<select data-k="cat">${(CATS[it.type]||CATS.room).map(c=>`<option${c===it.cat?' selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
      <div class="row">${txt('beds','Beds',it.beds,'1 king')}${num('guests','Max guests',it.guests||2,1)}${num('rate','Rate / night ₹',it.rate||0,50)}</div>`:`<div class="row">${txt('name','Name',it.name,t.n)}</div>`}
      <div class="row">${num('w','Width m',r2(it.w))}${num('h','Depth m',r2(it.h))}${num('r','Turn °',Math.round(it.r||0),15)}</div>`; }
  else if(it.kind==='obj'){ const T=OBJ[it.t]||{n:'Object'};
    h=`<h2>${esc(it.name||T.n)}<small style="font-size:12px;color:var(--muted);font-weight:600">${esc((LIB[T.cat]||{}).n||'')}</small><button class="ib x" data-x>✕</button></h2>
      <div class="row">${txt('name','Name',it.name,T.n)}</div><div class="row">${num('w','Width m',r2(it.w))}${num('h','Depth m',r2(it.h))}${num('r','Turn °',Math.round(it.r||0),15)}</div>`; }
  else { const q=openingPos(it);
    h=`<h2>${it.kind==='door'?'🚪 Door':'🪟 Window'}<small style="font-size:12px;color:var(--muted);font-weight:600">on ${esc(q?spaceLabel(q.space):'?')} · drag along the wall</small><button class="ib x" data-x>✕</button></h2>
      <div class="row">${num('w','Width m',r2(it.w))}</div>${it.kind==='door'?`<div class="btns"><button class="btn" data-a="flip">⇆ Hinge side</button><button class="btn" data-a="swing">⇅ Opens in / out</button></div>`:''}`; }
  h+=`<div class="btns">${it.kind==='door'||it.kind==='window'?'':'<button class="btn" data-a="rot">⟳ Turn 90°</button><button class="btn" data-a="dup">⧉ Copy</button>'}${it.kind==='space'?'<button class="btn" data-a="obj">＋ Object inside</button><button class="btn" data-a="door">🚪 Add door</button>':''}<button class="btn bad" data-a="del">🗑 Remove</button></div>`;
  const ws=WARN.list.filter(w=>w.id===it.id); if(ws.length) h+=`<div class="wl" style="margin-top:10px">${ws.map(w=>`<div class="wi"><b>⚠ ${esc(w.t)}</b><small>${esc(w.fix||'')}</small></div>`).join('')}</div>`;
  sheet(h,()=>{
    document.querySelectorAll('#sheetBody [data-k]').forEach(inp=>{ const k=inp.dataset.k, apply=()=>{ const v=inp.value; commit();
        if(k==='w'||k==='h'){ const n=Math.max(.1,Math.min(200,+v||0)); const c=ctr(it); it[k]=r2(n); if(it.kind!=='door'&&it.kind!=='window'){ if(it.shape==='circle'){ it.w=it.h=r2(n); } it.x=r2(c[0]-it.w/2); it.y=r2(c[1]-it.h/2); } }
        else if(k==='r') it.r=((Math.round(+v||0)%360)+360)%360;
        else if(k==='guests'||k==='rate') it[k]=Math.max(0,Math.round(+v||0));
        else if(k==='type'){ it.type=v; if(ST[v].guest&&!it.no) autoName(it); if(ST[v].guest&&!(CATS[v]||[]).includes(it.cat)) it.cat=(CATS[v]||CATS.room)[0]; changed(); openInspector(); return; }
        else it[k]=String(v).trim().slice(0,40);
        changed(); };
      inp.onchange=apply; if(inp.tagName==='INPUT') inp.onkeydown=e=>{ if(e.key==='Enter'){ inp.blur(); } }; });
    document.querySelectorAll('#sheetBody [data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
      if(a==='del') del(); else if(a==='dup') dup(); else if(a==='rot'){ commit(); it.r=((it.r||0)+90)%360; changed(); openInspector(); }
      else if(a==='obj') libSheet(); else if(a==='door'){ closeSheet(); setTool('door'); }
      else if(a==='flip'){ commit(); it.flip=!it.flip; changed(); } else if(a==='swing'){ commit(); it.side=-(it.side||1); changed(); } }); }); }
function floorSheet(i){ const f=i>=0?P.floors[i]:null;
  sheet(`<h2>${f?'Floor · '+esc(f.name):'Add a floor'}<button class="ib x" data-x>✕</button></h2><label class="f">Name<input id="flN" value="${esc(f?f.name:(['Ground','First','Second','Third','Fourth','Terrace'][P.floors.length]||'Floor '+P.floors.length))}" maxlength="24"></label>
    <div class="btns"><button class="btn pri" id="flGo">${f?'Rename':'＋ Empty floor'}</button>${f?'':`<button class="btn" id="flCopy">⧉ Copy “${esc(floor().name)}”</button>`}${f&&P.floors.length>1?'<button class="btn bad" id="flDel">🗑 Remove floor</button>':''}</div>${f?'':'<p style="font-size:12.5px;color:var(--muted)">Copy keeps rooms, doors and objects; room numbers move up by 100 (101 → 201).</p>'}`,()=>{
    $('flGo').onclick=()=>{ const n=$('flN').value.trim()||'Floor'; commit(); if(f) f.name=n; else { P.floors.push({id:uid(),name:n,items:[]}); FL=P.floors.length-1; } closeSheet(); changed(); floors(); fit(); };
    const c=$('flCopy'); if(c) c.onclick=()=>{ commit(); const src=floor(), map={}, step=100*(P.floors.length-FL);
      const nf={id:uid(),name:$('flN').value.trim()||'Floor',items:src.items.map(o=>{ const k=JSON.parse(JSON.stringify(o)); map[o.id]=k.id=uid(); if(k.no&&/^\d+$/.test(k.no)) k.no=String(+k.no+step); return k; })};
      nf.items.forEach(o=>{ if(o.sp) o.sp=map[o.sp]||o.sp; }); P.floors.push(nf); FL=P.floors.length-1; closeSheet(); changed(); floors(); fit(); toast('Floor copied · '+nf.items.filter(o=>o.no).length+' rooms renumbered'); };
    const d=$('flDel'); if(d) d.onclick=()=>{ if(d.dataset.sure!=='1'){ d.dataset.sure='1'; d.textContent='Tap again to remove '+f.items.length+' things'; return; } commit(); P.floors.splice(i,1); FL=0; closeSheet(); changed(); floors(); fit(); }; }); }

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
  sheet(`<h2>${L.length?'⚠ '+L.length+' to check':'✓ All good'} <small style="font-size:12px;color:var(--muted);font-weight:600">${esc(floor().name)}</small><button class="ib x" data-x>✕</button></h2>${L.length?`<div class="wl">${L.map((w,i)=>`<button class="wi" data-w="${i}"><b>${esc(w.t)}</b><small>${esc(w.fix||'')}</small></button>`).join('')}</div>`:'<p style="color:var(--muted)">Doors, bathrooms, beds, kitchen basics, overlaps and walls all look right on this floor.</p>'}`,()=>{
    document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ const w=L[+b.dataset.w], it=byId(w.id); if(!it) return; SEL=it.id; const p=it.kind==='door'||it.kind==='window'?(openingPos(it)||{}).p:ctr(it); if(p){ const r=svg.getBoundingClientRect(); VIEW.s=Math.max(VIEW.s,46); VIEW.ox=r.width/2-p[0]*VIEW.s; VIEW.oy=r.height*.35-p[1]*VIEW.s; } draw(); openInspector(); }); }); }
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
    ${R.length?`<table class="t"><tr><th>No.</th><th>Floor</th><th>Category</th><th>Beds</th><th>Guests</th><th>₹ / night</th><th>m²</th></tr>${R.map((r,i)=>`<tr data-ri="${i}" style="cursor:pointer"><td><b>${esc(r.s.no||'—')}</b></td><td>${esc(r.f.name)}</td><td>${esc(r.s.cat||'')}</td><td>${esc(r.s.beds||'')}</td><td>${r.s.guests||''}</td><td>${(+r.s.rate||0).toLocaleString('en-IN')}</td><td>${r.A.toFixed(1)}</td></tr>`).join('')}</table>`:'<p>No guest rooms yet. Space → Guest room, then draw.</p>'}`,()=>{
    document.querySelectorAll('[data-ri]').forEach(tr=>tr.onclick=()=>{ const r=R[+tr.dataset.ri]; FL=r.fi; SEL=r.s.id; floors(); const c=ctr(r.s), sr=svg.getBoundingClientRect(); VIEW.s=Math.max(VIEW.s,40); VIEW.ox=sr.width/2-c[0]*VIEW.s; VIEW.oy=sr.height*.35-c[1]*VIEW.s; changed(true); openInspector(); }); }); }
function helpSheet(){ sheet(`<h2>❓ How to use<button class="ib x" data-x>✕</button></h2><ul style="padding-left:18px;margin:0;line-height:1.7;font-size:14px">
  <li><b>Space</b> → pick what it is (guest room, kitchen, store…) and a shape, then drag on the plan. Any shape = tap the corners.</li>
  <li><b>Door / Window</b> → tap on a wall. Drag it along the wall; the panel flips the hinge or the swing.</li>
  <li><b>Objects</b> → real sizes (beds, toilets, tables, burners, racks…). They go into the selected space.</li>
  <li>Tap anything to select: drag to move (snaps to 10 cm and to walls), corners resize, ⟳ turns (15° steps, hold Shift for free).</li>
  <li>Moving a room moves everything inside it. Copy a room = room + furniture + doors.</li>
  <li>Two fingers / mouse wheel to zoom, drag the empty paper to move around. ⤢ fits the floor.</li>
  <li><b>⚠ to check</b> lists what is missing or wrong (no door, no bathroom, kitchen without hood, blocked door, things on top of each other).</li>
  <li><b>3D</b> shows the floor in 3D: drag to turn, pinch to zoom, “low walls” to look inside.</li>
  <li>Keys: Delete · Ctrl+Z / Y · Ctrl+D copy · R turn · arrows nudge (Shift = 1 m) · Esc.</li></ul>`); }
/* ---------------- the demo hotel (2 room floors x 10 rooms, restaurant, kitchen, store, housekeeping) ---------------- */
function demoHotel(){ const D=blank('Demo hotel'); D.floors=[];
  const sp=(type,x,y,w,h,ex)=>Object.assign({id:uid(),kind:'space',type,shape:'rect',x,y,w,h,r:0},ex||{});
  const ob=(t,x,y,r,ex)=>{ const T=OBJ[t]; return Object.assign({id:uid(),kind:'obj',t,shape:T.shape==='round'?'round':'box',x,y,w:T.w,h:T.d,r:r||0},ex||{}); };
  const door=(s,e,t,w,ex)=>Object.assign({id:uid(),kind:'door',sp:s.id,e,t,w:w||.9,side:1},ex||{}), win=(s,e,t,w)=>({id:uid(),kind:'window',sp:s.id,e,t,w:w||1.4});
  /* ground */
  const G=[]; const lobby=sp('lobby',0,0,12,9,{name:'Lobby'}), rest=sp('restaurant',12,0,14,11,{name:'Restaurant'}), kit=sp('kitchen',26,0,9,7,{name:'Kitchen'}), store=sp('store',26,7,4.5,4,{name:'Store'}), hk=sp('clean',30.5,7,4.5,4,{name:'Housekeeping'}),
    wcM=sp('wash',0,9,3,3,{name:'Gents'}), wcL=sp('wash',3,9,3,3,{name:'Ladies'}), stair=sp('stairs',6,9,6,3,{name:'Stairs + lift'}), cor=sp('corridor',12,11,23,2,{name:'Service corridor'});
  G.push(lobby,rest,kit,store,hk,wcM,wcL,stair,cor);
  G.push(door(lobby,0,.5,1.8),win(lobby,0,.2,2),win(lobby,0,.8,2),door(lobby,1,.5,1.8),door(rest,0,.7,1.2),win(rest,0,.3,2.4),win(rest,1,.5,2.4),door(kit,3,.22,1.1),door(rest,2,.5,1.4),door(store,2,.5,.9),door(hk,2,.5,.9),door(wcM,0,.5,.8),door(wcL,0,.5,.8),door(stair,0,.5,1.2),door(kit,2,.3,1),win(kit,0,.5,1.6));
  G.push(ob('recep',4.8,1.2),ob('lsofa',1,5.5),ob('lsofa',5,5.5),ob('ctable',3.3,6.7),ob('plant',.4,.4),ob('plant',11.1,.4),ob('wc',.6,9.3),ob('basin',2,10.9),ob('wc',3.6,9.3),ob('basin',5,10.9),ob('stairs',7.2,9,90,{w:1.2,h:3}),ob('lift',10,9.6));
  let tx=13.2; for(let c=0;c<4;c++){ for(let r=0;r<3;r++){ const x=13+c*3.1, y=1.2+r*3; G.push(ob('t4',x+.4,y+.6)); G.push(ob('dchair',x+.55,y+.1),ob('dchair',x+1.05,y+.1),ob('dchair',x+.55,y+1.45,180),ob('dchair',x+1.05,y+1.45,180)); } }
  G.push(ob('counter',22.8,9.6),ob('hand',25.4,.2),ob('cash',19.4,10.0));
  G.push(ob('range4',26.2,.15),ob('range4',27.5,.15),ob('hood',26.1,.05,0,{w:2.7,h:1}),ob('tandoor',29.2,.2),ob('mandi',30.4,.1),ob('hood',29,.05,0,{w:2.8,h:1.3}),ob('prep',26.4,3),ob('prep',28.6,3),ob('sink2',33.4,.15),ob('dish',32.6,.2),ob('fridge',34.1,2.2,90),ob('freezer',33.4,4.9),ob('pass',26.3,6.25),ob('rack',33.6,6.3));
  G.push(ob('srack',26.2,7.2),ob('srack',28.8,7.2),ob('pallet',26.4,9.4),ob('gas',29.1,10.2),ob('linen',30.8,7.2),ob('washer',33.9,7.2),ob('dryer',33.9,7.9),ob('trolley',31,10.2),ob('iron',32.6,9.2),ob('mop',34.2,10.2));
  D.floors.push({id:uid(),name:'Ground',items:G});
  /* rooms: 5 north + 5 south of a 2 m corridor. One room is planned (north, 4.2 x 5 m, bathroom by the corridor), the south ones are its mirror. */
  const roomKit=(deluxe)=>{ const O=[]; /* [type, x, y, r, extra] in the room's own metres, door side = bottom (y 5) */
    if(deluxe) O.push(['bed_k',.25,.1,0]); else O.push(['bed_s',.15,.1,0],['bed_s',1.25,.1,0]);
    O.push(['side',deluxe?2.25:2.3,.15,0],['wardrobe',3.3,.7,90],['lugg',3.4,1.85,90],['desk',1.3,3.3,90],['chair',1.05,3.35,0],['ac',1,0,0],
      ['wc',2.35,4.15,270],['basin',3.675,3.075,90],['shower',3.25,4.05,0]); return O; };
  const mirrorY=(H0,y,h)=>H0-y-h, mirR=r=>((180-(r||0))%360+360)%360;
  [1,2].forEach(fl=>{ const I=[]; const cor2=sp('corridor',0,5,21,2,{name:'Corridor'}), st2=sp('stairs',21,5,4,2,{name:'Stairs + lift'}); I.push(cor2,st2,door(st2,3,.5,1.2));
    for(let i=0;i<10;i++){ const north=i<5, k=north?i:i-5, x=k*4.2, y0=north?0:7, no=String(fl*100+i+1), deluxe=k%2===1,
        rm=sp('room',x,y0,4.2,5,{no,cat:deluxe?'Deluxe':'Standard',beds:deluxe?'1 king':'2 single',guests:2,rate:deluxe?3200:2400}),
        bt=sp('bath',x+2.2,north?2.8:7,2,2.2,{name:'Bath '+no}); I.push(rm,bt);
      /* door to the corridor, window on the outside wall, bathroom door from the room */
      I.push(door(rm,north?2:0,north?.75:.25,.9),win(rm,north?0:2,.5,1.6),door(bt,north?0:2,north?.3:.7,.75,{side:north?-1:1}));
      roomKit(deluxe).forEach(([t,ox,oy,r])=>{ const T=OBJ[t], rot90=(r||0)%180!==0, w=T.w, d=T.d; /* placed by the unrotated box */
        const yy=north?oy:mirrorY(5,oy,d); I.push(ob(t,r2(x+ox),r2(y0+yy),north?r:mirR(r))); }); }
    D.floors.push({id:uid(),name:fl===1?'First':'Second',items:I}); });
  return D; }
/* ---------------- saving: this phone at once, the cloud when signed in as office ---------------- */
let ST1=null, ST2=null;
function changed(silent){ DIRTY=true; checks(); draw(); dock(); floors(); $('undo').disabled=!HIST.u.length; $('redo').disabled=!HIST.r.length; $('pname').textContent=P.name;
  clearTimeout(ST1); ST1=setTimeout(saveLocal,350); clearTimeout(ST2); ST2=setTimeout(saveCloud,2500); if(MODE==='3d') show3d(); }
function saveLocal(){ P.at=Date.now(); try{ localStorage.setItem(LS,JSON.stringify(P)); savedNote('saved on this phone'+(cloudOk()?' · cloud…':'')); }catch(e){ savedNote('⚠ phone storage full — save the plan file (⋯)'); } }
function cloudOk(){ return !!(CTX&&CTX.fs&&CTX.db&&/office|cashier/.test(CTX.role||'')); }
async function saveCloud(){ if(!cloudOk()||CLOUD.busy) return; const s=JSON.stringify(P); if(s.length>900000){ savedNote('⚠ plan too big for the cloud — save the plan file'); return; }
  CLOUD.busy=true; try{ await CTX.fs.setDoc(CTX.fs.doc(CTX.db,'plans',P.id||'demo'),{v:1,name:P.name,at:P.at||Date.now(),by:CTX.name||'',json:s}); CLOUD.at=P.at; DIRTY=false; savedNote('saved · cloud ✓ '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})); }
  catch(e){ savedNote('saved on this phone · cloud failed, will retry'); setTimeout(saveCloud,15000); } CLOUD.busy=false; }
function savedNote(t){ const e=$('saved'); if(e) e.textContent=t; }
function load(obj,why){ if(!obj||!obj.floors||!obj.floors.length) return false; P=obj; P.floors.forEach(f=>{ f.items=(f.items||[]).filter(i=>i&&i.kind); });
  P.floors.forEach(f=>{ const ids=new Set(f.items.map(i=>i.id)); f.items=f.items.filter(i=>!(i.kind==='door'||i.kind==='window')||ids.has(i.sp)); });   /* a door whose wall is gone */
  FL=Math.min(FL,P.floors.length-1); SEL=null; if(why) toast(why); return true; }
/* PNG of what is on screen, colours resolved so it looks the same outside the app */
function savePng(){ const r=svg.getBoundingClientRect(), cs=getComputedStyle(document.documentElement); let s=svg.outerHTML.replace(/var\((--[a-z0-9]+)\)/gi,(m,v)=>cs.getPropertyValue(v).trim()||'#888');
  const css=[...document.styleSheets].flatMap(sh=>{ try{ return [...sh.cssRules].map(x=>x.cssText).filter(t=>/^\.(sp|ob|op|lbl|lbl2|selb|hd|dim|ghost)\b/.test(t)); }catch(e){ return []; } }).join('').replace(/var\((--[a-z0-9]+)\)/gi,(m,v)=>cs.getPropertyValue(v).trim()||'#888');
  s=s.replace('<svg ',`<svg width="${r.width}" height="${r.height}" `).replace(/^(<svg[^>]*>)/,`$1<style>${css}</style><rect width="100%" height="100%" fill="${cs.getPropertyValue('--paper').trim()||'#fff'}"/>`);
  const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=r.width*2; c.height=r.height*2; const g=c.getContext('2d'); g.scale(2,2); g.drawImage(img,0,0); g.fillStyle='#555'; g.font='bold 13px sans-serif'; g.fillText(P.name+' · '+floor().name,12,r.height-12);
    c.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=(P.name+'-'+floor().name).replace(/\W+/g,'-')+'.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }); };
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s); }
function saveJson(){ const b=new Blob([JSON.stringify(P,null,1)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=P.name.replace(/\W+/g,'-')+'.plan.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
$('file').onchange=()=>{ const f=$('file').files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ try{ const o=JSON.parse(rd.result); commit(); if(load(o,'Plan opened · '+(o.name||''))){ changed(); fit(); } else toast('That file is not a plan'); }catch(e){ toast('That file is not a plan'); } $('file').value=''; }; rd.readAsText(f); };
/* ---------------- menu + 2D / 3D ---------------- */
$('more').onclick=e=>{ e.stopPropagation(); $('menu').classList.toggle('on'); };
document.addEventListener('click',e=>{ if(!e.target.closest('#menu,#more')) $('menu').classList.remove('on'); });
$('menu').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ $('menu').classList.remove('on'); const m=b.dataset.m;
  if(m==='sum') sumSheet(); else if(m==='rooms') roomsSheet(); else if(m==='help') helpSheet(); else if(m==='png'){ if(MODE==='3d'){ toast('Switch to 2D for a picture'); return; } savePng(); } else if(m==='json') saveJson(); else if(m==='import') $('file').click();
  else if(m==='tpl'||m==='blank'){ sheet(`<h2>${m==='tpl'?'Start from the demo hotel':'Start a blank plan'}<button class="ib x" data-x>✕</button></h2><p>This replaces the plan on screen (${P.floors.reduce((n,f)=>n+f.items.length,0)} things). ↶ brings it back.</p><div class="btns"><button class="btn pri" id="tGo">Yes, start</button></div>`,()=>{ $('tGo').onclick=()=>{ commit(); P=m==='tpl'?demoHotel():blank('My hotel'); FL=0; SEL=null; closeSheet(); changed(); fit(); }; }); }
  else if(m==='name'){ sheet(`<h2>Rename<button class="ib x" data-x>✕</button></h2><label class="f">Plan name<input id="pN" value="${esc(P.name)}" maxlength="40"></label><div class="btns"><button class="btn pri" id="pGo">Save</button></div>`,()=>{ $('pGo').onclick=()=>{ commit(); P.name=$('pN').value.trim()||'My hotel'; closeSheet(); changed(); }; }); } });
$('undo').onclick=undo; $('redo').onclick=redo;
$('zin').onclick=()=>{ const r=svg.getBoundingClientRect(); setView(VIEW.s*1.3,r.width/2,r.height/2); }; $('zout').onclick=()=>{ const r=svg.getBoundingClientRect(); setView(VIEW.s/1.3,r.width/2,r.height/2); }; $('zfit').onclick=()=>{ if(MODE==='3d') show3d(true); else fit(); };
let V3=null;
async function show3d(reset){ const el=$('v3'); el.classList.add('on'); try{ V3=V3||await import('./planner3d.js'); V3.show(el,P,FL,{reset:!!reset,ST,OBJ,worldPts,openingPos,edges,area,centroid,spaceLabel}); }catch(e){ el.innerHTML='<p style="padding:20px">3D could not start on this device: '+esc(e.message||e)+'</p>'; } }
function setMode(m){ MODE=m; $('m2d').classList.toggle('on',m==='2d'); $('m3d').classList.toggle('on',m==='3d'); $('svg').style.display=m==='2d'?'':'none'; $('dock').style.visibility=m==='2d'?'':'hidden';
  if(m==='3d'){ SEL=null; closeSheet(); hint(''); show3d(true); } else { $('v3').classList.remove('on'); if(V3&&V3.pause) V3.pause(); draw(); } }
$('m2d').onclick=()=>setMode('2d'); $('m3d').onclick=()=>setMode('3d');
function topH(){ const t=document.querySelector('.top'); if(t) document.documentElement.style.setProperty('--toph',t.offsetHeight+'px'); }
window.addEventListener('resize',()=>{ topH(); if(MODE==='2d') draw(); }); topH();
/* tests + console */
window.PLANNER={get P(){ return P; },get SEL(){ return SEL; },set SEL(v){ SEL=v; },get VIEW(){ return VIEW; },get WARN(){ return WARN; },get TOOL(){ return TOOL; },get FL(){ return FL; },set FL(v){ FL=v; floors(); fit(); },
  load:o=>{ if(load(o)){ changed(); fit(); } },demoHotel,checks,worldPts,openingPos,byId,undo,redo,fit,setMode,placeObj,setTool,changed,W2S,roomsAll,get HIST(){ return HIST; }};
/* ---------------- start ---------------- */
(async function boot(){
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){}
  if(!load(saved)) P=demoHotel();
  checks(); floors(); dock(); fit(); $('undo').disabled=true; $('redo').disabled=true; $('pname').textContent=P.name;
  savedNote(saved?'saved on this phone':'demo hotel · nothing saved yet');
  if(!window.HayatAuth) return;
  try{ CTX=await HayatAuth.start({cache:true}); }catch(e){ CTX=null; }
  if(!cloudOk()){ savedNote((saved?'saved on this phone':'demo hotel')+' · sign in as office (admin app) to keep it in the cloud'); return; }
  CTX.fs.onSnapshot(CTX.fs.doc(CTX.db,'plans',P.id||'demo'),d=>{ if(!d.exists()){ saveCloud(); return; } const x=d.data(); if(!x||!x.json||(x.at||0)<=(P.at||0)) return;
    if(DIRTY&&(P.at||0)>CLOUD.at){ toast('This plan was changed on another device · yours is kept'); return; }
    try{ if(load(JSON.parse(x.json),'Newer plan from '+(x.by||'another device'))){ CLOUD.at=x.at; checks(); draw(); dock(); floors(); try{ localStorage.setItem(LS,x.json); }catch(e){} } }catch(e){} },()=>{});
})();
})();
