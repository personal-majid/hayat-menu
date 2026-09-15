THE REVIEW CARD
===============

review-card-a5.pdf   A5 (148 x 210 mm). Print it at any shop on 300gsm
                     matte or silk. No bleed needed — the gold frame sits
                     6mm inside the trim, so a millimetre of drift is fine.

The QR opens:  https://personal-majid.github.io/hayat-menu/#/review

WHAT THE GUEST SEES
-------------------
  1. One question, five stars.
  2. Whatever they tap, the same two doors:
        [ Post it on Google ]     big, first
        [ Tell us privately ]     always there
  3. A nudge to add a photo, and three things they could mention.

Nobody is filtered. That matters: screening guests by score — happy ones
to Google, unhappy ones to a private form — is against Google's review
policy and the FTC's rules. The penalty is not a warning letter: Google
strips the ratings, can put a "fake reviews removed" banner on the
listing, and can suspend the profile. The card above stays inside the
rules and still sends every happy guest to Google in one tap.

MAKE THE GOOGLE BUTTON ONE TAP FASTER
-------------------------------------
Right now it opens the listing and the guest taps "Write a review".
To land straight on the star box:

  Google Business Profile app -> "Ask for reviews" -> copy the link
  (it looks like  https://g.page/r/XXXXXXXXXXXX/review )

Paste it into config.js:

    review: { writeLink: "https://g.page/r/XXXXXXXXXXXX/review" }

REPRINTING
----------
    python3 make_card.py

Change the address, handle or wording in that file first. If you move the
site to a different URL, change URL at the top — the QR is redrawn from it
every time, so it can never point at the wrong place.
