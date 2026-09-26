#!/usr/bin/env python3
"""
Hayat VMENU sync
================
Runs on the shop PC next to VMENU. Every run it:

  1. reads NEW or CHANGED bills from the VMENU database (read-only login)
  2. reads the orders that are open right now
  3. reads the staff names VMENU knows
  4. writes only what changed to Firebase (project h-menu):

       vm_bills/{invoiceid}   one document per settled bill, items inside
       vm_open/{id}           orders open right now (removed once settled)
       vm_days/{YYYY-MM-DD}   one small summary per business day
       vm_staff/{id}          VMENU names, each marked waiter / service_agent / ...
       vm_meta/sync           heartbeat: last run, last error, counts

Nothing is ever written back to VMENU.

Commands
  python vmenu_sync.py tick        what Task Scheduler runs every 2 min: page server up + one sync
  python vmenu_sync.py once        one sync run
  python vmenu_sync.py serve       the local Hayat Live page on http://<this-pc>:8765
  python vmenu_sync.py loop        keep running, one run every <interval> seconds
  python vmenu_sync.py discover    write discover_report.txt (table + column names)
  python vmenu_sync.py check       test both connections, change nothing
  python vmenu_sync.py backfill --since 2026-07-01   re-send history from a date
"""
from __future__ import annotations

import argparse
import configparser
import datetime as dt
import hashlib
import json
import logging
import logging.handlers
import os
import socket
import sqlite3
import sys
import time
import traceback
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

VERSION = "1.0.0"
HERE = Path(__file__).resolve().parent
log = logging.getLogger("vmenu_sync")

# ---------------------------------------------------------------- config

DEFAULTS = {
    "vmenu": {
        "host": "127.0.0.1", "port": "3306", "user": "hayat_sync", "password": "",
        "database": "vmenu", "timezone": "Asia/Kolkata", "day_start_hour": "5",
        "bills_table": "svr_invoiceparent", "bill_items_table": "svr_invoicechild",
        "sections_table": "svr_sectionparent", "employees_table": "svr_employeeparent",
        "open_table": "ord_invoiceheader", "open_items_table": "ord_invoicechild",
        "open_id_column": "invoiceid",
        "item_name_columns": "itemname,item_name,itemdesc,description,productname,name",
        "item_qty_columns": "itemquantity,quantity,qty",
        "item_price_columns": "itemprice,price,rate,unitprice",
        "item_amount_columns": "itemtotal,totalprice,amount,total",
        "item_id_columns": "itemid,item_id,productid",
        "items_master_table": "", "items_master_id": "itemid", "items_master_name": "itemname",
    },
    "serve": {"host": "0.0.0.0", "port": "8765", "pin": "", "sim_file": "../sim.html"},
    "firebase": {"key_file": "firebase-key.json", "project_id": "h-menu", "collection_prefix": "vm_"},
    "sync": {
        "interval_seconds": "120", "first_sync_since": "2026-07-01", "overlap_minutes": "20",
        "page_size": "1000", "retention_months": "0", "retention_days": "0", "outlier_minutes": "240",
        "staff_refresh_minutes": "60",
    },
}


def load_config(path: Path) -> configparser.ConfigParser:
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.read_dict(DEFAULTS)
    if path.exists():
        cfg.read(path, encoding="utf-8")
    return cfg


def listcfg(cfg, sec, key):
    return [x.strip().lower() for x in cfg.get(sec, key).split(",") if x.strip()]


# ---------------------------------------------------------------- time helpers

def tz(cfg):
    name = cfg.get("vmenu", "timezone")
    if ZoneInfo:
        try:
            return ZoneInfo(name)
        except Exception:
            pass
    return dt.timezone(dt.timedelta(hours=5, minutes=30))


def clean_dt(v, zone):
    """VMENU stores local time without a zone; zero dates mean 'not set'."""
    if v is None:
        return None
    if isinstance(v, str):
        try:
            v = dt.datetime.fromisoformat(v)
        except ValueError:
            return None
    if isinstance(v, dt.date) and not isinstance(v, dt.datetime):
        v = dt.datetime(v.year, v.month, v.day)
    if not isinstance(v, dt.datetime) or v.year < 2000:
        return None
    return v.replace(tzinfo=zone) if v.tzinfo is None else v.astimezone(zone)


def business_day(t: dt.datetime | None, start_hour: int) -> str | None:
    if t is None:
        return None
    return (t - dt.timedelta(hours=start_hour)).date().isoformat()


def mins(a, b):
    if a is None or b is None:
        return None
    return round((b - a).total_seconds() / 60.0, 2)


def num(v):
    if v is None:
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else round(f, 2)
    except (TypeError, ValueError):
        return None


def pick(row: dict, candidates: list[str]):
    low = {k.lower(): k for k in row}
    for c in candidates:
        if c in low and row[low[c]] not in (None, ""):
            return row[low[c]]
    return None


# ---------------------------------------------------------------- source: VMENU (read-only)

