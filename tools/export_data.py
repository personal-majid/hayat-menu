"""Hayat sales data export - for ChatGPT or any spreadsheet.

Run EXPORT-DATA.bat (double-click). It downloads the day logs the shop PC syncs
(vm_daylog), keeps them in a cache so the next run only fetches new days, and writes
small CSV files plus a README into Documents\\Hayat-data\\hayat-data-<date>.zip.

Counted the owner app's way: customer bills only (staff food out with the same rules),
counter bills noted dm/hd/zomato/swiggy/deliver count as Delivery, a sale is a bill
MADE (createdAt), lunch = bills made 05:00-15:59, evening = 16:00 to closing,
pre-bookings = bills over Rs 4,000 (flagged, and left out of the daily tables).
No customer names, phones, addresses, staff names or notes leave the PC.
Standard library only (no pip install needed).
"""
import csv, hashlib, json, os, re, sys, time, urllib.request, zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta

KEY = 'AIzaSyA48aGGeEvg9lyVzeTX5fPIA21SrMZQPn8'   # public web key, same as config.js
BASE = 'https://firestore.googleapis.com/v1/projects/h-menu/databases/(default)/documents/'
OUT = os.path.join(os.path.expanduser('~'), 'Documents', 'Hayat-data')
CACHE = os.path.join(OUT, 'cache')
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 180
PRE = 4000

