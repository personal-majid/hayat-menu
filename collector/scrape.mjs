/**
 * The hourly read, on the phone. Headless, reusing the signed-in profile.
 * Posts one batch to the Cloudflare Worker and exits.
 */
import {
  openBrowser, readPlace, expectedNow, getPlaces, post, tg,
  stamp, bucket, sleep,
} from './lib.mjs';

const GAP = () => 3000 + Math.random() * 5000;

/* --if-asked (the 2-minute cron): read only when the owner app asked in the last 15 minutes (settings/crowd_req)
   and the last read is over 50 minutes old — so it reads when someone looks, at most once an hour. */
if (process.argv.includes('--if-asked')) {
  const g = async (d) => { try { const r = await fetch('https://firestore.googleapis.com/v1/projects/h-menu/databases/(default)/documents/settings/' + d + '?key=AIzaSyA48aGGeEvg9lyVzeTX5fPIA21SrMZQPn8'); if (!r.ok) return null; const j = await r.json(); return j.fields && j.fields.at && j.fields.at.stringValue; } catch (e) { return null; } };
  const req = await g('crowd_req'), last = await g('crowd_health'), now = Date.now();
  if (!req || now - new Date(req).getTime() > 15 * 60e3 || (last && new Date(last) >= new Date(req)) || (last && now - new Date(last).getTime() < 50 * 60e3)) process.exit(0);
}

const t = stamp();
const b = bucket();

let places;
try {
  places = await getPlaces();
} catch (err) {
  console.error('worker unreachable:', err.message);
  process.exit(1);
}
if (!places.length) {
  console.error('no active places — seed them first');
  process.exit(1);
}

console.log(`[${t}] reading ${places.length} places`);

const ctx = await openBrowser();
const page = await ctx.newPage();

const busy = [];
const curves = {};
let signedOut = 0, noChart = 0, errors = 0;

for (const p of places) {
  let r;
  try {
    r = await readPlace(page, p.place_id);
  } catch (err) {
    errors++;
    console.log(`  x ${p.name}: ${String(err).slice(0, 70)}`);
    await sleep(GAP());
    continue;
  }

  if (r.error === 'signed-out') {
    signedOut++;
    console.log(`  x ${p.name}: signed out`);
    if (signedOut >= 3) break;          // session is dead, stop burning battery
    await sleep(GAP());
    continue;
  }

  if (r.error) {
    noChart++;
    console.log(`  . ${p.name}: ${r.error}`);
    await sleep(GAP());
    continue;
  }

  curves[p.place_id] = r.week;

  const usual = expectedNow(r.week);
  const now = r.live?.now ?? usual;
  const clamp = (v) => (v == null ? null : Math.max(0, Math.min(100, Math.round(v))));

  busy.push({
    bucket: b, t,
    place_id: p.place_id,
    p: p.name, a: p.area || '', k: p.kind || 'food',
    n: clamp(now),
    u: clamp(usual ?? r.live?.usual),
    l: r.live?.now != null ? 1 : 0,
  });

  console.log(`  ok ${p.name}: ${now ?? '-'}%${r.live ? ' LIVE' : ''} (usual ${usual ?? '-'})`);
  await sleep(GAP());
}

await ctx.close();

const dead = signedOut >= 3;
if (dead) {
  await tg(
    '🔑 <b>Busy Board — signed out</b>\n\n' +
    'The phone lost its Google session.\n\n' +
    'On the phone: open Termux:X11, then in Termux run\n' +
    '<code>bb-login</code>'
  );
}

try {
  const res = await post('/api/ingest', {
    src: 'phone', stamp: t, bucket: b, busy, curves, signedOut: dead,
    note: `ok=${busy.length} nochart=${noChart} err=${errors} signedout=${signedOut}`,
  });
  console.log('ingest:', JSON.stringify(res));
} catch (err) {
  console.error('ingest failed:', err.message);
  process.exit(1);
}

const live = busy.filter((r) => r.l).length;
console.log(`[${t}] done — ${busy.length} stored (${live} live), ${noChart} no-chart, ${errors} err`);
process.exit(dead ? 2 : 0);
