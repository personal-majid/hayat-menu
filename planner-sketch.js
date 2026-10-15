/* Hayat · Space planner · plan from a paper sketch (v280, Majid 14 Oct 2026)
   Photo of a hand drawing → plan, on the phone, free, nothing leaves the device.
   1 Photo  2 Straighten (drag 4 corners, perspective is undone)  3 Rooms (found by the walls: every closed
   area of the drawing is a room; written names / sizes are read with the bundled Tesseract)  4 Size (one real
   length sets the scale; a size written in a room is offered)  5 Finish (what is still missing: what each room
   is, doors, windows, room numbers) → spaces on the plan, the photo stays faded underneath to check against.
   Loaded only when opened (import('./planner-sketch.js')). Exports open(H) and, for tests, detect / demoSketch. */

const ROOMW=/\b(bed ?room|bedroom|room|br|guest|gr)\b/i, NAMES=[
 [/\bsuite\b/i,'suite'],[/\b(bath|toilet|wc|w\.c|washroom|restroom|t\/b|bathroom)\b/i,'bath'],[/\b(wash|basin)\b/i,'wash'],[/\b(kitchen|kit|cook)\b/i,'kitchen'],
 [/\b(store|storage|stock|godown)\b/i,'store'],[/\b(dining|restaurant|rest|hall|cafe|eat)\b/i,'restaurant'],[/\b(lobby|foyer|entrance|entry)\b/i,'lobby'],[/\b(reception|recep|front desk)\b/i,'reception'],
 [/\b(corridor|passage|path|walk|lobby corridor)\b/i,'corridor'],[/\b(stair|stairs|lift|elevator)\b/i,'stairs'],[/\b(office|admin|manager)\b/i,'office'],[/\b(laundry|linen)\b/i,'laundry'],
 [/\b(house ?keeping|hk|clean)\b/i,'clean'],[/\b(staff|changing)\b/i,'staff'],[/\b(banquet|party|function)\b/i,'banquet'],[/\b(garden|lawn|yard)\b/i,'garden'],[/\b(parking|car)\b/i,'parking'],[ROOMW,'room']];
const RX_SIZE=/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:'|ft|feet|m|mtr)?\s*[x×X*]\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*('|ft|feet|m|mtr|metre|meter)?/;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), r2=v=>Math.round(v*100)/100;

/* ---------------- image helpers ---------------- */
function toCanvas(img,maxSide){ const s=Math.min(1,maxSide/Math.max(img.width||img.naturalWidth,img.height||img.naturalHeight)), w=Math.round((img.width||img.naturalWidth)*s), h=Math.round((img.height||img.naturalHeight)*s);
  const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); return c; }
/* homography: 4 source corners (TL TR BR BL) → straight W×H picture */
function solve(A,b){ const n=b.length; for(let i=0;i<n;i++){ let p=i; for(let r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r; [A[i],A[p]]=[A[p],A[i]]; [b[i],b[p]]=[b[p],b[i]];
    for(let r=i+1;r<n;r++){ const f=A[r][i]/A[i][i]; for(let c=i;c<n;c++) A[r][c]-=f*A[i][c]; b[r]-=f*b[i]; } }
  const x=new Array(n); for(let i=n-1;i>=0;i--){ let s=b[i]; for(let c=i+1;c<n;c++) s-=A[i][c]*x[c]; x[i]=s/A[i][i]; } return x; }
function homography(dst,src){ const A=[], b=[]; for(let i=0;i<4;i++){ const [u,v]=dst[i], [x,y]=src[i]; A.push([u,v,1,0,0,0,-u*x,-v*x]); b.push(x); A.push([0,0,0,u,v,1,-u*y,-v*y]); b.push(y); } const h=solve(A,b); h.push(1); return h; }
export function warp(cv,Q){ const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]); let W=Math.round(Math.max(d(Q[0],Q[1]),d(Q[3],Q[2]))), H=Math.round(Math.max(d(Q[0],Q[3]),d(Q[1],Q[2])));
  const k=Math.min(1,1600/Math.max(W,H)); W=Math.max(40,Math.round(W*k)); H=Math.max(40,Math.round(H*k));
  const h=homography([[0,0],[W,0],[W,H],[0,H]],Q), S=cv.getContext('2d').getImageData(0,0,cv.width,cv.height), sw=cv.width, sh=cv.height, o=document.createElement('canvas'); o.width=W; o.height=H;
  const g=o.getContext('2d'), D=g.createImageData(W,H);
  for(let v=0;v<H;v++) for(let u=0;u<W;u++){ const z=h[6]*u+h[7]*v+1, x=(h[0]*u+h[1]*v+h[2])/z, y=(h[3]*u+h[4]*v+h[5])/z, xi=x|0, yi=y|0, j=(v*W+u)*4;
    if(xi<0||yi<0||xi>=sw-1||yi>=sh-1){ D.data[j]=D.data[j+1]=D.data[j+2]=255; D.data[j+3]=255; continue; }
    const fx=x-xi, fy=y-yi, i0=(yi*sw+xi)*4, i1=i0+4, i2=i0+sw*4, i3=i2+4;
    for(let c=0;c<3;c++) D.data[j+c]=(S.data[i0+c]*(1-fx)+S.data[i1+c]*fx)*(1-fy)+(S.data[i2+c]*(1-fx)+S.data[i3+c]*fx)*fy; D.data[j+3]=255; }
  g.putImageData(D,0,0); return o; }

