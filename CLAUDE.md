# Hayat menu — working rules for this repo

## Pushing
Majid has authorised automatic pushing **for this repository only**.
When a change passes its tests, commit and push it, then say what went
out. Do not wait to be asked. His general "ask before pushing" rule
still applies to every other project.

If the push is refused with *"not in this session's authorized
repository set"*, the repo has not been attached as a source for that
session. Say so plainly and hand over SHIP.bat rather than pretending
the change is live. A Cowork session with no `device_bash` tool cannot
run git at all — say that plainly too.

## Before saying anything is live
Check the deployed file, not the local one. Several times this project
has had a version number bumped while the code behind it was stale:

    curl .../sw.js         -> the cache version
    curl .../shop.js       -> grep for the feature you just added

A version number is not evidence. The code is.

## Syncing to Majid's machine
`device_commit_files` has been seen to write a **stale copy** when the
same staged path is reused. Always stage under a fresh directory
(`/mnt/user-data/outputs/v<NN>/`) and read the file back with
`device_stage_files` to compare the byte count before telling him to
commit.

## The site
- One page, hash routed. `index.html` holds the app and inlines the
  data files; run `python3 build.py` after editing config/menu/lang.
- Bump `const CACHE` in `sw.js` every release or nothing updates.
- `shop.js` holds cart, orders, riders, and the consoles. It is one
  big IIFE; the only globals are `window.SHOP` (store, route, and a
  few test hooks) and `window.MENU`.
- Firebase project is **h-menu**. `firebase.json` + `.firebaserc` are
  set up, so `npx firebase deploy --only firestore:rules` works.

## The counter — #/admin/pos
A till for staff, added Oct 2026. Four research findings decide its
shape; they are written out at the top of the POS section in
`shop.js` and should not be undone casually:

- **The usual grid is frozen.** Computed once per page load from past
  sales (`posFavourites`) and never re-ranked while somebody is using
  it. CommandMaps (Scarr & Cockburn, CHI'11): a spatially stable flat
  layout was 34% faster than menus, errors 0.6% vs 9%. Live
  re-sorting destroys exactly that.
- **Never more than two taps.** Zaphiris depth-vs-breadth: 8x2 took
  20.3s, 2x6 took 36s. Picking a category SHORTLISTS the grid in
  place — it does not navigate and does not move the scroll.
- **Search beats the category.** Typing searches the WHOLE menu; the
  open category steps aside visibly, with a one-tap chip to narrow it
  back. A search that silently only looked inside the open category is
  the classic failed search.
- **Tiles are at least 1cm square** (96px). Parhi/Karlson/Bederson.

Other counter facts:
- Three modes: takeaway / dine-in / delivery. Dine-in needs a table,
  delivery needs phone + address, takeaway needs nothing.
- **Tokens are generated, not typed**: `posNextToken()` reads the
  highest `token` on today's orders and adds one.
- "Who it is for" is folded shut; the token leads the panel. Majid
  asked explicitly that a name field not sit at the top.
- **Open bills** strip at the top of the panel lists every live order
  (any source, not delivered or cancelled). Edit resumes it onto the
  till; Place becomes Update bill.
- Updating an open bill sends the kitchen **only the delta**
  (`posDelta`), not the whole meal again.
- **Workflow (v205).** Send KOT is guarded: it says why it is off
  ("No changes", "Pick a table"). Every line keeps `at`/`by`/`rounds`;
  every KOT goes in `o.kots` (kind kot|cancel) and every edit in
  `o.edits`. Removing a sent item needs a reason and prints a CANCEL
  ticket. Bill = preview then Print bill (`dueAt`, `dueCount`), then
  Settle. F2 / "Open bills" = full-screen board (`posBoard`).
- **Kitchens** live in `settings/print.kitchens` (name, printer IP,
  copies, cancel tickets on/off, categories, items, default). Printers
  are mirrored to the old main/front keys for older print agents.
  The KDS maps dishes by name separately. `tests/pos-flow.test.js`
  is the end-to-end simulation (40 checks).
- **KOT chips**, one per kitchen the items reach, from the existing
  `kotStation()` main/front split. Preselected from `autoKot()`.
  Nothing prints that is not lit. `printJob(o, kind, auto, only)`
  takes the station list.
- All of it writes to the same `orders` collection the website uses,
  marked `source:"counter"` with `mode` and `token`. There is no
  second database: the KDS, the print agent, the riders and the day
  ledger all read `orders`.

## Owner forecast - tuned Oct 2026 (v208)
Tuned by replaying every hour of 1 Sep - 9 Oct with the app's own code
(sandbox: /home/claude/fsim, model.py mirrors fcModel0/fcLive to within Rs 0.50).
Day-total miss 12.1% -> 8.8% on 25 Sep-9 Oct, 9.9% -> 7.4% on unseen days.
- Base: same weekday, last 6 weeks, weighted x0.7 per week back, trimmed.
- Spike guard (fcHours): a past hour over 2x its weekday-hour median is cut to 2x.
- Growth: last 28 days vs the 28 before, full weight, capped +-15%.
- Salary days 1st-4th: lift learned from past months. A holiday and a salary
  day do not stack (the bigger counts) - 2 Oct 2026 overshot by 23% when stacked.
- Live: rest of the day moves by a QUARTER of today's pace (share*0.25).
  Full pace overshot badly (8 Oct: app said Rs 1.10L at 16:51, day ended 81K).
- Week-of-month, busy/slump hours, last-3-hours pace, Prophet: tested, no gain.
- PRE-BOOKINGS: any bill over Rs 4,000 counts as a pre-booking (isLarge, PRE)
  unless LARGE says large:false ("Not a pre-booking"). Past days are scanned
  once by preScan() into settings/large_orders (s = days checked). Expected
  pre-bookings: vm_prebook/{day}.e; the forecast adds max(entered, billed).
- v209: Tomorrow tile (tmCard, fcModel of the next day + its pre-bookings,
  +-25% range). fcModel0 only learns from FINISHED days (d<bizToday).
  Replay screen shows "Forecast made at hh:mm" (fcAt): next hour, next 2 hours,
  day close, each against what really happened. 5-method replay (A old, B v208,
  C clean history, D similar days, E mix): B/C/D/E all ~9%, none clearly better,
  so B stays. Patterns page rewritten in plain words; its own ptForecast card is
  gone - "Next 7 days" uses fcModel, so there is one forecast in the app.
- v210: month TURN (29th-4th) replaces salary 1st-4th (+14%/+17% vs a normal
  same weekday, Jul-Oct); mid-month (8th-21st) dip learned and counted at half;
  a dip multiplies with a holiday, only boosts use max(). Hour shape smoothed
  0.1 to each neighbour. Replay: day 8.8->8.0%, unseen 7.4->5.8%, 2-4pm at 2pm
  25->22.5%. Hour-by-hour method switching (B/C/D) won on tuning days only and
  lost on unseen days - not used. Floor: even knowing the day total exactly,
  the next-2-hours miss is ~25% (bills land when paid).

## Money tab - expenses (v211)
`expDaily(pay,P)`: money paid OUT day by day for the chosen period, split goods
(paid to suppliers) / salary / other, one stacked bar per day, a day list with
every entry. Majid: supplier bills duplicate the item-wise purchases, so the old
"supplier bills vs paid out" chart (spDaily) is no longer shown. payKind also reads
the remarks for salary/wages. Days with a possible duplicate entry carry "2x".

## Cash tab (v212)
Built on the existing chain (vm_cash/{day}_{open|close}, cashChain). The TOTAL
(cash + bank) is what is judged - customers pay cash for someone's GPay and back,
so a cash/bank split difference is not a loss. "Money with us" card: total now,
corrections (every actual entered, with short/over), Set opening balance (any
date, start of day) and Enter actual. Day table: opening, + cash, + card/UPI,
- paid out, = should be, actual, difference (short red / over green / within
Rs 100 = matches). Split bills use the record's cash/card/credit fields.

## Replay - Floor view (v213)
Isometric canvas (isoPlan/isoPeople/isoDraw, RP.view 'iso'). People come from the
bills only: a dine group walks in at createdAt, sits at a table of its section
(bills often have table=null, so a free table of that section is assigned), a
waiter walks over at every KOT and at dueAt, the group leaves at settledAt.
Counter customers queue at the counter, riders pick up at dispatchAt/dueAt.
pax is never entered: group = bill / Rs 350 (1-6). rpTick does NOT rebuild the
canvas each tick (no flicker); requestAnimationFrame interpolates the clock.
Phones: canvas is >= 760px wide inside a sideways scroller. CCTV: declined for now.

## Service sim (sim.html) - data source (v214)
The old "Hayat VMENU Sync" task (vmenu_sync.py -> vm_bills / vm_days / vm_open)
stopped, so the sim showed only today with 0 bills. The sim now reads what the
"Hayat Day Log" task writes: vm_meta/days (every day, newest first, up to 120)
and vm_daylog/{day}. Only dine-in bills (kind 'dine'); staff food, counter and
delivery are left out (Majid). dl2bill() maps a day record to the old bill shape;
past days are cached in IndexedDB under 'dl:'+day (old empty vm_bills copies
are ignored). Live tab: today's vm_daylog doc gives settled bills, open tables
and "last synced" (doc.updatedAt).

## Owner Today tiles + outlook + running total (v215)
- KPI order: Sales today, Unrealized (2nd, Majid), then Forecast + Tomorrow.
- Forecast/Tomorrow tiles are optional: "◔ Show" tile / "Hide forecast"
  (localStorage 'hayat-fc'). Hiding only hides the boxes; charts (Sales by
  hour overlay, Running total) always keep the forecast. fcToday() is no
  longer gated by FC.
- Outlook bar under the tiles (only when shown): Pessimistic / Neutral /
  Optimistic (FC_SCN, 'hayat-fc-scn'). fcAdj() moves the rest of the day so
  the total = total x (1 -/+ FC_BAND[hour]) and never below what is sold.
  Tomorrow uses +/-25%. The saved forecast log (fcRecord) is always neutral.
- runLine(): Sales tab "Running total", a step per settled bill, dashed
  forecast to day end (starts with open bills + pre-bookings so it ends at
  the tile's number), shaded likely range, yesterday + usual-weekday lines.
- rs() prints negatives as "−₹12,951". Cash tile: "Cash paid out"; expected
  in drawer shows "—" until an opening balance is set on the Cash tab.

## Service sim video for WhatsApp (v216)
WhatsApp needs H.264 MP4 with the index (moov) at the front. Chrome's
MediaRecorder gave WebM / VP9 / fragmented MP4 at 1080p 8 Mbps, so it failed.
recStart() now builds 1280x720 20 fps ~1.2 Mbps frame by frame with WebCodecs
VideoEncoder (avc1.42001f / 4d401f / 640028) + assets/mp4-muxer.esm.js
(fastStart in-memory), same as the owner replay. Then "↗ Share to WhatsApp"
(navigator.share files) + Download. Old browsers fall back to real-time
MediaRecorder and say when the file is not H.264. Playwright's Chromium has no
H.264 encoder: t-simrec.mjs with VP9=1 swaps RV.mux='vp9' to test the path.

## Owner menu, rain, Sales time slider, top items (v217)
- Menu: the day pill (‹ date ›) is in the top bar; the bottom is one row of
  tabs Today · Sales · Money · Insights · More that slides away while
  scrolling down (#dock.hid) and comes back on scroll up / near the top.
  Money = Cash & bank | Spends, Insights = Patterns | Similar days | Forecast
  lab | Compare (TSUB chip row, .subnav; TLAST remembers the last page).
  More = Replay, Bills, Items + the period chips. Fold button removed.
- Rain: Open-Meteo forecast API (free tier = non-commercial, CC-BY 4.0;
  Majid chose "free for now" 10 Oct 2026 - switch to the paid API Standard
  plan before relying on it). Owner app pulls on open and when the last
  pull is over 6 h old (checked every 30 min): first pull 92 past days, then
  7. Stored in settings/weather {at,src,lat,lng,days:{date:{r:[24 x0.1mm],
  p:[24 %]}}} by clock hour IST, max 400 days. Shown under Sales by hour
  (wxNote) and on the Tomorrow tile. Not used by the forecast yet - the
  rain-vs-sales check comes first.
- Sales time slider: "⏱ Time slider" chip on the Sales tab, hidden until
  tapped. The row lives in the dock (#dockTime) so dragging survives redraws;
  it sets TCUT, so the whole page shows the day as of that minute. Steps
  5 / 10 min or Smooth (1 min every 60 ms on Play). Closes when leaving Sales.
- Top items (Items + Sales tabs): share strip Top 5 · Next N · Others and
  ranked bars Top 10/15 + Others ('hayat-topn'). Colours = dataviz reference
  slots 1-3, validated light and dark. No pie: 16 slices can't be read.

## Sales vs spend (v218)
Period view: "Sales vs spend" opens Overview and Money (ssCard): totals Sales /
Spend / Net / days spend > sales, a bar pair per day (tap = open the day) and
running totals as two lines. Overview also has "month by month" (ssMonths, last
6 months, with a Month/Sales/Spend/Net table). All from the day index
(INDEX[d].rev, INDEX[d].paidOut = money paid out) - no day docs loaded. Today
uses the live DOC. Colours = dataviz slots 1-2, validated light + dark.

## Spends easier to reach (v219)
Period bottom tab "Money" is now called "Spends". Tapping a day on Sales vs
spend opens that day's spends sheet (spDaySheet: sales of the day, paid out,
supplier bills, every entry, Remove for duplicates, "open the whole day").
The Overview card links "all spends ->".

## Spends by item line, compare days, items pie (v220)
- The cashier now enters each day's spends as ONE purchase bill (supplier
  BARATH TRADERS / CASH) with lines VEGETABLE, K-P CHICKEN, BUILDING RENT,
  PETROL, SALARY... spGrp(name) groups each line: SP_SAL -> Salary, SP_RUN
  (rent, gas, diesel, petrol, auto, waste fee, cleaning, charity...) -> Running
  costs, else Goods. Checked on Oct 2026: 2,55,849 / 57,100 / 1,50,920 =
  4,63,869 total. buildMonth tags lines (SNAP_V 4); a bill whose lines do not
  add up gets a "(not itemised)" line for the gap.
- expDaily(pay,P,sp): a day with bill lines is split by its lines and its
  supplier payments are skipped (same money); a day without lines uses the
  payments (purchase payments sorted by their note).
- Spends page = Expenses day by day (each day opens to its lines), Possible
  duplicates, Spend (opens item by item), Salary, Compare two days (spCompare,
  SPC). Sales vs spend only on Overview; discounts moved to People;
  "by who was paid" only when more than one party.
- Top items: pie (donut) of the top 5 + Others, then ranked bars.
- Oct 2026 duplicate: BARATH TRADERS 32,780 on 3 Oct (purchase 67, 1 line,
  payment 57481) is a broken first save of 2 Oct (purchase 68, 11 lines).

## One menu + spends day by day (v221)
- Bottom menu is the same for a day and for a span: Live · Sales · Spends ·
  Items · More. Day: floor / sales / buy (+ Cash & bank chip) / items; More =
  Replay, Insights (Patterns, Similar, Forecast lab, Compare), Bills. Span:
  Live jumps to today (data-golive), Sales = overview, Spends = money (+ Cash
  & bank chip), Items; More = People, Voids.
- Spends · day by day (expDaily) is the first card on Spends: every date,
  newest first, opens to its lines in spTable (Item · Qty · Unit · Rate ·
  Total · Group · bill/paid to); "open all". Day view Spends starts with
  daySpendCard(DOC) built by spRows(doc) (bill lines + gap + payments no bill
  covers). "Spend · whole period" = the item list for the span.

## Service worker: a page that fails to load shows itself, not the menu (v222)
sw.js used to answer EVERY failed page load (weak signal, GitHub Pages mid-deploy)
with ./index.html, so owner.html "redirected" to the menu. Now each page that
loads is cached and a failed load shows the cached copy of that same page;
index.html only when nothing is cached. Owner URL:
https://personal-majid.github.io/hayat-menu/owner.html

## Sales by hour = ORDER time (v224)
Late-closed deliveries/counter bills (paid 1-6 h after the order, ~Rs 6,355/day,
Rs 2,828 of it in the 00:00 hour - Sep 2026) sat in the last hours by pay time,
and the live forecast ALSO added today's open bills: closing counted twice.
- hbucket() buckets by createdAt (hbucketPaid() keeps pay time). Today's forecast
  hours = paid + open (non-staff) bills in their ORDER hour; fcLive open = 0. fcAt
  the same at minute v. Sales by hour shows open bills hatched in their order hour.
- Past days: ohScan() rebuilds each day by order time from its day log once and
  stores settings/ohours {v:1, d:{day:{h:[24], lg:{billKey:[hour,amt]}}}}; applyLarge
  uses OHS[d].h instead of the shop PC's pay-time hours (x.byOrder) and takes
  large orders out at their order hour.
- Replay, 15 Sep days, same 4-week history: day-close error at 21:00 23% -> 9%,
  at 23:00 14% -> 5% (bias +12% -> 0). fsim/ordertime.py.
- Running total stays at pay time (when money arrives). Later: daylog.py on the
  shop PC could write order-time hours itself.

## Food cost (v225)
Items (day and span): fcostCard - raw material used (chicken kg, rice kg, oil L,
fish kg, beef kg) = dishes sold x amount per plate (recGuess from the dish name:
Full mandi ~ 1 bird + 0.6 kg rice + 0.04 L oil, Half 1/2, Qtr 1/4, fish/beef mandi
1 kg per full, meals 0.25 kg rice...) x price; food cost %, margin, per-dish cost
per plate. "set prices & dish costs" (fcoSheet) -> settings/costing {price, fixed:
{DISH: Rs per plate}, rec:{DISH:{...}}}; a fixed cost per plate wins over the
recipe. Default prices are rough guesses (chicken 220/kg, rice 120, oil 170/L,
fish 650, beef 400) and are labelled "(guess)". Span view also shows goods
actually bought / sales as the reality check (Oct 2026: 34%).

## Closing time + one-hand date (v226)
- settings/shophours {close:'00:30', dow:{'0'..'6':'HH:MM'}}; closeMin(day) = minutes
  after 05:00. fcLive: nothing forecast after closing; the hour we are in only for its
  minutes before closing; "next hour" 0 after closing. "closes 00:30 · change" in the
  outlook bar opens hoursSheet (per weekday, with "last order usually" from cached logs).
- Date: tap the date = calendar straight away (calPop) with Today / This week / This
  month / Last month / Range chips. "›" hidden on today. Phones (<=640px): placeDay()
  moves .tday into #dock above the tabs (thumb reach, hides with the tabs); desktop:
  top bar.

## Outlook spread only on what is left (v227)
fcAdj used to set total = day total x (1 +/- band) and stretch the remainder to get
there - at 1:14 am a few hundred rupees of "rest" became +9% of the day. scnMult(F):
spread = band x total but at most the remainder itself (rest x0..x2). After closing
the three outlooks equal what was sold. runLine's likely range uses the same rule.

## Road traffic on Live (v228)
trafficCard(): TomTom Routing (free tier 20K requests/month, no card) for
settings/traffic {key, routes:[{n,a:[lat,lng],b:[lat,lng]}]} (default
Perinthalmanna <-> Malappuram). Read on open and every 10 min at most (cached in
localStorage 'hayat-trf'); now vs no-traffic minutes, delay, busy / some / clear.
Majid pastes his own key in "routes & key". Live crowd (Google popular times)
cannot run inside a web page (cross-origin + Maps blocks iframes) - stays in the
busy-board extension / Android collector.

## TomTom key fallback (v229)
trfKey(): settings/traffic.key (pasted in the app) first, else config.js
CONFIG.traffic.tomtomKey (already there - the menu map uses it), else CONFIG.tomtomKey.
Never write keys for Majid. Readings are cached per device only (localStorage).

## Staff login — roles, not just "office"
`crew/_list` gives names and roles; `crew/<id>` holds the code, which
the browser never sees. Signing in writes `staff/<uid>` and the rules
check the code and role against the crew record.

- `gateRoles(main, ["office","captain","waiter"], then)` is the door.
  `gate(main, then)` is the office-only shorthand.
- `STORE.signInCrew(who, code, roles, name)` tries each role the door
  accepts and keeps the first the rules allow. `STORE.signOutCrew()`
  drops the identity (a new anonymous uid).
- **Crew sign-in survives a reload** because boot reads `staff/<uid>`
  for anonymous users too. It did not before; only the office did,
  via sessionStorage.
- `isCrewRole()` / `myVoice()`: a waiter is crew, not a customer.
  Before this, counter sales were filed under the waiter's own orders
  and offered them the customer's cancel button.
- `dockAllows()` hides what a role may not open.
- Staff & codes lives in the Cleaning page (clean.html), office only.
  It already issues captain and waiter roles.

## Tests — tests/
    TEST.bat          all three suites
    RULES-TEST.bat    the rules only
    RULES-SHIP.bat    test, then publish to h-menu
    RULES-PUBLISH.bat publish without testing (no Java on the PC)

`counter.test.js` and `login.test.js` are Playwright; they serve the
repo folder itself on a spare port and swap the store for a stub, so
they never touch Firebase. Green = exit 0, so they drop into CI.

`rules.test.js` needs the Firestore emulator, which is a **Java**
program. Windows usually has no Java — that is why RULES-SHIP once
looked broken. It has never been run; treat the strict rules as
unverified.

## Traps that have already cost time
- **More than one Claude thread works on this folder.** On 7 Oct a
  thread wrote its own `shop.js` + `firestore.rules` over Majid's
  folder and silently erased another thread's counter (#/admin/pos)
  and staff-login work; it was restored by a 3-way merge on 8 Oct.
  Before writing ANY file to the PC: stage the PC copy first, and if
  it differs from the version you started from, merge — never
  overwrite. `git fetch` the SHIP snapshots too: they show what the
  other threads shipped.
- `index.html` declares `let L` for the language code. That shadows
  `window.L` for every later script, so Leaflet must be reached as
  `window.L`. A bare `L.map` is a string.
- The cart button is `display:flex`, so `[hidden]` does nothing to it
  without an explicit `#cartfab[hidden]{display:none}`.
- Python heredocs: a literal `·` in shop.js will not match `·`
  written in the patch. Match the real character, or edit by line.
  This has now bitten twice — once on `·`, once on `…` and `★`.
- **Reserved data- attributes.** `index.html` has a document-level
  click handler claiming `data-tab`, `data-go`, `data-var`,
  `data-star`, `data-start`. A counter tab named `data-tab` was
  swallowed by the gallery and navigated away mid-order. The counter
  uses `data-poscat` for this reason.
- `isTyping()` guards REPAINT so a cloud update cannot yank a
  half-typed field away. It must not guard the FIRST paint of a page:
  arriving with focus in a box elsewhere left the counter unpainted.
- A slow `STORE.crew()` read used to paint the sign-in box over
  whatever page you had navigated to. `gateRoles` now abandons a
  stale fetch by comparing `location.hash`.
- The counter styles come from the app.css palette vars
  (`--card`, `--line`, `--accentwash`, the `--t-*` scale). The first
  cut guessed a dark palette and looked wrong on the paper skin the
  restaurant actually runs.

## Rules — deliberately open
Majid has decided to **leave the live Firestore rules open**
(`allow read, write: if true`) because this is a hobby project. That
is his call and it is not a bug to fix unasked.

What that means, and what to say if it comes up:
- Everything works. No deploy is needed for any feature.
- Staff codes are **not** checked — the check lives in the rules. Any
  name plus any digits signs in, including as office.
- `customers` (names, phones, home addresses) is world-readable, and
  the project id is in `config.js` on the public site.
- `firestore.rules` in this folder is the full strict version and is
  NOT what is live. A lite middle version was offered: open
  everything except `crew`, `staff` and `customers`.

## Still open
- The office passcode is `1234`, in plain JavaScript (offline path
  only, but change it).
- `crowd/{place}` accepts any write carrying the literal word
  `ROBOT_WORD` — change it in the rules and the crowd robot together.
- `config.js` instagram handle is still the placeholder.
- The counter's "usual" grid falls back to menu order until counter
  sales exist, so it shows every size of the same dish at first. It
  self-corrects after about a day of use.
- 12 menu categories; research says 9 or fewer. Sides / Juices /
  Desserts are the obvious merge.

## v231 — 4-week weekday level · hourly traffic log
- fcModel0: day LEVEL = last 4 same weekdays (FC_VARIANTS on same.slice(-4)); HOUR PATTERN = last 6 (trimmed mean when ≥5), scaled to the level. Sunday 11 Oct ≈ ₹85K (old ≈ ₹77K). 51-day bias −10.8% → −4.9%.
- trfLog(out): after each successful TomTom read, saves once per clock hour to settings/trf_YYYY-MM → {d:{YYYY-MM-DD:{HH:{at, r:[{n,now,free,delay}]}}}} (merge). Missed hours are fine. In-memory TRF_LOGGED guards repeats; failures retry next read.
- Future: join trf_* with order-time hours (settings/ohours) to test traffic delay as a forecast signal once a few weeks exist.

## v232 — Full-only dish costs · monthly fixed costs · profit
- sizeOf(name): "X FULL/HALF/QTR" → family X, size 1/½/¼. settings/costing.full[family] = Full cost; Half = ½, Qtr = ¼ (fixed, Majid's choice). Old per-size `fixed` entries move into `full` on next save.
- fcoSheet: one row per dish family, every dish sold in the view (no top-30 cap), search box, live Half/Qtr preview. Per-dish raw-material inputs removed (old `rec` still honoured).
- settings/costing.oh = monthly {salary, rent, power, gas, other}; ohSheet. fixOf(k) (not ohOf — that's order-hours).
- profitBlock in the Food cost card: Sales − goods bought (period spends; day view = food-cost estimate) − salary (monthly × days/30; blank = spends paid) − running costs (spends) − rent/power/gas/other × days/30 = net; break-even sales/day = fixed per day ÷ (1 − goods%).

## v233 — fixed costs shared across dishes
- fxMonth(m): month of the viewed day/period, via monthDoc (cached 30 min; cleared when settings/costing changes). Fixed so far = salary (spends paid this month, or monthly × days gone/days in month if entered) + running (spends) + rent/power/gas/other × days gone/days in month. pct = fixed ÷ month sales so far.
- Food cost card: "Fixed costs share" tile; per dish: Food / plate, Fixed share (= price × pct, i.e. by sales value — Majid's choice), Profit / plate.
- Day-view profit block: salary/running fall back to month-so-far ÷ days gone.
- Early in the month the % runs high when salary is paid upfront; it settles as sales build.

## v234 — gas from spends
- SP_GAS (/\bgas\b|lpg|cylinder/i): spendSplit puts these lines in their own `gas` bucket (out of running / goods). Manual Gas box removed from monthly costs (FCO.oh.gas ignored). Gas counts in the fixed-cost share and shows as "− Gas (LPG) · from spends" in the profit block.

## v235 — monthly costs list · bulk ₹/day · weights
- Salary is AUTOMATIC from spends (FCO.oh.salary override dropped). FCO.ohl=[{n,v}] = lines paid outside the app (extra salaries, outside rent, power…) ₹/month → × days/30 in profit, × days gone/days in month in the fixed share. Old FCO.oh rent/power/other read as lines until first save.
- FCO.bulk = rice/oil/masala ₹/day. When set, SP_BULK purchase lines go to a `bulk` bucket and are left out of goods; profit adds bulk × days; day view uses the food estimate without rice & oil.
- Weights: FCO.wt {birdKg, rice, oil, fish, beef} per Full mandi (WT()); FCO.recF[family] = a dish's own kg per Full (⚖ in the dish sheet), Half/Qtr scale ½/¼. recOf: rec[exact] → recF[family] → recGuess.

## v236 — Tomorrow lab (Live tab)
- tmCardBig(): Tomorrow · <day>. Methods: A) days like today (tmMatch: half money so far, half running total, on fcHours) → their NEXT day's nrev; B) last 4 / 8 days on tomorrow's weekday; C) fcModel(t).plan. Filters (TMR.f): same weekday / any day / same situation (dayTags SK flags), top 5/10/15; saved in localStorage 'hayat-tmr'.
- dstats(): n, median, mean, SD (+CV), P25–P75, min–max. NOTE: `stats()` is the app's day-stats function — do not reuse the name.
- tmBacktest(): last 30 finished days, each method using only data before that day (A uses the full previous day). Off by = mean abs % error (+bias); Inside range = share of actual within P25–P75 (C uses ±25%). Best guess = lowest error with ≥8 replayed days.
- Hour band: P25/median/P75 of fcHours over the last 8 same weekdays (SVG).
- Viewing a past day: Tomorrow = the next day; only data before the viewed day is used, and the actual is shown.

## v237 — Juice counter (Items, day + period)
- juiceCard(itemMap, byDay): bills have no drink category, so names decide. DR_SOFT (brands/bottles) wins over DR_JUICE (juice/lime/mojito/shake…). Cost lines: DR_JCOST (fruit, lemon, mint, ice, sugar…) → juice; DR_SOFT → bottled. Milk left out (also tea/kitchen).
- Bottled drinks are bought one month and sold the next → their cost % is over the last 3 months: drink3m() sums month snapshots (monthDoc, cached 30 min). Day view spend lines via dayLines(DOC) (spRows).
- "What was matched" lists every name used, so wrong matches are visible.

## v238 — tab carry-over · DM notes are deliveries
- tabCarry() (start of render): switching day ↔ period keeps the same kind of tab (sales↔overview, buy↔money, cash↔cash, items↔items; Live → Sales). Only when the caller did not set TAB/PTAB itself.
- DELIV_WORDS (/^(d\.?m+\w*|hd|h\.d|deliver…|zomato|swiggy)/): counter bills with such a note are kind 'delivery' (r.viaNote), never staff. Before, "DMM"/"dmmm" ≤ ₹300 fell into staff food (ORDER_WORDS only had dm\b). No "not dispatched" alert for viaNote bills.
- SNAP_V 5: month snapshots rebuild so sales include those bills.

## v239 — bills list: Where
- secOf(r) in the bills list (wide table "Where" column + phone card): Delivery / Counter / the section in title case (Ac, Non Ac, Hut, Juicy Hut, Parcel; FLOOR table section if the record has none); dine bills with a section but no table get "· no table" (waiters skipping the table number, mostly Non AC).

## v240 — traffic history
- trfHist(): "history" link on the Road traffic card. Reads settings/trf_YYYY-MM for this + 2 previous months; grid = days (newest first) × clock hours in business order (from BH0), cell = extra minutes (delay, or now−free) for the chosen route; "Usual" row = average per hour; day sales (nrev) beside each day; tap a day to open it. Green <4, amber 4–9, red ≥10.
- Readings exist only for hours when the app was open (trfLog). Hourly-always needs a Cloudflare Worker cron (offered, not built).

## v241 — traffic hint on the forecast (numbers unchanged)
- trfUsual(): loads settings/trf_* (3 months, cached 1 h), usual extra minutes per clock hour (avg of both routes, today excluded). trfHint() in scnBar: latest reading (≤45 min old) vs usual at that hour → "roads busier / quieter than usual / as usual for HH:00" (busier: ≥3 min and ≥1.4× usual; quieter: ≤−3 min and ≤0.6×); "learning (n/3)" until 3 past readings exist at that hour.
- Deliberately NOT in the forecast math yet (Majid's choice). After 2–3 weeks: measure traffic deviation vs sales-vs-forecast per hour, then add a capped nudge only if it helps.

## v242 — everything by ORDER time, unpaid included
- soldRecs(R,day): settled + open/due (not staff), large orders out. Used by pace (today), running total (steps at createdAt; key shows "incl. ₹X not paid yet"), similar days (simBase). Forecast (fcToday) and hourly bars already did this; history hours (INDEX.hours ← OHS) are order time with large orders removed.
- Sales KPI stays = paid; Unrealized = the unpaid part. Pace today = Sales + Unrealized (test t-pace).

## v243 — "count unpaid bills" tick
- FC_UNP (localStorage 'hayat-fcunp', default on) in the forecast bar (scnBar). soldRecs() honours it, so the forecast (fcToday now uses soldRecs), pace, running total and similar days switch together. Off: paid bills only; Pace title says "paid only".

## v244 — last paid-time spots moved to order time
- fcAt realWin (replay "real next 60/120 min"), large-order hour (lgSet, auto-large), large-order list per hour (LGREV) now use createdAt (settledAt only as fallback). Rule: every hourly stat is by when the bill was MADE.

## v245 — Week on week (Month → Sales)
- weeksData(16): Mon–Sun weeks from INDEX (nrev = large orders out, finished days only); avg a day, % vs the week before, 4-week moving average. Only the current week is "still running" (light bar); older weeks with <4 days of data are dropped.
- weekCard() sits after "Sales by day" in period overview. Forecast details (fcSheet) growth row links to it (#fcWeeks → this month, Sales).

## v246 — new bill + void alerts (in the app)
- alCheck(DOC) on every live vm_daylog snapshot (today only). First snapshot = baseline. New record key → green banner "🧾 New bill · KOT · where · waiter · ₹ · items"; more r.edits than before → red banner "✂ Void · KOT · item from→to (reason) · by". Tap a banner = open the bill (drill). Max 4 banners, bill 15 s / void 30 s.
- Sound: WebAudio two-tone (void lower), unlocked on first tap (phones block sound before a tap); vibrate on Android; tab title flashes.
- 🔔 / 🔕 in the top bar (localStorage 'hayat-alerts'). Only while the app is open; alerts arrive as fast as the shop PC syncs (~1 min).

## v247 — Live tab order · New orders · Days like today
- Live order: New orders → Unrealized (open orders) → Tables → Road traffic → Days like today → Needs attention → Tomorrow → Kitchens.
- newOrders(): bills made in the last 60 min, newest first (5 on phone, 8 on PC): time, minutes ago, where, KOT, waiter, remark, items, ₹, paid / open / bill printed; tap = open the bill.
- likeToday(): compact Similar days for today (simDays rows, current SIM filter): "days like this finished at" range + middle, top 3 matches; tap = Similar days page.

## v248 — new top boxes (release 2 of 4)
- kpis(): .kpis.top4 (2×2 on phone): Sales today paid+unpaid (paid / unpaid + split) · Forecast today (still to come, bills ~N, avg, next hour, ⚙) · Bills paid+unpaid N / ~forecast, avg now vs forecast avg · Next 10 minutes ₹ + bills · Tomorrow. Seats / table time / cash-card / paid out in a second row.
- abRef(day, todayAvg, n): avg bill to expect = blend of today's avg (weight n/(n+25)) and last 4 same weekdays (nrev/bills). Forecast bills = bills now + still-to-come ₹ / abRef. fcNextMin(F,mins): forecast rate for the minutes left in this hour, spilling into the next.
- Unpaid always counted (FC_UNP const true, tick removed). Outlook / closing time / pre-booking / hide moved behind ⚙ on the forecast box (FCSET.open → .fcset with scnBar). Traffic hint on its own line under the boxes. Time slider moved below the hourly chart + running total.

## v249 — quick fixes (release 1 of 4)
- Traffic extra minutes = max(TomTom trafficDelay, travel − no-traffic travel): TomTom's delay only counts reported jams, so history was all 0. History/usual/hint recompute from saved now/free.
- Traffic read every 15 min while open (and at once on open if the last reading is older); trfLog key = 15-min slot "HH:MM" (old "HH" keys still read); history and usual group slots by hour (average).
- trfNote() under the hourly chart (next to rain): roads heavy / medium / light, +min vs normal.
- swipeTab(): swiping the page = next / previous bottom-bar tab (day: Live·Sales·Spends·Items; period: Sales·Spends·Items, swipe right from Sales = Live). Date only via ‹ › / calendar.
- Grids: dotted minor line halfway between labelled lines (yscale bars; runLine + weekCard SVG).
- catCard(): Items by category (name rules CATS; drinks via drKind), <details> per group, open state kept (CATOPEN). In Items tab and Sales tab after Top items. DR_SOFT also matches DEW, COCO COLA, MENIRAL, "ml"/"ltr" sizes.

## v250 — charts (release 3 of 4)
- billsCard() (Sales, after running total): Bills / Guests (footfall) / Avg bill per hour, order time, every non-staff bill paid + unpaid. Today solid with dots; forecast dotted = F.rest ÷ abRef (guests × today's guests-per-bill); usual weekday thin (last 4 same weekdays from OHS b/p/h). guestsOf(r): dine pax when entered, else 1.
- ohOf now also stores b (bills) and p (guests) per hour; ohScan rescans days missing b (office role, once).
- Top boxes and bills chart count the same thing: non-staff bills, paid + unpaid (large orders included).
- itemsOf() includes open/due non-staff bills (top items, categories, food cost, juice counter see unpaid too).
- Compare tab "Last 7 days": today's bar stacks paid + unpaid (hatched) + forecast still to come (dashed).

## v251 — similar days by ₹ / bills / avg bill · replay to closing (release 4, part 1)
- SIM.metric (localStorage 'hayat-simm'): 'amt' | 'bills' | 'avg'. simMetricToday() / simMetricDay() (other days from OHS b/h). Matching (md, cells, running total) uses the metric; "how it ended" (sofar, rest, end) stays in ₹. Days without OHS.b are skipped; a note says how many days are ready.
- rpCurve(): bills at ORDER time incl. unpaid; for today, after now the forecast (F.rest) is added as quarter-hour points (flag p[2]=1, c.fcFrom). Cached 5 s for today. rpEnd() today = closing on the forecast, so Simulate / Replay play and slide to the end of the day; today's line is dashed (.fcl) after now.
- Still to do (part 2): blended forecaster (weekday level, similar-days, trend) weighted by 30-day backtest scores; bills forecast from OHS b once enough days have it.

## v274 — owner: a useful screen before the day's first bill
- render(): no day log for TODAY -> dayStart() instead of the empty "No day log" note (past days keep the note). Cards: ☀️ Today's outlook (fcModel(DAY).plan + preFor pre-bookings, busiest lunch/dinner hour, rain), 🌙 Yesterday / Last open day (lastOpen(): newest INDEX day with sales; nrev, bills, avg, ▲/▼ vs last 4 same weekdays) with Whole day / Items / Spends / Cash, 📅 So far (this week / this month from INDEX, "starts today" when empty) with This week / This month / Last 30 days / Last month (loadPeriod), 🔎 Analysis (Days like…, Replay…, Pick any day). "First bill usually around HH:00" from OHS of the last 4 same weekdays; amber warning when it is past that +1 h and nothing arrived (shop PC / Hayat Day Log). wireDayStart(). Test t-daystart (6).

## v278 — Space planner (planner.html + planner.js + planner3d.js) · first part of the hotel app
- Office drawer "📐 Space planner" (shop.js officeDock key planner; captain/waiter/kitchen/cleaner don't see it). Phone-first, works offline.
- Plan = {v,id:'demo',name,grid:.1,floors:[{id,name,items:[]}],at}. Items in METRES: space {type (STYPES: room, suite, bath, wash, corridor, lobby, reception, restaurant, kitchen, store, clean, laundry, banquet, office, staff, stairs, garden, parking, other), shape rect|circle|tri|poly (pts 0..1 of the box), x,y,w,h,r°, guest rooms: no, cat, beds, guests, rate}; obj {t (LIB/OBJ: bedroom, bathroom, restaurant, kitchen, store, cleaning, lobby — real sizes, height, lift), x,y,w,h,r}; door/window {sp (space id), e (edge), t (0..1), w, side, flip} — openings ride on a space's wall, so they move with it.
- 2D (SVG in screen px): draw Space (type → shape → drag; any shape = tap corners), Door/Window = tap a wall, Objects go into the selected space. Select: drag (10 cm snap + magnets to straight walls), corners resize, ⟳ turn (15°, Shift free), R / Ctrl+D / Delete / arrows / Ctrl+Z,Y. Moving or copying a room carries what is inside (+ its doors); removing a room removes its doors. Floors: add empty / copy (room nos +100) / rename / remove (second tap). Pinch + wheel zoom, ⤢ fit.
- Checks (⚠ n to check, tap = jump): outside every space, through a wall, sitting on another object, no door, guest room without number / duplicate number / <9 m² / no bed / no bathroom / no window, bath without toilet, kitchen without range / sink / fridge / hood, range not under the hood, door blocked (60 cm), guest rooms overlapping.
- 3D: three.js r160 bundled in assets/three (OrbitControls import rewritten to the local file), loaded only on 3D. Floors coloured by type, walls per edge with door gaps + lintel and window sill/lintel + glass, simple objects (beds with pillows, chairs, tables, WC, shower, stairs, hood, burners). Low walls / All floors (stacked) / Top view.
- Saved: localStorage hayat-plan-v1 at once; cloud plans/{id} {name, at, by, json (string — Firestore refuses nested arrays)} when signed in as office/cashier; newer cloud copy loads unless this device has unsaved edits. Menu: Summary (rooms, guests, seats, full-night ₹, area by space), Rooms for booking (the list the booking module will use), demo hotel / blank, rename, PNG, plan file save/open (bad files refused).
- Demo hotel: Ground (lobby + reception, 48-seat restaurant, kitchen with ranges / tandoor / mandi oven under hoods, store, housekeeping, washrooms, stairs + lift, service corridor) + First / Second (10 rooms each 101–110 / 201–210, Standard twin ₹2,400 / Deluxe king ₹3,200, attached bath by the corridor). Every floor passes the checks.
- Tests /home/claude/t-plan.mjs (demo + 3D render), t-plan2.mjs (30: draw, door/window, object, move/resize/rotate, undo/redo, poly/circle/triangle, copy/delete, floors, rooms list, warnings, reload, plan file, PNG, demo all good) at 390 and 1300 px.
- Next: room booking (calendar on these rooms), housekeeping status per room, restaurant tables → captain floor, kitchen planner rules (work triangle, clearances).

## v277 — captain: notes you can't miss · colour · payments v2 (part, credit book, ref, undo, refund)
- Item notes are their OWN field (`lines[].note`), never inside the size label → never on the customer's bill. Kitchen copies (kots[].lines + print jobs) carry `label` = size + "NOTE: …" (old print agents / KDS still show it) + `base` (size) + `note`. Helpers lab0 / kLab / kLine / noteChip.
- 2+ of the same dish: note "Just 1 / n−1 / All" (splits the draft line). Sent dish tap → lineSheet: change note (KDS updates live, printed ticket does not — toast says so; logged in edits kind:'note') or remove.
- Table note `o.note` (📌): ⋯ → Note for this table, or tap the banner; before the first KOT it waits in the draft (onote) and joins the order; on every kitchen ticket note box (tkNote) + KDS (blue 📌 box) + floor tile pin. FIRE keeps the notes.
- KDS: item note = bold amber chip under the dish, lines with different notes never merge.
- print_agent.py draw_kot: prints base + "NOTE: …" bold when present (needs the shop PC agent updated; old agent still prints the label). print.html: customer bill never prints l.note.
- Colour: K-round colours r1–r6 (chip, line edge, qty, kitchen list), tinted Bill / Items / Last KOT boxes.
- Payments v2: modes Cash · UPI · Card · Credit · Split. o.pays on an OPEN bill = part payments (each {mode,amt,at,by,crew,ref?}); bill closes when they reach the total. Cash short → "Take ₹x now · rest stays". UPI/Card: amount pill (part) + optional Ref/UTR. Credit: name (required) + phone (optional, 10 digits 6–9, +91 ok) → `credit{party,phone,amt,at,by,recv[]}` + `creditOpen:true` (queried any day) → Bills → 📒 Credit book (grouped by person, Receive part/full with mode + ref). Undo payment: 10 min for anyone, office/cashier any time; refused if credit money came in, a refund exists, or the table has a new bill; logged in `undone[]`. Refund: office/cashier, ≤ money paid, logged in `refunds[]`. Paid today = money in today (part pays + credit received − refunds; credit given shown apart).
- Tests: capt/t-capt7 (22 notes), capt/t-capt8 (28 payments); t-capt updated (tap dish → Remove).
- Owner simplified: top boxes = 4 (next 10 min inside Forecast; Tomorrow lives in Live → Outlook); "More numbers ▾" folds seats/table time/cash-card/paid out; Live = new orders, alerts, unpaid, tables, ONE Outlook card (☀️ Today | 🌙 Tomorrow tabs, outlook/outWire, remembered), kitchens, More (traffic); Sales = by hour, running total, bills per hour, top items + "More on this day ▾" (breakdown, pace, bill times, waiters, upsell, tables, voids, discounts); Month/range = averages, 3 boxes + More numbers, core cards + "More analysis ▾". moreG(key,title,what,html) + moreWire (state in localStorage hayat-more); Find opens closed More. Plain words: Ordered · not paid yet, Weekly rhythm, Signals (weather, salary days…), Middle day / Swing / Usual range.
- Replay fixes: today's forecast in rpCurve is always made at the REAL now (TCUT/NOW reset around fcToday) and starts after the last real bill; all points sorted → no stray flat line / backwards path when the replay was played from earlier in the day. After now the strip says "Forecast made now (hh:mm) · from <clock>" using the live curve. Open bills at a minute count sum(r) (was ₹0). Test /home/claude/t-v277rp.mjs (5), owner t-v277.mjs (9).

## v276 — owner: averages up front + 🔍 Find from the menu
- Live + Sales: "📊 Average a day" strip right under the top boxes — this week / this month / last 30 days / last 4 same weekdays (full days BEFORE the shown day, from INDEX); ▲▼ % = today's forecast (live, forecast on) or the shown day's sales against each; tap opens that span (avgStrip / avgWin / avgWire).
- Week / month / range: "📊 Averages" band FIRST (perAvg): avg/day vs previous, avg bill + bills/day, Mon–Fri vs Sat–Sun, best + slowest day (tap opens the day); today left out until it closes. The old Avg/day + Avg bill boxes removed from the row below (no duplicate numbers).
- Find: magnifier icon in the menu ("Go to" sheet) only. Bar under the top bar: every match on the page marked, n / N, ↑ ↓ / Enter / Shift+Enter walk them (scrolls to centre, opens closed <details>, pulses the row/card), Esc / ✕ closes and removes marks. Survives live re-draws (fAfter in render). "On other pages" = page names + headings learned as pages are seen (localStorage hayat-find) → tap opens that page at the match.
- Test: /home/claude/t-v276.mjs (19).

## v275 — Stock bill reader never invents lines
- stock-read.js: packet text (MRP / best before / net wt / mfg / batch / www) skipped (RX_JUNK); names must be real words (wordy); amount must be unit-less 1–300000; per-word OCR confidence (ocrLines) — faint item lines dropped (<55) or flagged (<75); photo upscaled + contrast-stretched (prep) before OCR; unknown names kept as written below 0.78 match (no forced dictionary guess); sure() penalises faint / dropped lines and missing total.
- stock.html: every read line has a tick box; doubtful lines (faint, qty×rate≠amount, weak name) start UNTICKED with a reason; amber warning when lines ≠ bill total; "Add n ticked lines" adds only ticked.
- Tests: scratchpad/ocr/parse-test.js (40), capt/t-stock (18), capt/t-stock2 (18, incl. real1.jpg phone photo: 7 true lines, total 4569 ✓).

## v273 — captain: Back is one step · unsent card · bill progress · history · tray while typing · Comfort report · traffic trip time
- omode() honours an explicit mode even with unsent items. backToBill(t): ‹ (data-a="oback") and phone Back go menu -> BILL first when the table has a bill or unsent items, then tables. Bill mode also for a new table with only unsent items (newCard + "nothing sent yet"); dock shows Send KOT there.
- newCard(): amber "🆕 Not sent yet · n" with − / ＋ / note on top of the bill. progHtml(o): Seated → KOT n → 🍳 Cooking → ✅ Ready → 🧾 Bill → 💰 Paid (times; dashed "no screen" when the kitchen screen gives no states; current step pulses). histEvents/histSheet: "🕘 Everything on this bill" - seated, KOTs with items/notes/hold, fire, voids (edits), cancels, moves, bill printed, paid, with time + who.
- tray2(): while typing, a slim "🆕 3 · Porotta ×2, Tea · ₹60 ▴" line above the keyboard (opens the bill sheet); refreshed by orderRefresh.
- Setup → Usage: comfortHtml() "🩺 Comfort report" ranks problems (errors ×5, rage taps ×4, failed searches ×3, undo ×2, dead taps / gave-up searches / slow KOT >90 s ×1.5) with what to try. window.CAPTAIN_COMFORT for tests.
- Owner Traffic history: Extra min / Trip time switch (TRH.show); trip time keeps the extra-minutes colours; "empty road ≈ N min".
- Tests: capt/t-capt6 (9) new; old suites use toFloor() (Back until the tables) and '.ordbar [data-a="billsheet"]' (tray2 shares the action). t-capt 39, t-capt2 37, t-capt4 18, t-capt5 11, t-kds 15, t-setup 16; owner t-trf3 3.

## v272 — bill photo -> item lines (free on-phone reader, AI only as fallback)
- stock-read.js (window.StockRead; also module.exports for node tests): ocr() = Tesseract.js 5.1.1 BUNDLED in assets/ocr/ (tesseract.min.js, worker.min.js, tesseract-core-simd-lstm.wasm.js + tesseract-core-lstm.wasm.js, eng.traineddata.gz; ~11 MB, loaded only when a photo is read, nothing leaves the phone). parse(text) -> {isBill, why, supplier, date, billNo, lines[{raw,q,u,r,a,ok}], total, totalOk (0.5%)}: header lines (date/time/bill no) are never items; qty x rate = amount searched among the numbers; O->0 / l->1 inside numbers; no regex lookbehind (old iPhones). sure() decides the fallback (<0.7).
- match(raw,{items,alias}) -> {n,c,score,via}: learned alias (settings/stock_items.alias, key = norm(raw) with _) -> our saved items -> DICT (~200 items, 14 categories, Malayalam/Manglish names: thakkali, savala, inji, kozhi, mathi, malli podi...) with spelling-tolerant scoring (Damerau-Levenshtein + OCR look-alike folding + prefix / abbreviation). >=0.82 auto, 0.62-0.82 "check" (amber line), below = NEW item (cleaned raw name, guessCat) - never forced.
- ai(): ONLY when unsure AND settings/stock_ai.url is set: POST {image, items, suppliers, cats} to Majid's Cloudflare Worker (cloudflare/bill-reader/worker.js + README.txt). FREE ONLY (Majid, 13 Oct): Workers Free plan + Workers AI binding "AI", model @cf/meta/llama-3.2-11b-vision-instruct (10,000 free neurons/day ~ 200 bills; free plan never bills, past the limit it answers 429 "try again tomorrow"). No API key. Meta licence accepted automatically ("agree" on the first call). ALLOW_ORIGIN check. Never suggest the paid Claude API or Workers Paid. Worker tested with a mocked env.AI (7 checks). Clear printed bills never reach it.
- stock.html: picking a photo reads it at once (progress bar); review card: "✓ Bill read · n lines · read on this phone / by AI", supplier (matched to known suppliers), date, no., total ✓/mismatch, each line clean name + confidence chip + category + "read “…”"; "✓ Use these n lines" fills the form (amber = check); "🤔 does not look like a bill" for selfies/blur. Save learns every changed spelling as an alias and stores item categories. Items tab: category picker per item, AI reader URL box (office), learned-spellings count.
- Tests: node parse-test (37: 3 OCR'd bills incl. misspelt veg bill + thermal receipt + selfie, 22 Malayalam/short-name cases); capt/t-stock2.mjs (15: real bundled OCR in Chromium, learn-then-100%, not-a-bill, AI fallback via a faked worker, printed bill never calls AI); t-stock 18.

## v271 — Live: time since the last NEW customer and the last bill paid
- lastGap() at the top of New orders (Live): "🚶 Last new customer · n min ago · hh:mm · where · ₹" (latest createdAt of a non-staff bill - add-ons never count) and "🧾 Last bill paid" (latest settledAt). Ticks every 20 s ([data-since]). "usually one every ~N min now" = 60 / average bills in this clock hour on the last 4 same weekdays (OHS b); amber when the gap is >2x usual (and >=6 min), red >3x (and >=10 min). Test t-live (8).

## v270 — Stock buys page (stock.html): bill photo -> stock purchase, apart from VMENU
- stock.html, own page (office / cashier / kitchen; HayatAuth form). Tabs ＋ New bill · Bills · Items. Linked from the admin drawer (shop.js officeDock "📦 Stock buys"; dockAllows lets kitchen open it). In sw CORE.
- New bill: 📷 Camera (input capture=environment) or 🖼 Upload -> shrink() to <=1400px JPEG (~150-700 KB); supplier chips (recent first) or type; date (business day, 05:00 cut); lines Item / Qty / Unit / Rate / Amount (amount auto = qty x rate; typing an amount back-fills the rate); "↺ Their usual items" / tapping a supplier chip pre-fills that supplier's items with last rates; per-line tip: last rate + supplier, "▲ 10% vs last time"; Items add up vs Total on the bill (✓ matches / ₹X less - an item missing?). Draft kept in localStorage (hayat-stock-draft, 12 h) - refresh-safe. Lines update IN PLACE while typing (a full redraw stole the next box's focus and lost the qty).
- Writes ONLY: stock_buys/{yyyymmdd-id} {v,day,at,by{id,name},supplier,billNo,lines[{n,q,u,r,a}],total,billTotal,note,photo,src:'stock'}, stock_photos/{id} {d:dataURL,at,buy}, settings/stock_items {items:{slug:{n,u,r,s,at,big}}, sup:{slug:{n,items:[slug],at}}} (merge). NEVER vm_* or orders (test checks every write path).
- Big 6 seeded (chicken (whole), rice, oil, fish, beef, gas cylinder) as big:true; Items tab toggles ★ Big 6.
- Bills tab: last 45 days by day with day totals, 📷 / "no photo" / "bill says ₹X" flags, tap = lines + See photo (full screen) + Delete (office, second tap confirms - no dialogs).
- Next: Big-6 closing count + AvT on the owner page; compare stock_buys vs VMENU purchases (matched / not in VMENU / no photo / ₹ differs); AI bill reading via a Cloudflare Worker (key never in the app).
- kds.html: kds_state snapshot tolerates a missing docs array (the pos-flow test fake returned a doc shape and the screen crashed - real bug since v264).
- Tests: capt/t-stock.mjs (18); repo tests login / counter / pos-flow ALL GREEN (run with a shim that sets executablePath); t-kds 15.

## v269 — captain search: always visible, always escapable
- Bill view dock: a real search bar (.sfake "🔍 Search to add dishes", tap = focus #q) + "＋ Menu" instead of a tiny 🔍 icon (Majid could not find search).
- While typing: "Done" (.qdone) replaces ‹ (which used to leave the table mid-search). srchDone(): clears, drops the keyboard, back to the bill when nothing waits to be sent, else stays on the menu. Esc = Done. Focus pushes a 'search' history step (HIST.srch) so phone Back closes the search first; blur with an empty box removes the step (no dead Back); ‹ leaving the table pops search + order together (history.go(-n)).
- ux event search_done {back}. Test capt/t-capt5.mjs (10); t-capt 39, t-capt2 37, t-capt3 3, t-capt4 18, t-setup 16, t-kds 15 green.

## v268 — captain and rider apps no longer share a scope
- captain.webmanifest scope "captain", rider.webmanifest scope "rider" (both were "./", the whole site, same as the menu). On a phone with Hayat Rider installed, Chrome treated captain.html as part of the Rider app ("Open in Hayat Rider" / installed into it). Scopes are URL-prefix matches, so "captain" covers captain.html only, "rider" covers rider.html only. ids unchanged (hayat-captain, hayat-rider). Checked with CDP Page.getAppManifest: no errors.
- Phones that already have the wrong install: uninstall Hayat Rider (and any wrong Captain icon), open captain.html in Chrome -> Install app; rider.html -> Install app.
- The menu manifest stays scope "./" (customers' installs untouched).

## v267 — Today lab · proof lines · top boxes only on Live/Sales · page titles
- todayLab() (Live, today only; replaces likeToday there): "Today · how it will end". Ways: F app forecast (fcToday neutral; past days fcLive on fcHours masked to minute v), S days like today so far (tmMatch on hours < now, tmKeep filter, top TMR.n) -> so far + their nrev after v, R last 4 same weekdays + today (so far + their rest), B last 4 same weekdays totals. tdBacktest(v): each way replayed at the SAME clock time on the last 30 finished days (cache per 15-min slot + filter + INDEX size). Best = lowest miss with n>=8, ★ row; proof box (.tmproof, amber .rough + "use as a guide" when miss >15%).
- Real-data check (index to 9 Oct, pay-time hours): no single way wins all day - 13:00 weekday rest best (~18%), 16-19:00 similar any-day (~12%), 21:00 similar same-weekday (~9%). Growth-adjusting similar days fixed the bias but not the miss - NOT added.
- Tomorrow card: Live only (removed from Sales), same proof box + ★; tmFilt() shared chips + a line saying what the filter means (TM_FN). TMR.topen = Today full analysis.
- Top boxes (kpis) only on Live (floor) and Sales. pgHead(): every day page starts with its name + date + what it shows (PG_N); Live/Sales carry "🔍 Similar days".
- Tests t-v267 (16); t-v255 / t-tmr updated for the new layout.

## v266 — live hours by KOT time · alert popups swipe / clear all
- rparts(r,v): a bill split by WHEN each part was ordered (items[].kotAt), scaled to the bill's money (paid total or running sum). hbucket, Sales-by-hour unpaid stack, hourCompare, running total (runLine + AFT) and the replay curve (rpCurve) use it, so an ADD-ON counts in the hour it was ordered (before, the whole bill sat in the hour the table opened, so the current hour did not move). Bill COUNTS stay at createdAt. History hours (ohOf / settings/ohours) are unchanged (whole bill at createdAt).
- bh(ts): no time -> -1 (a bill without createdAt used to land in 00:00).
- Current hour bar: "now ₹X" label (b.unl.curl) above the forecast box = paid + unpaid so far, so a new bill visibly moves it.
- Alert popups (alToast): tap = open bill, ✕ (32px) or swipe sideways = dismiss (8px slop, >30% width or quick flick; short drag snaps back and does not count as a tap), "✕ Clear all (n)" pill when 2+, timer pauses while touched/hovered, max 3 on phone / 4 on PC (oldest slides away), reduced-motion respected. Tests t-live (6), t-alswipe (9).

## v265 — replay video runs to closing · NOW marker · dotted forecast
- recDraw (GIF + WhatsApp MP4): today no longer stops at the current time — it plays on the forecast to closing like ▶ Play. Fixed "NOW hh:mm" pill + dashed amber line at c.fcFrom, shaded forecast zone, line dotted after now, clock amber with a FORECAST pill, row "n bills + forecast", footer "dotted = forecast".
- Replay screen: race chart gets the same fixed now line (line.nowfix, text.nowt, rect.fczone); clock "· forecast"; card "~₹" + "forecast after hh:mm"; By hour: forecast part of today's bar dashed/hatched (.fcbar), table "~₹"; Bills feed skips forecast steps (p[2]) with a note.
- rpBillsAt counts real bills only (forecast quarter-hour steps were counted as bills). rpHours(c,v,fo) fo = forecast only. Test /home/claude/t-v265.mjs (10).

## v263-v264 — table cards, guests, KOT notes, kitchens, hold & fire, out of stock, kitchen-screen states
- Table cards: seat diagram (seatSvg: one dot per chair, filled per guest) instead of the shape outline; busy tables show "👥 4/6 · Rafeek" (shortName ≤7 chars). Opening a free table asks "how many guests?" (guestSheet, 1-12 / Skip). Replay sets guests from the bill (₹350 each) when VMENU has none.
- KOT options (✎ next to Send KOT, kopt kept in the draft): flags Urgent / No rush / Serve hot / Starters first / Serve together / Parcel / Hold + typed note → kot.note, kot.flags, kot.pri, kot.hold, kot.skip (kitchens switched off). Kitchens auto from station(); NO KOT dishes listed as "🥤 You bring" (also a toast after sending). Item-note chips: less spicy/salt/sugar, no sugar/ice/onion/garlic, well done, kids portion, allergy, parcel, serve first/later/hot.
- Hold & fire: a held KOT does not print; bill view "🔥 Fire" sets kot.fireAt and prints with note FIRE NOW.
- 🚫 Out of stock today: hold a dish → captain/office/cashier toggle settings/stock {day, off:{id}}; every phone greys it out (tap = toast), resets next business day.
- Kitchen screen (kds.html): reads trial_orders when settings/captain.kdsTrial; one card per KOT round for web/captain orders (key minute+"r"+round - two rounds in one minute used to merge); big table no. + section, 👤 waiter · 👥 guests, TRIAL / ⚡ URGENT / 🐢 no rush / ⏸ HOLD / 🔥 FIRE NOW tags, 📝 note box; bottled NO KOT lines skipped; urgent first, held last. States in kds_state/{ticket id} {screen, inv, round, at, acceptAt, prepAt}: 👍 Accept (queue timer) → 🔥 Start (cooking timer vs target) → ✓ Ready (kds/{id} doneAt as before).
- Captain watches kds (doneAt) + kds_state: bill view "Kitchen" list per KOT (👀 saw it / 🍳 cooking n / ✅ ready / 🥤 you bring / 🔥 Fire), table tag ✅ Ready / 🍳 Cooking / ⏸ Hold, and the table's waiter (or office/runner) gets "🍽️ A4 · ready to serve" with beep + vibrate.
- Sheets that change while open (KOT options, cleaner) update in place - no re-animation.
- Tests: t-kds 15 (waiter phone + kitchen screen on one store), all captain suites green (128 checks).

## v261-v262 — captain app: search at the thumb, bill-first, refresh-safe, halls, categories, trial tables, setup page, usage capture
- Search results render INSIDE the dock right above the box (#sres, flex column-reverse: best match nearest the input, max 8). Typing (focus on #q → body.typing) hides suggestions / categories / tray. pointerdown on #sres/#snack is preventDefault-ed so tapping results keeps the keyboard. orderRefresh() redraws main + dock parts but never the input (snapshots while typing use it too).
- Phone order screen has two modes (omode): a table with a bill opens on the BILL (.bview: total, items per KOT with times, dessert nudge; dock = ＋ Add items / 🔍 / Due bill or Pay); a new table opens on Quick pick. After Send KOT → bill. Wide screens keep menu + bill column.
- Refresh-safe: hayat-cap-ui (view, table, search, category, modes; 45 min) restored on boot; drafts were already saved; hayat-cap-pay keeps what was typed in the pay sheet (15 min) and reopens it after a refresh; Firestore persistentLocalCache via HayatAuth.start({cache:true}). Idempotent KOT: each draft gets a sid saved before sending; the transaction skips if the bill already has a kot with that sid ("Already sent").
- Halls: after sign-in a waiter picks the hall(s) they work (hayat-cap-space per person per day); floor chips My halls / All / each hall / ✎ Halls. Office skips the step.
- Categories: no sliding strip. ‹ 🍗 Mandi · 2/12 › (stepCat) + swipe the dish list left/right; tap the name → every category as tiles (catGrid).
- TRIAL TABLES: while Trial is on, bills / cleaning / table locks use trial_orders, trial_cleanreq, trial_tablelock (C_()). Toggling Trial re-subscribes. The website's orders and VMENU's vm_* are never written by the captain app in trial.
- setup.html = captain.js with window.HAYAT_SETUP: office only, tabs Staff · Tables · Menu · Settings · Trial · Usage. Linked from the admin app drawer (shop.js officeDock: "Staff & tables", plus "Captain app" for captain/waiter). The captain app has no Admin any more; the owner page has no Staff page (owner = sales analysis).
- Trial → replay a real VMENU day (vm_daylog, dine bills from an hour, N bills, speed 1/5/20/120×) live into trial_orders (source:"sim"): seat → KOT → add-on → due → paid, VMENU names/prices kept. Clear trial data deletes trial bills/locks/cleaning.
- Usage capture (captain app, cfg uxLog default on): every tap (what/where), dead taps, rage taps, searches (q, results, best), adds by route (search / quick:cat / suggest / hold / enter / repeat), undo, void, due, pay (mode, ms), KOT (ms from first add), errors, views. ux_sessions/{sid} + ux_events/{sid}_{nnnn} chunks every 15 s / on hide. Setup → Usage: medians, dead/rage/undo rates, adds by route, no-result searches, errors, each session step by step, JSON download.
- Tests: t-capt 39, t-capt2 37, t-capt3 3, t-capt4 15 (geometry, keyboard focus, refresh, bill-first, dup KOT, pay restore), t-setup 16; repo tests login / counter / pos-flow all green.

## v260 — Staff page in the owner app
- Captain app resumes a person only if they signed in IN the captain app on this phone (localStorage hayat-cap-me = staff crew). An office sign-in from the website no longer opens it as Majid; everyone else sees the name picker. Test t-capt3.
- More → 👥 Staff (day and period): add person (name, role, phone, code 4-6 digits, prefilled random), per person: role, phone, New code (prompt), Show code (works while rules are open), Switch off/on, Remove. Writes crew/{id} {name, role, code, phone, off} + crew/_list {people:[{id,name,role,phone,off}]} (same records as captain app / KDS / cleaning page). Renders without a day log.
- Roles: captain, waiter, runner (new), cashier, cleaner, kitchen ("Cook / kitchen" - KDS), office. Captain app APP_ROLES adds runner. "Who opens what" card + captain app QR (assets/qr.js now loaded in owner.html) + copy link. Test t-staffpg.

## v259 — updates show at once
- GitHub Pages sends Cache-Control max-age=600, so the service worker's plain fetch() got the browser's 10-minute copy and a shipped version "did not install". sw.js: pages fetched with cache:"no-cache" (revalidate, 304 is cheap; a redirected navigation falls back to fetch(e.request)); JS/CSS/manifest no-cache; install uses new Request(u,{cache:"reload"}). captain.js registers with updateViaCache:'none' (index.html already did).

## v258 — counter notes decide staff food
- isStaff: a COUNTER bill whose note is not an order word (CO / c/o / counter / cnt / parcel / take away / DM… / delivery / zomato / swiggy / online) is staff food - "viv a", "SOHAIL ALF", "tan" (Majid, 12 Oct: KOT 105 "viv a" ₹180). Not when the note has a phone number (≥6 digits) or the bill is over STAFF_MAX_CO ₹600. No note = customer. Dine bills keep the old rule (one word ≤ ₹300, a known staff name, or "staff").
- SNAP_V 6 so month snapshots rebuild with the new split. nz(): VMENU writes the word "null" for customer name/phone - hidden in the bill sheet. Test t-staff (12 note cases).

## v257 — captain app: one-handed, real VMENU menu, keypad pay, smart suggestions
- Menu = learned from VMENU bills (buildPosMenu): vm_months (2 months, every item) + last 7 vm_daylog (latest price p, kitchen kit, hour, pairs). parseName groups sizes (Qtr/Half/Full, (8PCS), 750ML/1 LTR, CAN, "7UP 20" = Small - the 2-digit rule only for drinks; "CHICKEN 65" stays a dish). settings/pos_menu {fams:[{id v-slug, name, cat (CATS regex), kit, q, h[24], ch:[{label, price, vn (VMENU name), q, kit}]}], pairs:{id:{id2:n}} (maps - Firestore refuses nested arrays), famBills, bills}. Rebuilt when >20 h old by the first phone (lease settings/pos_menu_lease, 10 min) + every 3 h; live onSnapshot. Office edits in settings/pos_edits {price:{"id|label":n}, hide:{id:1}, add:[...]} saved by a transaction that applies only this phone's diff. Admin → Menu: VMENU list / website menu, learn again, prices, hide, add dish. Lines keep vn + kit; kit "NO KOT" → no kitchen ticket.
- Order screen: bottom dock (suggestions, categories, ‹ back + search, bill tray + Send KOT); nav hidden; --dockh via ResizeObserver, --kb from visualViewport (dock rides above the keyboard). Search: word prefixes, initials (cmf, kfm q), size token (q/h/f), 1-letter typos (lev1 ±1 prefix); Enter adds the best hit. Remote updates while typing refresh only the bill (softRender).
- Suggestions: empty table → full mandi for 👥≥3 + selling now (hour); no drinks → made drink × guests ("one each") + a second; "goes with · n%" from pairs; ↻ Repeat KOT n (prices from o.lines incl. voided, skip unpriced); "something sweet?" in the bill before Due bill.
- Every add → snackbar UNDO; hold a size (430 ms) → qty sheet; a capture click guard swallows the lift-off tap (LP.until). Hold a table → quick actions (not for cleaners). Swipe a sheet down to close; right edge → open bills drawer; left edge / phone Back → tables (history states for order + sheets).
- Pay: own keypad (no phone keyboard). Fields: Cash received (default), Discount (₹/% with 5-20% + round off; switching to % clears >100), Tip (round up), Split parts (Rest). Notes: exact, next 50/100/500, 500/1000/2000. "Give back ₹X" big. Sticky "✓ Money received"; UPI second tap; ₹0 total blocked.
- Floor: attention strip (unsent items >4 min, bill unpaid >10 min, no KOT >35 min, cleaning >6 min).
- Tests: t-capt.mjs 41 (phone + tablet), t-capt2.mjs 35 on the real Sep-26 day log; fakefs now refuses nested arrays and docs >1 MB like Firestore.

## v256 — Captain app (captain.html + captain.js, installable PWA)
- Who: captain / waiter / cashier / cleaner / office. Login = name tiles + keypad code; verified against crew/{id}.code (readable while the rules are open), then staff/{uid} is written (rules-compatible). Switch user = sign out (new anonymous uid) + reload. Switched-off people (crew/_list off:true) are hidden here and in HayatAuth.form.
- Writes the SAME orders the counter writes (source:"captain", mode:"dinein", kind:"dine", table, tableId, space, section, pax, lines[k,id,name,label,price,q,at,by,rounds], kots[], edits[], kotN, dueAt, dueCount, paid…, tip, trial:true, noKds). KDS skips noKds; print agent prints kind kot/bill from print_jobs (no popup) and now shows TABLE/guests for captain + counter dine bills.
- Every write to a running bill is a transaction (txOrder) that refuses a bill already paid/cancelled on another phone. First KOT + add-ons go through tablelock/{tableId} {oid} so two phones on one table make ONE bill (test: second phone becomes KOT 2). SENDING[tid] stops double taps; only the sent qty leaves the draft.
- Drafts (not sent) live per phone (localStorage hayat-cap-draft). Popular = frozen per page load (localStorage hayat-cap-pop + today's lines).
- Pay sheet: discount ₹/% + tip change the UPI QR at once (upi://pay … am=); split → QR asks only the UPI part. "✓ Money received" only — UPI needs a second tap "₹X arrived?", reset if the amount changes. markPaid refuses if the bill total moved since it was shown. total = bill excl. tip; tip separate; paidAmt = total+tip.
- Cleaning: cleanreq/{id} {table, tableId, kind clean|deep|plates|spill|water|other, urgency normal|urgent, note, status open|taken|done|cancelled}. Cleaner phone beeps + vibrates; urgent first. Paying a dine bill calls the cleaner (setting cleanAfter).
- Admin (office): Staff & codes (crew/{id} name, role, phone, code, off + crew/_list), Spaces & tables (settings/floor {spaces:[{id,name,tables:[{id,name,seats 2-12,shape square|round|rect,rot}]}]}, seeded from the 25 sim tables A1-10, N1-7, H1-2, J1-6), Settings (settings/captain: upi, upiName, trial, printKot (off in trial), kdsTrial, printBill, cleanAfter).
- Trial: owner app still counts VMENU only (it reads vm_daylog); captain bills never reach it yet. Next: owner counts captain bills after the switch-over day; counter redesign; floor drag-designer.
- Tests (sandbox /home/claude/capt): fakefs.js = one shared store in the test runner with version-checked transactions; t-capt.mjs 39 checks, W=390 phone and W=1100 tablet.

## v255 — slider-true running line · real forecast bars · tomorrow on Sales
- runLine: "now" = NOW (slider), not Date.now(). While scrubbing, bills after the slider are drawn as a faint dotted line (.rlact) + key "what really came after".
- hourly(): the axis includes the forecast still to come (no more capped ▲ boxes).
- tmCard no longer needs FC; tmCardBig also on Sales (today) and its hour band shows without "full analysis". Test t-v255.

## v254 — add-on alerts + add-ons in Live
- alCheck snapshot per bill = {e:edits, k:kots, s:sum, q:item qty map}. Add-on = more KOTs or an item qty up, AND total up (voids never count). Toast "＋₹X ＋ add-on · table" (blue, class addon) with the items added.
- AO log {billKey:[{at,d,items,n}]} kept in localStorage 'hayat-ao' for today only (per phone) — ₹ delta / items are known only for add-ons seen while the app was open.
- New orders (Live) merges new bills + add-ons (AO log, else r.kots[1..] in the last 60 min → "items added", amount "—"). Header: "N new · ＋M add-ons ₹X · last hour". Test t-ao.

## v253 — current hour tappable + unpaid vs yesterday
- Sales by hour: forecast/current-hour bars carry data-h → tap opens hourCompare with a **Forecast** row (dashed amber) vs Today so far / Yesterday / last same weekday / avg. Works even when forecast tiles are hidden (Fh no longer needs FC).
- Unpaid box: yUn = yesterday's non-staff bills ordered by this minute and still unpaid then → "▲/▼ ₹X vs yesterday this time".

## v252 — unpaid first · cleaner top boxes · soft curves · amount-first alerts · slider tucked away
- Top boxes (.kpi.tb): Today so far (paid + unpaid, ▲/▼ vs yesterday at the same minute by ORDER time, paid · unpaid small) · Unpaid now (Dine / CO / Delivery / Staff, ₹ + count) · Forecast (still to come, next hour, ⚙) · Bills (now → ~forecast, avg → ~) · Next 10 min · Tomorrow.
- hourCompare: today = paid + unpaid of that hour (split bar, unpaid hatched amber), "till HH" cumulative too; the unpaid part of a bar is tappable (data-h).
- billsCard lines are Catmull-Rom curves (soft), clamped to the baseline.
- New-bill banner leads with the amount (big ₹ · where); a KOT opened at ₹0 alerts once it gets an amount (AL_WAIT).
- Time slider: no row on the page. ⏱ button in the Sales-by-hour header opens the dock slider; a one-line "showing the day as of … · back to now" only while scrubbing.

## GOAL (Majid) — next-customer prediction · work on TUESDAY 13 Oct 2026
- Say, live: "in the next ~3 min a DELIVERY / COUNTER / DINE order will come, about ₹700 (e.g. alfaham + juice)".
- Target accuracy: time within 2–5 min (early or late), amount within 10–15%, type right.
- Approach to try: per-type arrival rates by minute-of-day × weekday × trend (Poisson / hazard), basket model per hour × type (item mix, avg value), conditioned on the last orders; run many backtest loops / simulations on all history (minute-level from day logs) and tune until the hit rate is as high as possible; show the measured hit rate in the app.
- Honest limit: exact minute of ONE order is random; ±2–5 min is reachable in busy hours, not slow ones. Score before claiming.

## v279 — Planner Pro (laptop CAD layout · realistic 3D · edit in 3D · walk-through)
- Files: planner.html, planner.js (2D + panels), planner3d.js (scene, cutaway, edit, walk, thumbnails), planner-models.js (NEW: canvas textures, materials, ~70 furniture builders), assets/three: TransformControls.js, RoundedBoxGeometry.js, RoomEnvironment.js, BufferGeometryUtils.js (NEW, three r160 MIT, import rewritten to ./three.module.min.js). sw CORE adds planner-models.js.
- PRO layout when the window is >= 900 px (body.pro): tool rail (V select, H pan, S space, D door, W window, M measure, O objects, checks), object library panel (search + categories, cards = real 3D renders made once by V3.thumbs, cached in localStorage hayat-plan-thumbs-v1; docked >= 1240 px, floating below), right panel Properties | Layers, status bar (tool tip, cursor x/y m, zoom, Grid/Magnets/Rulers toggles, save state), rulers on the plan. Phone (< 900) keeps the v278 dock + sheets (+ Measure tool).
- Selection: SELS (set) + SEL (the one shown). Shift/Ctrl-click toggles; mouse drag on empty paper = box select (left->right fully inside, right->left touching; a ROOM only when fully inside); mouse drag that starts on an UNSELECTED room = box select inside it (click selects the room, drag a selected room moves it). Group move, align L/C/R/T/M/B, spread across/down, same width/depth, turn 90, copy, lock, hide, delete. Ctrl+A/C/V/D, right-click menu (copy, turn, lock, hide, "Select every <name>", remove; empty: paste here, select all, fit, measure). Space+drag / right-drag / H = pan.
- New plan data (all optional): obj c (colour), fin (finish oak|walnut|white|black|steel|fabric), ht (height); space fl (floor finish, FLOORS keys), wc (wall colour), wh (wall height); door dh; any item lock / hid; measure items {kind:'dim', a:[x,y], b:[x,y]} (Measure tool, snaps to corners, Shift = straight). Layers (view prefs, localStorage hayat-plan-ui): spaces / furn / open / dims / labels / grid, each [visible, locked]; a locked layer can't be picked. Hidden space hides what is inside it.
- Live dimension lines: a selected object shows distances to the walls of its room (orange), a selected space its width/depth; "Room sizes" toggle.
- Library: tap = into the selected room (or the room of the selected thing, or screen middle); DRAG a card onto the plan (ghost footprint) or into the 3D view (V3.pickFloor) = drop there.
- Modes: 2D | 3D | Split (laptop: plan left, live 3D right, selection synced both ways) | 🚶 Walk.
- 3D look: ACES tone mapping, RoomEnvironment reflections, sun from the time slider (6:00-23:00, soft PCF shadows, HQ toggle), sky gradient + fog, night = warm point lights in the biggest spaces (12 laptop / 6 phone) + lamps + glowing windows. Floors = ExtrudeGeometry slabs with textured finish (auto by type: room oak, bath 30 cm tile, lobby marble, kitchen grey tile, banquet red carpet...; "Colours" = tinted by type). Walls are set INSIDE their space (shared walls never overlap), cut at every door/window on that line (any space), one box per piece with a vertex-coloured dark cap (1 draw call), merged skirting. Doors: frame + leaf open 70° on its hinge/swing side (double leaf >= 1.4 m); windows: frame, glass, marble sill, curtains in rooms. Cutaway: walls facing the camera on the near half drop to 34 cm (animated); Full; Low (1.1 m).
- Objects: planner-models build() merges each object's parts per material and caches by type+size+colour+finish (48 chairs share one copy). Demo ground floor 1770 -> 520 draw calls, rooms floor 2235 -> 812.
- Edit in 3D: click an object -> blue box + TransformControls (Move world XZ / Turn Y / Size XZ, 10 cm + 15° snaps), written back via H.onEdit (+ magnets), undo works. Click a floor = select the space; double-click = fly to it.
- Walk: eye 1.6 m, W A S D / arrows (Q E or ←→ turn), Shift run, drag to look, joystick on touch, collisions with walls (full + sill pieces) and furniture (height > 0.3 m, not lifted), ceilings + down-lights while walking, mini map (tap = jump), starts just inside the door of the selected / lobby space with clear room ahead. Esc leaves.
- Test hooks: PLANNER.SELS/MODE/PRO/PREF/THUMBS/V3/alignSel/dup/copySel/paste; V3.state/screenOf/editBy/setTime/walkKey/walkTo/focus/dbg.
- Tests: /home/claude/t-plan2.mjs (30) at W=390 and W=1300 (pro-aware), t-plan4.mjs (39: layout, 3D thumbnails, library drag, box/crossing select, Shift add, group move, align, spread, copy/paste/dup, right-click select-same, delete, lock, room pend, measure + corner snap, layers hide/lock, outline, finish/height/colour, floor/wall look, X moves contents, split, 2D->3D gizmo, 3D click select, edit in 3D + undo, night lights, walk + collision + Esc).

## v280 — Hub (every page in one place) · plan from a paper sketch
- nav.js = THE map of the site: window.HAYAT_APPS {apps:[{key,group,ic,name,what,url,roles}], groups, recent, remember, here, allowed}. Add a new page there and it shows in the Hub and in Ctrl+K. Loaded by every staff page (owner, clean, sim, waitlist, stock, setup, captain, kds, rider, planner, hub, index.html). Records recently opened apps (localStorage hayat-recent). Reads/writes no Firebase.
- Ctrl+K / ⌘K on any STAFF page (index.html only under #/admin, never the customer site) = "Jump to…" palette: search, ↑↓, Enter, recent first, ⌂ All apps.
- hub.html (⌂ All apps): tiles by group (Selling · Kitchen & floor · Money & numbers · Menu & customers · Hotel · Setup) with what it does, its link (/owner.html, /#/admin/pos…), who uses it, copy link + QR for a phone; "Site map" table (full URLs); search ("/" focuses, Enter opens); "Recently opened". Signed-in role via HayatAuth: non-office roles see only their apps (toggle to show all). Room booking tile = "coming next".
- Back links now go to the Hub: owner "⌂ Apps", clean, sim, waitlist, planner ⌂, stock ⌂, setup ⌂ (captain app shows ⌂ only for office/cashier). Office drawer (shop.js officeDock) first item "⌂ All apps". owner-1.html / fakemaps.html are NOT linked (old copies; delete when Majid OKs).
- Menus: unchanged by request (CSV import → each its own menu, e.g. AC / Non AC; admin activates one for online ordering).
- planner-sketch.js (loaded on demand; menu "📷 Plan from a sketch photo", Space sheet, floor panel): 1 Photo (camera / upload / ✏️ example sketch) → 2 Straighten (paper corners found by an Otsu split table vs paper; drag 4 corners; homography warp ≤1600 px; Skip) → 3 Rooms (grid ~360 cells, min-filter + adaptive threshold; ink blobs: the biggest connected network or any line longer than 22% = WALLS, everything else = writing / small drawings; door gaps closed by dilation (Closer look / Normal / Wider gaps); outside = flood fill from the border; every other closed area ≥0.25% = a room; fill < 0.82 → traced outline, simplified (RDP), squared and pushed out to the wall centre; tap a room to leave it out) → writing read LINE BY LINE with the bundled Tesseract (assets/ocr, PSM 7, Otsu black/white, enlarged) → names (NAMES regex: kitchen, bath/toilet/wc, store, dining/hall, lobby, room/bedroom, suite, office, stairs, laundry…), room numbers (3 digits), sizes "4x5", "12'x10'" → 4 Size (scale from sizes written in rooms (median), or type the whole width (orange dashed line), or tap two points + length; m / ft) → 5 Finish ("what's missing" checklist, type per room (guess by size: narrow+long = corridor, ≤6.5 m² = bath, else room), name / room no., width × depth, add doors (one per room, on the wall shared with the biggest / corridor-like neighbour), windows on outside walls, first guest room no., this floor / new floor / replace, keep the photo) → spaces (walls within ~0.25 m snapped onto one line), doors, windows; written room numbers kept first; then the checks sheet opens (no bed, no bathroom…).
- floor.under = {src (JPEG data URL ≤1100 px q.6), x,y,w,h (m), op}: drawn faded under the plan (spaces 55% see-through while shown); Layers "Sketch photo"; floor panel: opacity slider, hide, remove (undo-able). 3D ignores it.
- Tests: /home/claude/t-hub.mjs (16), t-sketch.mjs (12, W=1440 and W=390: demo sketch → 7 rooms, all names read, 18 × 12 m, shared walls, doors 7, windows 5, undo), t-plan2 (30 ×2), t-plan4 (39), capt/t-setup 16. Pre-existing (same on the v279 files): capt/t-kds 2 out-of-stock checks fail, capt/t-capt stops at pickHalls on the tablet pass.


## v281 — office map: riders + traffic out of the way
- Majid: the office map is a laptop/desktop screen; the rider cards and the NH966 route strip covered it. Now one row under the tabs (mapTop(box) → .maptop) with two small pills: "🏍 2 riders · 1 not opened ▾" (riderStrip; summary = n not sharing / n not opened / n quiet / all moving, red/amber/green) and "🚦 NH966 all clear ▾" (trafficStrip; "no data" grey). Click opens a short drop-down (riders: one line each — dot, name, riderShort(): moving / seen hh:mm / not sharing / not opened yet, jobs count; tap = fly to the rider or open the job · traffic: one row per point with km/h). Only one list open at a time; state remembered per device (localStorage hayat_ridopen, hayat_trafopen2 — new key so everyone starts closed).
- Only one ⌂ on the office map (the Leaflet one under + / −; tameMap's own .maphome hidden in #admap).
- Phone: filter chips stay on one scrolling row; the "Connecting…" line sits under the top bar and the pills move down to make room.
- Test /home/claude/t-map.mjs (10 at W=1440 and W=390, offline store + local Leaflet + fake tiles). Repo tests counter 56 / pos-flow 39 / login 25 all pass.

## v282 — customer onboarding · delivery time · map pin · rider app ivory · avg bill per hour
- Majid tests ordering → delivery on 15 Oct. Walkthrough (sandbox, offline store): customer menu → Choose → Add → cart → 3 steps → placed; office Accept → Assign (assignSheet, data-asg); rider app sign-in (phone + 6-digit code) → job → On the way → Cash, exact → Mark delivered; customer sees every step + the rider on the order-page map. Tests /home/claude/t-deliv.mjs, t-cust2.mjs (13).
- welcomeCard(mine): first visit only (no orders, localStorage hayat_welcome): 3 steps (Choose → Add; number + map pin; we cook, a rider brings it, follow live), facts (etaRange min, cash/UPI on delivery, ~homeRadiusKm km), "Show me the menu" opens the first category.
- etaRange(lat,lng) = shop.prepMin (default 25) + 3 min/km, rounded to 5, +10 → "Usually 35–45 min" on the Send step (+ "cash or UPI to the rider") and on the order page "Expected around hh:mm" (o.at + upper bound) until delivered (not for scheduled orders).
- Address step: "📍 Use where I am now" (askGps → PIN). Send step without a pin: red "No map pin yet · the rider will have to call you" + "📍 Add where I am now".
- A capture click listener scrolls the page when "View cart" (#cartfab) would cover the size row you just added to.
- Delivered: "Enjoy! How was it? ★" moved right under the steps (was at the bottom). Install offer (installSheet) already existed.
- Rider app (rider.html) uses the same ivory "paper" theme as the customer app (was green "garden"); manifest colours #F5F0E4; its toast is the app's #toast pill (was unstyled "Marked paid." text).
- Owner avg bill per hour (billsCard, Avg bill): today = customer bills by ORDER time, pre-bookings (isLarge) out; usual = new OHS fields v (value) / vb (count) with the same rule — the old usual line divided ALL money (incl. staff food eaten at closing + pre-bookings) by customer bills only, so late hours looked too high. ohOf adds v/vb; ohScan re-reads days missing vb once (office); until then no usual line in Avg view. window.__OWN={ohOf,bh} test hook. Test /home/claude/t-avgh.mjs (5).

## v283 — owner app: simple view for partners · one top box with every type
- Majid: "the owner app UI is so poor and no one likes it". Users = partners / family. Default is now the SIMPLE view (localStorage hayat-view = simple|full, per device): bottom bar Today · Days · Money · Dishes · Analysis. Analysis = the old full app (Live · Sales · Spends · Items · More); More → "◧ Simple view" goes back. Phone Today 4.6 → 1.9 screens.
- todayBox() replaces the old 4 top boxes (both views, Live + Sales): Total so far (paid + unpaid) · ▲/▼ vs usual same weekday by now (usualByNow from OHS h, pre-bookings out; else yesterday by now) · paid / unpaid · colour bar · table Type / So far / Unpaid (₹ · n) / Bills / Avg for Dine, CO, Delivery + grey Staff row + Total · forecast row (dashed = forecast): By closing (tap = fcSheet), Bills, Avg bill, Next hour.
- STAFF FOOD IS NOT SALES (Majid, 14 Oct): its ingredients are already in purchases. Total / bills / avg in the box = Dine + CO + Delivery only. KNOWN GAP: hourly bars, running total, forecast history (OHS h) still count PAID staff food (~₹500/day) — move them next.
- Forecast always on: FC = true (the "◔ Show" tile is gone).
- Colour code (CSS vars --k-*): Dine teal · CO purple · Delivery coral · Staff grey · unpaid amber · forecast dashed outline · up green / down red; light + dark.
- Simple pages: Today = box + Needs you (alertList, max 4) + Sales by hour + Top 5 dishes; Days = last 14 days bars (tap = that day) + This week / This month / Last month (open the period); Money = Spends today | Cash & bank, one card + "Every entry and bill →"; Dishes = top 15 + Others.
- Tests: /home/claude/t-v283.mjs (22 × phone + laptop). The owner test stub (t-owner.mjs) sets hayat-view=full unless a test sets it, so old suites run the full view. t-pace was already broken since v277 (Pace card folded).

## v284 — ONE RULE: a sale = a customer bill MADE, at the time it was made
- Majid, 15 Oct: "every graph and every forecast or anything is on bills made not bills paid"; staff food is never a sale (its ingredients are in purchases).
- isSale(r) = kind≠staff and status settled/open/due; saleV(r) = paid total, else running sum. Used by soldRecs (forecast, pace, running total, similar days), hourly (paid part + unpaid stack, staff out), yesterday lines, breakdown ("not paid yet" in By payment), itemsOf (dishes: staff food out), rpCurve (replay), fcAt replay, waiters, discounts, stats(doc) (rev = bills made; cash/card stay paid money; new .paid), range(), syncIndexToday (today's index = the box), buildMonth (SNAP_V 7 rebuilds month snapshots).
- History: ohOf counts customer bills only, at createdAt (first KOT, else pay time only when nothing else), and stores c (customer total), cb (bills), ns:1. ohScan rescans every day without ns (up to 400). applyLarge then sets INDEX[d].rev/bills from OHS (revPC / billsPC keep the shop PC's numbers, which include staff food). Until a day is rescanned it still uses the shop PC numbers.
- Paid-time on purpose (money really moving): Cash & bank tab, "Last bill paid", cash/card in More numbers, bill times (how long to pay).
- Compare "Last 7 days" today bar: paid part = stats.paid (was double counting unpaid once rev became bills made).
- Test /home/claude/t-rule.mjs (10): box = hourly sum = index = running total; dishes without staff food; history by the hour made; past day uses the customer total.

## v285 — stock bill reader: handwritten bills
- Majid: "the bill import features is soo buggy". Test set: 7 handwritten bills × (flat scan, phone photo on the counter) = 14 photos, 86 lines (sandbox scratchpad/hw: gen.html draws bill books + chits in 8 handwriting fonts, tilt/shadow/blur/JPEG; bills.json = truth; capt/t-hw.mjs scores every line through stock.html with the bundled reader). Before: 27% lines ready, 2 WRONG lines ticked. After: 36% ready, 0 wrong ticked; clear handwriting (veg, fish) 85–100%; messy fonts still need the free AI reader or typing.
- parseLine: a number written with a unit (10 kg, 2 L, 5 pkt) IS the qty; how = '3' (qty, rate, amount read and agree) · '2' (rate worked out from the amount — NOT proof) · 'mm' (qty×rate ≠ amount; alt = qty×rate) · '1' (amount only) · 'self' (one handwriting slip in the rate/qty makes the three agree: 238→28) · 'fix'/'fixr' (fixed by the bill total). The old code called a worked-out rate "ok".
- fixLook(): digits with look-alike letters become numbers ("2s6"→256, "Y4o"→440; never "3g"/"10l"/words); "S kg"→5 kg; units kq/lit/kettu…; "/-" endings; leading "(" in names.
- edits(n) = numbers one slip away (look-alike digit 1↔7, 3↔8, 2↔7/8, 4↔9… or one stray digit). sugA = qty×rate when the amount is one slip from it ("probably ₹180 (3 × ₹60)") + a "Use ₹180" button.
- repair(out): the bill TOTAL is the referee. Doubtful lines may take qty×rate (or keep the amount with rate = amount/qty when that rate is whole/half/quarter); the total itself may have one slip (8105 read 810) only when every line change is a one-slip suggestion; at most one weaker guess; ties = no change. A wrong "fix" seen in testing (total 2050 → 2030) is why these limits exist.
- Totals must match EXACTLY (≤ ₹1; was 0.5% — a ₹230 misread passed as ✓); "rounded off?" when ≤ ₹10. Fuzzy total word (otal, tota, t0tal); a trailing number-only line equal to the lines = the total. "Hayat", "M/s", "Signature" and a d/m date before the items are never item lines; d/m dates get this year.
- ocrLines keeps faint unit words and digits (≥25%) on number lines (handwriting).
- stock.html: goodLine() ticks a line only when its numbers prove themselves ('3'/'self'/'fix'/'fixr', known name ≥78%) or a clear read ('2' at ≥75%); new names only on a clear '3'. whyLine() says why each doubtful line needs a look (also in the form as "⚠ …"). Clear also clears the read card. Using the same read twice no longer doubles the lines. window.__RD test hook.
- Tests: capt/t-hwflow.mjs (14: handwritten photo → Use suggestions → add → type the one bad line → total matches → save 7 lines ₹2,050 → spellings learned; scrawl honest; Clear), capt/t-hw.mjs (scores), t-stock 18, t-stock2 18 (real1 photo now all 7 ticked — they prove themselves), parse-test 40.

## v286 — doctor-style bills: speak · type fast · pinned photo · safer AI
- Majid: "most shopkeepers give bills in messed up handwriting just like doctors notes". Test set scratchpad/hw/bills-messy.json (cursive, slanted, cramped, carbon smudge; gen.html messy()): the free on-phone reader got 0/14 lines and said "not a bill" — nothing invented. No free on-phone reader can read that. Majid chose: Cloudflare AI only (no Gemini) + speak the bill + faster typing.
- AI safety: AI lines now pass the SAME proof rules (stock-read ai(): rate_written → how 3/2/mm, sugA, repair() with the total; exact totals). Before, every AI line was ok:true and ticked. AI '2' lines (no written rate) are ticked only when the whole bill adds up.
- Worker: Llama 4 Scout first (photo inside the message as image_url), falls back to Llama 3.2 11B Vision (image param) if Scout errors; licence "agree"; free-limit 429 never falls back (no extra spending); object answers passed through; env.MODEL override. Prompt: rate_written only if written, unsure flag, "doctor's note" handwriting, never invent. README updated (paste the new worker.js). Mock test scratchpad/wt.mjs (7). Real Cloudflare not testable from the sandbox.
- 🎤 Speak the bill (stock.html quickTools/voStart): Chrome SpeechRecognition, continuous, ml-IN default (localStorage hayat-stock-lang) or en-IN; one spoken item = one line, live "what it hears", ✓/? per phrase. stock-read parseSpoken/spokenToText: number words in English, Manglish (pathu, irupathiyanchu, munnootti irupathu, aayirathi naanootti nalpathu, onnara) and Malayalam script with joining forms (മുന്നൂറ്റി ഇരുപത്, ഇരുപത്തിയഞ്ച്), Malayalam item names → English (ML_NAMES), units (കിലോ, ലിറ്റർ, പാക്കറ്റ്…); then parseLine. 15 sample phrases right.
- Type it like you say it: #qline ("thakkali 10 kg 32 320" + Enter) uses the same parser — also works with the keyboard's own mic. Chips = this supplier's items + recent (tap → line with last rate, cursor in qty). Enter jumps to the next box; Enter in the last box adds a line. 📌 Pin the photo: fixed top panel (36vh), scroll to move, tap = 220% zoom; unpinned on save/Clear.
- "Not a bill" card now offers 🎤 Speak the bill / 📌 Pin photo & type (and the AI reader hint for office).
- Tests: capt/t-voice.mjs (17, fake SpeechRecognition), t-hwflow 14, t-stock 18, t-stock2 18, parse-test 40, wt 7.

## v287 — similar days fixed · why this close · modifiers · traffic ahead · does avg bill matter
- Similar days (Majid's screenshot: on "Avg bill" a day that sold 51% less was "close"): simDays now always gates on MONEY so far (|md| ≤ max(2×tol, 15%) or the day is not listed); bills / avg bill only refine (match = 0.4 money + 0.3 metric so far + 0.3 shape). Avg bill is compared as a real average (₹ so far ÷ bills so far from OHS b) — before, hourly averages were SUMMED. close = money AND metric within ±tol AND shape ≥ 0.75 AND not special. Special = hol / eve / after flag differs from today → −15 match, "special day — left out of the range", never in "Days like this finished at".
- Why sheet (tap "By closing · why?" on the top box; replaces the old forecast sheet's top): so far + still to come = by closing; still-to-come hour bars; what made the rest (usual weekday, growth, part of month, holiday, today's pace at a quarter, nudge, outlook); Adjust; days that REALLY ended within 5% of the forecast with how they stood at this minute (nearEnds; tap = open that day); roads next 3 hours; "Does avg bill matter?"; "Did past nudges help?"; then the old chain table + backtest.
- Modifiers (MODS: 🌧 Rain −10, 🎉 Function nearby +10, 🏏 Match on TV −8, ✊ Strike/hartal −40, 🎊 Festival +15, own nudge −30..+30 slider): settings/fc_mods {d:{day:{m:{key:true},pct,at,by,base,sofar,nowH}}} (merge; onSnapshot so every phone sees it). modMult(day) multiplies ONLY the rest of the day inside fcAdj (fcToday(true) stays the app's own; fcRecord logs neutral). base = app's own total when set → modHistory compares app vs nudged vs real.
- Traffic ahead: trfUsual now also keeps per-weekday (TRU.uw) and per-day (TRU.days) hourly extra minutes. trfAhead(): next 3 clock hours = usual for that weekday-hour (≥3 readings, else all days) + today's current deviation × 0.6 / 0.35 / 0.2 → heavy (≥10) / medium (≥4) / light. trfEffect(): roads vs usual against that hour's sales vs normalHour → link r; traffic stays OUT of the forecast until n ≥ 40 hours and |r| ≥ 0.3.
- abReview() "Does avg bill matter?": at 2 pm / 5 pm / 7 pm on every past day (OHS h + b, each vs its last 4 same weekdays) — link of money so far, bills so far, avg bill so far with how the REST of the day went, and avg bill beyond money (on what money leaves unexplained). The forecast ₹ does not use avg bill; it only turns ₹ into a bills count (abRef).
- Sandbox reset on 15 Oct wiped /home/claude: new owner test harness /home/claude/oh (gen.mjs = 71 days of generated bills + traffic, stub.js fake HayatAuth/Firestore, lib.mjs openOwner/checker). Tests: oh/t-v287.mjs (15 × phone + laptop), oh/t-regress.mjs (11 × 2: simple view, box, one rule, every page, month, no errors).

## v288 — the forecast lab's winner runs the live forecast · Why we grew
- Majid: forecast is within 10–15%, make it better; replay from the beginning as if the future is unknown; why did we grow (fish? reels? boards?).
- Lab (labRun): replays EVERY day that has 35 days behind it (was the last 90), each forecast only from the days before it. LAB_CUTS adds 9 pm (c21). The app's REAL live forecast (fcLive at each cut) is scored too (LAB.applive.cut / cut28); every method gets cut28 (last 28 days). Leaderboard cut views show "The app's own live forecast" row and "Live forecast now uses: …".
- fcPick(): at the hour we are in (largest cut ≤ now; before noon = day-total scores) the method with the lowest last-28-day miss is used ONLY if it beats the app's own by ≥1 point over the last 28 days AND is no worse over all replayed days. applyPick() (inside fcToday, so neutral + logged forecasts use it too) scales the rest of today to pickTotal(): the method's day total for today (blend = the 3 best, 1/error weights from LAB.err) + the lab's own live correction (labLive) + today's hours. F.pick / F.appTotal say what happened; why sheet shows "Method: … (the app's own said ₹X)" + a switch. settings/fc_pick {auto:false} = always the app's own. labRun runs in the background 5 s after open, then every 15 min.
- Why we grew (Insights → Why we grew; simple Days page link): weekly avg a day (weeksData, full weeks, pre-bookings out) SVG line + 4-week average; changePts(): binary segmentation, a step kept only when |difference| ≥ 3 × the week-to-week noise (diff SD/√2), max 3, min 2 weeks a side. What grew: the 4 weeks before vs after the chosen step (else last 4 vs 4 before), day docs loaded (loadDay, IDB cache): avg a day / bills a day / avg bill, "more customers" (Δbills × old avg) vs "bigger bills" (new bills × Δavg), by channel, time of day (createdAt clock: lunch 11–4, evening 4–close), weekday (own %), dish group (catOf), dish. What we did: events (LAB_KINDS now has New dish, Instagram reel/post, Outdoor board, Offer — not one-off) → evEffect(): 14 days after vs 14 before, same weekdays averaged; noise = RMS of the same number at every date >21 days away; |z| ≥ 2 clear change, ≥1 maybe, else within normal swings; another event within 7 days = can't separate.
- Test data (oh/gen.mjs) plants +12% and more king fish from 14 Sep + a launch event: the page finds the step (+₹11K/day), fish leads the dish growth, the launch reads "clear change". oh/t-v288.mjs (11 × 2).

## v289 — Instagram (free Worker)
- cloudflare/insta/worker.js + README.txt: Instagram API with Instagram Login (Business/Creator account, no Facebook Page), Meta app "Hayat Insights", token as Worker secret IG_TOKEN, refreshed weekly into KV (IGKV) + free cron 0 3 * * 1; GET ?days=N → {account:{username,followers}, daily:[{d,reach,follower_count}], posts:[{id,ts,type,caption,url,views,reach,likes,comments,saved,shares}]}, cached 1 h in KV; origin check; clear errors for a missing / expired token. Mock test scratchpad/igt.mjs (5). Real Instagram not testable from the sandbox.
- Owner: settings/insta_cfg.url (office pastes it on Why we grew); instaPull() at most every 6 h (office) → settings/insta (every phone reads it). Instagram card: followers, weekly reach bars with that week's sales a day, link weekly reach ↔ sales same week and the week after (corr), posts with ≥ 2× the median views listed with evEffect + verdict, and shown as 📱 on the weekly chart. oh/t-v289.mjs (7).

## v290 — Instagram → sales, like a forecaster · new and returning customers
- Majid: numbers on views vs sales; new customers via Instagram may become permanent; "we need a solid forecaster".
- igViews(): views by day = each post's views spread over 4 days (60/25/10/5%). igAdstock(λ): A(d) = views(d) + λ·A(d−1).
- igStudy(): SHORT term = log(sales / last 4 same weekdays) vs log(1 + yesterday's A/1000) for λ in 0/.3/.5/.7/.85 (best link; half-life = ln .5 / ln λ; "doubling views ≈ +x%" from the slope). LONG term = weekly avg a day vs weekly carry-over views, λ 0/.5/.8/.95 — a link only at high λ = the lift STAYS (habit).
- Forecast: LAB_FEATS gets 'ig' (continuous) = log(1 + carry-over views up to YESTERDAY / 1000), λ FIXED at 0.5 and a fixed scale — both choices made from all history would let the replay peek at future posts (test checks a post on day d leaves day d's signal unchanged). LAB_GROUPS 'ig' → the lab's "which signals help" shows Instagram on vs off; the ridge method (and so the blend / pick) uses it only through the lab's own scoring. Lab cache key includes INSTA.at.
- custStudy(): phones on bills (r.customer.phone, VMENU "null" ignored, last 10 digits), last 120 days of day docs: per FULL week customers, new (first time ever seen), came back within 30 days; weekly reach vs new customers link. Coverage shown (% of bills with a phone — mostly delivery / counter; dine bills rarely have one).
- Why we grew → Instagram card: "Do views move sales? your numbers" (next days · weeks · forecast signal) + big posts; new card "New and returning customers".
- Tests: oh/t-v290.mjs (9: no peeking, short / long links, lab signal, table, phones counted, more new customers after the planted reel, retention). All owner suites: t-regress 22, t-v287 30, t-v288 22, t-v289 7.

## v291 — Stock: kitchen release + closing count (step 1 of 4 of the inventory plan)
- Majid, 15 Oct: inventory, purchases and kitchen releases are "the toughest part". Plan: 1 Release + Count · 2 used vs should-have-used (Big 6 gap) · 3 buy list per supplier + WhatsApp + rate-jump alert · 4 WhatsApp share → Stock app + VMENU purchase match. Flow is MIXED: chicken, fish, veg go straight to the kitchen when bought; rice, oil, masala, gas sit in the STORE and are released.
- stock.html tabs: ＋ Bill · Release · Count · Bills · Items. New collection stock_moves/{id} {v:1, kind:'release'|'count', place:'kitchen'|'store', day (business day), at, by{id,name}, lines[{k (item slug), n, q, u}], sug (release only: what was suggested, for scoring later)}. Release id yyyymmdd-rel-<ts> (several a day). Count id yyyymmdd-count-<place> (one per place per day; saving again overwrites). Never touches vm_*, orders or stock_buys.
- Item kept where: settings/stock_items.items[k].w = 's' store | 'k' kitchen; default by category (whereOf: Grocery, Rice & flour, Oil & ghee, Spices, Drinks, Packing, Cleaning, Gas & fuel, gas/cylinder → store). Items tab: 🏬 Store / 🍳 Kitchen toggle.
- Suggested release (sugRelease): mean of what went out on the last 4 same weekdays (fewer than 2 → last 7 release days) × sales factor (avg sales of the 7 open days before today ÷ the same before each of those days, vm_meta/days rev; capped 0.8–1.25), rounded to 0.5 kg/L or 1. Minus what went out today; an item offered in an earlier release today (sent, changed or ✕ skipped) is not suggested again. First time (no history): every store item with an empty box. Button shows ≈ ₹ worth (qty × last rate). Undo = second tap (office any time, others 10 min, own release). Drafts in localStorage hayat-stock-rel / hayat-stock-cnt (today only).
- Count: Kitchen = Big 6 + anything counted there before; Store = store items that are Big 6 or counted before. Each row shows "last N kg · day"; "0" button = none left; empty boxes show "—" (not counted).
- Voice / typed line for both (StockRead.parseQtys): "kozhi pathu kilo, ari irupathiyanchu kilo", "12 kilo chicken", "mathi illa" (illa / theernnu / kaali / nothing = 0), several items per breath, Malayalam script too; g→kg, ml→L for kg/L items. Fillers ignored (baaki, left, kodukku…).
- Near names (Majid's ask): match() now returns alts (next 3 names ≥0.45). Chips "or did you mean …" only for close calls: new item, score <0.9, an alt within 0.15, a dictionary nickname that is a whole word of another of our items ("masala" → Garam / Mandi), or OUR items of the same kind when the match is a dictionary name we don't keep ("mathi" = Sardine → Fish first). Tap = the qty moves to that item; the spelling is learned (alias) on save. Bill reading itself unchanged (t-readdiff: 67 cases same as v286).
- VO.target 'bill' | 'rel' | 'cnt' routes speech; switching tabs stops the mic. typing() guards every snapshot re-render (a cloud update never steals a half-typed qty).
- Tests: /home/claude/oh/t-mv.mjs (39 × phone 390 + laptop 1100 = 78), stub-stock.js (query snapshots), t-readdiff.mjs. Old capt/t-stock*, t-voice, t-hwflow were lost in the 15 Oct sandbox reset.

## v292 — supplier bills removed from Spends (for good)
- Majid, 15 Oct (screenshot): "Supplier bills" + "Item-wise purchases" cards on the day Spends tab = waste of space; the same money is already in the day's spend lines (daySpendCard / spRows, v220). v220 had removed only the chart (spDaily); purchases() kept rendering both cards on the full view Spends tab and in the range cards. purchases() is now DELETED (both callers). Do not bring back a supplier-bill or item-wise purchase list on Spends.
- Day spends sheet (spDaySheet): the "Supplier bills" KPI is gone; a supplier bill is listed only when it is a possible duplicate ("Possible duplicate supplier bills" + Remove).
- Test /home/claude/oh/t-v292.mjs (12: full + simple, phone + laptop).

## v293 — no forecast boxes on Live
- Majid, 15 Oct: take the 4 small forecast boxes (By closing · Bills · Avg bill · Next hour + ⚙ forecast settings) off the full view's Live tab ONLY. Sales tab unchanged; simple view Today keeps them; Average a day, the Today/Tomorrow outlook and More numbers stay on Live.
- todayBox(): no forecast row when VIEW==='full' && TAB==='floor'; .tbox.nofc = one column on laptops. Test oh/t-v293.mjs (18); t-v287 now opens the why sheet from Sales.

## v294 — full code review (4 passes) · green theme gone for good
- Majid, 15 Oct: "pista colours coming back" — the green "garden" theme is DELETED (app.css block + index.html fallback). Default/fallback theme is paper; a device that remembered garden gets paper; the theme button toggles night ↔ paper. (The live config already said paper; only a missing config.theme fell back to green.)
- Pass 1 (dead code): parser-based scan (tools: dead2.mjs = unreferenced functions across all files; csspr.py = removes only selectors naming a class used nowhere, cssver.py proves no live rule was lost). Removed ~20 dead functions (owner, shop, index, captain, clean, sim), ~180 dead CSS rules (app.css, owner, captain, setup, sim), owner's hidden legacy top controls (Day/Period seg, old ‹ select › ▦), forecast Show/Hide leftovers (FC is const true), FC_UNP, the old 4 top boxes still computed (and a wasted fcToday) inside kpis().
- Bugs found by a lint pass (no-undef): shop.js GATE_WAITED never declared ("use strict" → staff gate threw on a slow connection); sim.html PB undefined (day picker never worked); app.css orphan half-rule at the "find" block swallowed `html.deskboard{overflow:hidden}` (office board scroll lock on older iPads).
- Pass 2 (review by area, each fix verified):
  - owner: "Why we grew" endless render loop when a day has no log (CACHE null re-fetched) · Forecast lab never cached (LAB.key) · 05:00 rollover follows the new business day (setDay + prebook listeners) · Cash & bank today refreshes on snapshots (cashLive) · hourly unpaid stack on any day · usualByNow uses INDEX hours (pre-bookings out) · running-total forecast × modMult · why-sheet headline incl. pre-bookings · discounts/waiters follow v284 (staff out, bills made; SNAP_V 8) · esc() on item names, rider, invoiceId · per-render fcToday memo (FC_MEMO) · outlook builds only the visible tab · obsolete month()/range()/PT_ACC/tmTile/labgo removed.
  - shop.js/index: drawer (pos_days) never saves before it has loaded + merge writes · settling only marks till bills delivered (website deliveries stay open) · status only moves forward (double Accept = one KOT; rider re-assign allowed) · wide-screen menu reads the live menu (SHOP.liveMenu) · search cache reset on menu change · counter bills get type counter/delivery · business day 05:00 everywhere (shiftStart gone), dates from local time · usual grid freezes after the first server snapshot · rider job page checks the rider · gate timer abandons when the page changed · old Leaflet maps removed, listeners once · repeat orders re-priced from today's menu · "hide today" stores the day · install prompt cleared after use · obsolete sign-in paths removed. NOT changed (ask Majid): customers can still cancel an accepted order.
  - captain/kds/print: removing a dish / cancelling refused below money already taken; "↩ Undo the last part payment" (10-min rule) · credit receipts/refunds write moneyDay so Paid today keeps them · KDS cleaning log re-subscribes at 05:00 · "n of m ready" per expected kitchen screen (station map copied from kds.html — keep identical) · paid bills keep uncooked tickets on the KDS · unknown dishes fall back to the line's station / Main kitchen (bottled drinks still skip) · duplicate send removes only that KOT's lines and prints if missed · quick-cash on the balance · drafts stamped {person, day, trial} · pay-sheet restore per person · kot.skip honoured on KDS + Fire · Clear trial data reads trial_* directly · print.html: real pay modes, TO PAY = balance, rider line only for delivery · Pay button / table card use the balance.
  - misc: sw CORE adds owner, kds, clean, waitlist, sim, hayat-clean.js · clean/waitlist re-subscribe at 05:00 · voice recognizer restart guard · cleaning photo / waitlist party escaped · bill dates must be a real date within 60 days · no-voice hint shows · messaging SW focus/openWindow · planner pending cloud save · rider.html orphan CSS removed.
- Pass 3 (speed, owner redraw): Live 27 → 16 ms, Sales 24 → 19 ms, Forecast lab 129 → 10 ms; endless loop gone.
- Pass 4: repo tests counter 56 / login 25 / pos-flow 39; owner suites t-regress 22, t-v287 30, t-v288 22, t-v289 7, t-v290 9, t-v292 12, t-v293 18; stock t-mv 78, t-readdiff 67 same; smoke in the fake-Firebase demo world (customer order → office accept/assign → rider; captain sign-in → KOT → KDS ready → part pay → void refused). Review copy + git history: /home/claude/review/work.
- Obsolete files still in the repo (Majid to OK removal): owner-1.html, fakemaps.html, apply_dock_patch.py, WHY-INDEX-IS-BIG.txt (public dev notes).

## v295 — 📞 in-app calls, rider ↔ customer (free WebRTC)
- Majid, 15 Oct: proxy calling; for now names + phone numbers stay visible (hide later), add in-app calling as an extra. "Absolutely free."
- call.js (window.HayatCall, loaded before shop.js in index.html + rider.html, in sw CORE): WebRTC audio straight phone to phone. Signalling = Firestore calls/{orderId} {cid, from, to, fromName, state ringing|answered|declined|missed|ended, offer, answer, at, answeredAt, endedAt, endBy, why, log:[{cid,from,state,sec,at}] (last 20)}. No trickle ICE: each side waits for its candidates (≤3 s) and sends one description. Answer / every end goes through a transaction that only touches the doc while it still belongs to that call (cid). Ring 45 s → missed ("try a phone call"); failed/lost → toast. Ring tone = WebAudio + vibrate; Notification when the tab is hidden and permission exists. Panel #hcBox (Answer/Decline · Mute/End · timer), paper/night via app.css vars.
- ICE: public STUN (stun.cloudflare.com, Google) always; TURN only when settings/captain.callRelay is set → POST to the free Worker cloudflare/turn (worker.js + README.txt): Cloudflare Realtime TURN `rtc.live.cloudflare.com/v1/turn/keys/{TURN_KEY_ID}/credentials/generate-ice-servers` (Bearer TURN_KEY_API_TOKEN, ttl 12 h), drops :53 URLs, ALLOW_ORIGIN check. Cloudflare TURN = 1,000 GB/month free (a voice minute ≈ 0.75 MB). Field: setup.html → Settings → 📞 In-app calls.
- shop.js: HayatCall.attach(FB) in connectFirebase; appCallBtn() "📞 In app" next to Call on the customer's rider card (viewOrder) and the rider job page (viewDrive); callSync() on STORE.onChange + hashchange — the PAGE decides the role (rider app / #/drive = rider: own assigned/on_way jobs; menu order pages = customer: own orders with a rider). Rings only while the other side has the site open.
- Test /home/claude/demo/t-call.mjs (14, two pages, fake mic, fake Firebase): buttons, both listening, rider calls → customer rings with name → answer → both live → audio track → mute → hang up both sides → log "talked 7 s"; customer calls → rider rings → decline; caller hangs up while ringing → ring stops. Worker mock (relay addresses, :53 dropped, foreign origin 403, GET 405). Repo tests 56/25/39.

## v296 — premium ivory: customer menu, cart, tracking, rider app
- Majid, 15 Oct: "make the customer and rider app look very professional, and insanely awesome" → Premium ivory; scope menu + cart, order tracking, rider app; rider extras must be switchable from the office (a pooled rider service for several restaurants may come later).
- premium.css (new, after app.css in index.html + rider.html, in sw CORE): every rule is `html[data-theme] …` so it beats the paper print-menu rules; built on theme vars (--cream = readable text in both themes, --pv-dark/--pv-on for dark buttons, --pv-ok green). Night works too.
- Landing: photo hero .phero (C().heroImg, else the first section photo) with mark, language pill, Hayat, open state, ETA, Cash or UPI · round section chips .pcats (open + scroll to the section) · section covers .mcover · bigger dish photos, pill buttons. Deliberately NOT <header>/<nav> elements (global app.css styles those).
- Cart bar #cartfab: count · total · "pay on delivery" · View cart (keeps [hidden]). Cart: photo lines, .billcard (items, delivery ETA, to pay), sticky checkout.
- Tracking: orderHero() card (icon, status, "Arriving in ~N min" counting down every 30 s via .oeta[data-eta], 5-segment bar) · rider card with initial avatar.
- Rider app: hello row + today strip (to go · done today since 05:00 · cash with you · earned today) · job cards "Open ›" · job details in .dvcard, Navigate full width · slide to mark delivered (drag past 85 %, Enter/→ on keyboard; the "or tap here" link keeps id dvGo).
- Office → Riders → "Rider app" card: settings/rider {today, slide, earn} (STORE.riderSettings / saveRiderSettings). earn 0 = hidden.
- app.css: dead .mtop/.mbrand/.mtopr rules removed (old landing header).
- Tests: /home/claude/demo/tour.mjs + tour2.mjs (switches; slider half drag = nothing, full drag = delivered; night), t-call 14, smoke1/2, repo 3 suites green (run with -r /home/claude/tools/pwfix.js for the Chromium path).

## v297 — counter looks like the captain app · no keyboard on taps · iPhone voice
- Majid, 16 Oct: "the counter app is so much unlike a Captain app it looks horrible and on clicks of items keyboard opens"; iPhone voice "pops up and immediately closes and says allow microphone".
- Counter (#/admin/pos): posCardsHtml() = one card per dish (.posdish, name + variant like "Without mandi") with its sizes as buttons (Qtr/Half/Full + price). Each size button is still a .postile with data-pos, so the frozen usual order, ↑↓ / Enter and every test hold. Count badge (data-n) on sizes already on the ticket.
- Keyboard: search is focused on open / after a tap / after a category ONLY with a real keyboard (posKbd = hover:hover + pointer:fine) or while a search is being typed. Phones keep the keyboard down until search is tapped.
- Phone (≤720 px): bottom bar #posDock (₹ total + "n items · bill ▴" + Send KOT, the reason above it when Send is off). The ticket panel (.posright, same elements and guards) is a bottom sheet (body.posbill, scrim closes it); Send from the bar clicks #posGo, or opens the sheet when it is off. syncDock() via a MutationObserver on the panel.
- Stock 🎤 on iPhone (stock.html): Safari hears one phrase per tap and refuses a restart that does not come from a tap — the old continuous auto-restart flashed the mic popup then "Allow the microphone". IOS → continuous off, no restart, "one item per tap" hint; voWhy() gives the real fix and keeps it on screen (VO.err): mic blocked → Safari aA → Website Settings → Microphone; service-not-allowed → Settings → General → Keyboard → Enable Dictation; home-screen app → open in Safari / keyboard 🎤. Chrome/Android unchanged (continuous + restart).
- Tests: /home/claude/demo/t-v297-pos.mjs (15, phone + laptop), /home/claude/oh/t-v297-voice.mjs (23, fake speech, iPhone + Android + home-screen), repo counter / login / pos-flow green, t-mv 78, t-readdiff 67.

## v298 — owner graphs back · what the owner watches · Arrange · counter tables, Pay a bill, onboarding
- Majid, 16 Oct night: "my owner app is fully screwed, I don't see any of the widgets and graphs… bring it back… I love clear screen but still need graphs" · "add analytics, see which things I watch most… after 2-3 days" · counter: "most is takeaway or delivery; dine-in shall show tables" · "a list of due bills so the cashier can quickly check which table the person came to pay" · "easy onboarding of new and old cashiers".
- Audit (oh/audit.mjs, cards + svg per page, v289 vs v293 vs v297, phone + laptop): NOTHING had been deleted except the supplier-bill cards he asked to remove (v292). What hid the graphs: the SIMPLE view became the default (v283) and many cards sat folded under "More" (v277). Real-data errors could not be checked from the sandbox (Firestore not reachable).
- Owner: VIEW default 'full'; a one-time switch (localStorage hayat-view-v298) moves devices that were defaulted to Simple back to the full board; choosing Simple again (More → Simple view) sticks. moreG folds are OPEN unless the person folded them (MOREG[key] !== false; kpi2 too).
- SAFE(fn,name): ~40 card functions are wrapped; a card that throws shows "⚠ This card could not draw" + the message in its place, the rest of the page draws (before, one throw blanked the page). Each card's first element gets data-ck="<function>". window.__OWNUX = {page, view, render, errors, who, fs, day}.
- owner-ux.js (new, sw CORE): usage = seconds per page and per card while ≥50 % on screen, page in front and someone touched/scrolled in the last 3 min; taps per card; folds opened (tap on the summary). localStorage hayat-ux + Firestore owner_ux/{day}_{device} {day, dev, who, wide, pages:{page:{n,s}}, cards:{page|card:{s,t,n}}, opens}, every 60 s + on hide. More → "📊 What I look at" (last 7 days, all devices: pages, cards most watched, folds opened; says "give it 2–3 days"). More → "✎ Arrange this page": ▲ ▼ move a card within its grid (CSS order), 👁 hide (offered back at the bottom), Reset; per device (localStorage hayat-layout {page:{order,hide}}). Nothing is deleted. Next: after 2–3 days read owner_ux with Majid and rearrange one page at a time.
- Counter dine-in: Dine-in shows the floor plan (settings/floor, else the captain app's default A1-10 / N1-7 / H1-2 / J1-6) with hall chips (hayat-pos-space); a busy table shows its unpaid ₹ and minutes; tap a free table = pick it (the #poTable box stays for typing); tap a busy table = resume that bill (add items). Refreshes with cloud updates (not while typing).
- 💰 Pay a bill (next to search, count badge): "Who is paying?" sheet over every unpaid open bill (any source: captain tables, counter tokens, website/phone): exact table/token first, then bill printed, then oldest; chips of busy tables; a short number (≤3 digits) means a token or table, never part of a phone; rows show where, waiter, minutes, items, balance (pays already taken subtracted), "bill printed hh:mm"; Take ₹ → settleSheet; Bill → posBillSheet; Add items → resume. Enter = take the top bill.
- Onboarding (research: recognition over recall, Hick-Hyman ordering, contextual help over manuals NN/g, Fitts at the thumb): 4-step spotlight tour on first open per person per device (hayat-pos-tour1|name; never blocks taps, a tap elsewhere ends it; window.__posNoTour skips it in tests), "?" help sheet with "Show me again", one tip a day for this device type (hayat-pos-tips, "Got it" hides it for the day). posWhereFrom: captain bills say "Table".
- Tests: oh/t-v298.mjs (25 × phone + laptop = 50), demo/t-v298-pos.mjs (31), demo/t-v297-pos 15, repo counter/login/pos-flow green (tests set window.__posNoTour), all owner suites, stock suites.

## v299 — Live order
- Majid, 16 Oct: on Live, "orders not paid" and "needs attention" go below the tables; no "Average a day" on Live (it is on Sales). Live = New orders → Tables → Needs attention → Ordered · not paid yet → Outlook → Kitchens (+ More on Live). avgStrip only off Live (Sales keeps it).

## v300 — Sales by hour readable · owner sign-in remembered
- Majid, 17 Oct (screenshot): the current hour had no "now ₹X" when sales were above the forecast, its "+₹6.9K" sat on top of a stuck dark pop-up. hbars: the current hour (F.nowH) ALWAYS gets one label "now ₹X" (paid + unpaid) with "₹Y unpaid" on a second line, above the taller of forecast / sales; its own +unpaid label is dropped, and on phones (<640 px) the neighbours' +unpaid labels too. @media (hover:none) hides the .bar/.d hover pop-ups (a tap made them stick on phones; tap still opens the hour). Laptop pop-ups draw above labels and the first/last 3 bars anchor inside the card.
- Sign-in: all apps on one browser share ONE Firebase anonymous sign-in, so the captain app (Switch user), counter gate, rider sign-in/out and website sign-out replace it; a weak signal (staff read failed) also asked again. owner.html saves {crew, name, code} in localStorage hayat-owner-me after a good office sign-in (Majid OK'd keeping the code on that browser); on open, if the role is not office, ownResign() quietly rewrites staff/{uid} (6 s; no answer = trust this browser; refused = the code changed → form with the name preselected). More → "⎋ Sign out here" (second tap) forgets it.
- Test /home/claude/oh/t-v300.mjs (22); all owner suites green.
