HAYAT VMENU SYNC  -  runs on the shop PC
=========================================

WHAT IT DOES
------------
Every 2 minutes, on the PC where VMENU runs:

  VMENU database  --read only-->  this service  -->  cache.db on this PC
                                                  -->  Firebase (h-menu)

  - new and changed bills, with items, table, section, waiter, times
  - orders open right now (tables still eating)
  - staff names from VMENU, each marked Waiter or Service agent
  - one small summary per day (for reports that cost almost no reads)

It never writes to VMENU. The VMENU login it uses can only read.

It also serves a page on this PC, "Hayat Live":
  http://localhost:8765          on this PC
  http://<this-pc-ip>:8765       on a phone on the shop Wi-Fi

The page reads from this PC, not from Firebase, so looking at it costs
nothing. Firebase is the copy you can reach from anywhere.


FREE LIMITS (Firebase Spark)
----------------------------
  reads      50,000 a day      we use ~1,000-4,000
  writes     20,000 a day      we use ~2,500 (first history load ~7,500 once)
  storage    1 GiB             we add ~5 MB a month
Old bills can be deleted automatically: retention_months in config.ini
(0 = keep forever). Day summaries are always kept.


SET-UP  (once, about 20 minutes, in this order)
-----------------------------------------------

1. PUBLISH THE FIRESTORE RULES FIRST
   Right now the database is in test mode: anyone who knows the project id
   can read it. Bills and staff names must not go in before that is closed.
   Follow FIREBASE-SETUP.txt step 5 (in the main folder). The rules file
   already includes the vm_ collections: only the office can read them,
   and only this service can write them.

2. FIREBASE KEY (lets this PC write, and only this PC)
   console.firebase.google.com -> project h-menu -> gear icon ->
   Project settings -> Service accounts -> Generate new private key.
   Save the file into this folder as   firebase-key.json
   Never email it, never put it on GitHub (it is ignored by git already).

3. READ-ONLY VMENU LOGIN
   You need the MariaDB root password (VMENU installer / vendor knows it).
   Open setup_readonly_user.sql, replace CHANGE_ME with a new password,
   and check the database name (default `vmenu`). Run it:
       mysql -u root -p < setup_readonly_user.sql
   (or paste it into HeidiSQL, which VMENU installs).

4. INSTALL PYTHON  (skip if  python --version  already works)
   python.org -> Downloads -> Python 3.12 -> tick "Add python.exe to PATH".

5. RUN install.bat  (right-click -> Run as administrator)
   First time it opens config.ini in Notepad. Fill in:
       password = (the read-only password from step 3)
       database = (the VMENU database name)
       pin      = (a PIN for the Hayat Live page)
   Save, close, run install.bat again. It checks both connections, then
   creates the task "Hayat VMENU Sync" (every 2 minutes, even when nobody
   is logged in) and opens port 8765 for the shop Wi-Fi.

6. SEND THE HISTORY ONCE: backfill.bat -> type 2026-07-01

7. RUN discover.bat and send discover_report.txt to Claude.
   It lists the VMENU table and column names, so the item names and the
   open-orders table can be confirmed. Nothing private is in it.

8. OPEN THE PAGE, Staff tab: mark each VMENU name as Waiter / Cashier,
   and add your service agents (runners, clearers, captains) by name.


EVERY DAY
---------
Nothing. It starts with Windows and runs every 2 minutes.
The chip at the top of Hayat Live says "Synced just now" when all is well.


IF SOMETHING LOOKS WRONG
------------------------
  check.bat       tests VMENU + Firebase, changes nothing
  run_now.bat     one sync with details on screen
  logs\vmenu_sync.log   the last few thousand lines of what it did
  uninstall.bat   stops everything (data is kept)

  "Sync problem" on the page  -> hover it for the reason
  "Last sync 14 min ago"      -> PC asleep or the task stopped: run check.bat


FILES
-----
  vmenu_sync.py          the service (sync + local page)
  web/index.html         the Hayat Live page
  config.example.ini     copy to config.ini
  config.ini             your settings            (stays on this PC)
  firebase-key.json      Firebase write key       (stays on this PC)
  cache.db               local copy of everything (stays on this PC)
  test/                  tests used before shipping (not needed to run)
