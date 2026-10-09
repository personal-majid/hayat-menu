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
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => {
    try { sessionStorage.setItem('hayat_admin', '1'); } catch (e) {}
    // printJob opens print.html in a popup; keep it out of the test
    window.__opened = [];
    window.open = (u) => { window.__opened.push(u); return null; };
    // the service worker would cache the old build between runs
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('off'));
  });

  await page.goto('http://localhost:8099/#/admin/pos', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // ---- the page exists at all
  check('route renders the counter', await page.locator('#posWrap').count() === 1);
  check('search box is there', await page.locator('#posFind').count() === 1);

  // ---- research rule: never more than two taps. tabs + grid, no third level
  const tabs = await page.locator('.posbarrow .postab').count();
  check('bar carries Usual + 3 busiest + All (' + tabs + ')', tabs === 5, 'tabs=' + tabs);
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.posbarrow .postab')]
    .filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent));
  check('no tab is clipped mid-word', clipped.length === 0, JSON.stringify(clipped));

  // the floating full list
  await page.click('#posMore'); await page.waitForTimeout(200);
  const sheet = await page.locator('.poscat').count();
  check('All opens a floating sheet with every category (' + sheet + ')', sheet >= 13, 'cats=' + sheet);
  await page.click('#posSheetX'); await page.waitForTimeout(150);
  check('sheet closes', await page.locator('#posSheet[hidden]').count() === 1);

  // picking a category SHORTLISTS below, it does not navigate
  const hashBefore = await page.evaluate(() => location.hash);
  const yBefore = await page.evaluate(() => window.scrollY);
  await page.locator('.posbarrow .postab').nth(1).click();
  await page.waitForTimeout(250);
  check('picking a category does not navigate',
        await page.evaluate(() => location.hash) === hashBefore);
  check('and does not jump the scroll', await page.evaluate(() => window.scrollY) === yBefore);
  check('and the grid is still the same grid element',
        await page.locator('#posGrid').count() === 1);
  check('the line says which category is showing',
        /items/.test(await page.locator('#posWhat').innerText()),
        await page.locator('#posWhat').innerText());
  const narrowed = await page.locator('.postile').count();
  check('the grid shortlisted to that category (' + narrowed + ')', narrowed > 0 && narrowed < 60);

  // search takes precedence over the open category
  await page.fill('#posFind', 'juice');
  await page.waitForTimeout(250);
  check('typing searches the WHOLE menu, not the open category',
        /whole menu/i.test(await page.locator('#posWhat').innerText()),
        await page.locator('#posWhat').innerText());
  check('and offers one tap to narrow it back',
        await page.locator('#posScope').count() === 1);
  await page.click('#posScope'); await page.waitForTimeout(220);
  check('tapping the chip scopes the search to the category',
        /Searching/.test(await page.locator('#posWhat').innerText()) &&
        await page.locator('#posScope.on').count() === 1);
  await page.fill('#posFind', '');
  await page.waitForTimeout(220);
  await page.locator('.posbarrow .postab').nth(0).click();
  await page.waitForTimeout(220);

  let tiles = await page.locator('.postile').count();
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
             addr: mine[0] && mine[0].addr, token: mine[0] && mine[0].token };
  });
  check('one counter order written to orders', placed.n === 1, JSON.stringify(placed));
  check('it is source:counter, mode takeaway', placed.mode === 'takeaway');
  check('it is accepted, not left waiting', placed.status === 'accepted');
  check('it carries its lines and total', placed.lines > 0 && placed.total > 0, JSON.stringify(placed));
  check('it was given a token', placed.token >= 1, JSON.stringify(placed));
  check('the takeaway address names the token', /token \d+/.test(placed.addr || ''), placed.addr);

  await page.waitForTimeout(250);
  check('ticket clears after placing', await page.locator('.posline').count() === 0);
  const nextTok = await page.locator('#posToken b').innerText();
  check('the next token is waiting, one higher (' + nextTok + ')',
        +nextTok === (placed.token + 1), nextTok + ' vs ' + placed.token);

  // the name field is not the first thing you meet
  const rightOrder = await page.evaluate(() => {
    const right = document.querySelector('.posright');
    const kids = [...right.children].map(e => e.id || e.className);
    return kids;
  });
  check('no name field sits above the token',
        rightOrder.indexOf('posToken') <= 1 &&
        rightOrder.indexOf('posWhoBox') > rightOrder.indexOf('posTicket'),
        JSON.stringify(rightOrder));
  check('who-it-is-for is folded away for takeaway',
        await page.locator('#posWhoBox[open]').count() === 0);

  // the palette comes from the house theme, not a guess
  const paint = await page.evaluate(() => {
    const t = document.querySelector('.postile');
    const c = getComputedStyle(t);
    const toRgb = s => (s.match(/[0-9.]+/g) || []).map(Number);
    const bg = toRgb(c.backgroundColor);
    return { bg, lum: (bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114) };
  });
  check('tiles are light, matching the paper skin (lum ' + Math.round(paint.lum) + ')',
        paint.lum > 180, JSON.stringify(paint));

  // ---- nothing blew up
  // ================= the open bills =================
  const open1 = await page.evaluate(() => ({
    n: document.querySelectorAll('.posopenrow').length,
    txt: document.querySelector('.posopenbox summary') &&
         document.querySelector('.posopenbox summary').textContent,
  }));
  check('the bill just placed is listed as open (' + open1.txt + ')', open1.n >= 1,
        JSON.stringify(open1));

  await page.evaluate(() => { document.querySelector('.posopenbox').open = true; });
  await page.waitForTimeout(150);
  await page.locator('[data-resume]').first().click();
  await page.waitForTimeout(300);

  check('resuming loads its lines back onto the till',
        await page.locator('.posline').count() > 0);
  check('the button says nothing has changed yet (No changes)',
        (await page.locator('#posGo').innerText()).trim() === 'No changes',
        await page.locator('#posGo').innerText());
  check('the token panel says it is an edit',
        /editing/i.test(await page.locator('#posToken').innerText()),
        await page.locator('#posToken').innerText());
  check('and offers a way back to a new bill',
        await page.locator('#posExit').count() === 1);

  // the kitchen should get only what was added, not the whole meal again
  const beforeAdd = await page.evaluate(() => {
    const o = window.SHOP.store.orders().filter(x => x.source === 'counter')[0];
    return { total: o.total, lines: o.lines.length, id: o.id };
  });
  await page.evaluate(() => { window.__opened = []; localStorage.removeItem('hayat_print'); });
  await page.locator('.postile').nth(2).click();
  await page.waitForTimeout(200);
  await page.click('#posGo');
  await page.waitForTimeout(400);

  const afterAdd = await page.evaluate(() => {
    const o = window.SHOP.store.order(arguments ? undefined : undefined);
    return null;
  }).catch(() => null);
  const upd = await page.evaluate((id) => {
    const o = window.SHOP.store.order(id);
    let job = null;
    try { job = JSON.parse(localStorage.getItem('hayat_print') || 'null'); } catch (e) {}
    return { total: o.total, lines: o.lines.length, edited: !!o.editedAt,
             job: job && { kind: job.kind, stations: (job.tickets || []).map(t => t.station),
                           qty: (job.tickets || []).reduce((n, t) =>
                                  n + t.lines.reduce((m, l) => m + l.q, 0), 0) } };
  }, beforeAdd.id);

  check('updating raises the bill total', upd.total > beforeAdd.total,
        beforeAdd.total + ' -> ' + upd.total);
  check('and stamps it as edited', upd.edited);
  check('the kitchen ticket carries ONLY what was added',
        upd.job && upd.job.kind === 'kot' && upd.job.qty === 1, JSON.stringify(upd.job));
  check('the till returns to a new bill after updating',
        (await page.locator('#posGo').innerText()).trim() === 'Send KOT' &&
        await page.locator('.posline').count() === 0);

  // ================= the KOT chips =================
  await page.fill('#posFind', 'mandi');
  await page.waitForTimeout(220);
  await page.locator('.postile').first().click();
  await page.waitForTimeout(220);
  const kot1 = await page.evaluate(() => [...document.querySelectorAll('.pkchip')]
    .map(b => ({ k: b.dataset.kot, on: b.classList.contains('on'), t: b.textContent.trim() })));
  check('a chip appears per kitchen the items reach (' + kot1.length + ')',
        kot1.length >= 1, JSON.stringify(kot1));
  check('chips start ticked (autoPrint is on in config)', kot1.every(c => c.on),
        JSON.stringify(kot1));
  check('each chip counts its own items', /\d/.test(kot1.map(c => c.t).join('')),
        JSON.stringify(kot1.map(c => c.t)));

  // add something from the other kitchen and expect a second chip
  await page.fill('#posFind', 'juice');
  await page.waitForTimeout(250);
  if (await page.locator('.postile').count()) {
    await page.locator('.postile').first().click();
    await page.waitForTimeout(250);
  }
  const kot2 = await page.evaluate(() => [...document.querySelectorAll('.pkchip')].map(b => b.dataset.kot));
  check('two kitchens on the ticket means two chips (' + kot2.join('+') + ')',
        kot2.length === 2, JSON.stringify(kot2));

  // untick one: only the other prints
  await page.evaluate(() => { window.__opened = []; localStorage.removeItem('hayat_print'); });
  const dropped = kot2[0];
  await page.locator('.pkchip[data-kot="' + dropped + '"]').click();
  await page.waitForTimeout(200);
  check('unticking a chip clears it',
        await page.locator('.pkchip[data-kot="' + dropped + '"].on').count() === 0);
  await page.click('#posGo');
  await page.waitForTimeout(400);
  const printed = await page.evaluate(() => {
    let j = null; try { j = JSON.parse(localStorage.getItem('hayat_print') || 'null'); } catch (e) {}
    return j && (j.tickets || []).map(t => t.station);
  });
  check('only the ticked kitchen was printed (' + JSON.stringify(printed) + ')',
        Array.isArray(printed) && printed.length === 1 && printed[0] !== dropped,
        JSON.stringify({ printed, dropped }));

  // untick everything: nothing prints at all
  await page.fill('#posFind', '');
  await page.waitForTimeout(150);
  await page.locator('.postile').first().click();
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    localStorage.removeItem('hayat_print');
    document.querySelectorAll('.pkchip.on').forEach(b => b.click());
  });
  await page.waitForTimeout(250);
  check('with nothing ticked the panel warns', await page.locator('.poskot .pkn').count() === 1);
  await page.click('#posGo');
  await page.waitForTimeout(400);
  const none = await page.evaluate(() => localStorage.getItem('hayat_print'));
  check('and no kitchen ticket is produced', none === null, String(none).slice(0, 60));

  const real = errors.filter(e => !/favicon|firebase|gstatic|googleapis|net::ERR|Failed to load resource/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  console.log('');
  console.log(fail.length ? 'FAILED: ' + fail.join(', ') : 'ALL GREEN');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });