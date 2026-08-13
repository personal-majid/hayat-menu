/* ============================================================
   HAYAT — MENU DATA
   Edit dishes, prices, photos and Instagram links here.

   Each item can have:
     name    "Chicken Mandi"
     sub     small line under the name
     desc    one or two sentences
     img     "photos/chicken-mandi.jpg"   <- the row icon + hero
     ig      ["https://www.instagram.com/p/XXXX/", ...]
             photos AND reels both go in this list, any order
     tags    ["hot"] ["veg"] ["star"]
     matrix  {cols:QHF, rows:[["Without Mandi",[q,h,f]], ...]}
     opts    [["4 pieces",150], ["8 pieces",250]]
     price   160                          <- single price items

   To add a photo: drop the file in the photos/ folder and set img.
   To add Instagram: open the post -> Share -> Copy link -> paste in ig.
   Items with no img show a styled placeholder. Nothing breaks.
   ============================================================ */

var QHF = ["Quarter","Half","Full"];   /* var, not const: safe to load twice */

window.MENU = [

{ id:"mandi", ic:"\u{1F357}", name:"Signature Mandi",
  tagline:"Slow cooked to perfection with our signature Yemeni spices",
  layout:"list", items:[

  { id:"overloaded-mandi", name:"Overloaded Mandi", sub:"The full table platter", anchor:true,
    tags:["star"], icon:"mandi", img:"photos/overloaded-mandi.jpg", ig:[],
    desc:"Everything at once. A mountain of mandi rice buried under beef, chicken and alfaham, "+
         "finished with roasted cashew, raisin and boiled egg. Built for a full table — "+
         "order it once and nobody at the table needs anything else.",
    matrix:{cols:QHF,rows:[["Price",[null,599,999]]]} },

  { id:"beef-mandi", name:"Beef Mandi", sub:"Our Pride", tags:["star"],
    desc:"Tender beef slow cooked to perfection with our signature Yemeni spices.",
    img:"photos/beef-mandi.jpg", icon:"mandi", ig:[],
    matrix:{cols:QHF,rows:[["Price",[230,420,780]]]} },

  { id:"chicken-mandi", name:"Chicken Mandi",
    desc:"Juicy, tender chicken marinated in Yemeni spices and slow cooked with aromatic rice.",
    img:"photos/chicken-mandi.jpg", icon:"mandi", ig:[],
    matrix:{cols:QHF,rows:[["Price",[210,380,710]]]} }
]},

{ id:"alfaham", ic:"\u{1F525}", name:"Alfaham",
  tagline:"Grilled to perfection · 8 signature marinations",
  note:"Every flavour is available on its own or served with mandi rice.",
  layout:"list", items:[

  { id:"af-regular", name:"Regular Alfaham", desc:"Traditional flavour with a perfect smoky finish.",
    img:"photos/af-regular.jpg", icon:"grill", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[130,240,450]],["With Mandi",[210,330,620]]]} },

  { id:"af-green", name:"Green Chillies Alfaham", tags:["hot"],
    desc:"Fresh green chillies, herbs and bold notes.",
    img:"photos/af-green.jpg", icon:"grill", tint:"#7FA83C", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[140,250,460]],["With Mandi",[220,350,650]]]} },

  { id:"af-pepper", name:"Pepper Alfaham", tags:["hot"],
    desc:"Coarse black pepper — aromatic and spicy.",
    img:"photos/af-pepper.jpg", icon:"grill", tint:"#5E4230", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[140,250,460]],["With Mandi",[220,350,650]]]} },

  { id:"af-curry", name:"Curry Leaves Alfaham",
    desc:"Infused with curry leaves, garlic and ginger.",
    img:"photos/af-curry.jpg", icon:"grill", tint:"#6E8F35", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[140,250,460]],["With Mandi",[220,350,650]]]} },

  { id:"af-masala", name:"Masala Alfaham",
    desc:"Signature masala blend — rich and flavourful.",
    img:"photos/af-masala.jpg", icon:"grill", tint:"#A8461F", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[150,260,470]],["With Mandi",[230,370,670]]]} },

  { id:"af-peri", name:"Peri Peri Alfaham", tags:["hot"],
    desc:"Fiery peri peri marinade, perfectly grilled.",
    img:"photos/af-peri.jpg", icon:"grill", tint:"#C4361C", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[150,260,470]],["With Mandi",[230,370,670]]]} },

  { id:"af-afghani", name:"Afghani Alfaham",
    desc:"Creamy marinade with mild spices and herbs.",
    img:"photos/af-afghani.jpg", icon:"grill", tint:"#D8C79A", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[160,250,490]],["With Mandi",[240,380,690]]]} },

  { id:"af-cheesy", name:"Cheesy Cheesy Alfaham", sub:"Chef’s pick", tags:["star"],
    desc:"Rich creamy marinade with layers of cheese for an indulgent finish.",
    img:"photos/af-cheesy.jpg", icon:"grill", tint:"#E0A93A", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[170,280,510]],["With Mandi",[250,400,740]]]} }
]},

