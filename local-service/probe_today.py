#!/usr/bin/env python3
"""
Where did today's entries go? Read-only.

Lists every VMENU table that received rows since the business day started
(05:00), then prints today's accounts book (act_paymentorrecipt) by type
and today's purchase heads. Writes probe_today.txt next to this file.

    .venv\\Scripts\\python probe_today.py            today
    .venv\\Scripts\\python probe_today.py 2026-09-25 another day
"""
from __future__ import annotations

import datetime as dt
import decimal
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def cut(x, n=38):
    if isinstance(x, dt.datetime):
        return x.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(x, (dt.date, dt.time)):
        return str(x)
    if isinstance(x, decimal.Decimal):
        return str(x)
    s = "NULL" if x is None else str(x).replace("\n", " ").strip()
    return s if len(s) <= n else s[:n - 3] + "..."


def main(argv):
    import daylog as D
    cfg = D.VS.load_config(HERE / "config.ini")
    start = cfg.getint("vmenu", "day_start_hour", fallback=5)
    day = argv[1] if len(argv) > 1 else D.today_business(start)
    if day == "all":
        lo, hi = dt.datetime(2000, 1, 1), dt.datetime(2100, 1, 1)
    else:
        lo, hi = D.day_bounds(day, start)
    src = D.VS.Source(cfg)
    q = src.q
    out = []
    say = out.append
    say(f"VMENU today-probe   business day {day}   window {lo:%Y-%m-%d %H:%M} .. {hi:%Y-%m-%d %H:%M}")
    say("=" * 100)

    # 1. every table with rows written in the window (by any datetime/timestamp column)
    tables = [list(r.values())[0] for r in q("SHOW TABLES")]
    hits = []
    for t in tables:
        cols = q(f"SHOW COLUMNS FROM `{t}`")
        dcols = [c["Field"] for c in cols if any(k in str(c["Type"]).lower() for k in ("datetime", "timestamp"))]
        best = None
        for d in dcols:
            try:
                n = q(f"SELECT COUNT(*) AS n FROM `{t}` WHERE `{d}` >= %s AND `{d}` < %s", (lo, hi))[0]["n"]
            except Exception:
                continue
            if n and (best is None or n > best[1]):
                best = (d, n)
        if best:
            hits.append((t, best[0], best[1]))
    say(f"TABLES WITH ROWS IN THE WINDOW ({len(hits)})")
    say(f"{'table':44} {'by column':22} rows")
    for t, d, n in sorted(hits, key=lambda x: -x[2]):
        say(f"{t:44} {d:22} {n}")
    say("")

    # 2. the accounts book, by type
    say("ACCOUNTS BOOK act_paymentorrecipt - by transaction_type / acttype")
    say(f"   {'transaction_type':44} {'acttype':16} {'rows':>5}  {'amount':>12}  first .. last")
    for r in q("SELECT transaction_type, acttype, COUNT(*) AS n, SUM(amount) AS amt, MIN(transactiondate) AS lo, MAX(transactiondate) AS hi FROM act_paymentorrecipt "
               "WHERE transactiondate >= %s AND transactiondate < %s GROUP BY transaction_type, acttype ORDER BY n DESC", (lo, hi)):
        say(f"   {cut(r['transaction_type'], 44):44} {cut(r['acttype'], 16):16} {r['n']:5}  {cut(r['amt'], 12):>12}  {cut(r['lo'], 16)} .. {cut(r['hi'], 16)}")
    say("")
    say("DELETED ENTRIES paymentorrecipt_delentries - by type")
    for r in q("SELECT transaction_type, acttype, COUNT(*) AS n, SUM(amount) AS amt FROM paymentorrecipt_delentries "
               "WHERE transactiondate >= %s AND transactiondate < %s GROUP BY transaction_type, acttype ORDER BY n DESC", (lo, hi)):
        say(f"   {cut(r['transaction_type'], 44):44} {cut(r['acttype'], 16):16} {r['n']:5}  {cut(r['amt'], 12):>12}")
    say("")
    say("LEDGERS (act_ledger_parent) by group - the parties money goes to")
    for r in q("SELECT g.groupname, COUNT(*) AS n, GROUP_CONCAT(l.ledgername ORDER BY l.ledgername SEPARATOR ', ') AS names "
               "FROM act_ledger_parent l LEFT JOIN act_groupparent g ON g.groupid = l.groupid GROUP BY g.groupname ORDER BY n DESC"):
        say(f"   {cut(r['groupname'], 28):28} {r['n']:4}  {cut(r['names'], 150)}")
    say("")
    say("NON-SALE ENTRIES TODAY (what the board calls payments)")
    rows = q("SELECT p.transactionid, p.transactiondate, p.transaction_type, p.acttype, p.amount, p.remarks, "
             "c.ledgername AS credit, d.ledgername AS debit FROM act_paymentorrecipt p "
             "LEFT JOIN act_ledger_parent c ON c.accountid = p.creditaccountid "
             "LEFT JOIN act_ledger_parent d ON d.accountid = p.dabitaccountid "
             "WHERE p.transactiondate >= %s AND p.transactiondate < %s AND (p.transaction_type IS NULL OR p.transaction_type NOT LIKE 'POS%%') "
             "ORDER BY p.transactiondate", (lo, hi))
    if not rows:
        say("   none")
    for r in rows[-60:]:
        say(f"   {cut(r['transactiondate'], 19)}  {cut(r['transaction_type'], 40):40} {cut(r['acttype'], 14):14} {cut(r['amount'], 10):>10}  "
            f"cr={cut(r['credit'], 20)} dr={cut(r['debit'], 20)}  {cut(r['remarks'], 30)}")
    say("")

    # 2b. the purchase entry screen's scratch tables (rows exist only while something is typed, unsaved)
    say("PURCHASE SCREEN SCRATCH TABLES (rows = something typed, not yet saved)")
    for t in ("temp_purchase", "temp_inv_purchase_item_parent", "temp_inv_purchase_item_details", "temp_purchase_data_parent", "temp_purchase_data_child", "temp_kitchen_purchase", "temp_store"):
        if not src.has(t):
            continue
        try:
            rows = q(f"SELECT * FROM `{t}` LIMIT 10")
            cnt = q(f"SELECT COUNT(*) AS n FROM `{t}`")[0]["n"]
        except Exception as e:
            say(f"   {t}: ? ({e})")
            continue
        say(f"   {t}: {cnt} row(s)")
        for r in rows:
            say("      " + " | ".join(f"{k}={cut(v, 22)}" for k, v in r.items() if v not in (None, "", 0, 0.0, "0")))
    say("")

    say("PURCHASE LINES WITHOUT A SAVED HEAD (typed on the screen, voucher not saved yet)")
    rows = q("SELECT d.purid, d.itemid, d.quantity, d.unitcoast, d.ptotal, d.LastUpdated FROM svr_inv_purchase_item_details d "
             "LEFT JOIN svr_inv_purchase_item_parent p ON p.id = d.purid WHERE p.id IS NULL ORDER BY d.purid, d.id")
    say(f"   {len(rows)} line(s)")
    for r in rows[-40:]:
        say("   " + " | ".join(f"{k}={cut(v, 22)}" for k, v in r.items()))
    say("")
    say("PURCHASE DETAILS TOUCHED IN THE WINDOW - by voucher (qty_lft changes on every sale, so old lines show too)")
    for r in q("SELECT d.purid, COUNT(*) AS n, MIN(d.LastUpdated) AS lo, MAX(d.LastUpdated) AS hi, p.donetime AS head_saved FROM svr_inv_purchase_item_details d "
               "LEFT JOIN svr_inv_purchase_item_parent p ON p.id = d.purid WHERE d.LastUpdated >= %s AND d.LastUpdated < %s GROUP BY d.purid, p.donetime ORDER BY d.purid DESC LIMIT 20", (lo, hi)):
        say(f"   voucher {cut(r['purid'],6):6} lines {r['n']:4}  {cut(r['lo'],19)} .. {cut(r['hi'],19)}   head saved: {cut(r['head_saved'],19)}")
    say("")

    # 3. purchase heads and other likely spend tables
    for t, col in (("svr_inv_purchase_item_parent", "donetime"), ("svr_inv_purchase_item_parent", "LastUpdated"),
                   ("mess_expense", "LastUpdated"), ("svr_payroll_salary_payment", "LastUpdated"),
                   ("svr_payroll_advance_salary", "LastUpdated"), ("act_paymentorrecipt_parent", "LastUpdated"),
                   ("temp_act_paymentorrecipt", "LastUpdated"), ("svr_suppler_outstanding", "LastUpdated"),
                   ("svr_inv_stock_flow", "donedate")):
        if not src.has(t):
            continue
        try:
            rows = q(f"SELECT * FROM `{t}` WHERE `{col}` >= %s AND `{col}` < %s ORDER BY `{col}` LIMIT 15", (lo, hi))
        except Exception as e:
            say(f"{t} by {col}: ? ({e})")
            continue
        say(f"{t} by {col}: {len(rows)} row(s)" + (" (first 15)" if len(rows) == 15 else ""))
        for r in rows:
            if t == "svr_inv_stock_flow":
                say("   " + " | ".join(f"{k}={cut(v, 18)}" for k, v in r.items() if k in ("item_id", "donedate", "qty", "transaction_type", "purchase_rate", "batch_no")))
            else:
                say("   " + " | ".join(f"{k}={cut(v, 22)}" for k, v in r.items() if v not in (None, "", 0, 0.0, "0")))
        say("")

    src.close()
    text = "\n".join(out)
    (HERE / "probe_today.txt").write_text(text, encoding="utf-8")
    print(text)
    print(f"\nwrote {HERE / 'probe_today.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
