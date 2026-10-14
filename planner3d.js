/* Hayat · Space planner · 3D view (three.js r160, bundled in assets/three) · v279 (Majid, 14 Oct 2026)
   Loaded only when 3D / Split / Walk is opened (and for the library pictures).
   - Realistic: textured floors (finish per space, or by type), plaster walls with a dark cut cap + skirting,
     real door leaves (open, on their hinge side) and window frames with glass + curtains, detailed furniture
     (planner-models.js), sun by the time of day with soft shadows, contact shadows, sky, night lights + lamps.
   - Walls: Cutaway (walls nearest the camera drop low, like a doll's house) · Full · Low.
   - Edit in 3D: tap an object → Move / Turn / Size handles (snapped 10 cm / 15°), written back to the plan.
     Tap a floor = select that space. Double-tap = fly to it.
   - Walk: eyes at 1.6 m, W A S D / arrows / joystick, drag to look, Shift = run, walls + furniture block you,
     mini map (tap it to jump). Esc leaves.
   Plan x → 3D x, plan y → 3D z, up = 3D y. */
import * as THREE from './assets/three/three.module.min.js';
import { OrbitControls } from './assets/three/OrbitControls.js';
import { TransformControls } from './assets/three/TransformControls.js';
import { RoomEnvironment } from './assets/three/RoomEnvironment.js';
import * as MD from './planner-models.js';
import { mergeGeometries } from './assets/three/BufferGeometryUtils.js';

const H_WALL=2.8, H_LOW=1.1, H_CUT=.34, T=.12, DOOR_H=2.1, SILL=.9, WIN_TOP=2.1, FLOOR_GAP=3.2, EYE=1.6, RAD=.24;
let R=null, LAST=null;
const OK='hayat-plan-3d';
export const OPT=Object.assign({walls:'cut',all:false,time:10.5,tint:false,hq:true,labels:true},(()=>{ try{ return JSON.parse(localStorage.getItem(OK)||'{}'); }catch(e){ return {}; } })());
function saveOpt(){ try{ localStorage.setItem(OK,JSON.stringify({walls:OPT.walls,time:OPT.time,tint:OPT.tint,hq:OPT.hq,labels:OPT.labels})); }catch(e){} }
const touchy=()=>('ontouchstart' in window)||navigator.maxTouchPoints>0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;

/* ---------------- start ---------------- */
function init(el){
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(OPT.hq?2:1,window.devicePixelRatio||1)); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=!!OPT.hq; renderer.shadowMap.type=THREE.PCFSoftShadowMap; MD.setAniso(Math.min(8,renderer.capabilities.getMaxAnisotropy()));
  el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new RoomEnvironment(renderer),.04).texture; pm.dispose();
  scene.fog=new THREE.Fog(0xdfe9f1,90,320);
  const camera=new THREE.PerspectiveCamera(45,1,.05,700);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=Math.PI*.49; controls.screenSpacePanning=true; controls.minDistance=1; controls.maxDistance=240;
  const hemi=new THREE.HemisphereLight(0xdfeaff,0x7d7060,.6); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,2.4); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-.0004; sun.shadow.normalBias=.035; scene.add(sun); scene.add(sun.target);
  const tc=new TransformControls(camera,renderer.domElement); tc.setTranslationSnap(.1); tc.setRotationSnap(THREE.MathUtils.degToRad(15)); tc.setSize(.85); tc.setSpace('world'); scene.add(tc);
  R={renderer,scene,camera,controls,tc,hemi,sun,el,raf:0,need:60,group:null,center:new THREE.Vector3(),size:20,walls:[],ops:[],objs:new Map(),spaces:[],solids:[],lights:[],selId:null,selVis:null,gmode:'translate',walk:null,anim:null,clock:new THREE.Clock(),snapCut:true,base:0,night:0};
  controls.addEventListener('change',()=>{ R.need=Math.max(R.need,3); });
  tc.addEventListener('change',()=>{ R.need=Math.max(R.need,3); });
  tc.addEventListener('dragging-changed',e=>{ controls.enabled=!e.value&&!R.walk; if(e.value) editStart(); else editEnd(); });
  tc.addEventListener('objectChange',editLive);
  ui(el); pickWire(renderer.domElement);
  new ResizeObserver(()=>size()).observe(el);
  document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp);
}
function size(){ if(!R) return; const w=R.el.clientWidth||300, h=R.el.clientHeight||300; R.renderer.setSize(w,h,false); R.camera.aspect=w/h; R.camera.updateProjectionMatrix(); R.need=3; }
export function pause(){ if(R&&R.raf){ cancelAnimationFrame(R.raf); R.raf=0; } }
export function show(el,P,FL,H){ LAST={P,FL,H}; if(!R) init(el); else if(R.el!==el){ el.appendChild(R.renderer.domElement); el.appendChild(R.uiEl); R.el=el; }
  size(); build(!!H.reset); if(!R.raf){ R.clock.getDelta(); loop(); } }

