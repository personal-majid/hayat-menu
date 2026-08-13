/* ============================================================
   HAYAT — SETTINGS
   Contact numbers, Instagram, and the gallery live here.
   ============================================================ */

window.CONFIG = {

  /* ---- 0. KIOSK MODE --------------------------------------- *
     true  = this is YOUR tablet on the dining table.
             Instagram / WhatsApp buttons show a QR code for the
             customer to scan with their own phone. Nothing ever
             navigates away from the menu.
     false = normal website. Buttons open links directly.
     --------------------------------------------------------- */
  kiosk: true,

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
    showAgainAfterMin: 15,
    autoAdvance: true          // move to the next clip when one ends
  },

  /* ---- 1. INSTAGRAM HANDLE (no @) -------------------------- */
  instagram: "zaman_yemenmandi",          // <-- CHANGE THIS

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
  reviewLink: "https://maps.google.com/?cid=6866265905315816486",

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
     The real Instagram post renders on the page (thumbnail, caption,
     view count). Tapping it opens a QR so the customer watches on
     their own phone — the tablet never leaves the menu.

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
