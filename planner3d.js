/* Hayat · Space planner · 3D view (three.js r160, bundled in assets/three). Loaded only when 3D is opened.
   Floors coloured by space type, walls built from every space outline with gaps for doors (lintel above) and
   windows (sill + lintel), simple real-size objects. Drag = turn, pinch / wheel = zoom, two fingers = move.
   Plan x → 3D x, plan y → 3D z, height → 3D y. */
import * as THREE from './assets/three/three.module.min.js';
import { OrbitControls } from './assets/three/OrbitControls.js';
let R=null;   /* {renderer, scene, camera, controls, el, raf, low, all} */
const H_WALL=2.8, H_LOW=1.1, T=0.12, DOOR_H=2.1, SILL=0.9, WIN_TOP=2.1, FLOOR_GAP=3.2;
const mats={}; function mat(c,o){ const k=c+'|'+(o||1); if(!mats[k]) mats[k]=new THREE.MeshStandardMaterial({color:c,roughness:.85,metalness:.02,transparent:(o||1)<1,opacity:o||1}); return mats[k]; }
function box(w,h,d,c,x,y,z,ry,o){ const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.01,w),Math.max(.01,h),Math.max(.01,d)),mat(c,o)); m.position.set(x,y,z); if(ry) m.rotation.y=ry; return m; }
function cyl(rx,h,c,x,y,z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rx,rx,h,28),mat(c)); m.position.set(x,y,z); return m; }
function ui(el){ if(el.querySelector('.p3ui')) return; const d=document.createElement('div'); d.className='p3ui'; d.style.cssText='position:absolute;left:10px;top:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:3';
  d.innerHTML='<button class="chip" data-v="low">Low walls</button><button class="chip" data-v="all">All floors</button><button class="chip" data-v="top">Top view</button><span class="chip" style="background:transparent;border:0;color:var(--muted)">drag = turn · pinch = zoom</span>'; el.appendChild(d);
  d.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ const v=b.dataset.v; if(v==='top'){ topView(); return; } R[v]=!R[v]; b.classList.toggle('on',R[v]); build(); }); }
function topView(){ if(!R) return; const c=R.center; R.camera.position.set(c.x,c.y+Math.max(18,R.size*1.1),c.z+.01); R.controls.target.copy(c); R.controls.update(); }
export function pause(){ if(R&&R.raf){ cancelAnimationFrame(R.raf); R.raf=0; } }
let LAST=null;
export function show(el,P,FL,H){ LAST={P,FL,H};
  if(!R){ const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#ece7dc'); const camera=new THREE.PerspectiveCamera(45,1,.1,800);
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a8070,1.05)); const sun=new THREE.DirectionalLight(0xffffff,1.25); sun.position.set(20,40,15); scene.add(sun); const fill=new THREE.DirectionalLight(0xffffff,.35); fill.position.set(-20,18,-25); scene.add(fill);
    const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=Math.PI*.495; controls.screenSpacePanning=true;
    R={renderer,scene,camera,controls,el,raf:0,low:false,all:false,group:null,center:new THREE.Vector3(),size:20};
    new ResizeObserver(()=>size()).observe(el); ui(el); }
  size(); build(H.reset); if(!R.raf) loop(); }
