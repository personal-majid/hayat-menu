#!/usr/bin/env python3
"""Drop the owner's real photos into photos/, cropped and graded to match."""
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter, ImageChops
import os

SRC = "/root/.claude/uploads/8a26f137-7962-5a1e-afa4-636e6022ee2c/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photos")

# real photo  ->  which dish ids it should fill, and how to crop it
PLAN = [
  ("106ae5f3-IMG_3316.png",  ["overloaded-mandi"],                 "center"),
  ("106ae5f3-IMG_3316.png",  ["chicken-mandi"],                    "top"),
  ("a35e9c94-IMG_3324.jpeg", ["beef-mandi","af-masala","g3"],      "center"),
  ("dd399121-IMG_3325.jpeg", ["sh-masala","sh-regular","af-peri"], "center"),
  ("e53b8f6e-IMG_3317.jpeg", ["br-chicken","br-beef","br-mutton","br-chatti","br-fish"], "center"),
  ("02c7ab0a-IMG_3318.jpeg", ["d7"],                               "center"),
  ("59bbbc11-IMG_3323.jpeg", ["d10","d13","d8"],                   "center"),
  ("77d2ecca-IMG_3319.jpeg", ["x1"],                               "center"),
  ("a8245257-IMG_3322.jpeg", ["d5","x3","d3"],                     "center"),
]

W, H = 1000, 750

def crop43(im, how):
    w, h = im.size
    want = W / H
    if w / h > want:                       # too wide -> trim sides
        nw = int(h * want)
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:                                  # too tall -> trim top/bottom
        nh = int(w / want)
        y = 0 if how == "top" else (h - nh) // 2
        im = im.crop((0, y, w, y + nh))
    return im.resize((W, H), Image.LANCZOS)

def grade(im):
    """Warm it slightly and darken the corners so it sits with the brand."""
    im = ImageEnhance.Color(im).enhance(1.10)
    im = ImageEnhance.Contrast(im).enhance(1.07)
    r, g, b = im.split()                          # gentle warm push
    r = r.point(lambda v: min(255, int(v * 1.045)))
    b = b.point(lambda v: int(v * 0.965))
    im = Image.merge("RGB", (r, g, b))
    m = Image.new("L", (W, H), 0)                 # vignette
    ImageDraw.Draw(m).ellipse([-W*.22, -H*.26, W*1.22, H*1.26], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(130))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    return Image.composite(im, Image.blend(im, dark, 0.42), m)

n = 0
for fname, ids, how in PLAN:
    p = os.path.join(SRC, fname)
    if not os.path.exists(p):
        print("missing", fname); continue
    base = Image.open(p).convert("RGB")
    if min(base.size) < 700:                      # gentle upscale for the small ones
        f = 900 / min(base.size)
        base = base.resize((int(base.width*f), int(base.height*f)), Image.LANCZOS)
        base = base.filter(ImageFilter.UnsharpMask(radius=2, percent=105, threshold=3))
    img = grade(crop43(base, how))
    for i in ids:
        img.save(os.path.join(OUT, i + ".jpg"), quality=80, optimize=True, progressive=True)
        print("photo ->", i); n += 1
print(n, "dishes now use real photos")
