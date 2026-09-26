/* ============================================================
   HAYAT — SETTINGS
   Contact numbers, Instagram, and the gallery live here.
   ============================================================ */

window.CONFIG = {

  /* ---- 0. WHO IS HOLDING THE SCREEN ------------------------- *
     The same site serves two very different people, and it works
     out which one from the address:

       OUR TABLET      .../hayat-menu/?us
                       Instagram, WhatsApp and Google open as a QR
                       the guest scans with their own phone, so the
                       tablet never leaves the menu. Also goes full
                       screen. Once opened with ?us the tablet stays
                       in this mode for good.

       A GUEST'S PHONE .../hayat-menu/          (the QR on the table)
                       .../hayat-menu/#/review  (the review card)
                       Every link opens directly — they are already
                       signed in to Instagram and Google there.

     defaultMode only decides what an address with no marker does.
     Leave it on "guest": far more people scan than use the tablet,
     and the tablet has ?us on its home screen icon.
     ---------------------------------------------------------- */
  defaultMode: "guest",

  /* ---- 0ab. ORDERING --------------------------------------- *
     true  = every dish page gets an "add to cart" strip, and the
             cart, checkout and order tracking pages are live.
     false = the menu goes back to being a menu only.

     While testing, orders live in the browser that placed them —
     open the office at  .../#/admin  in a second tab of the SAME
     browser to watch them arrive. Passcode 1234, temporary.      */
  ordering: true,

  /* ---- 0ac. FIREBASE ---------------------------------------- *
     With this filled in, orders live in Firestore and the three
     screens (customer, office, rider) talk to each other from
     different phones. Empty it and everything falls back to this
     browser's own storage, which is fine for a demo.

     This block is public on purpose — it ships inside every
     Firebase web app and is not a password. What protects the
     data is the Firestore rules, set in the console.

     TEST MODE is open to anyone until it expires. Before real
     customer orders flow through, the rules have to be tightened
     and the staff passcode replaced with a real login.           */
  firebase: {
    apiKey: "AIzaSyA48aGGeEvg9lyVzeTX5fPIA21SrMZQPn8",
    authDomain: "h-menu.firebaseapp.com",
    projectId: "h-menu",
    storageBucket: "h-menu.firebasestorage.app",
    messagingSenderId: "1020503266242",
    appId: "1:1020503266242:web:6a6da2ed26570dd994fc5b"
  },

  /* ---- 0aa. COLOUR THEME ----------------------------------- *
     "paper"  = the cream card, ink type and gold rule of the printed menu (default)
     "garden" = the green and cream of the older flyer
     "night"  = the dark gold dining room
     Either way the guest can switch it with the leaf button in
     the header, and their choice sticks on that device.        */
  theme: "paper",

  /* ---- 0a. FULL SCREEN ------------------------------------- *
     true  = the menu goes full screen (no address bar, no tabs)
             the moment the guest first touches the tablet, and
             a small corner button lets staff toggle it.
     Browsers only allow this after a tap — that is a browser
     rule, not a setting. Installing the page as an app
     (Chrome menu -> Install app) makes it open full screen on
     its own, with no tap needed.
     --------------------------------------------------------- */
  fullscreen: true,

  /* ---- 0b. WELCOME VIDEOS (the intro that plays first) ------ *
     Full-screen marketing videos shown when the tablet is idle
     and a new guest sits down. They play automatically, one
     after the other, and loop.

     The guest swipes UP to get to the menu — nothing else
     dismisses it. Swipe LEFT / RIGHT to jump between clips.

     Add or remove clips by editing the two lists below. Drop the
     files into the  intro/  folder. Keep each clip short (10-20s)
     and under about 8 MB so it starts instantly.

     showAgainAfterMin — once a guest has swiped past it, the
     intro stays away while they browse. It comes back after this
     many minutes of the tablet sitting untouched, ready for the
     next table. Set to 0 to show it only once per browser.
     --------------------------------------------------------- */
  intro: {
    enabled: true,
    clips:   ["intro/intro-1.mp4", "intro/intro-2.mp4"],
    posters: ["intro/intro-1.jpg", "intro/intro-2.jpg"],
    showEveryLoad: true,       // play every time the page loads or is refreshed.
                               // Set to false to use showAgainAfterMin instead.
    showAgainAfterMin: 15,
    sound: true,               // start with the audio ON. If the browser blocks
                               // it, the first tap anywhere turns the sound on.
    autoAdvance: true          // move to the next clip when one ends
  },

  /* ---- 0ad. ROAD DISTANCE ----------------------------------- *
     Off by default: every order shows the straight-line distance
     from the shop, marked with a tilde, which costs nothing.

     Turn this on and each order is measured once against a real
     road network, and the answer is stored on the order.

       enabled: true

     Google's own Distance Matrix needs a billing account on the
     project, so it is not what runs here. The default below is the
     public OSRM demo server: free, no key, but it asks that heavy
     users run their own. If orders ever outgrow it, point osrm at
     your own instance and nothing else changes.
     --------------------------------------------------------- */
  routing: {
    enabled: true,
    osrm: "https://router.project-osrm.org"
  },

  /* ---- 0c. LIVE TRAFFIC ON NH966 (optional, free) -------------
     TomTom gives a developer key free of charge: 2,500 requests
     and 50,000 map tiles a day, which is far more than the office
     map uses. Leave empty and the map simply has no traffic.
       1. developer.tomtom.com  ->  Register (free)
       2. My Dashboard  ->  Apps  ->  Add app  ->  tick "Traffic API"
          and "Maps API"
       3. copy the key here.
     It is a public key restricted to this website; nothing secret. */
  /* ---- 0d. GOOGLE BUSINESS PROFILE (optional, free) --------
     Once Google approves API access (GOOGLE-BUSINESS.txt, step 2),
     make an OAuth client id (step 3) and paste it here. The admin's
     Google page then shows "Sign in with Google to manage": reviews,
     posts, performance. A client id is public; there is no secret. */
  google: {
    clientId: ""
  },

  traffic: {
    tomtomKey: "HYkJEbqymD918pvRduuffu7Q9a3ifHCl"
  },

  /* ---- 1. INSTAGRAM HANDLE (no @) -------------------------- */
  instagram: "hayat_fish_n_mandi",

  /* ---- 2. HOME DELIVERY NUMBERS ---------------------------- *
     Three lines shown on the Home Delivery panel.
     Change the labels to whatever suits — area names work well. */
  delivery: [
    { label: "Delivery Line 1", number: "+917907133238" },
    { label: "Delivery Line 2", number: "+910000000000" },   // <-- CHANGE
    { label: "Delivery Line 3", number: "+910000000000" }    // <-- CHANGE
  ],

  /* ---- 3. CATERING & LARGE ORDERS -------------------------- */
  catering: {
    headline: "Catering & Large Orders",
    blurb: "Birthday parties, college reunions, office get-togethers, friends catching up. " +
           "We organise the whole thing — the table, the platters, the timing. " +
           "Tell us the headcount and the date, that is all we need.",
    points: ["Birthday parties, cake table set up","College batch reunions and farewells",
             "Office team lunches and celebrations","Friends catching up, no occasion needed",
             "We organise it — you just turn up"],
    number: "+917907133238"                                   // <-- CHANGE if different
  },

  /* ---- 4. LOCATION & REVIEWS ------------------------------- */
  address:    "NH966, near Punarppa UP School, Makkaraparamba, Kerala 676507",
  hours:      "Open daily · 12 pm – 11 pm",
  mapsLink:   "https://www.google.com/maps/dir/?api=1&destination=11.0065785,76.1270507",

  /* ---- WHERE THE RESTAURANT IS -----------------------------
     Every map opens here, every delivery distance is measured
     from here, and the ⌂ button on a map comes back here.

     To set it exactly: open Google Maps, right-click the shop's
     front door, and click the numbers at the top of the menu
     that appears - that copies them. Paste below. */
  shop: {
    lat: 11.0065785,
    lng: 76.1270507,

    /* How far around the shop a map shows before anything else
       pulls at it. Three kilometres is most of what this kitchen
       delivers to; a rider or a customer further out stretches
       the view rather than falling off the edge of it. */
    radiusKm: 3,

    zoom: 14                /* only a fallback if a map cannot be framed */
  },

  /* ---- TAKING PAYMENT --------------------------------------
     A UPI id turns every order into a QR the customer scans
     with Google Pay, PhonePe or Paytm. It costs nothing, needs
     no gateway and no account beyond the one the shop has.

     Put the shop's UPI id below - it looks like an email
     address, e.g. "hayatmandi@okicici" or "9844326842@ybl".
     Leave it empty and the app simply stays cash-only.

     One honest limit: UPI cannot tell this website that money
     arrived. There is no callback without a paid gateway. So
     the rider or the office always confirms it by hand after
     seeing the payment on their own phone. */
  upi: { id: "", name: "Hayat Fish and Mandi" },

  /* ---- THE SHARED ADMIN CODE -------------------------------
     The way in when no crew list exists yet, or when the
     internet does not. Anyone who views the page source can
     read it, so treat it as a latch rather than a lock.

     The real login is Firestore -> crew, where each person has
     their own code and the code never reaches the browser.
     Once that exists, change this to something nobody knows
     and forget it. */
  adminCode: "112233",

  /* ---- WHEN YOU ARE OPEN -----------------------------------
     Shown on the phone landing page, so somebody arriving at
     half past eleven at night knows before they start typing.
     24-hour clock. Leave it out and nothing is claimed. */
  hours: { open: "11:00", close: "01:00" },

  reviewLink: "https://maps.google.com/?cid=6866265905315816486",

  /* ---- 4a. REVIEWS ----------------------------------------- *
     writeLink opens Google's star box straight away, with no
     hunting on the listing page. Get it once and paste it here:

       Google Business Profile  ->  "Ask for reviews"  ->  copy
       It looks like   https://g.page/r/XXXXXXXXXXXX/review

     ALREADY SET below. The address carries our Google place id
     (ChIJ6e-dHwDLpzsRJqS5O3bgSV8 = Hayat Fish and Mandi) and lands
     the guest on the five stars with the keyboard ready.

     Leave it empty and we fall back to reviewLink above, which
     opens the listing — the guest then taps "Write a review".

     topics are gentle prompts shown on the review page so a guest
     who wants to write something is not staring at a blank box.
     They are suggestions only — never put words in their mouth.  */
  review: {
    /* ---- WHO IS OFFERED GOOGLE -------------------------------- *
       true  = 4 and 5 stars are offered Google. 3 and below get our
               own form instead, which reaches WhatsApp.
       false = everybody sees both doors.

       Worth knowing: Google calls the first one review gating and it
       is against their policy. A listing caught doing it can have
       reviews removed, carry a "fake reviews removed" banner, or be
       suspended. Set this to false and that risk goes away.          */
    gate: true,

    writeLink: "https://search.google.com/local/writereview?placeid=ChIJ6e-dHwDLpzsRJqS5O3bgSV8",
    topics: ["the mandi", "the service", "the room"],

    /* ---- TAP-TO-COPY STARTERS ---------------------------------
       A guest who wants to write something is not staring at a
       blank box. They tap one, it lands on their clipboard, they
       paste it into Google and finish the sentence themselves.

       Keep them HALF FINISHED, and keep them varied. Google's
       filter removes reviews that read the same as each other,
       and a listing that collects them can be suspended. The
       guest's own ending is what makes each review survive.
       ----------------------------------------------------------- */
    starters: [
      "The mandi here is the real thing — ",
      "Came for the alfaham and ",
      "Fish fry was the best I have had in ",
      "The rice was still steaming when ",
      "Staff looked after us properly, especially ",
      "Brought the whole family and ",
      "Portions are generous for the price — ",
      "Worth the drive from "
    ]
  },

  /* ---- 4b. WHATSAPP ---------------------------------------- */
  whatsapp: "919844326842",
  whatsappText: "Hi Hayat, I would like to order",

  /* ---- 4c. CELEBRATE WITH HAYAT ----------------------------- */
  celebrate: {
    number: "919844326842",
    occasions: [
      { icon:"🎂", title:"Birthday parties",  line:"Cake table, decorated platter, the crew singing" },
      { icon:"🎓", title:"College reunions",  line:"Batch meetups and farewells, one long table" },
      { icon:"💼", title:"Office get-togethers", line:"Team lunches, targets hit, month-end treats" },
      { icon:"🤝", title:"Friends chill-outs", line:"No occasion needed. Just show up hungry" }
    ]
  },

  /* ---- 5. GALLERY ------------------------------------------ *
     PHOTOS  — drop files into the gallery/ folder, list them here.
     VIDEOS  — mp4 files in gallery/ as well. Poster is optional.
     Both play with no internet. Leave a list empty and that tab
     simply shows a short instruction instead.                   */
  gallery: {
    photos: [
      { src:"gallery/masala-shawaya.jpg", caption:"Masala Shawaya, straight off the grill" },
      // { src:"gallery/dining-hall.jpg", caption:"Our dining hall" },
    ],
    videos: [
      // { src:"gallery/alfaham-grill.mp4", poster:"gallery/alfaham-grill.jpg",
      //   caption:"Alfaham on the coals" },
    ]
  },

  /* ---- 6. INSTAGRAM POSTS ---------------------------------- *
     Shown on the home page and in the Gallery → Instagram tab.
     Open a reel or post → Share → Copy link → paste below.
     The real Instagram post renders and plays on the page. The small
     QR button in the corner of each card hands the reel to the guest's
     own phone — the tablet never leaves the menu.

     Paste as many as you want. Hundreds is fine.                     */
  trending: [
    "https://www.instagram.com/reel/DapjpUJTzuf/",
    "https://www.instagram.com/reel/Db09DWopWC3/",
    "https://www.instagram.com/reel/DZnI_k8Tfo3/"

    // Add as many as you like. Just paste the link and a comma.
    // Nothing to generate — the QR is drawn in the browser.
  ],

  /* ---- 6a. YOUTUBE — PLAYS INSIDE THE PAGE ------------------ *
     Unlike Instagram, YouTube CAN play inside our own page.
     Paste just the video id (the bit after v= or youtu.be/).

       https://www.youtube.com/watch?v=AbCdEf12345   ->  "AbCdEf12345"

     Use your own uploads, or any mandi / alfaham video you like.
     Leave the list empty and the Videos tab simply hides YouTube.     */
  youtube: [
    // { id:"PASTE_ID_HERE", title:"Opening the mandi pit" },
    // { id:"PASTE_ID_HERE", title:"Alfaham on the coals" },
  ],

  /* ---- 6b. REELS THAT PLAY BY THEMSELVES -------------------- *
     Instagram embeds cannot autoplay — that is Meta's iframe, not ours.
     For the true Instagram feel (silent autoplay as you scroll, tap to
     unmute) the video file has to live in your own folder.

     Download your own reel from the Instagram app:
       your post -> ... -> Save / Download  (works for your own posts)
     Put the mp4 into  gallery/reels/  and list it here.                */
  reels: [
    // { src:"gallery/reels/mandi-pit.mp4",  poster:"gallery/reels/mandi-pit.jpg",
    //   caption:"Opening the mandi pit",
    //   link:"https://www.instagram.com/reel/DapjpUJTzuf/" },
  ],

  /* ---- 6c. UPSELL — shown under every main course ----------- *
     Item ids from menu-data.js. These appear as a "goes well with"
     strip on every main-course section and dish page.               */
  upsell: ["fish-fry","d15","chorum-meenum","d4","d2","d14","x2","b3"],

  /* ---- 7. BRANDING ----------------------------------------- */
  tagline: "Authentic Yemeni Flavours",
  trustBadges: ["Slow Cooked","Authentic Recipes","Premium Ingredients","Made with Passion"]
};
