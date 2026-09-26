/* Hayat staff sign-in for the standalone pages (cleaning, kitchen screen, waitlist).
   Same crew codes as the office: pick your name, type your code, once per phone.
   The code never reaches the browser; the Firestore rules accept the sign-in only
   when it matches (see crew/ and staff/ in firestore.rules).

   HayatAuth.start()                     -> ctx {fs, db, au, auth, user, role, name, crewId}
   HayatAuth.form(el, ctx, roles, done)  draws the name + code form, tries each allowed role
   HayatAuth.signOut(ctx)                forget this phone's sign-in                    */
(function(){
  var V = '12.19.0';
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  async function start(){
    var cfg = window.CONFIG && window.CONFIG.firebase;
    if(!cfg || !cfg.projectId) throw Object.assign(new Error('This page has no Firebase settings. Open it from the website.'), {code:'no-config'});
    var appM = await import('https://www.gstatic.com/firebasejs/' + V + '/firebase-app.js');
    var fs = await import('https://www.gstatic.com/firebasejs/' + V + '/firebase-firestore.js');
    var au = await import('https://www.gstatic.com/firebasejs/' + V + '/firebase-auth.js');
    var app = appM.getApps().length ? appM.getApp() : appM.initializeApp(cfg);
    var db = fs.getFirestore(app), auth = au.getAuth(app);
    var user = await new Promise(function(ok){ var off = au.onAuthStateChanged(auth, function(u){ off(); ok(u); }); });
    if(!user){ user = (await au.signInAnonymously(auth)).user; }
    var ctx = {app: app, fs: fs, db: db, au: au, auth: auth, user: user, role: null, name: '', crewId: '', V: V};
    try{
      var d = await fs.getDoc(fs.doc(db, 'staff', user.uid));
      if(d.exists()){ var x = d.data(); ctx.role = x.role || null; ctx.crewId = x.crew || ''; ctx.name = x.name || x.crew || user.displayName || ''; }
    }catch(e){}
    if(ctx.crewId && !ctx.name) ctx.name = ctx.crewId;
    return ctx;
  }
  async function people(ctx){
    try{ var d = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, 'crew', '_list')); return (d.exists() && d.data().people) || []; }catch(e){ return []; }
  }
  async function form(el, ctx, roles, done, note){
    var P = await people(ctx);
    var list = P.filter(function(p){ return !p.role || roles.indexOf(p.role) >= 0; });
    if(!list.length){
      el.innerHTML = '<div class="ha-box"><b>No staff codes yet.</b><p>Majid: open the Cleaning page as office → <b>Staff &amp; codes</b> to give each person a name and a code.</p></div>';
      return;
    }
    el.innerHTML = '<div class="ha-box"><h2 style="margin:0 0 8px">Who are you?</h2>' +
      '<select id="haWho" class="ha-f">' + list.map(function(p){ return '<option value="' + esc(p.id) + '" data-r="' + esc(p.role || '') + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
      '<input id="haCode" class="ha-f" type="password" inputmode="numeric" autocomplete="off" placeholder="Your code">' +
      '<button id="haGo" class="ha-b">Sign in</button><p id="haNote" class="ha-n">' + (note || 'Once per phone. Ask Majid if you do not have a code.') + '</p></div>';
    var busy = false;
    var go = async function(){
      if(busy) return; busy = true;
      var sel = document.getElementById('haWho'), who = sel.value, code = document.getElementById('haCode').value.trim();
      var name = sel.options[sel.selectedIndex].text, known = sel.options[sel.selectedIndex].dataset.r;
      var tryRoles = known ? [known] : roles.slice();
      var ok = false;
      for(var i = 0; i < tryRoles.length && !ok; i++){
        try{
          await ctx.fs.setDoc(ctx.fs.doc(ctx.db, 'staff', ctx.user.uid), {crew: who, code: code, role: tryRoles[i], name: name, at: Date.now()});
          ctx.role = tryRoles[i]; ctx.crewId = who; ctx.name = name; ok = true;
        }catch(e){}
      }
      busy = false;
      if(ok){ done(ctx); } else { document.getElementById('haNote').textContent = 'That code did not work. Check it and try again.'; }
    };
    document.getElementById('haGo').onclick = go;
    document.getElementById('haCode').addEventListener('keydown', function(e){ if(e.key === 'Enter') go(); });
  }
  async function signOut(ctx){ try{ await ctx.au.signOut(ctx.auth); }catch(e){} location.reload(); }
  window.HayatAuth = {start: start, form: form, signOut: signOut, people: people, esc: esc};
  var st = document.createElement('style');
  st.textContent = '.ha-box{max-width:420px;margin:30px auto;background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:14px;padding:18px;display:grid;gap:10px}' +
    '.ha-f{font:500 18px Jost,system-ui,sans-serif;padding:12px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fafafa);color:inherit;width:100%;box-sizing:border-box}' +
    '.ha-b{font:700 18px Jost,system-ui,sans-serif;padding:12px;border-radius:10px;border:0;background:var(--accent,#2F5A74);color:#fff;cursor:pointer}.ha-n{color:var(--muted,#777);font-size:14px;margin:0}';
  document.head.appendChild(st);
})();
