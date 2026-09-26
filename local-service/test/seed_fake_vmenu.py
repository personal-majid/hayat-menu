"""Build a fake VMENU database from the real exports, for testing only.
Tables and columns follow the SQL in the timing report; item columns are a guess
(the real names come from `vmenu_sync.py discover`)."""
import csv, datetime as dt, sys
import pymysql

DB = dict(host="127.0.0.1", port=3307, user="root", password="", unix_socket="/tmp/mdb.sock")
TIMING = sys.argv[1]
ITEMS = sys.argv[2]
DAYS = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None

c = pymysql.connect(**DB, autocommit=True)
cur = c.cursor()
cur.execute("DROP DATABASE IF EXISTS vmenu")
cur.execute("CREATE DATABASE vmenu CHARACTER SET utf8mb4")
cur.execute("USE vmenu")
cur.execute("""CREATE TABLE svr_sectionparent (sectionid INT PRIMARY KEY, sectionname VARCHAR(40))""")
cur.execute("""CREATE TABLE svr_employeeparent (employeeid INT PRIMARY KEY, employeename VARCHAR(60))""")
cur.execute("""CREATE TABLE svr_invoiceparent (invoiceid INT PRIMARY KEY, billno INT, secid INT, parceltype INT,
  tableno INT, kotno INT, token_no INT, ordtakerid INT, pax INT, order_time DATETIME, running_order DATETIME NULL,
  duebill_time DATETIME, billingtime DATETIME, totalprice DECIMAL(10,2), settlingprice DECIMAL(10,2),
  payment_mode VARCHAR(20), remarks VARCHAR(100), KEY(billingtime))""")
cur.execute("""CREATE TABLE svr_invoicechild (childid INT AUTO_INCREMENT PRIMARY KEY, invoiceid INT, itemname VARCHAR(80),
  itemquantity DECIMAL(8,2), itemprice DECIMAL(10,2), itemtotal DECIMAL(10,2), running_ord_time DATETIME NULL, KEY(invoiceid))""")
cur.execute("""CREATE TABLE ord_invoiceheader LIKE svr_invoiceparent""")
cur.execute("""CREATE TABLE ord_invoicechild LIKE svr_invoicechild""")
secs = {"PARCEL": 1, "AC": 2, "NON AC": 3, "HUT": 4, "JUICY HUT": 5}
for n, i in secs.items():
    cur.execute("INSERT INTO svr_sectionparent VALUES (%s,%s)", (i, n))

emp = {}
items = {}
with open(ITEMS, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        items.setdefault(int(r["Bill No"]), []).append(r)
n = 0
with open(TIMING, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if not r["Settled Time"]:
            continue
        if DAYS and r["Settled Time"][:10] not in DAYS:
            continue
        name = r["Order Taker"]
        if name not in emp:
            emp[name] = len(emp) + 1
            cur.execute("INSERT INTO svr_employeeparent VALUES (%s,%s)", (emp[name], name))
        cur.execute("INSERT INTO svr_invoiceparent VALUES (%s,%s,%s,%s,%s,%s,NULL,%s,NULL,%s,%s,%s,%s,%s,%s,%s,%s)", (
            int(r["Invoice ID"]), int(r["Bill No"]), secs.get(r["Section"], 2), 1 if r["Type"] == "Parcel" else 0,
            int(r["Table No"] or 0), int(r["KOT No"] or 0), emp[name], r["Order Time (1st KOT)"] or None,
            r["Last Add-on KOT"] or None, r["Due Bill Time"] or None, r["Settled Time"],
            r["Bill Amount"] or 0, r["Bill Amount"] or 0, "CASH", r["Remarks"] or None))
        for it in items.get(int(r["Bill No"]), []):
            cur.execute("INSERT INTO svr_invoicechild (invoiceid,itemname,itemquantity,itemprice,itemtotal) VALUES (%s,%s,%s,%s,%s)",
                        (int(r["Invoice ID"]), it["Item"], it["Qty"], it["Price"], it["Total"]))
        n += 1
cur.execute("CREATE USER IF NOT EXISTS 'hayat_sync'@'%' IDENTIFIED BY 'test'")
cur.execute("GRANT SELECT ON vmenu.* TO 'hayat_sync'@'%'")
print("seeded", n, "bills,", len(emp), "staff")
