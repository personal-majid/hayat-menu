const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');

const ROOT = path.join(__dirname, '..');
const T = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
  r.end(fs.readFileSync(f));
});

const fail = [];
function check(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : '   <- ' + (extra || '')));
  if (!cond) fail.push(name);
}

/* The crew the restaurant has, as crew/_list would hand it over. */
const CREW = [
  { id: 'majid',  name: 'Majid',  role: 'office'  },
  { id: 'rashid', name: 'Rashid', role: 'captain' },
  { id: 'anees',  name: 'Anees',  role: 'waiter'  },
  { id: 'suhail', name: 'Suhail', role: 'cleaner' },
  { id: 'oldguy', name: 'Old Guy', role: ''       },   // from before roles existed
];

(async () => {
  await new Promise(r => server.listen(8097, r));
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('off'));
  });
  await page.goto('http://localhost:8097/#/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Pretend the database is up and hand the door a crew list.
  await page.evaluate((crew) => {
    const S = window.SHOP.store;
    S.live = () => true;
    S.fault = () => null;
    S.crew = () => Promise.resolve(crew);
    window.__signIns = [];
    S.signInCrew = (who, code, roles, name) => {
      window.__signIns.push({ who, code, roles, name });
      const want = [].concat(roles);
      const person = crew.filter(p => p.id === who)[0];
      // the emulator of the rule: the code and the role must both match
      const codes = { majid: '111111', rashid: '222222', anees: '333333', suhail: '444444', oldguy: '555555' };
      const real = person && (person.role || 'office');
      for (const r of want) {
        if (codes[who] === code && r === real) {
          const me = S.me(); me.role = r; me.name = name; me.crew = who;
          return Promise.resolve(r);
        }
      }
      return Promise.reject(new Error('no-match'));
    };
  }, CREW);

  const setRole = (role, name) => page.evaluate(([r, n]) => {
    const me = window.SHOP.store.me();
    me.role = r; me.name = n || ''; me.ready = true;
    try { sessionStorage.removeItem('hayat_admin'); } catch (e) {}
  }, [role, name]);

  const knock = (roles) => page.evaluate((rs) => new Promise(ok => {
    const main = document.getElementById('main');
    let passed = false;
    window.SHOP.gate(main, rs, () => { passed = true; });
    setTimeout(() => ok({ passed, html: main.innerHTML }), 400);
  }), roles);

  // ================= the dock only offers what you may open =========
  const dock = await page.evaluate(() => {
    const me = window.SHOP.store.me();
    const keys = ['pos', 'orders', 'who', 'riders', 'menu', 'print', 'clean', 'kds'];
    const out = {};
    for (const role of ['office', 'captain', 'waiter', 'cleaner']) {
      me.role = role;
      out[role] = keys.filter(k => window.SHOP.dockAllows(k));
    }
    return out;
  });
  check('office sees everything', dock.office.length === 8, JSON.stringify(dock.office));
  check('captain gets the counter, not the customer book',
        dock.captain.includes('pos') && !dock.captain.includes('who') && !dock.captain.includes('riders'),
        JSON.stringify(dock.captain));
  check('waiter gets the counter only (+cleaning)',
        dock.waiter.includes('pos') && !dock.waiter.includes('orders') && !dock.waiter.includes('who'),
        JSON.stringify(dock.waiter));
  check('cleaner gets neither counter nor board',
        !dock.cleaner.includes('pos') && !dock.cleaner.includes('orders'), JSON.stringify(dock.cleaner));

  // ================= the door, for somebody already signed in =======
  await setRole('waiter', 'Anees');
  let r = await knock(['office']);
  check('a waiter is turned away from the office board', !r.passed);
  check('and is told who they are signed in as, not shown a login',
        /signed in as/i.test(r.html) && !/crewWho/.test(r.html), r.html.slice(0, 120));

  r = await knock(['office', 'captain', 'waiter']);
  check('a waiter walks into the counter', r.passed);

  await setRole('captain', 'Rashid');
  r = await knock(['office', 'captain', 'waiter']);
  check('a captain walks into the counter', r.passed);
  r = await knock(['office']);
  check('a captain is turned away from the office board', !r.passed);

  await setRole('cleaner', 'Suhail');
  r = await knock(['office', 'captain', 'waiter']);
  check('a cleaner is turned away from the counter', !r.passed);

  await setRole('office', 'Majid');
  r = await knock(['office', 'captain', 'waiter']);
  check('the office opens every door', r.passed);
  r = await knock(['office']);
  check('the office opens its own', r.passed);

  // ================= the door, for a guest ==========================
  await setRole('guest', '');
  r = await knock(['office', 'captain', 'waiter']);
  check('a guest is shown a sign-in', !r.passed && /crewWho/.test(r.html));

  const opts = await page.evaluate(() => [...document.querySelectorAll('#crewWho option')]
    .map(o => ({ v: o.value, role: o.dataset.role, t: o.text })));
  check('the counter list holds office, captain, waiter and the role-less one (' + opts.length + ')',
        opts.length === 4 && opts.some(o => o.v === 'anees') && opts.some(o => o.v === 'rashid'),
        JSON.stringify(opts.map(o => o.v)));
  check('the cleaner is NOT offered the counter', !opts.some(o => o.v === 'suhail'));
  check('each name shows its role', /Rashid · Captain/.test(opts.map(o => o.t).join('|')),
        opts.map(o => o.t).join('|'));

  // a cleaner-only door lists only the cleaner
  await setRole('guest', '');
  r = await knock(['cleaner']);
  const copts = await page.evaluate(() => [...document.querySelectorAll('#crewWho option')].map(o => o.value));
  check('a cleaners-only door drops office, captain and waiter',
        copts.includes('suhail') && !copts.includes('anees') &&
        !copts.includes('rashid') && !copts.includes('majid'), JSON.stringify(copts));

  // ================= actually signing in ============================
  await setRole('guest', '');
  await knock(['office', 'captain', 'waiter']);
  const signedIn = await page.evaluate(() => new Promise(ok => {
    document.querySelector('#crewWho').value = 'anees';
    document.querySelector('#crewCode').value = '333333';
    document.querySelector('#crewGo').click();
    setTimeout(() => ok({ me: window.SHOP.store.me().role, name: window.SHOP.store.me().name,
                          sent: window.__signIns[window.__signIns.length - 1] }), 400);
  }));
  check('the waiter’s code signs them in as a waiter', signedIn.me === 'waiter', JSON.stringify(signedIn));
  check('their name is carried into the record', signedIn.name === 'Anees', signedIn.name);
  check('the door sent the role from the list, not "office"',
        JSON.stringify(signedIn.sent.roles) === '["waiter"]', JSON.stringify(signedIn.sent.roles));

  // a role-less old entry: the door tries each role it accepts
  await setRole('guest', '');
  await knock(['office', 'captain', 'waiter']);
  const legacy = await page.evaluate(() => new Promise(ok => {
    document.querySelector('#crewWho').value = 'oldguy';
    document.querySelector('#crewCode').value = '555555';
    document.querySelector('#crewGo').click();
    setTimeout(() => ok({ me: window.SHOP.store.me().role,
                          sent: window.__signIns[window.__signIns.length - 1] }), 500);
  }));
  check('an entry with no role is tried against every role the door takes',
        legacy.sent.roles.length === 3 && legacy.me === 'office', JSON.stringify(legacy));

  // a wrong code
  await setRole('guest', '');
  await knock(['office', 'captain', 'waiter']);
  const wrong = await page.evaluate(() => new Promise(ok => {
    document.querySelector('#crewWho').value = 'anees';
    document.querySelector('#crewCode').value = '000000';
    document.querySelector('#crewGo').click();
    setTimeout(() => ok({ me: window.SHOP.store.me().role,
                          note: document.querySelector('#crewNote').textContent }), 400);
  }));
  check('a wrong code changes nothing and says so',
        wrong.me === 'guest' && /did not match/i.test(wrong.note), JSON.stringify(wrong));

  // ================= the counter page itself honours the door =======
  await setRole('waiter', 'Anees');
  await page.evaluate(() => { location.hash = '#/admin/pos'; });
  await page.waitForTimeout(900);
  check('a waiter reaches the counter page', await page.locator('#posWrap').count() === 1,
        (await page.locator('#main').innerHTML()).slice(0, 200));

  await page.evaluate(() => { location.hash = '#/admin'; });
  await page.waitForTimeout(900);
  check('a waiter does NOT reach the orders board',
        await page.locator('.adminwrap, #adBoard').count() === 0 &&
        /signed in as/i.test(await page.locator('#main').innerHTML()));

  const real = errors.filter(e => !/favicon|firebase|gstatic|googleapis|net::ERR/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));

  await browser.close(); server.close();
  console.log('');
  console.log(fail.length ? 'FAILED: ' + fail.join(', ') : 'ALL GREEN');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