/* ---------------- overlay ---------------- */
function ui(el){ const d=document.createElement('div'); d.className='p3ui'; R.uiEl=d;
  d.innerHTML=`<div class="p3bar">
    <div class="p3seg" role="group" aria-label="walls"><button data-w="cut" title="walls nearest you drop low">Cutaway</button><button data-w="full">Full walls</button><button data-w="low">Low</button></div>
    <button class="p3c p3opt" data-v="all" title="stack every floor">All floors</button><button class="p3c p3opt" data-v="top">Top view</button>
    <button class="p3c p3opt" data-v="tint" title="floors coloured by what the space is">Colours</button><button class="p3c p3opt" data-v="labels">Labels</button><button class="p3c p3opt" data-v="hq" title="soft shadows, sharper picture">HQ</button>
    <label class="p3sun" title="sun / time of day">☀<input type="range" min="6" max="23" step=".25" data-v="time" aria-label="time of day"><b></b></label>
    <button class="p3c p3walkbtn" data-v="walk" title="walk inside at eye height">🚶 Walk</button><button class="p3c p3more" data-v="more" aria-label="more 3D options">⚙</button></div>
   <div class="p3edit" hidden><span class="p3en"></span><button class="p3c" data-g="translate" title="move (G)">✥ Move</button><button class="p3c" data-g="rotate" title="turn">⟳ Turn</button><button class="p3c" data-g="scale" title="size">⤡ Size</button><button class="p3c" data-g="done">✓ Done</button></div>
   <div class="p3tip" hidden></div>
   <div class="p3hint">${touchy()?'drag = turn · pinch = zoom · two fingers = move · tap = select':'drag = turn · right-drag = move · wheel = zoom · click = select · double-click = fly to'}</div>
   <div class="p3walk" hidden><canvas class="p3map" width="180" height="180" title="tap to jump"></canvas><div class="p3x">+</div>
     <div class="p3wbar"><b>🚶 Walking</b><span>${touchy()?'left stick = walk · drag = look':'W A S D / arrows · drag = look · Shift = run'}</span><button class="p3c" data-v="unwalk">✕ Leave (Esc)</button></div>
     <div class="p3joy" ${touchy()?'':'hidden'}><i></i></div></div>`;
  el.appendChild(d); syncUi();
  d.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{ OPT.walls=b.dataset.w; saveOpt(); syncUi(); R.snapCut=false; R.need=30; });
  d.querySelectorAll('[data-v]').forEach(b=>{ const v=b.dataset.v; if(v==='time'){ b.oninput=()=>{ OPT.time=+b.value; syncUi(); applyTime(); }; b.onchange=()=>{ saveOpt(); const n=R.night>0; if(n!==R.lit) build(false); }; return; }
    b.onclick=()=>{ if(v==='more'){ d.querySelector('.p3bar').classList.toggle('open'); return; } if(v==='top'){ topView(); return; } if(v==='walk'){ LAST.H.onWalk&&LAST.H.onWalk(true); return; } if(v==='unwalk'){ LAST.H.onWalk&&LAST.H.onWalk(false); return; }
      OPT[v]=!OPT[v]; saveOpt(); if(v==='hq'){ R.renderer.setPixelRatio(Math.min(OPT.hq?2:1,window.devicePixelRatio||1)); R.renderer.shadowMap.enabled=OPT.hq; R.scene.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); } }); size(); }
      syncUi(); build(v==='all'); }; });
  d.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ const g=b.dataset.g; if(g==='done'){ LAST.H.onSelect&&LAST.H.onSelect(null); setSel(null); return; } R.gmode=g; applyGizmo(); syncUi(); });
  const map=d.querySelector('.p3map'); map.addEventListener('pointerdown',e=>{ e.stopPropagation(); if(!R.walk||!R.mapT) return; const r=map.getBoundingClientRect(), M=R.mapT; const x=(e.clientX-r.left-M.ox)/M.s, z=(e.clientY-r.top-M.oy)/M.s; if(!blocked(x,z)){ R.walk.x=x; R.walk.z=z; } });
  joyWire(d.querySelector('.p3joy'));
}
function syncUi(){ if(!R||!R.uiEl) return; const d=R.uiEl; d.querySelectorAll('[data-w]').forEach(b=>b.classList.toggle('on',b.dataset.w===OPT.walls));
  ['all','tint','labels','hq'].forEach(k=>{ const b=d.querySelector(`[data-v="${k}"]`); if(b) b.classList.toggle('on',!!OPT[k]); });
  const t=d.querySelector('[data-v="time"]'); if(t){ t.value=OPT.time; const h=Math.floor(OPT.time), m=Math.round((OPT.time-h)*60); d.querySelector('.p3sun b').textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }
  d.querySelectorAll('[data-g]').forEach(b=>b.classList.toggle('on',b.dataset.g===R.gmode));
  const ed=d.querySelector('.p3edit'), o=R.selId&&R.objs.get(R.selId); ed.hidden=!o||!!R.walk; d.classList.toggle('editing',!ed.hidden); if(o) d.querySelector('.p3en').textContent=o.userData.name||'';
  d.querySelector('.p3bar').hidden=!!R.walk; d.querySelector('.p3hint').hidden=!!R.walk; d.querySelector('.p3walk').hidden=!R.walk; }

