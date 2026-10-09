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