function size(){ if(!R) return; const w=R.el.clientWidth||300, h=R.el.clientHeight||300; R.renderer.setSize(w,h,false); R.camera.aspect=w/h; R.camera.updateProjectionMatrix(); }
function loop(){ R.raf=requestAnimationFrame(loop); R.controls.update(); R.renderer.render(R.scene,R.camera); }
function build(reset){ const {P,FL,H}=LAST; if(R.group){ R.scene.remove(R.group); R.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
  const G=new THREE.Group(); R.group=G; R.scene.add(G);
  const floorsIdx=R.all?P.floors.map((f,i)=>i):[FL]; let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  floorsIdx.forEach((fi,k)=>{ const f=P.floors[fi], base=R.all?k*FLOOR_GAP:0, wallH=R.low?H_LOW:H_WALL, L=f.items;
    const doorsOn=new Map(); L.filter(i=>i.kind==='door'||i.kind==='window').forEach(o=>{ const q=H.openingPos(o); if(!q) return; (doorsOn.get(o.sp+'|'+o.e)||doorsOn.set(o.sp+'|'+o.e,[]).get(o.sp+'|'+o.e)).push({o,q}); });
    L.filter(i=>i.kind==='space').forEach(s=>{ const t=H.ST[s.type]||H.ST.other, P0=H.worldPts(s);
      P0.forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
      /* floor */
      const sh=new THREE.Shape(P0.map(p=>new THREE.Vector2(p[0],-p[1]))); const fg=new THREE.ShapeGeometry(sh); fg.rotateX(-Math.PI/2); const fm=new THREE.Mesh(fg,mat(t.c)); fm.position.y=base+.005; G.add(fm);
      /* walls: one box per edge, cut at doors (lintel above) and windows (sill + lintel) */
      H.edges(s).forEach(([a,b],ei)=>{ const len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<.05) return; const ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
        const cuts=(doorsOn.get(s.id+'|'+ei)||[]).map(({o})=>({a:Math.max(0,o.t*len-o.w/2),b:Math.min(len,o.t*len+o.w/2),k:o.kind})).sort((p,q)=>p.a-q.a);
        const seg=(u0,u1,y0,y1)=>{ if(u1-u0<.01||y1-y0<.01) return; const um=(u0+u1)/2, cx=a[0]+Math.cos(ang)*um, cz=a[1]+Math.sin(ang)*um; G.add(box(u1-u0,y1-y0,T,'#f4efe6',cx,base+(y0+y1)/2,cz,-ang)); };
        let u=0; cuts.forEach(c=>{ seg(u,c.a,0,wallH); if(c.k==='door'){ if(wallH>DOOR_H) seg(c.a,c.b,DOOR_H,wallH); }
          else { seg(c.a,c.b,0,Math.min(SILL,wallH)); if(wallH>WIN_TOP) seg(c.a,c.b,WIN_TOP,wallH); if(wallH>SILL){ const um=(c.a+c.b)/2; G.add(box(c.b-c.a,Math.min(WIN_TOP,wallH)-SILL,.03,'#9cc8ea',a[0]+Math.cos(ang)*um,base+(SILL+Math.min(WIN_TOP,wallH))/2,a[1]+Math.sin(ang)*um,-ang,.45)); } }
          u=Math.max(u,c.b); }); seg(u,len,0,wallH); }); });
    /* objects */
    L.filter(i=>i.kind==='obj').forEach(o=>{ const T0=H.OBJ[o.t]||{ht:.8,c:'#bbb'}; if(R.low&&(T0.lift||0)>=H_LOW) return;   /* AC, heater: on the wall above a low cut */
      const c=[o.x+o.w/2,o.y+o.h/2], ry=-(o.r||0)*Math.PI/180, lift=T0.lift||0, ht=Math.min(T0.ht||.8,(R.low?H_LOW+.6:9)), col=o.c||T0.c;
      if(o.shape==='round'){ G.add(cyl(Math.min(o.w,o.h)/2,ht,col,c[0],base+lift+ht/2,c[1])); return; }
      const g=new THREE.Group(); g.position.set(c[0],base+lift,c[1]); g.rotation.y=ry; G.add(g);
      if(/^bed/.test(o.t)){ g.add(box(o.w,.32,o.h,'#8a6a4f',0,.16,0)); g.add(box(o.w-.06,.18,o.h-.1,'#f6f2ea',0,.41,.04)); g.add(box(o.w,.9,.08,'#7a5b42',0,.45,-o.h/2+.04)); const two=o.t!=='bed_s'; for(let i=0;i<(two?2:1);i++) g.add(box(two?o.w/2-.15:o.w-.25,.12,.34,'#ffffff',two?(i?1:-1)*o.w/4:0,.56,-o.h/2+.32)); return; }
      if(o.t==='dchair'||o.t==='chair'){ g.add(box(o.w,.06,o.h,col,0,.45,0)); g.add(box(o.w,.5,.06,col,0,.7,-o.h/2+.03)); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>g.add(box(.04,.45,.04,col,i*(o.w/2-.04),.225,j*(o.h/2-.04)))); return; }
      if(/^t\d|^t/.test(o.t)&&/^(t2|t4|t6)$/.test(o.t)){ g.add(box(o.w,.05,o.h,col,0,.73,0)); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j])=>g.add(box(.06,.7,.06,'#5b4027',i*(o.w/2-.08),.35,j*(o.h/2-.08)))); return; }
      if(o.t==='wc'){ g.add(box(o.w,.35,.18,'#f8f8f8',0,.55,-o.h/2+.09)); g.add(cyl(Math.min(o.w,o.h-.18)/2,.42,'#f8f8f8',0,.21,.09)); return; }
      if(o.t==='shower'){ g.add(box(o.w,.04,o.h,'#d8e8ef',0,.02,0)); g.add(box(.02,2,o.h,'#bfe0ec',o.w/2,1,0)); g.add(box(o.w,2,.02,'#bfe0ec',0,1,o.h/2)); return; }
      if(o.t==='stairs'){ const n=Math.max(4,Math.round(o.h/.28)); for(let i=0;i<n;i++) g.add(box(o.w,(i+1)*.17,o.h/n,'#cfc8ba',0,(i+1)*.085,-o.h/2+(i+.5)*o.h/n)); return; }
      if(o.t==='hood'){ g.add(box(o.w,ht,o.h,col,0,ht/2,0)); g.add(box(.3,.9,.3,col,0,ht+.45,0)); return; }
      if(/range|grill|fryer/.test(o.t)){ g.add(box(o.w,ht,o.h,col,0,ht/2,0)); const n=o.t==='range4'?4:o.t==='range2'?2:0; for(let i=0;i<n;i++){ const bx=(n===4?(i%2?1:-1)*o.w/4:(i?1:-1)*o.w/4), bz=n===4?(i<2?-1:1)*o.h/4:0; const bnr=cyl(.11,.03,'#222',bx,ht+.015,bz); g.add(bnr); } return; }
      g.add(box(o.w,ht,o.h,col,0,ht/2,0)); });
  });
  if(!isFinite(x0)){ x0=z0=0; x1=z1=10; }
  R.center.set((x0+x1)/2,0,(z0+z1)/2); R.size=Math.max(x1-x0,z1-z0,6);
  if(reset){ const asp=Math.max(.35,R.camera.aspect||1), fov=R.camera.fov*Math.PI/180, need=(R.size/2)/Math.tan(fov/2)/Math.min(1,asp)*1.05, d=need/1.25; R.camera.position.set(R.center.x+d*.45,d*.9+(R.all?floorsIdx.length*FLOOR_GAP:0),R.center.z+d*.75); R.controls.target.copy(R.center); R.controls.update(); }
}