/* ---------------- building the scene ---------------- */
const disp=[];
function clearGroup(){ if(R.group){ R.scene.remove(R.group); } disp.splice(0).forEach(x=>x.dispose&&x.dispose()); R.lights.forEach(l=>R.scene.remove(l)); R.lights=[]; }
function wallMats(c){ return MD.mWall(c||'#f3eee6'); }
function build(reset){ const {P,FL,H}=LAST; const keepSel=R.selId; R.tc.detach(); clearGroup();
  const G=new THREE.Group(); R.group=G; R.scene.add(G); R.walls=[]; R.ops=[]; R.objs=new Map(); R.spaces=[]; R.solids=[];
  const walking=!!R.walk, all=OPT.all&&!walking, idx=all?P.floors.map((f,i)=>i):[FL]; let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity, wi=0;
  R.night=nightOf(OPT.time); R.lit=R.night>0; const lightSpots=[];
  idx.forEach((fi,k)=>{ const f=P.floors[fi], base=all?k*FLOOR_GAP:0, cur=fi===FL; if(cur) R.base=base;
    const L=f.items.filter(i=>!H.hidden(i,f));
    const SP=L.filter(i=>i.kind==='space').map(s=>{ const P0=H.worldPts(s); return {s,P0,A:H.area(P0)}; }).sort((a,b)=>b.A-a.A);
    SP.forEach(({s,P0,A},n)=>{ P0.forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
      const fin=s.fl&&s.fl!=='auto'?s.fl:(MD.AUTOFLOOR[s.type]||'concrete'), tint=OPT.tint?(H.ST[s.type]||H.ST.other).c:null;
      const eg=new THREE.ExtrudeGeometry(new THREE.Shape(P0.map(p=>new THREE.Vector2(p[0],-p[1]))),{depth:.12,bevelEnabled:false,curveSegments:2}); eg.rotateX(-Math.PI/2); disp.push(eg);
      const m=new THREE.Mesh(eg,[MD.floorMat(fin,tint),MD.mPaint('#a39d92')]); m.position.y=base-.12+.003+n*.0016; m.receiveShadow=true; m.userData={id:s.id,kind:'space',floor:fi}; G.add(m);
      R.spaces.push({s,P0,base,A,cur});
      if(walking&&cur&&!/garden|parking/.test(s.type)){ const cg=new THREE.ShapeGeometry(new THREE.Shape(P0.map(p=>new THREE.Vector2(p[0],p[1])))); cg.rotateX(Math.PI/2); disp.push(cg);   /* ceiling, facing down */
        const ce=new THREE.Mesh(cg,MD.mPaint('#fbfaf6')); ce.position.y=base+(s.wh||H_WALL)-.002; ce.userData.ceil=true; G.add(ce);
        const c=H.centroid(P0), dl=new THREE.Mesh(MD.gCyl(.16,.16,.02,24),MD.mLamp('#fff3d6')); dl.position.set(c[0],base+(s.wh||H_WALL)-.012,c[1]); G.add(dl); }
      if(R.lit&&!/garden|parking/.test(s.type)) lightSpots.push({c:H.centroid(P0),A,base,cur});
      const guest=(H.ST[s.type]||{}).guest; if(OPT.labels&&!walking&&cur&&(guest||A>=6)){ const t=guest&&s.no?s.no:(s.name||(H.ST[s.type]||H.ST.other).n); if(t){ const sp=label(t,guest); const c=H.centroid(P0); sp.position.set(c[0],base+(s.wh||H_WALL)+.35,c[1]); G.add(sp); } } });
    /* openings on this floor, with their wall direction */
    const OPS=L.filter(i=>i.kind==='door'||i.kind==='window').map(o=>{ const q=H.openingPos(o); if(!q) return null; const a=q.ang*Math.PI/180; return {o,q,ux:Math.cos(a),uy:Math.sin(a)}; }).filter(Boolean);
    /* walls: every edge of every space, set INSIDE its space (shared walls never overlap), cut at doors + windows of ANY space on that line */
    const skirts=[];
    SP.forEach(({s,P0})=>{ if(/garden|parking/.test(s.type)) return; const full=s.wh||H_WALL, mats=wallMats(s.wc), n=P0.length;
      for(let i=0;i<n;i++){ const a=P0[i], b=P0[(i+1)%n], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy); if(len<.04) continue;
        const ux=dx/len, uy=dy/len; let nx=-uy, ny=ux; const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2; if(!H.inside([mx+nx*.06,my+ny*.06],P0)){ nx=-nx; ny=-ny; }
        const cuts=[]; if(H.layers.open) OPS.forEach(({o,q,ux:ox,uy:oy})=>{ if(Math.abs(ux*oy-uy*ox)>.03) return; const px=q.p[0]-a[0], py=q.p[1]-a[1], al=px*ux+py*uy, off=Math.abs(px*nx+py*ny); if(off>.22||al<-.01||al>len+.01) return;
          cuts.push({a:Math.max(0,al-o.w/2),b:Math.min(len,al+o.w/2),k:o.kind,top:o.kind==='door'?Math.min(full-.05,o.dh||DOOR_H):Math.min(full-.05,WIN_TOP),bot:o.kind==='window'?Math.min(SILL,full-.3):0}); });
        cuts.sort((p,q)=>p.a-q.a);
        const ang=-Math.atan2(uy,ux), jit=(wi++%7)*.0009;
        const seg=(u0,u1,y0,y1,kind)=>{ if(u1-u0<.01||y1-y0<.01) return; const um=(u0+u1)/2, cx=a[0]+ux*um+nx*T/2, cz=a[1]+uy*um+ny*T/2, h=y1-y0+(y1>=full-.001?jit:0);
          const me=MD.M(MD.wallGeo(u1-u0,h,T),mats); disp.push(me.geometry); me.position.set(cx,base+y0+h/2,cz); me.rotation.y=ang; me.userData={wall:true,id:s.id}; G.add(me);
          R.walls.push({m:me,mx:cx,mz:cz,nx,nz:ny,base,y0,y1:y0+h,f:1,kind});
          if(y0===0&&(kind==='main'||kind==='sill')){ if(fi===FL||!all) R.solids.push({cx,cz,hl:(u1-u0)/2,ht:T/2,c:ux,s:uy});
            const sg=new THREE.BoxGeometry(u1-u0,.08,.012); sg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(a[0]+ux*um+nx*(T+.006),base+.04,a[1]+uy*um+ny*(T+.006)),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ang),new THREE.Vector3(1,1,1))); skirts.push(sg); } };
        let u=0; cuts.forEach(c=>{ seg(u,c.a,0,full,'main'); if(c.k==='door') seg(c.a,c.b,c.top,full,'top'); else { seg(c.a,c.b,0,c.bot,'sill'); seg(c.a,c.b,c.top,full,'top'); } u=Math.max(u,c.b); }); seg(u,len,0,full,'main'); } });
    if(skirts.length){ const mg=mergeGeometries(skirts,false); skirts.forEach(g=>g.dispose()); if(mg){ disp.push(mg); const sk=new THREE.Mesh(mg,MD.mPaint('#5a4b3d')); sk.receiveShadow=true; G.add(sk); } }
    /* door leaves + window frames, once per opening, on the wall of the space that owns it */
    if(H.layers.open) OPS.forEach(({o,q,ux,uy})=>{ const own=SP.find(x=>x.s.id===o.sp); const P0=own?own.P0:H.worldPts(q.space); let nx=-uy, ny=ux; if(!H.inside([q.p[0]+nx*.06,q.p[1]+ny*.06],P0)){ nx=-nx; ny=-ny; }
      const full=(own&&own.s.wh)||H_WALL, g=MD.flatten(o.kind==='door'?doorG(o,full):winG(o,full,own&&H.ST[own.s.type]&&(H.ST[own.s.type].guest||/restaurant|lobby|office/.test(own.s.type)))); g.traverse(m=>{ if(m.isMesh) disp.push(m.geometry); });
      const off=o.kind==='door'?0:T/2; g.position.set(q.p[0]+nx*off,base,q.p[1]+ny*off); g.rotation.y=-Math.atan2(uy,ux);
      if(o.kind==='window'){ const lz=-uy*nx+ux*ny; if(lz<0) g.scale.z=-1; }   /* curtains on the inside */
      g.userData={id:o.id,kind:o.kind}; G.add(g); R.ops.push({g,mx:q.p[0]+nx*T/2,mz:q.p[1]+ny*T/2,nx,nz:ny,f:1}); });
    /* objects */
    if(H.layers.furn) L.filter(i=>i.kind==='obj').forEach(o=>{ const T0=H.OBJ[o.t]||{ht:.8,c:'#bbbbbb',n:'Object',w:o.w,d:o.h}; const lift=T0.lift||0;
      const hold=new THREE.Group(); hold.position.set(o.x+o.w/2,base+lift,o.y+o.h/2); hold.rotation.y=-(o.r||0)*Math.PI/180;
      hold.add(MD.build(o,T0)); if(lift<.3) hold.add(MD.blob(o.w,o.h,o.shape==='round'));
      hold.userData={id:o.id,kind:'obj',w:o.w,h:o.h,ht:(o.ht||T0.ht||.8),name:o.name||T0.n,floor:fi}; G.add(hold); if(fi===FL) R.objs.set(o.id,hold);
      if(fi===FL&&lift<1&&((o.ht||T0.ht||0)>.3||o.t==='stairs')){ const a=(o.r||0)*Math.PI/180; R.solids.push({cx:o.x+o.w/2,cz:o.y+o.h/2,hl:o.w/2,ht:o.h/2,c:Math.cos(a),s:Math.sin(a),obj:1}); } });
  });
  if(!isFinite(x0)){ x0=z0=0; x1=z1=10; }
  R.center.set((x0+x1)/2,0,(z0+z1)/2); R.size=Math.max(x1-x0,z1-z0,6); R.bb=[x0,z0,x1,z1];
  ground(G,x0,z0,x1,z1);
  /* night: warm light in the biggest spaces of the floor you look at (kept few so phones stay fast) */
  if(R.lit){ const max=touchy()?6:12; lightSpots.sort((a,b)=>(b.cur-a.cur)||(b.A-a.A)).slice(0,max).forEach(L=>{ const l=new THREE.PointLight(0xffd6a0,0,Math.max(6,Math.sqrt(L.A)*2.4),1.6); l.position.set(L.c[0],L.base+2.45,L.c[1]); l.userData.A=L.A; R.scene.add(l); R.lights.push(l); }); }
  applyTime(); R.snapCut=true;
  if(reset&&!walking) frame();
  if(keepSel) setSel(keepSel,true);
  syncUi(); R.need=60; }