class Source:
    def __init__(self, cfg):
        import pymysql
        import pymysql.cursors
        self.cfg = cfg
        v = cfg["vmenu"]
        self.conn = pymysql.connect(
            host=v.get("host"), port=int(v.get("port")), user=v.get("user"), password=v.get("password"),
            database=v.get("database"), charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=10, read_timeout=120, autocommit=True)
        with self.conn.cursor() as c:
            # belt and braces: this session can only read, even if the login could write
            c.execute("SET SESSION TRANSACTION READ ONLY")
        self._tables = None

    def q(self, sql, args=None):
        with self.conn.cursor() as c:
            c.execute(sql, args or ())
            return c.fetchall()

    def tables(self):
        if self._tables is None:
            rows = self.q("SHOW TABLES")
            self._tables = {list(r.values())[0].lower() for r in rows}
        return self._tables

    def has(self, t):
        return bool(t) and t.lower() in self.tables()

    def columns(self, t):
        return [r["Field"] for r in self.q(f"SHOW COLUMNS FROM `{t}`")]

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass

    # -- reads
    def bills_since(self, since: dt.datetime, limit: int):
        v = self.cfg["vmenu"]
        sec, emp = v.get("sections_table"), v.get("employees_table")
        join = ""
        sel = "p.*"
        if self.has(sec):
            sel += ", s.sectionname AS _section"
            join += f" LEFT JOIN `{sec}` s ON s.sectionid = p.secid"
        if self.has(emp):
            sel += ", e.employeename AS _taker"
            join += f" LEFT JOIN `{emp}` e ON e.employeeid = p.ordtakerid"
        return self.q(
            f"SELECT {sel} FROM `{v.get('bills_table')}` p{join} "
            f"WHERE p.billingtime >= %s ORDER BY p.billingtime, p.invoiceid LIMIT %s",
            (since.replace(tzinfo=None), limit))

    def items_for(self, table, id_col, ids):
        if not ids or not self.has(table):
            return {}
        out = {}
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            marks = ",".join(["%s"] * len(chunk))
            for r in self.q(f"SELECT * FROM `{table}` WHERE `{id_col}` IN ({marks})", chunk):
                key = str(r.get(id_col) if id_col in r else pick(r, [id_col.lower()]))
                out.setdefault(key, []).append(r)
        return out

    def open_orders(self):
        v = self.cfg["vmenu"]
        t = v.get("open_table")
        if not self.has(t):
            return None
        sec, emp = v.get("sections_table"), v.get("employees_table")
        cols = {c.lower() for c in self.columns(t)}
        sel, join = "h.*", ""
        if self.has(sec) and "secid" in cols:
            sel += ", s.sectionname AS _section"
            join += f" LEFT JOIN `{sec}` s ON s.sectionid = h.secid"
        if self.has(emp) and "ordtakerid" in cols:
            sel += ", e.employeename AS _taker"
            join += f" LEFT JOIN `{emp}` e ON e.employeeid = h.ordtakerid"
        return self.q(f"SELECT {sel} FROM `{t}` h{join}")

    def employees(self):
        t = self.cfg["vmenu"].get("employees_table")
        if not self.has(t):
            return []
        return self.q(f"SELECT * FROM `{t}`")

    def item_master(self):
        v = self.cfg["vmenu"]
        t = v.get("items_master_table")
        if not t or not self.has(t):
            return {}
        rows = self.q(f"SELECT `{v.get('items_master_id')}` AS i, `{v.get('items_master_name')}` AS n FROM `{t}`")
        return {str(r["i"]): r["n"] for r in rows}


# ---------------------------------------------------------------- shaping documents

