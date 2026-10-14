/* Hayat · Space planner · 3D models + materials (three.js r160, bundled) · v279 (Majid, 14 Oct 2026)
   Every object is built from simple parts at its REAL size in metres. Local axes: x = width, z = depth,
   y = up from the floor; the BACK of a thing (bed head, sofa back, toilet tank, wardrobe, desk lamp) is -z,
   the front is +z. Textures are drawn on canvases at start - no image files: floor planks, tile, marble,
   carpet, concrete, grass, fabric weave, wood grain, brushed steel, plaster. Geometries + materials are
   shared (cached by size / colour), so a hotel with 2,000 parts stays light. */
import * as THREE from './assets/three/three.module.min.js';
import { RoundedBoxGeometry } from './assets/three/RoundedBoxGeometry.js';
import { mergeGeometries } from './assets/three/BufferGeometryUtils.js';

/* ---------------- textures ---------------- */
const TX={}, TXR={};
function rng(seed){ let s=(seed>>>0)||1; return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296); }
export function hash(str){ let h=2166136261; str=String(str||''); for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function speck(g,S,n,a,lo,hi,r){ for(let i=0;i<n;i++){ const v=lo+(hi-lo)*r()|0; g.fillStyle=`rgba(${v},${v},${v},${a})`; const s=1+r()*2; g.fillRect(r()*S,r()*S,s,s); } }
const DRAW={
  planks(g,S){ const r=rng(7), rows=12, rh=S/rows;
    for(let i=0;i<rows;i++){ let x=-r()*S*.6;
      while(x<S){ const L=S*(.32+r()*.38), t=212+r()*38|0; g.fillStyle=`rgb(${t},${t},${t})`; g.fillRect(x,i*rh,L,rh);
        for(let k=0;k<8;k++){ g.strokeStyle=`rgba(95,72,50,${.05+r()*.09})`; g.lineWidth=.6+r()*1.5; g.beginPath(); const y=i*rh+r()*rh, f=26+r()*40; g.moveTo(x,y); for(let u=0;u<=L;u+=S/20) g.lineTo(x+u,y+Math.sin((u+k*37)/f)*rh*.1); g.stroke(); }
        g.fillStyle='rgba(60,45,30,.4)'; g.fillRect(x,i*rh,2,rh); x+=L; }
      g.fillStyle='rgba(60,45,30,.32)'; g.fillRect(0,i*rh,S,1.6); }
    speck(g,S,9000,.05,0,255,r); },
  grain(g,S){ const r=rng(3); g.fillStyle='rgb(244,244,244)'; g.fillRect(0,0,S,S);
    for(let k=0;k<70;k++){ g.strokeStyle=`rgba(85,62,40,${.04+r()*.1})`; g.lineWidth=.5+r()*2; g.beginPath(); const y=r()*S, f=18+r()*30; g.moveTo(0,y); for(let u=0;u<=S;u+=S/32) g.lineTo(u,y+Math.sin(u/f+k)*5); g.stroke(); }
    speck(g,S,4000,.04,0,255,r); },
  tile(g,S){ const r=rng(11), n=2, ts=S/n, gr=Math.max(2,S/150); g.fillStyle='rgb(168,166,162)'; g.fillRect(0,0,S,S);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const t=238+r()*15|0; g.fillStyle=`rgb(${t},${t},${t})`; g.fillRect(i*ts+gr/2,j*ts+gr/2,ts-gr,ts-gr); }
    speck(g,S,5000,.035,150,255,r); },
  marble(g,S){ const r=rng(5); g.fillStyle='rgb(247,246,243)'; g.fillRect(0,0,S,S); g.filter='blur(1.4px)';
    for(let k=0;k<24;k++){ g.strokeStyle=`rgba(118,114,110,${.07+r()*.22})`; g.lineWidth=.6+r()*2.8; g.beginPath(); let x=r()*S, y=r()*S; g.moveTo(x,y);
      for(let s=0;s<7;s++){ const nx=x+(r()-.3)*S*.34, ny=y+(r()-.5)*S*.3; g.quadraticCurveTo((x+nx)/2+(r()-.5)*70,(y+ny)/2+(r()-.5)*70,nx,ny); x=nx; y=ny; } g.stroke(); }
    g.filter='none'; g.fillStyle='rgba(150,148,145,.4)'; [0,S/2].forEach(p=>{ g.fillRect(0,p,S,1.3); g.fillRect(p,0,1.3,S); }); },
  carpet(g,S){ const r=rng(13); g.fillStyle='rgb(226,226,226)'; g.fillRect(0,0,S,S); speck(g,S,42000,.22,150,255,r);
    g.strokeStyle='rgba(0,0,0,.05)'; g.lineWidth=2; for(let i=-S;i<S*2;i+=S/8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+S,S); g.moveTo(i+S,0); g.lineTo(i,S); g.stroke(); } },
  concrete(g,S){ const r=rng(17); g.fillStyle='rgb(232,232,232)'; g.fillRect(0,0,S,S);
    for(let k=0;k<60;k++){ const x=r()*S, y=r()*S, R=20+r()*90, gr=g.createRadialGradient(x,y,0,x,y,R), v=r()<.5?185:255; gr.addColorStop(0,`rgba(${v},${v},${v},.1)`); gr.addColorStop(1,`rgba(${v},${v},${v},0)`); g.fillStyle=gr; g.fillRect(x-R,y-R,R*2,R*2); }
    speck(g,S,20000,.1,120,255,r); },
  grass(g,S){ const r=rng(19); g.fillStyle='#6a9146'; g.fillRect(0,0,S,S); const C=[[92,136,60],[118,160,72],[80,118,50],[138,168,88]];
    for(let k=0;k<9000;k++){ const x=r()*S, y=r()*S, c=C[k%4]; g.strokeStyle=`rgba(${c[0]},${c[1]},${c[2]},.6)`; g.lineWidth=1; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(r()-.5)*3,y-3-r()*5); g.stroke(); } },
  fabric(g,S){ const r=rng(23); g.fillStyle='rgb(242,242,242)'; g.fillRect(0,0,S,S); for(let i=0;i<S;i+=2){ g.fillStyle=`rgba(0,0,0,${.03+r()*.03})`; g.fillRect(0,i,S,1); g.fillRect(i,0,1,S); } speck(g,S,3000,.05,0,255,r); },
  brushed(g,S){ const r=rng(29); g.fillStyle='rgb(236,236,236)'; g.fillRect(0,0,S,S); for(let i=0;i<1400;i++){ const v=196+r()*59|0; g.fillStyle=`rgba(${v},${v},${v},.35)`; g.fillRect(r()*S,r()*S,20+r()*120,1); } },
  plaster(g,S){ const r=rng(31); g.fillStyle='rgb(250,250,250)'; g.fillRect(0,0,S,S); speck(g,S,12000,.045,170,255,r); },
};
const SIZE={planks:1024,marble:1024,carpet:512,concrete:512,grass:512,grain:512,tile:512,fabric:256,brushed:256,plaster:256};
let ANISO=4; export function setAniso(a){ ANISO=a||4; }
export function tex(key,rep){ const k=key+'|'+rep; if(TXR[k]) return TXR[k];
  if(!TX[key]){ const c=document.createElement('canvas'); c.width=c.height=SIZE[key]||256; DRAW[key](c.getContext('2d'),c.width); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=ANISO; TX[key]=t; }
  const t=TX[key].clone(); t.needsUpdate=true; t.repeat.set(rep,rep); t.anisotropy=ANISO; return TXR[k]=t; }