/* ---------------- finding the rooms: closed areas between the drawn walls ---------------- */
/* returns {gw,gh,cell,rooms:[{id,px:{x,y,w,h},poly:[[x,y]...] (image px), rect, area, words:[]}], thick} in IMAGE pixels */
export function detect(cv,opt){ opt=opt||{}; const W=cv.width, H=cv.height, img=cv.getContext('2d').getImageData(0,0,W,H).data;
  const cell=Math.max(1,Math.round(Math.max(W,H)/360)), gw=Math.ceil(W/cell), gh=Math.ceil(H/cell), N=gw*gh, mn=new Float32Array(N), mean=new Float32Array(N);
  for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){ let m=255, s=0, n=0; const y1=Math.min(H,(gy+1)*cell), x1=Math.min(W,(gx+1)*cell);
    for(let y=gy*cell;y<y1;y++) for(let x=gx*cell;x<x1;x++){ const i=(y*W+x)*4, v=.3*img[i]+.59*img[i+1]+.11*img[i+2]; if(v<m) m=v; s+=v; n++; } mn[gy*gw+gx]=m; mean[gy*gw+gx]=s/n; }
  /* local paper brightness: wide box blur of the cell means (integral image) */
  const R=Math.max(6,Math.round(Math.max(gw,gh)/22)), I=new Float64Array((gw+1)*(gh+1));
  for(let y=0;y<gh;y++){ let row=0; for(let x=0;x<gw;x++){ row+=mean[y*gw+x]; I[(y+1)*(gw+1)+x+1]=I[y*(gw+1)+x+1]+row; } }
  const ink=new Uint8Array(N), sens=opt.sens||.72;
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ const x0=Math.max(0,x-R), y0=Math.max(0,y-R), x1=Math.min(gw,x+R+1), y1=Math.min(gh,y+R+1), a=(x1-x0)*(y1-y0), bg=(I[y1*(gw+1)+x1]-I[y0*(gw+1)+x1]-I[y1*(gw+1)+x0]+I[y0*(gw+1)+x0])/a;
    const v=mn[y*gw+x]; ink[y*gw+x]=(v<bg*sens&&v<200)?1:0; }
  /* ink blobs: small ones are writing (kept aside for reading), long ones are walls */
  const lab=new Int32Array(N).fill(-1), blobs=[], st=new Int32Array(N);
  for(let s=0;s<N;s++){ if(!ink[s]||lab[s]>=0) continue; let sp=0, n=0, x0=gw, y0=gh, x1=0, y1=0; st[sp++]=s; lab[s]=blobs.length;
    while(sp){ const p=st[--sp], px=p%gw, py=(p/gw)|0; n++; if(px<x0) x0=px; if(px>x1) x1=px; if(py<y0) y0=py; if(py>y1) y1=py;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const qx=px+dx, qy=py+dy; if(qx<0||qy<0||qx>=gw||qy>=gh) continue; const q=qy*gw+qx; if(ink[q]&&lab[q]<0){ lab[q]=blobs.length; st[sp++]=q; } } }
    blobs.push({n,x0,y0,x1,y1}); }
  const wall=new Uint8Array(N), text=[];
  /* walls = the big connected network (+ any long line); words, numbers and little drawings (a bed sketched in a room) are not walls */
  let big=-1; blobs.forEach((b,i)=>{ if(big<0||b.n>blobs[big].n) big=i; }); const longMin=Math.max(gw,gh)*.22;
  blobs.forEach((b,i)=>{ const L=Math.max(b.x1-b.x0+1,b.y1-b.y0+1); b.text=i!==big&&L<longMin; if(b.text&&L>=2) text.push({x:b.x0*cell,y:b.y0*cell,w:(b.x1-b.x0+1)*cell,h:(b.y1-b.y0+1)*cell}); });
  for(let p=0;p<N;p++) if(ink[p]&&!blobs[lab[p]].text) wall[p]=1;
  /* wall thickness (cells): median horizontal run */
  const runs=[]; for(let y=0;y<gh;y+=3){ let r=0; for(let x=0;x<gw;x++){ if(wall[y*gw+x]) r++; else { if(r>0&&r<20) runs.push(r); r=0; } } } runs.sort((a,b)=>a-b); const thick=runs.length?runs[runs.length>>1]:2;
  /* close small gaps (door openings, a pen that lifted) */
  const gap=Math.max(1,Math.round((opt.gap==null?1:opt.gap)*Math.max(2,Math.round(Math.max(gw,gh)/90))));
  let M=wall; for(let k=0;k<gap;k++){ const O=new Uint8Array(N); for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ const p=y*gw+x; if(M[p]||(x>0&&M[p-1])||(x<gw-1&&M[p+1])||(y>0&&M[p-gw])||(y<gh-1&&M[p+gw])) O[p]=1; } M=O; }
  /* outside = everything reachable from the border */
  const seen=new Uint8Array(N); let sp=0; const push=p=>{ if(!M[p]&&!seen[p]){ seen[p]=1; st[sp++]=p; } };
  for(let x=0;x<gw;x++){ push(x); push((gh-1)*gw+x); } for(let y=0;y<gh;y++){ push(y*gw); push(y*gw+gw-1); }
  while(sp){ const p=st[--sp], x=p%gw, y=(p/gw)|0; if(x>0) push(p-1); if(x<gw-1) push(p+1); if(y>0) push(p-gw); if(y<gh-1) push(p+gw); }
  /* rooms = closed areas */
  const comp=new Int32Array(N).fill(-1), rooms=[], minA=N*(opt.minArea||.0025), grow=gap+thick/2;
  for(let s=0;s<N;s++){ if(M[s]||seen[s]||comp[s]>=0) continue; const id=rooms.length; let n=0, x0=gw, y0=gh, x1=0, y1=0; sp=0; st[sp++]=s; comp[s]=id;
    while(sp){ const p=st[--sp], px=p%gw, py=(p/gw)|0; n++; if(px<x0) x0=px; if(px>x1) x1=px; if(py<y0) y0=py; if(py>y1) y1=py;
      const nb=[px>0?p-1:-1,px<gw-1?p+1:-1,py>0?p-gw:-1,py<gh-1?p+gw:-1]; for(const q of nb) if(q>=0&&!M[q]&&!seen[q]&&comp[q]<0){ comp[q]=id; st[sp++]=q; } }
    rooms.push({id,n,x0,y0,x1,y1}); }
  const out=rooms.filter(r=>r.n>=minA).map(r=>{ const bw=r.x1-r.x0+1, bh=r.y1-r.y0+1, fill=r.n/(bw*bh);
    let poly=null; if(fill<.82) poly=outline(comp,gw,gh,r,grow);
    const g=grow; return {id:r.id,area:r.n*cell*cell,fill,rect:!poly,px:{x:(r.x0-g)*cell,y:(r.y0-g)*cell,w:(bw+2*g)*cell,h:(bh+2*g)*cell},poly:poly?poly.map(p=>[p[0]*cell,p[1]*cell]):null,words:[]}; });
  out.sort((a,b)=>(a.px.y-b.px.y)||(a.px.x-b.px.x));
  /* writing inside each room (its ink boxes), for reading later */
  text.forEach(t=>{ const cx=t.x+t.w/2, cy=t.y+t.h/2; const r=out.find(o=>cx>o.px.x&&cx<o.px.x+o.px.w&&cy>o.px.y&&cy<o.px.y+o.px.h&&inPoly([cx,cy],o)); if(r) (r.ink=r.ink||[]).push(t); });
  return {gw,gh,cell,thick:thick*cell,gap:gap*cell,rooms:out,text}; }
function inPoly(pt,r){ if(!r.poly) return true; let c=false; const P=r.poly; for(let i=0,j=P.length-1;i<P.length;j=i++){ const a=P[i], b=P[j]; if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
/* outline of an L / U / odd room: trace its border cells, simplify, square the near-straight edges, push out to the wall centre */
function outline(comp,gw,gh,r,grow){ const id=r.id, at=(x,y)=>x>=0&&y>=0&&x<gw&&y<gh&&comp[y*gw+x]===id;
  let sx=-1, sy=-1; for(let y=r.y0;y<=r.y1&&sx<0;y++) for(let x=r.x0;x<=r.x1;x++) if(at(x,y)){ sx=x; sy=y; break; }
  /* square tracing on cell corners (Moore-ish, walks the outer boundary clockwise) */
  /* walk the cell corners keeping the room on the right (clockwise on screen) */
  const pts=[], DX=[1,0,-1,0], DY=[0,1,0,-1], start=[sx,sy], filled=(cx,cy)=>at(cx,cy); let x=sx, y=sy, dir=0, guard=0; pts.push([x,y]);
  do{ const L=[[x-1,y-1],[x,y-1],[x-1,y],[x,y]];   /* cells around vertex (x,y): TL TR BL BR */
    const tl=filled(x-1,y-1), tr=filled(x,y-1), bl=filled(x-1,y), br=filled(x,y);   /* the 4 cells around vertex (x,y) */
    let nd=-1; const can=d=>{ if(d===0) return  br&&!tr; if(d===1) return bl&&!br; if(d===2) return tl&&!bl; return tr&&!tl; };
    for(const d of [(dir+3)%4,dir,(dir+1)%4,(dir+2)%4]) if(can(d)){ nd=d; break; }
    if(nd<0) break; dir=nd; x+=DX[dir]; y+=DY[dir]; pts.push([x,y]); guard++;
  }while((x!==start[0]||y!==start[1])&&guard<200000);
  pts.pop(); if(pts.length<4) return null;
  let P=rdp(pts,1.6); if(P.length<3) return null;
  /* square edges that are within 15° of level / upright */
  const n=P.length, ortho=[]; for(let i=0;i<n;i++){ const a=P[i], b=P[(i+1)%n], ang=Math.abs(Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI)%180; ortho.push(ang<15||ang>165?'h':Math.abs(ang-90)<15?'v':''); }
  if(ortho.every(Boolean)){ /* all square: merge same-direction runs, then push every edge out by `grow` (clockwise walk: outside = left) */
    const E=[]; for(let i=0;i<n;i++){ const a=P[i], b=P[(i+1)%n], k=ortho[i]; const v=k==='h'?(a[1]+b[1])/2:(a[0]+b[0])/2, s=k==='h'?Math.sign(b[0]-a[0]):Math.sign(b[1]-a[1]); if(E.length&&E[E.length-1].k===k){ const e=E[E.length-1]; e.v=(e.v+v)/2; } else E.push({k,v,s}); }
    if(E.length>1&&E[0].k===E[E.length-1].k){ const e=E.pop(); E[0].v=(E[0].v+e.v)/2; }
    if(E.length<4||E.length%2) return P;
    E.forEach(e=>{ /* outward normal of a clockwise (screen) walk is to the left of the travel direction */ if(e.k==='h') e.v+=e.s>0?-grow:grow; else e.v+=e.s>0?grow:-grow; });
    const V=[]; for(let i=0;i<E.length;i++){ const a=E[i], b=E[(i+1)%E.length]; V.push(a.k==='h'?[b.v,a.v]:[a.v,b.v]); } return V; }
  return P; }
function rdp(P,eps){ if(P.length<3) return P; const d2=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1e-9, t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L,0,1), x=a[0]+t*dx-p[0], y=a[1]+t*dy-p[1]; return x*x+y*y; };
  /* closed: split at the farthest pair */
  let far=0, fi=0; for(let i=1;i<P.length;i++){ const d=(P[i][0]-P[0][0])**2+(P[i][1]-P[0][1])**2; if(d>far){ far=d; fi=i; } }
  const run=(A)=>{ const keep=new Uint8Array(A.length); keep[0]=keep[A.length-1]=1; const S=[[0,A.length-1]];
    while(S.length){ const [i,j]=S.pop(); let m=-1, md=0; for(let k=i+1;k<j;k++){ const d=d2(A[k],A[i],A[j]); if(d>md){ md=d; m=k; } } if(md>eps*eps){ keep[m]=1; S.push([i,m],[m,j]); } }
    return A.filter((p,i)=>keep[i]); };
  const a=run(P.slice(0,fi+1)), b=run(P.slice(fi).concat([P[0]])); return a.slice(0,-1).concat(b.slice(0,-1)); }

