# Hayat menu — working rules for this repo

## Pushing
Majid has authorised automatic pushing **for this repository only**.
When a change passes its tests, commit and push it, then say what went
out. Do not wait to be asked. His general "ask before pushing" rule
still applies to every other project.

If the push is refused with *"not in this session's authorized
repository set"*, the repo has not been attached as a source for that
session. Say so plainly and hand over SHIP.bat rather than pretending
the change is live.

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
- `shop.js` holds cart, orders, riders, and the three consoles.

## Traps that have already cost time
- `index.html` declares `let L` for the language code. That shadows
  `window.L` for every later script, so Leaflet must be reached as
  `window.L`. A bare `L.map` is a string.
- The cart button is `display:flex`, so `[hidden]` does nothing to it
  without an explicit `#cartfab[hidden]{display:none}`.
- Python heredocs: a literal `·` in shop.js will not match `·`
  written in the patch. Match the real character, or edit by line.

## Still open
- Firestore rules are wide open (test mode). Customer phone numbers and
  addresses are readable by anyone who finds the project id.
- The office passcode is `1234`, in plain JavaScript.
- `config.js` instagram handle is still the placeholder.
