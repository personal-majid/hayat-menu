#!/usr/bin/env python3
"""
VMENU probe - what is in the database, so the sync can be widened.

Writes probe_report.txt next to this file: every table, its columns and
types, row count, the date range of any date columns, and three recent
sample rows (values cut to 40 characters). Read-only; uses the same
[vmenu] login as config.ini.

    .venv\\Scripts\\python vmenu_probe.py
"""
from __future__ import annotations

import configparser
import datetime as dt
import decimal
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    cfg = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
    cfg.read(HERE / "config.ini", encoding="utf-8")
    if not cfg.has_section("vmenu"):
        print("config.ini has no [vmenu] section - run install.bat first")
        return 1
    v = cfg["vmenu"]
    import pymysql
    import pymysql.cursors
    con = pymysql.connect(host=v.get("host", "127.0.0.1"), port=v.getint("port", 3306), user=v.get("user"),
                          password=v.get("password", ""), database=v.get("database"),
                          cursorclass=pymysql.cursors.DictCursor, read_timeout=60, connect_timeout=10)
    cur = con.cursor()
    out = []
    say = out.append

    def cut(x):
        if isinstance(x, (dt.datetime, dt.date, dt.time)):
            return x.isoformat(sep=" ")
        if isinstance(x, decimal.Decimal):
            return str(x)
        if isinstance(x, bytes):
            return "<bytes %d>" % len(x)
        s = str(x) if x is not None else "NULL"
        return s if len(s) <= 40 else s[:37] + "..."

    cur.execute("SELECT VERSION() AS v, DATABASE() AS d")
    r = cur.fetchone()
    say(f"VMENU PROBE  {dt.datetime.now():%Y-%m-%d %H:%M}   server {r['v']}   database {r['d']}")
    say("=" * 96)
    cur.execute("SHOW TABLES")
    tables = [list(x.values())[0] for x in cur.fetchall()]
    say(f"{len(tables)} tables\n")

    # counts first, so the big ones stand out
    counts = {}
    for t in tables:
        try:
            cur.execute(f"SELECT COUNT(*) AS n FROM `{t}`")
            counts[t] = cur.fetchone()["n"]
        except Exception as e:
            counts[t] = f"? ({e})"
    say("TABLE                                    ROWS")
    for t in sorted(tables, key=lambda x: -(counts[x] if isinstance(counts[x], int) else -1)):
        say(f"{t:40} {counts[t]}")
    say("")

    for t in tables:
        say("-" * 96)
        say(f"TABLE {t}   rows={counts[t]}")
        cur.execute(f"SHOW FULL COLUMNS FROM `{t}`")
        cols = cur.fetchall()
        for c in cols:
            say(f"   {c['Field']:32} {c['Type']:24} {'NULL' if c['Null']=='YES' else '    '} {c['Key'] or '':4} {c.get('Comment') or ''}")
        # date ranges
        dcols = [c["Field"] for c in cols if any(k in c["Type"].lower() for k in ("date", "time"))]
        for d in dcols:
            try:
                cur.execute(f"SELECT MIN(`{d}`) AS lo, MAX(`{d}`) AS hi, COUNT(`{d}`) AS n FROM `{t}`")
                r = cur.fetchone()
                say(f"   range {d}: {cut(r['lo'])} .. {cut(r['hi'])}  ({r['n']} set)")
            except Exception:
                pass
        # samples: most recent by a date column if any, else last rows
        if isinstance(counts[t], int) and counts[t] > 0:
            order = f" ORDER BY `{dcols[0]}` DESC" if dcols else ""
            try:
                cur.execute(f"SELECT * FROM `{t}`{order} LIMIT 3")
                rows = cur.fetchall()
                say("   samples:")
                for row in rows:
                    say("     " + " | ".join(f"{k}={cut(val)}" for k, val in row.items()))
            except Exception as e:
                say(f"   samples: ? ({e})")
        say("")

    # relationships by column name: which tables share id-like columns
    say("=" * 96)
    say("SHARED COLUMNS (likely joins)")
    seen = {}
    for t in tables:
        cur.execute(f"SHOW COLUMNS FROM `{t}`")
        for c in cur.fetchall():
            f = c["Field"].lower()
            if f.endswith("id") or f.endswith("no") or f in ("token_no", "tableno", "kotno"):
                seen.setdefault(f, []).append(t)
    for f, ts in sorted(seen.items(), key=lambda kv: -len(kv[1])):
        if len(ts) > 1:
            say(f"   {f:28} {', '.join(ts)}")

    (HERE / "probe_report.txt").write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {HERE / 'probe_report.txt'}  ({len(tables)} tables)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