/* ---------------- reading names + sizes written in the rooms (bundled Tesseract, free, on the device) ---------------- */
let WK=null;
function loadScript(src){ return new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>no(new Error('could not load '+src)); document.head.appendChild(s); }); }
async function worker(onProg){ if(!window.Tesseract) await loadScript('./assets/ocr/tesseract.min.js');
  if(!WK){ WK=await window.Tesseract.createWorker('eng',1,{workerPath:'./assets/ocr/worker.min.js',corePath:'./assets/ocr/',langPath:'./assets/ocr/',gzip:true,logger:m=>{ if(WK&&WK._prog&&m&&typeof m.progress==='number') WK._prog(m.status||'',m.progress); }});
    await WK.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789x.\'/ '}); }
  WK._prog=onProg; return WK; }
/* only the writing is read: each room's ink boxes are cut out, made black-on-white and enlarged, then read one by one */
function otsu(H,n){ let sum=0; for(let i=0;i<256;i++) sum+=i*H[i]; let sB=0,wB=0,best=0,t=128; for(let i=0;i<256;i++){ wB+=H[i]; if(!wB) continue; const wF=n-wB; if(!wF) break; sB+=i*H[i]; const mB=sB/wB, mF=(sum-sB)/wF, v=wB*wF*(mB-mF)*(mB-mF); if(v>best){ best=v; t=i; } } return t; }
function crop(cv,b){ const hs=b.lh||24, k=clamp(52/hs,1,4), pad=10, x=Math.max(0,b.x-pad), y=Math.max(0,b.y-pad), w=Math.min(cv.width-x,b.w+pad*2), h=Math.min(cv.height-y,b.h+pad*2);
  const c=document.createElement('canvas'); c.width=Math.round(w*k)+40; c.height=Math.round(h*k)+40; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.imageSmoothingQuality='high'; g.drawImage(cv,x,y,w,h,20,20,w*k,h*k);
  const D=g.getImageData(0,0,c.width,c.height), d=D.data, Hh=new Array(256).fill(0); for(let i=0;i<d.length;i+=4){ const v=(.3*d[i]+.59*d[i+1]+.11*d[i+2])|0; d[i]=v; Hh[v]++; } const t=otsu(Hh,d.length/4);
  for(let i=0;i<d.length;i+=4){ const v=d[i]<t?0:255; d[i]=d[i+1]=d[i+2]=v; } g.putImageData(D,0,0); return {c,x,y,k}; }
export async function readWords(cv,rooms,onProg){ const W=await worker(), out=[], todo=rooms.filter(r=>r.ink&&r.ink.length);
  /* the writing of all rooms, line by line (letters of one line overlap in height) */
  const jobs=[]; todo.forEach(r=>{ const I=r.ink.filter(t=>t.w*t.h>30).sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2)), L=[];
    I.forEach(t=>{ const c=t.y+t.h/2, l=L.find(l=>c>l.y&&c<l.y+l.h); if(l){ const x1=Math.max(l.x+l.w,t.x+t.w), y1=Math.max(l.y+l.h,t.y+t.h); l.x=Math.min(l.x,t.x); l.y=Math.min(l.y,t.y); l.w=x1-l.x; l.h=y1-l.y; l.hs.push(t.h); } else L.push({x:t.x,y:t.y,w:t.w,h:t.h,hs:[t.h]}); });
    L.forEach(l=>{ l.hs.sort((a,b)=>a-b); l.lh=l.hs[l.hs.length>>1]; if(l.w>6&&l.h>6) jobs.push(l); }); });
  for(let i=0;i<jobs.length;i++){ const b=jobs[i];
    const C=crop(cv,b); let res=null; try{ res=await W.recognize(C.c); }catch(e){ res=null; }
    if(res&&res.data){ const ws=[]; (res.data.lines||[]).forEach(l=>(l.words||[]).forEach(w=>ws.push(w))); if(!ws.length&&res.data.text) ws.push({text:res.data.text,confidence:50,bbox:{x0:20,y0:20,x1:20+b.w*C.k,y1:20+b.h*C.k}});
      ws.forEach(w=>{ const t=String(w.text||'').trim(); if(!t||w.confidence<30) return; out.push({t,c:w.confidence,x:C.x+(w.bbox.x0-20)/C.k,y:C.y+(w.bbox.y0-20)/C.k,w:(w.bbox.x1-w.bbox.x0)/C.k,h:(w.bbox.y1-w.bbox.y0)/C.k}); }); }
    if(onProg) onProg('recognizing',(i+1)/jobs.length); }
  return out; }
export function assignWords(rooms,words){ rooms.forEach(r=>{ r.words=[]; }); words.forEach(w=>{ const cx=w.x+w.w/2, cy=w.y+w.h/2; const r=rooms.find(o=>cx>o.px.x&&cx<o.px.x+o.px.w&&cy>o.px.y&&cy<o.px.y+o.px.h&&inPoly([cx,cy],o)); if(r) r.words.push(w); });
  rooms.forEach(r=>{ r.words.sort((a,b)=>(a.y-b.y)||(a.x-b.x)); r.text=r.words.map(w=>w.t).join(' '); const g=guessFromText(r.text); r.tType=g.type; r.tNo=g.no; r.tSize=g.size; }); }
