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

Purchases of the day (supplier, bill, every line with cost and quantity)
sit beside the bills in the same file under "purchases". Counter entries
(the quick daily purchase, a supplier payment, an expense) land under
"payments" the minute they are typed - no waiting for a supplier bill.

Every run (1 min) reads the day again and appends only what changed -
locally into the day file, and in Firebase with a merge into the same
document. Nothing is ever rewritten wholesale, nothing is deleted.

    python daylog.py tick                       today (what the task runs)
    python daylog.py day 2026-09-25             one past day
    python daylog.py backfill --since 2026-09-06   several past days
    python daylog.py check                      local files vs Firebase
    python daylog.py sync                       redo only days missing/different online
"""
from __future__ import annotations

import argparse
import os
import threading
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
import re
# What the counter writes on an order tells us what it really is:
#   DM, HD, "delivery", "home delivery", "deliver to ..."   -> home delivery
#   CO, C/O, "parcel", "take away", "takeaway", "pack"        -> packed, collected at the counter
DELIVERY_WORDS = re.compile(r"(^|[^A-Z0-9])(DM|HD|H\.D|DELIVER\w*|HOME ?DEL\w*)([^A-Z0-9]|$)", re.I)
COUNTER_WORDS = re.compile(r"(^|[^A-Z0-9])(CO|C/O|C\.O|PARCEL|TAKE ?AWAY|TA|PACK\w*|PARCE\w*)([^A-Z0-9]|$)", re.I)


def note_kind(*texts):
    """delivery / counter / None, from the free text on the order"""
    for t in texts:
        if t and DELIVERY_WORDS.search(str(t)):
            return "delivery"
    for t in texts:
        if t and COUNTER_WORDS.search(str(t)):
            return "counter"
    return None


def is_dm(*texts) -> bool:
    return note_kind(*texts) == "delivery"
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
        self.store = {}
        if src.has("svr_inv_store_items_child"):
            for r in q("SELECT id AS i, itemname AS n, categoryid AS c, baseunitid AS u FROM svr_inv_store_items_child"):
                self.store[str(r["i"])] = r
        self.storecats = {str(r["id"]): r["categoryname"] for r in q("SELECT id, categoryname FROM svr_inv_store_item_parent")} if src.has("svr_inv_store_item_parent") else {}
        self.units = {str(r["id"]): r["baseunitname"] for r in q("SELECT id, baseunitname FROM svr_inv_baseuniparent")} if src.has("svr_inv_baseuniparent") else {}
        self.suppliers = {str(r["supplerid"]): r["supplername"] for r in q("SELECT supplerid, supplername FROM svr_supplerparent")} if src.has("svr_supplerparent") else {}
        self.supplier_by_ac = {str(r["acid"]): r["supplername"] for r in q("SELECT acid, supplername FROM svr_supplerparent") if r.get("acid")} if src.has("svr_supplerparent") else {}
        # the accounts book: every party (supplier, staff, expense head, cash, bank)
        self.groups = {str(r["groupid"]): r["groupname"] for r in q("SELECT groupid, groupname FROM act_groupparent")} if src.has("act_groupparent") else {}
        self.ledgers = {}
        if src.has("act_ledger_parent"):
            for r in q("SELECT accountid AS i, ledgername AS n, groupid AS g FROM act_ledger_parent"):
                self.ledgers[str(r["i"])] = r
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

    def pitem(self, i, typ=None):
        """a purchase line: a store item (raw material) or a menu item"""
        r = self.store.get(str(i))
        if r:
            return {"n": r["n"], "cat": self.storecats.get(str(r["c"])), "unit": self.units.get(str(r["u"]))}
        m = self.items.get(str(i))
        if m:
            return {"n": m["n"], "cat": self.cats.get(str(m["c"])), "unit": None}
        return {"n": f"item {i}", "cat": None, "unit": None}

    def ledger(self, i):
        r = self.ledgers.get(str(i))
        if not r:
            return (f"account {i}" if i not in (None, 0, "0", "") else None), None
        return r["n"], self.groups.get(str(r["g"]))

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
        sec = m.sections.get(str(b.get("secid"))) or ""
        t = n(b.get("type"))
        # VMENU stamps type=0 on nearly everything; the parcel flag and the
        # PARCEL section say what it really was
        noted = note_kind(b.get("remarks"), b.get("cus_address"))
        kind = "delivery" if (t == 4 or noted == "delivery") else "catering" if t == 2 else \
               "counter" if (t == 3 or noted == "counter" or b.get("parceltype") == "Q" or "PARCEL" in sec.upper()) else "dine"
        recs[key] = {
            "key": key, "kot": n(b.get("kotno")), "invoiceId": b["invoiceid"], "billNo": n(b.get("billno")),
            "status": "settled",
            "kind": kind,
            "parcelType": b.get("parceltype"),
            "section": sec or None, "sectionId": n(b.get("secid")),
            "table": ((tbl or {}).get("tableno") or b.get("tablename")) if kind == "dine" else None,
            "chairs": n((tbl or {}).get("chair_count")) if kind == "dine" else None,
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
            osec = m.sections.get(str(o.get("sectionid"))) or ""
            noted = note_kind(o.get("comments"), o.get("cus_address"), o.get("cus_name"))
            kind = "delivery" if (n(o.get("deliveryboy")) or n(o.get("takeawaytype")) == 4 or noted == "delivery") else \
                   ("counter" if (noted == "counter" or pt == "Q" or n(o.get("quickparcel")) == 1 or "PARCEL" in osec.upper()) else "dine")
            recs[key] = {
                "key": key, "kot": o["transactionid"], "invoiceId": None, "billNo": None,
                "status": "due" if o.get("duebill_time") else "open",
                "kind": kind, "parcelType": pt,
                "section": osec or None, "sectionId": n(o.get("sectionid")),
                "table": ((tbl or {}).get("tableno") or o.get("tableno")) if kind == "dine" else None,
                "chairs": n((tbl or {}).get("chair_count")) if kind == "dine" else None,
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


def read_purchases(src, m: Masters, day: str, start_hour: int) -> dict:
    """What came in today: every purchase bill with its lines."""
    lo, hi = day_bounds(day, start_hour)
    q = src.q
    out = {}
    if not src.has("svr_inv_purchase_item_parent"):
        return out
    heads = q("SELECT * FROM svr_inv_purchase_item_parent WHERE donetime >= %s AND donetime < %s", (lo, hi))
    ids = [h["id"] for h in heads]
    lines = {}
    if ids and src.has("svr_inv_purchase_item_details"):
        marks = ",".join(["%s"] * len(ids))
        for r in q(f"SELECT * FROM svr_inv_purchase_item_details WHERE purid IN ({marks})", ids):
            lines.setdefault(str(r["purid"]), []).append(r)
    for h in heads:
        items = []
        for l in lines.get(str(h["id"]), []):
            it = m.pitem(l.get("itemid"), l.get("type"))
            items.append({"id": l.get("itemid"), "n": it["n"], "cat": it["cat"],
                          "unit": m.units.get(str(l.get("baseunitid"))) or it["unit"],
                          "q": n(l.get("quantity")), "cost": n(l.get("unitcoast")), "total": n(l.get("ptotal")),
                          "foc": n(l.get("foc")), "tax": n(l.get("pur_taxper")), "kitchen": m.kitchens.get(str(l.get("kitchid")))})
        key = f"p{h['id']}"
        rec = {
            "key": key, "id": h["id"], "at": iso(h.get("donetime")), "billNo": (str(h.get("bill_no") or "").strip() or None),
            "supplier": m.supplier_by_ac.get(str(h.get("supacid"))) or m.suppliers.get(str(h.get("supacid"))) or (f"supplier {h.get('supacid')}" if h.get("supacid") else None),
            "by": m.who(h.get("doneby")), "total": n(h.get("Bill_total")), "discount": n(h.get("billdisc")) or n(h.get("discount")),
            "gst": n(h.get("gst_totalinc")) or n(h.get("gst_totalexc")), "delivery": n(h.get("deliverychrg")),
            "due": iso(h.get("duedate")), "remarks": (str(h.get("remarks") or "").strip() or None),
            "lines": len(items), "items": items,
        }
        rec["ver"] = rec_hash(rec)
        out[key] = rec
    return out


def read_payments(src, m: Masters, day: str, start_hour: int) -> dict:
    """Money entered at the counter the moment it is typed: the daily
    purchase entries (ONION, DAILY KITCHEN VEGITABLE...), supplier payments,
    expenses, credit receipts. Everything in the accounts book that is not a
    POS sale (the bills already carry those). Deleted entries stay, marked."""
    lo, hi = day_bounds(day, start_hour)
    q = src.q
    out = {}
    if not src.has("act_paymentorrecipt"):
        return out

    def build(r, deleted=None):
        act = str(r.get("acttype") or "").upper()
        typ = str(r.get("transaction_type") or "").upper()
        flow = "out" if (act.endswith("OUT") or "PURCHASE" in act or "EXPENSE" in typ or "SALARY" in typ) else ("in" if act.endswith("IN") or "RECEIPT" in typ or "SALE" in act else "other")
        kind = ("purchase" if "PURCHASE" in typ or "PURCHASE" in act else "salary" if "SALARY" in typ else "expense" if "EXPENSE" in typ
                else "receipt" if flow == "in" else "payment")
        mode = "credit" if "CREDIT" in act else "bank" if "BANK" in act else "cash" if "CASH" in act else None
        cn, cg = m.ledger(r.get("creditaccountid"))
        dn, dg = m.ledger(r.get("dabitaccountid"))
        key = f"t{r['transactionid']}"
        rec = {
            "key": key, "id": r["transactionid"], "at": iso(r.get("transactiondate")), "kind": kind, "flow": flow, "mode": mode,
            "act": act or None, "type": typ or None, "amount": n(r.get("amount")), "discount": n(r.get("bill_discount")),
            "party": cn if flow == "out" else dn, "credit": cn, "creditGroup": cg, "debit": dn, "debitGroup": dg,
            "remarks": (str(r.get("remarks") or "").strip() or None), "ref": (str(r.get("referenceno") or "").strip() or None),
            "invoiceId": r.get("invoiceid") or None, "by": m.who(r.get("donebyid")),
        }
        if deleted:
            rec["deleted"] = deleted
        rec["ver"] = rec_hash(rec)
        return rec

    for r in q("SELECT * FROM act_paymentorrecipt WHERE transactiondate >= %s AND transactiondate < %s "
               "AND (transaction_type IS NULL OR transaction_type NOT LIKE 'POS%%')", (lo, hi)):
        rec = build(r)
        out[rec["key"]] = rec
    if src.has("paymentorrecipt_delentries"):
        for r in q("SELECT * FROM paymentorrecipt_delentries WHERE transactiondate >= %s AND transactiondate < %s "
                   "AND (transaction_type IS NULL OR transaction_type NOT LIKE 'POS%%')", (lo, hi)):
            rec = build(r, iso(r.get("deldatetime")))
            out[rec["key"]] = rec
    return out


def read_drafts(src, m: Masters) -> dict:
    """A purchase still on the entry screen - typed, not yet saved with a
    supplier and due date. VMENU parks it in temp tables; we show it at once."""
    q = src.q
    out = {}
    heads = {}
    if src.has("temp_inv_purchase_item_parent"):
        for h in q("SELECT * FROM temp_inv_purchase_item_parent"):
            heads[str(h.get("id"))] = h
    if src.has("temp_purchase_data_parent"):
        for h in q("SELECT * FROM temp_purchase_data_parent"):
            heads.setdefault(str(h.get("pur_id") or h.get("id")), {"id": h.get("id"), "supacid": h.get("supplier_id"), "doneby": h.get("emp_id"),
                                                                     "donetime": h.get("LastUpdated") or h.get("date"), "bill_no": h.get("bill_no"),
                                                                     "Bill_total": h.get("bill_amount") or h.get("net_amount"), "remarks": h.get("description"), "duedate": h.get("duedate")})
    lines = {}
    if src.has("temp_purchase"):
        for l in q("SELECT * FROM temp_purchase"):
            k = str(l.get("purchaseid") or l.get("doneid") or l.get("userid") or 0)
            lines.setdefault(k, []).append({"id": l.get("itemid"), "n": (l.get("itemname") or m.pitem(l.get("itemid"))["n"]),
                                            "unit": m.units.get(str(l.get("baseunitid"))), "q": n(l.get("qty")), "cost": n(l.get("unitprice")),
                                            "total": round(n(l.get("qty")) * n(l.get("unitprice")), 2), "foc": n(l.get("foc")), "by": m.who(l.get("userid"))})
    if src.has("temp_inv_purchase_item_details"):
        for l in q("SELECT * FROM temp_inv_purchase_item_details"):
            it = m.pitem(l.get("itemid"), l.get("type"))
            lines.setdefault(str(l.get("purid") or 0), []).append({"id": l.get("itemid"), "n": it["n"], "unit": m.units.get(str(l.get("baseunitid"))) or it["unit"],
                                                                   "q": n(l.get("quantity")), "cost": n(l.get("unitcoast")), "total": n(l.get("ptotal")), "foc": n(l.get("foc"))})
    for k in set(heads) | set(lines):
        h, items = heads.get(k, {}), lines.get(k, [])
        if not h and not items:
            continue
        rec = {"key": f"d{k}", "id": k, "at": iso(h.get("donetime") or h.get("LastUpdated")) or dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
               "supplier": m.supplier_by_ac.get(str(h.get("supacid"))) or m.suppliers.get(str(h.get("supacid"))) if h.get("supacid") else None,
               "by": m.who(h.get("doneby")) or next((i.get("by") for i in items if i.get("by")), None), "billNo": (str(h.get("bill_no") or "").strip() or None),
               "total": n(h.get("Bill_total")) or round(sum(i["total"] or 0 for i in items), 2), "due": iso(h.get("duedate")),
               "remarks": (str(h.get("remarks") or "").strip() or None), "lines": len(items), "items": items}
        out[rec["key"]] = rec
    return out


# ---------------------------------------------------------------- the day file + Firebase

def load_local(day: str) -> dict:
    p = OUT / f"{day}.json"
    for cand in (p, p.with_suffix(".bak")):
        if cand.exists():
            try:
                d = json.loads(cand.read_text(encoding="utf-8"))
                if cand is not p:
                    LOG.warning("day file unreadable, using the .bak: %s", cand)
                return d
            except Exception:
                LOG.warning("unreadable: %s", cand)
    return {"day": day, "records": {}, "updatedAt": None}


def save_local(doc: dict):
    OUT.mkdir(exist_ok=True)
    p = OUT / f"{doc['day']}.json"
    tmp = p.with_suffix(".json.tmp")
    body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), default=str)
    tmp.write_text(body, encoding="utf-8")
    json.loads(tmp.read_text(encoding="utf-8"))            # what landed on disk must parse before it replaces anything
    if p.exists():
        try:
            p.replace(p.with_suffix(".bak"))                # yesterday's copy of this file survives one bad write
        except OSError:
            pass
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


CARRY = ("rider", "dispatchAt", "dispatch", "foodReady", "dueCount", "billPrinted", "token")
STAFF_MAX = 200          # a CASHIER bill this small is staff food - not a customer


def is_staff(r) -> bool:
    return "CASHIER" in str(r.get("waiter") or "").upper() and (r.get("total") or 0) <= STAFF_MAX


def closure(have: dict) -> dict:
    """Average minutes from order to paid, per section, plus delivery and
    counter - the day's number for the trend line. Staff bills and anything
    over 10 h (a credit bill cleared days later) are left out."""
    def mins(a, b):
        try:
            return (dt.datetime.strptime(b, "%Y-%m-%d %H:%M:%S") - dt.datetime.strptime(a, "%Y-%m-%d %H:%M:%S")).total_seconds() / 60
        except Exception:
            return None
    buckets = {}
    for r in have.values():
        if r.get("status") != "settled" or is_staff(r):
            continue
        k = r.get("section") if r.get("kind") == "dine" else ("Delivery" if r.get("kind") == "delivery" else "Counter" if r.get("kind") == "counter" else None)
        t = mins(r.get("createdAt"), r.get("settledAt"))
        if k and t is not None and 0 <= t <= 600:
            buckets.setdefault(k, []).append(t)
    return {k: round(sum(v) / len(v)) for k, v in buckets.items() if v}


def hourly(have: dict, start_hour: int = 5) -> list:
    """Sales per business hour (index 0 = start_hour) - the owner board's
    'by this hour yesterday' comes from this without reading old days."""
    H = [0.0] * 24
    for r in have.values():
        if r.get("status") != "settled":
            continue
        try:
            h = int(str(r.get("settledAt"))[11:13])
        except Exception:
            continue
        H[(h - start_hour) % 24] += r.get("total") or 0
    return [round(x, 2) for x in H]


MASTERS_SENT = None
def push_masters(db, m: Masters):
    """The floor: every table with its chairs, section and position, plus the
    kitchens and staff - one small doc the owner page draws the room from."""
    global MASTERS_SENT
    doc = {
        "tables": [{"id": r["tableid"], "name": r["tableno"], "section": m.sections.get(str(r["sectionid"])),
                    "sectionId": r["sectionid"], "chairs": n(r["chair_count"]), "x": n(r["locationx"]), "y": n(r["locationy"]),
                    "active": r.get("sts") == "A"} for r in m.tables.values()],
        "sections": m.sections, "kitchens": m.kitchens, "staff": m.staff,
        "updatedAt": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    sig = hashlib.sha1(json.dumps({k: v for k, v in doc.items() if k != "updatedAt"}, sort_keys=True, default=str).encode()).hexdigest()
    if sig == MASTERS_SENT:
        return
    db.collection("vm_meta").document("floor").set(doc, timeout=30)
    MASTERS_SENT = sig


def run_day(cfg, src, m, day: str, db, with_open: bool) -> dict:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fresh = read_day(src, m, day, cfg.getint("vmenu", "day_start_hour", fallback=5), with_open)
    doc = load_local(day)
    have = doc["records"]
    havep = doc.setdefault("purchases", {})
    havet = doc.setdefault("payments", {})
    changedp, changedt = {}, {}
    # spends move slowly: read them every 5 minutes on the live tick, always on a rebuild
    last_spend = doc.get("spendAt")
    spend_due = (not with_open) or not last_spend or (dt.datetime.now() - dt.datetime.strptime(last_spend, "%Y-%m-%d %H:%M:%S")).total_seconds() >= 270
    purchases = read_purchases(src, m, day, cfg.getint("vmenu", "day_start_hour", fallback=5)) if spend_due else dict(havep)
    payments = read_payments(src, m, day, cfg.getint("vmenu", "day_start_hour", fallback=5)) if spend_due else {k: v for k, v in havet.items() if not v.get("deleted")}
    drafts = read_drafts(src, m) if (spend_due and with_open) else None
    if spend_due:
        doc["spendAt"] = now
    if drafts is not None and drafts != doc.get("drafts", {}):
        doc["drafts"] = drafts
        doc["draftTotal"] = round(sum((d.get("total") or 0) for d in drafts.values()), 2)
        changedp["_drafts"] = True                                  # flag: the drafts map goes up with this tick
    for key, r in purchases.items():
        old = havep.get(key)
        if old and old.get("ver") == r["ver"]:
            continue
        r["updated"] = now
        havep[key] = r
        changedp[key] = r
    for key, r in payments.items():
        old = havet.get(key)
        if old and old.get("ver") == r["ver"]:
            continue
        r["updated"] = now
        havet[key] = r
        changedt[key] = r
    # an entry that vanished from the book without a delete record: say so
    for key, r in havet.items():
        if spend_due and key not in payments and not r.get("deleted"):
            r["deleted"] = now
            r["updated"] = now
            changedt[key] = r
    changed = {}
    for key, r in fresh.items():
        old = have.get(key)
        if old and old.get("ver") == r["ver"]:
            continue
        if old and old.get("status") in ("open", "due") and r.get("status") == "settled":
            # the settled bill comes from a table that no longer knows the
            # rider, dispatch time or how many times the bill was printed
            for f in CARRY:
                if r.get(f) is None and old.get(f) is not None:
                    r[f] = old[f]
            oc, nc = old.get("customer") or {}, r.get("customer") or {}
            for f in ("name", "phone", "address"):
                if not nc.get(f) and oc.get(f):
                    nc[f] = oc[f]
            if nc:
                r["customer"] = nc
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
                "revenue": round(sum((r.get("total") or 0) for r in have.values() if r.get("status") == "settled"), 2),
                "purchaseCount": len(havep), "purchaseTotal": round(sum((p.get("total") or 0) for p in havep.values()), 2),
                "paymentCount": sum(1 for t in havet.values() if not t.get("deleted")),
                "paidOut": round(sum((t.get("amount") or 0) for t in havet.values() if t.get("flow") == "out" and not t.get("deleted")), 2),
                "paidIn": round(sum((t.get("amount") or 0) for t in havet.values() if t.get("flow") == "in" and not t.get("deleted")), 2)})
    save_local(doc)
    top = {k: doc[k] for k in ("day", "updatedAt", "count", "settled", "open", "revenue", "purchaseCount", "purchaseTotal",
                               "paymentCount", "paidOut", "paidIn")}
    if (changed or changedp or changedt) and db is not None:
        ref = db.collection("vm_daylog").document(day)
        # the summary merges; each changed record REPLACES its map, so a bill
        # that went open -> settled does not keep stale open-only fields online
        ref.set(top, merge=True, timeout=30)
        paths = {}
        if changedp.pop("_drafts", None):
            paths["drafts"] = doc.get("drafts", {})
            paths["draftTotal"] = doc.get("draftTotal", 0)
        for coll, items in (("records", changed), ("purchases", changedp), ("payments", changedt)):
            for key, r in items.items():
                paths[f"{coll}.{key}"] = r
        for i in range(0, len(paths), 400):                      # a write holds at most ~500 field paths
            chunk = dict(list(paths.items())[i:i + 400])
            ref.update(chunk, timeout=30)
    if db is not None and (have or havep or havet or with_open):
        # the index the owner board lists days and trends from: one small doc,
        # one read. Written every run (a backfilled day may have nothing new);
        # an empty day (before VMENU started) is not a day.
        db.collection("vm_meta").document("days").set({"days": {day: {
            "rev": top["revenue"], "bills": top["settled"], "open": top["open"], "paidOut": top["paidOut"],
            "purchases": top["purchaseTotal"], "close": closure(have),
            "hours": hourly(have, cfg.getint("vmenu", "day_start_hour", fallback=5)), "updatedAt": now}}}, merge=True, timeout=30)
    if with_open and db is not None:
        push_masters(db, m)
    LOG.info("day %s: %d records, %d changed, %d settled, %d open, %d purchases, %d payments out %s", day, len(have), len(changed),
             settled, doc["open"], len(havep), doc["paymentCount"], doc["paidOut"])
    return {"day": day, "records": len(have), "changed": len(changed), "settled": settled, "open": doc["open"], "purchases": len(havep),
            "purchaseTotal": doc["purchaseTotal"], "payments": doc["paymentCount"], "paidOut": doc["paidOut"]}


def check(cfg) -> int:
    """Local day files against what Firebase holds - the thing to run when the
    owner board looks wrong. No database needed."""
    local = {}
    for p in sorted(OUT.glob("????-??-??.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            local[p.stem] = d
        except Exception:
            local[p.stem] = None
    print(f"local day files: {len(local)}   ({OUT})")
    try:
        db = firestore(cfg)
        online = {d.id: d.to_dict() for d in db.collection("vm_daylog").stream(timeout=60)}
        idx = db.collection("vm_meta").document("days").get(timeout=30)
        idx = (idx.to_dict() or {}).get("days", {}) if idx.exists else {}
    except Exception as e:
        print(f"FIREBASE: cannot read - {e}")
        return 1
    print(f"firebase vm_daylog docs: {len(online)}   index vm_meta/days: {len(idx)} days")
    print()
    print(f"{'day':12}{'local bills':>12}{'online bills':>13}{'revenue':>11}{'online rev':>11}{'payments':>9}{'index':>6}  state")
    bad = 0
    for day in sorted(set(local) | set(online), reverse=True):
        l, o = local.get(day), online.get(day)
        lb = l.get("settled") if l else None
        ob = o.get("settled") if o else None
        lr = l.get("revenue") if l else None
        orv = o.get("revenue") if o else None
        pay = (o or l or {}).get("paymentCount")
        state = "ok"
        if l and not o:
            state = "NOT ONLINE"
        elif o and not l:
            state = "online only"
        elif lb != ob or (lr or 0) != (orv or 0):
            state = "DIFFERS"
        if state != "ok":
            bad += 1
        print(f"{day:12}{'' if lb is None else lb:>12}{'' if ob is None else ob:>13}{'' if lr is None else lr:>11}{'' if orv is None else orv:>11}{'' if pay is None else pay:>9}{'y' if day in idx else '-':>6}  {state}")
    print()
    print("all in step" if not bad else f"{bad} day(s) need attention - run daylog-backfill.bat from the oldest one")
    return 0 if not bad else 2


def wipe(cfg) -> int:
    """Clean slate: every vm_daylog day, the day index and the local files.
    Nothing in VMENU is touched; a backfill rebuilds all of it."""
    db = firestore(cfg)
    n = 0
    for d in db.collection("vm_daylog").stream(timeout=60):
        d.reference.delete(timeout=30)
        n += 1
    db.collection("vm_meta").document("days").delete(timeout=30)
    k = 0
    for p in OUT.glob("????-??-??.json"):
        p.unlink()
        k += 1
    print(f"wiped {n} days online, {k} local files. Now run daylog-backfill-all.bat")
    LOG.warning("wipe: %d online days, %d local files removed", n, k)
    return 0


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["tick", "day", "backfill", "check", "wipe", "sync"])
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

    if a.cmd == "tick":
        # Task Scheduler fires every minute and will not start a second copy
        # while one runs - so a tick that hangs (database or internet stall)
        # would silently stop the log for good. A hung tick is killed at 55 s;
        # the next minute starts clean and catches up.
        def die():
            LOG.error("tick took too long - killed; next minute retries")
            os._exit(3)
        threading.Timer(55, die).start()

    if a.cmd == "check":
        return check(cfg)
    if a.cmd == "wipe":
        return wipe(cfg)

    src = VS.Source(cfg)
    m = Masters(src)
    db = None if a.no_upload else firestore(cfg)
    try:
        if a.cmd == "tick":
            print(run_day(cfg, src, m, today_business(start_hour), db, True))
        elif a.cmd == "day":
            day = a.arg or today_business(start_hour)
            print(run_day(cfg, src, m, day, db, day == today_business(start_hour)))
        elif a.cmd == "sync":
            # only the days that are missing or differ online - plus today
            since = dt.datetime.strptime(a.since or a.arg or "2026-07-01", "%Y-%m-%d").date()
            today = dt.datetime.strptime(today_business(start_hour), "%Y-%m-%d").date()
            online = {d.id: d.to_dict() for d in db.collection("vm_daylog").stream(timeout=60)} if db is not None else {}
            idx = db.collection("vm_meta").document("days").get(timeout=30) if db is not None else None
            idx = (idx.to_dict() or {}).get("days", {}) if idx is not None and idx.exists else {}
            d, todo, fine = since, [], 0
            while d <= today:
                day = d.strftime("%Y-%m-%d")
                l, o = load_local(day), online.get(day)
                ok = (day != today.strftime("%Y-%m-%d") and l.get("updatedAt") and o and day in idx
                      and l.get("settled") == o.get("settled") and (l.get("revenue") or 0) == (o.get("revenue") or 0)
                      and l.get("paymentCount") == o.get("paymentCount"))
                if ok:
                    fine += 1
                else:
                    todo.append(day)
                d += dt.timedelta(days=1)
            print(f"{fine} days already in step, {len(todo)} to do: {', '.join(todo) if len(todo) < 12 else todo[0] + ' .. ' + todo[-1]}")
            for day in todo:
                print(run_day(cfg, src, m, day, db, day == today.strftime("%Y-%m-%d")))
                time.sleep(0.2)
            # empty days that an earlier run put in the index: out
            if db is not None:
                from google.cloud import firestore as gcf
                empty = [k for k, v in idx.items() if not (v.get("bills") or v.get("rev") or v.get("paidOut")) and k != today.strftime("%Y-%m-%d")]
                if empty:
                    db.collection("vm_meta").document("days").update({f"days.{k}": gcf.DELETE_FIELD for k in empty}, timeout=30)
                    print(f"dropped {len(empty)} empty days from the index")
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
        if a.cmd == "tick":
            os._exit(0)                      # cancels the watchdog and Firestore's background threads
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