let BLOBT=null;
function blobTex(){ if(BLOBT) return BLOBT; const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'), gr=g.createRadialGradient(64,64,10,64,64,64); gr.addColorStop(0,'rgba(0,0,0,.55)'); gr.addColorStop(.55,'rgba(0,0,0,.28)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); return BLOBT=new THREE.CanvasTexture(c); }

/* ---------------- materials ---------------- */
const MAT=new Map();
export const mk=(key,f)=>{ let m=MAT.get(key); if(!m){ m=f(); MAT.set(key,m); } return m; };
const S=(o)=>new THREE.MeshStandardMaterial(o);
export const mWood=c=>mk('wd'+c,()=>S({color:c,map:tex('grain',1),roughness:.5}));
export const mFab=c=>mk('fb'+c,()=>S({color:c,map:tex('fabric',3),roughness:.93}));
export const mLeather=c=>mk('lt'+c,()=>S({color:c,roughness:.42}));
export const mPaint=c=>mk('pt'+c,()=>S({color:c,roughness:.6}));
export const mGloss=c=>mk('gs'+c,()=>S({color:c,roughness:.2}));
export const mWall=c=>mk('wl'+c,()=>S({color:c,map:tex('plaster',2),roughness:.85,vertexColors:true}));
/* a wall piece: one box, its top face (the cut) darkened by vertex colour, so a wall is ONE draw call */
export function wallGeo(len,h,t){ const g=new THREE.BoxGeometry(len,h,t), n=g.attributes.position.count, c=new Float32Array(n*3); for(let i=0;i<n;i++){ const top=Math.floor(i/4)===2, v=top?.035:1; c[i*3]=v; c[i*3+1]=v*.97; c[i*3+2]=v*.93; } g.setAttribute('color',new THREE.BufferAttribute(c,3)); g.clearGroups(); return g; }
/* merge every mesh under a group into one mesh per material (doors, windows): fewer draw calls */
export function flatten(root){ root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(), by=new Map();
  root.traverse(ch=>{ if(!ch.isMesh||ch.userData.keep) return; let gg=ch.geometry.clone(); gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,ch.matrixWorld)); if(gg.index) gg=gg.toNonIndexed(); const k=ch.material.uuid; (by.get(k)||by.set(k,{mat:ch.material,list:[],ro:ch.renderOrder}).get(k)).list.push(gg); });
  const out=new THREE.Group(); by.forEach(({mat,list,ro})=>{ let geo=null; try{ geo=list.length>1?mergeGeometries(list,false):list[0]; }catch(e){} if(!geo){ list.forEach(x=>{ const m=M(x,mat); m.renderOrder=ro; out.add(m); }); return; } list.forEach(x=>{ if(x!==geo) x.dispose(); }); const m=M(geo,mat); m.renderOrder=ro; if(mat.transparent) m.castShadow=false; out.add(m); }); return out; }
export const mSteel=()=>mk('steel',()=>S({color:'#c4cacf',map:tex('brushed',1),roughness:.33,metalness:.85}));
export const mDark=()=>mk('dark',()=>S({color:'#26292d',roughness:.5,metalness:.25}));
export const mChrome=()=>mk('chrome',()=>S({color:'#f0f2f4',roughness:.08,metalness:1}));
export const mCer=()=>mk('cer',()=>S({color:'#f8f8f5',roughness:.1}));
export const mGlass=()=>mk('glass',()=>S({color:'#c9e1ee',roughness:.03,metalness:.1,transparent:true,opacity:.24,depthWrite:false}));
export const mMirror=()=>mk('mirror',()=>S({color:'#e2eaee',roughness:.02,metalness:1}));
export const mScreen=()=>mk('screen',()=>S({color:'#0b0d11',roughness:.1,metalness:.35,emissive:'#16263a',emissiveIntensity:.6}));
export const mMarble=c=>mk('mb'+(c||''),()=>S({color:c||'#f2efe9',map:tex('marble',1),roughness:.16}));
export const mLeaf=c=>mk('lf'+c,()=>S({color:c,roughness:.78,flatShading:true}));
export const mClay=c=>mk('cl'+c,()=>S({color:c,map:tex('concrete',1),roughness:.95}));
export const LAMPS=[];
export const mLamp=c=>mk('lp'+c,()=>{ const m=S({color:c,emissive:c,emissiveIntensity:.25,roughness:.6}); LAMPS.push(m); return m; });
export const mGlow=c=>mk('gw'+c,()=>{ const m=S({color:'#1a1a1a',emissive:c,emissiveIntensity:1.2,roughness:.5}); return m; });
export function setEnv(v){ MAT.forEach(m=>{ if(m.isMeshStandardMaterial) m.envMapIntensity=v; }); }
export function setNight(n){ LAMPS.forEach(m=>{ m.emissiveIntensity=.25+2.6*n; }); }

/* floor finishes (key → name, texture, colour, repeat per metre, roughness) */
export const FLOORS={ oak:['Oak wood','planks','#caa074',1/2.4,.6], walnut:['Dark wood','planks','#7d5538',1/2.4,.55], marble:['Marble','marble','#f3f0ea',1/2.4,.2],
  tile:['Tile 60 cm','tile','#ece8e0',1/1.2,.35], smalltile:['Tile 30 cm','tile','#dde8ee',1/.6,.3], greytile:['Grey tile','tile','#adb1b4',1/.6,.45],
  terracotta:['Terracotta','tile','#b9653f',1/.8,.75], carpet:['Carpet','carpet','#6f7d8c',1,.96], redcarpet:['Red carpet','carpet','#8e3b3b',1,.96],
  concrete:['Concrete','concrete','#bab6ae',1/3,.86], stone:['Stone','tile','#c9c2b5',1/1.6,.72], grass:['Grass','grass','#ffffff',1/2,.96], asphalt:['Asphalt','concrete','#606264',1/3,.92] };
export const AUTOFLOOR={room:'oak',suite:'oak',bath:'smalltile',wash:'smalltile',corridor:'tile',lobby:'marble',reception:'marble',restaurant:'walnut',kitchen:'greytile',store:'concrete',clean:'tile',laundry:'tile',banquet:'redcarpet',office:'carpet',staff:'tile',stairs:'stone',garden:'grass',parking:'asphalt',other:'concrete'};
export function floorMat(key,tint){ const F=FLOORS[key]||FLOORS.concrete; return mk('fl'+key+(tint||''),()=>S({color:tint||F[2],map:tex(F[1],F[3]),roughness:F[4]})); }
export function groundMat(rep){ return mk('ground'+rep,()=>S({color:'#ffffff',map:tex('grass',rep),roughness:.97})); }

/* ---------------- geometry (cached) ---------------- */
const GEO=new Map(); const k3=v=>Math.round(v*1000);
function geo(key,f){ let g=GEO.get(key); if(!g){ g=f(); GEO.set(key,g); } return g; }
export const gBox=(w,h,d)=>geo(`b${k3(w)}|${k3(h)}|${k3(d)}`,()=>new THREE.BoxGeometry(w,h,d));
export const gRB=(w,h,d,r)=>{ r=Math.min(r,w/2-.002,h/2-.002,d/2-.002); if(r<.004) return gBox(w,h,d); return geo(`r${k3(w)}|${k3(h)}|${k3(d)}|${k3(r)}`,()=>new RoundedBoxGeometry(w,h,d,3,r)); };
export const gCyl=(rt,rb,h,seg)=>geo(`c${k3(rt)}|${k3(rb)}|${k3(h)}|${seg||24}`,()=>new THREE.CylinderGeometry(rt,rb,h,seg||24));
const gSph=(r,ws,hs,th)=>geo(`s${k3(r)}|${ws}|${hs}|${th||0}`,()=>th?new THREE.SphereGeometry(r,ws,hs,0,Math.PI*2,0,th):new THREE.SphereGeometry(r,ws,hs));
const gIco=(r)=>geo(`i${k3(r)}`,()=>new THREE.IcosahedronGeometry(r,1));
const gTor=(R,t,arc)=>geo(`t${k3(R)}|${k3(t)}|${k3(arc||7)}`,()=>new THREE.TorusGeometry(R,t,10,28,arc||Math.PI*2));
const gHood=()=>geo('hood',()=>{ const g=new THREE.CylinderGeometry(Math.SQRT1_2*.66,Math.SQRT1_2,1,4,1); g.rotateY(Math.PI/4); return g; });
export function M(g,m){ const me=new THREE.Mesh(g,m); me.castShadow=true; me.receiveShadow=true; return me; }

