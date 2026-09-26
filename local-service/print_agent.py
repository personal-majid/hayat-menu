#!/usr/bin/env python3
"""
Hayat print agent - kitchen tickets and bills on LAN thermal printers.

The website cannot talk to a printer on the shop network, so it writes a
job to Firestore (print_jobs/<id>) and this small program, running on the
shop PC, prints it. Two kitchens, one counter:

    main   the mandi / alfaham / meals kitchen
    front  shawarma, fish, gravies, salads, juices
    bill   the counter printer for the customer's bill

Which printer is which is set in the office (Menu -> Printing) and lands
in Firestore at settings/print; this program follows it live. A printer
is reached one of two ways:

    192.168.1.50   or  192.168.1.50:9100     a LAN printer (ESC/POS, port 9100)
    win:POS-80                               a printer installed in Windows (USB)

config.ini only needs the [firebase] section (key_file, project_id).

Tickets are drawn as an image (Pillow) and sent as a raster, so any
script prints - Malayalam item names included - and every printer draws
the same ticket, whatever fonts it carries.

    python print_agent.py check     tell me what is reachable
    python print_agent.py test      one sample ticket to every printer
    python print_agent.py run       serve jobs (what the scheduled task runs)
"""
from __future__ import annotations

import configparser
import datetime as dt
import io
import json
import logging
import logging.handlers
import socket
import sys
import threading
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOG = logging.getLogger("hayat.print")

# ---------------------------------------------------------------- config

def load_cfg() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
    cfg.read(HERE / "config.ini", encoding="utf-8")
    return cfg


# what the office set, from settings/print; refreshed by a listener in serve()
SETTINGS: dict = {}


def settings_doc(db):
    return db.collection("settings").document("print")


def load_settings(db):
    global SETTINGS
    try:
        d = settings_doc(db).get()
        SETTINGS = (d.to_dict() or {}) if d.exists else {}
    except Exception as e:
        LOG.warning("settings: %s", e)
    return SETTINGS


def printers(cfg=None) -> dict:
    out = {}
    for k in ("main", "front", "bill"):
        v = str(SETTINGS.get(k) or "").strip()
        if v:
            out[k] = v
    return out


def paper_px(cfg=None) -> int:
    return 384 if str(SETTINGS.get("paper", "80")) == "58" else 576


# ---------------------------------------------------------------- fonts

