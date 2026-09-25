HAYAT CROWD — how busy is everyone right now
============================================

Google shows "Popular times" bars on every restaurant, and a live
figure when it has one. This reads those for our shop and the ones
around us, and says who is busier or quieter than a normal day at
this hour, and by how much. It runs in your own browser, signed in
as you, on the shop's connection - which is exactly why Google
answers it like a person.

ON THE DESKTOP (Chrome or Edge) - automatic, every 30 minutes
--------------------------------------------------------------
  1. chrome://extensions  ->  turn on "Developer mode" (top right)
  2. "Load unpacked"  ->  choose this folder:  hayat-menu\crowd-ext
  3. Pin "Hayat Crowd" from the puzzle-piece icon.
  4. Click it  ->  "Read now". Tabs open and close on their own,
     one place every ~6 seconds. Leave the browser open at the shop
     and it repeats every 30 minutes.
  Settings: the robot word, how often, and the list of places
  (key | name | place_id). Place ids come from a Maps link:
  "share" a place -> the long link has  ...place_id:ChIJ...

ON A PHONE (Safari, Chrome) - one tap per place
-----------------------------------------------
  Open  https://personal-majid.github.io/hayat-menu/crowd-ext/phone.html
  and follow the four steps. (Phone browsers cannot run extensions;
  a bookmark that runs the same reader is the honest equivalent.
  Android: the Kiwi browser CAN load this folder as an extension.)

WHERE IT GOES
-------------
  Firestore  crowd/{key}  with now / usual / margin / verdict / live
  Admin  ->  Google  ->  "Around us right now" shows the table.

WHAT THE WORDS MEAN
-------------------
  now      Google's live busyness this hour, 0-100
  usual    what a normal <today> at this hour looks like
  margin   now - usual, in points. +15 = a good deal busier.
  busier / quieter   margin of 10 points or more either way
  usually busy / usually quiet   Google had no live figure; this is
                                 just what the hour normally is

WHAT CAN GO WRONG
-----------------
  "no popular times on this page"  Google shows none for small
      places, or the tab did not finish drawing. Try again.
  "Firestore refused"  the robot word does not match the rules.
  Google asks "are you a robot"  you are reading too often. 30
      minutes and a 6 second gap is polite; 5 minutes is not.
  Google changes the page  the reader keys off the words on the
      bars ("45% busy at 7 PM"), which have been the same for years.