/* placement helpers: y is the BOTTOM of the part */
function put(x,me,px,yb,pz,h){ me.position.set(px||0,(yb||0)+(h||0)/2,pz||0); x.g.add(me); return me; }
const box=(x,w,h,d,m,px,yb,pz,r)=>put(x,M(r?gRB(w,h,d,r):gBox(w,h,d),m),px,yb,pz,h);
const cyl=(x,rt,rb,h,m,px,yb,pz,seg)=>put(x,M(gCyl(rt,rb,h,seg),m),px,yb,pz,h);
const sph=(x,r,m,px,py,pz,ws)=>{ const me=M(gSph(r,ws||16,Math.max(8,(ws||16)*.6|0)),m); me.position.set(px,py,pz); x.g.add(me); return me; };
function knob(x,px,py,pz,m){ const c=M(gCyl(.011,.011,.03,10),m||mChrome()); c.rotation.x=Math.PI/2; c.position.set(px,py,pz+.015); x.g.add(c); return c; }
function hbar(x,len,px,py,pz,m){ const c=M(gCyl(.01,.01,len,10),m||mChrome()); c.rotation.z=Math.PI/2; c.position.set(px,py,pz); x.g.add(c);
  [-1,1].forEach(i=>{ const s=M(gCyl(.006,.006,.035,8),m||mChrome()); s.rotation.x=Math.PI/2; s.position.set(px+i*(len/2-.02),py,pz-.018); x.g.add(s); }); return c; }
function vbar(x,len,px,py,pz,m){ const c=M(gCyl(.01,.01,len,10),m||mChrome()); c.position.set(px,py,pz); x.g.add(c); return c; }
const legs4=(x,w,d,h,m,inset,th)=>[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>box(x,th||.04,h,th||.04,m,i*(w/2-(inset||.04)),0,j*(d/2-(inset||.04))));
const seam=(x,w,h,px,yb,pz)=>box(x,w,h,.004,mDark(),px,yb,pz);
/* finish chosen in the panel wins over the object's own look */
function body(x,f,c){ const C=x.col||c; switch(x.fin){ case'oak':return mWood('#c9a074'); case'walnut':return mWood('#6f4a30'); case'white':return mPaint('#f1efea'); case'black':return mPaint('#2b2b2c'); case'steel':return mSteel(); case'fabric':return mFab(x.col||'#8f9eb3'); default:return f(C); } }
function lamp(x,px,yb,pz,h){ cyl(x,.065,.075,.02,mPaint('#2d2f33'),px,yb,pz); cyl(x,.008,.008,h*.72,mChrome(),px,yb+.02,pz,8); cyl(x,.075,.115,.15,mLamp('#ffe1ae'),px,yb+h*.68,pz,20); }
function plates(x,pts,y){ pts.forEach(([px,pz,a])=>{ cyl(x,.12,.1,.014,mCer(),px,y,pz,24); const gx=px+Math.cos(a)*.15, gz=pz+Math.sin(a)*.15; cyl(x,.034,.028,.1,mGlass(),gx,y,gz,14); box(x,.02,.004,.17,mChrome(),px+Math.sin(a)*.15,y,pz-Math.cos(a)*.15); }); }

/* ---------------- the objects ---------------- */
const B={};
B.bed_k=B.bed_q=B.bed_s=x=>{ const {w,d}=x, fr=body(x,c=>mWood(c),'#6e5240'), lh=.1, fh=.24;
  legs4(x,w,d,lh,fr,.06,.06); box(x,w,fh,d-.06,fr,0,lh,.03,.03);
  const z0=-d/2+.12, z1=d/2-.03, mL=z1-z0; box(x,w-.06,.24,mL,mFab('#f6f3ec'),0,lh+fh-.04,(z0+z1)/2,.06);
  const top=lh+fh+.2, du=mL*.66, dc=x.col&&x.fin!=='white'?x.col:'#ebe5d9';
  box(x,w-.01,.07,du,mFab(dc),0,top-.02,z1-du/2+.01,.035); box(x,w,.08,.17,mFab('#fbfaf6'),0,top-.02,z1-du+.07,.04);
  box(x,w+.01,.03,.42,mFab('#8a5a45'),0,top+.045,z1-.34,.012);
  const n=w>1.25?2:1, pw=n===2?w/2-.14:w-.3; for(let i=0;i<n;i++){ const p=box(x,pw,.14,.42,mFab('#fdfcf9'),n===2?(i?1:-1)*(w/4-.02):0,top-.03,z0+.3,.065); p.rotation.x=-.2; }
  box(x,w+.1,1.1,.09,mFab('#a99782'),0,0,-d/2+.045,.035); };
B.wardrobe=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#a58a6c'), H=2.1; box(x,w-.04,.08,d-.06,mDark(),0,0,0); box(x,w,H-.08,d,m,0,.08,0,.01);
  const n=w>1.7?3:w>.9?2:1; for(let i=1;i<n;i++) seam(x,.006,H-.16,-w/2+i*w/n,.12,d/2+.002);
  for(let i=0;i<n;i++){ const cx=-w/2+(i+.5)*w/n, s=n===1?1:(i%2?-1:1); vbar(x,.3,cx+s*(w/n/2-.06),1.05,d/2+.03); } };
B.desk=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#b49272'); box(x,w,.035,d,m,0,.715,0,.008);
  [-1,1].forEach(i=>box(x,.04,.715,d-.06,mPaint('#2f3134'),i*(w/2-.04),0,0));
  if(w>.9){ box(x,.4,.42,d-.1,m,w/2-.27,.29,0,.01); seam(x,.38,.004,w/2-.27,.5,d/2-.048); knob(x,w/2-.27,.6,d/2-.05); }
  lamp(x,-w/2+.2,.75,-d/2+.16,.44); box(x,.34,.016,.24,mPaint('#2b2d31'),-.02,.75,.02,.004); };
B.tv=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#6b5546'); box(x,w,.42,d,m,0,.06,0,.01); [-1,1].forEach(i=>box(x,.04,.06,d-.08,mDark(),i*(w/2-.08),0,0));
  for(let i=1;i<3;i++) seam(x,.005,.36,-w/2+i*w/3,.09,d/2+.002);
  const sw=Math.min(w-.12,1.3), sh=sw*.5625; box(x,.32,.02,.18,mDark(),0,.48,-d/2+.15); box(x,.05,.12,.04,mDark(),0,.5,-d/2+.15);
  box(x,sw,sh,.04,mDark(),0,.6,-d/2+.15,.008); box(x,sw-.03,sh-.03,.003,mScreen(),0,.615,-d/2+.171); };