function ground(G,x0,z0,x1,z1){ const S=Math.max(90,R.size*5), gm=MD.groundMat(S/2.2); const gg=new THREE.PlaneGeometry(S,S); gg.rotateX(-Math.PI/2); disp.push(gg);
  const g=new THREE.Mesh(gg,gm); g.position.set(R.center.x,-.125,R.center.z); g.receiveShadow=true; G.add(g);
  const pw=x1-x0+5, pd=z1-z0+5, pg=new THREE.PlaneGeometry(pw,pd); pg.rotateX(-Math.PI/2); disp.push(pg); const ap=new THREE.Mesh(pg,MD.floorMat('stone')); ap.position.set(R.center.x,-.122,R.center.z); ap.receiveShadow=true; G.add(ap); }
function label(t,guest){ const c=document.createElement('canvas'), g=c.getContext('2d'), fs=40; g.font=`800 ${fs}px Manrope,Segoe UI,system-ui,sans-serif`; const w=Math.ceil(g.measureText(t).width)+44; c.width=w; c.height=64;
  g.font=`800 ${fs}px Manrope,Segoe UI,system-ui,sans-serif`; g.fillStyle=guest?'rgba(42,120,214,.92)':'rgba(27,26,23,.82)'; const r=30; g.beginPath(); g.moveTo(r,2); g.arcTo(w-2,2,w-2,62,r); g.arcTo(w-2,62,2,62,r); g.arcTo(2,62,2,2,r); g.arcTo(2,2,w-2,2,r); g.fill();
  g.fillStyle='#fff'; g.textBaseline='middle'; g.fillText(t,22,34); const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace; disp.push(tx);
  const m=new THREE.SpriteMaterial({map:tx,depthTest:false,transparent:true,sizeAttenuation:false}); disp.push(m); const s=new THREE.Sprite(m); s.scale.set(.024*w/64,.024,1); s.center.set(.5,0); s.renderOrder=5; s.userData.label=true; return s; }
/* door: frame + leaf (two leaves when 1.4 m or wider), open about 70° towards its swing side */
function doorG(o,full){ const g=new THREE.Group(), w=o.w, H=Math.min(full-.05,o.dh||DOOR_H), fr=MD.mPaint('#f2efe8'), lf=MD.mWood(o.c||'#8a6a4f'), D=T*2+.04;
  [-1,1].forEach(i=>{ const j=MD.M(MD.gBox(.06,H+.06,D),fr); j.position.set(i*(w/2+.03),(H+.06)/2,0); g.add(j); }); const hd=MD.M(MD.gBox(w+.12,.06,D),fr); hd.position.set(0,H+.03,0); g.add(hd);
  const side=o.side||1, two=w>=1.4, leaves=two?[[-w/2,1,w/2],[w/2,-1,w/2]]:[[o.flip?w/2:-w/2,o.flip?-1:1,w]];
  leaves.forEach(([hx,dir,lw])=>{ const pv=new THREE.Group(); pv.position.set(hx,0,0); const L=MD.M(MD.gBox(lw-.02,H-.02,.04),lf); L.position.set(dir*(lw/2),H/2,0); pv.add(L);
    [-1,1].forEach(s=>{ const hdl=MD.M(MD.gBox(.12,.02,.02),MD.mChrome()); hdl.position.set(dir*(lw-.12),1.0,s*.04); pv.add(hdl); });
    pv.rotation.y=-dir*side*1.2; g.add(pv); });
  return g; }
/* window: aluminium frame, glass, sill; curtains when it is a room */
function winG(o,full,curt){ const g=new THREE.Group(), w=o.w, y0=Math.min(SILL,full-.3), y1=Math.min(full-.05,WIN_TOP), h=y1-y0, fr=MD.mPaint('#eceeef'), gl=winGlass();
  const bar=(bw,bh,x,y)=>{ const m=MD.M(MD.gBox(bw,bh,.07),fr); m.position.set(x,y,0); g.add(m); };
  bar(w,.05,0,y0+.025); bar(w,.05,0,y1-.025); bar(.05,h,-w/2+.025,y0+h/2); bar(.05,h,w/2-.025,y0+h/2); if(w>1.0) bar(.04,h,0,y0+h/2);
  const p=new THREE.Mesh(MD.gBox(w-.06,h-.06,.012),gl); p.position.set(0,y0+h/2,0); p.renderOrder=2; g.add(p);
  const s=MD.M(MD.gBox(w+.12,.04,T*2+.06),MD.mMarble('#d9d4ca')); s.position.set(0,y0-.02,0); g.add(s);
  if(curt){ const c=MD.mFab('#d9cdb8'); [-1,1].forEach(i=>{ const cu=MD.M(MD.gBox(.28,Math.min(full-.1,y1+.25),.05),c); cu.position.set(i*(w/2+.1),Math.min(full-.1,y1+.25)/2,T/2+.07); g.add(cu); }); const rod=MD.M(MD.gCyl(.012,.012,w+.6,8),MD.mChrome()); rod.rotation.z=Math.PI/2; rod.position.set(0,Math.min(full-.08,y1+.27),T/2+.07); g.add(rod); }
  return g; }
