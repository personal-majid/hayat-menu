#!/usr/bin/env python3
"""
Hayat day log - one JSON per business day, every bill's whole life inside.

    daylog/2026-09-26.json          on this PC
    vm_daylog/2026-09-26            in Firebase, the same records

A record is one KOT / bill and carries everything VMENU knows about it:
when it was created (first KOT), every KOT printed after, table, section,
waiter, cashier, pax, the items with their kitchen and KOT time, every
edit or void, table moves and joins, the due bill, settlement and how it
was paid. Open tables are in the log while they eat; when the bill is
settled the same record simply gains its settled fields.

Every run (2 min) reads the day again and appends only what changed -
locally into the day file, and in Firebase with a merge into the same
document. Nothing is ever rewritten wholesale, nothing is deleted.

    python daylog.py tick                       today (what the task runs)
    python daylog.py day 2026-09-25             one past day
    python daylog.py backfill --since 2026-09-06   several past days
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import logging
import logging.handlers
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import vmenu_sync as VS                      # config, Source (MariaDB), helpers - their code, unchanged

LOG = logging.getLogger("hayat.daylog")
OUT = HERE / "daylog"

KIND = {0: "dine", 1: "vpos", 2: "catering", 3: "counter", 4: "delivery"}
PAY = {1: "cash", 2: "card", 3: "credit", 4: "multi"}


# ---------------------------------------------------------------- small helpers

def iso(v):
    """datetimes to 'YYYY-MM-DD HH:MM:SS' shop time; None stays None."""
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        if v.year < 2000:
            return None
        return v.strftime("%Y-%m-%d %H:%M:%S")
    s = str(v).strip()
    return s[:19] if len(s) >= 19 and s[4] == "-" else (s or None)


def n(v):
    return VS.num(v)


def day_bounds(day: str, start_hour: int):
    d = dt.datetime.strptime(day, "%Y-%m-%d").replace(hour=start_hour)
    return d, d + dt.timedelta(days=1)


def today_business(start_hour: int) -> str:
    now = dt.datetime.now()
    if now.hour < start_hour:
        now -= dt.timedelta(days=1)
    return now.strftime("%Y-%m-%d")


def rec_hash(r: dict) -> str:
    body = {k: v for k, v in r.items() if k not in ("ver", "updated", "seen")}
    return hashlib.sha1(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()[:16]


# ---------------------------------------------------------------- masters (read once per run)

class Masters:
    def __init__(self, src):
        q = src.q
        self.items = {}
        if src.has("svr_itemparent"):
            for r in q("SELECT basebarcode AS i, itemname AS n, kitchenid AS k, categoryid AS c FROM svr_itemparent"):
                self.items[str(r["i"])] = r
        self.kitchens = {str(r["kitchenid"]): r["kitchenname"] for r in q("SELECT kitchenid, kitchenname FROM svr_kitchenparent")} if src.has("svr_kitchenparent") else {}
        self.cats = {str(r["categoryid"]): r["categoryname"] for r in q("SELECT categoryid, categoryname FROM svr_categoryparent")} if src.has("svr_categoryparent") else {}
        self.staff = {str(r["employeeid"]): r["employeename"] for r in q("SELECT employeeid, employeename FROM svr_employeeparent")} if src.has("svr_employeeparent") else {}
        self.sections = {str(r["sectionid"]): r["sectionname"] for r in q("SELECT sectionid, sectionname FROM svr_sectionparent")} if src.has("svr_sectionparent") else {}
        self.reasons = {str(r["reasonid"]): r["reasoncode"] for r in q("SELECT reasonid, reasoncode FROM svr_reasonparent")} if src.has("svr_reasonparent") else {}
        self.tables = {}
        if src.has("svr_tableparent"):
            for r in q("SELECT tableid, tableno, sectionid, chair_count, locationx, locationy, sts FROM svr_tableparent"):
                self.tables[str(r["tableid"])] = r

    def who(self, i):
        return self.staff.get(str(i)) if i not in (None, 0, "0", "") else None

    def item(self, i):
        r = self.items.get(str(i))
        if not r:
            return {"n": f"item {i}", "kit": None, "cat": None}
        return {"n": r["n"], "kit": self.kitchens.get(str(r["k"])) or (str(r["k"]) if r["k"] else None),
                "cat": self.cats.get(str(r["c"]))}

    def table(self, tid, section_id=None):
        """VMENU stores the table NUMBER within a section on orders; the master has ids.
        Match on tableno text within the section when we can, else by id."""
        if tid in (None, 0, "0", ""):
            return None
        for r in self.tables.values():
            if section_id is not None and str(r["sectionid"]) != str(section_id):
                continue
            if str(r["tableno"]).strip() == str(tid).strip() or str(r["tableid"]) == str(tid):
                return r
        r = self.tables.get(str(tid))
        return r


# ---------------------------------------------------------------- one day, from the database

def read_day(src, m: Masters, day: str, start_hour: int, with_open: bool) -> dict:
    lo, hi = day_bounds(day, start_hour)
    q = src.q
    recs = {}

    # ---- settled bills of the day
    bills = q("SELECT * FROM svr_invoiceparent WHERE billingtime >= %s AND billingtime < %s", (lo, hi))
    ids = [b["invoiceid"] for b in bills]
    lines = {}
    for chunk in (ids[i:i + 500] for i in range(0, len(ids), 500)):
        marks = ",".join(["%s"] * len(chunk))
        for r in q(f"SELECT * FROM svr_invoicechild WHERE invoiceid IN ({marks})", chunk):
            lines.setdefault(str(r["invoiceid"]), []).append(r)
    for b in bills:
        key = f"k{b['kotno']}" if b.get("kotno") else f"i{b['invoiceid']}"
        items, kot_times = [], set()
        for l in lines.get(str(b["invoiceid"]), []):
            it = m.item(l.get("itemcode"))
            kt = iso(l.get("running_ord_time")) or iso(l.get("ord_time"))
            if kt:
                kot_times.add(kt)
            items.append({"id": l.get("itemcode"), "n": it["n"], "kit": it["kit"], "cat": it["cat"],
                          "q": n(l.get("itemquantity")), "p": n(l.get("itemprice")),
                          "a": n((l.get("itemquantity") or 0) * (l.get("itemprice") or 0)),
                          "kotAt": kt, "servedAt": iso(l.get("foodserve_time"))})
        created = iso(b.get("order_time"))
        kots = sorted({t for t in [created, iso(b.get("running_order"))] + list(kot_times) if t})
        tbl = m.table(b.get("tablename"), b.get("secid"))
        recs[key] = {
            "key": key, "kot": n(b.get("kotno")), "invoiceId": b["invoiceid"], "billNo": n(b.get("billno")),
            "status": "settled",
            "kind": KIND.get(n(b.get("type")), "dine") if n(b.get("type")) is not None else "dine",
            "parcelType": b.get("parceltype"),
            "section": m.sections.get(str(b.get("secid"))), "sectionId": n(b.get("secid")),
            "table": (tbl or {}).get("tableno") or b.get("tablename"), "chairs": n((tbl or {}).get("chair_count")),
            "pax": n(b.get("pax")),
            "waiter": m.who(b.get("ordtakerid")), "waiterId": n(b.get("ordtakerid")),
            "cashier": m.who(b.get("empid")), "cashierId": n(b.get("empid")), "counter": n(b.get("counterid")),
            "createdAt": created, "kots": kots, "kotCount": len(kots),
            "dueAt": iso(b.get("duebill_time")), "settledAt": iso(b.get("billingtime")),
            "payMode": PAY.get(n(b.get("payment_mode"))), "cash": n(b.get("cash_amount")), "card": n(b.get("card_amount")),
            "credit": n(b.get("credit_amount")), "total": n(b.get("totalprice")), "paid": n(b.get("settlingprice")),
            "discount": n(b.get("discount_cash")) or n(b.get("gstdiscount")),
            "token": n(b.get("token_no")) or n(b.get("tabletokenno")),
            "customer": {"name": (b.get("cus_name") or "").strip() or None, "address": (b.get("cus_address") or "").strip() or None},
            "remarks": (b.get("remarks") or "").strip() or None,
            "items": items, "edits": [], "moves": [], "joins": [],
        }

    # ---- tables still open (only meaningful for today)
    if with_open and src.has("ord_invoiceheader"):
        opens = q("SELECT * FROM ord_invoiceheader")
        tids = [o["transactionid"] for o in opens]
        olines = {}
        if tids:
            marks = ",".join(["%s"] * len(tids))
            for r in q(f"SELECT * FROM ord_invoicechild WHERE transactionid IN ({marks})", tids):
                olines.setdefault(str(r["transactionid"]), []).append(r)
        for o in opens:
            key = f"k{o['transactionid']}"
            if key in recs:
                continue                      # already settled in this same run
            items, kot_times, ready = [], set(), 0
            for l in olines.get(str(o["transactionid"]), []):
                it = m.item(l.get("barcode"))
                kt = iso(l.get("child_runningorder_time")) or iso(l.get("child_order_time"))
                if kt:
                    kot_times.add(kt)
                st = l.get("screenstatus")
                if st == "F":
                    ready += 1
                items.append({"id": l.get("barcode"), "n": it["n"], "kit": it["kit"], "cat": it["cat"],
                              "q": n(l.get("quantity")), "p": n(l.get("unitprice")),
                              "a": n((l.get("quantity") or 0) * (l.get("unitprice") or 0)),
                              "kotAt": kt, "ready": {"N": "new", "F": "ready", "R": "rejected"}.get(st, st),
                              "chef": m.who(l.get("chef_id")), "servedAt": iso(l.get("foodserve_time"))})
            created = iso(o.get("order_time"))
            kots = sorted({t for t in [created, iso(o.get("running_order"))] + list(kot_times) if t})
            tbl = m.table(o.get("tableno"), o.get("sectionid"))
            pt = o.get("parceltype")
            kind = "delivery" if (n(o.get("deliveryboy")) or n(o.get("takeawaytype")) == 4) else \
                   ("counter" if (pt == "Q" or n(o.get("quickparcel")) == 1) else "dine")
            recs[key] = {
                "key": key, "kot": o["transactionid"], "invoiceId": None, "billNo": None,
                "status": "due" if o.get("duebill_time") else "open",
                "kind": kind, "parcelType": pt,
                "section": m.sections.get(str(o.get("sectionid"))), "sectionId": n(o.get("sectionid")),
                "table": (tbl or {}).get("tableno") or o.get("tableno"), "chairs": n((tbl or {}).get("chair_count")),
                "pax": n(o.get("pax")),
                "waiter": m.who(o.get("staffid")), "waiterId": n(o.get("staffid")),
                "cashier": None, "cashierId": None, "counter": n(o.get("counterid")),
                "createdAt": created, "kots": kots, "kotCount": len(kots),
                "dueAt": iso(o.get("duebill_time")), "dueCount": n(o.get("duebill_count")),
                "billPrinted": bool(n(o.get("isprintbill"))), "settledAt": None,
                "payMode": None, "cash": None, "card": None, "credit": None, "total": None, "paid": None,
                "token": n(o.get("tokenno")) or n(o.get("tabletokenno")),
                "customer": {"name": (o.get("cus_name") or "").strip() or None, "phone": (o.get("cus_mobileno") or "").strip() or None,
                             "address": (o.get("cus_address") or "").strip() or None},
                "rider": m.who(o.get("deliveryboy")), "dispatchAt": iso(o.get("dispatchtime")), "dispatch": o.get("dispatch_sts"),
                "foodReady": ready, "remarks": (o.get("comments") or "").strip() or None,
                "items": items, "edits": [], "moves": [], "joins": [],
            }

    # ---- edits / voids, table moves, joins of the day, attached by KOT number
    def attach(kot, field, ev):
        r = recs.get(f"k{kot}")
        if r is not None:
            r[field].append(ev)
    if src.has("ord_voiddetails"):
        for v in q("SELECT * FROM ord_voiddetails WHERE entrydate >= %s AND entrydate < %s ORDER BY entrydate", (lo, hi)):
            it = m.item(v.get("itemid"))
            attach(v.get("invoiceid"), "edits", {
                "at": iso(v.get("entrydate")), "item": it["n"], "from": n(v.get("oldqty")), "to": n(v.get("newqty")),
                "price": n(v.get("price")), "reason": m.reasons.get(str(v.get("reasonid"))),
                "by": m.who(v.get("employeeid")), "remarks": (v.get("remarks") or "").strip() or None,
                "void": bool(n(v.get("del_sts")))})
    if src.has("table_tranfer_log"):
        for t in q("SELECT * FROM table_tranfer_log WHERE entrydatetime >= %s AND entrydatetime < %s", (str(lo), str(hi))):
            a, b = m.tables.get(str(t.get("oldtableid"))), m.tables.get(str(t.get("newtableid")))
            attach(t.get("kotno"), "moves", {
                "at": iso(t.get("entrydatetime")),
                "from": (a or {}).get("tableno") or t.get("oldtableid"), "to": (b or {}).get("tableno") or t.get("newtableid"),
                "fromSection": m.sections.get(str(t.get("oldsectionid"))), "toSection": m.sections.get(str(t.get("newsectionid"))),
                "by": m.who(t.get("donebyempid"))})
    if src.has("ord_join_master"):
        for j in q("SELECT * FROM ord_join_master WHERE donetime >= %s AND donetime < %s", (lo, hi)):
            ev = {"at": iso(j.get("donetime")), "fromKot": j.get("frombill"), "toKot": j.get("tobill"),
                  "fromTable": j.get("oldtbno"), "toTable": j.get("newtbno"), "by": m.who(j.get("donebyid"))}
            attach(j.get("frombill"), "joins", ev)
            attach(j.get("tobill"), "joins", ev)

    for r in recs.values():
        r["ver"] = rec_hash(r)
    return recs


# ---------------------------------------------------------------- the day file + Firebase

def load_local(day: str) -> dict:
    p = OUT / f"{day}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            LOG.warning("day file unreadable, starting fresh: %s", p)
    return {"day": day, "records": {}, "updatedAt": None}


def save_local(doc: dict):
    OUT.mkdir(exist_ok=True)
    p = OUT / f"{doc['day']}.json"
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
    tmp.replace(p)


def firestore(cfg):
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    key = HERE / cfg.get("firebase", "key_file", fallback="firebase-key.json")
    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app(credentials.Certificate(str(key)), {"projectId": cfg.get("firebase", "project_id")})
        except ValueError:
            pass
    return fs.client()


def run_day(cfg, src, m, day: str, db, with_open: bool) -> dict:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fresh = read_day(src, m, day, cfg.getint("vmenu", "day_start_hour", fallback=5), with_open)
    doc = load_local(day)
    have = doc["records"]
    changed = {}
    for key, r in fresh.items():
        old = have.get(key)
        if old and old.get("ver") == r["ver"]:
            continue
        r["seen"] = (old or {}).get("seen") or now
        r["updated"] = now
        have[key] = r
        changed[key] = r
    # an open table that vanished without a bill: keep it, say so
    if with_open:
        for key, r in have.items():
            if r.get("status") in ("open", "due") and key not in fresh:
                r["status"] = "gone"
                r["updated"] = now
                changed[key] = r
    settled = sum(1 for r in have.values() if r.get("status") == "settled")
    doc.update({"updatedAt": now, "count": len(have), "settled": settled,
                "open": sum(1 for r in have.values() if r.get("status") in ("open", "due")),
                "revenue": round(sum((r.get("total") or 0) for r in have.values() if r.get("status") == "settled"), 2)})
    save_local(doc)
    if changed and db is not None:
        payload = {"day": day, "updatedAt": now, "count": doc["count"], "settled": doc["settled"], "open": doc["open"],
                   "revenue": doc["revenue"], "records": changed}
        db.collection("vm_daylog").document(day).set(payload, merge=True)
    LOG.info("day %s: %d records, %d changed, %d settled, %d open", day, len(have), len(changed), settled, doc["open"])
    return {"day": day, "records": len(have), "changed": len(changed), "settled": settled, "open": doc["open"]}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["tick", "day", "backfill"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--since")
    ap.add_argument("--config", default=str(HERE / "config.ini"))
    ap.add_argument("--no-upload", action="store_true")
    a = ap.parse_args(argv[1:])

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    (HERE / "logs").mkdir(exist_ok=True)
    fh = logging.handlers.RotatingFileHandler(HERE / "logs" / "daylog.log", maxBytes=500_000, backupCount=2, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOG.addHandler(fh)

    cfg = VS.load_config(Path(a.config))
    start_hour = cfg.getint("vmenu", "day_start_hour", fallback=5)
    src = VS.Source(cfg)
    m = Masters(src)
    db = None if a.no_upload else firestore(cfg)
    try:
        if a.cmd == "tick":
            print(run_day(cfg, src, m, today_business(start_hour), db, True))
        elif a.cmd == "day":
            day = a.arg or today_business(start_hour)
            print(run_day(cfg, src, m, day, db, day == today_business(start_hour)))
        else:
            since = dt.datetime.strptime(a.since or a.arg, "%Y-%m-%d").date()
            today = dt.datetime.strptime(today_business(start_hour), "%Y-%m-%d").date()
            d = since
            while d <= today:
                day = d.strftime("%Y-%m-%d")
                print(run_day(cfg, src, m, day, db, day == today.strftime("%Y-%m-%d")))
                d += dt.timedelta(days=1)
                time.sleep(0.2)
    finally:
        src.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