export function guessFromText(t){ t=String(t||''); const out={type:null,no:null,size:null}; for(const [re,k] of NAMES) if(re.test(t)){ out.type=k; break; }
  const nm=t.match(/\b([1-9]\d{2})\b/); if(nm&&!RX_SIZE.test(t.slice(Math.max(0,nm.index-3),nm.index+6))){ out.no=nm[1]; if(!out.type) out.type='room'; }
  const s=t.replace(/\d[oO]+|[oO]+\d/g,m=>m.replace(/[oO]/g,'0')).match(RX_SIZE); if(s){ const a=parseFloat(s[1].replace(',','.')), b=parseFloat(s[2].replace(',','.')), ft=/'|ft|feet/.test(s[0]); if(a>0&&b>0&&a<200&&b<200) out.size={a,b,ft}; }
  return out; }
/* a room's type from its size when nothing is written */
function guessBySize(wm,hm){ const A=wm*hm, s=Math.min(wm,hm), l=Math.max(wm,hm); if(s<=2.4&&l/s>=3) return 'corridor'; if(A<=6.5) return 'bath'; return 'room'; }

/* ---------------- an example sketch to try (drawn here, a bit tilted, like a phone photo) ---------------- */
export function demoSketch(){ const W=1400, H=1000, c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  g.fillStyle='#8a7f6e'; g.fillRect(0,0,W,H);   /* table */
  g.save(); g.translate(W/2,H/2); g.rotate(-.035); g.translate(-W/2,H/2*0-H/2);
  const px=110, py=80, pw=1180, ph=840; const pg=g.createLinearGradient(px,py,px+pw,py+ph); pg.addColorStop(0,'#fbf8f0'); pg.addColorStop(1,'#ece6d6'); g.fillStyle=pg; g.fillRect(px,py,pw,ph);
  let seed=7; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const pen=(a,b)=>{ g.beginPath(); const n=14; g.moveTo(a[0]+rnd()*2-1,a[1]+rnd()*2-1); for(let i=1;i<=n;i++){ const t=i/n; g.lineTo(a[0]+(b[0]-a[0])*t+rnd()*2.4-1.2,a[1]+(b[1]-a[1])*t+rnd()*2.4-1.2); } g.stroke(); };
  g.strokeStyle='#1d2a44'; g.lineWidth=4.2; g.lineCap='round';
  /* building 18 m × 12 m drawn at 50 px per metre from (200,170) */
  const S=50, X=v=>200+v*S, Y=v=>170+v*S, L=(x0,y0,x1,y1)=>pen([X(x0),Y(y0)],[X(x1),Y(y1)]);
  L(0,0,18,0); L(18,0,18,12); L(18,12,0,12); L(0,12,0,0);   /* outside */
  L(7,0,7,7); L(0,7,18,7); L(12,7,12,12); L(12,0,12,7); L(15,7,15,12); L(3.5,7,3.5,12);   /* inner walls */
  /* door gaps drawn as arcs (the closing step bridges them) */
  g.lineWidth=2; [[X(7)+.5,Y(5)],[X(12),Y(5)]].forEach(([x,y])=>{ g.beginPath(); g.arc(x,y,40,-Math.PI/2,0); g.stroke(); });
  g.fillStyle='#1d2a44'; g.font='italic 600 34px "Comic Sans MS","Segoe Print",cursive';
  const T=(s,x,y,f)=>{ g.font=(f||'italic 600 34px')+' "Comic Sans MS","Segoe Print",cursive'; g.fillText(s,X(x),Y(y)); };
  T('LOBBY',2.2,3.2); T('7x7',2.6,4.4,'italic 600 30px'); T('DINING',8.4,3.2); T('KITCHEN',13.4,3.2); T('6x7',14.2,4.4,'italic 600 30px');
  T('STORE',.6,9.8,'italic 600 26px'); T('ROOM 101',5.6,9.6); T('BATH',12.6,9.8,'italic 600 26px'); T('ROOM',15.6,9.8,'italic 600 26px');
  g.restore();
  /* soft shadow across the photo */
  const sh=g.createRadialGradient(W*.3,H*.25,100,W*.5,H*.5,W*.75); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,.22)'); g.fillStyle=sh; g.fillRect(0,0,W,H);
  return c; }

/* ---------------- the wizard ---------------- */
const STEPS=['Photo','Straighten','Rooms','Size','Finish'];
let K=null;   /* state: {H, step, src (canvas), Q (4 corners), st (straight canvas), D (detection), words, scale (m per px), unit, rooms:[{...}], opts} */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function css(){ if(document.getElementById('sk-css')) return; const s=document.createElement('style'); s.id='sk-css'; s.textContent=`
#sk{position:fixed;inset:0;z-index:80;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
#sk .skh{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid var(--line);flex-wrap:wrap}
#sk .skh b{font-size:16px} #sk .steps{display:flex;gap:4px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none} #sk .steps span{flex:none;font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:var(--soft2);color:var(--muted)} #sk .steps span.on{background:var(--pri);color:var(--onpri)} #sk .steps span.done{background:color-mix(in srgb,var(--good) 18%,transparent);color:var(--good)}
#sk .skb{flex:1;min-height:0;display:flex;gap:0} #sk .stage{flex:1;min-width:0;position:relative;background:#2b2a27;overflow:hidden;touch-action:none} #sk .stage canvas{position:absolute;left:0;top:0;touch-action:none}
#sk .side{width:360px;max-width:42%;border-left:1px solid var(--line);overflow:auto;padding:12px 14px;background:var(--card)}
#sk .skf{display:flex;gap:8px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);align-items:center;background:var(--card)} #sk .skf .sp{flex:1;font-size:12.5px;color:var(--muted);font-weight:700}
#sk .bt{border:1px solid var(--line2);background:var(--bg);border-radius:11px;padding:10px 14px;font-weight:800;font-size:14px} #sk .bt.pri{background:var(--pri);color:var(--onpri);border-color:var(--pri)} #sk .bt:disabled{opacity:.4}
#sk h3{margin:2px 0 6px;font-size:15px} #sk p{margin:4px 0 8px;font-size:13.5px;color:var(--muted)} #sk .big{display:grid;gap:10px;max-width:520px;margin:6vh auto;padding:0 16px}
#sk .big .bt{padding:18px;font-size:16px;display:flex;align-items:center;gap:12px;justify-content:center} #sk .tips{font-size:13px;color:var(--muted);line-height:1.7;margin-top:6px}
#sk .rl{display:flex;flex-direction:column;gap:8px} #sk .rc{border:1px solid var(--line);border-left:5px solid var(--rc);border-radius:12px;padding:8px 10px;background:var(--bg)} #sk .rc.off{opacity:.45} #sk .rc.on{outline:2px solid var(--sel)}
#sk .rc .hd{display:flex;gap:8px;align-items:center;font-weight:800} #sk .rc .hd i{font-style:normal;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:var(--rc);color:#fff;font-size:12px;flex:none}
#sk .rc .hd label{margin-left:auto;font-size:12px;display:flex;gap:5px;align-items:center;color:var(--muted)} #sk .rc .row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap} #sk .rc select,#sk .rc input,#sk .f input,#sk .f select{font:inherit;font-size:14px;font-weight:600;color:var(--ink);background:var(--card);border:1px solid var(--line2);border-radius:8px;padding:6px 8px;min-width:0}
#sk .rc select{flex:1.4} #sk .rc input{width:70px} #sk .rc .note{font-size:11.5px;color:var(--muted);margin-top:4px} #sk .rc .warn{color:var(--warn);font-weight:800}
#sk .f{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--muted);margin:8px 0}
#sk .chk{display:flex;gap:8px;align-items:center;font-size:13.5px;font-weight:700;padding:6px 0} #sk .chk input{width:17px;height:17px;accent-color:var(--sel)}
#sk .ask{border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin:6px 0;background:var(--bg);font-size:13px} #sk .ask b{display:block;font-size:13.5px} #sk .ask.ok{border-left:4px solid var(--good)} #sk .ask.todo{border-left:4px solid var(--warn)}
#sk .prog{height:6px;border-radius:9px;background:var(--soft2);overflow:hidden;margin:6px 0} #sk .prog i{display:block;height:100%;background:var(--sel);width:0}
#sk .seg2{display:inline-flex;background:var(--soft2);border-radius:9px;padding:2px} #sk .seg2 button{border:0;background:transparent;border-radius:7px;padding:5px 10px;font-weight:800;font-size:12.5px;color:var(--muted)} #sk .seg2 button.on{background:var(--card);color:var(--ink)}
@media (max-width:640px){ #sk .steps span:not(.on){display:none} #sk .skf .sp{display:none} }
@media (max-width:760px){ #sk .skb{flex-direction:column} #sk .side{width:auto;max-width:none;border-left:0;border-top:1px solid var(--line);max-height:48%} #sk .stage{min-height:42%} }`;
  document.head.appendChild(s); }
const COLORS=['#2a78d6','#d9772b','#2f8f5b','#7a4bb0','#c0392b','#1e8a8a','#b7791f','#5a6b7d','#c2185b','#558b2f','#6d4c41','#3949ab'];
export function open(H){ css(); close(); K={H,step:0,unit:'m',opts:{doors:true,wins:true,under:true,start:H.nextRoomNo(),where:H.floorEmpty()?'here':'new'},gap:1};
  const el=document.createElement('div'); el.id='sk'; document.body.appendChild(el); K.el=el; render(); }