{ id:"shawaya", ic:"\u{1F356}", name:"Shawaya", tagline:"Tender, juicy, char-grilled — led by our Masala Shawaya",
  layout:"list", items:[

  { id:"sh-masala", name:"Masala Shawaya", sub:"Our most ordered grill", tags:["star"],
    desc:"A whole bird opened flat, buried in our house masala and grilled until the "+
         "edges char and the gravy clings to every piece. This is the plate people "+
         "come back for — order it once and it decides the rest of your table.",
    img:"photos/sh-masala.jpg", icon:"grill", tint:"#A8461F", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[150,260,470]],["With Mandi",[230,370,670]]]} },

  { id:"sh-regular", name:"Regular Shawaya", desc:"Classic shawaya with traditional spices.",
    img:"photos/sh-regular.jpg", icon:"grill", tint:"#9C5426", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[140,250,460]],["With Mandi",[220,350,650]]]} },

  { id:"sh-pepper", name:"Pepper Shawaya", tags:["hot"], desc:"Pepper-marinated, smoky and bold.",
    img:"photos/sh-pepper.jpg", icon:"grill", tint:"#5E4230", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[150,260,470]],["With Mandi",[230,370,670]]]} },

  { id:"sh-green", name:"Green Chilli Shawaya", tags:["hot"], desc:"Spicy and zesty with a tangy kick.",
    img:"photos/sh-green.jpg", icon:"grill", tint:"#7FA83C", ig:[],
    matrix:{cols:QHF,rows:[["Without Mandi",[150,260,420]],["With Mandi",[230,370,670]]]} }
]},

{ id:"exotic", ic:"\u{1F336}", name:"Exotic Delights", tagline:"Crispy, fiery, made to share",
  layout:"list", items:[

  { id:"broast", name:"Broast Fried Chicken", sub:"Crispy perfection", tags:["star"],
    desc:"Pressure-fried chicken with a crisp golden crust. Served with dip and salad.",
    img:"photos/broast.jpg", icon:"broast", ig:[],
    opts:[["4 pieces",150],["8 pieces",250],["12 pieces",375]] },

  { id:"dragon", name:"Dragon Chicken", sub:"Fiery delight", tags:["hot"],
    desc:"Boneless chicken tossed with dried chilli, capsicum and cashew in a glossy hot sauce.",
    img:"photos/dragon.jpg", icon:"wok", ig:[],
    opts:[["Plate",178.5]] }
]},

{ id:"biryani", ic:"\u{1F35B}", name:"Biryani", tagline:"Malabar dum biryani, kaima rice, cooked to order",
  note:"⚠ PRICES TO CONFIRM — this section was not on the printed board.",
  layout:"list", items:[

  { id:"br-chicken", name:"Chicken Biryani", icon:"mandi", tint:"#C9873A", img:"photos/br-chicken.jpg", ig:[],
    desc:"Classic Malabar dum biryani — short-grain kaima rice, fried onion, roasted cashew and raisin.",
    matrix:{cols:QHF,rows:[["Price",[null,null,180]]]} },

  { id:"br-beef", name:"Beef Biryani", icon:"mandi", tint:"#8E4A22", img:"photos/br-beef.jpg", ig:[],
    desc:"Slow-cooked beef layered with spiced rice. Heavier, richer, the local favourite.",
    matrix:{cols:QHF,rows:[["Price",[null,null,200]]]} },

  { id:"br-mutton", name:"Mutton Biryani", icon:"mandi", tint:"#6B3416", img:"photos/br-mutton.jpg", ig:[],
    desc:"Tender mutton on the bone, dum-sealed with the rice so nothing escapes.",
    matrix:{cols:QHF,rows:[["Price",[null,null,260]]]} },

  { id:"br-fish", name:"Fish Biryani", icon:"mandi", tint:"#4A7C8C", img:"photos/br-fish.jpg", ig:[],
    desc:"Today's catch, marinated and layered with kaima rice. Ask what came in.",
    matrix:{cols:QHF,rows:[["Price",[null,null,220]]]} },

  { id:"br-chatti", name:"Chatti Biryani", sub:"Opened at your table", tags:["star"],
    icon:"mandi", tint:"#A8461F", img:"photos/br-chatti.jpg", ig:[],
    desc:"Sealed and served in the clay pot it cooked in. Cracked open in front of you — the steam is the point.",
    matrix:{cols:QHF,rows:[["Price",[null,320,590]]]} }
]},

