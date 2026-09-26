"""End-to-end checks against the fake VMENU (MariaDB on :3307) with the JSON target.
Run after seed_fake_vmenu.py. Usage: python run_tests.py <workdir> <config>"""
import json, shutil, subprocess, sys, datetime as dt
from pathlib import Path
import pymysql

WORK, CFG = Path(sys.argv[1]), sys.argv[2]
OUT = WORK / "out"
ROOT = pymysql.connect(host="127.0.0.1", port=3307, user="root", password="", unix_socket="/tmp/mdb.sock", database="vmenu", autocommit=True)
fails = 0


def sql(q, a=()):
    with ROOT.cursor() as c:
        c.execute(q, a)
        return c.fetchall()


def run(*extra):
    p = subprocess.run([sys.executable, "vmenu_sync.py", *(extra or ("once",)), "--config", CFG, "--dry-run", str(OUT)],
                       cwd=WORK, capture_output=True, text=True)
    line = [l for l in (WORK / "logs" / "vmenu_sync.log").read_text().splitlines() if " ok " in l or "failed" in l][-1]
    return json.loads(line.split(" ok ", 1)[1]) if " ok " in line else {"error": line}


def check(name, cond, info=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + (f"  {info}" if info else ""))
    fails += 0 if cond else 1


def doc(coll, i):
    p = OUT / coll / f"{i}.json"
    return json.loads(p.read_text()) if p.exists() else None


# 0. clean slate
for p in (OUT, WORK / "cache.db", WORK / "logs"):
    shutil.rmtree(p, ignore_errors=True) if p.is_dir() else (p.unlink() if p.exists() else None)

s = run()
check("first run sends every bill", s["bills_sent"] == sql("SELECT COUNT(*) FROM svr_invoiceparent")[0][0], s)
s = run()
check("second run sends nothing (no duplicates)", s["bills_sent"] == 0 and s["days_sent"] == 0 and s["staff_sent"] == 0, s)

# 1. a new table sits down: open order with two items
now = dt.datetime(2026, 9, 16, 22, 10)
sql("INSERT INTO ord_invoiceheader (invoiceid,billno,secid,parceltype,tableno,kotno,ordtakerid,order_time,totalprice) VALUES (90001,0,2,0,7,99,2,%s,560)", (now,))
sql("INSERT INTO ord_invoicechild (invoiceid,itemname,itemquantity,itemprice,itemtotal) VALUES (90001,'ALFAHAM MANDI HALF',1,510,510),(90001,'PEPSI 750 ML',1,50,50)")
s = run()
d = doc("vm_open", "90001")
check("open order appears", s["open_now"] == 1 and d and d["status"] == "open" and d["table"] == 7 and d["section"] == "AC", s)
check("open order carries items + waiter", d and len(d["items"]) == 2 and d["taker"] == "VIVA")

# 2. add-on KOT + due bill printed
sql("UPDATE ord_invoiceheader SET running_order=%s, duebill_time=%s WHERE invoiceid=90001", (now + dt.timedelta(minutes=18), now + dt.timedelta(minutes=35)))
sql("INSERT INTO ord_invoicechild (invoiceid,itemname,itemquantity,itemprice,itemtotal,running_ord_time) VALUES (90001,'POROTTA',4,17,68,%s)", (now + dt.timedelta(minutes=18),))
s = run()
d = doc("vm_open", "90001")
check("open order updates (add-on + due bill)", s["open_sent"] == 1 and d["status"] == "due" and d["kotCount"] == 2 and len(d["items"]) == 3, s)
s = run()
check("unchanged open order is not rewritten", s["open_sent"] == 0, s)

# 3. guest pays: VMENU moves it to settled tables
sql("INSERT INTO svr_invoiceparent SELECT * FROM ord_invoiceheader WHERE invoiceid=90001")
sql("UPDATE svr_invoiceparent SET billno=51000, billingtime=%s, settlingprice=628, totalprice=628, payment_mode='UPI' WHERE invoiceid=90001", (now + dt.timedelta(minutes=41),))
sql("INSERT INTO svr_invoicechild (invoiceid,itemname,itemquantity,itemprice,itemtotal,running_ord_time) SELECT invoiceid,itemname,itemquantity,itemprice,itemtotal,running_ord_time FROM ord_invoicechild WHERE invoiceid=90001")
sql("DELETE FROM ord_invoicechild WHERE invoiceid=90001")
sql("DELETE FROM ord_invoiceheader WHERE invoiceid=90001")
s = run()
b = doc("vm_bills", "90001")
check("settled bill arrives, open order removed", s["bills_sent"] == 1 and s["open_closed"] == 1 and doc("vm_open", "90001") is None, s)
check("bill timings computed", b and b["orderToSettle"] == 41.0 and b["dueToSettle"] == 6.0 and b["kotCount"] == 2, b and (b["orderToSettle"], b["dueToSettle"]))
check("day summary refreshed", s["days_sent"] == 1 and doc("vm_days", "2026-09-16")["bills"] >= 1, s)

# 4. a settled bill is corrected in VMENU (within the overlap window)
sql("UPDATE svr_invoiceparent SET totalprice=600 WHERE invoiceid=90001")
s = run()
check("corrected bill is re-sent", s["bills_sent"] == 1 and doc("vm_bills", "90001")["total"] == 600, s)

# 5. roles: set on this PC (the Staff page), survive VMENU renames, copied to Firebase
import sqlite3
db = sqlite3.connect(str(WORK / "cache.db"))
db.execute("UPDATE roles SET role='waiter' WHERE id='vm2'"); db.commit(); db.close()
sql("UPDATE svr_employeeparent SET employeename='VIVA K' WHERE employeeid=2")
s = run()
st = doc("vm_staff", "vm2")
check("staff rename keeps the role set in the office", st["name"] == "VIVA K" and st["role"] == "waiter", st)
check("cashier gets its own role", doc("vm_staff", "vm1")["role"] == "cashier")

# 6. VMENU unreachable: run fails cleanly and says so in the heartbeat
bad = Path(CFG).read_text().replace("port = 3307", "port = 3399")
Path(WORK / "bad.ini").write_text(bad)
subprocess.run([sys.executable, "vmenu_sync.py", "once", "--config", str(WORK / "bad.ini"), "--dry-run", str(OUT)], cwd=WORK, capture_output=True)
m = doc("vm_meta", "sync")
check("outage is reported in vm_meta/sync", m and m.get("lastError") and "3399" in m["lastError"] or "Can't connect" in (m.get("lastError") or ""))
s = run()
check("next good run clears the error", doc("vm_meta", "sync").get("lastError") is None and s["bills_sent"] == 0, s)

# 7. clean-up of old bills (off by default)
Path(WORK / "ret.ini").write_text(Path(CFG).read_text() + "\nretention_months = 0\n")
keep = (dt.date.today() - dt.date(2026, 9, 15)).days
ret = Path(CFG).read_text().replace("[sync]", f"[sync]\nretention_days = {keep}")
Path(WORK / "ret.ini").write_text(ret)
before = len(list((OUT / "vm_bills").glob("*.json")))
subprocess.run([sys.executable, "vmenu_sync.py", "once", "--config", str(WORK / "ret.ini"), "--dry-run", str(OUT)], cwd=WORK, capture_output=True)
after = len(list((OUT / "vm_bills").glob("*.json")))
check("retention deletes bills older than the limit, keeps day summaries", after < before and len(list((OUT / "vm_days").glob("*.json"))) >= 4, (before, after))

print("\n" + ("ALL PASSED" if not fails else f"{fails} FAILED"))
sys.exit(1 if fails else 0)
