HAYAT PRINT AGENT - kitchen tickets and bills on the shop's printers
=====================================================================

What it is
  The website runs on phones and in the cloud; it cannot reach a printer
  on the shop Wi-Fi. This small program runs on the shop PC, watches for
  tickets the office sends, and prints them: KOT MAIN, KOT FRONT, BILL.
  Everything about the printers is set from the office page, not here.

You need
  1. The shop PC (the one running the VMENU sync), always on.
  2. Two or three ESC/POS thermal printers (80 mm or 58 mm):
       - LAN printers: plugged into the shop router. Print the printer's
         self-test (hold the FEED button 3-5 s while switching on) - the
         slip shows its IP address, e.g. 192.168.1.50.
       - or a USB printer installed in Windows - use its Windows name.
  3. firebase-key.json in this folder (the same one the VMENU sync uses).

Install (once)
  1. Right-click  print-install.bat  -> Run as administrator.
  2. Open the office -> Menu -> Printing.
     - choose "Shop PC printers"
     - the page lists printers it found on the network; press "main",
       "front" or "bill" next to each - or type the IP from the self-test
     - tick which categories cook in which kitchen
  3. Press "Print a test ticket". Each kitchen gets one, the counter
     gets a bill.

Day to day
  - Accepting an order prints its KOT(s) at once (can be switched to
    "By hand" on the Printing page).
  - Any order card: KOT / Bill buttons reprint.
  - The board shows a small printer pill; it turns red if the agent or
    a printer stops answering.

If something is wrong
  print-test.bat        prints a sample to every printer; previews in print_test\
  print_agent.log       what the agent did
  print-uninstall.bat   removes the scheduled task

Firestore
  settings/print   the office's choices
  print_jobs/*     each ticket sent; the agent marks it done and deletes
                   old ones after a day. Rules for both are in
                   firestore.rules (publish once).
