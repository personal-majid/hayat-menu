import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const HOME = process.env.HOME || '/data/data/com.termux/files/home';

export const PROFILE_DIR = process.env.BB_PROFILE || path.join(HOME, '.busyboard-profile');
export const CHROMIUM =
  process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am..11pm

/* --------------------------- IST time --------------------------- */
/* The phone may be on any timezone; everything stored is IST. */
const p2 = (n) => String(n).padStart(2, '0');
const ist = (d = new Date()) => new Date(d.getTime() + 330 * 60_000);

export function stamp(d = new Date()) {
  const x = ist(d);
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())} ` +
         `${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}:${p2(x.getUTCSeconds())}`;
}
export function bucket(d = new Date()) {
  const x = ist(d);
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}T${p2(x.getUTCHours())}`;
}
export const istHour = (d = new Date()) => ist(d).getUTCHours();
export const istDay = (d = new Date()) => DAYS[ist(d).getUTCDay()];

/* --------------------------- browser --------------------------- */

// One Chromium user-data dir = the saved Google session. Lives on the phone,
// survives reboots. Login writes it; the hourly job only reads it.
const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Mobile Safari/537.36';

export async function openBrowser({ visible = false } = {}) {
  if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });
  if (!existsSync(CHROMIUM)) {
    throw new Error(
      `chromium not found at ${CHROMIUM}\n` +
      `run:  pkg install x11-repo && pkg install chromium`
    );
  }

  return await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: CHROMIUM,
    headless: !visible,
    viewport: visible ? null : { width: 1280, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    userAgent: UA,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

export const placeUrl = (placeId) =>
  `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}&hl=en`;

/* ------------- the reader: ported from busy-board core.js ------------- */

export async function readPlace(page, placeId) {
  await page.goto(placeUrl(placeId), { waitUntil: 'domcontentloaded', timeout: 45_000 });

  return await page.evaluate(
    ({ DAYS, HOURS }) =>
      new Promise((resolve) => {
        const deadline = Date.now() + 20000;
        const tick = () => {
          const groups = [...document.querySelectorAll('.g2BVhd')].slice(0, 7);
          if (!groups.length) {
            if (Date.now() > deadline)
              return resolve({
                error: /limited view of Google Maps/i.test(document.body.innerText)
                  ? 'signed-out'
                  : 'no-chart',
              });
            return setTimeout(tick, 500);
          }
          const week = {};
          let live = null;
          groups.forEach((g, i) => {
            const byHour = {};
            g.querySelectorAll('[aria-label]').forEach((el) => {
              const l = el.getAttribute('aria-label') || '';
              let m = l.match(/(\d+)% busy at (\d{1,2})\s?([ap])m/i);
              if (m) {
                byHour[(+m[2] % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0)] = +m[1];
                return;
              }
              m = l.match(/Currently\s+(\d+)%\s+busy,\s+usually\s+(\d+)%\s+busy/i);
              if (m) live = { now: +m[1], usual: +m[2], dayIdx: i };
            });
            week[DAYS[i]] = HOURS.map((h) => (h in byHour ? byHour[h] : null));
          });
          if (live && week[DAYS[live.dayIdx]])
            week[DAYS[live.dayIdx]] = week[DAYS[live.dayIdx]].map((v) =>
              v === null ? live.usual : v
            );
          for (const d of DAYS)
            week[d] = (week[d] || HOURS.map(() => 0)).map((v) => (v == null ? 0 : v));
          resolve({ week, live });
        };
        tick();
      }),
    { DAYS, HOURS }
  );
}

/** Usual busyness AT THIS HOUR, from the weekly curve. */
export function expectedNow(week, at = new Date()) {
  const hi = istHour(at) - 6;
  const curve = week?.[istDay(at)];
  if (Array.isArray(curve) && hi >= 0 && hi < curve.length && curve[hi] > 0) return curve[hi];
  return null;
}

/* --------------------------- transport --------------------------- */



/* v2 (Nov 2026): with no WORKER_URL the phone writes straight to the Hayat database (project h-menu, public web key,
   open rules) — the same documents the Chrome extension writes, read by the owner app's Competitors page:
     crowd/{placeId}             latest reading + weekly curve
     crowd_hist/{business day}   p.{placeId}.{HH} = {now, usual, at}   (live readings only)
     settings/crowd_health       last run: when, how many live, signed out?
   The list of places comes from settings/competitors.list (edited in the owner app), else the built-in list. */
const FS = 'https://firestore.googleapis.com/v1/projects/h-menu/databases/(default)/documents/', FK = 'AIzaSyA48aGGeEvg9lyVzeTX5fPIA21SrMZQPn8';
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'string' ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const dec = v => 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec)
  : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : null;
async function fsPatch(path, obj, mask){ const q = mask.map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const r = await fetch(FS + path + '?' + q + '&key=' + FK, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: enc(obj).mapValue.fields }) });
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200)); }
const bizDay = (d = new Date()) => { const x = ist(d); if (x.getUTCHours() < 5) x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

const base = () => (process.env.WORKER_URL || '').replace(/\/+$/, '');

export async function post(pathname, body) {
  if (!base()) return toDb(body);
  const res = await fetch(`${base()}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.API_TOKEN || ''}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function toDb(body){ const at = new Date().toISOString(), day = bizDay(), hh = String(istHour()).padStart(2, '0'); let ok = 0;
  for (const r of body.busy || []) {
    const latest = { name: r.p, area: r.a || '', kind: r.k || 'food', now: r.l ? r.n : null, usual: r.u, at, week: (body.curves || {})[r.place_id] || null, src: 'phone', robot: '' };
    await fsPatch('crowd/' + r.place_id, latest, Object.keys(latest));
    if (r.l) await fsPatch('crowd_hist/' + day, { p: { [r.place_id]: { [hh]: { now: r.n, usual: r.u, at } } }, n: { [r.place_id]: { name: r.p, area: r.a || '', kind: r.k || 'food' } } },
      ['p.`' + r.place_id + '`.`' + hh + '`', 'n.`' + r.place_id + '`']);
    ok++; }
  const live = (body.busy || []).filter(r => r.l).length;
  await fsPatch('settings/crowd_health', { at, src: 'phone', places: ok, live, signedOut: !!body.signedOut, note: body.note || '' }, ['at', 'src', 'places', 'live', 'signedOut', 'note']);
  return { ok, live, day, hour: hh };
}

export async function getPlaces() {
  if (base()) { const res = await fetch(`${base()}/api/places`); if (!res.ok) throw new Error(`/api/places -> ${res.status}`); return await res.json(); }
  try { const r = await fetch(FS + 'settings/competitors?key=' + FK); if (r.ok) { const j = await r.json(), L = (dec({ mapValue: { fields: j.fields || {} } }).list) || [];
      if (L.length) return L.filter(x => x.placeId && !x.off).map(x => ({ place_id: x.placeId, name: x.name, area: x.area, kind: x.kind || 'food' })); } } catch (e) {}
  const { PLACES } = await import('./places.mjs');
  return PLACES.map(x => ({ place_id: x.placeId, name: x.name, area: x.area, kind: x.kind || 'food' }));
}

export async function tg(text) {
  const token = process.env.TG_TOKEN;
  const chat = process.env.TG_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML',
                             disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
