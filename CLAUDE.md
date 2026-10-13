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