function sofa(x,seats){ const {w,d}=x, f=body(x,c=>mFab(c),'#8f9eb3'), arm=Math.min(.16,w*.15), sd=d-.24;
  legs4(x,w,d,.08,mWood('#4a3527'),.07,.05); box(x,w,.24,d,f,0,.08,0,.04); box(x,w,.5,.18,f,0,.3,-d/2+.09,.06);
  [-1,1].forEach(i=>box(x,arm,.32,d,f,i*(w/2-arm/2),.3,0,.06));
  const iw=w-arm*2, cw=iw/seats; for(let i=0;i<seats;i++){ const cx=-iw/2+(i+.5)*cw; box(x,cw-.02,.14,sd-.04,f,cx,.31,.09,.06); const b=box(x,cw-.03,.42,.16,f,cx,.42,-d/2+.25,.07); b.rotation.x=-.12; }
  if(seats>1){ const p=mFab('#d6b07a'); [-1,1].forEach(i=>{ const q=box(x,.36,.34,.1,p,i*(iw/2-.24),.45,-d/2+.38,.05); q.rotation.set(-.28,i*.28,0); }); } }
B.sofa2=x=>sofa(x,2); B.lsofa=x=>sofa(x,x.w>1.8?3:2); B.armch=x=>sofa(x,1);
B.side=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#b49272'); legs4(x,w,d,.05,mDark(),.04,.03); box(x,w,.48,d,m,0,.05,0,.01); seam(x,w-.06,.004,0,.34,d/2+.001); knob(x,0,.42,d/2); lamp(x,0,.53,-.02,.46); };
function chairM(x,seatC,frameC){ const {w,d}=x, fr=mWood(frameC), st=body(x,c=>mFab(c),seatC), lh=.43;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>cyl(x,.018,.014,lh,fr,i*(w/2-.04),0,j*(d/2-.04),10));
  box(x,w-.02,.05,d-.04,st,0,lh,.01,.02); [-1,1].forEach(i=>box(x,.035,.5,.035,fr,i*(w/2-.04),lh,-d/2+.03)); box(x,w-.02,.06,.035,fr,0,lh+.44,-d/2+.03,.01); box(x,w-.1,.24,.03,st,0,lh+.15,-d/2+.035,.012); }
B.chair=x=>chairM(x,'#9c8165','#5a4130'); B.dchair=x=>chairM(x,'#7a4b3a','#3f2c20');
B.lugg=x=>{ const {w,d}=x, m=mWood('#7a5a42'); [-1,1].forEach(i=>[-1,1].forEach(j=>box(x,.035,.48,.035,m,i*(w/2-.03),0,j*(d/2-.03)))); [-1,1].forEach(j=>box(x,w,.03,.035,m,0,.46,j*(d/2-.03))); for(let k=0;k<3;k++) box(x,.06,.012,d-.04,mFab('#3d3a36'),-w/3+k*w/3,.478,0); };
B.mini=x=>{ const {w,d}=x; box(x,w,.85,d,body(x,c=>mGloss(c),'#e9e9e9'),0,0,0,.02); seam(x,w-.04,.004,0,.18,d/2+.001); vbar(x,.22,w/2-.06,.6,d/2+.025); };
B.ac=x=>{ const {w,d}=x; box(x,w,.3,d,mGloss('#f4f4f2'),0,0,0,.06); box(x,w-.12,.03,.02,mDark(),0,.04,d/2-.005); box(x,.03,.012,.004,mGlow('#5cf08a'),w/2-.12,.2,d/2+.001); };
B.wc=x=>{ const {w,d}=x, c=mCer(), bl=d-.2, bz=-d/2+.2+bl/2;
  box(x,w-.02,.36,.18,c,0,.42,-d/2+.09,.03); cyl(x,.022,.022,.012,mChrome(),0,.78,-d/2+.09,14);
  const ped=cyl(x,.12,.1,.3,c,0,0,bz-.03,28); ped.scale.z=1.2; const bowl=cyl(x,w/2-.01,w/2-.06,.12,c,0,.28,bz,32); bowl.scale.z=bl/(w-.02);
  const seat=cyl(x,w/2,w/2,.025,mGloss('#fafafa'),0,.4,bz,32); seat.scale.z=bl/w; };
B.basin=x=>{ const {w,d}=x, c=mCer(); cyl(x,.08,.11,.68,c,0,0,-.04,24); box(x,w-.02,.16,d-.02,c,0,.69,0,.07); const ins=cyl(x,w/2-.09,w/2-.09,.004,mGloss('#e6edf0'),0,.851,.03,28); ins.scale.z=(d-.16)/(w-.18); cyl(x,.014,.014,.13,mChrome(),0,.85,-d/2+.07,12); box(x,.024,.02,.1,mChrome(),0,.96,-d/2+.11); };
B.vanity=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#d9d2c4'); box(x,w,.06,d-.06,mDark(),0,0,-.02); box(x,w,.72,d-.02,m,0,.06,0,.01);
  const n=w>.9?2:1; for(let i=1;i<n;i++) seam(x,.005,.66,-w/2+i*w/n,.09,d/2-.008); for(let i=0;i<n;i++) hbar(x,.16,-w/2+(i+.5)*w/n,.66,d/2+.02);
  box(x,w+.02,.04,d,mMarble('#efebe4'),0,.78,0,.004); cyl(x,.2,.15,.13,mCer(),0,.82,.02,28); cyl(x,.014,.014,.2,mChrome(),0,.82,-d/2+.08,12); box(x,.024,.02,.12,mChrome(),0,1.0,-d/2+.13);
  box(x,Math.min(w-.1,1.1),.8,.02,mMirror(),0,1.15,-d/2+.012); box(x,Math.min(w-.1,1.1)+.03,.03,.03,mDark(),0,1.95,-d/2+.015); };
B.shower=x=>{ const {w,d}=x; box(x,w,.05,d,mCer(),0,0,0,.01); cyl(x,.04,.04,.004,mChrome(),0,.05,0,16);
  box(x,.01,1.95,d,mGlass(),w/2-.005,.05,0); box(x,w,1.95,.01,mGlass(),0,.05,d/2-.005); vbar(x,1.95,w/2-.01,1.025,d/2-.01);
  vbar(x,1.1,0,1.45,-d/2+.03); const arm=box(x,.018,.018,.2,mChrome(),0,1.98,-d/2+.12); cyl(x,.1,.1,.015,mChrome(),0,1.97,-d/2+.22,24); cyl(x,.03,.03,.05,mChrome(),0,1.05,-d/2+.04,14); };