let WG=null; function winGlass(){ return WG||(WG=new THREE.MeshStandardMaterial({color:'#bcd8e8',roughness:.02,metalness:.15,transparent:true,opacity:.28,depthWrite:false,emissive:'#ffcf8a',emissiveIntensity:0})); }
function frame(){ const asp=Math.max(.35,R.camera.aspect||1), fov=R.camera.fov*Math.PI/180, need=(R.size/2)/Math.tan(fov/2)/Math.min(1,asp)*1.1, d=need/1.2;
  R.camera.position.set(R.center.x+d*.42,d*.95+(OPT.all?LAST.P.floors.length*FLOOR_GAP:0),R.center.z+d*.78); R.controls.target.set(R.center.x,R.base,R.center.z); R.controls.update(); R.need=30; }
function topView(){ if(!R) return; const c=R.center; flyTo(new THREE.Vector3(c.x,R.base+Math.max(16,R.size*1.25),c.z+.02),new THREE.Vector3(c.x,R.base,c.z)); }
function flyTo(pos,tgt){ R.anim={t:0,p0:R.camera.position.clone(),t0:R.controls.target.clone(),p1:pos,t1:tgt}; R.need=60; }
export function focus(id){ if(!R||!LAST) return; const sp=R.spaces.find(x=>x.s.id===id&&x.cur); let c,s,b=R.base;
  if(sp){ c=LAST.H.centroid(sp.P0); const bb=[Infinity,Infinity,-Infinity,-Infinity]; sp.P0.forEach(p=>{ bb[0]=Math.min(bb[0],p[0]); bb[1]=Math.min(bb[1],p[1]); bb[2]=Math.max(bb[2],p[0]); bb[3]=Math.max(bb[3],p[1]); }); s=Math.max(bb[2]-bb[0],bb[3]-bb[1],3); }
  else { const g=R.objs.get(id); if(!g) return; c=[g.position.x,g.position.z]; s=Math.max(g.userData.w,g.userData.h,1.5)*2.2; }
  const tgt=new THREE.Vector3(c[0],b+.6,c[1]); const dir=R.camera.position.clone().sub(R.controls.target); dir.y=Math.max(dir.y,.1); dir.normalize(); flyTo(tgt.clone().addScaledVector(dir,s*1.5+1.5),tgt); }

/* ---------------- light by the time of day ---------------- */
function nightOf(h){ return clamp((h-18.3)/1.2,0,1)+clamp((6.8-h)/.8,0,1); }
function applyTime(){ if(!R) return; const h=OPT.time, t=clamp((h-6)/13,0,1), el=Math.max(.02,Math.sin(t*Math.PI))*1.08, az=Math.PI*(1-t), dayK=clamp((h-6)/.7,0,1)*clamp((19.4-h)/1.1,0,1), low=1-Math.sin(t*Math.PI), night=nightOf(h);
  R.night=night; const c=R.center, D=Math.max(40,R.size*1.6), dir=new THREE.Vector3(Math.cos(az)*Math.cos(el),Math.sin(el),.42*Math.cos(el)+.25).normalize();
  R.sun.position.copy(c).addScaledVector(dir,D); R.sun.target.position.copy(c); const sh=R.sun.shadow.camera, half=R.size*.72+5; sh.left=-half; sh.right=half; sh.top=half; sh.bottom=-half; sh.near=1; sh.far=D*2.6; sh.updateProjectionMatrix();
  R.sun.color.setHSL(.09,.55*low+.05,.5+.42*(1-low)); R.sun.intensity=2.7*dayK; R.sun.castShadow=OPT.hq&&dayK>.05;
  R.hemi.intensity=.18+.5*dayK; R.hemi.color.setHSL(.58,.45,.55+.3*dayK); R.hemi.groundColor.setHSL(.08,.2,.25+.2*dayK);
  R.renderer.toneMappingExposure=.82+.22*dayK+.12*night; MD.setEnv(.22+.78*dayK); MD.setNight(night); winGlass().emissiveIntensity=.55*night;
  R.lights.forEach(l=>{ l.intensity=night*(14+Math.sqrt(l.userData.A||10)*5); });
  /* sky */
  const top=new THREE.Color(), hor=new THREE.Color(); top.setRGB(lerp(.04,lerp(.42,.29,low),dayK),lerp(.07,lerp(.62,.33,low),dayK),lerp(.15,lerp(.86,.52,low),dayK)); hor.setRGB(lerp(.16,lerp(.88,.98,low*.8),dayK),lerp(.2,lerp(.92,.74,low*.8),dayK),lerp(.33,lerp(.95,.55,low*.8),dayK));
  if(!R.skyC){ R.skyC=document.createElement('canvas'); R.skyC.width=4; R.skyC.height=256; R.sky=new THREE.CanvasTexture(R.skyC); R.sky.colorSpace=THREE.SRGBColorSpace; R.scene.background=R.sky; }
  const g=R.skyC.getContext('2d'), gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#'+top.getHexString()); gr.addColorStop(.75,'#'+hor.getHexString()); gr.addColorStop(1,'#'+hor.getHexString()); g.fillStyle=gr; g.fillRect(0,0,4,256); R.sky.needsUpdate=true;
  R.scene.fog.color.copy(hor); R.need=30; }

/* ---------------- render loop + cutaway ---------------- */
function loop(){ R.raf=requestAnimationFrame(loop); const dt=Math.min(.12,R.clock.getDelta());
  if(R.anim){ const A=R.anim; A.t=Math.min(1,A.t+dt/.6); const e=A.t<.5?2*A.t*A.t:1-Math.pow(-2*A.t+2,2)/2; R.camera.position.lerpVectors(A.p0,A.p1,e); R.controls.target.lerpVectors(A.t0,A.t1,e); if(A.t>=1) R.anim=null; R.need=3; }
  if(R.walk){ walkStep(dt); R.need=2; } else if(R.controls.update()) R.need=Math.max(R.need,2);
  if(cutStep()) R.need=Math.max(R.need,2);
  if(R.need>0){ R.need--; R.renderer.render(R.scene,R.camera); } }