export function close(){ const e=document.getElementById('sk'); if(e) e.remove(); }
function shell(body,side,foot){ const s=K.step; K.el.innerHTML=`<div class="skh"><b>📷 Plan from a sketch</b><div class="steps">${STEPS.map((n,i)=>`<span class="${i===s?'on':i<s?'done':''}">${i<s?'✓ ':''}${i+1} ${n}</span>`).join('')}</div><button class="bt" data-sk="x" aria-label="close">✕</button></div>
  <div class="skb">${body}${side?`<aside class="side">${side}</aside>`:''}</div><div class="skf">${foot}</div>`;
  K.el.querySelector('[data-sk="x"]').onclick=()=>{ close(); }; }
function render(){ [stepPhoto,stepStraight,stepRooms,stepSize,stepFinish][K.step](); }
/* 1 · photo */
function stepPhoto(){ shell(`<div style="flex:1;overflow:auto"><div class="big"><h3 style="text-align:center;font-size:19px">Photo of your drawing</h3>
    <button class="bt pri" data-sk="cam">📷 Take a photo</button><button class="bt" data-sk="up">🖼 Upload a picture</button><button class="bt" data-sk="demo" style="padding:12px;font-size:14px">✏️ Try an example sketch</button>
    <div class="tips">✓ Dark pen on white paper, walls drawn as lines<br>✓ The whole drawing in the photo, from above<br>✓ Write names (KITCHEN, ROOM 101) and sizes (4x5) inside rooms if you know them<br>✓ Nothing leaves this phone</div></div>
    <input type="file" accept="image/*" capture="environment" id="skCam" hidden><input type="file" accept="image/*" id="skUp" hidden></div>`,'',`<span class="sp">Step 1 of 5</span>`);
  const pick=f=>{ if(!f) return; const u=URL.createObjectURL(f), im=new Image(); im.onload=()=>{ URL.revokeObjectURL(u); setSrc(toCanvas(im,1800)); }; im.onerror=()=>K.H.toast('That file is not a picture'); im.src=u; };
  K.el.querySelector('[data-sk="cam"]').onclick=()=>K.el.querySelector('#skCam').click(); K.el.querySelector('[data-sk="up"]').onclick=()=>K.el.querySelector('#skUp').click();
  K.el.querySelector('#skCam').onchange=e=>pick(e.target.files[0]); K.el.querySelector('#skUp').onchange=e=>pick(e.target.files[0]);
  K.el.querySelector('[data-sk="demo"]').onclick=()=>{ K.demo=true; setSrc(demoSketch()); }; }
export function setSrc(cv){ K.src=cv; K.Q=paperCorners(cv); K.st=null; K.D=null; K.words=null; K.step=1; render(); }
/* the paper's corners: the bright area that stands out from the table, else the whole photo */
function paperCorners(cv){ const w=cv.width, h=cv.height, d=cv.getContext('2d').getImageData(0,0,w,h).data, step=Math.max(2,Math.round(Math.max(w,h)/300)); let best=[[0,0],[w,0],[w,h],[0,h]];
  const Hh=new Array(256).fill(0); let n=0; for(let y=0;y<h;y+=step) for(let x=0;x<w;x+=step){ const i=(y*w+x)*4; Hh[(.3*d[i]+.59*d[i+1]+.11*d[i+2])|0]++; n++; } const thr=otsu(Hh,n);
  const C=[[Infinity,null],[Infinity,null],[Infinity,null],[Infinity,null]]; let cnt=0;
  for(let y=0;y<h;y+=step) for(let x=0;x<w;x+=step){ const i=(y*w+x)*4, v=.3*d[i]+.59*d[i+1]+.11*d[i+2]; if(v<thr) continue; cnt++;
    const s=[x+y,(w-x)+y,(w-x)+(h-y),x+(h-y)]; for(let k=0;k<4;k++) if(s[k]<C[k][0]) C[k]=[s[k],[x,y]]; }
  if(cnt>n*.25&&cnt<n*.97&&C.every(c=>c[1])){ const Q=C.map(c=>c[1]); const A=Math.abs((Q[1][0]-Q[0][0])*(Q[3][1]-Q[0][1])-(Q[3][0]-Q[0][0])*(Q[1][1]-Q[0][1])); if(A>w*h*.25) best=Q; }
  return best; }
/* 2 · straighten: drag the 4 corners */
function fitStage(cv){ const st=K.el.querySelector('.stage'), r=st.getBoundingClientRect(), s=Math.min((r.width-24)/cv.width,(r.height-24)/cv.height); return {s,ox:(r.width-cv.width*s)/2,oy:(r.height-cv.height*s)/2,W:r.width,H:r.height}; }
function stepStraight(){ shell(`<div class="stage" id="skSt"><canvas id="skC"></canvas></div>`,`<h3>Straighten</h3><p>Drag the 4 round corners onto the corners of the paper (or of the drawing). The picture is squared up, so a photo taken at an angle still gives true sizes.</p><p>Already straight? Tap <b>Skip</b>.</p>`,
   `<button class="bt" data-sk="back">‹ Back</button><span class="sp">Step 2 of 5</span><button class="bt" data-sk="skip">Skip</button><button class="bt pri" data-sk="ok">Straighten ›</button>`);
  const cv=K.el.querySelector('#skC'), g=cv.getContext('2d'); let F=null, drag=-1;
  const draw=()=>{ F=fitStage(K.src); cv.width=F.W; cv.height=F.H; g.fillStyle='#2b2a27'; g.fillRect(0,0,F.W,F.H); g.drawImage(K.src,F.ox,F.oy,K.src.width*F.s,K.src.height*F.s);
    const P=K.Q.map(q=>[F.ox+q[0]*F.s,F.oy+q[1]*F.s]); g.fillStyle='rgba(42,120,214,.12)'; g.strokeStyle='#2a78d6'; g.lineWidth=2.5; g.beginPath(); P.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fill(); g.stroke();
    P.forEach((p,i)=>{ g.beginPath(); g.arc(p[0],p[1],15,0,7); g.fillStyle='#fff'; g.fill(); g.lineWidth=3; g.stroke(); g.fillStyle='#2a78d6'; g.font='800 12px sans-serif'; g.textAlign='center'; g.fillText(['↖','↗','↘','↙'][i],p[0],p[1]+4); }); };
  draw(); new ResizeObserver(()=>draw()).observe(K.el.querySelector('.stage'));
  const at=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left-F.ox)/F.s,(e.clientY-r.top-F.oy)/F.s]; };
  cv.onpointerdown=e=>{ const p=at(e); let b=-1, bd=40/F.s; K.Q.forEach((q,i)=>{ const d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d<bd){ bd=d; b=i; } }); drag=b; if(b>=0) cv.setPointerCapture(e.pointerId); };
  cv.onpointermove=e=>{ if(drag<0) return; const p=at(e); K.Q[drag]=[clamp(p[0],0,K.src.width),clamp(p[1],0,K.src.height)]; draw(); };
  cv.onpointerup=()=>{ drag=-1; };
  K.el.querySelector('[data-sk="back"]').onclick=()=>{ K.step=0; render(); };
  K.el.querySelector('[data-sk="skip"]').onclick=()=>{ K.st=K.src; K.Q=[[0,0],[K.src.width,0],[K.src.width,K.src.height],[0,K.src.height]]; findRooms(); };
  K.el.querySelector('[data-sk="ok"]').onclick=()=>{ K.st=warp(K.src,K.Q); findRooms(); }; }
/* 3 · rooms */
function findRooms(){ K.D=detect(K.st,{gap:K.gap}); const prev=K.rooms||[]; K.rooms=K.D.rooms.map((r,i)=>({...r,n:i+1,on:true,type:null,name:'',no:'',col:COLORS[i%COLORS.length]}));
  if(K.words) assignWords(K.rooms,K.words); K.rooms.forEach(applyText); K.step=2; K.sel=null; render(); if(!K.words&&!K.reading) readAll(); }
