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
- **KOT chips**, one per kitchen the items reach, from the existing
  `kotStation()` main/front split. Preselected from `autoKot()`.
  Nothing prints that is not lit. `printJob(o, kind, auto, only)`
  takes the station list.
- All of it writes to the same `orders` collection the website uses,
  marked `source:"counter"` with `mode` and `token`. There is no
  second database: the KDS, the print agent, the riders and the day
  ledger all read `orders`.

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