function cutStep(){ if(!R.walls.length) return false; const cam=R.camera.position, tg=R.controls.target; let vx=cam.x-tg.x, vz=cam.z-tg.z; const L=Math.hypot(vx,vz)||1; vx/=L; vz/=L;
  const mode=R.walk?'full':OPT.walls, Lh=mode==='low'?H_LOW:H_CUT, snap=R.snapCut; let moving=false;
  const near=(w)=>{ const d=(w.mx-tg.x)*vx+(w.mz-tg.z)*vz; return d>-.35&&Math.abs(w.nx*vx+w.nz*vz)>.4; };
  for(const w of R.walls){ const t=mode==='full'?1:mode==='low'?0:(near(w)?0:1); if(Math.abs(w.f-t)<.002&&!snap) continue; w.f=snap?t:(Math.abs(w.f-t)<.02?t:w.f+(t-w.f)*.24); moving=true;
    if(w.kind==='top') w.m.visible=w.f>.55; else if(w.kind!=='skirt'){ const full=w.y1-w.y0, hh=w.y1<=Lh?full:Lh+(w.y1-Lh)*w.f; w.m.scale.y=hh/full; w.m.position.y=w.base+w.y0+hh/2; } }
  for(const o of R.ops){ const t=mode==='full'?1:mode==='low'?0:(near(o)?0:1); if(o.f===t&&!snap) continue; o.f=t; o.g.visible=t>.5; moving=true; }
  R.snapCut=false; return moving; }

/* ---------------- select + edit in 3D ---------------- */
function pickWire(cv){ let d0=null;
  cv.addEventListener('pointerdown',e=>{ d0={x:e.clientX,y:e.clientY,t:Date.now()}; if(R.walk) lookStart(e); });
  cv.addEventListener('pointermove',e=>{ if(R.walk) lookMove(e); });
  cv.addEventListener('pointerup',e=>{ if(R.walk){ lookEnd(e); return; } if(!d0) return; const moved=Math.hypot(e.clientX-d0.x,e.clientY-d0.y), quick=Date.now()-d0.t<700; d0=null;
    if(moved>6||!quick||R.tc.dragging||R.tc.axis) return; const hit=pick(e.clientX,e.clientY); setSel(hit,false); LAST.H.onSelect&&LAST.H.onSelect(hit); });
  cv.addEventListener('dblclick',e=>{ if(R.walk) return; const hit=pick(e.clientX,e.clientY); if(hit) focus(hit); });
  cv.addEventListener('contextmenu',e=>e.preventDefault()); }
function pick(cx,cy){ const r=R.renderer.domElement.getBoundingClientRect(), rc=new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),R.camera);
  const hits=rc.intersectObjects(R.group.children,true); for(const h of hits){ let o=h.object; if(!o.visible||o.userData.blob||o.userData.label) continue; if(o.userData.wall) continue;
    while(o&&o!==R.group){ if(o.userData&&o.userData.id){ if(o.userData.floor!=null&&o.userData.floor!==LAST.FL) break; return o.userData.id; } o=o.parent; } } return null; }
export function setSel(id,quiet){ if(!R) return; R.selId=id||null; if(R.selVis){ R.selVis.parent&&R.selVis.parent.remove(R.selVis); R.selVis=null; } R.tc.detach();
  const g=id&&!R.walk&&R.objs.get(id);
  if(R.walk){ syncUi(); return; }
  if(g){ const u=g.userData, hh=u.ht*(1)+.02, grp=new THREE.Group(); const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(u.w+.05,hh+.02,u.h+.05)),new THREE.LineBasicMaterial({color:0x2a78d6,transparent:true,opacity:.95,depthTest:false})); e.position.y=hh/2; e.renderOrder=9; grp.add(e);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(u.w+.12,u.h+.12),new THREE.MeshBasicMaterial({color:0x2a78d6,transparent:true,opacity:.18,depthWrite:false})); f.rotation.x=-Math.PI/2; f.position.y=.012; grp.add(f); g.add(grp); R.selVis=grp; if(!R.walk) applyGizmo(); }
  else if(id){ const sp=R.spaces.find(x=>x.s.id===id&&x.cur); if(sp){ const pts=sp.P0.map(p=>new THREE.Vector3(p[0],sp.base+.03,p[1])); const ln=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x2a78d6,depthTest:false})); ln.renderOrder=9; R.group.add(ln); R.selVis=ln; } }
  syncUi(); R.need=10; }
function applyGizmo(){ const g=R.selId&&R.objs.get(R.selId); if(!g||R.walk){ R.tc.detach(); return; } const m=R.gmode; R.tc.setMode(m); R.tc.setSpace(m==='translate'?'world':'local'); R.tc.showX=m!=='rotate'; R.tc.showZ=m!=='rotate'; R.tc.showY=m==='rotate'; R.tc.attach(g); R.need=5; }
let ED=null;
function editStart(){ const g=R.tc.object; if(!g) return; ED={p:g.position.clone(),r:g.rotation.y,s:g.scale.clone()}; tip(true); }
function editLive(){ const g=R.tc.object; if(!g||!ED) return; if(R.gmode==='scale'){ g.scale.y=1; g.scale.x=Math.max(.05/g.userData.w,g.scale.x); g.scale.z=Math.max(.05/g.userData.h,g.scale.z); } tip(true); R.need=3; }
function editEnd(){ const g=R.tc.object; tip(false); if(!g||!ED) return; const u=g.userData, moved=g.position.distanceTo(ED.p)>.001||Math.abs(g.rotation.y-ED.r)>.001||Math.abs(g.scale.x-ED.s.x)>.001||Math.abs(g.scale.z-ED.s.z)>.001; ED=null; if(!moved) return;
  const w=Math.round(u.w*g.scale.x*100)/100, h=Math.round(u.h*g.scale.z*100)/100; let r=Math.round(-g.rotation.y*180/Math.PI); r=((r%360)+360)%360;
  LAST.H.onEdit&&LAST.H.onEdit(u.id,{cx:g.position.x,cy:g.position.z,r,w,h}); }
function tip(on){ const el=R.uiEl.querySelector('.p3tip'); if(!on){ el.hidden=true; return; } const g=R.tc.object; if(!g) return; const u=g.userData; let t='';
  if(R.gmode==='translate') t=`${u.name} · x ${g.position.x.toFixed(2)} · y ${g.position.z.toFixed(2)} m`; else if(R.gmode==='rotate'){ let r=Math.round(-g.rotation.y*180/Math.PI); r=((r%360)+360)%360; t=`${u.name} · ${r}°`; } else t=`${u.name} · ${(u.w*g.scale.x).toFixed(2)} × ${(u.h*g.scale.z).toFixed(2)} m`;
  el.textContent=t; el.hidden=false; }
/* where on the floor is this point of the screen (dropping things from the library) */
export function pickFloor(cx,cy){ if(!R) return null; const r=R.renderer.domElement.getBoundingClientRect(); if(cx<r.left||cx>r.right||cy<r.top||cy>r.bottom) return null;
  const rc=new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),R.camera); const p=new THREE.Vector3(); return rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-R.base),p)?[p.x,p.z]:null; }