{ id:"seafood", ic:"\u{1F41F}", name:"Chorum Meenum & Seafood",
  tagline:"Rice and fish, the way Malabar has always eaten it",
  note:"⚠ PRICES TO CONFIRM — new section, set your real prices in menu-data.js.",
  layout:"list", items:[

  { id:"fish-fry", name:"Legendary Fish Fry", sub:"You will not resist it", anchor:true,
    tags:["star"], icon:"fish", img:"photos/fish-fry.jpg", ig:[],
    desc:"Whole fish scored to the bone, packed with red chilli, shallot and curry leaf, "+
         "then shallow fried in coconut oil until the edges crackle. People order one to "+
         "share and end up ordering three. This is the plate our regulars are actually here for.",
    matrix:{cols:QHF,rows:[["Price",[null,null,180]]]} },

  { id:"chorum-meenum", name:"Chorum Meenum", sub:"Rice and fish meals", tags:["star"],
    icon:"meals", img:"photos/chorum-meenum.jpg", ig:[],
    desc:"Hot rice, fish curry in a clay pot, two thoran, pickle, pappadam and buttermilk. "+
         "The everyday Kerala plate, done properly. Add a fish fry on the side and it stops "+
         "being lunch and becomes an event.",
    matrix:{cols:QHF,rows:[["Price",[null,null,150]]]} },

  { id:"fish-curry", name:"Meen Curry", icon:"curry", tint:"#C4381F", img:"photos/fish-curry.jpg", ig:[],
    desc:"Clay-pot fish curry with kudampuli, chilli and coconut oil. Sour, hot, deep red.",
    matrix:{cols:QHF,rows:[["Price",[null,null,160]]]} },

  { id:"prawns-roast", name:"Chemmeen Roast", tags:["hot"], icon:"prawns", img:"photos/prawns-roast.jpg", ig:[],
    desc:"Prawns dry-roasted with onion, ginger and crushed pepper until the masala clings.",
    matrix:{cols:QHF,rows:[["Price",[null,null,260]]]} },

  { id:"squid-roast", name:"Koonthal Roast", icon:"prawns", tint:"#B8563A", img:"photos/squid-roast.jpg", ig:[],
    desc:"Squid rings tossed in a thick shallot-pepper masala. Chewy, smoky, addictive.",
    matrix:{cols:QHF,rows:[["Price",[null,null,240]]]} },

  { id:"grill-fish", name:"Charcoal Grilled Fish", icon:"fish", tint:"#8A6A3A", img:"photos/grill-fish.jpg", ig:[],
    desc:"Today's catch, scored, spiced and grilled whole over the same coals as the alfaham.",
    opts:[["Market price","MP"]] }
]},

{ id:"gravies", ic:"\u{1F35B}", name:"Gravies",
  tagline:"Rich, flavourful and coated with aromatic spices", layout:"paper", items:[
  { id:"g1", name:"Butter Chicken", desc:"Creamy, rich and buttery classic.", price:160, img:"photos/g1.jpg", icon:"curry", tint:"#E08A4A", ig:[] },
  { id:"g2", name:"Chicken Curry", desc:"Traditional homestyle curry.", price:150, img:"photos/g2.jpg", icon:"curry", tint:"#C9622A", ig:[] },
  { id:"g3", name:"Chicken Kadai", desc:"Spicy, aromatic and full of flavour.", price:150, tags:["hot"], img:"photos/g3.jpg", icon:"curry", tint:"#C4381F", ig:[] },
  { id:"g4", name:"Chicken Mughlai", desc:"Mild, creamy and royal.", price:160, img:"photos/g4.jpg", icon:"curry", tint:"#E3B472", ig:[] },
  { id:"g5", name:"Chicken 65 Gravy", desc:"Spicy, tangy and a chef’s special.", price:150, tags:["hot"], img:"photos/g5.jpg", icon:"curry", tint:"#D2462A", ig:[] },
  { id:"g6", name:"Chicken Tikka Masala", desc:"Smooth, creamy and smoky.", price:150, img:"photos/g6.jpg", icon:"curry", tint:"#D9793A", ig:[] },
  { id:"g7", name:"Dal Fry", desc:"Comforting and delicious dal.", price:120, tags:["veg"], img:"photos/g7.jpg", icon:"curry", tint:"#E0B23A", ig:[] },
  { id:"g8", name:"Mix Veg Curry", desc:"Healthy mixed vegetable curry.", price:120, tags:["veg"], img:"photos/g8.jpg", icon:"curry", tint:"#7FA83C", ig:[] }
]},

