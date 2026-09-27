#!/usr/bin/env python3
"""
The shop PC looks after itself.

Every 5 minutes (Task Scheduler, SYSTEM, from boot):
  1. every Hayat task must exist - a missing one is re-created;
  2. every task must be alive - a stale log or a stopped agent is restarted;
  3. once an hour the last 14 days are checked against Firebase and any day
     that differs is rebuilt from VMENU (daylog.py sync);
  4. a health note goes to Firebase (vm_meta/health) so the owner board can
     show "shop PC ok" from anywhere.

    python watchdog.py           one round (what the task runs)
    python watchdog.py status    print the health note, change nothing
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import logging.handlers
import os
import platform
import socket
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PYW = HERE / ".venv" / "Scripts" / "pythonw.exe"
PY = HERE / ".venv" / "Scripts" / "python.exe"
LOG = logging.getLogger("watchdog")

# name -> (script, args, schedule, every, log file, max quiet minutes)
TASKS = {
    "Hayat Day Log":    ("daylog.py",     "tick", "MINUTE",  1,  "logs/daylog.log",     4),
    "Hayat VMENU Sync": ("vmenu_sync.py", "tick", "MINUTE",  2,  "logs/vmenu_sync.log", 8),
    "Hayat Publish":    ("publish.py",    "",     "MINUTE",  10, "logs/publish.log",    35),
    "Hayat Print Agent":("print_agent.py","run",  "ONSTART", 0,  None,                  0),
    "Hayat Watchdog":   ("watchdog.py",   "",     "MINUTE",  5,  "logs/watchdog.log",   0),
}


def sch(*args, timeout=60):
    r = subprocess.run(["schtasks", *args], capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def task_state(name):
    """(exists, status text) from schtasks."""
    rc, out = sch("/Query", "/TN", name, "/FO", "CSV", "/NH")
    if rc != 0:
        return False, ""
    line = [l for l in out.splitlines() if l.strip()]
    if not line:
        return True, ""
    cols = [c.strip('"') for c in line[-1].split('","')]
    return True, (cols[2] if len(cols) >= 3 else "")


def create_task(name, script, args, schedule, every):
    tr = f'"{PYW}" "{HERE / script}"' + (f" {args}" if args else "")
    cmd = ["/Create", "/F", "/TN", name, "/SC", schedule, "/RU", "SYSTEM", "/RL", "HIGHEST", "/TR", tr]
    if schedule == "MINUTE":
        cmd += ["/MO", str(every)]
    rc, out = sch(*cmd)
    return rc == 0, out.strip()


def log_age_min(rel):
    p = HERE / rel
    if not rel or not p.exists():
        return None
    return (dt.datetime.now() - dt.datetime.fromtimestamp(p.stat().st_mtime)).total_seconds() / 60


def last_line(rel):
    p = HERE / rel
    if not rel or not p.exists():
        return ""
    try:
        with p.open("rb") as f:
            f.seek(0, 2)
            n = f.tell()
            f.seek(max(0, n - 4000))
            lines = f.read().decode("utf-8", "replace").strip().splitlines()
        return lines[-1] if lines else ""
    except Exception:
        return ""


def has_publish_token():
    try:
        import configparser
        c = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
        c.read(HERE / "config.ini", encoding="utf-8")
        return bool(c.get("publish", "token", fallback="").strip())
    except Exception:
        return False


def round_once(fix=True):
    actions, tasks = [], {}
    publish_on = has_publish_token()
    for name, (script, args, schedule, every, logf, quiet) in TASKS.items():
        if name == "Hayat Publish" and not publish_on:
            tasks[name] = {"ok": True, "note": "no token - off"}
            continue
        if not (HERE / script).exists():
            tasks[name] = {"ok": False, "note": f"{script} missing"}
            continue
        exists, status = task_state(name)
        if not exists and fix:
            ok, out = create_task(name, script, args, schedule, every)
            actions.append(f"created {name}" if ok else f"could not create {name}: {out[:80]}")
            exists, status = task_state(name)
        age = log_age_min(logf)
        note, ok = status.lower() or "?", True
        if schedule == "ONSTART":
            if status.lower() != "running":
                ok = False
                if fix:
                    rc, _ = sch("/Run", "/TN", name)
                    actions.append(f"restarted {name}" if rc == 0 else f"could not start {name}")
                    ok = task_state(name)[1].lower() == "running"
        elif quiet and (age is None or age > quiet):
            ok = False
            note = f"quiet {int(age)} min" if age is not None else "no log yet"
            if fix:
                sch("/Change", "/TN", name, "/ENABLE")
                rc, _ = sch("/Run", "/TN", name)
                actions.append(f"kicked {name} ({note})" if rc == 0 else f"could not run {name}")
        tasks[name] = {"ok": ok, "note": note, "logAge": None if age is None else round(age, 1), "last": last_line(logf)[-160:] if logf else ""}

    # once an hour: the last 14 days must match Firebase, else rebuild from VMENU
    integrity = None
    stamp = HERE / "logs" / "integrity.stamp"
    last = dt.datetime.fromtimestamp(stamp.stat().st_mtime) if stamp.exists() else None
    if fix and (last is None or (dt.datetime.now() - last).total_seconds() > 3600):
        since = (dt.datetime.now() - dt.timedelta(days=14)).strftime("%Y-%m-%d")
        try:
            r = subprocess.run([str(PY), str(HERE / "daylog.py"), "sync", "--since", since], capture_output=True, text=True, timeout=900)
            head = (r.stdout or "").strip().splitlines()
            integrity = (head[0] if head else "") + ("" if r.returncode == 0 else f" (exit {r.returncode})")
            actions.append("integrity: " + integrity[:120])
        except Exception as e:
            integrity = f"failed: {e}"
            actions.append("integrity failed")
        stamp.parent.mkdir(exist_ok=True)
        stamp.write_text(dt.datetime.now().isoformat())

    health = {"at": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "host": socket.gethostname(),
              "os": platform.platform(), "tasks": tasks, "actions": actions,
              "ok": all(t["ok"] for t in tasks.values()), "integrity": integrity or (last.strftime("%Y-%m-%d %H:%M") if last else None),
              "disk": disk_free()}
    return health


def disk_free():
    try:
        import shutil
        u = shutil.disk_usage(str(HERE))
        return round(u.free / 1e9, 1)
    except Exception:
        return None


def push_health(health):
    try:
        sys.path.insert(0, str(HERE))
        import daylog as D
        db = D.firestore(D.VS.load_config(HERE / "config.ini"))
        db.collection("vm_meta").document("health").set(health, timeout=30)
        return True
    except Exception as e:
        LOG.error("health not sent: %s", e)
        return False


def main(argv):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    (HERE / "logs").mkdir(exist_ok=True)
    fh = logging.handlers.RotatingFileHandler(HERE / "logs" / "watchdog.log", maxBytes=300_000, backupCount=2, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOG.addHandler(fh)
    status_only = len(argv) > 1 and argv[1] == "status"
    h = round_once(fix=not status_only)
    for n, t in h["tasks"].items():
        LOG.info("%-18s %s %s", n, "ok " if t["ok"] else "BAD", t.get("note", ""))
    for a in h["actions"]:
        LOG.warning(a)
    if status_only:
        print(json.dumps(h, indent=1, ensure_ascii=False))
    else:
        push_health(h)
    return 0 if h["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