export function snapshot(){ if(!R) return null; R.renderer.render(R.scene,R.camera); return R.renderer.domElement.toDataURL('image/png'); }

/* ---------------- walk ---------------- */
export function walk(on,startId){ if(!R) return; if(on&&!R.walk){ R.saved={p:R.camera.position.clone(),t:R.controls.target.clone(),fov:R.camera.fov}; R.controls.enabled=false; R.tc.detach(); R.anim=null;
    R.walk={x:0,z:0,yaw:0,pitch:-.05,keys:{},jx:0,jy:0,dist:0,look:null}; build(false); start(startId); R.camera.fov=72; R.camera.updateProjectionMatrix(); syncUi(); R.renderer.domElement.focus&&R.renderer.domElement.focus(); }
  else if(!on&&R.walk){ R.walk=null; R.camera.rotation.set(0,0,0); R.camera.fov=R.saved?R.saved.fov:45; R.camera.updateProjectionMatrix(); R.controls.enabled=true; if(R.saved){ R.camera.position.copy(R.saved.p); R.controls.target.copy(R.saved.t); R.controls.update(); } build(false); syncUi(); } }
function start(id){ const {H}=LAST, list=R.spaces.filter(x=>x.cur&&!/garden|parking/.test(x.s.type)); if(!list.length){ R.walk.x=R.center.x; R.walk.z=R.center.z; return; }
  let sp=list.find(x=>x.s.id===id); if(!sp&&id){ const g=R.objs.get(id); if(g) sp=list.find(x=>H.inside([g.position.x,g.position.z],x.P0)); }
  sp=sp||list.find(x=>/lobby|reception/.test(x.s.type))||list.find(x=>x.s.type==='restaurant')||list.slice().sort((a,b)=>b.A-a.A)[0];
  const door=LAST.P.floors[LAST.FL].items.find(o=>o.kind==='door'&&o.sp===sp.s.id), c=H.centroid(sp.P0); let px=c[0], pz=c[1], fx=1, fz=0;
  if(door){ const q=H.openingPos(door); if(q){ const a=q.ang*Math.PI/180, ux=Math.cos(a), uz=Math.sin(a); let nx=-uz, nz=ux; if(!H.inside([q.p[0]+nx*.1,q.p[1]+nz*.1],sp.P0)){ nx=-nx; nz=-nz; } fx=nx; fz=nz; px=q.p[0]+nx*.9; pz=q.p[1]+nz*.9;
    /* just inside the door, with room to walk ahead (not nose to nose with a desk) */
    const clear=(x,z)=>{ for(let k=0;k<=6;k++){ if(blocked(x+nx*k*.3,z+nz*k*.3)) return false; } return true; };
    out: for(const d of [.9,1.3,1.8]) for(const l of [0,.8,-.8,1.6,-1.6,2.4,-2.4]){ const x=q.p[0]+nx*d+ux*l, z=q.p[1]+nz*d+uz*l; if(H.inside([x,z],sp.P0)&&clear(x,z)){ px=x; pz=z; break out; } } } }
  else { fx=c[0]-R.center.x||1; fz=c[1]-R.center.z; }
  for(let k=0;k<60&&blocked(px,pz);k++){ const a=k*.9, r=.15+k*.06; px=c[0]+Math.cos(a)*r; pz=c[1]+Math.sin(a)*r; }
  R.walk.x=px; R.walk.z=pz; R.walk.yaw=Math.atan2(-fx,-fz); }
function blocked(x,z){ for(const s of R.solids){ const dx=x-s.cx, dz=z-s.cz, lx=dx*s.c+dz*s.s, lz=-dx*s.s+dz*s.c; if(Math.abs(lx)<s.hl+RAD&&Math.abs(lz)<s.ht+RAD) return true; } return false; }
function walkStep(dt){ const W=R.walk, k=W.keys, run=k.shift?2.4:1, sp=1.5*run*dt; let f=(k.w||k.arrowup?1:0)-(k.s||k.arrowdown?1:0)-W.jy, s=(k.d?1:0)-(k.a?1:0)+W.jx, turn=(k.arrowright?1:0)-(k.arrowleft?1:0)+(k.e?1:0)-(k.q?1:0);
  W.yaw-=turn*1.8*dt; const L=Math.hypot(f,s); if(L>1){ f/=L; s/=L; }
  if(L>.01){ const fx=-Math.sin(W.yaw), fz=-Math.cos(W.yaw), rx=Math.cos(W.yaw), rz=-Math.sin(W.yaw), mx=(fx*f+rx*s)*sp, mz=(fz*f+rz*s)*sp;
    if(!blocked(W.x+mx,W.z+mz)){ W.x+=mx; W.z+=mz; } else if(!blocked(W.x+mx,W.z)) W.x+=mx; else if(!blocked(W.x,W.z+mz)) W.z+=mz; W.dist+=Math.hypot(mx,mz); }
  R.camera.rotation.order='YXZ'; R.camera.rotation.set(W.pitch,W.yaw,0); R.camera.position.set(W.x,R.base+EYE+Math.sin(W.dist*7)*.012,W.z); miniMap(); }
function lookStart(e){ if(e.target.closest&&e.target.closest('.p3joy,.p3map')) return; R.walk.look={x:e.clientX,y:e.clientY,id:e.pointerId}; try{ e.target.setPointerCapture(e.pointerId); }catch(x){} }
function lookMove(e){ const L=R.walk&&R.walk.look; if(!L||L.id!==e.pointerId) return; const W=R.walk; W.yaw-=(e.clientX-L.x)*.0045; W.pitch=clamp(W.pitch-(e.clientY-L.y)*.0045,-1.25,1.25); L.x=e.clientX; L.y=e.clientY; }
function lookEnd(e){ if(R.walk) R.walk.look=null; }
function joyWire(j){ const knob=j.querySelector('i'); let id=null, c=null;
  j.addEventListener('pointerdown',e=>{ e.stopPropagation(); id=e.pointerId; const r=j.getBoundingClientRect(); c=[r.left+r.width/2,r.top+r.height/2]; j.setPointerCapture(id); mv(e); });
  const mv=e=>{ if(e.pointerId!==id||!R.walk) return; let dx=(e.clientX-c[0])/50, dy=(e.clientY-c[1])/50; const L=Math.hypot(dx,dy); if(L>1){ dx/=L; dy/=L; } R.walk.jx=dx; R.walk.jy=dy; knob.style.transform=`translate(${dx*34}px,${dy*34}px)`; };
  j.addEventListener('pointermove',mv); const up=e=>{ if(e.pointerId!==id) return; id=null; if(R.walk){ R.walk.jx=0; R.walk.jy=0; } knob.style.transform=''; }; j.addEventListener('pointerup',up); j.addEventListener('pointercancel',up); }
