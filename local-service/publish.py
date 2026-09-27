#!/usr/bin/env python3
"""
Publish the day logs as plain files, so the owner board reads history from
a static place and Firebase is only the live feed and the fallback.

    daylog/2026-09-27.json  ->  github.com/<repo>/2026-09-27.json
    (built here)            ->  github.com/<repo>/index.json

Uses the GitHub contents API - no git on the PC needed, works as SYSTEM.
Only files whose content changed are sent; state lives in publish_state.json.

config.ini:
    [publish]
    repo = personal-majid/hayat-data      ; public repo, created empty
    token = <fine-grained token, Contents: read+write, this repo only>
    branch = main

    python publish.py            send what changed
    python publish.py status     what is published, what is pending
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import logging
import logging.handlers
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
DAYS = HERE / "daylog"
STATE = HERE / "publish_state.json"
LOG = logging.getLogger("publish")


def load_config():
    import configparser
    cfg = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
    cfg.read(HERE / "config.ini", encoding="utf-8")
    return cfg


def index_entry(doc: dict) -> dict | None:
    """The same shape the day log puts in vm_meta/days."""
    import daylog as D
    have = doc.get("records") or {}
    if not (have or doc.get("purchases") or doc.get("payments")):
        return None
    return {"rev": doc.get("revenue") or 0, "bills": doc.get("settled") or 0, "open": doc.get("open") or 0,
            "paidOut": doc.get("paidOut") or 0, "purchases": doc.get("purchaseTotal") or 0,
            "close": D.closure(have), "hours": D.hourly(have), "updatedAt": doc.get("updatedAt")}


class Repo:
    def __init__(self, repo: str, token: str, branch: str = "main"):
        self.base = f"https://api.github.com/repos/{repo}/contents/"
        self.branch = branch
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "hayat-publish"})

    def sha_of(self, name: str) -> str | None:
        r = self.s.get(self.base + name, params={"ref": self.branch}, timeout=30)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json().get("sha")

    def put(self, name: str, data: bytes, message: str) -> str:
        body = {"message": message, "content": base64.b64encode(data).decode(), "branch": self.branch}
        sha = self.sha_of(name)
        if sha:
            body["sha"] = sha
        r = self.s.put(self.base + name, json=body, timeout=60)
        if r.status_code == 409:                      # someone else wrote meanwhile: once more with a fresh sha
            body["sha"] = self.sha_of(name)
            r = self.s.put(self.base + name, json=body, timeout=60)
        r.raise_for_status()
        got = r.json()["content"]["sha"]
        want = hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()   # git's own id for these bytes
        if got != want:
            raise RuntimeError(f"{name}: GitHub stored a different file (sha {got[:8]} != {want[:8]})")
        return got


def run(cfg, only_status=False) -> int:
    if not cfg.has_section("publish") or not cfg.get("publish", "token", fallback="").strip():
        print("config.ini has no [publish] token - nothing published (the board falls back to Firebase)")
        return 0
    repo = cfg.get("publish", "repo", fallback="personal-majid/hayat-data").strip()
    branch = cfg.get("publish", "branch", fallback="main").strip() or "main"
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    files, index = {}, {}
    for p in sorted(DAYS.glob("????-??-??.json")):
        raw = p.read_bytes()
        try:
            doc = json.loads(raw)
        except Exception:
            continue
        entry = index_entry(doc)
        if entry is None:
            continue
        index[p.stem] = entry
        files[p.name] = raw
    files["index.json"] = json.dumps({"days": index, "updatedAt": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
                                     ensure_ascii=False, separators=(",", ":")).encode()
    changed_days = [n for n, b in files.items() if n != "index.json" and state.get(n) != hashlib.sha1(b).hexdigest()]
    # index.json changes every run (updatedAt): send it only when a day changed, or never sent
    pending = changed_days + (["index.json"] if changed_days or "index.json" not in state else [])
    if only_status:
        print(f"{len(files) - 1} day files, {len(pending)} pending: {', '.join(pending[:8])}{' ...' if len(pending) > 8 else ''}")
        return 0
    if not pending:
        LOG.info("nothing changed")
        return 0
    gh = Repo(repo, cfg.get("publish", "token").strip(), branch)
    sent = 0
    for name in pending[:40]:                                  # a big first run spreads over a few ticks
        try:
            gh.put(name, files[name], f"{name} {dt.datetime.now():%Y-%m-%d %H:%M}")
            state[name] = hashlib.sha1(files[name]).hexdigest()
            sent += 1
            time.sleep(0.3)
        except Exception as e:
            LOG.error("%s: %s", name, e)
            break
    STATE.write_text(json.dumps(state, indent=0), encoding="utf-8")
    LOG.info("published %d/%d file(s) to %s", sent, len(pending), repo)
    print(f"published {sent} of {len(pending)} pending to {repo}")
    return 0 if sent == len(pending[:40]) else 1


def main(argv):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    (HERE / "logs").mkdir(exist_ok=True)
    fh = logging.handlers.RotatingFileHandler(HERE / "logs" / "publish.log", maxBytes=300_000, backupCount=2, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOG.addHandler(fh)
    sys.path.insert(0, str(HERE))
    return run(load_config(), only_status=(len(argv) > 1 and argv[1] == "status"))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
