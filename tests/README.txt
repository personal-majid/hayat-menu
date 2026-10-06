=============================================================
 HAYAT — THE TESTS
=============================================================

Three suites. All three were green when the counter page and
the captain/waiter login went in.

  counter.test.js   the counter page: the grid stays frozen,
                    Enter adds, the steppers add up, each mode
                    demands what it should, and placing writes
                    exactly one order marked source:"counter".

  login.test.js     the staff door: who each role may open,
                    who the dropdown offers them, what a wrong
                    code does, and that a waiter cannot walk
                    into the orders board.

  rules.test.js     the security rules themselves, against the
                    Firestore emulator. THIS ONE HAS NEVER BEEN
                    RUN - the sandbox it was written in could
                    not download the emulator. Run it before
                    you trust the rules in production.


Running them
------------

  npm i -D playwright firebase firebase-tools @firebase/rules-unit-testing
  npx playwright install chromium

  node tests/counter.test.js
  node tests/login.test.js

For the rules, with firebase.json pointing firestore.rules at
the emulator on port 8085:

  npx firebase emulators:exec --only firestore \
      --project hayat-rules-test "node tests/rules.test.js"

A green run prints ALL GREEN and exits 0, so any of these can
go straight into .github/workflows.

The browser suites serve the repo folder itself on a spare
port, so they test the files as they sit on disk - not a copy.
They never touch Firebase: the store is swapped for a stub, so
nothing reaches the restaurant's database.
=============================================================