function keyDown(e){ if(!R||!R.walk) return; if(/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||'')) return; const k=e.key.toLowerCase();
  if(k==='escape'){ LAST.H.onWalk&&LAST.H.onWalk(false); return; } if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){ R.walk.keys[k]=true; e.preventDefault(); e.stopPropagation(); } }
function keyUp(e){ if(!R||!R.walk) return; R.walk.keys[e.key.toLowerCase()]=false; }
function miniMap(){ const cv=R.uiEl.querySelector('.p3map'); if(!cv||!R.bb) return; const g=cv.getContext('2d'), Wd=cv.width, Ht=cv.height, [x0,z0,x1,z1]=R.bb, s=Math.min((Wd-16)/(x1-x0||1),(Ht-16)/(z1-z0||1)), ox=(Wd-(x1-x0)*s)/2-x0*s, oy=(Ht-(z1-z0)*s)/2-z0*s; R.mapT={s,ox,oy};
  g.clearRect(0,0,Wd,Ht); g.fillStyle='rgba(20,20,20,.55)'; g.fillRect(0,0,Wd,Ht);
  R.spaces.filter(x=>x.cur).forEach(x=>{ g.beginPath(); x.P0.forEach((p,i)=>i?g.lineTo(p[0]*s+ox,p[1]*s+oy):g.moveTo(p[0]*s+ox,p[1]*s+oy)); g.closePath(); g.fillStyle=(LAST.H.ST[x.s.type]||LAST.H.ST.other).c; g.globalAlpha=.85; g.fill(); g.globalAlpha=1; g.strokeStyle='#222'; g.lineWidth=1; g.stroke(); });
  const W=R.walk, px=W.x*s+ox, py=W.z*s+oy, fx=-Math.sin(W.yaw), fz=-Math.cos(W.yaw); g.fillStyle='rgba(42,120,214,.35)'; g.beginPath(); g.moveTo(px,py); const a=Math.atan2(fz,fx); g.arc(px,py,26,a-.6,a+.6); g.closePath(); g.fill(); g.fillStyle='#2a78d6'; g.beginPath(); g.arc(px,py,5,0,7); g.fill(); g.strokeStyle='#fff'; g.lineWidth=2; g.stroke(); }

/* ---------------- library pictures: each object rendered in 3D once ---------------- */
let TH=null;
export async function thumbs(list,onOne){ if(!TH){ const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.setPixelRatio(1); r.setSize(200,150,false); r.toneMapping=THREE.ACESFilmicToneMapping; r.setClearColor(0x000000,0);
    const sc=new THREE.Scene(), pm=new THREE.PMREMGenerator(r); sc.environment=pm.fromScene(new RoomEnvironment(r),.04).texture; pm.dispose(); sc.add(new THREE.HemisphereLight(0xffffff,0x887766,.8)); const dl=new THREE.DirectionalLight(0xffffff,2); dl.position.set(3,6,4); sc.add(dl);
    TH={r,sc,cam:new THREE.PerspectiveCamera(30,4/3,.05,100)}; }
  for(const {k,T:T0} of list){ const o={id:k,t:k,w:T0.w,h:T0.d,shape:T0.shape==='round'?'round':'box'}, g=MD.build(o,T0), wrap=new THREE.Group(); wrap.add(g); if(!(T0.lift>.3)) wrap.add(MD.blob(T0.w,T0.d)); TH.sc.add(wrap);
    const bb=new THREE.Box3().setFromObject(g), c=bb.getCenter(new THREE.Vector3()), sz=bb.getSize(new THREE.Vector3()), rad=Math.max(sz.length()/2,.25), d=rad/Math.sin(TH.cam.fov*Math.PI/360)*1.02;
    TH.cam.position.copy(c).add(new THREE.Vector3(.62,.62,.92).normalize().multiplyScalar(d)); TH.cam.lookAt(c); TH.cam.updateProjectionMatrix(); TH.r.render(TH.sc,TH.cam);
    let url=''; try{ url=TH.r.domElement.toDataURL('image/webp',.86); }catch(e){} TH.sc.remove(wrap); if(url) onOne(k,url); await new Promise(res=>setTimeout(res,0)); } }

export function dbg(){ return R?{calls:R.renderer.info.render.calls,tris:R.renderer.info.render.triangles,geos:R.renderer.info.memory.geometries,progs:(R.renderer.info.programs||[]).length,meshes:(()=>{ let n=0; R.scene.traverse(o=>{ if(o.isMesh) n++; }); return n; })(),cam:R.camera.position.toArray().map(v=>+v.toFixed(2)),tgt:R.controls.target.toArray().map(v=>+v.toFixed(2)),anim:!!R.anim,raf:R.raf,need:R.need}:null; }
/* test + console hooks */
export function state(){ return R?{sel:R.selId,gizmo:!!R.tc.object,mode:R.gmode,lights:R.lights.length,walls:R.walls.length,objs:R.objs.size,walk:R.walk?{x:R.walk.x,z:R.walk.z,yaw:R.walk.yaw}:null,night:R.night,opt:Object.assign({},OPT)}:null; }
export function screenOf(id){ if(!R) return null; const g=R.objs.get(id); let v; if(g){ v=new THREE.Vector3(); g.getWorldPosition(v); v.y+=(g.userData.ht||.5)*.6; } else { const sp=R.spaces.find(x=>x.s.id===id&&x.cur); if(!sp) return null; const c=LAST.H.centroid(sp.P0); v=new THREE.Vector3(c[0],sp.base+.05,c[1]); }
  v.project(R.camera); const r=R.renderer.domElement.getBoundingClientRect(); return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]; }
export function editBy(id,v){ const g=R&&R.objs.get(id); if(!g) return false; R.tc.attach(g); editStart(); g.position.x+=v.dx||0; g.position.z+=v.dz||0; g.rotation.y-=(v.dr||0)*Math.PI/180; if(v.sx) g.scale.x*=v.sx; editEnd(); return true; }
export function setTime(h){ OPT.time=h; syncUi(); applyTime(); const n=R.night>0; if(n!==R.lit) build(false); }
export function walkKey(k,down){ if(R&&R.walk) R.walk.keys[k]=down; }
export function walkTo(x,z,yaw){ if(R&&R.walk){ R.walk.x=x; R.walk.z=z; if(yaw!=null) R.walk.yaw=yaw; } }
