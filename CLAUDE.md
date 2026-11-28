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

## v301 — Price simulator (Insights → Price simulator)
- pricePage() / psBase() / psRun() / psPaint() / psWire(); state PS (localStorage 'hayat-psim' {p:{dish:price}, sens}).
- Base = last 21 finished days (customer bills; staff food and pre-bookings out): plates a day, revenue a day, p0 = the price most bills carried in the last 7 days.
- Plates at a new price = q × (p/p0)^(e × sens). e per kind of dish (psEl): Full mandi −1.3, Half/Qtr/meals/broast/biriyani −0.4, king fish mandi −1.8, fish/prawn fry −1.5, bottled drinks −0.3, juices/tea −0.6, breads −0.2, else −0.8, measured on the 25 Oct 2026 price change hall by hall, net of the change in customers. A Full that saves less vs two Halves loses extra plates × e^(2·Δsaving); half of each lost Full comes back as a Half. sens 0.6 / 1 / 1.5 ("how price-aware"); the month tile shows the 0.6×–1.5× range.
- Food cost per plate = plateCost() (dish costs / recipes in settings/costing), bottled drinks 78% of price, no recipe 35%. Fixed a day = fxMonth (this month, or last month when <10 days in) ÷ days + bulk ₹/day. A dish whose cost is ≥95% of its price, or a Half costing >1.5× half a Full, shows "⚠ its food cost looks wrong" (settings/costing.rec had ALFAHAM MANDI HALF typed with Full amounts).
- Sliders repaint numbers in place; render() is held while a slider is pressed (PS.drag → PS.pend) so a live snapshot cannot pull it away. "Try the review's prices" = PS_SUG.
- Tested in a local stub (day logs as JSON, writes kept in memory): rows, slider, suggest, reset, sensitivity, drag guard, more dishes, 375 px no overflow.

