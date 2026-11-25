/**
 * One-time Google sign-in, on the phone's own screen.
 *
 * Needs Termux:X11 running (the app, plus `termux-x11 :0 &`). Chromium opens
 * in that window, you sign in with your fingers, and the profile on disk keeps
 * the session from then on.
 *
 *   node login.mjs           sign in
 *   node login.mjs --check   just report whether the session is alive
 */
import { openBrowser, readPlace, PROFILE_DIR, tg, sleep } from './lib.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const PROBE = process.env.BB_PROBE_PLACE || 'ChIJ6e-dHwDLpzsRJqS5O3bgSV8'; // Hayat

async function probe(ctx) {
  const page = await ctx.newPage();
  try {
    const r = await readPlace(page, PROBE);
    return {
      alive: r.error !== 'signed-out',
      detail: r.error || 'ok',
      live: r.live?.now ?? null,
    };
  } catch (err) {
    return { alive: false, detail: String(err).slice(0, 200) };
  } finally {
    await page.close().catch(() => {});
  }
}

if (CHECK_ONLY) {
  // Headless, exactly as the hourly job runs it — so the check reflects reality.
  const ctx = await openBrowser({ visible: false });
  const s = await probe(ctx);
  await ctx.close();
  console.log(JSON.stringify(s));
  process.exit(s.alive ? 0 : 1);
}

if (!process.env.DISPLAY) {
  console.error('DISPLAY is not set.');
  console.error('Open the Termux:X11 app, then in Termux run:');
  console.error('  termux-x11 :0 &');
  console.error('  export DISPLAY=:0');
  process.exit(1);
}

console.log(`profile: ${PROFILE_DIR}`);
console.log('Opening Chromium on the phone screen. Sign in to Google, then leave it.');

const ctx = await openBrowser({ visible: true });
const page = await ctx.newPage();
await page
  .goto('https://accounts.google.com/ServiceLogin?continue=https://www.google.com/maps', {
    waitUntil: 'domcontentloaded',
  })
  .catch(() => {});

const DEADLINE = Date.now() + 20 * 60_000;
let alive = false;

while (Date.now() < DEADLINE) {
  await sleep(15_000);
  const s = await probe(ctx);
  console.log(`  check: ${s.detail}${s.live != null ? ` (live ${s.live}%)` : ''}`);
  if (s.alive) { alive = true; break; }
}

await ctx.close();

if (alive) {
  console.log('✓ signed in — the profile is saved, hourly runs will use it');
  await tg('✅ <b>Busy Board</b> — phone signed in to Google. Collection active.');
} else {
  console.log('✗ still signed out after 20 minutes');
}

process.exit(alive ? 0 : 1);
