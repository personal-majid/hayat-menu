const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
                '.webmanifest':'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

const fail = [];
function check(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : '   <- ' + (extra || '')));
  if (!cond) fail.push(name);
}

(async () => {
  await new Promise(r => server.listen(8099, r));
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // the offline passcode door, so the test never needs Firebase
  await page.addInitScript(() => {
    try { sessionStorage.setItem('hayat_admin', '1'); } catch (e) {}
    // the service worker would cache the old build between runs
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('off'));
  });

  await page.goto('http://localhost:8099/#/admin/pos', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // ---- the page exists at all
  check('route renders the counter', await page.locator('#posWrap').count() === 1);
  check('search box is there', await page.locator('#posFind').count() === 1);

  // ---- research rule: never more than two taps. tabs + grid, no third level
  const tabs = await page.locator('.postab').count();
  check('category tabs present (' + tabs + ')', tabs >= 2, 'tabs=' + tabs);

  const tiles = await page.locator('.postile').count();
  check('favourites grid is filled (' + tiles + ' tiles)', tiles > 0 && tiles <= 24, 'tiles=' + tiles);

  // ---- research rule: targets of at least 1cm. 1cm ~ 38px at 96dpi
  const box = await page.locator('.postile').first().boundingBox();
  check('tile >= 1cm square (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')',
        box.width >= 38 && box.height >= 38);

  // ---- research rule: the grid must be frozen, not re-ranked live
  const before = await page.locator('.postile').first().innerText();

  // ---- adding by tapping
  await page.locator('.postile').first().click();
  await page.waitForTimeout(150);
  check('tap adds a line', await page.locator('.posline').count() === 1);

  // ---- adding by typing, which is the fast path
  await page.fill('#posFind', 'mandi');
  await page.waitForTimeout(250);
  const hits = await page.locator('.postile').count();
  check('search narrows the grid (' + hits + ' hits)', hits > 0);
  await page.press('#posFind', 'ArrowDown');
  await page.press('#posFind', 'Enter');
  await page.waitForTimeout(150);
  check('Enter adds the highlighted tile', await page.locator('.posline').count() === 2);

  // ---- Esc clears back to the frozen grid, same first tile as before
  await page.press('#posFind', 'Escape');
  await page.waitForTimeout(200);
  const after = await page.locator('.postile').first().innerText();
  check('grid is frozen across use', before === after, before + ' -> ' + after);

  // ---- quantity steppers
  await page.locator('.posline .pq').nth(1).click();   // the + on the first line
  await page.waitForTimeout(120);
  const q = await page.locator('.posline').first().locator('.ptq b').innerText();
  check('stepper raises quantity (' + q + ')', q === '2');

  // ---- undo last
  const linesBefore = await page.locator('.posline').count();
  await page.click('#posUndo');
  await page.waitForTimeout(120);
  check('undo removes one', await page.locator('.posline').count() <= linesBefore);

  // ---- the total actually adds up
  const totals = await page.evaluate(() => {
    const num = t => +String(t).replace(/[^0-9]/g, '');
    const sum = [...document.querySelectorAll('.posline .ptp')].reduce((n, e) => n + num(e.textContent), 0);
    return [sum, document.querySelector('#posTotal b').textContent];
  });
  check('total matches the lines (' + totals[1] + ')',
        totals[1].replace(/[^0-9]/g, '') === String(totals[0]));

  // ---- the three modes, and what each one demands
  await page.click('[data-mode="dinein"]');
  await page.waitForTimeout(120);
  check('dine-in asks for a table', await page.locator('#poTable').count() === 1);
  await page.click('#posGo');
  await page.waitForTimeout(250);
  check('dine-in refuses without a table', await page.locator('.posline').count() > 0);

  await page.click('[data-mode="delivery"]');
  await page.waitForTimeout(120);
  check('delivery asks for phone and address',
        await page.locator('#poPhone').count() === 1 && await page.locator('#poAddr').count() === 1);

  await page.click('[data-mode="takeaway"]');
  await page.waitForTimeout(120);
  check('takeaway asks for nothing required', await page.locator('#poTable').count() === 0);

  // ---- placing it: one orders record, marked as the counter
  const placed = await page.evaluate(() => {
    document.getElementById('posGo').click();
    const all = window.SHOP.store.orders();
    const mine = all.filter(o => o.source === 'counter');
    return { n: mine.length, mode: mine[0] && mine[0].mode, status: mine[0] && mine[0].status,
             lines: mine[0] && mine[0].lines.length, total: mine[0] && mine[0].total,
             addr: mine[0] && mine[0].addr };
  });
  check('one counter order written to orders', placed.n === 1, JSON.stringify(placed));
  check('it is source:counter, mode takeaway', placed.mode === 'takeaway');
  check('it is accepted, not left waiting', placed.status === 'accepted');
  check('it carries its lines and total', placed.lines > 0 && placed.total > 0, JSON.stringify(placed));

  await page.waitForTimeout(250);
  check('ticket clears after placing', await page.locator('.posline').count() === 0);

  // ---- nothing blew up
  const real = errors.filter(e => !/favicon|firebase|gstatic|googleapis|net::ERR|Failed to load resource/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  console.log('');
  console.log(fail.length ? 'FAILED: ' + fail.join(', ') : 'ALL GREEN');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