class Shaper:
    def __init__(self, cfg, item_names=None):
        self.cfg, self.zone = cfg, tz(cfg)
        self.day_start = cfg.getint("vmenu", "day_start_hour")
        self.outlier = cfg.getfloat("sync", "outlier_minutes")
        self.c_name = listcfg(cfg, "vmenu", "item_name_columns")
        self.c_qty = listcfg(cfg, "vmenu", "item_qty_columns")
        self.c_price = listcfg(cfg, "vmenu", "item_price_columns")
        self.c_amt = listcfg(cfg, "vmenu", "item_amount_columns")
        self.c_id = listcfg(cfg, "vmenu", "item_id_columns")
        self.item_names = item_names or {}

    def t(self, v):
        return clean_dt(v, self.zone)

    def items(self, rows):
        out, kot_times = [], set()
        for r in rows or []:
            name = pick(r, self.c_name)
            if name is None:
                iid = pick(r, self.c_id)
                name = self.item_names.get(str(iid), f"item {iid}" if iid is not None else "item")
            q, p, a = num(pick(r, self.c_qty)), num(pick(r, self.c_price)), num(pick(r, self.c_amt))
            if a is None and q is not None and p is not None:
                a = num(q * p)
            out.append({"n": str(name).strip(), "q": q, "p": p, "a": a})
            rt = self.t(pick(r, ["running_ord_time"]))
            if rt:
                kot_times.add(rt)
        return out, kot_times

    @staticmethod
    def kind(section, parceltype):
        s = (section or "").upper()
        if "PARCEL" in s or "TAKE" in s or "DELIVER" in s:
            return "Parcel"
        return "Dine-in"

    def base(self, r, item_rows):
        order_at = self.t(pick(r, ["order_time"]))
        addon_at = self.t(pick(r, ["running_order"]))
        due_at = self.t(pick(r, ["duebill_time"]))
        items, kt = self.items(item_rows)
        kots = sorted({x for x in ([order_at, addon_at] + list(kt)) if x})
        section = r.get("_section") or (f"section {r.get('secid')}" if r.get("secid") is not None else None)
        return {
            "src": "vmenu",
            "invoiceId": num(pick(r, ["invoiceid"])),
            "billNo": num(pick(r, ["billno"])),
            "section": section,
            "type": self.kind(section, r.get("parceltype")),
            "table": num(pick(r, ["tableno"])),
            "kot": num(pick(r, ["kotno"])),
            "token": num(pick(r, ["token_no"])),
            "takerId": num(pick(r, ["ordtakerid"])),
            "taker": r.get("_taker") or (f"ID {r.get('ordtakerid')}" if r.get("ordtakerid") is not None else None),
            "pax": num(pick(r, ["pax"])),
            "orderAt": order_at, "addonAt": addon_at, "dueAt": due_at,
            "kots": kots, "kotCount": len(kots),
            "items": items, "itemLines": len(items),
            "itemQty": num(sum((i["q"] or 0) for i in items)) if items else 0,
            "remarks": (str(r.get("remarks")).strip() or None) if r.get("remarks") is not None else None,
        }

    def bill(self, r, item_rows):
        d = self.base(r, item_rows)
        settled = self.t(pick(r, ["billingtime"]))
        d.update({
            "settledAt": settled,
            "day": business_day(settled or d["orderAt"], self.day_start),
            "total": num(pick(r, ["totalprice"])),
            "paid": num(pick(r, ["settlingprice"])),
            "payMode": pick(r, ["payment_mode"]),
            "orderToDue": mins(d["orderAt"], d["dueAt"]),
            "dueToSettle": mins(d["dueAt"], settled),
            "orderToSettle": mins(d["orderAt"], settled),
        })
        d["outlier"] = bool(d["orderToSettle"] is not None and d["orderToSettle"] > self.outlier)
        return d

    def open(self, r, item_rows):
        d = self.base(r, item_rows)
        d.update({"status": "due" if d["dueAt"] else "open",
                  "day": business_day(d["orderAt"], self.day_start),
                  "total": num(pick(r, ["totalprice"]))})
        return d


def fingerprint(doc: dict) -> str:
    body = json.dumps({k: v for k, v in doc.items() if k != "syncedAt"}, sort_keys=True, default=str)
    return hashlib.sha1(body.encode("utf-8")).hexdigest()


def jsonable(doc):
    return json.loads(json.dumps(doc, default=lambda o: o.isoformat() if hasattr(o, "isoformat") else str(o)))


# ---------------------------------------------------------------- day summaries