def _font(size: int, bold=False):
    """Nirmala UI carries Malayalam on Windows; the rest are fallbacks."""
    from PIL import ImageFont
    names = (["nirmalab.ttf", "seguisb.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold
             else ["nirmala.ttf", "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"])
    dirs = [Path(r"C:\Windows\Fonts"), HERE / "fonts", HERE.parent / "fonts",
            Path("/usr/share/fonts/truetype/dejavu"), Path("/usr/share/fonts/truetype/noto")]
    for n in names:
        for d in dirs:
            p = d / n
            if p.exists():
                try:
                    return ImageFont.truetype(str(p), size)
                except Exception:
                    pass
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


# ---------------------------------------------------------------- drawing

class Sheet:
    """A tall canvas we draw down; cropped to what was used."""

    def __init__(self, width: int):
        from PIL import Image, ImageDraw
        self.w = width
        self.img = Image.new("1", (width, 4000), 1)
        self.d = ImageDraw.Draw(self.img)
        self.y = 8
        self.m = 10                     # side margin

    def _tw(self, text, font):
        """width from the glyphs, height from the font's own metrics -
        a bbox of "Half" is shorter than one of "Hg" and lines collided."""
        box = self.d.textbbox((0, 0), text, font=font)
        asc, desc = font.getmetrics()
        return box[2] - box[0], asc + desc

    def text(self, s, size=26, bold=False, align="left", gap=6, x=None, invert=False):
        f = _font(size, bold)
        lines = self._wrap(s, f, self.w - 2 * self.m - (x or 0))
        for ln in lines:
            tw, th = self._tw(ln, f)
            if align == "center":
                px = (self.w - tw) // 2
            elif align == "right":
                px = self.w - self.m - tw
            else:
                px = self.m + (x or 0)
            if invert:
                self.d.rectangle((0, self.y - 2, self.w, self.y + th + 4), fill=0)
                self.d.text((px, self.y), ln, font=f, fill=1)
            else:
                self.d.text((px, self.y), ln, font=f, fill=0)
            self.y += th + gap
        return self

    def row(self, left, right, size=26, bold=False, gap=6, rbold=None):
        fl, fr = _font(size, bold), _font(size, bold if rbold is None else rbold)
        rw, rh = self._tw(right, fr)
        avail = self.w - 2 * self.m - rw - 12
        lines = self._wrap(left, fl, avail)
        for i, ln in enumerate(lines):
            tw, th = self._tw(ln, fl)
            self.d.text((self.m, self.y), ln, font=fl, fill=0)
            if i == 0:
                self.d.text((self.w - self.m - rw, self.y), right, font=fr, fill=0)
            self.y += th + gap
        return self

    def rule(self, dashed=True, gap=10):
        if dashed:
            x = self.m
            while x < self.w - self.m:
                self.d.line((x, self.y, min(x + 8, self.w - self.m), self.y), fill=0, width=2)
                x += 14
        else:
            self.d.line((self.m, self.y, self.w - self.m, self.y), fill=0, width=2)
        self.y += gap
        return self

    def box(self, s, size=26):
        f = _font(size, True)
        lines = self._wrap(s, f, self.w - 2 * self.m - 24)
        top = self.y
        self.y += 10
        for ln in lines:
            tw, th = self._tw(ln, f)
            self.d.text((self.m + 12, self.y), ln, font=f, fill=0)
            self.y += th + 6
        self.y += 6
        self.d.rectangle((self.m, top, self.w - self.m, self.y), outline=0, width=3)
        self.y += 10
        return self

    def space(self, n=10):
        self.y += n
        return self

    def _wrap(self, s, f, width):
        out = []
        for para in str(s).split("\n"):
            words, line = para.split(" "), ""
            for w in words:
                t = (line + " " + w).strip()
                if self._tw(t, f)[0] <= width or not line:
                    line = t
                else:
                    out.append(line)
                    line = w
            out.append(line)
        return out

    def done(self):
        return self.img.crop((0, 0, self.w, self.y + 30))


def rupee(n) -> str:
    try:
        n = int(round(float(n or 0)))
    except Exception:
        n = 0
    return "\u20b9" + f"{n:,}"          # drawn by us, so the sign is always there


def when(ts) -> str:
    try:
        d = dt.datetime.fromtimestamp(float(ts) / 1000)
    except Exception:
        d = dt.datetime.now()
    return d.strftime("%d %b %I:%M %p").lstrip("0")


def draw_kot(job: dict, ticket: dict, idx: int, total: int, width: int):
    o = job.get("order", {})
    s = Sheet(width)
    s.text("KOT  ·  " + str(ticket.get("station", "")).upper(), 40, True, "center", gap=10, invert=True)
    s.text(str(o.get("id", "")), 46, True, "center", gap=4)
    s.row("PHONE" if o.get("kind") == "ticket" else "DELIVERY", when(job.get("at")), 22)
    s.row(str(o.get("name") or ""), ("Rider: " + o["rider"]) if o.get("rider") else "", 22)
    if o.get("wantAt"):
        s.row("FOR", when(o["wantAt"]), 26, True)
    s.rule()
    n = 0
    for l in ticket.get("lines", []):
        q = int(l.get("q", 1) or 1)
        n += q
        s.text(f"{q} ×  {l.get('name', '')}", 34, True, gap=0)
        if l.get("label"):
            s.text(str(l["label"]), 22, False, x=54, gap=2)
        s.space(8)
    if o.get("note"):
        s.space(4)
        s.box(str(o["note"]), 28)
    s.rule()
    foot = (f"Ticket {idx} of {total}  ·  " if total > 1 else "") + f"{n} items"
    s.text(foot, 20, False, "center")
    return s.done()


def draw_bill(job: dict, width: int, cfg):
    o = job.get("order", {})
    m = job.get("money", {}) or {}
    s = Sheet(width)
    s.text("HAYAT", 44, True, "center", gap=0)
    s.text("Fish & Mandi Restaurant", 20, False, "center", gap=2)
    addr = str(SETTINGS.get("address") or "Makkaraparamba").strip()
    phone = str(SETTINGS.get("phone") or "").strip()
    s.text(addr + ("  ·  " + phone if phone else ""), 18, False, "center", gap=8)
    s.rule()
    s.row("Bill · " + str(o.get("id", "")), when(job.get("at")), 22, True)
    s.row(str(o.get("name") or ""), str(o.get("phone") or ""), 22)
    if o.get("addr"):
        s.text(str(o["addr"]), 19, False, gap=4)
    s.rule()
    for l in o.get("lines", []):
        q = int(l.get("q", 1) or 1)
        s.row(f"{q}×  {l.get('name', '')}", rupee(q * float(l.get("price", 0) or 0)), 24)
        if l.get("label"):
            s.text(str(l["label"]), 19, False, x=36, gap=2)
    s.rule()
    total = m.get("total", o.get("total", 0))
    if m.get("off"):
        s.row("Subtotal", rupee(m.get("sub", 0)), 22)
        s.row(str(job.get("offLabel") or "Discount"), "− " + rupee(m["off"]), 22)
    s.row("TOTAL", rupee(total), 36, True)
    s.space(6)
    if o.get("paid"):
        s.text("PAID · " + ("UPI" if o.get("payMode") == "upi" else "Cash"), 26, True, "center", gap=4, invert=True)
    else:
        s.text("TO PAY  " + rupee(total), 30, True, "center", gap=4, invert=True)
        s.text("Cash or UPI to the rider", 20, False, "center")
    if o.get("rider"):
        s.text("Rider: " + str(o["rider"]), 20, False, "center")
    s.space(6)
    s.text("Thank you  ·  " + str(job.get("site") or ""), 19, False, "center")
    return s.done()


# ---------------------------------------------------------------- ESC/POS

def escpos_raster(img) -> bytes:
    """GS v 0: the whole ticket as one raster block, then feed and cut."""
    from PIL import ImageOps
    img = img.convert("1")
    w, h = img.size
    bw = (w + 7) // 8
    img = ImageOps.invert(img.convert("L")).convert("1")      # 1 = black for the printer
    data = img.tobytes()
    out = bytearray(b"\x1b@")                                  # init
    out += b"\x1dv0\x00" + bytes([bw & 255, bw >> 8, h & 255, h >> 8]) + data
    out += b"\n\n\n\n"
    out += b"\x1dV\x01"                                        # partial cut
    return bytes(out)


def send(target: str, payload: bytes, timeout=8.0):
    if target.lower().startswith("win:"):
        name = target[4:].strip()
        import win32print                                       # pywin32; only on Windows
        h = win32print.OpenPrinter(name)
        try:
            win32print.StartDocPrinter(h, 1, ("Hayat ticket", None, "RAW"))
            win32print.StartPagePrinter(h)
            win32print.WritePrinter(h, payload)
            win32print.EndPagePrinter(h)
            win32print.EndDocPrinter(h)
        finally:
            win32print.ClosePrinter(h)
        return
    host, _, port = target.partition(":")
    with socket.create_connection((host.strip(), int(port or 9100)), timeout=timeout) as sk:
        sk.sendall(payload)


def lan_scan(timeout=0.35) -> list[str]:
    """Every address on this PC's /24 with port 9100 open: the ESC/POS
    printers on the shop Wi-Fi, found without pressing anything."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sk:
            sk.connect(("8.8.8.8", 80))
            me = sk.getsockname()[0]
    except Exception:
        return []
    base = me.rsplit(".", 1)[0]
    found, lock = [], threading.Lock()

    def probe(i):
        ip = f"{base}.{i}"
        try:
            with socket.create_connection((ip, 9100), timeout=timeout):
                with lock:
                    found.append(ip)
        except Exception:
            pass

    ts = [threading.Thread(target=probe, args=(i,), daemon=True) for i in range(1, 255)]
    for t in ts: t.start()
    for t in ts: t.join(timeout + 1)
    return sorted(found, key=lambda x: int(x.rsplit(".", 1)[1]))


def reachable(target: str) -> bool:
    if target.lower().startswith("win:"):
        try:
            import win32print
            return any(p[2] == target[4:].strip() for p in win32print.EnumPrinters(2))
        except Exception:
            return False
    host, _, port = target.partition(":")
    try:
        with socket.create_connection((host.strip(), int(port or 9100)), timeout=2.5):
            return True
    except Exception:
        return False


# ---------------------------------------------------------------- jobs

def render_job(job: dict, cfg) -> list[tuple[str, "Image"]]:
    """(printer key, image) per sheet."""
    width = paper_px(cfg)
    kind = job.get("kind", "kot")
    if kind == "bill":
        return [("bill", draw_bill(job, width, cfg))]
    tickets = job.get("tickets") or []
    return [(t.get("station", "main"), draw_kot(job, t, i + 1, len(tickets), width))
            for i, t in enumerate(tickets)]


def print_job(job: dict, cfg, prn: dict) -> dict:
    """Print every sheet; return {station: 'ok'|'error text'}."""
    res = {}
    for key, img in render_job(job, cfg):
        target = prn.get(key) or prn.get("main")
        if not target:
            res[key] = "no printer set for " + key
            continue
        try:
            copies = int(SETTINGS.get("copies_" + key) or 1)
            payload = escpos_raster(img)
            for _ in range(max(1, copies)):
                send(target, payload)
            res[key] = "ok"
        except Exception as e:
            res[key] = f"{type(e).__name__}: {e}"
    return res


def firestore_client(cfg):
    import firebase_admin
    from firebase_admin import credentials, firestore
    key = HERE / cfg.get("firebase", "key_file", fallback="firebase-key.json")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(key)),
                                      {"projectId": cfg.get("firebase", "project_id", fallback="h-menu")})
    return firestore.client()


def serve(cfg):
    from google.cloud.firestore_v1 import FieldFilter
    db = firestore_client(cfg)
    load_settings(db)
    col = db.collection("print_jobs")
    lock = threading.Lock()
    LOG.info("watching print_jobs; printers %s", printers())

    def on_settings(docs, changes, read_time):
        global SETTINGS
        for d in docs:
            SETTINGS = d.to_dict() or {}
        LOG.info("settings changed; printers %s paper %s", printers(), SETTINGS.get("paper"))

    settings_doc(db).on_snapshot(on_settings)

    def heartbeat():
        n = 0
        while True:
            try:
                beat = {
                    "seen": int(time.time() * 1000),
                    "printers": {k: ("ok" if reachable(v) else "unreachable") for k, v in printers().items()},
                    "host": socket.gethostname(),
                }
                if n % 5 == 0:                       # every five minutes: who is on the network
                    beat["found"] = lan_scan()
                    beat["foundAt"] = beat["seen"]
                col.document("_agent").set(beat, merge=True)
                if n % 30 == 0:                      # twice an hour: forget printed jobs older than a day
                    cutoff = int(time.time() * 1000) - 86400000
                    for d in col.where(filter=FieldFilter("done", "==", True)).stream():
                        if (d.to_dict() or {}).get("sentAt", 0) < cutoff:
                            d.reference.delete()
            except Exception as e:
                LOG.warning("heartbeat: %s", e)
            n += 1
            time.sleep(60)

    threading.Thread(target=heartbeat, daemon=True).start()

    def on_snapshot(docs, changes, read_time):
        for ch in changes:
            if ch.type.name not in ("ADDED", "MODIFIED"):
                continue
            d = ch.document
            if d.id.startswith("_"):
                continue
            job = d.to_dict() or {}
            if job.get("done") or job.get("tries", 0) >= 3:
                continue
            with lock:
                res = print_job(job, cfg, printers())
                ok = all(v == "ok" for v in res.values())
                LOG.info("job %s %s -> %s", d.id, job.get("kind"), res)
                d.reference.set({"done": ok, "result": res, "tries": job.get("tries", 0) + 1,
                                 "printedAt": int(time.time() * 1000)}, merge=True)

    q = col.where(filter=FieldFilter("done", "==", False))
    watch = q.on_snapshot(on_snapshot)
    try:
        while True:
            time.sleep(3600)
    finally:
        watch.unsubscribe()


def sample_job() -> dict:
    now = int(time.time() * 1000)
    order = {"id": "TEST1", "name": "Test order", "phone": "9846000000", "addr": "Near Juma Masjid, Makkaraparamba",
             "kind": "order", "at": now, "rider": "Rafi", "note": "Less spicy, extra sauce", "paid": False,
             "lines": [{"name": "Chicken Mandi", "label": "Half", "q": 2, "price": 320},
                       {"name": "Fish Fry", "label": "", "q": 1, "price": 180},
                       {"name": "Mint Lime", "label": "", "q": 2, "price": 60}],
             "total": 940}
    return {"kind": "kot", "at": now, "site": "personal-majid.github.io/hayat-menu", "order": order,
            "tickets": [{"station": "main", "lines": order["lines"][:1]},
                        {"station": "front", "lines": order["lines"][1:]}],
            "money": {"sub": 940, "off": 0, "total": 940}, "offLabel": ""}


def main(argv):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        fh = logging.handlers.RotatingFileHandler(HERE / "print_agent.log", maxBytes=500_000, backupCount=2, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        LOG.addHandler(fh)
    except Exception:
        pass
    cfg = load_cfg()
    cmd = argv[1] if len(argv) > 1 else "check"
    try:
        db = firestore_client(cfg)
        load_settings(db)
        print("firebase  OK")
    except Exception as e:
        print("firebase  FAILED:", e)
        return 1
    prn = printers()

    if cmd == "check":
        print("printers on this network (port 9100):", ", ".join(lan_scan()) or "none found")
        if not prn:
            print("No printers set yet. Office -> Menu -> Printing, then run check again.")
            return 1
        for k, v in prn.items():
            print(f"{k:6} {v:24} {'OK' if reachable(v) else 'NOT REACHABLE'}")
        return 0

    if cmd == "test":
        job = sample_job()
        out = HERE / "print_test"
        out.mkdir(exist_ok=True)
        for key, img in render_job(job, cfg) + render_job(dict(job, kind="bill"), cfg):
            img.save(out / f"{key}.png")
        print("previews written to", out)
        if prn:
            print(print_job(job, cfg, prn))
            print(print_job(dict(job, kind="bill"), cfg, prn))
        return 0

    if cmd == "run":
        while True:
            try:
                serve(cfg)
            except Exception:
                LOG.error("serve crashed:\n%s", traceback.format_exc())
                time.sleep(15)

    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv) or 0)
