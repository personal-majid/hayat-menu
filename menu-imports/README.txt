MENU IMPORTS
============
One CSV = one menu. Admin -> Menu -> "Import a CSV" -> pick the
file -> it appears in the list -> "Make active". The customer app,
the tablet and the phone-order screen switch to it at once. The
built-in menu (menu-data.js) stays as a choice and keeps its photos.

Columns (TEMPLATE.csv shows all four kinds):
  section      "Mandi"                      the category
  section_ml   "മന്ദി"                       shown beside it (optional)
  item         "Chicken Mandi"
  sub          small line under the name (optional)
  sizes        Qtr=160|Half=320|Full=600     label=price, | between
               Veg=170|Chicken=190
               4 pcs=150|8 pcs=300
  price        one price when there are no sizes
  note         "Seasonal" / "Market price" — shown, not priced.
               An item with no sizes and no price is listed as
               "ask" and cannot be added to a cart.

Photos: an imported item with the same name as a built-in dish
gets that dish's photo. Everything else is text.

Excel: File -> Save As -> "CSV UTF-8 (Comma delimited)". Malayalam
needs the UTF-8 one.