B.tub=x=>{ const {w,d}=x; box(x,w,.56,d,mCer(),0,0,0,.08); box(x,w-.14,.012,d-.14,mGloss('#dfeaee'),0,.552,0,.004); cyl(x,.016,.016,.16,mChrome(),-w/2+.1,.56,0,12); box(x,.12,.02,.025,mChrome(),-w/2+.15,.7,0); };
B.urinal=x=>{ const {w,d}=x; box(x,w,.6,d,mCer(),0,0,0,.12); vbar(x,.5,0,.85,-d/2+.04); };
function tableTop(x,legsKind){ const {w,d}=x, m=body(x,c=>mWood(c),'#9a6a3c'); box(x,w,.04,d,m,0,.71,0,.01); box(x,w-.12,.08,d-.12,m,0,.63,0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>cyl(x,.026,.02,.63,mWood('#4a3424'),i*(w/2-.08),0,j*(d/2-.08),12)); }
function seatsAlong(w,d,n){ const P=[]; for(let i=0;i<n;i++){ const px=-w/2+(i+.5)*w/n; P.push([px,d/2-.17,Math.PI/2*0],[px,-d/2+.17,Math.PI]); } return P; }
B.t2=x=>{ tableTop(x); plates(x,[[0,x.d/2-.17,0],[0,-x.d/2+.17,Math.PI]],.75); };
B.t4=x=>{ tableTop(x); plates(x,seatsAlong(x.w,x.d,2),.75); };
B.t6=x=>{ tableTop(x); plates(x,seatsAlong(x.w,x.d,3),.75); };
B.booth=x=>{ const {w,d}=x, l=body(x,c=>mLeather(c),'#7c4b3b'); box(x,w,.4,d,mWood('#4a3424'),0,0,0,.01); box(x,w-.04,.1,d-.15,l,0,.4,.06,.04); box(x,w,.7,.16,l,0,.4,-d/2+.08,.05); for(let i=1;i<4;i++) seam(x,.005,.6,-w/2+i*w/4,.48,-d/2+.162); };
B.counter=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#8c6e52'); box(x,w,.08,d-.06,mDark(),0,0,-.02); box(x,w,.93,d,m,0,.08,0,.01); box(x,w+.04,.04,d+.06,mMarble('#4a4744'),0,1.01,0,.005);
  box(x,w-.04,.02,.01,mGlow('#ffcf8a'),0,.98,d/2+.006); for(let i=1;i<Math.round(w/.6);i++) seam(x,.004,.8,-w/2+i*w/Math.round(w/.6),.14,d/2+.002); };
B.cash=x=>{ B.counter(x); const {d}=x; box(x,.06,.22,.06,mDark(),-.1,1.05,-d/2+.2); const s=box(x,.36,.24,.03,mDark(),-.1,1.24,-d/2+.2,.006); s.rotation.x=-.2; box(x,.34,.2,.004,mScreen(),-.1,1.26,-d/2+.218); box(x,.36,.1,.4,mDark(),.25,1.05,-d/2+.25,.01); };
B.buffet=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#b7a08a'); box(x,w,.86,d,m,0,0,0,.01); box(x,w+.02,.04,d,mSteel(),0,.86,0);
  const n=Math.max(1,Math.floor(w/.6)); for(let i=0;i<n;i++){ const px=-w/2+(i+.5)*w/n; box(x,.5,.1,.32,mSteel(),px,.9,0,.02); const lid=M(gCyl(.16,.16,.46,20,1),mChrome()); lid.rotation.z=Math.PI/2; lid.scale.y=1; lid.position.set(px,1.0,0); lid.scale.set(1,1,.62); x.g.add(lid); }
  box(x,w-.04,.36,.01,mGlass(),0,1.1,d/2-.05); [-1,1].forEach(i=>vbar(x,.4,i*(w/2-.05),1.1,d/2-.05)); };
B.hand=x=>{ const {w,d}=x; box(x,w,.16,d,mCer(),0,.7,0,.06); box(x,w-.12,.004,d-.12,mGloss('#e6edf0'),0,.861,.02); vbar(x,.6,0,.38,-d/2+.06); cyl(x,.014,.014,.12,mChrome(),0,.86,-d/2+.06,12); box(x,.08,.16,.06,mGloss('#e9e9e9'),w/2-.06,1.0,-d/2+.03,.01); };
B.range4=B.range2=x=>{ const {w,d}=x, st=mSteel(), n=x.T.k==='range4'?4:2; box(x,w,.86,d,st,0,0,0,.01); box(x,w,.025,d,mDark(),0,.86,0);
  const P=n===4?[[-1,-1],[1,-1],[-1,1],[1,1]].map(([i,j])=>[i*w/4,j*d/4]):[[-w/4,0],[w/4,0]];
  P.forEach(([px,pz])=>{ cyl(x,.11,.12,.03,mDark(),px,.885,pz,20); cyl(x,.045,.045,.012,mGlow('#4d7cff'),px,.915,pz,16); box(x,.26,.016,.02,mDark(),px,.92,pz); box(x,.02,.016,.26,mDark(),px,.92,pz); });
  for(let i=0;i<n;i++) knob(x,-w/2+(i+.5)*w/n,.78,d/2,mDark()); box(x,w-.08,.42,.01,mSteel(),0,.2,d/2+.002); hbar(x,w-.25,0,.66,d/2+.035); };
B.oven=x=>{ const {w,d}=x; legs4(x,w,d,.3,mSteel(),.04,.04); box(x,w,1.2,d,mSteel(),0,.3,0,.02); box(x,w*.68,.8,.012,mGlass(),-w*.12,.5,d/2+.004); box(x,w*.64,.76,.006,mDark(),-w*.12,.52,d/2-.004); box(x,w*.2,.8,.01,mDark(),w*.36,.5,d/2+.004); for(let i=0;i<3;i++) knob(x,w*.36,1.15-i*.18,d/2+.009,mChrome()); vbar(x,.5,w*.2,.9,d/2+.04); };
B.fryer=x=>{ const {w,d}=x; box(x,w,.86,d,mSteel(),0,0,0,.01); box(x,w-.08,.02,d-.2,mGloss('#c8902a'),0,.85,.02); [-1,1].forEach(i=>{ box(x,w/2-.08,.1,d-.3,mDark(),i*w/4,.8,.02); box(x,.02,.02,.25,mDark(),i*w/4,.9,d/2-.05); }); knob(x,0,.74,d/2,mDark()); };
B.grill=x=>{ const {w,d}=x; box(x,w,.84,d,mSteel(),0,0,0,.01); box(x,w-.08,.01,d-.1,mGlow('#ff6a2a'),0,.84,0); for(let i=0;i<Math.round(w/.05);i++) box(x,.012,.02,d-.1,mDark(),-w/2+.06+i*(w-.12)/Math.max(1,Math.round(w/.05)-1),.86,0); for(let i=0;i<3;i++) knob(x,-w/3+i*w/3,.74,d/2,mDark()); };
function steelTable(x,ht){ const {w,d}=x; box(x,w,.04,d,mSteel(),0,ht-.04,0); box(x,w,.12,.02,mSteel(),0,ht,-d/2+.01); box(x,w-.06,.02,d-.06,mSteel(),0,.18,0); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>cyl(x,.02,.02,ht-.04,mSteel(),i*(w/2-.04),0,j*(d/2-.04),10)); }
B.prep=x=>{ steelTable(x,.9); const r=rng(x.seed); box(x,.45,.02,.3,mWood('#d8b98a'),-x.w/4,.9,.05,.005); sph(x,.04,mGloss('#c8322a'),-x.w/4+.12,.95,.05); sph(x,.045,mGloss('#8b4d8f'),-x.w/4-.1,.955,.12); box(x,.32,.08,.22,mSteel(),x.w/5,.9,0,.02); };
B.pass=x=>{ steelTable(x,1.0); const {w,d}=x; [-1,1].forEach(i=>vbar(x,.55,i*(w/2-.05),1.28,0,mSteel())); box(x,w,.03,d*.6,mSteel(),0,1.55,0); for(let i=0;i<3;i++) cyl(x,.05,.06,.08,mLamp('#ff7b3a'),-w/3+i*w/3,1.47,0,16); for(let i=0;i<3;i++) cyl(x,.12,.1,.015,mCer(),-w/3+i*w/3,1.0,.05,20); };
B.sink2=x=>{ steelTable(x,.9); const {w,d}=x; [-1,1].forEach(i=>box(x,w/2-.18,.006,d-.26,mPaint('#6f777e'),i*w/4,.9,.04)); vbar(x,.36,0,1.08,-d/2+.06); const a=M(gTor(.11,.012,Math.PI),mChrome()); a.position.set(0,1.26,-d/2+.17); a.rotation.y=Math.PI/2; x.g.add(a); };
B.dish=x=>{ const {w,d}=x; box(x,w,.86,d,mSteel(),0,0,0,.01); box(x,w,.62,d,mSteel(),0,.88,0,.02); seam(x,w-.04,.004,0,.87,d/2+.002); hbar(x,w-.2,0,1.2,d/2+.035); box(x,.12,.05,.01,mGlow('#5cf08a'),w/2-.12,1.42,d/2+.001); };
B.fridge=x=>{ const {w,d}=x; legs4(x,w,d,.05,mDark(),.05,.04); box(x,w,1.9,d,mSteel(),0,.05,0,.02); seam(x,.006,1.7,0,.12,d/2+.002); [-1,1].forEach(i=>vbar(x,.5,i*.05,1.2,d/2+.03)); box(x,w,.08,d,mDark(),0,1.95,0); box(x,.1,.04,.01,mGlow('#7fd3ff'),-w/4,1.75,d/2+.001); };
B.freezer=B.dfreezer=x=>{ const {w,d}=x; box(x,w,.82,d,mGloss('#eef0f1'),0,0,0,.03); box(x,w,.08,d,mGloss('#f6f7f8'),0,.82,0,.03); seam(x,w-.06,.004,0,.815,d/2+.001); hbar(x,.4,0,.78,d/2+.03,mDark()); };
B.coldroom=x=>{ const {w,d}=x, p=mPaint('#eef2f4'); box(x,w,2.4,d,p,0,0,0,.02); for(let i=1;i<Math.round(w/.6);i++) seam(x,.004,2.36,-w/2+i*w/Math.round(w/.6),.02,d/2+.002);
  box(x,.9,2.0,.04,mSteel(),w/4,0,d/2+.02); hbar(x,.5,w/4-.32,1.05,d/2+.07,mDark()); box(x,.8,.35,.5,mPaint('#f4f6f7'),-w/4,2.4,0,.02); const f=cyl(x,.14,.14,.02,mDark(),-w/4,2.75,0,20); };
