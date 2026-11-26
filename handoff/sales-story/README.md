# Handoff — Hayat sales story (what moved sales, Jul → Nov 2026)

Written 26 Nov 2026 from the desktop thread, for the cloud thread Majid uses from his phone.
Everything needed is in this folder. Repo state: **v358 on `main`**.

> ⚠ This repo is public (GitHub Pages). The files here are Majid's own business numbers, put here at his request.
> Do not add customer names, phones or addresses. Do not add more raw data than needed.

---

## 1. What Majid wants

One clear, phone-readable picture of **how each event moved sales**, in his own timeline. For each step he wants:
- how many plates or numbers grew,
- how much each part added to the whole-shop % change.

He said: **"be cautious"** and **"every time you end up confusing me"**.
- Keep the definitions fixed and print them on the image.
- One line of plain words per step.
- Say when two events overlap and can't be split.
- Say when there are too few days to judge.

**His timeline, in his words:**
1. Before the name boards.
2. **Boards installed** (with the new fish menu) → sales rose, **mostly at lunch**.
3. **Onam** came in the same weeks, then things **settled**.
4. **Dasara holidays** → sales rose again.
5. **Slump**: Saudi / Gulf trouble and inflation.
6. **Price hike on every item** (25 Oct).
7. **Offer on delivery and counter (takeaway)** for **Alfaham Mandi and Chicken Mandi** (from 21 Nov).

He wants to see how much those dishes grew under the offer, and what that did to total sales.

---

## 2. Fixed definitions (use these and print them on the image)

| Thing | Rule |
|---|---|
| Sale | A **customer bill MADE** (createdAt), status settled / open / due. Staff food is never a sale. |
| Pre-bookings | **Left out**: bill over ₹5,000 AND a main dish ×8 or more (or a known bulk bill, `LG_SEED`). Same rule as `tools/export_data.py` and `owner.html` `isLarge`. |
| Lunch / evening | Lunch = made before **16:00**. Business day = **05:00 to 05:00 IST**. |
| Channels | **Dine**, **CO** (counter / takeaway / parcel), **Delivery**. A counter bill noted dm / hd / zomato / swiggy counts as Delivery. |
| ₹ a day | Average per day, **adjusted for weekday mix**. Each period has different weekends; weekday index = median ₹ of that weekday ÷ mean of the 7 medians. |
| Birds | Full = 1, Half = ½, Qtr = ¼. |
| Discount / offer | VMENU's `discount` field is always 0. An offer shows as **bill total < sum of its items** (more than ₹10 gap, settled bills). |

**Why earlier answers confused him.** The 21 Nov images used different rules: pre-bookings left IN, settled bills only, a "before" window of 20 Aug – 24 Oct, lunch before 4 pm. So their "average day" is **₹70.3K**, while this handoff's is about ₹63–65K. When a number differs from those images, say why in one line.

---

## 3. Dates

| Event | Date(s) | Notes |
|---|---|---|
| Name boards + fish menu (king fish, meals, other fish) | **20 Aug** (assumed — ask Majid to confirm the board date) | New dishes first appear on bills on 20 Aug |
| Onam | 23 – 30 Aug (Thiruvonam 26 Aug) | Gulf summer break ends ~30 Aug |
| Houthi attacks on Saudi start | 23 Sep | Late Sep – early Oct was actually the **highest** stretch |
| Navaratri / Dasara | 11 – 21 Oct; Mahanavami **19 Oct**, Vijayadashami **20 Oct** (long weekend 17–20 Oct) | |
| **Price hike** | **25 Oct** (31 items changed that day) | e.g. Alfaham Mandi Full 660→780, Half 360→390, Qtr 180→205; Chicken Mandi Full 600→700, Half 320→370, Qtr 170→190 |
| Saudi escalation | 12 Nov | |
| Sabarimala season (many skip meat) | from **17 Nov** | overlaps the offer |
| **Offer, takeaway + home delivery only** | from **21 Nov** | Alfaham Mandi Qtr ₹189 (was 195) · Half ₹369 (was 390) · Full ₹720 (was 780) · free payasam Qtr 1 / Half 2 / Full 4 · free delivery within 4 km. Similar posters for Chicken Mandi and mandi rice — see `posters/` |

From the bills: discounted CO / delivery bills containing Alfaham or Chicken Mandi went from **~0 a day to 5–20 a day on 21 Nov**.

---

## 4. Numbers already worked out (rebuild and check them — do not just copy)