## v302 — Price & trend (the v301 page grows a trend, a "what changed" and plan projections)
- Tab renamed "Price & trend" (TSUB patterns 'price'). Page = psTrendCard + psDiagCard + the simulator card.
- psTrendCard(S0,SP,SU,fx): last 14 full Sun–Sat weeks from INDEX (rev = customer bills + pre-bookings, bills a day under each week), EVENTS markers, then the next 6 weeks projected (psProject: weekday level of the last 21 finished days with the 29th–4th left out, ×1.10 on the 29th–4th, + average pre-bookings) for Keep today's prices / Fix a few items (PS_SUG) / Your slider prices (only when sliders differ). Break-even line = fixed a day ÷ (1 − food share of today's prices). Table: sales a day, profit a day, profit a month for each plan.
- psDiagCard(): "What changed" = a normal 4 weeks (date input #psRef, PS.ref in localStorage hayat-psref, default 2026-08-30; falls back to 8 weeks before the last 21 days) against the last 21 days, per day: bills, sales, avg bill; Where (dine / walk-in counter / delivery); When ordered (11–13 … 22–close); Bill size; Mon–Thu / Friday / Sat–Sun; dishes selling fewer / more plates (≥1.5 a day, ±20%). Rows down ≥15% and ≥2 a day are shaded and named in "Fell most". Ref days load with the base days (psBase need list).
- Releasing a slider (change) redraws once so the trend picks up the slider prices; dragging still repaints in place.
- Profit here uses the app's monthly costs (settings/costing ohl/oh) — keep "set monthly costs" complete or profit reads high.
- settings/costing.ohl (20 Nov, Majid): ONE line "Costs paid outside the app (not in spends)" ₹2,50,000/month. Rent, power and salary are already spend lines (BUILDING RENT, ELECTRICITY BILL / KSEB BILLS, SALARY) — never add them as ohl lines too (double count). The old oh {rent 75000, power 60000, other 5000} was removed.

## v303 — Entry offers card (Price & trend)
- psHookCard(B,S0) between "What changed" and the simulator: two small cheap plates meant to bring in new tables — PS_HF.pr "Prawns · small frozen plate" and PS_HF.kf "King fish mandi · small portion". Inputs per offer (PS.h, saved in hayat-psim with p/sens; defaults PS_H0 pr {p 199, g 150, kg 400, x 20, t 2, s 60}, kf {p 479, g 150, kg 940, x 35, t 2, s 40}): price slider, new tables a day slider, switch % slider, grams / cost ₹ a kg / other cost number boxes.
- psHook(): plate cost = g/1000×kg + x; keep = p − cost. Switching plates = s% × today's plates of the dish it replaces (sw regex: any PRAWN item / KING FISH MANDI QTR), each losing (their keep − mini keep). A new table keeps the mini's margin + what such tables usually also buy (psBase fam: avg bill of tables with that dish − the dish's amount, over the last 21 days) × keep share (1 − food share at today's prices). Pays-for-itself = switching cost ÷ gain per new table. Total of both offers a day and a month.
- Inputs repaint in place (psHookPaint), sliders use the same PS.drag hold as the simulator.

## v304 — lunch vs evening on Price & trend · same days of the month
- Lunch = bills made 05:00–15:59, evening = 16:00 to closing. psSes(d) splits INDEX[d].hours — NOTE hours[i] is a BUSINESS hour (clock = (i+BH0)%24, BH0=5), so lunch = i < 16−BH0. When the day's large-order list has taken nothing out (INDEX[d].big not > 0) and hours are by order time (x.byOrder), OHS[d].lg bills over PRE (₹4,000) are subtracted from their session.
- psWeeks also returns l / e (lunch / evening a day); psTrendCard draws them as two lines (pslL / pslE) over the weekly bars, and the note gives last 4 weeks vs the 4 before for all / lunch / evening.
- psWomCard() "Same days of the month": this month + the two before, blocks 1–7 / 8–14 / 15–21 / 22–28 / 29–31, lunch and evening sales a day (finished days), the current block marked "now", % vs last month and vs two months ago.
- "What changed" gets a "Lunch and evening" group: lunch / evening sales a day and bills a day (psSeg ses).
- v305: "What changed" adds a "Channel, lunch and evening" group — Dine-in / CO / Delivery × lunch / evening, sales a day and bills a day (psSeg o.cs keyed by r.kind after prep(), so counter bills noted dm…/hd/zomato count as Delivery, as everywhere in the app). The Where row is now called "CO · walk-in counter".
- Raw VMENU kinds differ from the app's: in Oct 2026 about 8–9 deliveries a day were typed as counter bills with a "dm" note (Nov: 0–2). Any analysis on raw kinds overstates CO and understates Delivery for October.
- KNOWN GAP (found 21 Nov): settings/large_orders.b is EMPTY in production (s = days scanned is filled), so applyLarge subtracts nothing — INDEX[d].big = 0 and every history chart / forecast built on INDEX hours or nrev still includes pre-bookings (e.g. ₹18,500 + ₹13,500 on 19 Sep). Only psSes works around it. Fix preScan / applyLarge separately.

## v306 — Dish groups day by day · price changes found in the bills · EXPORT-DATA.bat
- Insights → Dish groups (TAB 'dgrp', dgPage/dgDay/dgChanges/dgEff/dgChangeCard/dgWire; state DG in localStorage hayat-dg). Grid = every finished day (14/28/56) × dish group (dgFam: Alfaham Mandi, Chicken Mandi, Mandi rice, Peri Peri/Honey, King fish, Broast, Meals, Biriyani, Payasam…), ₹ or plates, All/Lunch(<16:00)/Evening, All/Dine/CO/Delivery; each box coloured vs the same group on the last 4 same weekdays (±10 / ±25%); "now" column = today so far (DOC, never coloured). Customer bills only, pre-bookings out (isSale, isLarge). ⬇ CSV of the grid.
- Price changes: per item+hall, the price most plates were billed at moved, was steady on the 2 sold days before and held the next sold day (or is the last day); dish must sell ≥1 plate a day and the hall must sell it on ≥ half the days (else noise). Today is never used to find a change (shows the morning after). Effect = after (max 14 days) vs the same weekdays 1–4 weeks before: plates a day, plates per 100 customer bills (the fair test), ₹ a day; whole shop and whole group lines; "early read" under 7 days.
- EXPORT-DATA.bat → tools/export_data.py (stdlib only): vm_daylog for the last 180 days (arg = days), cached in Documents\Hayat-data\cache (last 2 days re-fetched), writes daily_groups.csv, daily.csv, price_changes.csv, items.csv, bills.csv + README (questions) and a zip in Documents\Hayat-data. Same rules as the app (channel incl. dm notes, staff out, ordered time, pre-bookings flagged). No names / phones / notes.

## v307 — Trends (Insights → Trends)
- trPage = trSmart + trChart + trSugg (TAB 'trend'; state TR in localStorage hayat-tr). Uses dgDay, which now also keeps ic (item × session/channel key), dc (discounts) and bs (one row per bill: [kind, L|E, value, discount, business minute, {family:[₹,qty]}]).
- OFFERS ARE BILL DISCOUNTS: VMENU's `discount` field stays 0; a discount shows as total < sum of items (settled bills). dc / "Discounts" line / trSugg offer note use that gap. 21–24 Nov: offer bills mostly PARCEL (CO / dm).
- trSmart "What is different": last finished day vs its last 4 same weekdays (flag |Δ| ≥ ₹700 and ≥ max(20%, 1.5 SD of the last 8 same weekdays); rare |z|≥2, unusual ≥1.5) over channel × lunch/evening, dish groups (not Other), top 30 dishes, discounts; today so far vs the same business minute on the last 4 same weekdays; this week so far vs the same days of the 4 weeks before; "moving steadily" = 3 full Mon–Sun weeks in a row up/down and ≥12%.
- trChart: Day (thin daily + bold 7-day average) / Week (Mon–Sun avg a day), 4/8/12 weeks or From–to, ₹ / bills-plates / average, all day / lunch / evening; up to 8 lines (channels, Discounts, dish groups, any dish via the search box); settings/events shown as markers and added from the card (same store as the Forecast lab).
- trSugg: combos = main + side bought together (≥10 bills, lift ≥1.15) with a price at −7% ending in 9; mandi tables with no drink; dessert share; lunch single plates <₹350; Full vs two Halves / Half vs two Quarters (top 5 families, 7-day billed price); dishes chosen less per 100 bills (2 weeks vs the 2 before); offers given in the last 7 days.
- v308: Trends chart adds Month (avg a day per calendar month) and a 6-month range; dish-group / dish / Discounts lines carry their own channel ("Dish lines sold through" chips → id 'g:Name@dine'), so the same dish can be compared Dine vs CO vs Delivery. Suggestions header links to the price simulator (data-tab price).

## v309 — period analysis · Top items dropdown
- Period view (week / month / range) Overview: "Sales by day" is now pdCard(from,to) (state PD, localStorage hayat-pd): bars stacked Dine-in / CO / Delivery (channel colours) or Total, or lines; Day / Week / Month (avg a day, or avg a week ×7); ₹ / bills (plates when a dish is chosen) / average; all day / lunch / evening; filter = one dish group (select) or one dish (type); events as markers; tap a day bar = open the day. Summary table per channel vs the previous period of the same length (prevPeriod) + share. Finished days only (today left out), day docs via dgLoad/dgDay.
- pdTable: dish groups or dishes (inside the chosen group), Top 10–30, ₹ a day by Dine-in / CO / Delivery + stacked bar, total, share, plates a day, vs the previous period; tap a row = chart it.
- Top items card: select Top 10/15/20/25/30 (data-topsel, one delegated change listener) instead of the 10/15 buttons.

## v310 — handoff phase 1 (ChatGPT review, 25 Nov)
- Live order: lastGap ("Last order received" — not "customer", bills carry no customer id) in its own card first, then Tables (floor), then New orders, then the rest.
- Bills per hour: "Guests" only appears when some dine bill has covers (pax>0); the title says how many of n dine bills carry covers; with none, a note says people cannot be counted (VMENU guests are blank on every bill — the old chart was bills × 1, never footfall).
- Past day top box compares with the usual same weekday (last 4, pre-bookings out), never yesterday (from the earlier ChatGPT patch). Its CSS polish block (owner-ui-polish-2026-11) adopted; its "folds closed by default" REJECTED (Majid asked for graphs open, v298).
- hourDetail(i) under the tapped hour (hourCompare): bills MADE in that hour — sales, bills, avg bill, discounts (total < items), channel split bar + rows, top 6 dishes.
- pmCard (period overview, after pdCard): Lunch / Evening / All day × Dine / CO / Delivery / All — ₹ a day / ₹ a week / bills a day / avg bill / discounts a day, vs the previous same-length period; open days only; part-week noted.
- tmDishes (Live, today only): tomorrow's plates per dish from the last 6 same weekdays (median, P25–P75, lunch share) scaled by fcModel(tomorrow).plan ÷ their average (capped 0.8–1.2); mandi / alfaham families in Full-equivalents (rice out); pre-bookings named separately; no kg (recipes / stock / waste not recorded).
- Verified: FC_MODE='day' is forced on purpose (Majid + Oct replay); v288 fcPick already swaps in a lab method only when it wins out of sample.

## v311 — traffic collector (server side) · road speed · calendar
- cloudflare/traffic/worker.js + README.txt: free Worker, cron */15. Routes (TomTom Routing, same request as trfRead) → settings/trf_YYYY-MM d.`day`.`HH:MM` {at, src:'cron', r} (same shape as trfLog, so history / usual / hint fill in); road speed (TomTom Flow Segment Data at settings/traffic.flow points, default the shop on NH 966) → traffic_flow/{day} {s:{slot:{pid:{sp,ff,tt,ftt,cf,cl}}}, pts, at}; settings/trf_health {at, ok, routes, points, err}. Business day 05:00 IST; slot = 15 min; Firestore REST PATCH with updateMask (merge, idempotent) + the web API key — works only while the rules are open. Keys: env TOMTOM_KEY secret, else settings/traffic.key (empty in prod — the app uses config.js traffic.tomtomKey). Tested: 15 mock checks (scratchpad/trf/t-worker.mjs) + one real run on 25 Nov 22:28 (2 routes + 1 point written next to the app's own slots).
- App: trfHealthLine() under Road traffic (ok / stale >45 min / error; "not set up" when no health doc); flowSheet() "road speed history": weekday × hour speed as % of free-flow (28 days of traffic_flow), link of speed deviation vs sales vs usual same weekday hour (OHS h), lunch / evening, judged only at n ≥ 40 hours and |r| ≥ 0.3. Speed is congestion, never called vehicle volume. Kept out of the forecast.
- Calendar (Insights → Calendar, TAB 'cal'): settings/calendar {e:{id:{d0,d1,kind (public|festival|school|exams|ramadan|gulf|local),name,area,src,at,off}}}; 'app:hol:<date>' / 'app:<span>:<start>' ids with off:true turn a built-in off. calApply() rebuilds HOLI and LAB_SPANS from the built-ins (copied lazily: HOLI0 / SPANS0) + entries, then clears FC_MC / FC_HC / FC_BT / LAB.res, so the forecast, dayTags and the lab use them. calEffects(): each past day vs the last 4 same weekdays without a holiday / eve / after (and, for a break, outside that break); whole day + lunch / evening (psSes); strong = n≥3, one direction, ≥10%. Coming up (60 days) shows each date's own past effect, else "any holiday" labelled as such. Tomorrow's dishes header names tomorrow's calendar flags.
- v311b: hayat-traffic DEPLOYED with wrangler from cloudflare/traffic (wrangler.jsonc, cron */15) on Majid's Cloudflare account (the only other worker there is BoardReady's board-ready — not touched). No secrets set: the worker reads firebase.apiKey and traffic.tomtomKey from the public site config.js (siteKeys); env FIREBASE_API_KEY / TOMTOM_KEY still win if ever set. GET https://hayat-traffic.majidkhn.workers.dev shows settings/trf_health and only runs when the last run is >10 min old.

## v312 — type rows open filtered bills · period chart lines with Total, compare, auto events
- todayBox rows carry data-bfk (dine / counter / delivery / staff; Total = ''); a capture-phase click listener sets BF.kind before the row's data-tab opens Bills, so tapping CO shows counter bills only.
- pdCard: Lines + "Dine · CO · Delivery" also draws a bold Total line; "Compare with: nothing / previous period / same days last month" (PD.cmp) draws the same lines dashed from that period, matched by position (bars: the total only). pdEvents(from,to,days): office events + price changes from dgChanges (only the chosen dish / group when filtered) + offer runs = 2+ days in a row with 3+ discounted CO or Delivery bills and ≥ ₹300 off in the run (round-offs ignored); markers on the chart + a list under it.

## v313 — Today lab includes pre-bookings
- Majid, 25 Nov 22:57: box said ₹59.5K so far, "Today · how it ends" said ₹52K (likely 50.5–58.4K). The lab's ways work on walk-in sales (soldRecs: large orders out, like history), so a ₹9K pre-booking vanished. todayLab now adds PB = preFor(DAY).add to so far, every way's close and range, with "incl. ₹X pre-booked". The top box's "vs usual by now" says "pre-booking ₹X left out of this" when one exists.

## v314 — large orders review (period view)
- lgReview(from,to) after pmCard in the period Overview: straight from the day docs (isSale && isLarge — works although settings/large_orders is empty): orders, ₹, share of all sales, average, discounts, vs the previous period; by week / month (follows PD.u); by channel, hall, lunch / evening, weekday; top 10 dishes; every order (day link, time, where, ₹, main dishes, paid / open). Finished days only (today joins tomorrow morning). The old lgCard (marked list + unusual hours) stays in More analysis.

## v315 — Competitors (Google busyness) + phone collector
- collector/ (served from the site): the busy-board Android collector (Termux + Chromium + playwright-core) adapted to write straight to Firestore with the public web key: crowd/{placeId} latest {name,area,kind,now,usual,at,week,src}, crowd_hist/{business day} p.{placeId}.{HH} = {now,usual,at} (live readings only) + n.{placeId} names, settings/crowd_health {at,src,places,live,signedOut}. Places = settings/competitors.list (owner app) else places.mjs (63 from the extension). Cron 7 past each hour 11–23 + 0. install.sh = one-line install. The Chrome extension (~/code/busy-board, not in git; backup busy-board-backup-20261125) got the same cloud write (pushCloud, manifest v3.1 + firestore host).
- Tested 25 Nov: signed-out phone-sized Maps shows NO busy bars (so an own APK / iPhone app with a built-in browser cannot read them — Google blocks sign-in there; not to be worked around). iPhone = viewing only.
- Owner Insights → Competitors (compPage): collector health; Right now (latest hour today, by area, now vs usual, Hayat highlighted); Busiest places last 7 days with "≈ ₹ a day if they were Hayat's size" = Hayat's median (nrev ÷ its avg busyness) × their avg busyness, with Hayat's own miss shown; us vs them day by day (Hayat + up to 4); crowd signals (shops / bus stands); places on/off + add by place id → settings/competitors {list}.

## v316 — next hour after closing · dine first order vs add-ons · competitors read on demand
- Forecast box "Next hour": when the next clock hour is after closing (shophours: Mon–Fri 00:00, Sat/Sun 00:30) it says "shop closes HH:MM · the last ~₹X comes before that" instead of "~0 bills".
- todayBox: under Dine, "first orders ₹X · add-ons ₹Y (z%) · n of m tables ordered more" — add-on = items whose kotAt is >3 min after the bill's first KOT, scaled to the bill's money; tap = dine bills.
- Competitors ON DEMAND (Majid: look up when I open the page, not in the background): compPage writes settings/crowd_req {at,by} when the last read is >50 min old (at most every 10 min); the collector cron is now */2 11–23,0 running `bb-run --if-asked` (scrape.mjs exits unless crowd_req is <15 min old, newer than the last read, and the last read is >50 min old). The page shows "⏳ asked the phone…" and reloads its data when settings/crowd_health changes.

## v317 — competitor reader setup guide in the app
- compGuide(H,hasData) at the top of Insights → Competitors until the phone gives live readings: 5 steps (F-Droid apps with links · paste the install line with a Copy button · sign in via Termux:X11 + bb-login · test with bb-run · battery Unrestricted). Steps tick from settings/crowd_health (phone seen, not signed out, live > 0); the guide disappears once live data exists.

## v318 — today's bills load first · rest of today by channel · rain in the lab
- Boot: watchDay() (today's vm_daylog listener) starts right after sign-in, BEFORE days() and the settings listeners; until the first snapshot (DOCWAIT) the page says "Loading today's sales…" instead of drawing dayStart() (that screen showed outlook / yesterday / week numbers as if no bill existed). After days() rebuilds INDEX: syncIndexToday() + render().
- chFc() on Live (today): the forecast's rest (F.rest by business hour) split per hour by the last 4 same weekdays' Dine / CO / Delivery mix (chMix from dgDay bs; hour < ₹1,500 → session mix), lunch < 16:00. Next 60 min by channel, bills = ₹ ÷ channel avg bill in the session. chBack(): last 28 finished days, fcModel(d).plan × prior-4-weekday shares vs dgDay b — first run 25 Nov: day ±21%, split alone lunch Dine ±19% / CO ±52% / Delivery ±76%, evening Dine ±19% / CO ±38% / Delivery ±37%.
- Lab signal 'wx' = log(1 + rain mm 11:00–00:00) via wxFeat (past days = what fell, so a best case). LAB_GROUPS 'wx'; cache key has WX.at; kept out of the per-day effect list. First result: no clear effect (86 days) — so the forecast does not use it.

## v319 — pre-bookings out of history for real · tappable weekday lines · Traffic page · Dish analysis · Sabarimala season
- applyLarge(): settings/large_orders.b is empty in production, so history kept every pre-booking (7 Oct Wednesday ₹1.2L = ₹58K pre-booking at 23:00). Now every OHS[d].lg bill over PRE (₹4,000) is cut from its order hour and counted in x.big, unless the office marked that bill either way (LARGE entry for day|billKey). Changes nrev / hours / forecast history everywhere (intended rule since v208).
- ptLines (Patterns, "Every <weekday>, hour by hour"): invisible wide hit-paths (.pthit data-pth) on every line, <title> on hover; the picked line gets a dot + "7 Oct · ₹10.6K at 19" at its busiest hour and a note with "open that day →".
- Insights → Traffic (TAB 'traffic', trfPage): health line, route-delay vs sales link (trfEffect), and the two history views drawn IN the page — trfHist(host) / flowSheet(host) now draw into a host element when given one (pop-up otherwise); trfHist caches the 3 months for 10 min (TRH.D).
- Insights → Dish analysis (TAB 'dish', dishPage/daDetail/daWire; DA in localStorage hayat-da): every dish over 7/14/28/56 finished days vs the same number before; All day/Lunch/Evening × All/Dine/CO/Delivery; sort ₹/plates/rising/falling/A–Z; group select; search filters rows in place. Columns: plates a day (vs before), ₹ a day (share), ₹ per plate + price billed (mode last 3 days, ₹A→₹B when it moved), per 100 bills (same session+channel), lunch share, channel mix bar. Tap = day-by-day stacked plates by channel + ₹-per-plate line, lunch/evening × channel table, price changes (dgChanges, .hall).
- LAB_SPANS.vrat Sabarimala season (approx. 17 Nov – 14 Jan, 2025-26 and 2026-27): dayTags flag + label, LAB_FEATS/LAB_GROUPS/LAB_FN, CAL_KINDS 'vrat'. Only one season in history so far — the lab can judge it next year.
- Weekend check (OHS, pre-bookings out): Sat+Sun ran 1.14–1.57× Mon–Thu from late Aug to mid Nov; 21–22 Nov fell to 0.89× (weekday ₹58.5K, weekend ₹52.4K) — AC hall tables lunch 14–18 vs 22–34 and evening 16–17 vs 20–41, parcel evening ₹5–11K vs ₹15–22K. Weekdays steady. Timing matches the start of the Sabarimala season.

## v320 — today first for real · version shown · pre-bookings = bulk over ₹5K · next customer · coming up · hero
- Load order: go() runs watchDay() and AWAITS WD_FIRST (today's first snapshot, max 6 s) before every other listener and days(); yesterday's doc (~1 MB) also waits. Sizes that used to compete on a phone: ohours ~1.8 MB, weather 0.7 MB, vm_meta/days 0.5 MB, trf month 0.5 MB, yesterday 0.9 MB (REST JSON) vs today ~10 KB at noon. After 10 s still waiting → DOCSLOW note + "↻ Try again". Version: "app vNNN" on the loading card and "App vNNN" in More (BOARD).
- Pre-bookings: PRE = 5000 and isLarge = office decision (LARGE) → LG_SEED (18 historical bulk bills 13 Jul–25 Nov found from the day logs) → else over ₹5,000 AND bulkLike (a main dish ×8+; LG_NOTMAIN excludes breads, rice, drinks, tea…). Data (136 days): 50 bills > ₹4K = 25 bulk parcel/catering (e.g. a repeat 12× Alfaham Mandi Full + 3× rice ₹9,100 at ~12:30) + big family tables (customers). ohOf lg now [hour, amt, bulk]; applyLarge auto-cut needs LG_SEED or g[2]===1; psSes same. Period Overview (lgPeriod — renamed: v314's lgReview had silently replaced the old per-hour lgReview(d,h)) lists every bill > ₹5,000 with the app's call and Customer / Pre-booking buttons (lgSetId → settings/large_orders.b, clears dgDay cache + lab).
- nextCust() on Live (after the last-order card): per-minute arrival rate by channel from the last 6 same weekdays (dgDay bs, ±10 min smoothing) × today's pace at half weight; Poisson → likely wait (median), P within 5/10/15 min, most likely channel, usual amount range + dishes (±45 min). ncBack(): replay every 10 min on the last 14 finished days. First run (stub, 952 checks): wait within ±5 min 63%, "within 10 min" said 71% / happened 68%, channel right 57%, amount scored as inside P25–P75.
- comingUp() on Live: next 14 days from calList (holidays, festivals, school / exam / Gulf breaks, Sabarimala, Ramadan) + office events + month turn, each with its measured past effect (calEffects). Calendar adds New Year's Eve / New Year, Kerala Christmas exams 8–18 Dec, school break from 19 Dec.
- Hero (todayBox): "Customer sales today · <date> · updated hh:mm", big number, verdict pill under it. Labels: Items → Dishes (tabs), Top items → Top dishes, By category → Dishes by group, What is different → What changed, More on this day → More breakdowns.
- Deleted (Majid OK): owner-1.html, fakemaps.html, apply_dock_patch.py, WHY-INDEX-IS-BIG.txt.
- Cause analysis 26 Nov (day logs, pre-bookings out, each day vs its last 4 same weekdays): Onam week +43% (big family tables +106%); 2 weeks after the Gulf/Onam break +16% (lunch +44%); price change week 1 −12% (evening −18%, big tables −32%), weeks 2–3 −5% (CO −28%); 17–25 Nov (Sabarimala from 17 Nov + parcel offers from ~20 Nov) −17% (CO −39%, evening −22%, lunch −14%; big family tables +24%). Bills a day 125–139 (Sep–mid Oct) → 102 (week of 16 Nov) → 94; avg bill ₹486 → ₹570–606 after the price change → ₹538–548.

## v321 — What moved sales (Insights, first item) · analysis pages work before the first bill
- mvPage (TAB 'drivers', MV in localStorage hayat-mv {w weeks 12/16/20, m 'v'|'n', off:{id}}; Gulf break off by default — it overlaps the lower early months). Lines: 7-day averages per channel (dgDay b keys Ldine/Edine/Lcounter/Ecounter/Ldelivery/Edelivery), lunch solid / evening dashed, + "Bills with a discount" (dc.Tall), numbered dated markers (mvkey). Story table: normal days only (no 29th–4th, festival, HOLI), weekday-scaled (median per weekday ÷ mean of medians), periods cut at 23 Sep (Houthi attacks on Saudi start), 11 Oct (Navaratri), 22 Oct (after festival, old prices), 25 Oct (new prices), 12 Nov (war escalates), 17 Nov (Sabarimala + offers). Effects table: OLS per cell (mvOls, Gauss-Jordan, ±1.96 se, bold = clear) of ₹ or bills a day on weekday dummies + events (festival windows, fish menu + boards step 20 Aug, salary days, rain per 10 mm via wxAt, price step 25 Oct, war step 12 Nov, Sabarimala+offers step 17 Nov, office EVENTS: launch/board/reel/offer = steps, others = one day). ₹ big, % of the average day + range small.
- render0: NODOC_OK (patterns, drivers, dish, traffic, trend, cal, comp, price, growth, dgrp) render even when today has no day log yet (morning); footer no longer reads DOC.updatedAt when DOC is null (it threw and froze the page).
- Analysis 26 Nov for Majid / owner (day logs, pre-bookings out, normal days, weekday-scaled): bills a day 117 (23 Sep–10 Oct, war already on) → 109 after the festival at OLD prices (−7%, only 3 days) → 106 new prices (−2%) → 109 war escalation (+3%) → 98 Sabarimala + offers (−10%). CO evening bills 27 → 29 → 20 at new prices (−29%), CO lunch 13 → 9 → 8; dine bills flat. Repriced dishes per 100 bills +1% vs unchanged −4% (people who came still chose them); the loss is fewer walk-in parcel customers. ₹ a day flat (₹64.3K → ₹64.1K): +~12% price × −~10% bills. After-8 PM share 38–50% (Jul–Aug) → 33–38% (Sep–Oct) → 29% (week of 16 Nov). Weekend premium dips only in 3 weeks (31 Aug, 19 Oct, 16 Nov), otherwise 1.2–1.5×. Discounted bills a day 6.5 (Sep) → 10 (Oct–Nov) → 14.6 (17–25 Nov).
- Menu since 25 Oct: Alfaham Mandi Qtr 205 / Half 390 / Full 780 (Full = exactly 2 Halves, no reason to size up); Chicken 190/370/700; King fish mandi 800/1600/3200 (linear). 36% of main-dish bills have any drink; top drink is ₹20 water; fresh lime ₹35.

## v322 — top cards first · next customer detail · competitors read on the phone (userscript)
- Boot in 3 stages: (1) today's vm_daylog (WD_FIRST); (2) what the top cards need — vm_meta/floor, health, fc_pick, fc_mods, shophours, large_orders, ohours (OHFIRST, max 8 s), vm_prebook today/tomorrow, days() — then ESS=true; (3) everything else (kitchen, recipes, traffic, Instagram, labBg, costing, crowd/competitors, calendar, events, weather). dgLoad() waits for ESS, so past-day loads (next customer, channel forecast, dishes…) never compete with the top cards.
- nextCust: "▾ Next 3 customers · next 5 / 10 / 15 min" (NC_OPEN, localStorage hayat-ncopen). ncAt returns seq (k-th arrival ≈ when expected arrivals reach k − 1/3: time, most likely channel + its share at that minute, top dish family and median ₹ of that channel ±45 min) and win {5,10,15: n, per-channel n, ₹}.
- Competitors on the phone: collector/hayat-busy.user.js (userscript: iPhone Safari + free "Userscripts" app; Android Firefox + Tampermonkey; laptop Tampermonkey). On the owner page it marks documentElement.dataset.hayatBusy and stores the tapped place (data-busy-pid/name/area) via GM.setValue; on www.google.com/maps or /search it reads aria-labels "Currently N% busy, usually M% busy" (+ "N% busy at H pm" bars, + a "Live … usually" text fallback) for up to 30 s and PATCHes crowd/{pid} (src 'phone-js') and crowd_hist/{biz day} p.`pid`.`HH` (same shape as the Android collector); green/amber box on the Google page. compPhone() card at the top of Insights → Competitors: Hayat + up to 9 chosen places (hayat-cmp10), links = official Maps URL (search/?api=1&query=…&query_place_id=…; the old ?q=place_id: form showed "No results" on phones), setup steps until installed. Place list: settings/competitors.list, else collector/places.mjs read as text (no module import). Hayat's place id ChIJ6e-dHwDLpzsRJqS5O3bgSV8 is in Makkaraparamba.
- Saudi–Calicut flights: 22 Calicut–Gulf flights cancelled 16 Oct, Air India Saudi suspension to 14 Nov, IndiGo to 21/30 Nov, flynas partly resumed. Bills: late-night (22:00+) ₹8.5K a day before → ₹8.0K 16–21 Oct (flights cut) → ₹7.3K 22 Oct–14 Nov → ₹4.7K 15–25 Nov (flights back, Sabarimala). No step at the flight dates.

## v323 — heat map with recent vs usual · Ask Gemini · story notes in the app · competitors via Google Search
- Patterns "Busiest hours of the week": header says what a cell is (₹ thousands sold in that hour, bills made, pre-bookings out). Each cell: big = average of the last 2 same weekdays (ptDays is NEWEST FIRST → slice(0,2)), small = usual (chosen weeks), ▲▼ when 15%+ apart. PT.hm 'fc' = this week: days gone = actual INDEX hours, today and later = fcModel(d).prof × f (dotted).
- Ask Gemini (Insights, TAB 'ai', aiPage / aiData / aiAsk / aiWire): data pack (~9 KB, no names/phones) = last 56 finished days (sales, bills, avg bill, dine/CO/delivery × lunch/evening ₹/bills, discounted bills, rain mm, day tags), events (mvEvents), coming 3 weeks (calList), top 40 dishes (28 vs 28 days, price billed), today + next 7 forecast. Default prompt AI_PROMPT0, editable + "Save for everyone" → settings/gemini {prompt}; answers kept per device (hayat-ai, last 5); half-typed text kept across live redraws (AIQ.q / AIQ.p).
- Worker cloudflare/traffic (hayat-traffic, deployed 26 Nov): POST /ai {prompt, data} → Gemini (env.GEMINI_KEY secret; GEMINI_MODEL default gemini-flash-latest, fallback gemini-flash-lite-latest; 503/429 retry; origins personal-majid.github.io + localhost:8125). Until Majid runs `npx wrangler secret put GEMINI_KEY` in cloudflare/traffic it answers 503 "not set up". His scheduler project already uses a Gemini key from aistudio.google.com/apikey (same pattern) — never write the key for him.
- What moved sales page ends with storyNotes(): the 26 Nov write-up (idea tests, smaller shifts, menu proposal) as dated static notes.
- Competitors: the Termux/Android guide (compGuide) is no longer shown (Majid prefers the Safari userscript). Phone links = Google SEARCH for "name area Malappuram" (phones show Popular times + Live in Search's business panel). Userscript 1.1 refuses to save when the page text does not contain the place's first long word.

## v324 — Top dishes: plates, ₹ each, channel split
- itemsOf() now keeps ch {dine|counter|delivery: [plates, ₹]} per dish (r.kind after prep; anything not dine/delivery = counter). topItems: legend shows plates; each row = name + "Dine n · CO n · Deliv n" (channel colours --k-dine/--k-counter/--k-delivery), plates + ₹ each (money ÷ plates, before bill discounts), bar stacked by channel money (.tpst); rows without ch (e.g. Others) keep the plain bar. Phones (≤640px): the bar gets its own full-width line under the dish (grid areas), names wrap.
- Gemini: hayat-traffic has NO secrets; Majid's GEMINI_KEY lives on the scheduler's "maps-link" worker on ANOTHER Cloudflare account (wrangler here cannot see it). Secrets cannot be read back, so he must run `npx wrangler secret put GEMINI_KEY` in cloudflare/traffic once.
- Version shown: More menu "App vNNN", every page footer "board vNNN", the loading card.

## v325 — by-now chips · heat map averages · next-customer live score · spends check · version in the top bar
- todayBox (live): under the verdict pill, chips "by now" = last same weekday, avg of last 4 same weekdays (usualByNow), yesterday — byNowDay(d) sums INDEX hours (OHS h fallback) to this minute, pre-bookings out. 26 Nov 13:50 check: ₹17.9K / 27 bills vs last Thu ₹12.5K, 4-Thu avg ₹11.7K, yesterday ₹10.2K — more bills + delivery ₹2.6K, no big bill.
- Patterns heat map: header + hour rows + Day row get an "Avg" column (mean over the 7 weekdays of big / small); the Day row shows big (last 2 same weekdays' day totals, or this week actual/expected) and small (usual).
- ncTrack(): a next-customer guess is kept every 5 min (localStorage hayat-nclog, today only, max 150) and scored when the next new bill is made (wait within ±5 min, channel, amount in range); shown on the card ("Today, live: …").
- spMissData/spMissCard: from INDEX (rev, paidOut) — days with sales and ₹0 spends, very low (<30% of the median spend day), "looks like 2 days" (after a zero day, >1.6× median), no sales; message for the cashier (Copy / wa.me with text only). On day Spends (month of the viewed day), period Spends, and as a "Needs attention" line on Live (+ alertList). Nov 2026: 15, 16, 18, 20, 22 had ₹0 spends.
- Version: small pill #verTag next to "⌂ Apps" (BOARD), as well as More and page footers.
- Hour chart: on hover-capable screens the "now ₹X / unpaid" labels fade while a bar is hovered (the hover pop-up sat under them).

## v326 — Why higher / lower · live forecast reacts more to today
- Top box verdict is a button ("Why? ›") → whySheet(): the shown day by this minute (live) or whole day vs the last 4 same weekdays at the same point (dgDay bs, customer bills, pre-bookings out): channel ₹/bills, more customers vs bigger bills (bills × usual avg + bills × Δavg = the total change), big bills (₹2,000+), discounted bills, lunch/evening; context: dayTags, rain mm/chance (wxAt), last 7 vs 7 before, "only lunch is in" before 11:00 business minute 660. Loads missing day docs once (dgLoad).
- fcLive pace weight: C = 1 + (r − 1) × min(1, FC_PACE0 + share × FC_PACE), was 0 + share × 0.25. Replay (window.__FC hook, 50 finished days 7 Oct – 25 Nov, each day's own fcModel, cuts 1/3/5/7/9 pm, frac 0): day-close miss 15.3/13.6/11.9/10.8/7.0% → 12.9/12.8/11.0/10.6/6.4% with FC_PACE 0.5, FC_PACE0 0.2 (plateau 0.5–0.75 / 0.15–0.2; caps 0.6–1.6 unchanged; wider caps no gain). Bias still +5–7% high (recent weeks below the 4-week level).
- Next-customer model NOT re-tuned yet (live scoring from v325 collects today's evidence first).

## v327 — traffic pages load under live redraws · chart takeaways · Days like today · Next 60 min
- trfHist/flowSheet (host mode): ONE shared download (TRH.p / FLW.p, parallel getDocs) and the draw goes into the page's CURRENT card (document.getElementById(host.id)) — before, every live redraw (snapshots, ~1/min) replaced the card and restarted a 3 × 0.5 MB download, so on a phone the Traffic page could stay "Loading…" forever; flowSheet also showed "no readings" while a load was busy.
- takeHour()/takeRun() (takeData: dgDay bs by order hour vs INDEX hours of tmDow(DAY,4)): one line on Sales by hour ("Last hour (1 pm) ₹10.1K vs usual ₹9.4K (+7%) · best hour so far … · rest of this + next hour ~₹X"; past day: best hour, quietest 2 hours, lunch vs evening) and Running total ("₹17.9K by now vs usual ₹12.8K (+40%) · heading to ~₹63K vs a usual Thu ₹59K"; past day: close vs usual + the hour with the biggest gap/gain). First 15 min of an hour = the last full hour.
- likeCard(): compact Days like today (simDays, specials out, top 3 + close days' finishing range) on Sales after the running total and on Live after Next customer; "all similar days ›" opens Insights → Similar days.
- Top box forecast "Next 60 min · h:mm–h:mm" = F.rest[nowH] + F.rest[nowH+1] × frac (same hours the chart draws). It was F.next = the NEXT CLOCK HOUR, which jumped at every hour change (26 Nov: ~₹11K for 2 pm at 1:5x → ~₹5K for 3 pm after 2:00).

## v328 — Bills table without inner scrollbars
- bills(): .billscroll (max-height none — the page scrolls, no box-in-box vertical scroll) + .billtbl (width 100%, 13px, nowrap cells except Items .its (200–340px, wraps), KOTs .kts and Edits .eds (wrap, 150px)); under 1500px the Edits column is hidden (open the bill for edits). At 1440px the table fits (was 1886px in a 1361px box with a 415px-tall inner scroll).

## v329 — traffic 12 pm–11 pm · steadier live pace · Gemini key name
- Traffic history (trfHist): TRH.span 'noon' (default, clock hours 12–23, Majid: "12 to 11 pm") | 'all'. Coverage: 10 Oct – 24 Nov only while the app was open (1–8 readings per day 12–23, some days none); every 15 min from the hayat-traffic cron since the night of 25 Nov. Data lives in Hayat's Firestore (settings/trf_YYYY-MM, traffic_flow/{day}), written by the hayat-traffic Worker — NOT BoardReady (it only shares the Cloudflare account).
- fcLive: today's pace (rDay) from COMPLETE hours only, plus the current hour once it is half gone (expC/actC) — the replay was tuned on whole hours; the hour in progress swung the forecast with every table. Total still includes the partial hour.
- Pull-forward check (Majid: "2–3 pm moved to 1–2 pm"): history 110+ days, adjacent hours' deviations vs the last 4 same weekdays — mostly POSITIVE links (an extra ₹1,000 at 1 pm comes with +₹87 at 2 pm; 12→1 pm +₹212, 9→10 pm +₹254), only 5→6 pm negative (−₹238). No general "busy hour steals the next" effect, so it is not built into the forecast; the complete-hours pace keeps a one-hour burst from swinging it.
- Next-customer "Next 3 customers" toggle = full-width rounded button (.nctog).
- Gemini: BoardReady's worker holds GEMINI_API_KEY (secret names: GEMINI_API_KEY, YT_KEY); hayat-traffic has no secrets. The worker now reads env.GEMINI_KEY || env.GEMINI_API_KEY; Majid must add the key to hayat-traffic once (secrets cannot be copied between workers).

## v330 — bill sheet: did we see this customer coming?
- ncCheck(r) in drill(): for a customer bill of the shown day (not large, not the day's first), ncAt(DAY, previous new bill's business minute, bills so far, closeMin) = the model exactly as the live card had it when the previous customer arrived; table Model said / Really / ✓✗ for wait (±5 min), channel (+ the share the model gave the real one), amount (inside P25–P75), dish (top families near that minute vs the bill's families via sizeOf). Needs the 6 past same weekdays loaded (Live does that); otherwise a note says so. Not shown for period/range bill sheets.

## v331 — redesign, phase 1 (approved mock): Today/Live and Sales order + new cards
- Live: top box (forecast row back on Live — the approved mock has "Tonight"; v293's removal undone) → Needs you (alerts(), renamed; feedRows(): NO FEED when FLOOR is missing — "not 0 tables busy"; STALE when the day log is >10 min old during open hours) → New orders → Next customer → Coming up → Tables → Last order → moreG('live','More live details', …) holding Unpaid, Outlook (today/tomorrow), Days like today, Rest of today by channel, Tomorrow's dishes, Kitchens, Road traffic. moreG folds stay open unless folded (v298), so nothing is hidden by default.
- Sales: noticeCard() "What to notice" (lunch / evening vs usual — live: by this minute, current hour scaled by the minutes gone; busiest hour; weakest / strongest finished hour vs usual) → Sales by hour → Running total → Days like today → dayMatrix() "Lunch and evening" (dgDay b: Dine / CO / Delivery × lunch / evening ₹ + bills, one-line takeaway) → Bills per hour → Top dishes → More breakdowns.
- Next phases: Spends, Dishes, Insights hub and the period views in the same style.

## v332 — spends missing in VMENU, added from a photo
- Spends check (spMissCard) rows with no spends get "＋ from photo" → stock.html?day=YYYY-MM-DD&vm=1. stock.html reads it once (then cleans the URL): a fresh draft for that day, supplier "Daily spends", DRAFT.vm=true, amber banner ("This is a normal bill" turns it off); save() writes stock_buys {…, vmMissing:true}. Draft is saved at once.
- Owner: spxLoad(from,to) reads stock_buys for the checked days (getDocs where day between, cached 2 min) → SPX.by[day] {vm (vmMissing total), all, lines}. Row kinds: inapp = VMENU ₹0 but a photo bill exists ("In the app, not in VMENU", items listed), none = nothing anywhere, nowvm = VMENU now has the day and a photo existed (green). "Not in VMENU" count includes inapp; the cashier message lists each photo day's items with ₹.
- Never touches vm_* (VMENU stays the shop PC's); the app only shows what to enter.
- Stub test (scratchpad stub-auth getDocs → /__stub/coll__stock_buys.json) passes for the owner side; stock.html could not be run in the local stub (its live listeners need the real store) — checked by syntax only.

## v333 — "compare with" switch · tap Bills / Avg bill / Next 60 min
- weekdayAvg(day) now follows CMPSEL (localStorage hayat-cmpsel, default 'wd4'): wd4 last 4 same weekdays · w2 last 14 finished days · lastwd last same weekday · wom same weekday in the same week of month (PT_WK, last 3) · sim2 top 2 similar days (simDays, specials out) · wd every same weekday (old behaviour, weekdayAvg0). Returns {H, n, label, days}. Used by Sales by hour (the "avg" line; its checkbox label = the choice), Running total (usual line + key "… by now") and the hour sheet. Select "compare with" sits in the Sales-by-hour checkbox row.
- fcxSheet(kind) from the top box forecast row (buttons .fcx data-fcx bills|avg|next): today by this minute vs avg of the last 4 same weekdays, last same weekday, yesterday (dgDay bs between minutes) — bills by channel (+ expected bills by close vs a usual day), avg bill by channel (+ last 7 days), next 60 min forecast vs what really came in the same 60 minutes on those days (+ next customer guess). Uses whyData().

## v334 — last order / last bill paid open the bill · bill above, prediction below
- Live lastGap(): "🚶 Last order received" and "🧾 Last bill paid" carry data-drill → drill(key).
- drill(): order is header → bill timeline (KOTs, edits, bill printed, paid) → ncCheck (next-customer prediction) → large-order switch. Keep the bill above any prediction.
- ncCheck: when the 6 past same weekdays are not loaded it loads them (dgLoad) and reopens the same bill, instead of asking to visit Live.

## v335 — handoff gaps: demand ahead · running total by channel · measured closing range · forecast track record · dish pace · data tags
- dq(k): small tag measured / forecast / estimate / not recorded (top box, new cards, Rest of today by channel, Tomorrow's dishes, Guests note).
- chRestH(F): F.rest per hour split Dine / CO / Delivery by chMix(last 4 same weekdays); chClose(F) = per-channel close.
- demandAhead() (Live, after New orders): last 60 min measured vs next 30 / 60 / 120 min forecast by channel (₹ + bills via the session's channel avg bill) + pre-bookings timed in the next 2 hours.
- chRun() (Sales, after Running total): cumulative per channel, solid real / dashed forecast / dotted usual (last 4 same weekdays), 10-min steps; table so far / usual by now / by closing / usual day; Lunch and Evening close vs usual.
- vm_forecast (what the app said every hour on the office login since 8 Oct; fcRecord now also saves act and ch = channel closes) → FCREC / fcRecLoad (getDocs, 30 min) → fcAcc(). fcRange(F): likely close = act + rest × 10th/90th percentile of (real rest ÷ said rest) on past days at this business hour (±1 h when <10), ≥8 records; coverage checked leave-one-out. Shown under By closing on the top box and as "How sure is this?" + "Forecast track record" in the forecast sheet; fcAccCard on top of Insights → Forecast lab. Next hour scored as ₹ off ÷ ₹ sold (mean of % blew up on quiet hours). Rows after midnight hidden.
- First real read (26 Nov, 48 days): morning plan ±18% and 13% too high; from 11:00 on ±7–17%, even; real close inside the range 69–78% (aim 80%).
- dishPace() (Live): top 10 food families (drinks out), plates today by now vs usual by now and "heading to" = today + usual after now × (forecast rest ÷ usual rest, 0.6–1.6).
- Data in the DB (26 Nov): route trip times 10 Oct – 24 Nov only while the app was open (5–27 readings a day), every 15 min from the night of 25 Nov (hayat-traffic cron); road speed traffic_flow from 25 Nov. Busyness crowd_hist / crowd: EMPTY — the phone userscript has not saved a reading yet.

## v336 — forecast re-tuned: self-correction from its own last 10 days
- Track record (v335) showed the morning plan 13% too high over 48 real days. Replay with the current code (each day only from days before it, 27 Sep – 25 Nov): plan ±18.0%, +10.9% high. Cause: Oct growth counted twice (4-weekday level already had it, growth factor at its +15% cap); Nov the level lagged the decline (+11%).
- fcModel = fcModelC(raw): plan × k, k = median of nrev ÷ RAW plan over the last 10 finished days (holiday days out, capped 0.8–1.25, needs 6). Raw plans cached in FC_RC (cleared with FC_MC), so no recursion. FC_SELF {n:10,lo:.8,hi:1.25}; M.self / M.selfN / M.raw; shown in the forecast sheet as "own misses, last n days ±x%".
- Tested 7/10/14/21/28 days × median/mean/geo × weight .75/1 × holidays in/out, picked on 27 Sep – 26 Oct: unseen 27 Oct – 25 Nov ±19.6% → ±12.6%, bias +15.5% → +0.2%; 14/21 days close behind.
- Live pace re-checked on the new plan: FC_PACE 0.35, FC_PACE0 0.1 (0.25 same). 50 days, 1/3/5/7/9 pm: old 12.9/12.8/11.0/10.6/6.4% (bias +5–6%) → 11.8/10.6/10.0/9.7/6.1% (bias −1.5…+2%). Morning plan 18.8% → 13.9%.
- window.__FC.self({lo,hi}) switches the correction for replays (lo=hi=1 = off).

## v337 — locked morning and 5 PM forecasts (Forecast check strip)
- Majid: the forecast moves with sales; the morning forecast and the 5 PM forecast must be protected so he can see what was said, the revised one and where the day ended.
- vm_forecast/{day}.m0 {t, h[24] business hours, ts, v} and .p17 {t, so, ts, src live|rebuilt, v}: written by fcLock() only when the field is missing (getDoc first, FCL state). m0 = fcModel(day) (only finished days, same at any hour). p17 = fcAt(day, 5 PM) (bills made before 5 PM only), so a phone opened later still writes the 5 PM view (src rebuilt). Any role writes (rules open).
- fcCheck() under the top box on Live and Sales: 🔒 Morning said · 🔒 At 5 PM said · Now says (fcToday neutral, moves) / Really ended (nrev) with % vs now / real. Walk-in money, pre-bookings out. Old days fall back to plan / at[12].
- Forecast track record "Last 10 days" adds Morning 🔒 and At 5 pm 🔒 columns.
- Full replay (every day in the DB, 121 of 135 replayable from 28 Jul): v336 still better at every cut — plan 18.3 → 17.0%, 1/3/5/7/9 pm 14.7/13.8/12.5/10.8/6.7 → 14.3/13.0/12.2/10.6/6.6%. Replay on ALL days from now on (Majid).

## v338 — Forecast diary · hourly saves from any phone with reasons · evening-before lock · "came early" tested and rejected
- fcRecord: any signed-in phone (was office only); the first save of an hour is kept (checks FCL.doc.at[h]). Each at[h] now has why {base, trend, self, selfN, pay, cal, hol, pace (rDay), share, cnt (how much pace counts), pick, mods, modl, pb, rest[24], v}.
- p17 also keeps h (rest by hour at 5 PM). fcLockTomorrow(): after 5 PM writes vm_forecast/{tomorrow}.e0 (the forecast the evening before, without today) once.
- fcDiary(day) (📒 Forecast diary on the Forecast check strip and in the forecast sheet; ‹ day before / next day ›): Evening before / Morning / 5 PM 🔒 vs now or real; "Morning → now" explanation (expected vs came in by now, how much pace counts, self-correction); every saved hour with Δ and fcWhyText (₹ came in since the last entry vs what it expected for those hours, pace, self-correction, nudges, pre-bookings, method); tap = that entry's rest by hour vs real; Hour by hour table (evening before / morning / 5 PM / real). Old entries (before v338) show "came in since" from INDEX hours. Entries after closing hidden.
- FC_SHIFT (early / late day: shift the usual hour shape −60..+60 min to match today's complete hours) TESTED on all 135 days, cuts 12–21 h: worse at almost every hour (2 pm 13.3% → 17.5%; 2-hours-ahead worse too). A strong early hour means more customers, not the same customers early (same as the 26 Nov adjacent-hours check). Kept OFF (FC_SHIFT=0); window.__FC.shift(on,steps,penalty) to re-test.

## v339 — bill check never blank · Bills box by channel · delivery rider plan · pattern study
- ncCheck always says something: staff / cancelled / pre-booking / no order time / still loading / fewer than 3 past weekdays / error text (was '' — Majid's KOT 62 sheet showed nothing; his phone was also still on a pre-v334 copy). ncRate caches only when every past day it used is loaded (a half-empty model stuck for the session).
- Top box Bills: Dine / CO / Del now → ~by closing (now + chRestH rest ÷ the channel's avg bill in that session).
- riderCard() (Live, after Demand ahead): delivery orders per 30-min slot to closing from ncRate (last 6 same weekdays) × today's delivery pace (half weight, 0.5–1.6); "riders to keep free" = 80% Poisson quantile of riders out at once (orders per minute × trip minutes, TRIP 20/30/45/60, localStorage hayat-trip); tomorrow folded below. Replay 14 days: ±0.8 orders an hour vs 0.9 average — weak; it shows the busy slots, not exact counts.
- Pattern study on all 135 days (each day vs the same weekday 1–3 weeks around it): 1st–4th +15.5% (strong; evening +13%, CO +27%), 22nd–28th −10.5% (strong, weekdays −9%, weekends −14%) — the 4th same weekday of the month is the weakest; holidays +15% (weak, n 8), Onam school break +21% (evening +25%); rain: no effect even 15+ mm (n 9); streak link +0.21 (a good day follows a good day a little); Friday lunch −3% (none). Weekend premium dips in Chingam (1.14) and Thulam (1.13) vs Karkidakam / Kanni (1.34); Sunday lunch ÷ weekday lunch 1.74 in Karkidakam vs 1.22–1.27 after — fits weddings taking Sunday lunches from Chingam on (few weeks: weak). The engine's month turn uses 29th–4th and a mid-month 8–21 dip; the data says the dip is 22nd–28th, not mid-month.

## v340 — month dip moved to the 22nd–28th
- FC_MONTH {t0:29,t1:4,d0:22,d1:28,dw:0.5} (was dip 8th–21st). window.__FC.month(o) to re-test.
- Replay on all 121 days: morning 16.99 → 16.62% (unseen Oct–Nov 14.03 → 13.54%), 1 pm 14.33 → 14.22%; 3–9 pm +0.1–0.15 pt (noise). Overshoot on 22nd–28th days 6.7% → 3.7%, salary days 1st–4th +0.2% → −0.5%. Full weight, 21st–28th, turn = 1st–4th only, no dip: all worse or equal. Self-correction 7 / 14 days with the new dip: worse (10 kept). Small gain because the 10-day self-correction already absorbs most of the month swing.

## v341 — what is in today's forecast · Coming up 4 weeks · wedding / football nudges
- fcApplies(day,F): chips on the Forecast check strip (today) and in the forecast sheet ("What made the rest of the day"): usual weekday level, growth, own misses (self-correction), salary days / 4th week (≈0 shown as "in own misses"), holiday, eve of a holiday (not used — eves swing −23…+48%), Sabarimala / school break / Gulf / Ramadan spans ("in own misses": not separate factors), Sunday wedding note, nudges, pre-bookings, today's pace and how much it counts.
- comingUp(): 4 weeks (was 14 days) + Salary days (29th–4th, usually +15%) and 4th week (22nd–28th, usually −10%) windows.
- MODS += 💍 Wedding Sunday −10, ⚽ Big football match −8 (fc_mods; the nudge history learns their real size).
- Tested and rejected (all 121 days): picking the best live method per hour from the previous 28 days, inverse-error blend of the top 3, and the average of 8 methods (day pace 0.15/0.35/0.6/1.0, plan only, recent, block, mix) — all within ±0.3 pt of the current method at 1/3/5/7/9 pm. The methods share one history, so they miss together; the rest of the error is the day itself (weddings, matches, events) → outside signals (ChatGPT part 05).
- Sunday lunch ÷ Mon–Thu lunch: ~1.0× or below on 6, 13, 20 Sep, 4 Oct, 15 and 22 Nov (1.2–1.56× otherwise). Fits wedding Sundays (cooks); not proven.
- WhatsApp trends image: Claude outputs/hayat-trends-26nov.jpg (main checkout, git-ignored).

## v342 — update bar · "Was this hour forecast?" on bills · next customer as a range, next 3 in rush hour
- verCheck(): every 5 min + on coming back, fetch sw.js (no-store), read hayat-vNNN; newer than BOARD → #verBar "🔄 New version vNNN ready · tap to update" (verReload: SW update + reload); back after 10+ min away with a newer version → reloads by itself (not while typing). Reason: Majid's installed phone app stayed open for days on a pre-v334 copy, so the bill check never appeared.
- billHourFc(r) under ncCheck in drill(): the forecast for the hour the bill was made (locked morning m0.h when saved, else fcModel prof×f), whole shop + this bill's channel (chMix share) vs bills made in that hour, share %, and the bill's share of the hour.
- nextCust: headline "Next customer expected in a–b min" (25th–75th percentile of the wait, ncAt q25/q75); 5/10/15-min bars and "next 5 min" removed; "Next 30 min: ~N"; rush = ≥2.5 expected in 30 min → Next 3 customers shown open with a Get ready line (🍽/🛍/🛵 counts, "keep a rider free" when a delivery is in it, cook: main dishes). NC_SIDE: breads, drinks, extras left out of dish guesses.

## v343 — Alfaham chicken prep (Live)
- Majid: the kitchen half-cooks alfaham chicken and puts it back in the freezer at night — control it with the forecast.
- birdsOf(d) from dgDay ic: Full 1 / Half ½ / Qtr ¼ bird; PREP_ALF (alfaham, alfham, peri peri, honey, dynamic, afghani, kanthari, pepper; PREP_NOT beef/fish/mutton/prawn), Chicken mandi (steamed, PREP_CM) apart; lunch / evening from dgDay L/E (16:00).
- prepFor(day,q): percentile q of the last 6 same weekdays × (fcModel plan ÷ their average sales, 0.8–1.25). Card: Morning batch (lunch), Afternoon batch (evening × today's lunch pace half weight − morning batch left, once recorded), likely left at closing, tomorrow morning (take out tonight), chicken mandi line. PREPQ 0.5 / 0.7 / 0.9 (localStorage hayat-prepq).
- Kitchen record prep/{day} {am, pm, back, by, at}: cooked vs sold (bills) → should be left vs recorded back (gap > 1 bird in red).
- prepBack(q) last 28 days: test data (14 days) Lean 71% enough / 2.1 left / 1.0 short; Normal 79% / 2.8 / 0.7; Safe 86% / 4.4 / 0.3 birds a day at lunch.

## v344 — chicken prep on the kitchen screen
- owner.html prepCard → prepPublish(): prep/{day}.plan {am, pm, night, lunchDone, soldL, soldE, uL, uE, cm{L,E}, q, tmr{day,am,pm}, at, v} — only when a number changes, at most every 10 min (30 min refresh). The plan updates only while some owner app is open (no server job).
- kds.html: #pbar under the header (like the late-cleaning bar): Morning / Afternoon birds (+ "done n" when recorded), take out tonight for tomorrow, likely left; "plan is n h old" after 3 h. Tap → #pdlg: plan details + Morning half-cooked / Afternoon half-cooked / Back to the freezer tonight → setDoc prep/{bizDate} merge {am, pm, back, at, by (signed-in name)}. onSnapshot prep/{bizDate}, re-subscribes after 05:00 (subPrep every 60 s).
- Hour-by-hour method switching: tested twice — Oct 2026 (won on tuning days, lost on unseen days) and 26 Nov on all days (best-per-hour pick / top-3 blend / average of 8 methods all within ±0.3 pt). Not used; the Forecast Lab's fcPick switches only when a method beats the app's own by ≥1 pt.

## v345 — replay deep-dive: self-correction skips special days, growth at a quarter
- Replay of every day (121 of 135, 28 Jul – 25 Nov), v335 forecast vs now. Found: (1) the v336 self-correction copied Onam (+40–70%) into early September (self at the 1.25 ceiling, 1–4 Sep ~30% too high; September ±16.7 → ±19.6%); (2) growth sat at its +15% cap for 58 days (those days leaned +4.5%); (3) Saturdays worst (±22%, +9% high).
- FC_SELF.skip=1: fcSpecial(d) = holidays ±1 day, school / Ramadan breaks (−1 … +3 days) left out of the self-correction sample. FC_TREND {w:0.25, cap:0.15}: growth at a quarter (0 and 0.5 tied; self-correction now carries level changes). window.__FC.trend(o).
- All days, old (v335) → new (v345): morning ±18.3% (lean +4.8) → ±15.9% (−0.6), within 10%: 35% → 39% of days; 1 pm 14.7 → 13.8; 5 pm 12.5 → 11.5 (within 10%: 47 → 50%); 7 pm 10.8 → 10.0. October ±20.9 → ±12.8% (within 10%: 19 → 52% of days), November ±15.7 → ±12.6%. 55 days better, 54 worse, 12 same (by >1 pt) — the gains are big on the bad days (29 Oct: 34 pts).
- Still open: salary days 1st–4th lean −10% (the 4th-week lows feed the correction), Saturdays ±20.8% (+4.8%), August ±20.8% (Onam and the first weeks of data). Tested and rejected: correction from mid-month days only (FC_SELF.mid, worse: morning 17.0%, 1st–4th ±17.5%); 14/21-day windows; full-weight dip.
- Biggest misses left: 5 Sep Sat (real ₹42.4K, said ₹64.2K), 21 Nov Sat (₹47.2K vs ₹71.4K), 24 Aug Mon (₹66.5K vs ₹38.9K, Onam eve), 27–28 Aug Onam (−38%).

## v346 — part-of-month correction · tomorrow / week-ahead accuracy
- fcModel → fcModelS(fcModelC(raw)): FC_SEG {wd:0, mp:0.5, n:6}: plan × (1 + (k−1)×0.5), k = median(real ÷ self-corrected forecast) on the last 6 non-special days in the same part of the month (salary 29th–4th / 4th week 22nd–28th; mid-month untouched), total 0.85–1.2; FC_SC cache; window.__FC.seg(o). Shown in fcApplies.
- Replay all days: morning 15.93 → 15.49% (lean −0.6 → 0.0); salary days ±15.9% lean −7.2 → ±14.7% / −2.5; 4th week ±16.9 → ±16.1%; 1 pm 13.8 → 13.4, 3–5 pm +0.2 pt. Weekday correction REJECTED (wd 0.5: morning 16.8%, Saturdays 22.0%) — Saturdays have no steady bias.
- Horizon replay (hide the days not yet finished; 107 days from 11 Aug): morning of the day ±15.4% (lean 0.0, within 10% on 42% of days); evening before ±15.6%; 3 days ahead ±15.8%; 7 days ahead ±17.7% (36%). Week totals made Sunday evening: ±6.9% over 14 weeks (lean −2.6%), worst Onam week −23%.
- Holidays, evening before: Independence Day +43%, Milad-un-Nabi +36%, Onam 3rd −38% (default holiday sizes, one year of data); Gandhi Jayanti / Vijayadashami / Kerala Piravi / Deepavali within ±8%. Not in the morning number: Sabarimala, school breaks, office events (only via self-correction or manual nudges).

## v347 — ChatGPT review r1 checked · verified code fixes
- ChatGPT review hayat-review-r1 (Claude outputs/CHATGPT, git-ignored): 225 rows, check.py PASS on all 6 parts. Forecast verdict matches ours (no method blend beats the current model at every hour; keep self-correction; ranges ~79% coverage). Its baseline was v338 (it did not see v340–v346).
- Verified and fixed: fcOnce(day,fn) = runTransaction that only ADDS missing fields — m0 / p17 locks, tomorrow e0 and hourly at[h] (first phone wins; local state updated only after success; hourly retried after 2 min on failure) [P06-003..007, 019]. owner-ux.js today()/d0 used toISOString (UTC: the day flipped at 10:30 IST) → local date ymdL [P06-001]. dgLoad loads 4 days at a time (was one by one) [P06-012]. sw.js install adds files one by one (allSettled) so one missing file cannot block an update [P06-017]. Bills search caches one lowercase text per bill (WeakMap BILLTXT) [P06-010].
- Not done yet (from the review, verified as reasonable): replay work off the main thread (P06-008/009/023), IndexedDB day cache never re-checked against later VMENU corrections (P06-024), dgDay cache invalidation (P06-022).

## v348 — holidays by shape · miss attribution
- Miss attribution (all 121 replay days, morning): Onam school break ±24.7% (15% low), eve of a holiday ±21.7%, weekday holiday ±21.5% (9% low), day after ±18.8% (12% low), holiday on a weekend ±18.2% (7.5% HIGH — Independence Day on a Saturday +39%), plain days ±14.1%. 38 of 121 days missed by ≥20%; 10 of them plain days (no known cause).
- Calendar: + Mahanavami 2026-10-19 (Dasara long weekend Sat–Tue; 19 Oct was −25%), + Sree Narayana Guru Jayanti 2026-08-28.
- fcHolKind(day) / FC_HOL {on:1, wSingle:.3, wBridge:.6, wSeason:.9, wkend:1, school:.2, after:.15, eve:0, clean:0}: block = consecutive days that are a holiday, Sat/Sun or school break and contain a holiday/break. Weekday holiday → level AND hour shape mixed with the last Sundays (non-special) at w: alone mid-week .3, touching a weekend .6, holiday season (block ≥4 days or school break) .9. Holiday on a weekend → no extra. School-break weekdays: ×1.2 and w .45. Day after a 3+ day block ×1.15. Only when the holiday has no past of its own (ownPast → its measured size, as before). M.hol shown in fcApplies ("counted n% like a Sunday"). window.__FC.hol(o).
- Replay: days near holidays/breaks (24) ±19.3 → ±16.5%; plain days ±14.5 → ±14.7%; all days morning ±15.5 → ±15.1%; 1/3/5/7 pm 13.4/12.3/11.7/10.1 → 12.9/11.9/11.4/9.9%. Rejected: eve lift (+0.1 worse), holidays taken out of the weekday level (clean: all 16.6%), higher / lower Sunday weights (similar, kept the middle).
- Same idea as Prophet's holiday windows (lower/upper window), plus weekend-touch and Sunday-likeness. One year of data: every weight is a judgement checked on ~24 holiday-ish days, so re-check after Christmas / New Year.

## v349 — UI fixes from the ChatGPT review (P01)
- Top box: "FORECAST · not sales yet" label over the forecast row; forecast boxes transparent with a blue dashed border and blue numbers (--fcink / --fcline, dark-mode values for data-theme dark / prefers dark) so real sales and forecast never look alike [P01-001].
- Cash & bank: tiles in a 2-column grid (.kpis.cashk, no sideways scroll; were cut off at 390 px), title on its own line, the anchor note under it, full-width "🧮 Count the drawer and bank now" / "✎ Edit the count" button (.cashbtn) [P01-004, P01-025].
- Spends check: "To do · n days" table first (no spends / very low / 2 days in one / in the app not in VMENU), the rest ("now in VMENU", "no sales") folded under "Other days to know about" [P01-003].
- staleBar(): orange bar above the top box (Live, Sales, simple Today) when today's day log is 15+ min old during open hours (after 11:00 business time, before closing) [P01-066].
- .chip / .tab min-height 36 px [P01-065].

## v350 — News & alerts (worker + Live card) · bill sheet opens at once
- cloudflare/traffic/worker.js (hayat-traffic, deployed 26 Nov with wrangler, same */15 cron): news(fs, now) at most once an hour (settings/news_health.at > 55 min). NEWS_Q = 13 free Google News RSS searches (en-IN + 2 Malayalam: Malappuram, Perinthalmanna/Makkaraparamba/Mankada/Kottakkal, hartal/bandh, collector school holiday, rain alert, NH 966 road, Kerala Blasters, sevens football, India cricket, Gulf jobs, Kerala chicken price, ഹർത്താൽ, മലപ്പുറം അവധി), "when:2d", 12 items each, last 72 h. CAT_RULES: a headline must name what matters for its kind or it is DROPPED (first dry run put "Eagle Thane Strikers" under hartal and car ads under local). news/{business day} {items:{id (FNV hash of the title):{t,l,s,p,c,q,seen}}, day} — only new ids written (1 read + 1 write). Dry run 26 Nov: 20 kept (rain alerts, Kerala Blasters vs FC Goa 29 Nov, chicken price +₹40–50/kg, school-holiday question, local).
- owner newsCard() (Live, after Coming up): news/{today, yesterday} (getDoc, 10 min), sorted 📌-first then by kind (hartal, school, rain, roads, football, cricket, Gulf, prices, local), 8 shown + "All n"; 📌 = items.id.ok (owner confirms it touches Hayat, for measuring later). Never changes the forecast by itself (ChatGPT P05 plan).
- drill(): the bill opens at once (3 ms) with "⏳ Checking the forecast…"; ncCheck + billHourFc fill in 30 ms later (they may need the replay / past days — Majid: "it did open but was very slow").

## v351 — hour shape · tables & counter view
- FC_SHP {n:6, mix:0.6, k:0.1}: hour shape = 40% last 6 same weekdays + 60% last 14 non-special days. Replay all days: hourly WAPE of the morning forecast ±40.4 → ±38.9%, next 2 h at 1/3/5/7 pm ±28.3 → ±26.5%, live 1/3/5/7 pm 12.9/11.9/11.4/9.9 → 12.8/11.4/10.8/9.4%; day total unchanged. More weeks (8/10) or more smoothing (k .2/.3) worse.
- FC_MOM (last 1–3 days' real ÷ forecast) TESTED: normal days ±14.75 → ±15.2–16.9% (worse), week totals ±6.0 → ±4.9–5.2% (better) → off for days; candidate for a week view only. window.__FC.mom / .shp.
- 🍽 in the top bar (#tblBtn) → tblView(): full-screen live tables (every hall) + counter & delivery tokens = floor(), refreshed after every render while open; tap = bill / table sheet; ✕ or Esc closes. Live order: Needs you → Tables → New orders → …

## ChatGPT research round 2 (26 Nov) — hayat-research-r2.zip
- Claude outputs/CHATGPT/1-UPLOAD/hayat-research-r2.zip (r1 moved to CHATGPT/done). Parts: 01 forecast deep-dive (normal days first, lunch vs evening, runs / holiday series, hourly + weekly closeness, situation-weights table, 27 Nov – 6 Dec lunch/evening forecast), 02 economy & behaviour (Gulf, inflation, trading down, weddings, Sabarimala, Ramadan, evening flattening), 03 every dated event 27 Nov – 31 Jan with sources + better news queries, 04 GitHub / literature algorithms + one architecture, 05 simpler menu from owner_ux usage (55 docs), 06 review of v347–v351. Inputs: context/FORECAST-v351.md, data/replay_v351.csv (every day, every layer), the export CSVs, news sample, src.
- Lunch vs evening (daily.csv, per day): lunch ₹27–32K every week; evening ₹46.9K (week of 28 Sep) → ₹40.2K (12 Oct) → ₹34.5K (26 Oct) → ₹26.8K (16 Nov): evening dine 30.3K → 16.4K, evening CO 11.3K → 4.9K. Causes overlap (price rise 25 Oct, Sabarimala 17 Nov, offers ~20 Nov, Gulf families leaving after Sep, wedding Sundays) — not separated yet (r2 part 01-B / 02-E).
- On "check": run check.py per part, verify numbers by re-running the replay with window.__FC, check every library / link, then build only what beats the current engine on all days.

## v352 — ⭐ Matters for Hayat · more district news · factors image
- Worker NEWS_Q + 9 queries: Manjeri / Tirur / Nilambur / Ponnani / Kondotty / Valanchery / Areekode, local festivals (nercha, uroos, pooram), Malappuram / Perinthalmanna traffic, LPG, fish, vegetables, rice, മലപ്പുറം, കോഴി വില. why(c,t) adds imp + a one-line why ("Chicken is our biggest cost…", hartal, school holiday, heavy-rain alert in our districts, Kerala Blasters MATCH, road trouble on our route, local event); price rows must name a real ingredient AND Kerala / India and not other cities (first run tagged "TVS bike price" as rice — \brice\b now). Deployed 26 Nov. owner newsWhy() = same rules for items saved before v352.
- newsTop() on Live right after Needs you: up to 4 important items, hartal → prices → school → road → rain → football first, each with its why; news card marks ⭐ and shows the why line.
- Factors image (no forecast): Claude outputs/hayat-factors-26nov.jpg — weekday (Sun +16, Sat +10, Thu 0, Fri −4 (lunch +6, evening −10), Tue −5, Wed −8, Mon −16; vs the week's average, holidays out), month part, holidays by shape, seasons / changes, lunch vs evening, no-effect list, not-measured list.

## v353 — school exams in the forecast · calendar dates · More numbers
- Onam term exams 13–20 Aug 2026 (SSLC 13–20, Plus One/Two 14–20; Careers360) measured on daily.csv vs the same weekdays 1–3 weeks around (break days out): −14.1% (lunch −5%, evening −15%), n 8 — explains 13 Aug (−32%) and 19 Aug (−29%) "plain-day" misses.
- LAB_SPANS.exams += 2026-08-13..20; Christmas exams 2026-12-08..17 (was ..18); school (Christmas) break 2026-12-18..27, reopen 28 Dec (Xylem; was 19 Dec – 3 Jan). FC_HOL.exam −0.1 (one season, shrunk from −14%) in fcHolKind ("School exams"); exam days are fcSpecial (out of the self-correction); fcApplies chip "School exam days −10%".
- BUG FIXED in fcModel0: f = trend × pos × (pay ≥ 1 ? max(cal, pay) : cal × pay) threw away any holiday-side DIP when pay ≥ 1 → now dips multiply (cal < 1 or pay < 1 → cal × pay), only two boosts take the bigger. Replay all days: ±15.10 → ±14.88%, exam week ±21.3 → ±18.1% (in-sample), 1–9 pm same or better.
- More numbers: Seats showed 0% because the shop PC floor plan has no chair counts → "Tables busy n%" + "chair counts not set" (seats when chairs exist); Paid out ₹0 during the day → "—, nothing entered yet today (spends usually go in at night) · yesterday ₹X".

## v354 — ChatGPT r2 checked · news collector repaired · dated fixtures
- r2 (hayat-research-ALL-RESULTS): check.py PASS on all 6 parts. Forecast verdict: keep the v351 day engine (no lunch/evening split, no method blend); keep holiday priors. Verified code findings fixed below; events re-checked on the official pages before adding.
- BUG: 10 backspace bytes (\x08) sat where `\b` was meant in cloudflare/traffic/worker.js (road / price / football rules) and 8 in owner.html (NC_SIDE \bTEA\b \bML\b, newsWhy \brice\b \bvs\b) — written through a Python heredoc. Fixed. NEVER write `\b` through a bash heredoc into Python; use a script file and chr(92)+'b'.
- News collector: Google News answers HTTP 503 to Cloudflare's servers (22 of 22 at 15:45 on 26 Nov; 13 at 14:45). After two Google refusals in a run, each search goes to Bing News RSS (bing.com/news/search?format=rss; links unwrapped from apiclick, source from News:Source). news_health now has bing (searches answered by Bing) and why (first 3 errors). Bing's RSS terms = personal, non-commercial use in an aggregator — fine for the owner's own app; do not republish.
- FIXTURES (owner.html, Coming up only, NOT in the forecast): Kerala Blasters 29 Nov – 16 Jan (keralablastersfc.in), India v Sri Lanka ODIs/T20s 13–27 Dec and v Zimbabwe 3–9 Jan (bcci.tv; 1st ODI venue may have moved to Visakhapatnam), UAE Eid Al Etihad 2–4 Dec (fahr.gov.ae), Mandala Pooja 27 Dec, Makaravilakku 14 Jan. HOLI + Mannam Jayanti 2027-01-02.
- prepPublish remembers a publish only after it saved; prepLoad retries a failed read after 2 min; kds prep dialog escapes the name; KDS undo puts the ticket back if the delete fails; verCheck never self-reloads while a dialog / sheet is open.
- tools/export_data.py: prebooking column = the app's rule (over ₹5,000 AND a main dish ×8+, or an LG_SEED bill); column renamed prebooking (was prebooking_over_4000).

## v355 — Live: last delivery · last counter
- lastGap(): after "Last order received" two more tiles — 🛵 Last delivery (kind delivery) and 🎟 Last counter (CO) (any non-dine, non-delivery customer bill), by createdAt, minutes ago ticking, time · where · ₹, tap = the bill; "—, no … order yet today" when none. Left border in the channel colour (.chd / .chc). Grid 2 × 2.

## v356 — top bar slides away on scroll
- Majid: "the top header is not fully collapsing on scroll down, I need a bigger viewport". The window scroll handler (next to #dock.hid) sets body.tophid on scroll down past 80 px, removes it on scroll up / near the top / while Find or the calendar is open. body.tophid: .top translateY(-105%), the main tab row stops being sticky (scrolls away), #fbar top 0. Bottom dock already hid. Phone 375 px: nothing fixed on screen while reading.

## v357 — wedding Sundays tested · evening drop vs price change
- FC_WED {on:0, w, mode shift|flat, seasons} + inWed(d) (Malabar wedding season 17 Aug – 8 Feb, 12 Mar – 16 Jul; off = Karkidakam + Ramadan); window.__FC.wed(o). Replay (17 Sundays Aug–Nov): off 13.8% (lean −1.2%); flat −4/−6/−10% 13.8/14.0/14.6% (lean −4/−6/−9%); shift −6% 14.5%. The 4-Sunday level already holds wedding Sundays → a weight double-counts, so OFF. Re-test at the next season start (17 Aug 2027: shift mode is made for the edge). Coming up shows "💍 Wedding season Sundays".
- Evening vs price change (daily.csv, per day, 11–24 Oct vs 25 Oct – 14 Nov): dine evening bills 35.2 → 29.3 (−17%), dine lunch 33.9 → 34.0 (0%), CO evening 26.4 → 23.2, evening avg bill ₹566 → ₹561 despite ~12% higher prices (people buy less). Supports Majid's view that the price rise hit evenings. Late Sep – mid Oct evening (₹42–47K a week) was a peak above Jul–Sep normal (₹29–34K); 15–25 Nov fell further (Sabarimala + offers).
- Cloudflare: hayat-traffic lives on the same Cloudflare account as BoardReady's board-ready (majidkhn.workers.dev) — the Google login Cloudflare marks "Last used". PowerShell blocks npx.ps1 → use cmd or `npx.cmd`.

## v358 — table card shows when the bill was printed
- floor(): a 'due' table card says "Bill printed hh:mm · n m waiting to pay" (r.dueAt) instead of a bare BILL PRINTED. VMENU's record has billPrinted / dueCount / dueAt; status 'due' = printed. Checked 26 Nov 21:53: S 3 / S 4 were open with billPrinted false in VMENU, so the card was right not to call them printed.

## v359 — Offer check (Dish analysis): pick dishes, mark offer dates, see the lines
- Majid, 26 Nov: "line diagram… give offer on chicken mandi and alfaham mandi then select a dish or dish category and see how it went through different days".
- ofCard() at the top of Insights → Dish analysis (state OF in localStorage hayat-of): up to 6 lines — dish groups (g:Name), dishes (d:NAME, search box with every dish sold), Customer bills (x:bills), Discounts given ₹ (x:disc, bill total < item sum). Plates / ₹ / Per 100 bills; All day / Lunch / Evening; All / Dine / CO / Delivery; 1 / 2 / 4 weeks around the offer; 7-day average. Offer from–to (to empty = still running), saved Offer events (settings/events kind offer) as one-tap chips. Offer days shaded, every event marked. ₹ lines get their own right scale (dashed) when mixed with plates. Tap / hover a day = its numbers + "open the day".
- Before / During / After table: Before = for each offer day the same weekday 1 and 2 weeks earlier (not inside the offer), After = up to 14 finished days after; whole-shop bills row for scale. Dish detail row has "📈 Follow this dish over dates" (ofTrack). Customer bills only, pre-bookings out (dgDay).
- Test hook window.__OWN.tab(t) / .of(). Test: scratchpad oh/t-of.mjs (17 × laptop + phone) with a fake Firebase (oh/fake.mjs: 60 generated days, planted mandi offer +80%).

## v360 — Sales trend card (Sales tab + period Overview): one series, day by day, month projected
- Majid, 27 Nov: the hand-made charts (day by day, smooth trend, weekends, large orders) should be in the app, with a choice of counter / delivery / dine / dine lunch / dine dinner / all, month view by default, and the whole month projected on the Sales view.
- stCard() / stWire() / stRange() / stShare() / stLarge(); state ST in localStorage hayat-st {s, r, from, to}. Series ST_S: all (Tall), dine (Tdine), dineL (Ldine), dineE (Edine), counter (Tcounter), delivery (Tdelivery), L (Lall), E (Eall) — dgDay b keys, customer bills, pre-bookings out. Range: this month (default; the viewed day's month, or the period's end month) / last month / 3 months / since the start / this period (period view only) / from–to.
- Drawing: a light bar per day (tap = open that day, data-day), smooth trend (Gaussian, 3 days) over finished days, Sat + Sun shaded, large orders (isLarge, same series) as dots on the trend coloured by size (₹5–8K / 8–15K / 15–30K / 30K+), HOLI holidays 🎉 and office EVENTS (icon by kind) marked, each month's average as a dashed line when more than one month shows, "today" line. Font sizes fixed (.stsvg .gt) so laptop text does not scale up.
- Projection: days from today to the range end = fcModel(d).plan × the series' share of all sales on the same weekday over the last 6 weeks (stShare); today = max(so far, that). Dashed green bars; box per month: so far, ₹ a day, "→ month ₹X (forecast)"; vs last whole month.
- Placement: first card on the day Sales tab; first card on period Overview. The old pdCard "Sales by day" moved into the period "More analysis" fold (not deleted).
- Test: scratchpad oh/t-st.mjs (19 × laptop + phone = 38; fake data now has today's log + INDEX hours so fcModel works); oh/t-of.mjs 34 still green.

## WISHLIST (Majid, 27 Nov) — parked; when he asks, remind him in short words
- WhatsApp (iPhone only — WhatsApp Web is NOT possible on his phone): "Send to Hayat" iOS Shortcut in the share sheet → app Inbox; nightly Shortcut uploads the accounts group's photos (Save to Photos: Always for that group only) → read spends / sales / cash amounts, compare with VMENU + cash tab; kitchen group = "Export chat without media" → Send to Hayat → list unanswered updates; app → WhatsApp fast send (card image + text, wa.me for people, share sheet for groups, contacts stored in the app). Staff statuses cannot be read on iPhone.
- "What to notice" as the brain: situation → what is happening → what to do → did it help (track record per action). Customer-flow alert (no new table for N min vs usual), roads busier / quieter than usual alert (traffic IS saved: route trip times every 15 min since 25 Nov, road speed since 25 Nov).
- Pushes log: ＋ Add a push (WhatsApp status / Insta reel / flex-board / offer / influencer / other) · dish or group · channel · from–to; offers: suggest exact dishes + ₹ off from the bills' discounts; push results (dish 3 days after).
- Sales trend card: prominent; average line continues over forecast days; month end → show an extra week with a "month closes" marker; month start → at least 15 days before.
- Share / save any card as an image (long-press or a small ⤴ in the card corner, no floating icon) + whole-screen share.
- Sales by hour: thin cut line between bills inside each bar (must not clash with yesterday / 4-weekday / forecast lines); open hours only; channel colours; compare chips.
- Running total: All / Dine / Counter / Delivery switch; 🔥 markers on hours a dish pushed (tap = its bills).
- Bills per hour: compare chips (yesterday, last same weekday, 4 same weekdays, similar days) + channel switch.
- Trending: vs usual AND the last 30 min; low-volume dishes trending today included (tap = what is happening); dishes that trend on a weekday / time get a highlight.
- Spends: "15 Nov missing, probably entered on 16 Nov" pairing; same amount twice on one day.
- End-of-day summary card to share; alert when a channel slows for an hour.
- Pop-ups: big ✕ that stays on screen, double-tap closes, phone Back closes the pop-up (not the page).

## v361 — Today box step 1: open vs late payments · speeding up / slowing · bills done/open · 🧾 new orders · table times · top bar
- Majid, 27 Nov feedback (conservative: change in place, remove only what he called redundant).
- todayBox: the three "by now" boxes (last same weekday / avg of last 4 / yesterday) are gone — Why covers them; the ▼% · Why › pill stays.
- Late payments: counter / delivery bills open more than LATE = 20 min (staff food, late delivery cash) are not "open now": row Unpaid shows only recent ones; Total row "+ late ₹X · n"; hero "paid ₹… · open ₹… · late payments ₹… · n" (paid = total − open − late).
- tbMomentum(R): per channel, last 60 min and today by now vs the same business minutes on the last 4 same weekdays (tmDow + dgDay bs, bills made, pre-bookings out). Row under each channel: "last 60 min ₹X vs usual ₹Y" + ▲ speeding up (≥1.25×) / ▼ slowing (≤0.75×) / ● steady / ● quiet hour (usual < ₹300) + "±n% vs usual by now". Loads past days once (dgLoad).
- Bills forecast box: "Dine 19 (2 open) → ~30".
- Top bar: 🧾 #ordBtn (badge = customer bills made in the last 15 min, ordBadge() after each render) opens newOrders() full screen (TBLV='ord'); 🍽 tables view gets "⏱ Table time ~n min · counter ~n min" (median order→paid of today's paid bills; counter under ₹100 left out = staff). Phone top bar: every button 36 px high, centred.
- Tests: oh/t-st 38, oh/t-of 34 green; oh/top.mjs screenshots phone / laptop.
- NEXT (step 1 rest): Trending card (vs usual + last 30 min, low-volume dishes, tap = detail), large bill notices up top. Then busyness collector (crowd_hist still empty).

## v362 — Live no longer creeps down (Firefox / Safari)
- Majid, 27 Nov (Firefox, laptop): "when I go to Live the app is scrolling down down down". Cause: every render rebuilt the Live grid with "Last order" (lgcard) at the end, then OwnerUX.after() moved it to the top (CSS order) — ~400 px shift per redraw, ~48 redraws while today's data loads. Chrome's scroll anchoring hid it; Firefox gives up anchoring after ~10 adjustments in a row, Safari has none.
- Fix: browser anchoring off (html,body{overflow-anchor:none}) and the app keeps the reader's place itself: anchorGet() = the first card (data-ck) whose top is inside the window, else the card partly visible at the top; render() restores it AFTER OwnerUX.after(); a ResizeObserver on #main re-pins it when a card fills in later (async loads); the scroll listener retakes the place when the reader scrolls (ignored while the app itself scrolls, ANC_SET). At the top (<40 px) nothing is pinned.
- Test scratchpad oh/t-anchor.mjs (14: block above appears / disappears, card fills in after the redraw, 5 redraws no drift, reader scrolls then redraw, top stays top; laptop + phone, real day logs).

## v363 — owner app fast again: grouped redraws, forecast kept until history changes
- Measured on real day logs (scratchpad oh/t-perf.mjs, window.__PERF = {n, ms, list, c:{card:[count, ms]}, bt}): opening Live = 197 redraws, 18 s drawing, the forecast backtest run 8 times (0.9–2.3 s spikes); settled ~85 ms a redraw. Now: 7 redraws, ~1.4 s, 1 backtest; settled 50–80 ms (Live and Sales).
- render() groups non-user calls (snapshots, loads): drawn at most every 0.4 s (1.2 s until ESS and 15 s after open). A trusted click / input / key / popstate redraws at once (window.event). renderNow() = draw now (used by __OWNUX.render and the trailing timer). Code that reads the DOM right after render() must be inside a user handler or call renderNow().
- fcSig() = fingerprint of what the forecast learns from (finished days' hours / rev / big, shop hours, holidays, spans, bizToday). fcBacktest() keeps FC_KEEP and every saved plan (FC_MC, FC_RC, FC_HC, FC_SC) while the fingerprint is the same; FC_BT=null now only asks "check again" (applyLarge, ohours, large_orders, calendar, shop hours). FC_GEN counts real rebuilds. fcModel caches EVERY day (a plan uses finished days only — checked: no DOC / live reads in fcModel0/C/S, fcHolKind).
- Chicken prep: birdsOf (finished days, WeakMap on the dgDay object), prepFor / prepBack memo by FC_GEN + days (PREPM). Next customer: ncBack (14-day replay, ~2 s) runs once in idle time after the page draws (ncBackLater), the card shows without "How right is this?" until then.
- ckHold(): a card whose text says Loading / ⏳ / Checking keeps the height it had last time on that page (localStorage hayat-ckh, per page × phone/laptop), so cards filling in do not push the page.

## v364 — Trending · big bills · pop-ups · Sales trend ahead · bill cuts in Sales by hour
- Majid, 27 Nov: "I asked you so many things, why didn't you implement any of those?" — first batch of the 27 Nov feedback.
- trendNow() (Live, after New orders) / trendData(): plates per dish family (sizeOf fam, every size = 1) by ORDER minute, customer bills, pre-bookings out (dgDay bs) vs the last 4 same weekdays at the same business minute, and the last 30 min vs the same 30 min. 🔥 hot = last 30 min ≥ 2× usual (z ≥ 1); ▲ today = ≥ 1.4× usual by now (z ≥ 1.2, ≥ 3 plates); 🆕 rare = ≥ 2 plates when usual < 0.75; ▼ slow = usual ≥ 4 and today ≤ 0.6×. Only dishes on ≥ 2 bills (one table of 8 teas is not a trend). 5 + 3 on phones / 8 + 4 on laptops, "Show all" (TRN.all). Tap = trendSheet(fam): today vs usual by hour + today's bills with it (tap = the bill). TR_SKIP packaging. billWhere(r) = section · T<table> / Counter / Delivery (secOf lives inside bills()).
- bigBills() under the top box (Live, Sales, simple Today): today's customer bills ≥ BIGB ₹2,000, newest first, ₹ · time · minutes ago · where · open · top items; pre-bookings (isLarge) marked; total and share of sales. Tap = bill.
- Pop-ups (one module for every body>.sheetwrap and #tblv): history.pushState per open pop-up, so phone / browser Back closes the top pop-up and not the page; closing with ✕ / backdrop goes back the extra step (ignore flag). Double tap (touch, 320 ms, 30 px, not on buttons / links / inputs / charts / data-* targets) closes; mouse double-click on the title or backdrop closes. .sheet>h2 is sticky with a 44×40 ✕.
- Sales trend (stCard / stRange): "This month" = from min(1st, today − 15 days); in the last 7 days of the month the range runs 7 days into the next month; a dashed "Nov closes · ~₹6.7L" line at each month boundary; the Gaussian trend continues DASHED over the forecast days (real + forecast smoothed together); partial months in the boxes say "last n days" / "first n days" and "→ these days ₹X".
- Sales by hour: HCUT (set by hourly() right before hbars, consumed once) = each hour's paid bills [₹, channel] from rparts (add-ons in the hour they were ordered); hbars draws them as .bseg segments inside the paid bar (thin white cut line between bills; hidden when < 3 px a bill). "🎨 by channel" (OV.ch, hayat-ov) colours each segment Dine / CO / Delivery. Compare chips (data-cmpchip: 4 same days · last same day · last 2 weeks · same week of month · 2 similar days) replace the select; tapping the lit chip hides the usual line (OV.avg).
- Tests (scratchpad oh/, real day logs realdb.json): t-v364 (26: trending, sheet, Back / double tap / ✕, tables view Back, big bills), t-v364b (20: segments add up to each bar, channel colours, chips), t-anchor 14, t-st 38, t-of 34.
- Still to do from 27 Nov: Running total channel switch + 🔥 push markers (chRun already splits by channel), Bills per hour chips + channel, card image share (addShare 📤 exists — check what it shares), What to notice → actions + flow / roads alerts, Spends missing-vs-next-day pairing + same amount twice, pushes log, end-of-day card.

## v365 — cards you use most move up (once a day) · clean-up ideas
- Majid, 27 Nov: "add stats on which items I look at often… or automatic, the items I often visit should move to the top".
- owner-ux.js AUTO (localStorage hayat-autoord {on}, default on) + AGG (hayat-uxagg {day, sc:{page|card:score}, n, wide}): aggLoad() reads owner_ux of the last 14 days once a business day (re-sort: force); score = Σ (seconds on screen + 20 × taps) × 0.8^days ago; records from the same kind of screen (laptop wide / phone) when ≥ 3 days exist, else all. autoOrder(): inside each .grid only cards with score ≥ THR 120 swap places among themselves (most used first); unmeasured / new cards keep their slots; PIN (alerts, needsYou, staleBar, todayBox) never move; a page with a hand order (LAY[page].order) keeps it. Frozen for the day (a layout that moves while you read loses your place — same reason the counter grid is frozen). .uxmoved = moved by use (gold ring in Arrange). Arrange top bar: "⇅ Auto order: on/off".
- "📊 What I look at" now starts with Auto order (on/off, Re-sort now, "most used first" on the current page) and Clean-up ideas: OVERLAP pairs checked against the code (Trending ↔ Dishes so far vs usual, Demand ahead ↔ Rest of today by channel, Forecast check ↔ Outlook, Unpaid now ↔ Tables, Days like today ↔ Outlook, Running total ↔ by channel, More numbers ↔ top box, Average a day ↔ Sales trend, Pace ↔ Running total, By section ↔ Lunch and evening) with each one's use and "Hide <the less used>" (per device, LAY hide, comes back from "Hidden here"); a pair is skipped while either card has no use yet (new). "Not looked at in 14 days" for the current page. NAMES / PAGES cover the newer cards and Insights pages.
- Real use (owner_ux, 16 Oct – 27 Nov, 42 days, 11 devices, all Admin): Sales 7.7 h, Live 5.1 h, Dish groups 2.0 h, Period Sales 57 min, Dishes 55 min, Bills 31 min; most tapped: Sales by hour 533, Dishes by group 330, Tables 123, top box 122; seen but hardly tapped: Average a day (190 min, 1 tap in the last 4 days), More numbers (112 min, 8 taps), Unpaid now (23 min, 2 taps). Seconds favour cards near the top, so taps count 20×.
- Test scratchpad oh/t-v365.mjs (16: the real owner_ux records shifted to today — loads 14 days, Sales by hour first, cards moved, frozen on redraw, report shows auto order + clean-up, Hide works, off = app order).

## v366 — Dish groups shortcut on Sales
- dgMini() "🍽 Dish groups today" on Sales after Running total (auto order moves it by use): each dish group (dgFam of the bs family) so far vs the last 4 same weekdays by the same business minute (past day: whole day), bar = today, dashed line = usual, ₹ + plates, ±% (shown when usual ≥ ₹200, coloured at ±15%); 6 rows on phone / 9 on laptop, "Other" left out. Any row or "all dish groups ›" (data-dgopen) opens Insights → Dish groups at the top. Reason: Majid spent ~2 h on that page (owner_ux), deep in Insights.
- Test scratchpad oh/t-v366.mjs (12).

## v367 — Live and Sales shorter: each number once (Majid OK'd the plan, 28 Nov)
- Plan page (before / after map): https://claude.ai/artifact/6FKUs6UEhJhHNMwV7u68oj. Phone height with every fold open: Live 12,000 → 8,000 px (above "More live details" 5,600), Sales 11,800 → 10,300 px (above "More breakdowns" 6,300).
- Top box: the per-channel "speeding up / slowing" rows fold shut (TBMO, localStorage hayat-tbmo; "▾ speeding up or slowing? (last 60 min)" row in the table, capture click handler).
- kpis(part): top = staleBar + todayBox + (Live) Needs you (alerts) + bigBills + forecast settings line; kpis('more') = Average a day + More numbers, now only inside Sales → More breakdowns. Live has no More numbers / Average a day.
- Live: Needs you → Big bills → Tables → New orders (lastGap tiles inside it, .lgin) → Trending → Next customer → Demand ahead → Chicken prep → Riders → Coming up → News; More live details = Forecast check + Outlook (today / tomorrow, how it will end) + Tomorrow's dishes + Kitchens + Road traffic. Off Live (shown elsewhere): Ordered · not paid yet (top box + Tables + 🍽), Days like today (Sales), Rest of today by channel (Demand ahead), Dishes so far vs usual (Trending).
- Sales: Sales by hour → Sales trend → Running total (rtSwitch: chips All / Dine · CO · Delivery — the second shows chRun in the same slot; RTV, hayat-rtv) → Dish groups today → What to notice → Lunch and evening → Bills per hour → Top dishes (TOPN default 10) → Forecast check → Days like today; More breakdowns = Average a day, More numbers, By section, By payment, By waiter, bill times, waiters, upselling, tables, voids, discounts. Removed: Pace (= running total in words), By type (= top box rows). pace() still exists, unused.
- owner-ux OVERLAP now only fcCheck ↔ outlook and breakdown ↔ dayMatrix (the rest were merged here). Auto order (v365) still re-ranks used cards inside each grid once a day.
- Pop-ups: double tap window 320 → 450 ms (a relaxed double tap was missed; test saw 417 ms between taps).
- Tests scratchpad oh/: t-v367 (50: Live / Sales order, gone cards, folds, speed rows toggle, running-total switch), t-v366 12, t-v365 16, t-v364 26, t-v364b 20, t-anchor 14, t-st 38, t-of 34.

## v368 — lighter Sales-by-hour in channel tints · trending by hour · card pictures · classic layout · safer swipes
- Majid, 28 Nov: "sales hours lighter so the markers are visible", "slightly different colours for dine, delivery and co", horizontal scrollers turned the page when swiped, "many things I am missing — give a link to the classic screen", trending showed only the last hour, "no share / copy / save image of graphs".
- Sales by hour: today's paid bars = --s1 mixed 42% with the card colour (current hour 62%); channel tints ON by default (OV.ch default true; .bseg opacity .42); "usual" marker 2.5px dashed ink, yesterday marker darker, both z-index 4 above the bars. takeHour drops the empty "()" when the % is unknown.
- swipeTab: a swipe never turns the page when it starts inside anything that scrolls sideways (hscroll walk) or chip rows / big bills / trending / dish groups / tables / charts / inputs; it must be ≥ 120 px, < 600 ms, sideways ≥ 2.5 × up/down.
- CLASSIC (localStorage hayat-classic): the pre-v367 Live / Sales layout, every card where it was (fcCheck + Average a day + More numbers in the top part, Unpaid / Days like today / Rest by channel / Dishes vs usual on Live, Pace + By type + by-channel chart on Sales). Switch: More → "◧ Classic layout" / "✦ New layout" and layoutFoot() at the bottom of Live and Sales (data-classic).
- Trending: TRN.sel 'now' (today: so far + last 30 min) / 'day' (today so far, or the whole day on a past day) / business hour number → that hour vs the same hour on the last 4 same weekdays; chip row .trsel (Now · Today so far · each hour with bills); 🔥 only in 'now'. Works on past days too (default 'day').
- Card pictures: 🖼 (.cardpic, inside every card's h2 before 📤) → assets/html-to-image.js (html-to-image 1.11.11, MIT, bundled, in sw CORE, loaded on first use) toBlob at 2× with the page background, skipFonts, buttons left out → phones (hover:none + canShare files): the share sheet (WhatsApp, Photos); else a preview (.picwrap) with ⬇ Save picture (download), 📋 Copy (ClipboardItem), ↗ Share, ✕.
- Pop-ups: a dblclick within 1.5 s of a touch also closes (the phone's own double-tap), not only the 450 ms touch timer.
- Tests scratchpad oh/: t-v368 (34: lighter bars, picture made + preview, trending chips by hour, swipes on chip rows / big bills / short swipes ignored and a long plain swipe still works, classic switch both ways), t-v364b now expects channel tints by default (22), t-v367 50, t-v366 12, t-v365 16, t-v364 26, t-anchor 14, t-st 38, t-of 34.