B.hood=x=>{ const {w,d}=x, me=M(gHood(),mSteel()); me.scale.set(w,.5,d); me.position.set(0,.25,0); x.g.add(me); box(x,w*.92,.012,d*.88,mDark(),0,0,0); box(x,.35,.42,.35,mSteel(),0,.5,0); [-1,1].forEach(i=>cyl(x,.04,.04,.01,mLamp('#fff2d6'),i*w/4,.0,0,14)); };
function shelves(x,H,levels,fill){ const {w,d}=x, st=mSteel(); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>box(x,.03,H,.03,st,i*(w/2-.015),0,j*(d/2-.015)));
  const r=rng(x.seed); levels.forEach((y,li)=>{ box(x,w,.02,d,st,0,y,0); if(fill&&li<levels.length-1) fill(y+.02,r,(levels[li+1]||H)-y-.06); }); }
B.rack=x=>shelves(x,1.8,[.15,.6,1.05,1.5,1.78],(y,r,gap)=>{ const {w,d}=x; let px=-w/2+.06; while(px<w/2-.15){ const bw=.12+r()*.22, bh=Math.min(gap,.1+r()*.25), k=r(); if(k<.45) box(x,bw,bh,d*.7,mPaint(['#c9a26b','#b8945e','#d6b47c'][(r()*3)|0]),px+bw/2,y,0,.01); else if(k<.75) cyl(x,bw/2*.8,bw/2*.8,bh,mSteel(),px+bw/2,y,0,18); else box(x,bw,bh,d*.6,mGloss(['#f2f2f2','#e9e3d2','#d9e6ef'][(r()*3)|0]),px+bw/2,y,0,.02); px+=bw+.03; } });
B.srack=x=>shelves(x,2,[.15,.65,1.15,1.65,1.98],(y,r,gap)=>{ const {w,d}=x; let px=-w/2+.05; while(px<w/2-.2){ const bw=.25+r()*.2, bh=Math.min(gap,.18+r()*.2); if(r()<.5) box(x,bw,bh,d*.8,mFab('#d8cdb0'),px+bw/2,y,0,.06); else box(x,bw,bh,d*.75,mPaint('#c39d66'),px+bw/2,y,0,.01); px+=bw+.03; } });
B.linen=x=>shelves(x,2,[.12,.6,1.08,1.56,1.98],(y,r,gap)=>{ const {w,d}=x; let px=-w/2+.06; while(px<w/2-.2){ const bw=.3, n=2+((r()*3)|0); for(let k=0;k<n;k++) box(x,bw,.07,d*.75,mFab(['#ffffff','#f3efe6','#e7edf1'][(r()*3)|0]),px+bw/2,y+k*.075,0,.03); px+=bw+.04; } });
B.mixer=x=>{ const {w,d}=x; steelTable(x,.6); box(x,.22,.16,.22,mPaint('#3a3d42'),0,.6,0,.02); cyl(x,.07,.06,.24,mGlass(),0,.76,0,18); cyl(x,.072,.072,.03,mDark(),0,1.0,0,18); };
B.juice=x=>{ const {w,d}=x, m=body(x,c=>mPaint(c),'#d9b65a'); box(x,w,.95,d,m,0,0,0,.01); box(x,w+.03,.04,d+.03,mWood('#c9a074'),0,.95,0,.005);
  const r=rng(x.seed), C=['#f08a1c','#f2c230','#7dbb3a','#d8312a']; for(let i=0;i<3;i++){ const px=-w/2+.3+i*.32; cyl(x,.13,.1,.06,mWood('#9a7448'),px,.99,-d/4,16); for(let k=0;k<5;k++) sph(x,.04,mGloss(C[(i+k)%4]),px+(r()-.5)*.12,1.07+r()*.03,-d/4+(r()-.5)*.12,12); }
  box(x,.12,.12,.12,mDark(),w/2-.25,.99,-d/4,.02); cyl(x,.05,.045,.2,mGlass(),w/2-.25,1.11,-d/4,14); box(x,w*.45,.32,d*.55,mGlass(),w/6,.99,.05); };
B.pallet=x=>{ const {w,d}=x, wd=mWood('#c9a36e'); [-1,0,1].forEach(i=>box(x,w,.08,.1,wd,0,.02,i*(d/2-.05))); for(let i=0;i<5;i++) box(x,.12,.022,d,wd,-w/2+.06+i*(w-.12)/4,.1,0);
  const sk=mFab('#d8cdb0'); for(let l=0;l<2;l++) for(let i=0;i<2;i++) for(let j=0;j<2;j++){ const s=box(x,w/2-.04,.17,d/2-.06,sk,(i-.5)*w/2,.125+l*.17,(j-.5)*d/2,.07); s.rotation.y=(l%2?.03:-.03); } };
B.scale=x=>{ const {w,d}=x; box(x,w,.08,d,mSteel(),0,0,0,.01); vbar(x,.7,0,.43,-d/2+.04,mSteel()); box(x,.26,.15,.06,mDark(),0,.78,-d/2+.06,.01); box(x,.18,.05,.004,mGlow('#5cf08a'),0,.83,-d/2+.091); };
B.gas=x=>{ const {w,d}=x, nx=Math.max(1,Math.floor(w/.34)), nz=Math.max(1,Math.floor(d/.34)), red=mGloss('#c0392b');
  for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){ const px=-w/2+(i+.5)*w/nx, pz=-d/2+(j+.5)*d/nz; cyl(x,.15,.15,.08,mDark(),px,0,pz,20); cyl(x,.15,.15,.82,red,px,.06,pz,24); const top=M(gSph(.15,20,10,Math.PI/2),red); top.position.set(px,.88,pz); x.g.add(top); cyl(x,.025,.03,.1,mChrome(),px,1.0,pz,10); cyl(x,.09,.09,.08,mDark(),px,.98,pz,14); } };
