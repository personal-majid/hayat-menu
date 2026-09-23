HAYAT — 10% DISCOUNT COUPON
===========================
One A6 card, 105 x 148 mm, printed both sides.

CHANGE ANYTHING
    open build.py — the block at the top holds every word on the card:
        OFFER, EYEBROW, SIGNATURE, SIG_DISH
        BACK_TITLE, BACK_STRAP, DISHES, DELIVERY
        TERMS, PHONES, ADDRESS, INSTA, TAGLINE, URL_ORDER
    then run:  python3 build.py

OUTPUT
    hayat-coupon-bleed.pdf   111 x 154 mm, 3 mm bleed + crop marks -> printer
    hayat-coupon-trim.pdf    105 x 148 mm exact A6 -> WhatsApp, screen

TERMS ON THE CARD
    Valid on dine-in only.
    Not valid on MRP items.
    One coupon per bill. Not valid with other offers.
  There is no minimum bill. If you ever want one, add the line to TERMS.

THE TWO BLANKS ON THE FRONT
    VALID TILL   staff write the date when they hand the card over, so each
                 guest gets their own window. Print once, use all year.
    COUPON NO.   number them by hand or with a stamp and you can count how
                 many came back.

PHOTOS
    assets/fish-ink.png       the fish fry, cut out and faded into the dark
    assets/chicken-cream.png  the grilled chicken, faded into the cream
  Both are flattened onto the exact page colour AND feathered at the edge.
  The feather matters: a PDF tags images as sRGB but page fills as DeviceRGB,
  so a hard-edged flat background prints as a faint visible rectangle. The
  fade hides that. If you swap a photo, run it through the same treatment.

PRINTING
    A6, double sided, 300 gsm matte or silk. Give the printer the bleed file
    and say "trim to 105 x 148". Matte takes a pen for the date field.