{ id:"breads", ic:"\u{1F950}", name:"Breads", tagline:"Freshly made. Perfect with every bite",
  layout:"paper", items:[
  { id:"b1", name:"Khubbus", desc:"Soft, fluffy and perfect with gravy.", price:20, tags:["veg"], img:"photos/b1.jpg", icon:"bread", ig:[] },
  { id:"b2", name:"Rumali Roti", desc:"Thin, soft and light as air.", price:20, tags:["veg"], img:"photos/b2.jpg", icon:"bread", ig:[] },
  { id:"b3", name:"Parota", desc:"Flaky, soft and layered.", price:30, tags:["veg"], img:"photos/b3.jpg", icon:"bread", ig:[] },
  { id:"b4", name:"Kushi Parota", desc:"Soft, flaky, multi-layered delight.", price:40, tags:["veg"], img:"photos/b4.jpg", icon:"bread", ig:[] },
  { id:"b5", name:"Chapati", desc:"Soft and healthy whole wheat.", price:20, tags:["veg"], img:"photos/b5.jpg", icon:"bread", ig:[] }
]},

{ id:"shawarma", ic:"\u{1F32F}", name:"Shawarma", tagline:"Perfectly wrapped, insanely good",
  layout:"paper", items:[
  { id:"w1", name:"Chicken Shawarma", desc:"The classic wrap.", price:120, img:"photos/w1.jpg", icon:"wrap", ig:[] },
  { id:"w2", name:"Spicy Shawarma", desc:"Extra heat in the sauce.", price:130, tags:["hot"], img:"photos/w2.jpg", icon:"wrap", ig:[] },
  { id:"w3", name:"Cheesy Shawarma", desc:"Loaded with melted cheese.", price:140, img:"photos/w3.jpg", icon:"wrap", ig:[] },
  { id:"w4", name:"Special Shawarma", desc:"House special filling.", price:140, img:"photos/w4.jpg", icon:"wrap", ig:[] },
  { id:"w5", name:"Jumbo Shawarma", desc:"Double the filling.", price:160, tags:["star"], img:"photos/w5.jpg", icon:"wrap", ig:[] },
  { id:"w6", name:"Add Fries + Drink", desc:"Combo add-on with any shawarma.", price:80, img:"photos/w6.jpg", icon:"broast", ig:[] }
]},

{ id:"sides", ic:"\u{1F957}", name:"Sides & Extras", tagline:"Round out the plate",
  layout:"paper", items:[
  { id:"s1", name:"Extra Salad", price:20, tags:["veg"], img:"photos/s1.jpg", icon:"salad", ig:[] },
  { id:"s2", name:"Extra Chutney", price:20, tags:["veg"], img:"photos/s2.jpg", icon:"sauce", tint:"#7FA83C", ig:[] },
  { id:"s3", name:"Extra Pickle", price:20, tags:["veg"], img:"photos/s3.jpg", icon:"sauce", tint:"#B8431F", ig:[] },
  { id:"s4", name:"Extra Rice", price:60, tags:["veg"], img:"photos/s4.jpg", icon:"rice", ig:[] },
  { id:"s5", name:"Extra Soup", price:20, img:"photos/s5.jpg", icon:"soup", ig:[] },
  { id:"s6", name:"Shawarma Sauce", price:20, tags:["veg"], img:"photos/s6.jpg", icon:"sauce", tint:"#E8D08A", ig:[] }
]},