def get(path):
    for t in range(3):
        try:
            with urllib.request.urlopen(BASE + path + ('&' if '?' in path else '?') + 'key=' + KEY, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if t == 2: raise
        except Exception:
            if t == 2: raise
        time.sleep(2)

def dec(v):
    if 'mapValue' in v: return {k: dec(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v: return [dec(x) for x in v['arrayValue'].get('values', [])]
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'stringValue' in v: return v['stringValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'timestampValue' in v: return v['timestampValue']
    return None

def doc(d): return {k: dec(x) for k, x in (d or {}).get('fields', {}).items()}

def biz_today():
    n = datetime.now()
    return (n - timedelta(hours=5)).date()

# ---- the owner app's rules (owner.html prep / isStaff / DELIV_WORDS) ----
ORDER = re.compile(r'^(co|c/o|c\.o|d\.?m+\w*|hd|h\.d|cnt|cntr|counter|parcel|take ?away|ta|pack\w*|deliver\w*|home ?del\w*|zomato|swiggy|online)\b', re.I)
DELIV = re.compile(r'^(d\.?m+\w*|hd|h\.d|deliver\w*|home ?del\w*|zomato|swiggy)\b', re.I)

def total(r):
    t = r.get('total') or 0
    return t if t else sum((i.get('a') or 0) for i in r.get('items') or [])

def channel(r, staffn):
    rem = str(r.get('remarks') or '').strip(); kind = r.get('kind')
    if kind not in ('delivery', 'dine') and DELIV.match(rem): return 'Delivery'
    if rem and not ORDER.match(rem):
        w = rem.split()[0].upper()
        if w in staffn or re.search(r'\bstaff\b', rem, re.I): return None
        if re.fullmatch(r'[a-z]{2,14}', rem, re.I) and total(r) <= 300: return None
        if kind == 'counter' and not re.search(r'\d{6,}', rem) and re.search(r'[a-z]', rem, re.I) and total(r) <= 600: return None
    return {'dine': 'Dine', 'counter': 'CO', 'delivery': 'Delivery'}.get(kind)

def group(n):
    n = n.upper()
    rules = [('King fish', r'KING ?FISH'), ('Other fish & prawns', r'PRAWN|POMFRET|AILA|FISH|SQUID|KOONTHAL|MATHI|HAMMOOR|CHEMBALLY|MANDAL'),
             ('Beef & mutton', r'BEEF|MUTTON'), ('Alfaham Mandi', r'^ALFAHAM MANDH?I'), ('Chicken Mandi', r'^CHICKEN MANDH?I'),
             ('Mandi rice', r'MANDI RICE'), ('Peri Peri, Honey & other mandi', r'MANDH?I'),
             ('Alfaham / Shawaya (no rice)', r'ALFAHAM ONLY|ALFHAM ONLY|SHAWAYA|CHICKEN ONLY|ALFAHAM \(|ALFAHAM$'),
             ('Broast', r'BROAST'), ('Meals', r'MEALS'), ('Biriyani', r'BIRIYANI|BIRYANI'), ('Fried rice & noodles', r'FRIED RICE|NOODLE'),
             ('Payasam & desserts', r'PAYASAM|PUDDING|ICE ?CREAM|FALOODA|KUNAFA|DESSERT'),
             ('Porotta & breads', r'POROTTA|PAROTTA|CHAPATH?I|KUBOOS|ROTTI|NAAN|PATHIRI'), ('Fresh drinks', r'LIME|JUICE|MOJITO|SHAKE|LASSI|AVIL'),
             ('Bottled drinks', r'PEPSI|7UP|COLA|DEW|SPRITE|MIRINDA|MINERAL|SODA|\d+\s*ML|LTR|THUMS|SLICE|WATER|APPY|FIZZ|COCO'),
             ('Tea & coffee', r'\bTEA\b|COFFEE'), ('Chicken dishes', r'65|CHILLI|BUTTER|PEPPER|GARLIC|DRY|ROAST|CURRY|MASALA')]
    for g, rx in rules:
        if re.search(rx, n): return g
    return 'Other'

SIZE = re.compile(r'\b(QTR|QUARTER|HALF|FULL)\b')

def main():
    os.makedirs(CACHE, exist_ok=True)
    today = biz_today(); first = today - timedelta(days=DAYS)
    print(f'Hayat data export - {first} to {today - timedelta(days=1)} (finished days)')
    fl = doc(get('vm_meta/floor')); staffn = {str(v).strip().upper() for v in (fl.get('staff') or {}).values() if str(v).strip()}
    days = []; d = first
    while d < today: days.append(d.isoformat()); d += timedelta(days=1)
    recs = {}
    for i, d in enumerate(days):
        f = os.path.join(CACHE, d + '.json')
        fresh = d >= (today - timedelta(days=2)).isoformat()   # the last 2 days may still change (late bills)
        if os.path.exists(f) and not fresh:
            x = json.load(open(f, encoding='utf-8'))
        else:
            print(f'  downloading {d} ({i + 1}/{len(days)})', end='\r')
            x = doc(get('vm_daylog/' + d)); json.dump(x, open(f, 'w', encoding='utf-8'))
        r = x.get('records') or {}
        if isinstance(r, list): r = {str(k): v for k, v in enumerate(r)}
        if r: recs[d] = r
    print(' ' * 60, end='\r')
    if not recs: print('No day logs found.'); return
    bills, items = [], []
    for d, R in sorted(recs.items()):
        for k, r in R.items():
            if r.get('status') not in ('settled', 'open', 'due'): continue
            ch = channel(r, staffn); v = total(r)
            if not ch or v <= 0: continue
            t = r.get('createdAt') or r.get('settledAt') or ''
            h = int(t[11:13]) if len(t) >= 13 else -1
            if h < 0: continue
            bid = hashlib.sha1((d + k).encode()).hexdigest()[:10]
            ses = 'lunch' if 5 <= h < 16 else 'evening'
            pre = int(v > PRE)
            bills.append([d, bid, ch, ses, r.get('section') or '', t[11:16], v, r.get('discount') or 0, r.get('pax') or '', pre, r.get('status')])
            for it in r.get('items') or []:
                n = str(it.get('n') or '').strip().upper()
                if not n or not (it.get('q') or 0) > 0: continue
                m = SIZE.search(n)
                items.append([d, bid, ch, ses, r.get('section') or '', n, group(n), m.group(1).replace('QUARTER', 'QTR') if m else '', it.get('q'), it.get('p'), it.get('a') or 0, pre])
    stamp = today.isoformat(); folder = os.path.join(OUT, 'hayat-data-' + stamp); os.makedirs(folder, exist_ok=True)
    def write(name, head, rows):
        with open(os.path.join(folder, name), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f); w.writerow(head); w.writerows(rows)
    write('bills.csv', ['day', 'bill_id', 'channel', 'session', 'hall', 'ordered_at', 'total_rs', 'discount_rs', 'guests', 'prebooking_over_4000', 'status'], bills)
    write('items.csv', ['day', 'bill_id', 'channel', 'session', 'hall', 'item', 'group', 'size', 'qty', 'unit_price_rs', 'amount_rs', 'prebooking_over_4000'], items)
    # daily: whole shop, by channel x session (pre-bookings out)
    D = defaultdict(lambda: defaultdict(float))
    for b in bills:
        if b[9]: D[b[0]]['prebook_rs'] += b[6]; continue
        for k in ('all', b[2] + '_' + b[3], b[3], b[2]):
            D[b[0]][k + '_rs'] += b[6]; D[b[0]][k + '_bills'] += 1
    cols = ['all', 'lunch', 'evening', 'Dine', 'CO', 'Delivery'] + [c + '_' + s for c in ('Dine', 'CO', 'Delivery') for s in ('lunch', 'evening')]
    head = ['day', 'weekday'] + [c + x for c in cols for x in ('_rs', '_bills')] + ['prebook_rs']
    write('daily.csv', head, [[d, date.fromisoformat(d).strftime('%a')] + [round(D[d][c + x]) for c in cols for x in ('_rs', '_bills')] + [round(D[d]['prebook_rs'])] for d in sorted(D)])
    # daily by dish group x session x channel (pre-bookings out) - the small file to start with
    G = defaultdict(lambda: [0.0, 0.0])
    for it in items:
        if it[11]: continue
        G[(it[0], it[3], it[2], it[6])][0] += it[10]; G[(it[0], it[3], it[2], it[6])][1] += it[8]
    write('daily_groups.csv', ['day', 'weekday', 'session', 'channel', 'group', 'sales_rs', 'plates'],
          [[k[0], date.fromisoformat(k[0]).strftime('%a'), k[1], k[2], k[3], round(v[0]), round(v[1], 2)] for k, v in sorted(G.items())])
    # price per item and hall per day (the price most plates were billed at), and the changes found
    P = defaultdict(lambda: defaultdict(float))
    for it in items:
        if it[9]: P[(it[5], it[4], it[0])][it[9]] += it[8]
    mode = {k: max(v.items(), key=lambda x: x[1])[0] for k, v in P.items()}
    seq = defaultdict(list)
    for (n, hall, d), p in sorted(mode.items(), key=lambda x: x[0][2]): seq[(n, hall)].append((d, p))
    ch = []
    for (n, hall), S in seq.items():
        if len(S) < len(recs) / 2: continue   # hall sells it on fewer than half the days = noise
        for i in range(2, len(S)):
            d, p = S[i]
            if p != S[i - 1][1] and S[i - 1][1] == S[i - 2][1] and (i == len(S) - 1 or S[i + 1][1] == p):
                ch.append([d, n, group(n), hall, S[i - 1][1], p])
    write('price_changes.csv', ['day', 'item', 'group', 'hall', 'price_before', 'price_after'], sorted(ch))
    open(os.path.join(folder, 'README.md'), 'w', encoding='utf-8').write(README.format(first=min(recs), last=max(recs), n=len(recs)))
    z = folder + '.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in os.listdir(folder): zf.write(os.path.join(folder, f), f)
    print(f'Done: {len(recs)} days, {len(bills)} customer bills, {len(items)} item lines, {len(ch)} price changes found.')
    print('ZIP for ChatGPT: ' + z)

README = """# Hayat restaurant - sales data {first} to {last} ({n} days)

Non-vegetarian family restaurant on the NH 966 highway near Malappuram, Kerala (mandi, alfaham, broast, king fish, meals).
Business day 05:00-05:00. Customer bills only; staff food removed. No names, phones or notes.

| file | one row = |
|---|---|
| daily_groups.csv | day x session x channel x dish group: sales and plates. START HERE (small). Pre-bookings left out. |
| daily.csv | one day: sales and bills, whole shop, lunch/evening, by channel and channel x session. Pre-bookings separate. |
| price_changes.csv | a price change found in the bills: item, hall, before, after, first day. |
| items.csv | one line on a bill (item, group, size, qty, unit price, amount). |
| bills.csv | one customer bill (channel, session, hall, time ordered, total). |

- channel: Dine (table), CO (walk-in counter takeaway), Delivery.
- session: lunch = bills made before 16:00, evening = 16:00 to closing.
- prebooking_over_4000 = 1: big pre-booked orders; analyse separately, they are lumpy.
- Sabarimala season (many avoid meat) runs 17 Nov - 27 Dec. Salary days (29th-4th) lift evenings.

## Questions
1. Day by day, which dish groups rose or fell, at lunch and in the evening, by channel? Compare each day with the same weekday in earlier weeks.
2. For each price change in price_changes.csv: plates a day and plates per 100 customer bills, after vs the same weekdays before. Did people move between Quarter, Half and Full? Separate the price effect from the whole shop being busier or quieter.
3. What is the trend of each major group (Alfaham Mandi, Chicken Mandi, Mandi rice, King fish, Broast, Meals, Biriyani) once weekday and salary days are allowed for?
4. What should we change next, and which 4-5 numbers should we check every week?
Answer in short plain sentences with a small table for each question. Say when you are guessing.
"""

if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('Export failed:', e); sys.exit(1)