def summarize(day: str, bills: list[dict]) -> dict:
    def avg(xs):
        xs = [x for x in xs if x is not None]
        return round(sum(xs) / len(xs), 1) if xs else None

    def med(xs):
        xs = sorted(x for x in xs if x is not None)
        return round(xs[len(xs) // 2], 1) if xs else None

    good = [b for b in bills if not b.get("outlier")]
    dine = [b for b in good if b.get("type") == "Dine-in"]
    sections, takers, hours, items = {}, {}, {}, {}
    for b in bills:
        s = sections.setdefault(b.get("section") or "?", {"bills": 0, "revenue": 0, "_occ": [], "_pay": []})
        s["bills"] += 1
        s["revenue"] += b.get("total") or 0
        if not b.get("outlier"):
            s["_occ"].append(b.get("orderToSettle"))
            s["_pay"].append(b.get("dueToSettle"))
        t = takers.setdefault(b.get("taker") or "?", {"id": b.get("takerId"), "bills": 0, "revenue": 0, "_occ": []})
        t["bills"] += 1
        t["revenue"] += b.get("total") or 0
        if not b.get("outlier") and b.get("type") == "Dine-in":
            t["_occ"].append(b.get("orderToSettle"))
        oa = b.get("orderAt")
        if oa:
            h = str(oa.hour if hasattr(oa, "hour") else int(str(oa)[11:13]))
            hours[h] = hours.get(h, 0) + 1
        for it in b.get("items") or []:
            items[it["n"]] = items.get(it["n"], 0) + (it.get("q") or 0)
    for d in list(sections.values()) + list(takers.values()):
        d["revenue"] = num(d["revenue"])
        if "_occ" in d:
            d["occAvg"], d["occMedian"] = avg(d["_occ"]), med(d["_occ"])
            del d["_occ"]
        if "_pay" in d:
            d["payWaitAvg"] = avg(d.pop("_pay"))
    top = sorted(items.items(), key=lambda kv: -kv[1])[:25]
    return {
        "day": day, "bills": len(bills), "dineIn": len(dine),
        "parcel": sum(1 for b in bills if b.get("type") == "Parcel"),
        "revenue": num(sum(b.get("total") or 0 for b in bills)),
        "occAvg": avg([b.get("orderToSettle") for b in dine]),
        "occMedian": med([b.get("orderToSettle") for b in dine]),
        "payWaitAvg": avg([b.get("dueToSettle") for b in dine]),
        "addonShare": round(sum(1 for b in dine if (b.get("kotCount") or 0) > 1) / len(dine), 3) if dine else None,
        "outliers": sum(1 for b in bills if b.get("outlier")),
        "sections": sections, "takers": takers, "byHour": hours,
        "topItems": [{"n": n, "q": num(q)} for n, q in top],
    }


# ---------------------------------------------------------------- local cache (what has been sent)

class Cache:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(str(path), timeout=15)
        self.db.execute("CREATE TABLE IF NOT EXISTS sent (coll TEXT, id TEXT, hash TEXT, day TEXT, body TEXT, PRIMARY KEY(coll,id))")
        self.db.execute("CREATE INDEX IF NOT EXISTS sent_day ON sent(coll, day)")
        self.db.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
        self.db.execute("CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT, role TEXT, source TEXT, vmenu_id INTEGER, active INTEGER DEFAULT 1)")
        self.db.commit()

    def get_hash(self, coll, i):
        r = self.db.execute("SELECT hash FROM sent WHERE coll=? AND id=?", (coll, i)).fetchone()
        return r[0] if r else None

    def put(self, coll, i, h, day, body):
        self.db.execute("INSERT OR REPLACE INTO sent VALUES (?,?,?,?,?)", (coll, i, h, day, json.dumps(jsonable(body))))

    def drop(self, coll, i):
        self.db.execute("DELETE FROM sent WHERE coll=? AND id=?", (coll, i))

    def ids(self, coll):
        return {r[0] for r in self.db.execute("SELECT id FROM sent WHERE coll=?", (coll,))}

    def day_bodies(self, coll, day):
        return [json.loads(r[0]) for r in self.db.execute("SELECT body FROM sent WHERE coll=? AND day=?", (coll, day))]

    def meta(self, k, default=None):
        r = self.db.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
        return r[0] if r else default

    def set_meta(self, k, v):
        self.db.execute("INSERT OR REPLACE INTO meta VALUES (?,?)", (k, str(v)))

    def commit(self):
        self.db.commit()

    # staff roles live here, on the shop PC; Firebase gets a copy
    def roles(self):
        cols = ["id", "name", "role", "source", "vmenu_id", "active"]
        return [dict(zip(cols, r)) for r in self.db.execute(f"SELECT {','.join(cols)} FROM roles ORDER BY role, name")]

    def seen_employee(self, eid, name):
        i = f"vm{eid}"
        r = self.db.execute("SELECT name FROM roles WHERE id=?", (i,)).fetchone()
        if r is None:
            self.db.execute("INSERT INTO roles VALUES (?,?,?,?,?,1)",
                            (i, name, STAFF_DEFAULT_ROLE.get(name.upper(), "unassigned"), "vmenu", int(eid)))
        elif r[0] != name:
            self.db.execute("UPDATE roles SET name=? WHERE id=?", (name, i))

    def set_role(self, i, role=None, name=None, active=None):
        if role is not None and role not in ROLES:
            raise ValueError("unknown role")
        if not i:
            if not name or not role:
                raise ValueError("name and role needed")
            base = "sa-" + "".join(ch for ch in name.lower() if ch.isalnum())[:24]
            i, n = base, 2
            while self.db.execute("SELECT 1 FROM roles WHERE id=?", (i,)).fetchone():
                i, n = f"{base}{n}", n + 1
            self.db.execute("INSERT INTO roles VALUES (?,?,?,?,NULL,1)", (i, name.strip(), role, "manual"))
        else:
            if role is not None:
                self.db.execute("UPDATE roles SET role=? WHERE id=?", (role, i))
            if name:
                self.db.execute("UPDATE roles SET name=? WHERE id=? AND source='manual'", (name.strip(), i))
            if active is not None:
                self.db.execute("UPDATE roles SET active=? WHERE id=?", (1 if active else 0, i))
        self.db.commit()
        return i


# ---------------------------------------------------------------- targets

class FirestoreTarget:
    """Writes with the Admin SDK (service-account key kept only on the shop PC)."""

    def __init__(self, cfg):
        import firebase_admin
        from firebase_admin import credentials, firestore
        key = Path(cfg.get("firebase", "key_file"))
        if not key.is_absolute():
            key = HERE / key
        if os.environ.get("FIRESTORE_EMULATOR_HOST"):
            app = firebase_admin.initialize_app(options={"projectId": cfg.get("firebase", "project_id")}) \
                if not firebase_admin._apps else firebase_admin.get_app()
        else:
            if not key.exists():
                raise SystemExit(f"Firebase key not found: {key}")
            app = firebase_admin.initialize_app(credentials.Certificate(str(key)),
                                                {"projectId": cfg.get("firebase", "project_id")}) \
                if not firebase_admin._apps else firebase_admin.get_app()
        self.fs = firestore
        self.db = firestore.client(app)
        self.writes = self.deletes = 0

    def _batches(self, ops):
        for i in range(0, len(ops), 400):
            b = self.db.batch()
            for op in ops[i:i + 400]:
                op(b)
            b.commit()

    def put_many(self, coll, docs):
        now = self.fs.SERVER_TIMESTAMP
        ops = [(lambda b, i=i, d=d: b.set(self.db.collection(coll).document(i), {**d, "syncedAt": now})) for i, d in docs]
        self._batches(ops)
        self.writes += len(docs)

    def delete_many(self, coll, ids):
        ops = [(lambda b, i=i: b.delete(self.db.collection(coll).document(i))) for i in ids]
        self._batches(ops)
        self.deletes += len(ids)

    def merge(self, coll, i, data):
        self.db.collection(coll).document(i).set(data, merge=True)
        self.writes += 1

    def create_if_missing(self, coll, i, data):
        from google.api_core.exceptions import AlreadyExists, Conflict
        try:
            self.db.collection(coll).document(i).create(data)
            self.writes += 1
            return True
        except (AlreadyExists, Conflict):
            return False

    def ids_before(self, coll, field, value, limit):
        q = self.db.collection(coll).where(field, "<", value).limit(limit)
        return [d.id for d in q.stream()]


class JsonTarget:
    """Dry run / tests: writes into a local folder instead of Firebase."""

    def __init__(self, folder: Path):
        self.root = Path(folder)
        self.root.mkdir(parents=True, exist_ok=True)
        self.writes = self.deletes = 0

    def _p(self, coll, i):
        p = self.root / coll
        p.mkdir(exist_ok=True)
        return p / f"{i}.json"

    def put_many(self, coll, docs):
        for i, d in docs:
            self._p(coll, i).write_text(json.dumps(jsonable({**d, "syncedAt": "now"}), indent=1, ensure_ascii=False), encoding="utf-8")
        self.writes += len(docs)

    def delete_many(self, coll, ids):
        for i in ids:
            p = self._p(coll, i)
            if p.exists():
                p.unlink()
        self.deletes += len(ids)

    def merge(self, coll, i, data):
        p = self._p(coll, i)
        cur = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
        cur.update(jsonable(data))
        p.write_text(json.dumps(cur, indent=1, ensure_ascii=False), encoding="utf-8")
        self.writes += 1

    def create_if_missing(self, coll, i, data):
        p = self._p(coll, i)
        if p.exists():
            return False
        self.merge(coll, i, data)
        return True

    def ids_before(self, coll, field, value, limit):
        out = []
        for p in (self.root / coll).glob("*.json") if (self.root / coll).exists() else []:
            d = json.loads(p.read_text(encoding="utf-8"))
            if d.get(field) is not None and d[field] < value:
                out.append(p.stem)
        return out[:limit]


# ---------------------------------------------------------------- one run

STAFF_DEFAULT_ROLE = {"CASHIER": "cashier"}
ROLES = {
    "waiter": "Waiter",                # takes orders at the table (names in VMENU)
    "service_agent": "Service agent",  # runner, table clearer, captain, helper
    "cashier": "Cashier",
    "unassigned": "Not set yet",
}


def run_once(cfg, src: Source, dst, cache: Cache, since_override: dt.datetime | None = None) -> dict:
    zone = tz(cfg)
    pre = cfg.get("firebase", "collection_prefix")
    C = {k: pre + k for k in ("bills", "open", "days", "staff", "meta")}
    stats = {"bills_read": 0, "bills_sent": 0, "open_now": 0, "open_sent": 0, "open_closed": 0,
             "days_sent": 0, "staff_sent": 0, "retention_deleted": 0}
    v = cfg["vmenu"]
    shaper = Shaper(cfg, src.item_master())
    touched_days = set()

    # 1. settled bills, from a cursor (with overlap so late edits are caught)
    if since_override:
        cursor = since_override
    else:
        c = cache.meta("cursor")
        cursor = clean_dt(c, zone) if c else clean_dt(dt.datetime.fromisoformat(cfg.get("sync", "first_sync_since")), zone)
        cursor = cursor - dt.timedelta(minutes=cfg.getint("sync", "overlap_minutes"))
    page = cfg.getint("sync", "page_size")
    newest = clean_dt(cache.meta("cursor"), zone) if cache.meta("cursor") else None
    while True:
        rows = src.bills_since(cursor, page)
        stats["bills_read"] += len(rows)
        if not rows:
            break
        items = src.items_for(v.get("bill_items_table"), "invoiceid", [r["invoiceid"] for r in rows])
        batch = []
        for r in rows:
            doc = shaper.bill(r, items.get(str(r["invoiceid"]), []))
            i, h = str(r["invoiceid"]), fingerprint(doc)
            if cache.get_hash(C["bills"], i) != h:
                batch.append((i, doc))
                touched_days.add(doc["day"])
            cache.put(C["bills"], i, h, doc["day"], doc)
            if doc["settledAt"] and (newest is None or doc["settledAt"] > newest):
                newest = doc["settledAt"]
        if batch:
            dst.put_many(C["bills"], batch)
            stats["bills_sent"] += len(batch)
        cache.commit()
        last = clean_dt(rows[-1]["billingtime"], zone)
        if len(rows) < page or last is None or last <= cursor:
            break
        cursor = last
    if newest:
        cache.set_meta("cursor", newest.isoformat())

    # 2. open orders: a full snapshot each run; small (only tables in progress)
    opens = src.open_orders()
    if opens is None:
        stats["open_now"] = None
    else:
        idc = v.get("open_id_column")
        ids = [r.get(idc) for r in opens]
        items = src.items_for(v.get("open_items_table"), idc, ids)
        now_ids, batch = set(), []
        for r in opens:
            i = str(r.get(idc))
            now_ids.add(i)
            doc = shaper.open(r, items.get(i, []))
            h = fingerprint(doc)
            if cache.get_hash(C["open"], i) != h:
                batch.append((i, doc))
            cache.put(C["open"], i, h, doc["day"], doc)
        if batch:
            dst.put_many(C["open"], batch)
        gone = sorted(cache.ids(C["open"]) - now_ids)
        if gone:
            dst.delete_many(C["open"], gone)
            for i in gone:
                cache.drop(C["open"], i)
        stats.update(open_now=len(now_ids), open_sent=len(batch), open_closed=len(gone))
        cache.commit()

    # 3. day summaries for every day that changed
    for day in sorted(d for d in touched_days if d):
        bodies = cache.day_bodies(C["bills"], day)
        for b in bodies:  # restore times for hour buckets
            if isinstance(b.get("orderAt"), str):
                b["orderAt"] = clean_dt(b["orderAt"], zone)
        doc = summarize(day, bodies)
        h = fingerprint(doc)
        if cache.get_hash(C["days"], day) != h:
            dst.put_many(C["days"], [(day, doc)])
            cache.put(C["days"], day, h, day, doc)
            stats["days_sent"] += 1
    cache.commit()

    # 4. staff: names from VMENU, roles from the office (kept on this PC, copied to Firebase)
    last_staff = float(cache.meta("staff_at", "0"))
    if time.time() - last_staff > cfg.getint("sync", "staff_refresh_minutes") * 60:
        for e in src.employees():
            eid = pick(e, ["employeeid"])
            name = str(pick(e, ["employeename"]) or "").strip()
            if eid is not None and name:
                cache.seen_employee(eid, name)
        cache.set_meta("staff_at", time.time())
        cache.commit()
    batch = []
    for r in cache.roles():
        doc = {"name": r["name"], "role": r["role"], "roleLabel": ROLES.get(r["role"], r["role"]),
               "source": r["source"], "vmenuId": r["vmenu_id"], "active": bool(r["active"])}
        h = fingerprint(doc)
        if cache.get_hash(C["staff"], r["id"]) != h:
            batch.append((r["id"], doc))
            cache.put(C["staff"], r["id"], h, None, doc)
    if batch:
        dst.put_many(C["staff"], batch)
        stats["staff_sent"] = len(batch)
    cache.commit()

    # 5. optional clean-up of old bills (daily summaries are kept)
    keep_days = cfg.getint("sync", "retention_days") or 30 * cfg.getint("sync", "retention_months")
    today = dt.datetime.now(zone).date().isoformat()
    if keep_days > 0 and cache.meta("retention_day") != today:
        cutoff = (dt.datetime.now(zone) - dt.timedelta(days=keep_days)).date().isoformat()
        old = dst.ids_before(C["bills"], "day", cutoff, 400)
        if old:
            dst.delete_many(C["bills"], old)
            for i in old:
                cache.drop(C["bills"], i)
        stats["retention_deleted"] = len(old)
        if len(old) < 400:
            cache.set_meta("retention_day", today)
        cache.commit()
    return stats


# ---------------------------------------------------------------- plumbing

def setup_logging(verbose=False):
    (HERE / "logs").mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    fh = logging.handlers.RotatingFileHandler(HERE / "logs" / "vmenu_sync.log", maxBytes=1_000_000, backupCount=5, encoding="utf-8")
    fh.setFormatter(fmt)
    log.addHandler(fh)
    if verbose or sys.stdout and sys.stdout.isatty():
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(fmt)
        log.addHandler(sh)
    log.setLevel(logging.INFO)


class SingleInstance:
    """Stops two runs overlapping (Task Scheduler + a manual run)."""

    def __init__(self, port=47811):
        self.s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            self.s.bind(("127.0.0.1", port))
            self.ok = True
        except OSError:
            self.ok = False

    def release(self):
        self.s.close()


def heartbeat(dst, cfg, ok, stats, err=None, cache=None):
    pre = cfg.get("firebase", "collection_prefix")
    zone = tz(cfg)
    data = {"lastRunAt": dt.datetime.now(zone), "version": VERSION, "host": socket.gethostname(), "stats": stats,
            "intervalSeconds": cfg.getint("sync", "interval_seconds")}
    if ok:
        data.update(lastOkAt=dt.datetime.now(zone), lastError=None)
    else:
        data["lastError"] = (err or "")[-1500:]
    if cache is not None:
        prev = json.loads(cache.meta("heartbeat", "{}"))
        local = {**prev, **jsonable(data)}
        cache.set_meta("heartbeat", json.dumps(local))
        cache.commit()
    try:
        dst.merge(pre + "meta", "sync", data)
    except Exception:
        log.exception("heartbeat failed")


def make_target(cfg, args):
    if getattr(args, "dry_run", None):
        return JsonTarget(Path(args.dry_run))
    return FirestoreTarget(cfg)


def cmd_once(cfg, args, since=None):
    lock = SingleInstance()
    if not lock.ok:
        log.info("another run is in progress; skipping")
        return 0
    cache = Cache(HERE / "cache.db")
    dst = None
    try:
        dst = make_target(cfg, args)
        t0 = time.time()
        src = Source(cfg)
        try:
            stats = run_once(cfg, src, dst, cache, since)
        finally:
            src.close()
        stats["seconds"] = round(time.time() - t0, 1)
        heartbeat(dst, cfg, True, stats, cache=cache)
        log.info("ok %s", json.dumps(stats))
        return 0
    except Exception as e:
        err = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        log.error("run failed: %s", err)
        if dst is not None:
            heartbeat(dst, cfg, False, {}, err, cache=cache)
        else:
            heartbeat(JsonTarget(HERE / "logs" / "unsent"), cfg, False, {}, err, cache=cache)
        return 1
    finally:
        cache.commit()
        lock.release()


def cmd_loop(cfg, args):
    interval = cfg.getint("sync", "interval_seconds")
    log.info("loop started, every %ss", interval)
    while True:
        started = time.time()
        cmd_once(cfg, args)
        time.sleep(max(10, interval - (time.time() - started)))


def cmd_discover(cfg, args):
    src = Source(cfg)
    lines = [f"VMENU discover report  {dt.datetime.now():%Y-%m-%d %H:%M}", ""]
    want = ("invoice", "section", "employee", "item", "kot", "order", "table")
    for t in sorted(src.tables()):
        if not any(w in t for w in want):
            continue
        try:
            cols = src.q(f"SHOW COLUMNS FROM `{t}`")
            n = src.q(f"SELECT COUNT(*) AS n FROM `{t}`")[0]["n"]
        except Exception as e:
            lines.append(f"## {t}: {e}")
            continue
        lines.append(f"## {t}  ({n} rows)")
        for c in cols:
            lines.append(f"   {c['Field']:<28} {c['Type']}")
        lines.append("")
    out = HERE / "discover_report.txt"
    out.write_text("\n".join(lines), encoding="utf-8")
    src.close()
    print(f"wrote {out}")
    return 0


def cmd_check(cfg, args):
    ok = True
    try:
        src = Source(cfg)
        t = cfg.get("vmenu", "bills_table")
        n = src.q(f"SELECT COUNT(*) AS n, MAX(billingtime) AS last FROM `{t}`")[0]
        print(f"VMENU    OK  {n['n']} bills, last bill {n['last']}")
        o = src.open_orders()
        print(f"         open orders table: {'OK, ' + str(len(o)) + ' open now' if o is not None else 'not found'}")
        src.close()
    except Exception as e:
        ok = False
        print(f"VMENU    FAILED  {e}")
    try:
        dst = make_target(cfg, args)
        dst.merge(cfg.get("firebase", "collection_prefix") + "meta", "check",
                  {"at": dt.datetime.now(tz(cfg)), "host": socket.gethostname(), "version": VERSION})
        print("Firebase OK  wrote vm_meta/check")
    except Exception as e:
        ok = False
        print(f"Firebase FAILED  {e}")
    return 0 if ok else 1


# ---------------------------------------------------------------- local reports server (no Firebase reads)

def cmd_serve(cfg, args):
    """Serves the Hayat Live page and its data straight from cache.db on this PC.
    Phones on the shop Wi-Fi open http://<this-pc>:8765 ; nothing is read from Firebase."""
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
    from urllib.parse import urlparse, parse_qs
    pin = cfg.get("serve", "pin").strip()
    web = HERE / "web"
    sim = Path(cfg.get("serve", "sim_file"))
    sim = sim if sim.is_absolute() else (HERE / sim).resolve()

    def db():
        return Cache(HERE / "cache.db")

    class H(BaseHTTPRequestHandler):
        server_version = "HayatLive/" + VERSION

        def log_message(self, fmt, *a):
            pass

        def send(self, code, body, ctype="application/json; charset=utf-8"):
            data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def authed(self, qs):
            if not pin:
                return True
            return self.headers.get("X-Pin") == pin or qs.get("pin", [""])[0] == pin

        def do_GET(self):
            u = urlparse(self.path)
            qs = parse_qs(u.query)
            if u.path in ("/", "/index.html"):
                return self.send(200, (web / "index.html").read_bytes(), "text/html; charset=utf-8")
            if u.path in ("/sim", "/sim.html"):
                if sim.exists():
                    return self.send(200, sim.read_bytes(), "text/html; charset=utf-8")
                return self.send(404, {"error": "sim.html not found next to the service"})
            if not u.path.startswith("/api/"):
                return self.send(404, {"error": "not found"})
            if not self.authed(qs):
                return self.send(401, {"error": "PIN needed"})
            c = db()
            try:
                if u.path == "/api/status":
                    hb = json.loads(c.meta("heartbeat", "{}"))
                    return self.send(200, {**hb, "now": dt.datetime.now(tz(cfg)).isoformat(), "pinSet": bool(pin), "roles": ROLES})
                if u.path == "/api/open":
                    rows = [json.loads(r[0]) for r in c.db.execute("SELECT body FROM sent WHERE coll=?", (cfg.get("firebase", "collection_prefix") + "open",))]
                    return self.send(200, rows)
                if u.path == "/api/day":
                    d = qs.get("d", [dt.datetime.now(tz(cfg)).date().isoformat()])[0]
                    pre = cfg.get("firebase", "collection_prefix")
                    summ = c.db.execute("SELECT body FROM sent WHERE coll=? AND id=?", (pre + "days", d)).fetchone()
                    bills = c.day_bodies(pre + "bills", d)
                    return self.send(200, {"day": d, "summary": json.loads(summ[0]) if summ else None, "bills": bills})
                if u.path == "/api/days":
                    pre = cfg.get("firebase", "collection_prefix")
                    lo, hi = qs.get("from", ["0000"])[0], qs.get("to", ["9999"])[0]
                    rows = [json.loads(r[0]) for r in c.db.execute(
                        "SELECT body FROM sent WHERE coll=? AND id>=? AND id<=? ORDER BY id", (pre + "days", lo, hi))]
                    for r in rows:
                        r.pop("topItems", None)
                    return self.send(200, rows)
                if u.path == "/api/staff":
                    return self.send(200, {"staff": c.roles(), "roles": ROLES})
                return self.send(404, {"error": "not found"})
            finally:
                c.db.close()

        def do_POST(self):
            u = urlparse(self.path)
            qs = parse_qs(u.query)
            if not self.authed(qs):
                return self.send(401, {"error": "PIN needed"})
            n = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self.send(400, {"error": "bad JSON"})
            if u.path != "/api/staff":
                return self.send(404, {"error": "not found"})
            c = db()
            try:
                i = c.set_role(body.get("id"), body.get("role"), body.get("name"), body.get("active"))
                return self.send(200, {"ok": True, "id": i, "staff": c.roles()})
            except ValueError as e:
                return self.send(400, {"error": str(e)})
            finally:
                c.db.close()

    host, port = cfg.get("serve", "host"), cfg.getint("serve", "port")
    srv = ThreadingHTTPServer((host, port), H)
    log.info("Hayat Live on http://%s:%s", socket.gethostname(), port)
    print(f"Hayat Live running: http://localhost:{port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


def server_up(cfg):
    try:
        with socket.create_connection(("127.0.0.1", cfg.getint("serve", "port")), timeout=2):
            return True
    except OSError:
        return False


def cmd_tick(cfg, args):
    """What Task Scheduler runs every 2 minutes: make sure the local page is up, then sync once."""
    if not server_up(cfg):
        import subprocess
        exe = sys.executable
        if os.name == "nt" and exe.lower().endswith("python.exe"):
            alt = exe[:-10] + "pythonw.exe"
            exe = alt if Path(alt).exists() else exe
        cmd = [exe, str(Path(__file__).resolve()), "serve", "--config", args.config]
        kw = {"cwd": str(HERE), "stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
        if os.name == "nt":
            kw["creationflags"] = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        else:
            kw["start_new_session"] = True
        subprocess.Popen(cmd, **kw)
        log.info("started the local page server")
    return cmd_once(cfg, args)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Hayat VMENU → Firebase sync")
    ap.add_argument("command", choices=["tick", "once", "loop", "serve", "discover", "check", "backfill"])
    ap.add_argument("--config", default=str(HERE / "config.ini"))
    ap.add_argument("--since", help="backfill start date, YYYY-MM-DD")
    ap.add_argument("--dry-run", help="write JSON into this folder instead of Firebase")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    setup_logging(args.verbose)
    cfg = load_config(Path(args.config))
    if args.command == "tick":
        return cmd_tick(cfg, args)
    if args.command == "serve":
        return cmd_serve(cfg, args)
    if args.command == "once":
        return cmd_once(cfg, args)
    if args.command == "loop":
        return cmd_loop(cfg, args)
    if args.command == "discover":
        return cmd_discover(cfg, args)
    if args.command == "check":
        return cmd_check(cfg, args)
    if args.command == "backfill":
        if not args.since:
            ap.error("backfill needs --since YYYY-MM-DD")
        since = clean_dt(dt.datetime.fromisoformat(args.since), tz(cfg))
        return cmd_once(cfg, args, since)
    return 2


if __name__ == "__main__":
    sys.exit(main())