{ id:"drinks", ic:"\u{1F379}", name:"Juices & Mojitos", tagline:"Wild and fresh. Refreshing",
  layout:"paper", items:[
  { id:"d1", name:"Fresh Lime", price:70, tags:["veg"], img:"photos/d1.jpg", icon:"juice", tint:"#C6E04A", ig:[] },
  { id:"d2", name:"Watermelon Juice", desc:"Blended from juicy handpicked watermelons. Naturally sweet, instantly cooling.", price:70, tags:["veg","star"], img:"photos/d2.jpg", icon:"juice", tint:"#E8506A", photos:[{src:"photos/posters/d2.jpg", caption:"Watermelon Juice \u2014 no added preservatives"}], ig:[] },
  { id:"d3", name:"Orange Juice", price:100, tags:["veg"], img:"photos/d3.jpg", icon:"juice", tint:"#F09024", ig:[] },
  { id:"d4", name:"Pineapple Juice", desc:"Handpicked ripe pineapples, blended fresh. Rich in vitamin C.", price:60, tags:["veg","star"], img:"photos/d4.jpg", icon:"juice", tint:"#F0C42A", photos:[{src:"photos/posters/d4.jpg", caption:"Pineapple Juice \u2014 100% real pineapple"}], ig:[] },
  { id:"d5", name:"Mixed Fruit Juice", price:110, tags:["veg"], img:"photos/d5.jpg", icon:"juice", tint:"#E8743A", ig:[] },
  { id:"d6", name:"Pomegranate Juice", price:110, tags:["veg"], img:"photos/d6.jpg", icon:"juice", tint:"#B8324A", ig:[] },
  { id:"d14", name:"Carrot Juice", desc:"Fresh carrots, packed with beta-carotene. A healthy, refreshing boost.", price:70, tags:["veg","star"], img:"photos/d14.jpg", icon:"juice", tint:"#F07A18", photos:[{src:"photos/posters/d14.jpg", caption:"Carrot Juice \u2014 rich in vitamin A"}], ig:[] },
  { id:"d7", name:"Mint Mojito", price:90, tags:["veg"], img:"photos/d7.jpg", icon:"mojito", ig:[] },
  { id:"d8", name:"Watermelon Mojito", price:90, tags:["veg"], img:"photos/d8.jpg", icon:"mojito", tint:"#E8607A", ig:[] },
  { id:"d9", name:"Orange Mojito", price:90, tags:["veg"], img:"photos/d9.jpg", icon:"mojito", tint:"#F09024", ig:[] },
  { id:"d10", name:"Blue Lagoon Mojito", price:100, tags:["veg"], img:"photos/d10.jpg", icon:"mojito", tint:"#3AA8DC", ig:[] },
  { id:"d11", name:"Pineapple Mojito", price:100, tags:["veg"], img:"photos/d11.jpg", icon:"mojito", tint:"#EFC72E", ig:[] },
  { id:"d12", name:"Passion Fruit Mojito", price:110, tags:["veg"], img:"photos/d12.jpg", icon:"mojito", tint:"#E0A02A", ig:[] },
  { id:"d13", name:"Strawberry Mojito", price:110, tags:["veg"], img:"photos/d13.jpg", icon:"mojito", tint:"#DC4460", ig:[] },
  { id:"d15", name:"Pineapple Chilli Mojito", sub:"Spicy. Refreshing. Unforgettable.", desc:"Pineapple, lime and mint with a green chilli kick. The one people come back for.", price:70, tags:["veg","hot","star"], anchor:true, img:"photos/d15.jpg", icon:"mojito", tint:"#C6D63A", photos:[{src:"photos/posters/d15.jpg", caption:"Pineapple Chilli Mojito \u2014 spicy, refreshing, unforgettable"}], ig:[] }
]},

{ id:"desserts", ic:"\u{1F368}", name:"Desserts & Ice Cream", tagline:"The perfect sweet ending",
  layout:"paper", items:[
  { id:"x1", name:"Avil Milk", desc:"Kerala-style flattened rice in chilled milk.", price:110, tags:["veg"], img:"photos/x1.jpg", icon:"shake", ig:[] },
  { id:"x2", name:"Falooda", desc:"Layered rose, vermicelli, jelly and ice cream.", price:120, tags:["veg"], img:"photos/x2.jpg", icon:"falooda", ig:[] },
  { id:"x3", name:"Mango Delight", desc:"Chilled mango with nuts.", price:120, tags:["veg"], img:"photos/x3.jpg", icon:"mango", ig:[] },
  { id:"x4", name:"Ice Cream Scoops", desc:"Ask for today’s flavours.", price:60, tags:["veg"], img:"photos/x4.jpg", icon:"icecream", ig:[] }
]}

];