function applyText(r){ if(r.tType&&!r.type) r.type=r.tType; if(r.tNo&&!r.no) r.no=r.tNo; }
async function readAll(){ K.reading=true; K.readP=0; const upd=()=>{ const b=K.el&&K.el.querySelector('#skRead'); if(b) b.innerHTML=K.reading?`<p>📖 Reading the writing… ${Math.round(K.readP*100)}%</p><div class="prog"><i style="width:${Math.round(K.readP*100)}%"></i></div>`:(K.words?`<p>📖 Read ${K.words.length} word${K.words.length===1?'':'s'} from the drawing.</p>`:'<p>📖 Could not read the writing on this device — set names below.</p>'); };
  upd(); try{ K.words=await readWords(K.st,K.rooms,(s,p)=>{ if(/recogni/i.test(s)){ K.readP=p; upd(); } }); assignWords(K.rooms,K.words); K.rooms.forEach(applyText); }catch(e){ K.words=null; }
  K.reading=false; if(K.step===2) render(); else if(K.step===3) render(); }
function stageDraw(cv,F,opt){ const g=cv.getContext('2d'); cv.width=F.W; cv.height=F.H; g.fillStyle='#2b2a27'; g.fillRect(0,0,F.W,F.H); g.drawImage(K.st,F.ox,F.oy,K.st.width*F.s,K.st.height*F.s);
  K.rooms.forEach(r=>{ const P=r.poly||[[r.px.x,r.px.y],[r.px.x+r.px.w,r.px.y],[r.px.x+r.px.w,r.px.y+r.px.h],[r.px.x,r.px.y+r.px.h]];
    g.beginPath(); P.forEach((p,i)=>{ const x=F.ox+p[0]*F.s, y=F.oy+p[1]*F.s; i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath();
    g.fillStyle=r.on?r.col+'38':'rgba(0,0,0,.25)'; g.fill(); g.strokeStyle=r.on?r.col:'#777'; g.lineWidth=K.sel===r.n?4:2.2; g.setLineDash(r.on?[]:[6,5]); g.stroke(); g.setLineDash([]);
    const cx=F.ox+(r.px.x+r.px.w/2)*F.s, cy=F.oy+(r.px.y+r.px.h/2)*F.s; g.beginPath(); g.arc(cx,cy,13,0,7); g.fillStyle=r.on?r.col:'#777'; g.fill(); g.fillStyle='#fff'; g.font='800 13px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(r.n,cx,cy+.5); });
  if(opt&&opt.dim){ const B=allBox(); if(B){ const y=F.oy+(B[1]-K.st.height*.03)*F.s, x0=F.ox+B[0]*F.s, x1=F.ox+B[2]*F.s; g.strokeStyle='#ffb347'; g.lineWidth=3; g.setLineDash([10,6]); g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.stroke(); g.setLineDash([]);
    [x0,x1].forEach(x=>{ g.beginPath(); g.moveTo(x,y-10); g.lineTo(x,y+10); g.stroke(); }); g.fillStyle='#ffb347'; g.font='800 15px sans-serif'; g.textAlign='center'; g.fillText(K.scale?r2((B[2]-B[0])*K.scale)+' '+'m':'? m',(x0+x1)/2,y-14); } }
  if(opt&&opt.pts) opt.pts.forEach((p,i)=>{ const x=F.ox+p[0]*F.s, y=F.oy+p[1]*F.s; g.beginPath(); g.arc(x,y,9,0,7); g.fillStyle='#ffb347'; g.fill(); if(i){ const q=opt.pts[0]; g.strokeStyle='#ffb347'; g.lineWidth=3; g.beginPath(); g.moveTo(F.ox+q[0]*F.s,F.oy+q[1]*F.s); g.lineTo(x,y); g.stroke(); } }); }
function allBox(){ const L=K.rooms.filter(r=>r.on); if(!L.length) return null; return [Math.min(...L.map(r=>r.px.x)),Math.min(...L.map(r=>r.px.y)),Math.max(...L.map(r=>r.px.x+r.px.w)),Math.max(...L.map(r=>r.px.y+r.px.h))]; }
function stepRooms(){ const n=K.rooms.filter(r=>r.on).length;
  shell(`<div class="stage"><canvas id="skC"></canvas></div>`,`<h3>${K.rooms.length?`Found ${K.rooms.length} room${K.rooms.length===1?'':'s'}`:'No closed rooms found'}</h3>
    <p>${K.rooms.length?'Tap a room on the picture to leave it out (or back in). Two rooms joined into one? Use <b>Closer look</b>.':'Walls must meet. Try <b>Wider gaps</b>, or go back and straighten again.'}</p>
    <div class="f">Door gaps in the drawing<div class="seg2">${[[.5,'Closer look'],[1,'Normal'],[2,'Wider gaps']].map(([v,l])=>`<button data-gap="${v}" class="${K.gap===v?'on':''}">${l}</button>`).join('')}</div></div>
    <div id="skRead"></div>`,
    `<button class="bt" data-sk="back">‹ Back</button><span class="sp">${n} room${n===1?'':'s'} kept</span><button class="bt pri" data-sk="ok" ${n?'':'disabled'}>Next · sizes ›</button>`);
  const cv=K.el.querySelector('#skC'); let F=null; const draw=()=>{ F=fitStage(K.st); stageDraw(cv,F); }; draw(); new ResizeObserver(()=>draw()).observe(K.el.querySelector('.stage'));
  cv.onclick=e=>{ const r0=cv.getBoundingClientRect(), x=(e.clientX-r0.left-F.ox)/F.s, y=(e.clientY-r0.top-F.oy)/F.s; const r=K.rooms.slice().reverse().find(o=>x>o.px.x&&x<o.px.x+o.px.w&&y>o.px.y&&y<o.px.y+o.px.h&&inPoly([x,y],o)); if(r){ r.on=!r.on; render(); } };
  K.el.querySelectorAll('[data-gap]').forEach(b=>b.onclick=()=>{ K.gap=+b.dataset.gap; findRooms(); });
  K.el.querySelector('[data-sk="back"]').onclick=()=>{ K.step=1; render(); }; K.el.querySelector('[data-sk="ok"]').onclick=()=>{ K.step=3; if(!K.scale) suggestScale(); render(); };
  const rb=K.el.querySelector('#skRead'); if(rb) rb.innerHTML=K.reading?'<p>📖 Reading the writing…</p><div class="prog"><i></i></div>':(K.words?`<p>📖 Read ${K.words.length} word${K.words.length===1?'':'s'} from the drawing.</p>`:''); }
/* 4 · size: one real length sets the scale */
function suggestScale(){ const S=[]; K.rooms.filter(r=>r.on&&r.tSize).forEach(r=>{ const {a,b,ft}=r.tSize, k=ft?.3048:1, pw=r.px.w-K.D.thick, ph=r.px.h-K.D.thick, long=Math.max(a,b)*k, short=Math.min(a,b)*k;
    const [L,Sh]=pw>=ph?[pw,ph]:[ph,pw]; S.push((long/L+short/Sh)/2); if(ft) K.unit='ft'; });
  if(S.length){ S.sort((a,b)=>a-b); K.scale=S[S.length>>1]; K.scaleFrom='size written in '+(S.length===1?'a room':S.length+' rooms'); } }
function stepSize(){ const B=allBox(), wpx=B?B[2]-B[0]:0, ft=K.unit==='ft', k=ft?3.28084:1, cur=K.scale?r2(wpx*K.scale*k):'';
  shell(`<div class="stage"><canvas id="skC"></canvas></div>`,`<h3>How wide is the building?</h3><p>The orange dashed line goes across the whole drawing. Type its real length — everything else is sized from it.</p>
    ${K.scaleFrom?`<div class="ask ok"><b>✓ Worked out from the ${esc(K.scaleFrom)}</b>Check the number, change it if it's wrong.</div>`:''}
    <div class="f">Whole width<div style="display:flex;gap:6px;align-items:center"><input id="skW" type="number" inputmode="decimal" step="0.1" min="1" placeholder="e.g. 18" value="${cur}" style="flex:1;font-size:18px"><div class="seg2"><button data-u="m" class="${ft?'':'on'}">m</button><button data-u="ft" class="${ft?'on':''}">ft</button></div></div></div>
    <p>Or measure one wall: <button class="bt" data-sk="two" style="padding:6px 10px;font-size:12.5px">📏 Tap two points</button></p><div id="skTwo"></div>
    ${B?`<div class="ask ok" id="skSum">${K.scale?`<b>Building · ${r2(wpx*K.scale*k)} × ${r2((B[3]-B[1])*K.scale*k)} ${ft?'ft':'m'}</b>${K.rooms.filter(r=>r.on).length} rooms · about ${Math.round(K.rooms.filter(r=>r.on).reduce((n,r)=>n+r.area*K.scale*K.scale,0))} m²`:'<b>Type the width above</b>'}</div>`:''}`,
    `<button class="bt" data-sk="back">‹ Back</button><span class="sp">Step 4 of 5</span><button class="bt pri" data-sk="ok" ${K.scale?'':'disabled'}>Next · finish ›</button>`);
  const cv=K.el.querySelector('#skC'); let F=null, two=null; const draw=()=>{ F=fitStage(K.st); stageDraw(cv,F,{dim:!two,pts:two}); }; draw(); new ResizeObserver(()=>draw()).observe(K.el.querySelector('.stage'));
  const inp=K.el.querySelector('#skW'); inp.oninput=()=>{ const v=parseFloat(inp.value); if(v>0&&wpx>0){ K.scale=v/(ft?3.28084:1)/wpx; K.scaleFrom=''; } else K.scale=null; K.el.querySelector('[data-sk="ok"]').disabled=!K.scale; const sm=K.el.querySelector('#skSum'); if(sm&&K.scale&&B) sm.innerHTML=`<b>Building · ${r2(wpx*K.scale*k)} × ${r2((B[3]-B[1])*K.scale*k)} ${ft?'ft':'m'}</b>${K.rooms.filter(r=>r.on).length} rooms · about ${Math.round(K.rooms.filter(r=>r.on).reduce((n,r)=>n+r.area*K.scale*K.scale,0))} m²`; draw(); };
  K.el.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{ K.unit=b.dataset.u; render(); });
  K.el.querySelector('[data-sk="two"]').onclick=()=>{ two=[]; K.el.querySelector('#skTwo').innerHTML='<p><b>Tap the two ends of a wall you know.</b></p>'; draw(); };
  cv.onclick=e=>{ if(!two) return; const r0=cv.getBoundingClientRect(); two.push([(e.clientX-r0.left-F.ox)/F.s,(e.clientY-r0.top-F.oy)/F.s]); draw();
    if(two.length===2){ const px=Math.hypot(two[1][0]-two[0][0],two[1][1]-two[0][1]); K.el.querySelector('#skTwo').innerHTML=`<div class="f">That wall is<div style="display:flex;gap:6px"><input id="skL" type="number" inputmode="decimal" step="0.1" placeholder="${ft?'ft':'m'}" style="flex:1;font-size:18px"><button class="bt pri" id="skLok">Use</button></div></div>`;
      const L=K.el.querySelector('#skL'); L.focus(); K.el.querySelector('#skLok').onclick=()=>{ const v=parseFloat(L.value); if(v>0&&px>4){ K.scale=v/(ft?3.28084:1)/px; K.scaleFrom='wall you measured'; render(); } }; } };
  K.el.querySelector('[data-sk="back"]').onclick=()=>{ K.step=2; render(); }; K.el.querySelector('[data-sk="ok"]').onclick=()=>{ if(K.scale){ K.step=4; render(); } }; }
/* 5 · finish: what each room is + what is still missing */
function plan(){ /* rooms in metres, walls lined up */ const s=K.scale, B=allBox(), M=1, L=K.rooms.filter(r=>r.on);
  const R=L.map(r=>{ const x=(r.px.x-B[0])*s+M, y=(r.px.y-B[1])*s+M, w=r.px.w*s, h=r.px.h*s; return {r,x,y,w,h,poly:r.poly?r.poly.map(p=>[(p[0]-B[0])*s+M,(p[1]-B[1])*s+M]):null}; });
  /* walls that are almost the same line become exactly one line (rooms side by side share a wall) */
  const tol=Math.max(.25,K.D.thick*s*1.5), snapAxis=(vals)=>{ const S=vals.slice().sort((a,b)=>a.v-b.v), groups=[]; S.forEach(o=>{ const g=groups[groups.length-1]; if(g&&o.v-g.at(-1).v<=tol) g.push(o); else groups.push([o]); });
    groups.forEach(g=>{ const m=Math.round(g.reduce((n,o)=>n+o.v,0)/g.length*20)/20; g.forEach(o=>o.set(m)); }); };
  const xs=[], ys=[]; R.forEach(q=>{ if(q.poly){ q.poly.forEach(p=>{ xs.push({v:p[0],set:m=>p[0]=m}); ys.push({v:p[1],set:m=>p[1]=m}); }); return; } const o={x0:q.x,x1:q.x+q.w,y0:q.y,y1:q.y+q.h}; q.o=o;
    xs.push({v:o.x0,set:m=>o.x0=m},{v:o.x1,set:m=>o.x1=m}); ys.push({v:o.y0,set:m=>o.y0=m},{v:o.y1,set:m=>o.y1=m}); });
  snapAxis(xs); snapAxis(ys);
  R.forEach(q=>{ if(q.o){ q.x=q.o.x0; q.y=q.o.y0; q.w=Math.max(.5,q.o.x1-q.o.x0); q.h=Math.max(.5,q.o.y1-q.o.y0); } else { const xx=q.poly.map(p=>p[0]), yy=q.poly.map(p=>p[1]); q.x=Math.min(...xx); q.y=Math.min(...yy); q.w=Math.max(...xx)-q.x; q.h=Math.max(...yy)-q.y; }
    if(q.r.wm) q.w=q.r.wm; if(q.r.hm) q.h=q.r.hm; q.r.W=r2(q.w); q.r.Hh=r2(q.h); });
  return {R,B,s,M}; }
function stepFinish(){ const {R}=plan(), ST=K.H.ST, types=K.H.STYPES;
  R.forEach(q=>{ if(!q.r.type){ q.r.gType=guessBySize(q.w,q.h); } });
  const untyped=R.filter(q=>!q.r.type).length, guests=R.filter(q=>(ST[q.r.type||q.r.gType]||{}).guest).length;
  const asks=[[!untyped,untyped?`${untyped} room${untyped>1?'s':''}: what is it?`:'Every room has a type','Pick it in the list — a guess by size is filled in'],
    [true,'Sizes from the scale',`Change a room's width / depth below if you know it exactly`],
    [K.opts.doors,K.opts.doors?'A door is added to every room':'No doors yet','Placed on the wall it shares with the biggest next space · move them later'],
    [K.opts.wins,K.opts.wins?'Windows on outside walls':'No windows yet','Guest rooms, dining, lobby, kitchen, office'],
    [!guests||!!K.opts.start,guests?`${guests} guest room${guests>1?'s':''} numbered from ${K.opts.start}`:'No guest rooms','Room numbers written on the drawing are kept']];
  shell(`<div class="stage"><canvas id="skC"></canvas></div>`,`<h3>Almost done · what's missing</h3>${asks.map(a=>`<div class="ask ${a[0]?'ok':'todo'}"><b>${a[0]?'✓':'?'} ${esc(a[1])}</b>${esc(a[2])}</div>`).join('')}
    <label class="chk"><input type="checkbox" data-o="doors"${K.opts.doors?' checked':''}>Add a door to each room</label><label class="chk"><input type="checkbox" data-o="wins"${K.opts.wins?' checked':''}>Add windows on outside walls</label><label class="chk"><input type="checkbox" data-o="under"${K.opts.under?' checked':''}>Keep the photo faded under the plan</label>
    <div class="f">First guest room number<input data-o="start" value="${esc(K.opts.start)}" inputmode="numeric" style="font-size:16px"></div>
    <div class="f">Put it on<select data-o="where">${K.H.floorEmpty()?'<option value="here"'+(K.opts.where==='here'?' selected':'')+'>This floor ('+esc(K.H.floorName())+', empty)</option>':''}<option value="new"${K.opts.where==='new'?' selected':''}>A new floor</option><option value="replace"${K.opts.where==='replace'?' selected':''}>Replace ${esc(K.H.floorName())}</option></select></div>
    <p class="ph" style="font-weight:800;color:var(--ink);margin-top:12px">Rooms</p><div class="rl">${R.map(q=>{ const r=q.r, t=r.type||r.gType;
      return `<div class="rc${K.sel===r.n?' on':''}" style="--rc:${r.col}" data-rc="${r.n}"><div class="hd"><i>${r.n}</i><span>${esc(r.text?('“'+r.text.slice(0,28)+'”'):'Room '+r.n)}</span></div>
      <div class="row"><select data-k="type">${types.map(s=>`<option value="${s[0]}"${s[0]===t?' selected':''}>${esc(s[1])}</option>`).join('')}</select>${(ST[t]||{}).guest?`<input data-k="no" value="${esc(r.no||'')}" placeholder="no." style="width:62px">`:`<input data-k="name" value="${esc(r.name||'')}" placeholder="name" style="width:96px">`}</div>
      <div class="row"><input data-k="wm" type="number" step="0.1" value="${r2(q.w)}" title="width m"> × <input data-k="hm" type="number" step="0.1" value="${r2(q.h)}" title="depth m"> m</div>
      ${r.type?'':`<div class="note warn">Guessed by size · check it</div>`}</div>`; }).join('')}</div>`,
    `<button class="bt" data-sk="back">‹ Back</button><span class="sp">${R.length} rooms · ready</span><button class="bt pri" data-sk="make">✓ Make the plan</button>`);
  const cv=K.el.querySelector('#skC'); let F=null; const draw=()=>{ F=fitStage(K.st); stageDraw(cv,F); }; draw(); new ResizeObserver(()=>draw()).observe(K.el.querySelector('.stage'));
  cv.onclick=e=>{ const r0=cv.getBoundingClientRect(), x=(e.clientX-r0.left-F.ox)/F.s, y=(e.clientY-r0.top-F.oy)/F.s; const r=K.rooms.find(o=>o.on&&x>o.px.x&&x<o.px.x+o.px.w&&y>o.px.y&&y<o.px.y+o.px.h&&inPoly([x,y],o)); if(r){ K.sel=r.n; render(); const c=K.el.querySelector(`[data-rc="${r.n}"]`); if(c) c.scrollIntoView({block:'nearest'}); } };
  K.el.querySelectorAll('[data-o]').forEach(i=>i.onchange=()=>{ const k=i.dataset.o; K.opts[k]=i.type==='checkbox'?i.checked:i.value.trim(); render(); });
  K.el.querySelectorAll('[data-rc]').forEach(c=>{ const r=K.rooms.find(o=>o.n===+c.dataset.rc); c.querySelectorAll('[data-k]').forEach(i=>i.onchange=()=>{ const k=i.dataset.k; if(k==='type'){ r.type=i.value; } else if(k==='wm'||k==='hm'){ const v=parseFloat(i.value); if(v>0) r[k]=v; } else r[k]=i.value.trim().slice(0,40); render(); }); });
  K.el.querySelector('[data-sk="back"]').onclick=()=>{ K.step=3; render(); }; K.el.querySelector('[data-sk="make"]').onclick=make; }
/* make the spaces, doors, windows (+ the faded photo) on the plan */
function make(){ const {R,B,s,M}=plan(), H=K.H, ST=H.ST, out=[], uid=H.uid; let no=parseInt(K.opts.start,10)||H.nextRoomNo(); const used=H.usedNos();
  R.forEach(q=>{ const r=q.r, t=r.type||r.gType||'room', n=String(r.no||'').trim(); if((ST[t]||{}).guest&&n&&!used.has(n)){ used.add(n); r._keep=n; } });
  R.forEach(q=>{ const r=q.r, t=r.type||r.gType||'room', sp={id:uid(),kind:'space',type:t,shape:q.poly?'poly':'rect',x:r2(q.x),y:r2(q.y),w:r2(Math.max(.5,q.w)),h:r2(Math.max(.5,q.h)),r:0};
    if(q.poly) sp.pts=q.poly.map(p=>[r2((p[0]-q.x)/Math.max(.01,q.w)),r2((p[1]-q.y)/Math.max(.01,q.h))]);
    if((ST[t]||{}).guest){ let n=r._keep||''; if(!n){ while(used.has(String(no))) no++; n=String(no++); used.add(n); } delete r._keep; sp.no=n; sp.cat=t==='suite'?'Suite':'Standard'; sp.beds='1 king'; sp.guests=2; sp.rate=t==='suite'?4500:2500; }
    else if(r.name) sp.name=r.name; else { const nm=String(r.text||'').replace(RX_SIZE,'').replace(/\s+/g,' ').trim(); if(nm&&nm.length<24&&/[a-z]{3}/i.test(nm)) sp.name=nm.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); }
    q.sp=sp; out.push(sp); });
  /* doors + windows on rectangles: edges 0 top · 1 right · 2 bottom · 3 left */
  const rects=R.filter(q=>q.sp.shape==='rect'), EDGE=(q,e)=>{ const x0=q.sp.x, y0=q.sp.y, x1=x0+q.sp.w, y1=y0+q.sp.h; return [[x0,y0,x1,y0],[x1,y0,x1,y1],[x0,y1,x1,y1],[x0,y0,x0,y1]][e]; };
  const shared=(a,ea,b)=>{ const A=EDGE(a,ea); for(let eb=0;eb<4;eb++){ if((eb+2)%4!==ea) continue; const Bq=EDGE(b,eb); const horiz=ea%2===0; if(horiz){ if(Math.abs(A[1]-Bq[1])>.15) continue; const lo=Math.max(A[0],Bq[0]), hi=Math.min(A[2],Bq[2]); if(hi-lo>.8) return {lo,hi,len:A[2]-A[0],start:A[0]}; } else { if(Math.abs(A[0]-Bq[0])>.15) continue; const lo=Math.max(A[1],Bq[1]), hi=Math.min(A[3],Bq[3]); if(hi-lo>.8) return {lo,hi,len:A[3]-A[1],start:A[1]}; } } return null; };
  rects.forEach(q=>{ const t=q.sp.type; let best=null;
    for(let e=0;e<4;e++) rects.forEach(o=>{ if(o===q) return; const sh=shared(q,e,o); if(!sh) return; const A=o.sp.w*o.sp.h, pref=/corridor|lobby|restaurant|reception/.test(o.sp.type)?1e4:0, v=pref+A+(sh.hi-sh.lo); if(!best||v>best.v) best={v,e,sh,o}; });
    if(K.opts.doors&&!/garden|parking/.test(t)&&best){ const w=Math.min(/lobby|restaurant|banquet/.test(t)?1.4:t==='bath'?.75:.9,(best.sh.hi-best.sh.lo)*.8), mid=(best.sh.lo+best.sh.hi)/2, tt=clamp((mid-best.sh.start)/best.sh.len,.1,.9); out.push({id:uid(),kind:'door',sp:q.sp.id,e:best.e,t:r2(tt),w:r2(w),side:1}); }
    if(K.opts.wins&&((ST[t]||{}).guest||/restaurant|lobby|kitchen|office|banquet/.test(t))){ for(let e=0;e<4;e++){ const touching=rects.some(o=>o!==q&&shared(q,e,o)); if(touching) continue; const len=e%2?q.sp.h:q.sp.w; if(len<1.6) continue; out.push({id:uid(),kind:'window',sp:q.sp.id,e,t:.5,w:r2(Math.min(2.4,len*.4))}); if(!/restaurant|banquet|lobby/.test(t)) break; } } });
  let under=null; if(K.opts.under){ const c=document.createElement('canvas'), k=Math.min(1,1100/Math.max(K.st.width,K.st.height)); c.width=Math.round(K.st.width*k); c.height=Math.round(K.st.height*k); c.getContext('2d').drawImage(K.st,0,0,c.width,c.height);
    under={src:c.toDataURL('image/jpeg',.6),x:r2(M-B[0]*s),y:r2(M-B[1]*s),w:r2(K.st.width*s),h:r2(K.st.height*s),op:.35}; }
  H.create(out,under,K.opts.where); close(); }
export const _test={plan:()=>plan(),get K(){ return K; },findRooms,make};
