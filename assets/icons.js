/* ============================================================
   HAYAT — DISH ILLUSTRATIONS
   Vector artwork used for every menu item that has no photo yet.
   Crisp at any size, works offline, ~0 KB to load.

   You do not need to edit this file. To replace an illustration
   with a real photo, set  img:"photos/whatever.jpg"  on the item
   in menu-data.js — the photo wins automatically.
   ============================================================ */
(function(){

const P = {
  plate:"#E8DFC8", plateDk:"#BFB093",
  rice:"#EBD9A8", riceDk:"#D2B877",
  meat:"#8E4A22", meatDk:"#6B3416", meatLt:"#B4652F",
  char:"#4A2A16",
  bowl:"#2E4E63", bowlDk:"#1E3648", bowlLt:"#456E88",
  clay:"#8A4B2A", clayDk:"#63321A",
  bread:"#E3C98F", breadDk:"#C4A566",
  glass:"rgba(255,255,255,.20)", glassEdge:"rgba(255,255,255,.42)",
  green:"#79B54A", cream:"#F6EFDD", choc:"#5A3620"
};

/* rounded warm backdrop shared by every icon */
function bg(a,b){
  return `<defs>
    <linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".28" r=".72">
      <stop offset="0" stop-color="rgba(255,225,170,.16)"/>
      <stop offset="1" stop-color="rgba(255,225,170,0)"/></radialGradient>
  </defs>
  <rect x="-60" y="-10" width="220" height="120" fill="url(#bgg)"/>
  <rect x="-60" y="-10" width="220" height="120" fill="url(#glow)"/>`;
}
const plate = (y=72)=>`<ellipse cx="50" cy="${y}" rx="36" ry="10" fill="${P.plateDk}"/>
  <ellipse cx="50" cy="${y-2}" rx="36" ry="10" fill="${P.plate}"/>`;
const bowlShape=(c,d)=>`<path d="M16 50 h68 a34 34 0 0 1 -68 0 z" fill="${d}"/>
  <path d="M18 52 h64 a32 30 0 0 1 -64 0 z" fill="${c}"/>
  <ellipse cx="50" cy="50" rx="34" ry="7" fill="${d}"/>
  <ellipse cx="50" cy="49" rx="31" ry="5.5" fill="rgba(0,0,0,.28)"/>`;
const tallGlass=(liquid,extra="")=>`
  <path d="M32 22 h36 l-4 56 a6 6 0 0 1 -6 5 h-16 a6 6 0 0 1 -6 -5 z" fill="${P.glass}"/>
  <path d="M34.5 34 h31 l-3.3 43 a4 4 0 0 1 -4 3.5 h-16.4 a4 4 0 0 1 -4 -3.5 z" fill="${liquid}"/>
  ${extra}
  <path d="M32 22 h36 l-4 56 a6 6 0 0 1 -6 5 h-16 a6 6 0 0 1 -6 -5 z"
    fill="none" stroke="${P.glassEdge}" stroke-width="2.2"/>
  <ellipse cx="50" cy="22" rx="18" ry="4.5" fill="rgba(255,255,255,.28)"/>`;
const straw=(c="#E8556B")=>`<rect x="56" y="8" width="5" height="26" rx="2.5" fill="${c}"
  transform="rotate(12 58 20)"/>`;
const mint=`<ellipse cx="38" cy="24" rx="8" ry="5" fill="${P.green}" transform="rotate(-25 38 24)"/>
  <ellipse cx="47" cy="20" rx="7" ry="4.5" fill="#8FD05C" transform="rotate(15 47 20)"/>`;
const steam=`<g stroke="rgba(255,255,255,.35)" stroke-width="2.6" stroke-linecap="round" fill="none">
  <path d="M40 34 q4 -6 0 -12"/><path d="M50 31 q4 -7 0 -14"/><path d="M60 34 q4 -6 0 -12"/></g>`;

const I = {

/* ---- rice & mandi ---- */
mandi:()=>`${bg("#3E2A14","#6B4520")}${plate()}
  <ellipse cx="50" cy="58" rx="30" ry="15" fill="${P.riceDk}"/>
  <ellipse cx="50" cy="55" rx="28" ry="13" fill="${P.rice}"/>
  <ellipse cx="44" cy="46" rx="15" ry="11" fill="${P.meatDk}"/>
  <ellipse cx="44" cy="44" rx="14" ry="10" fill="${P.meat}"/>
  <ellipse cx="40" cy="41" rx="6" ry="4" fill="${P.meatLt}"/>
  <ellipse cx="66" cy="52" rx="9" ry="7" fill="${P.meatDk}"/>
  <ellipse cx="66" cy="51" rx="8" ry="6" fill="${P.meat}"/>
  <circle cx="30" cy="56" r="2.6" fill="#C6512F"/><circle cx="72" cy="61" r="2.2" fill="#7CA83F"/>`,

/* ---- grilled / alfaham / shawaya ---- */
grill:(tint)=>`${bg("#3A2412","#63381A")}
  <g stroke="${P.char}" stroke-width="4" stroke-linecap="round">
    <path d="M16 74 h68"/><path d="M16 66 h68"/></g>
  <ellipse cx="36" cy="56" rx="17" ry="13" fill="${P.meatDk}"/>
  <ellipse cx="36" cy="54" rx="16" ry="12" fill="${tint||P.meat}"/>
  <ellipse cx="31" cy="49" rx="6.5" ry="4.5" fill="rgba(255,255,255,.20)"/>
  <ellipse cx="66" cy="60" rx="13" ry="10" fill="${P.meatDk}"/>
  <ellipse cx="66" cy="58" rx="12" ry="9" fill="${tint||P.meatLt}"/>
  <path d="M50 30 q7 7 3 14 q9 -4 8 -14 q6 8 2 18 q-9 6 -18 0 q-4 -12 5 -18 z" fill="#E2892C"/>
  <path d="M52 36 q4 5 1 9 q5 -3 4 -9 q3 5 1 11 q-6 4 -11 0 q-2 -7 5 -11 z" fill="#F5C245"/>`,

/* ---- fried ---- */
broast:()=>`${bg("#3F2A12","#6E4A18")}${plate(76)}
  <g>
   <path d="M30 66 q-9 -6 -6 -16 q3 -11 14 -10 q11 1 11 12 q0 9 -8 13 z" fill="#C98A34"/>
   <path d="M32 62 q-6 -5 -4 -12 q3 -8 10 -7 q8 1 8 9 q0 7 -6 10 z" fill="#E6AC4E"/>
   <path d="M28 66 q-3 8 3 10 q7 2 8 -5" fill="#F0EADA"/>
  </g>
  <g transform="translate(28,6)">
   <path d="M46 64 q-9 -6 -6 -16 q3 -11 14 -10 q11 1 11 12 q0 9 -8 13 z" fill="#C98A34"/>
   <path d="M48 60 q-6 -5 -4 -12 q3 -8 10 -7 q8 1 8 9 q0 7 -6 10 z" fill="#E6AC4E"/>
  </g>
  <ellipse cx="52" cy="42" rx="13" ry="10" fill="#D89A3E"/>
  <ellipse cx="52" cy="40" rx="11" ry="8" fill="#EFB958"/>`,

/* ---- wok tossed / dragon ---- */
wok:()=>`${bg("#4A1C14","#7A2E1C")}${bowlShape("#3A2418","#241309")}
  <circle cx="40" cy="58" r="7" fill="#C4381F"/><circle cx="55" cy="62" r="6.5" fill="#E0512C"/>
  <circle cx="65" cy="56" r="5.5" fill="#A82C18"/><circle cx="48" cy="68" r="5" fill="#D14526"/>
  <path d="M28 54 q10 -5 18 -1" stroke="#7CA83F" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <path d="M60 68 q8 -4 13 -1" stroke="#7CA83F" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="34" cy="66" r="3" fill="#F0C24A"/>`,

/* ---- gravy ---- */
curry:(tint)=>`${bg("#43290F","#70481B")}${bowlShape(P.clay,P.clayDk)}
  <ellipse cx="50" cy="50" rx="29" ry="5" fill="${tint||"#C9622A"}"/>
  <ellipse cx="50" cy="49.5" rx="26" ry="4.2" fill="${tint||"#E07B36"}"/>
  <circle cx="42" cy="49" r="3.4" fill="rgba(0,0,0,.22)"/>
  <circle cx="58" cy="50" r="2.8" fill="rgba(0,0,0,.18)"/>
  <path d="M36 47 q14 -4 28 1" stroke="rgba(255,255,255,.45)" stroke-width="2.2" fill="none"/>
  ${steam}`,

/* ---- bread ---- */
bread:()=>`${bg("#43300F","#6E5220")}
  <ellipse cx="50" cy="70" rx="34" ry="12" fill="${P.breadDk}"/>
  <ellipse cx="50" cy="66" rx="34" ry="12" fill="${P.bread}"/>
  <ellipse cx="50" cy="58" rx="30" ry="11" fill="${P.breadDk}"/>
  <ellipse cx="50" cy="55" rx="30" ry="11" fill="#EFD9A4"/>
  <ellipse cx="50" cy="47" rx="26" ry="9.5" fill="${P.breadDk}"/>
  <ellipse cx="50" cy="44" rx="26" ry="9.5" fill="#F5E3B8"/>
  <g fill="#A9803F"><circle cx="42" cy="43" r="2"/><circle cx="56" cy="46" r="1.8"/>
   <circle cx="50" cy="40" r="1.5"/><circle cx="38" cy="56" r="1.8"/><circle cx="60" cy="57" r="1.6"/></g>`,

/* ---- shawarma wrap ---- */
wrap:()=>`${bg("#402C12","#6B4A1D")}
  <g transform="rotate(-28 50 50)">
    <rect x="30" y="26" width="40" height="52" rx="19" fill="${P.breadDk}"/>
    <rect x="32" y="28" width="36" height="48" rx="17" fill="#F0DCA9"/>
    <ellipse cx="50" cy="30" rx="18" ry="7" fill="#C79B54"/>
    <ellipse cx="50" cy="29" rx="14" ry="5" fill="${P.meat}"/>
    <circle cx="45" cy="29" r="2.4" fill="#7CA83F"/><circle cx="55" cy="30" r="2.2" fill="#D14526"/>
    <path d="M36 44 q14 6 28 0" stroke="rgba(160,120,60,.5)" stroke-width="2" fill="none"/>
    <path d="M36 58 q14 6 28 0" stroke="rgba(160,120,60,.5)" stroke-width="2" fill="none"/>
  </g>`,

/* ---- salad / greens ---- */
salad:()=>`${bg("#26380F","#456019")}${bowlShape("#D8CDB4","#B0A588")}
  <circle cx="40" cy="48" r="8" fill="#6FAA3F"/><circle cx="54" cy="50" r="7" fill="#88C24F"/>
  <circle cx="64" cy="47" r="5.5" fill="#5C9433"/>
  <circle cx="46" cy="52" r="4" fill="#D8452F"/><circle cx="60" cy="53" r="3.4" fill="#E86A3C"/>`,

/* ---- plain rice ---- */
rice:()=>`${bg("#3E2F14","#6A5222")}${bowlShape("#E4DAC2","#BCB198")}
  <ellipse cx="50" cy="48" rx="30" ry="9" fill="${P.riceDk}"/>
  <ellipse cx="50" cy="45" rx="29" ry="9" fill="#F5EBD2"/>
  <g fill="#D8C9A4"><ellipse cx="42" cy="44" rx="4" ry="1.8"/><ellipse cx="56" cy="47" rx="4" ry="1.8"/>
   <ellipse cx="50" cy="41" rx="3.4" ry="1.6"/></g>`,

/* ---- dip / sauce / pickle ---- */
sauce:(tint)=>`${bg("#42260F","#6E4118")}
  <path d="M30 46 h40 l-4 30 a5 5 0 0 1 -5 4 h-22 a5 5 0 0 1 -5 -4 z" fill="#D8CDB4"/>
  <path d="M32 48 h36 l-3.6 27 a3 3 0 0 1 -3 2.6 h-22.8 a3 3 0 0 1 -3 -2.6 z" fill="${tint||"#C33F2A"}"/>
  <ellipse cx="50" cy="46" rx="20" ry="5" fill="#B7AC90"/>
  <ellipse cx="50" cy="46" rx="17" ry="3.6" fill="${tint||"#DC5334"}"/>
  <ellipse cx="44" cy="45" rx="4" ry="1.6" fill="rgba(255,255,255,.35)"/>`,

/* ---- soup ---- */
soup:()=>`${bg("#3B2A12","#63481C")}${bowlShape("#D8CDB4","#AFA488")}
  <ellipse cx="50" cy="49" rx="29" ry="5.5" fill="#B9762E"/>
  <ellipse cx="50" cy="48.5" rx="26" ry="4.4" fill="#D68F3C"/>
  ${steam}`,

/* ---- juices ---- */
juice:(tint)=>`${bg("#3A2A10","#66491A")}${tallGlass(tint||"#E8912A")}
  ${straw("#F2E7CE")}
  <circle cx="72" cy="30" r="9" fill="${tint||"#F2A93C"}"/>
  <circle cx="72" cy="30" r="9" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"/>
  <path d="M72 21 v18 M63 30 h18" stroke="rgba(255,255,255,.45)" stroke-width="1.6"/>`,

mojito:(tint)=>`${bg("#1E3218","#3C5A22")}${tallGlass(tint||"#7FC24A")}
  ${mint}${straw("#F2E7CE")}
  <g fill="rgba(255,255,255,.42)"><circle cx="44" cy="52" r="2.4"/><circle cx="57" cy="62" r="2"/>
   <circle cx="49" cy="70" r="1.8"/><circle cx="59" cy="46" r="1.6"/></g>`,

/* ---- desserts ---- */
shake:()=>`${bg("#3A2A16","#63481F")}${tallGlass("#F3EAD6")}
  <ellipse cx="50" cy="34" rx="15.5" ry="6" fill="#FFFBF0"/>
  <g fill="#D9A845"><circle cx="45" cy="33" r="2"/><circle cx="54" cy="35" r="1.8"/>
   <circle cx="50" cy="31" r="1.6"/></g>
  ${straw("#C7452E")}`,

falooda:()=>`${bg("#3A1A2A","#5F2840")}
  <path d="M32 22 h36 l-4 56 a6 6 0 0 1 -6 5 h-16 a6 6 0 0 1 -6 -5 z" fill="${P.glass}"/>
  <path d="M37 60 h26 l-1.4 17 a4 4 0 0 1 -4 3.5 h-15.4 a4 4 0 0 1 -4 -3.5 z" fill="#C7385F"/>
  <path d="M35.4 46 h29.2 l-1.3 14 h-26.6 z" fill="#F3EAD6"/>
  <path d="M34.4 34 h31.2 l-1 12 h-29.2 z" fill="#E0577E"/>
  <ellipse cx="50" cy="30" rx="15" ry="7" fill="#F6EFDD"/>
  <circle cx="44" cy="27" r="3" fill="#C7385F"/><circle cx="55" cy="29" r="2.4" fill="#8A4B2A"/>
  <path d="M32 22 h36 l-4 56 a6 6 0 0 1 -6 5 h-16 a6 6 0 0 1 -6 -5 z"
    fill="none" stroke="${P.glassEdge}" stroke-width="2.2"/>
  ${straw("#F2E7CE")}`,

icecream:()=>`${bg("#3A2A1E","#61452F")}
  <path d="M30 54 h40 l-5 26 a6 6 0 0 1 -6 5 h-18 a6 6 0 0 1 -6 -5 z" fill="#DED3BB"/>
  <path d="M32 56 h36 l-4.4 23 a4 4 0 0 1 -4 3.4 h-19.2 a4 4 0 0 1 -4 -3.4 z" fill="#EFE6D0"/>
  <circle cx="38" cy="46" r="12" fill="#F0C9D6"/>
  <circle cx="60" cy="46" r="12" fill="#C79A6A"/>
  <circle cx="49" cy="36" r="12" fill="#F6EFDD"/>
  <g fill="#5A3620"><circle cx="35" cy="42" r="1.8"/><circle cx="62" cy="43" r="1.8"/>
   <circle cx="48" cy="32" r="1.6"/><circle cx="54" cy="40" r="1.5"/></g>`,

mango:()=>`${bg("#4A3308","#7A5510")}${bowlShape("#E4DAC2","#BCB198")}
  <g fill="#F0A81F"><rect x="36" y="42" width="11" height="9" rx="2.5"/>
   <rect x="49" y="44" width="11" height="9" rx="2.5"/>
   <rect x="61" y="41" width="10" height="8" rx="2.5"/>
   <rect x="43" y="52" width="10" height="7" rx="2.5"/></g>
  <g fill="#FFC94A"><rect x="38" y="43" width="6" height="4" rx="1.5"/>
   <rect x="51" y="45" width="6" height="4" rx="1.5"/></g>
  <ellipse cx="66" cy="38" rx="7" ry="4" fill="${P.green}" transform="rotate(-20 66 38)"/>`

};

/* item type -> icon */
window.ICONS = I;
window.iconSvg = function(name, tint, wide){
  const f = I[name] || I.mandi;
  const box = wide ? "-39 0 178 100" : "0 0 100 100";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${f(tint)}</svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
};
})();
