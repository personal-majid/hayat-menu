/* End-to-end: the counter's whole workflow, the way a shift uses it.
   KOT #1 -> add-on KOT #2 -> void with a reason (CANCEL ticket) -> bill preview
   -> print -> settle -> closed; a whole bill cancelled; a third kitchen with its own
   printer; the kitchen screen popping the tickets. No Firebase: the offline store,
   print jobs caught where the browser print page would read them.
   Run: node tests/pos-flow.test.js   (PW_CHROMIUM=path to a chromium if needed) */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json' };
const PORT = 8123;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const fail = [];
function check(name, cond, extra) { console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : '   <- ' + (extra || ''))); if (!cond) fail.push(name); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => {
    try { sessionStorage.setItem('hayat_admin', '1'); } catch (e) {}
    window.__jobs = [];
    window.open = () => null;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'hayat_print') { try { window.__jobs.push(JSON.parse(v)); } catch (e) {} } return set.call(this, k, v); };
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('off'));
  });
  const base = 'http://localhost:' + PORT;
  const SHOT = process.env.SHOTS ? (n => page.screenshot({ path: process.env.SHOTS + '/' + n + '.png' })) : (async () => {});

  await page.goto(base + '/#/admin/pos', { waitUntil: 'load' }); await sleep(1500);
  const jobs = () => page.evaluate(() => window.__jobs.slice());
  const order = id => page.evaluate(i => JSON.parse(JSON.stringify(window.SHOP.store.order(i))), id);
  const counterOrders = () => page.evaluate(() => window.SHOP.store.orders().filter(o => o.source === 'counter').map(o => o.id));
  const add = async q => { await page.fill('#posFind', q); await sleep(220); await page.press('#posFind', 'ArrowDown'); await page.press('#posFind', 'Enter'); await sleep(150); await page.press('#posFind', 'Escape'); await sleep(120); };

  // ---- 1. a guarded button
  check('empty till: Send KOT is off and says why', await page.locator('#posGo.off').count() === 1 && /first/i.test(await page.locator('#posGoWhy').innerText()));
  await page.click('[data-mode="dinein"]'); await sleep(120);
  await add('mandi'); await add('lime');
  check('two dishes on the ticket', await page.locator('.posline').count() === 2);
  check('dine-in without a table: still off, asks for the table', await page.locator('#posGo.off').count() === 1 && /table/i.test(await page.locator('#posGoWhy').innerText()));
  await page.fill('#poTable', '4'); await sleep(120);
  check('table given: button is on and reads Send KOT', await page.locator('#posGo.off').count() === 0 && (await page.locator('#posGo').innerText()).trim() === 'Send KOT');

  // ---- 2. KOT #1
  const j0 = (await jobs()).length;
  await page.click('#posGo'); await sleep(400);
  const ids = await counterOrders(); const id = ids[0];
  let o = await order(id);
  let J = (await jobs()).slice(j0);
  check('one bill on the board, table 4', ids.length === 1 && o.table === '4' && o.mode === 'dinein');
  check('KOT #1 printed, each ticket named by its kitchen', J.length === 1 && J[0].kind === 'kot' && J[0].tickets.length >= 1 && J[0].tickets.every(t => t.round === 1 && t.name), JSON.stringify(J.map(j => j.tickets)));
  check('every line remembers when it went and who sent it', o.lines.every(l => l.at && l.rounds && l.rounds[0].n === 1));
  check('the bill keeps the KOT history', o.kotN === 1 && o.kots.length === 1 && o.kots[0].kind === 'kot');
  check('till is clear for the next guest, with the last bill below', await page.locator('.posline').count() === 0 && /Last/.test(await page.locator('#posActs').innerText()));

  // ---- 3. the open bills, full screen
  await page.click('#posBoardBtn'); await sleep(300);
  await SHOT('1-board');
  check('open bills open full screen', await page.locator('#posBoard').count() === 1 && await page.locator('.pbcard').count() === 1);
  check('the card shows table, amount and 1 KOT', /T4|#/.test(await page.locator('.pbwho').innerText()) && /1 KOT/.test(await page.locator('.pbtags').innerText()));
  await page.click('[data-pba^="open|"]'); await sleep(300);
  check('Open puts it back on the till', await page.locator('#posBoard').count() === 0 && await page.locator('.posline').count() === 2);
  check('nothing changed yet: No changes, off', (await page.locator('#posGo').innerText()).trim() === 'No changes' && await page.locator('#posGo.off').count() === 1);
  check('lines show their KOT time', /KOT 1/.test(await page.locator('#posTicket').innerText()));

  // ---- 4. add-on: KOT #2 carries only the new plate
  await page.locator('.posline').first().locator('[data-more]').click(); await sleep(150);
  check('button reads Send KOT #2', (await page.locator('#posGo').innerText()).trim() === 'Send KOT #2');
  check('the new plate is marked new', /\+1 new/.test(await page.locator('#posTicket').innerText()));
  const j1 = (await jobs()).length;
  await page.click('#posGo'); await sleep(400);
  o = await order(id); J = (await jobs()).slice(j1);
  check('KOT #2 printed with only the add-on', J.length === 1 && J[0].tickets.every(t => t.round === 2) && J[0].tickets.reduce((n, t) => n + t.lines.reduce((m, l) => m + l.q, 0), 0) === 1, JSON.stringify(J.map(j => j.tickets)));
  check('the line now has two rounds, each timed', o.kotN === 2 && o.lines.some(l => l.rounds.length === 2 && l.rounds[1].n === 2 && l.rounds[1].at));

  // ---- 5. a void after the kitchen has it: reason required, CANCEL ticket
  await page.click('[data-pact="open"]').catch(() => {}); await sleep(300);
  if (await page.locator('.posline').count() === 0) { await page.click('#posBoardBtn'); await sleep(200); await page.click('[data-pba^="open|"]'); await sleep(300); }
  const lastLine = page.locator('.posline').nth(1);
  await lastLine.locator('[data-less]').click(); await sleep(150);
  check('the removed dish stays, struck, marked to cancel', await page.locator('.posline.gone').count() === 1 && /to cancel/.test(await page.locator('#posTicket').innerText()));
  await SHOT('2-till-editing');
  check('button reads Cancel 1 item', (await page.locator('#posGo').innerText()).trim() === 'Cancel 1 item');
  const j2 = (await jobs()).length;
  await page.click('#posGo'); await sleep(250);
  await SHOT('3-reason');
  check('a reason is asked for, Confirm is off until one is chosen', await page.locator('#posReason').count() === 1 && await page.locator('#posRsnGo[disabled]').count() === 1);
  await page.click('[data-rsn="Customer changed mind"]'); await page.click('#posRsnGo'); await sleep(400);
  o = await order(id); J = (await jobs()).slice(j2);
  check('a CANCEL ticket printed with the reason', J.length === 1 && J[0].tickets.length >= 1 && J[0].tickets.every(t => t.cancel && t.reason === 'Customer changed mind'), JSON.stringify(J.map(j => j.tickets)));
  check('the change is in the history with who, when and why', o.edits.length === 1 && o.edits[0].reason && o.edits[0].at && o.edits[0].void === true && o.kots.some(k => k.kind === 'cancel'));
  check('the bill lost that dish', o.lines.length === 1);

  // ---- 6. the bill: preview first, then print
  await page.click('[data-pact="bill"]'); await sleep(300);
  await SHOT('4-bill');
  check('Bill opens a preview on screen', await page.locator('#posBill .posreceipt').count() === 1 && /TOTAL/.test(await page.locator('#posBill').innerText()));
  const j3 = (await jobs()).length;
  await page.click('#pbPrint'); await sleep(400);
  o = await order(id); J = (await jobs()).slice(j3);
  check('Print bill prints the bill and marks it due', J.length === 1 && J[0].kind === 'bill' && o.dueCount === 1 && o.dueAt);
  check('the preview now says printed 1×', /printed 1/.test(await page.locator('#posBill').innerText()));

  // ---- 7. settle: paid and closed
  await page.click('#pbPay'); await sleep(300);
  check('Settle opens the tender', await page.locator('#settleSheet').count() === 1);
  await page.click('#stGo'); await sleep(400);
  o = await order(id);
  check('paid in cash and closed', o.paid === true && o.status === 'delivered');
  check('no open bills left', await page.evaluate(() => window.SHOP.store.orders().filter(x => x.status !== 'delivered' && x.status !== 'cancelled').length) === 0);

  // ---- 8. a whole bill called off
  await page.click('[data-mode="takeaway"]').catch(() => {}); await sleep(150);
  if (await page.locator('#posExit').count()) { await page.click('#posExit'); await sleep(150); }
  await page.click('[data-mode="takeaway"]'); await add('mandi');
  await page.click('#posGo'); await sleep(400);
  const id2 = (await counterOrders()).filter(x => x !== id)[0];
  await page.click('#posBoardBtn'); await sleep(250);
  const j4 = (await jobs()).length;
  await page.click('[data-pba^="cancel|"]'); await sleep(200);
  await page.click('[data-rsn="Wrong entry"]'); await page.click('#posRsnGo'); await sleep(400);
  const o2 = await order(id2); J = (await jobs()).slice(j4);
  check('cancelled bill: CANCEL ticket printed and status cancelled', o2.status === 'cancelled' && J.length === 1 && J[0].tickets.every(t => t.cancel));
  if (await page.locator('#posBoard').count()) await page.click('#pbClose');

  // ---- 9. a third kitchen with its own printer
  await page.goto(base + '/#/admin/print', { waitUntil: 'load' }); await sleep(900);
  await SHOT('5-printing');
  check('Printing lists the kitchens with a printer box each', await page.locator('.kitrow').count() === 2 && await page.locator('[data-kp]').count() === 2);
  await page.click('#kAdd'); await sleep(300);
  check('a kitchen can be added', await page.locator('.kitrow').count() === 3);
  await page.fill('[data-kn="2"]', 'Juice bar'); await page.dispatchEvent('[data-kn="2"]', 'change'); await sleep(250);
  await page.fill('[data-kp="2"]', '192.168.1.77'); await page.dispatchEvent('[data-kp="2"]', 'change'); await sleep(250);
  const juiceCat = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-kcat]')].find(x => /juice|lime|drink|beverage/i.test(x.closest('.line').innerText)); return b ? b.dataset.kcat.split('|')[0] : null; });
  if (juiceCat) { await page.click(`[data-kcat="${juiceCat}|k1"]`); await sleep(300); }
  const ps = await page.evaluate(() => JSON.parse(JSON.stringify(window.SHOP.store.printSettings())));
  check('saved: 3 kitchens, the new one with its IP and a category', ps.kitchens && ps.kitchens.length === 3 && ps.kitchens[2].printer === '192.168.1.77' && ps.kitchens[2].name === 'Juice bar' && (!juiceCat || ps.kitchens[2].cats.includes(juiceCat)), JSON.stringify(ps.kitchens));
  await page.goto(base + '/#/admin/pos', { waitUntil: 'load' }); await sleep(1200);
  if (await page.locator('#posExit').count()) { await page.click('#posExit'); await sleep(150); }
  await page.click('[data-mode="takeaway"]'); await add('mandi');
  /* a dish straight from the category that moved to the Juice bar */
  await page.click('#posMore'); await sleep(150); await page.click('.poscat[data-poscat="' + (juiceCat || 'drinks') + '"]'); await sleep(250);
  await page.locator('.postile').first().click(); await sleep(150);
  const chips = await page.evaluate(() => [...document.querySelectorAll('[data-kot]')].map(b => b.textContent));
  check('the ticket shows a chip for the new kitchen', chips.some(t => /Juice bar/.test(t)), JSON.stringify(chips));
  const j5 = (await jobs()).length;
  await page.click('#posGo'); await sleep(400);
  J = (await jobs()).slice(j5);
  check('its KOT goes to the Juice bar', J.length === 1 && J[0].tickets.some(t => t.station === 'k1' && t.name === 'Juice bar'), JSON.stringify(J.map(j => j.tickets.map(t => t.station + ':' + t.name))));

  // ---- 10. the kitchen screen: counter KOTs and CANCEL tickets pop up
  const all = await page.evaluate(() => JSON.parse(JSON.stringify(window.SHOP.store.orders().filter(o => o.source === 'counter'))));
  const kds = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  kds.on('pageerror', e => errors.push('kds: ' + e));
  const fake = `window.HayatAuth={start:async()=>({role:'office',db:{},fs:{doc:(...a)=>({p:a.slice(1).join('/')}),collection:(d,n)=>({n}),query:(c)=>c,where:()=>0,
    serverTimestamp:()=>0,setDoc:async()=>{},deleteDoc:async()=>{},
    onSnapshot:(ref,cb)=>{ const n=ref.n||''; if(n==='orders') setTimeout(()=>cb({docs:window.__orders.map(o=>({id:o.id,data:()=>o}))}),50);
      else if(n==='vm_open'||n==='kds'||n==='cleanlog') setTimeout(()=>cb({docs:[]}),30); else setTimeout(()=>cb({exists:()=>false,data:()=>null}),30); }}}),form:async()=>{}};`;
  await kds.route(/hayat-auth\.js$/, r => r.fulfill({ contentType: 'application/javascript', body: fake }));
  await kds.addInitScript(o => { window.__orders = o; localStorage.setItem('kds-cfg', JSON.stringify({ screen: 'mandi', custom: {}, sound: false, theme: 'dark' })); }, all);
  await kds.goto(base + '/kds.html', { waitUntil: 'load' }); await sleep(900);
  if (process.env.SHOTS) await kds.screenshot({ path: process.env.SHOTS + '/6-kitchen.png' });
  const cards = await kds.evaluate(() => [...document.querySelectorAll('.tk')].map(t => ({ cx: t.classList.contains('cx'), txt: t.innerText.replace(/\s+/g, ' ') })));
  check('the mandi screen shows the counter KOT cards', cards.some(c => !c.cx && /counter/.test(c.txt) && /Mandi/i.test(c.txt)), JSON.stringify(cards).slice(0, 400));
  check('and the CANCEL ticket from the called-off bill, in red', cards.some(c => c.cx && /CANCEL/.test(c.txt)), JSON.stringify(cards).slice(0, 400));
  await kds.evaluate(() => { window.__orders[0] = Object.assign({}, window.__orders[0]); });
  await kds.close();

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL GREEN');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