B.trolley=x=>{ const {w,d}=x; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>{ const wh=M(gCyl(.05,.05,.03,14),mDark()); wh.rotation.z=Math.PI/2; wh.position.set(i*(w/2-.08),.05,j*(d/2-.08)); x.g.add(wh); });
  box(x,w,.03,d,mPaint('#3c6b55'),0,.1,0); box(x,w,.03,d,mPaint('#3c6b55'),0,.55,0); [-1,1].forEach(i=>[-1,1].forEach(j=>vbar(x,.9,i*(w/2-.03),.55,j*(d/2-.03),mSteel())));
  cyl(x,.14,.12,.3,mGloss('#f2c230'),-w/4,.13,0,18); box(x,.3,.35,.3,mPaint('#7a8590'),w/4,.13,0,.03); vbar(x,1.0,-w/4,.6,0,mWood('#c9a074')); box(x,w*.9,.25,d*.8,mFab('#ffffff'),0,.58,0,.04); };
B.washer=B.dryer=x=>{ const {w,d}=x; box(x,w,.85,d,mGloss('#f6f6f4'),0,0,0,.03); box(x,w-.04,.1,.01,mPaint('#e4e4e2'),0,.72,d/2+.002); knob(x,w/4,.77,d/2,mChrome());
  const r=M(gTor(.17,.025),mChrome()); r.position.set(0,.42,d/2+.01); x.g.add(r); const gl=M(gCyl(.16,.16,.01,28),x.T.k==='washer'?mGlass():mPaint('#33373c')); gl.rotation.x=Math.PI/2; gl.position.set(0,.42,d/2+.006); x.g.add(gl); };
B.iron=x=>{ const {w,d}=x; const b=box(x,w,.03,d,mFab('#c9d6e0'),0,.86,0,.015); [-1,1].forEach(i=>{ const l=box(x,.025,1.0,.025,mSteel(),i*w/6,0,0); l.rotation.z=i*.45; l.position.y=.45; }); box(x,.24,.12,.12,mGloss('#3a7bd5'),w/3,.89,0,.04); };
B.mop=x=>{ const {w,d}=x; box(x,w,.4,d,mCer(),0,0,0,.04); box(x,w-.1,.004,d-.1,mGloss('#cfd8dc'),0,.4,0); vbar(x,.3,0,.75,-d/2+.04); const st=vbar(x,1.3,w/2-.05,.7,-d/2+.08,mWood('#c9a074')); st.rotation.z=.15; box(x,.3,.06,.12,mFab('#e5e1d6'),w/2-.12,.03,-d/2+.12,.02); };
B.bins=x=>{ const {w,d}=x, n=Math.max(1,Math.floor(w/.36)), C=['#3d7a52','#2f6aa8','#7c8287'], bw=w/n-.04;
  for(let i=0;i<n;i++){ const px=-w/2+(i+.5)*w/n; box(x,bw,.88,d,mGloss(C[i%3]),px,.04,0,.04); box(x,bw+.02,.05,d+.03,mGloss(C[i%3]),px,.92,0,.02); [-1,1].forEach(j=>{ const wh=M(gCyl(.04,.04,.03,12),mDark()); wh.rotation.z=Math.PI/2; wh.position.set(px+j*(bw/2-.05),.04,-d/2+.06); x.g.add(wh); }); } };
B.recep=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#8c6e52'); box(x,w,.06,d-.08,mDark(),0,0,-.02); box(x,w,1.0,d,m,0,.06,0,.01);
  box(x,w+.04,.04,d*.42,mMarble(),0,1.06,d/2-d*.21,.005); box(x,w-.06,.03,d*.55,mGloss('#f1efea'),0,.74,-d/2+d*.3); box(x,w*.36,.24,.01,mGloss('#c9a35a'),0,.62,d/2+.006,.004);
  box(x,w-.04,.015,.01,mGlow('#ffcf8a'),0,1.0,d/2+.006); const s=box(x,.5,.3,.03,mDark(),-w/4,.92,-d/2+.22,.006); box(x,.47,.27,.004,mScreen(),-w/4,.935,-d/2+.237); box(x,.1,.15,.08,mDark(),-w/4,.77,-d/2+.22); };
B.ctable=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#b49272'); box(x,w,.04,d,m,0,.41,0,.01); box(x,w-.08,.02,d-.08,m,0,.12,0); legs4(x,w,d,.41,mPaint('#2b2b2c'),.04,.03); cyl(x,.05,.04,.16,mCer(),-w/4,.45,0,16); box(x,.22,.03,.16,mPaint('#7a2f2f'),w/5,.45,0,.003); box(x,.2,.025,.15,mPaint('#2f4f7a'),w/5,.48,.01,.003); };
B.lift=x=>{ const {w,d}=x; box(x,w,2.6,d,mPaint('#9aa3aa'),0,0,0,.01); const dw=Math.min(1.0,w-.4); box(x,dw+.16,2.2,.03,mDark(),0,0,d/2+.01); [-1,1].forEach(i=>box(x,dw/2-.005,2.1,.02,mSteel(),i*dw/4,0,d/2+.03)); box(x,.08,.16,.01,mDark(),dw/2+.2,1.05,d/2+.006); cyl(x,.02,.02,.01,mGlow('#ffb347'),dw/2+.2,1.1,d/2+.012,12); box(x,.3,.09,.01,mGlow('#ff4d4d'),0,2.26,d/2+.006); };
B.stairs=x=>{ const {w,d}=x, n=Math.max(5,Math.round(d/.28)), rise=Math.min(.18,3/n), tr=d/n, st=mPaint('#cfc8ba'), no=mPaint('#8d867a');
  for(let i=0;i<n;i++){ const z=d/2-(i+.5)*tr; box(x,w,rise*(i+1),tr,st,0,0,z); box(x,w,.012,.04,no,0,rise*(i+1)-.006,z+tr/2-.02); }
  [-1,1].forEach(s=>{ const px=s*(w/2-.04); for(let i=0;i<n;i+=3) vbar(x,.9,px,rise*(i+1)+.45,d/2-(i+.5)*tr,mChrome()); const L=Math.hypot(d-tr,rise*(n-1)), r=M(gCyl(.02,.02,L,10),mWood('#6b4a32')); r.position.set(px,(rise+rise*n)/2+.9,0); r.rotation.x=Math.atan2(-(d-tr),rise*(n-1)); x.g.add(r); }); };
B.locker=x=>{ const {w,d}=x, m=body(x,c=>mPaint(c),'#9aa3aa'), cols=Math.max(1,Math.round(w/.4)), rows=3; box(x,w,1.9,d,m,0,0,0,.01);
  for(let i=0;i<=cols;i++) seam(x,.006,1.86,-w/2+i*w/cols,.02,d/2+.002); for(let j=1;j<rows;j++) seam(x,w-.02,.006,0,j*1.9/rows,d/2+.002);
  for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const px=-w/2+(i+.5)*w/cols, py=(j+.5)*1.9/rows; knob(x,px+w/cols/2-.06,py,d/2,mChrome()); for(let k=0;k<3;k++) seam(x,w/cols*.5,.008,px,py+.18+k*.03,d/2+.003); } };
B.bench=x=>{ const {w,d}=x, m=body(x,c=>mWood(c),'#b49272'); for(let i=0;i<4;i++) box(x,w,.03,d/4-.015,m,0,.41,-d/2+(i+.5)*d/4,.006); [-1,1].forEach(i=>{ box(x,.04,.41,d-.04,mPaint('#2b2b2c'),i*(w/2-.12),0,0); }); };
/* round things (w = d = diameter here; the caller stretches when resized) */
const BR={};
function roundTable(x,n){ const r=x.w/2, m=body(x,c=>mWood(c),'#9a6a3c'); cyl(x,r,r,.04,m,0,.71,0,40); cyl(x,r*.9,r*.9,.06,m,0,.65,0,40); cyl(x,.06,.07,.62,mWood('#4a3424'),0,.03,0,16); cyl(x,.3,.32,.03,mDark(),0,0,0,24);
  const P=[]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; P.push([Math.cos(a)*(r-.17),Math.sin(a)*(r-.17),a+Math.PI/2]); } plates(x,P,.75); }
BR.tr4=x=>roundTable(x,4); BR.tr8=x=>roundTable(x,8);
BR.plant=x=>{ const r=x.w/2, pot=mClay('#b5653d'); cyl(x,r*.62,r*.46,.42,pot,0,0,0,24); cyl(x,r*.58,r*.58,.02,mPaint('#3a2a1e'),0,.4,0,20); cyl(x,.02,.025,.5,mWood('#5a4030'),0,.4,0,8);
  const rr=rng(x.seed), G=['#4f8a43','#5d9a4c','#3f7a3a','#6aa856']; for(let i=0;i<9;i++){ const a=rr()*Math.PI*2, d=rr()*r*.5, s=.12+rr()*.14; const me=M(gIco(s),mLeaf(G[i%4])); me.position.set(Math.cos(a)*d,.62+rr()*.5,Math.sin(a)*d); me.rotation.set(rr()*3,rr()*3,0); x.g.add(me); } };
BR.tandoor=x=>{ const r=x.w/2, clay=mClay('#a5633f'), H=.95; cyl(x,r*.72,r,H,clay,0,0,0,32); [.25,.7].forEach(t=>{ const rad=r-(r-r*.72)*t+.008; cyl(x,rad,rad,.05,mSteel(),0,H*t-.025,0,32); }); cyl(x,r*.5,r*.5,.01,mDark(),0,H,0,28); cyl(x,r*.58,r*.58,.03,mSteel(),r*.35,H+.004,r*.35,24); };
BR.mandi=x=>{ const r=x.w/2; cyl(x,r,r,.9,mClay('#8a5a3c'),0,0,0,36); cyl(x,r+.01,r+.01,.05,mSteel(),0,.86,0,36); const dome=M(gSph(r*.97,32,12,Math.PI/2),mSteel()); dome.position.set(0,.9,0); dome.scale.y=.45; x.g.add(dome);
  cyl(x,.06,.06,.8,mSteel(),r*.45,1.1,0,12); cyl(x,.1,.1,.03,mDark(),r*.45,1.9,0,14); box(x,.3,.25,.03,mDark(),0,.2,r+.005,.01); knob(x,0,1.3,0,mDark()); };
BR.geyser=x=>{ const r=x.w/2*.9; cyl(x,r,r,.55,mGloss('#f2f2f0'),0,0,0,28); const c=M(gSph(r,24,8,Math.PI/2),mGloss('#f2f2f0')); c.position.y=.55; c.scale.y=.25; x.g.add(c); vbar(x,.3,-r*.4,-.15,0); vbar(x,.3,r*.4,-.15,0); box(x,.08,.05,.01,mGlow('#ff4d4d'),0,.3,r+.002); };
BR.water=x=>{ const r=x.w/2, m=body(x,c=>mGloss(c),'#2b2f33'), H=1.4; cyl(x,r,r*.96,H,m,0,0,0,40); for(let i=1;i<5;i++) cyl(x,r+.01,r+.01,.04,m,0,i*H/5,0,40); const t=M(gSph(r,32,10,Math.PI/2),m); t.position.y=H; t.scale.y=.25; x.g.add(t); cyl(x,r*.3,r*.3,.08,m,0,H+r*.2,0,24); };
function boxDefault(x){ box(x,x.w,x.T.ht||.8,x.d,body(x,c=>mPaint(c),x.T.c||'#bbbbbb'),0,0,0,.02); }
function roundDefault(x){ cyl(x,x.w/2,x.w/2,x.T.ht||.8,body(x,c=>mPaint(c),x.T.c||'#bbbbbb'),0,0,0,32); }

/* build one object: {t, w, h(depth), c (colour), fin (finish), ht (height), shape, id} at the origin, on the floor.
   Its parts are merged per material (a chair = 2 draw calls, not 9) and kept: 48 identical dining chairs share one copy. */
const MERGED=new Map(), SEEDED=new Set(['rack','srack','linen','plant','juice']);
function raw(o,T,w,d,round){ const g=new THREE.Group(), x={g,w,d,col:o.c||null,fin:o.fin||'auto',seed:hash(o.id||o.t),T:Object.assign({k:o.t},T)};
  if(round){ const m=Math.min(w,d); x.w=x.d=m; (BR[o.t]||roundDefault)(x); } else (B[o.t]||boxDefault)(x); return g; }
function mergeParts(g){ const by=new Map(); g.children.forEach(ch=>{ if(!ch.isMesh) return; ch.updateMatrix(); let gg=ch.geometry.clone(); gg.applyMatrix4(ch.matrix); if(gg.index) gg=gg.toNonIndexed(); ['uv1','uv2'].forEach(a=>gg.deleteAttribute&&gg.deleteAttribute(a)); const k=ch.material.uuid; (by.get(k)||by.set(k,{mat:ch.material,list:[]}).get(k)).list.push(gg); });
  const out=[]; by.forEach(({mat,list})=>{ let geo=null; try{ geo=list.length>1?mergeGeometries(list,false):list[0]; }catch(e){ geo=null; } if(geo){ geo.computeBoundingSphere(); out.push({geo,mat}); list.forEach(x=>{ if(x!==geo) x.dispose(); }); } else list.forEach(x=>out.push({geo:x,mat})); }); return out; }
export function build(o,T){ const w=Math.max(.05,o.w||T.w), d=Math.max(.05,o.h||T.d), round=o.shape==='round'||T.shape==='round', m=Math.min(w,d);
  const key=[o.t,round?r2(m):r2(w)+'x'+r2(d),o.c||'',o.fin||'',round?1:0,SEEDED.has(o.t)?hash(o.id):''].join('|');
  let parts=MERGED.get(key); if(!parts){ parts=mergeParts(raw(o,T,w,d,round)); MERGED.set(key,parts); }
  const G=new THREE.Group(); parts.forEach(({geo,mat})=>G.add(M(geo,mat)));
  if(round&&Math.abs(w-d)>.005){ G.scale.x=w/m; G.scale.z=d/m; }
  const H0=T.ht||.8; if(o.ht&&o.ht>0&&Math.abs(o.ht-H0)>.005) G.scale.y=o.ht/H0;
  return G; }
const r2=v=>Math.round(v*1000)/1000;
/* soft contact shadow under a thing (cheap ambient occlusion) */
export function blob(w,d,round){ const m=mk('blob',()=>new THREE.MeshBasicMaterial({map:blobTex(),color:0x000000,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  const p=new THREE.Mesh(geo('blobp',()=>{ const g=new THREE.PlaneGeometry(1,1); g.rotateX(-Math.PI/2); return g; }),m); p.scale.set(w+.35,1,d+.35); p.position.y=.008; p.renderOrder=1; p.userData.blob=true; return p; }
export const HAS=k=>!!(B[k]||BR[k]);
