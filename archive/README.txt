ARCHIVE — old orders, out of Firestore, into git
=================================================
The office keeps the last 60 days live. Anything older is meant to
live here, one file a month, so Firestore reads stop growing and the
history is still there forever (it is in git).

Admin -> Day -> the "Older than 60 days" bar lists months ready to go:

  1. Download   -> the browser saves  2026-07.json
  2. Put it in this folder:  archive/2026-07.json
  3. Add the month to index.json:   { "months": ["2026-07"] }
  4. SHIP.bat
  5. Prune      -> the office checks the site is serving that exact
                   file, shows the count, asks, then deletes those
                   orders (and only those) from Firestore.

The Day ledger opens any old day straight from these files.