Source: `data/daily.csv` (14 Jul – 25 Nov, the app's export) + bill / item level from Firestore.
₹ a day is weekday-adjusted, pre-bookings out.

| Period | Days | ₹ a day | Bills a day | Change vs previous | Where the change came from (points of the whole shop) |
|---|---|---|---|---|---|
| A Before boards · 14 Jul – 19 Aug | 37 | **₹45.0K** | 95 | — | lunch ₹14.8K, evening ₹30.2K |
| B Boards + fish menu + Onam · 20 – 31 Aug | 12 | ₹64.7K | 126 | **+44%** | dine lunch +22, dine evening +17, CO +5, delivery 0 |
| C Settled · 1 Sep – 10 Oct | 40 | ₹65.2K | 120 | +1% | dine lunch +5, CO −3 |
| D Dasara · 11 – 24 Oct | 14 | ₹72.9K | 124 | **+12%** | delivery +5, dine evening +5, dine lunch +1 |
| E Price hike · 25 Oct – 11 Nov | 18 | ₹63.4K | 107 | **−13%** | dine evening −7, delivery −4, CO −2, **dine lunch 0** |
| F Saudi escalation + Sabarimala · 12 – 20 Nov | 9 | ₹60.4K | 106 | −5% | CO −4 |
| G Offer · 21 – 25 Nov (**only 5 days**) | 5 | ₹52.0K | 95 | −14% | **dine lunch −12** (not related to the offer), delivery −4, CO +2 |

**Where the growth from A to C came from** (₹ a day, dish groups): king fish +₹7.1K (new), meals +₹4.6K (new), other fish & prawns +₹3.5K (new), chicken dishes +₹1.4K, fresh drinks +₹0.8K, chicken mandi +₹0.4K, **alfaham mandi −₹0.9K**.
- The new dishes are lunch dishes: meals 96% lunch, other fish 82%, king fish 64%.
- That's why lunch went from ₹14.8K to ₹28.8K a day.

**Alfaham Mandi and Chicken Mandi, birds a day:**

| | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| Alfaham Mandi | 18.7 | 16.3 | 18.5 | **23.2** | 17.8 | 13.2 | 13.4 |
| Chicken Mandi | 5.6 | 6.4 | 6.2 | 6.6 | 5.0 | 4.3 | 4.7 |
| Both, on CO + delivery | 13.2 | 12.7 | 13.2 | 17.6 | 12.6 | 8.3 | 10.9 |

- **Price hike:** Alfaham Full plates went 15.4 → 9.7 a day (Navaratri vs new prices) — a Full now costs exactly 2 Halves.
- **Dine tables:** evening −17%, lunch 0%. The average evening bill stayed flat (₹566 → ₹561) although prices rose ~12%, so people ordered less.

**Offer check** — each offer day vs the same weekday in the 4 weeks before. Alfaham + Chicken Mandi on CO + delivery:
- 16–20 Nov (just before the offer): **−51%**
- 21–25 Nov (offer): **−14%**. The offer recovered most of the drop, but only for those dishes.
- Same 5 days, CO + delivery ₹ overall: −26%. Whole shop: −20%, mostly from fewer dine lunches.
- Discounts given ≈ ₹560 a day.
- **Early read:** 5 days, overlapping Sabarimala. Re-check with every new day.

---

## 5. Earlier images (in `images/`)

| File | Made | Rules | Main claims |
|---|---|---|---|
| `Hayat-Sales-Review.jpg` | 21 Nov | pre-bookings in, settled only, regression over 130 days | Fish menu + boards: dine lunch **+130%**, dine evening +29%, delivery lunch +82% (clear). Festival: dine evening +27% (clear). Salary days: CO evening +19% (clear). Price hike: CO lunch sales **−55%**, bills **−39%** (clear). |
| `Hayat-Sales-Effects.png` | 21 Nov | same, with ₹ | same table in ₹; average day before the hike ₹64,486 |
| `Hayat-Before-After-Hike.png` | 21 Nov | settled, pre-bookings in | Counter week by week after the hike: ₹15,069 → 13,974 → 12,194 → 8,962 a day. Dine evening −15%. Delivery evening flat (+4%). |
| `hayat-story-26nov.jpg` | 26 Nov | this handoff's rules | periods, growth by dish group, Alfaham / Chicken Mandi, price rise, offers |
| `hayat-factors-26nov.jpg` | 26 Nov | this handoff's rules | weekday, part of month, holidays, seasons, what has no effect |

---

## 6. How to get fresh data

- **Firestore REST** (rules are open on purpose): project `h-menu`; the web `apiKey` is in `config.js`.
  - Day log: `GET https://firestore.googleapis.com/v1/projects/h-menu/databases/(default)/documents/vm_daylog/YYYY-MM-DD?key=…`
  - `fields.records` = bills, each with kind, status, createdAt, settledAt, dueAt, total, items[{n,q,p}], section, table, waiter, remarks.
- Or run `python tools/export_data.py 140`. It writes daily.csv, daily_groups.csv, items.csv, bills.csv with the rules above (stdlib only).
- If this environment can't reach firestore.googleapis.com, **say so at once** and work from `data/` (it stops at 25 Nov).
- `analysis/story2.py` = the script behind section 4. Run it as `python analysis/story2.py <folder with bills.csv items.csv daily.csv>`. It needs the export's bills.csv / items.csv.

## 7. What done looks like

1. Periods A–G recomputed with fresh data, plus H = 21 Nov → the latest finished day for the offer.
2. For each step: % change and its split into dine lunch / dine evening / CO / delivery points.
3. Offer: Alfaham + Chicken Mandi plates and ₹ on CO + delivery:
   - vs the same weekdays before;
   - vs the 5 days just before the offer;
   - the discount ₹ given;
   - the net effect on the whole shop.
4. ONE image, 1080 px wide, ivory background, big numbers, one plain line per step, a caution tag where events overlap. Show it in the session.
5. Under 15 lines of plain summary. No jargon.

The app itself already has Insights → What moved sales (`mvPage`), Dish analysis (`dishPage`), Dish groups (`dgPage`), Trends (`trPage`) and period Overview (`pdCard`, `pmCard`, `lgPeriod`). Read `CLAUDE.md` v301–v358 before changing any of them.
