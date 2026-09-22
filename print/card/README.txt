HAYAT — PRINTED A4 MENU CARD
============================

TO CHANGE A PRICE OR A DISH
    1. open  menu-prices.txt  in Notepad
    2. change the number, save
    3. run   python3 build.py
Both PDFs are rewritten. Nothing else to touch — the layout,
the Malayalam, the QR codes and the photos all reflow themselves.

FILES
    menu-prices.txt   every dish and price. This is the only file
                      you normally edit.
    build.py          makes the PDFs. Needs python3 + Chromium.
    card-images/      drop your own photos here to replace the
                      four medallions (see the README inside).
    assets/           logo, QR codes, built-in photos.

WHAT COMES OUT
    hayat-menu-bleed.pdf   303 x 216 mm, 3 mm bleed + crop marks.
                           GIVE THIS ONE TO THE PRINTER.
    hayat-menu-trim.pdf    297 x 210 mm exact A4. For WhatsApp,
                           email, and checking on screen.

THE QR CODES  (redrawn from these URLs every build — edit build.py
               if a link ever changes)
    Online Menu    https://personal-majid.github.io/hayat-menu/
    Order Online   https://wa.me/919844326842
    Rate Us        https://personal-majid.github.io/hayat-menu/#/review

PRINTING
    A4 landscape, double sided, 300 gsm matte or silk.
    Ask for the bleed file and say "trim to 297 x 210".
