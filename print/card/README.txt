HAYAT — PRINTED A4 MENU CARD
============================
A4 landscape, one sheet, printed both sides.

CHANGE A PRICE
    open menu-prices.txt, edit, save, then:  python3 build.py

OUTPUT
    hayat-menu-bleed.pdf   303 x 216 mm, 3 mm bleed + crop marks -> printer
    hayat-menu-trim.pdf    297 x 210 mm exact A4 -> WhatsApp, screen

THE FOUR QR CODES  (all decode-tested from the 400 dpi print file)
  FRONT
    left    Order Now      https://wa.me/919844326842        19.5 mm
    centre  Save our number  vCard 3.0, all three numbers    19.5 mm
    right   Follow us      https://instagram.com/hayat_fish_n_mandi  19.5 mm
  BACK
    left    Order Online   https://personal-majid.github.io/hayat-menu/  23 mm

  URLs live at the top of build.py. Change one, rerun, the QR is redrawn.

  TWO THINGS THAT WILL BREAK SCANNING IF YOU CHANGE THEM
    1. border=3 in qr_svg. That is the quiet zone. Without it nothing scans.
    2. The contact code is the biggest on the card and uses LOW error
       correction on purpose. A vCard is a long payload; medium correction
       pushes it past what 24 mm can carry and phones then mis-read it.
       If you add a field to the vCard, grow the code as well.
       Rule of thumb: keep every code above 0.40 mm per module.
         mm per module = printed width / number of modules

WHY A vCARD AND NOT MECARD
    MECARD is compact but many phones only show the text instead of offering
    to save it. vCard 3.0 with an N: line is what iOS Camera and Android both
    parse into a contact card.

PHOTOS (assets/)
    cut-mandi     the platter, under the MANDI list
    cut-alfaham   rotated 48.5 deg to sit level; the scuffed grey tray is
                  remapped to a clean dark board so the chicken carries it
    cut-fish      the fish fry, beside FROM THE SEA
    cut-broast    inside the BROAST panel
    cut-mojito    inside the MOJITO panel
  Each is flattened onto the exact page colour it sits on. Boxed sections use
  the panel colour (246,238,223), everything else the page cream
  (251,246,236). Use the wrong one and a faint rectangle shows in print.

LAYOUT
    FRONT - what people come for
       left    FROM THE SEA (panel) - Mangalapuram Special - Meals -
               Mandi Rice - BROAST (panel)
       centre  MANDI: King Fish Mandi highlighted, chicken, then beef as the
               price anchor, then Alfaham, then Shawaya
       right   ALFAHAM - STARTERS (panel)
    BACK - the reference side
       Beef / Chilly & Manchurian / Shawaya / Shawarma / Salads
       Curries / Breads / Soup / Fried Rice & Noodles
       MOJITO (panel) / Juice / Shake / Falooda / Hot & Cold

PRINTING
    A4 landscape, double sided, 300 gsm matte or silk.
    Give them the bleed file, say "trim to 297 x 210".

NOTE ON THE vCARD LINE ENDINGS
    The contact code uses LF line breaks, not CRLF. That is deliberate: it
    drops the code from 51 to 47 modules, which is what lets all three front
    codes share one 19.5 mm size and still clear 0.40 mm per module. Phones
    parse LF vCards fine. Switch back to CRLF and the code must grow again.
