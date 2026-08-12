#!/usr/bin/env python3
"""Generate rich food artwork PNGs for the demo.

Not photographs — original rendered art. Swap in real photos later by
dropping a jpg with the same filename into photos/.
"""
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 1200, 900
random.seed(7)


# ---------------------------------------------------------------- helpers
def canvas(top, bot):
    im = Image.new("RGB", (W, H), bot)
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)],
               fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return im


def radial_light(im, cx, cy, r, colour, strength=0.5):
    lay = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(lay)
    steps = 42
    for i in range(steps, 0, -1):
        f = i / steps
        rr = int(r * f)
        c = tuple(int(colour[k] * (1 - f) * strength) for k in range(3))
        d.ellipse([cx - rr, cy - rr * 0.75, cx + rr, cy + rr * 0.75], fill=c)
    lay = lay.filter(ImageFilter.GaussianBlur(70))
    return ImageChops.add(im, lay)


def vignette(im, power=0.85):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([-W * 0.28, -H * 0.34, W * 1.28, H * 1.34], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(180))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    return Image.composite(im, Image.blend(im, dark, power), m)


def depth(im, keep=0.52):
    """Blur the edges, keep the middle crisp — reads as a camera lens."""
    blurred = im.filter(ImageFilter.GaussianBlur(9))
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse([W * (.5 - keep), H * (.5 - keep * .95),
                               W * (.5 + keep), H * (.5 + keep * .95)], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(150))
    return Image.composite(im, blurred, m)


def sheen(im, cx, cy, r=340):
    """A soft specular bloom over the food so it does not look flat."""
    lay = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(lay)
    for i in range(20, 0, -1):
        f = i / 20
        rr = int(r * f)
        v = int(46 * (1 - f))
        d.ellipse([cx - rr, cy - rr * .62, cx + rr, cy + rr * .62], fill=(v, int(v * .92), int(v * .7)))
    return ImageChops.add(im, lay.filter(ImageFilter.GaussianBlur(90)))


def grain(im, amount=7):
    n = Image.effect_noise((W, H), amount).convert("L").convert("RGB")
    return ImageChops.blend(im, ImageChops.overlay(im, n), 0.16)


def shadow(im, box, blur=45, alpha=150):
    lay = Image.new("L", (W, H), 0)
    ImageDraw.Draw(lay).ellipse(box, fill=alpha)
    lay = lay.filter(ImageFilter.GaussianBlur(blur))
    dark = Image.new("RGB", (W, H), (8, 4, 2))
    return Image.composite(dark, im, lay)


def blob(d, cx, cy, rx, ry, base, light, rot=0, wob=0.10, n=26):
    """An irregular lit lump — reads as a piece of meat or fried chicken."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        f = 1 + random.uniform(-wob, wob)
        x = cx + math.cos(a + rot) * rx * f
        y = cy + math.sin(a + rot) * ry * f
        pts.append((x, y))
    d.polygon(pts, fill=base)
    # top-left highlight
    hl = []
    for i in range(n):
        a = 2 * math.pi * i / n
        f = 1 + random.uniform(-wob, wob)
        x = cx - rx * .18 + math.cos(a + rot) * rx * .62 * f
        y = cy - ry * .24 + math.sin(a + rot) * ry * .58 * f
        hl.append((x, y))
    d.polygon(hl, fill=light)


def plate(im, cx, cy, rx, ry, rim=(232, 224, 205), face=(246, 241, 228)):
    im = shadow(im, [cx - rx * 1.08, cy - ry * .5, cx + rx * 1.08, cy + ry * 1.9], 55, 165)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(196, 186, 166))
    d.ellipse([cx - rx, cy - ry - 12, cx + rx, cy + ry - 12], fill=rim)
    d.ellipse([cx - rx * .84, cy - ry * .8 - 12, cx + rx * .84, cy + ry * .8 - 12], fill=face)
    return im


def rice_mound(d, cx, cy, rx, ry, warm=True):
    base = (214, 178, 112) if warm else (226, 210, 176)
    top = (240, 214, 156) if warm else (245, 238, 216)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=base)
    d.ellipse([cx - rx * .93, cy - ry * 1.12, cx + rx * .93, cy + ry * .82], fill=top)
    for _ in range(1500):                       # individual grains
        a = random.uniform(0, 2 * math.pi)
        rr = math.sqrt(random.random())
        x = cx + math.cos(a) * rx * .92 * rr
        y = cy - ry * .14 + math.sin(a) * ry * .88 * rr
        L = random.uniform(6, 13)
        ang = random.uniform(0, math.pi)
        sh = random.randint(-26, 22)
        c = (max(0, min(255, top[0] + sh)), max(0, min(255, top[1] + sh)),
             max(0, min(255, top[2] + sh - 6)))
        d.line([(x, y), (x + math.cos(ang) * L, y + math.sin(ang) * L)], fill=c, width=3)
    for _ in range(26):                          # spice and cashew
        x = cx + random.uniform(-rx * .82, rx * .82)
        y = cy - ry * .12 + random.uniform(-ry * .6, ry * .7)
        k = random.random()
        if k < .34:
            d.ellipse([x, y, x + 9, y + 9], fill=(150, 62, 34))          # chilli
        elif k < .62:
            d.ellipse([x, y, x + 13, y + 10], fill=(226, 196, 140))      # cashew
        else:
            d.ellipse([x, y, x + 7, y + 7], fill=(92, 58, 26))           # clove


def garnish(d, cx, cy, spread):
    for _ in range(16):
        x = cx + random.uniform(-spread, spread)
        y = cy + random.uniform(-spread * .34, spread * .34)
        r = random.uniform(7, 15)
        g = random.choice([(96, 138, 52), (122, 162, 62), (74, 112, 44)])
        d.ellipse([x, y, x + r * 1.7, y + r], fill=g)


def coals(d):
    for i in range(46):
        x = 90 + i * 24 + random.uniform(-8, 8)
        y = 700 + random.uniform(-16, 16)
        r = random.uniform(14, 26)
        heat = random.random()
        c = (200, 82, 30) if heat > .74 else (58, 40, 34) if heat > .3 else (34, 24, 22)
        d.ellipse([x, y, x + r * 1.5, y + r], fill=c)


# ---------------------------------------------------------------- scenes
def scene_mandi(meat=(140, 74, 34), light=(184, 108, 52), title="mandi"):
    im = canvas((66, 42, 20), (26, 16, 9))
    im = radial_light(im, 600, 250, 620, (255, 196, 110), .55)
    im = plate(im, 600, 560, 430, 132)
    d = ImageDraw.Draw(im)
    rice_mound(d, 600, 520, 350, 118)
    blob(d, 505, 430, 150, 106, meat, light, rot=.3)
    blob(d, 700, 470, 122, 86, meat, light, rot=1.1)
    blob(d, 610, 388, 98, 68, meat, light, rot=2.2)
    garnish(d, 600, 596, 320)
    d.ellipse([300, 566, 352, 606], fill=(226, 208, 160))
    d.ellipse([856, 578, 902, 614], fill=(178, 62, 40))
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_grill(tint=(150, 78, 36), flame=True):
    im = canvas((70, 40, 18), (24, 14, 8))
    im = radial_light(im, 600, 760, 760, (255, 132, 40), .55)   # coal glow behind
    im = radial_light(im, 600, 250, 560, (255, 200, 120), .45)
    im = plate(im, 600, 580, 420, 128)
    d = ImageDraw.Draw(im)
    lt = tuple(min(255, c + 48) for c in tint)
    dk = tuple(max(0, c - 44) for c in tint)
    for (x, y, sc, rot) in [(455, 470, 1.0, .3), (720, 500, .92, 1.5),
                            (600, 400, .82, 2.4), (596, 552, .70, .9)]:
        blob(d, x, y, 168 * sc, 118 * sc, tint, lt, rot=rot)
        for _ in range(26):                       # char striping
            a2 = random.uniform(0, 2 * math.pi); rr = random.uniform(.15, .9)
            px = x + math.cos(a2) * 150 * sc * rr
            py = y + math.sin(a2) * 100 * sc * rr
            d.ellipse([px, py, px + random.uniform(14, 34), py + random.uniform(6, 12)], fill=dk)
        for _ in range(10):                       # glisten
            a2 = random.uniform(0, 2 * math.pi); rr = random.uniform(.1, .6)
            px = x - 20 + math.cos(a2) * 120 * sc * rr
            py = y - 24 + math.sin(a2) * 76 * sc * rr
            d.ellipse([px, py, px + random.uniform(8, 20), py + random.uniform(5, 11)],
                      fill=tuple(min(255, c + 78) for c in tint))
    garnish(d, 600, 618, 330)
    d.ellipse([286, 590, 356, 630], fill=(242, 236, 214))       # garlic dip
    for (lx, ly) in [(846, 592), (886, 606)]:                   # lemon wedge
        d.ellipse([lx, ly, lx + 62, ly + 40], fill=(232, 208, 68))
        d.ellipse([lx + 8, ly + 6, lx + 54, ly + 34], fill=(246, 234, 130))
    return grain(vignette(depth(sheen(im, 600, 480))))


def scene_biryani():
    im = canvas((60, 36, 16), (22, 14, 8))
    im = radial_light(im, 600, 260, 600, (255, 190, 104), .5)
    im = shadow(im, [220, 620, 980, 830], 60, 170)
    d = ImageDraw.Draw(im)
    d.ellipse([230, 300, 970, 800], fill=(96, 52, 28))       # clay pot
    d.ellipse([250, 316, 950, 784], fill=(128, 70, 38))
    d.ellipse([272, 336, 928, 700], fill=(58, 32, 18))
    rice_mound(d, 600, 500, 300, 132)
    blob(d, 540, 442, 116, 84, (126, 62, 30), (168, 92, 44), rot=.6)
    blob(d, 690, 470, 96, 68, (126, 62, 30), (168, 92, 44), rot=1.8)
    d.ellipse([470, 540, 540, 596], fill=(246, 238, 214))    # boiled egg
    d.ellipse([492, 556, 520, 580], fill=(238, 190, 66))
    garnish(d, 600, 560, 250)
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_broast():
    im = canvas((66, 44, 18), (24, 15, 8))
    im = radial_light(im, 600, 280, 600, (255, 200, 118), .55)
    im = plate(im, 600, 600, 400, 120)
    d = ImageDraw.Draw(im)
    for (x, y, r) in [(430, 470, 1.0), (700, 500, .92), (570, 400, .84), (820, 452, .8)]:
        blob(d, x, y, 132 * r, 116 * r, (176, 112, 40), (226, 168, 74), rot=random.random() * 3)
        for _ in range(50):                      # craggy crust
            a = random.uniform(0, 2 * math.pi); rr = random.uniform(.3, 1) * 120 * r
            px = x + math.cos(a) * rr; py = y + math.sin(a) * rr * .88
            d.ellipse([px, py, px + random.uniform(7, 17), py + random.uniform(6, 13)],
                      fill=random.choice([(206, 146, 58), (162, 96, 32), (236, 190, 106)]))
    d.ellipse([300, 596, 400, 648], fill=(244, 238, 220))    # dip
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_curry(tint=(196, 88, 38)):
    im = canvas((58, 36, 16), (22, 13, 7))
    im = radial_light(im, 600, 300, 560, (255, 186, 106), .5)
    im = shadow(im, [250, 640, 950, 810], 55, 165)
    d = ImageDraw.Draw(im)
    d.ellipse([250, 360, 950, 790], fill=(84, 44, 24))
    d.ellipse([268, 376, 932, 772], fill=(118, 64, 34))
    d.ellipse([300, 392, 900, 640], fill=(58, 30, 16))
    d.ellipse([318, 404, 882, 628], fill=tint)
    lt = tuple(min(255, c + 40) for c in tint)
    d.ellipse([348, 416, 852, 612], fill=lt)
    for _ in range(9):
        x = random.uniform(400, 800); y = random.uniform(452, 578)
        blob(d, x, y, random.uniform(34, 56), random.uniform(26, 40),
             (128, 66, 30), (166, 96, 44), rot=random.random() * 3, wob=.16, n=16)
    for _ in range(40):                           # oil beads
        x = random.uniform(360, 840); y = random.uniform(430, 596)
        r = random.uniform(4, 13)
        d.ellipse([x, y, x + r, y + r * .8], fill=(238, 176, 62))
    garnish(d, 600, 470, 190)
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_bread():
    im = canvas((62, 44, 20), (24, 16, 9))
    im = radial_light(im, 600, 280, 580, (255, 206, 130), .5)
    im = plate(im, 600, 600, 400, 120)
    d = ImageDraw.Draw(im)
    for i, y in enumerate([560, 500, 444, 396]):
        rx = 320 - i * 22
        d.ellipse([600 - rx, y - 46, 600 + rx, y + 46], fill=(184, 138, 74))
        d.ellipse([600 - rx, y - 56, 600 + rx, y + 36], fill=(232, 200, 138))
        for _ in range(120):                      # flaky layers + blisters
            a = random.uniform(0, 2 * math.pi); rr = math.sqrt(random.random())
            x = 600 + math.cos(a) * rx * .92 * rr
            yy = y - 10 + math.sin(a) * 40 * rr
            if random.random() < .3:
                d.ellipse([x, yy, x + random.uniform(5, 12), yy + random.uniform(4, 9)],
                          fill=(140, 92, 40))
            else:
                d.arc([x - 20, yy - 8, x + 20, yy + 8], 0, 180, fill=(210, 172, 108), width=2)
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_wrap():
    im = canvas((60, 42, 20), (22, 15, 8))
    im = radial_light(im, 600, 300, 560, (255, 200, 124), .5)
    im = plate(im, 600, 620, 380, 112)
    d = ImageDraw.Draw(im)
    for dx, rot in [(-120, -14), (110, 12)]:
        x0, y0 = 600 + dx, 470
        im2 = Image.new("RGBA", (420, 620), (0, 0, 0, 0))
        dd = ImageDraw.Draw(im2)
        dd.rounded_rectangle([90, 40, 330, 580], 116, fill=(224, 194, 132, 255))
        dd.rounded_rectangle([104, 54, 316, 566], 104, fill=(242, 220, 168, 255))
        dd.ellipse([104, 30, 316, 132], fill=(196, 154, 88, 255))
        dd.ellipse([128, 44, 292, 118], fill=(150, 82, 38, 255))
        for _ in range(16):
            px = random.uniform(140, 280); py = random.uniform(52, 106)
            dd.ellipse([px, py, px + 16, py + 12],
                       fill=random.choice([(112, 156, 60, 255), (198, 74, 44, 255),
                                           (240, 232, 206, 255)]))
        im2 = im2.rotate(rot, resample=Image.BICUBIC, expand=False)
        im.paste(im2, (int(x0 - 210), int(y0 - 310)), im2)
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_drink(liquid=(226, 132, 38), mint=False):
    im = canvas((40, 30, 18), (16, 11, 7))
    im = radial_light(im, 600, 320, 520, (255, 214, 150), .48)
    im = shadow(im, [430, 760, 780, 850], 45, 160)
    d = ImageDraw.Draw(im)
    gx0, gx1, gy0, gy1 = 452, 748, 190, 790
    d.polygon([(gx0, gy0), (gx1, gy0), (gx1 - 44, gy1), (gx0 + 44, gy1)], fill=(60, 48, 38))
    d.polygon([(gx0 + 14, gy0 + 90), (gx1 - 14, gy0 + 90), (gx1 - 52, gy1 - 16),
               (gx0 + 52, gy1 - 16)], fill=liquid)
    lt = tuple(min(255, c + 44) for c in liquid)
    d.polygon([(gx0 + 26, gy0 + 100), (gx0 + 96, gy0 + 100), (gx0 + 118, gy1 - 30),
               (gx0 + 62, gy1 - 30)], fill=lt)
    for _ in range(34):                            # ice + bubbles
        x = random.uniform(gx0 + 40, gx1 - 60); y = random.uniform(gy0 + 120, gy1 - 60)
        r = random.uniform(14, 44)
        d.rounded_rectangle([x, y, x + r, y + r * .82], 8, fill=(255, 255, 255, 60),
                            outline=(255, 255, 255))
    if mint:
        for (mx, my, mr) in [(510, 150, 1.0), (600, 118, 1.15), (676, 156, .9)]:
            d.ellipse([mx, my, mx + 96 * mr, my + 60 * mr], fill=(88, 152, 52))
            d.ellipse([mx + 12, my + 8, mx + 76 * mr, my + 46 * mr], fill=(126, 190, 74))
        d.ellipse([700, 196, 812, 300], fill=(196, 226, 96))
        d.ellipse([718, 214, 794, 282], fill=(232, 244, 152))
    d.polygon([(gx0, gy0), (gx1, gy0), (gx1 - 6, gy0 + 26), (gx0 + 6, gy0 + 26)],
              fill=(226, 220, 208))
    d.rounded_rectangle([700, 60, 726, 300], 13, fill=(232, 96, 108))   # straw
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_dessert():
    im = canvas((48, 32, 24), (18, 12, 9))
    im = radial_light(im, 600, 300, 540, (255, 206, 178), .5)
    im = shadow(im, [400, 720, 800, 820], 45, 155)
    d = ImageDraw.Draw(im)
    d.polygon([(440, 340), (760, 340), (716, 760), (484, 760)], fill=(214, 206, 190))
    d.polygon([(456, 356), (744, 356), (704, 744), (496, 744)], fill=(242, 236, 222))
    d.polygon([(462, 560), (738, 560), (702, 742), (498, 742)], fill=(198, 62, 96))
    d.polygon([(458, 460), (742, 460), (738, 560), (462, 560)], fill=(246, 238, 220))
    for (cx, cy, c) in [(520, 300, (244, 200, 214)), (680, 300, (198, 154, 106)),
                        (600, 250, (250, 240, 216))]:
        d.ellipse([cx - 92, cy - 92, cx + 92, cy + 92], fill=c)
        d.ellipse([cx - 70, cy - 78, cx + 40, cy + 20],
                  fill=tuple(min(255, k + 18) for k in c))
    for _ in range(22):
        x = random.uniform(470, 730); y = random.uniform(200, 340)
        d.ellipse([x, y, x + 13, y + 13], fill=(92, 54, 32))
    return grain(vignette(depth(sheen(im, 600, 470))))


def scene_salad():
    im = canvas((36, 48, 20), (14, 18, 9))
    im = radial_light(im, 600, 300, 540, (210, 255, 160), .38)
    im = plate(im, 600, 600, 380, 116)
    d = ImageDraw.Draw(im)
    for _ in range(70):
        x = random.uniform(320, 880); y = random.uniform(400, 600)
        r = random.uniform(28, 74)
        d.ellipse([x, y, x + r * 1.5, y + r],
                  fill=random.choice([(96, 150, 52), (124, 178, 62), (72, 116, 42)]))
    for _ in range(16):
        x = random.uniform(360, 840); y = random.uniform(420, 590)
        r = random.uniform(20, 40)
        d.ellipse([x, y, x + r, y + r], fill=random.choice([(198, 58, 42), (232, 122, 56)]))
    return grain(vignette(depth(sheen(im, 600, 470))))



def scene_fish():
    im = canvas((62, 40, 18), (22, 14, 8))
    im = radial_light(im, 600, 260, 600, (255, 200, 120), .52)
    im = plate(im, 600, 580, 420, 128)
    d = ImageDraw.Draw(im)
    for (cx, cy, sc, rot) in [(470, 470, 1.0, -.18), (740, 512, .88, .22), (600, 396, .74, .06)]:
        L, Hh = 240 * sc, 118 * sc
        body = [(cx - L/2, cy), (cx - L*.30, cy - Hh*.52), (cx + L*.16, cy - Hh*.50),
                (cx + L*.40, cy - Hh*.20), (cx + L*.40, cy + Hh*.20),
                (cx + L*.16, cy + Hh*.50), (cx - L*.30, cy + Hh*.52)]
        def rot_pts(pts, a):
            import math as _m
            return [(cx + (x-cx)*_m.cos(a) - (y-cy)*_m.sin(a),
                     cy + (x-cx)*_m.sin(a) + (y-cy)*_m.cos(a)) for x, y in pts]
        d.polygon(rot_pts(body, rot), fill=(142, 60, 26))
        inner = [( (x-cx)*.82+cx, (y-cy)*.78+cy-4 ) for x, y in body]
        d.polygon(rot_pts(inner, rot), fill=(196, 92, 34))
        tail = [(cx - L*.50, cy), (cx - L*.74, cy - Hh*.42), (cx - L*.68, cy),
                (cx - L*.74, cy + Hh*.42)]
        d.polygon(rot_pts(tail, rot), fill=(120, 48, 22))
        for k in range(5):                                    # score marks
            fx = cx - L*.22 + k * L*.13
            d.line(rot_pts([(fx, cy - Hh*.34), (fx - 10, cy + Hh*.34)], rot),
                   fill=(84, 32, 14), width=int(7*sc))
        for _ in range(26):                                   # masala flecks
            px = cx + random.uniform(-L*.38, L*.34)
            py = cy + random.uniform(-Hh*.40, Hh*.40)
            d.ellipse([px, py, px + random.uniform(5, 13), py + random.uniform(4, 9)],
                      fill=random.choice([(228, 130, 44), (96, 36, 16), (240, 178, 70)]))
        ex = cx + L*.30; ey = cy - Hh*.16
        d.ellipse([ex, ey, ex + 17*sc, ey + 17*sc], fill=(244, 234, 214))
        d.ellipse([ex + 5*sc, ey + 5*sc, ex + 12*sc, ey + 12*sc], fill=(40, 24, 14))
    garnish(d, 600, 622, 320)
    for (lx, ly) in [(300, 592), (860, 604)]:
        d.ellipse([lx, ly, lx + 66, ly + 42], fill=(228, 206, 66))
        d.ellipse([lx + 9, ly + 6, lx + 57, ly + 36], fill=(246, 236, 138))
    return grain(vignette(depth(sheen(im, 600, 480))))


def scene_meals():
    im = canvas((58, 40, 18), (22, 14, 8))
    im = radial_light(im, 600, 250, 600, (255, 204, 128), .5)
    im = plate(im, 600, 590, 450, 138)
    d = ImageDraw.Draw(im)
    rice_mound(d, 480, 520, 210, 96, warm=False)
    for (bx, by, br, col) in [(760, 452, 82, (188, 62, 34)), (836, 552, 66, (208, 148, 52)),
                              (706, 576, 60, (120, 156, 58))]:
        d.ellipse([bx - br, by - br*.72, bx + br, by + br*.72], fill=(78, 44, 24))
        d.ellipse([bx - br*.88, by - br*.62, bx + br*.88, by + br*.62], fill=col)
        d.ellipse([bx - br*.6, by - br*.44, bx + br*.2, by + br*.1],
                  fill=tuple(min(255, c + 34) for c in col))
    d.ellipse([300, 556, 372, 600], fill=(232, 214, 168))      # pappadam
    d.ellipse([306, 550, 366, 592], fill=(246, 232, 190))
    garnish(d, 560, 630, 300)
    return grain(vignette(depth(sheen(im, 600, 490))))


def scene_prawns():
    im = canvas((60, 34, 16), (22, 13, 7))
    im = radial_light(im, 600, 280, 580, (255, 180, 100), .52)
    im = plate(im, 600, 590, 400, 122)
    d = ImageDraw.Draw(im)
    import math as _m
    for i in range(9):
        cx = 460 + random.uniform(0, 300); cy = 430 + random.uniform(0, 150)
        r = random.uniform(46, 66); a0 = random.uniform(0, 6.28)
        pts = []
        for k in range(14):
            a = a0 + k * 0.34
            rr = r * (1 - k * 0.035)
            pts.append((cx + _m.cos(a) * rr, cy + _m.sin(a) * rr * .8))
        d.line(pts, fill=(196, 78, 40), width=26, joint="curve")
        d.line(pts, fill=(232, 122, 58), width=15, joint="curve")
    for _ in range(26):
        x = random.uniform(430, 800); y = random.uniform(420, 590)
        d.ellipse([x, y, x + random.uniform(6, 14), y + random.uniform(5, 10)],
                  fill=random.choice([(88, 42, 20), (240, 186, 74), (108, 148, 54)]))
    garnish(d, 600, 616, 300)
    return grain(vignette(depth(sheen(im, 600, 490))))


# ---------------------------------------------------------------- output
JOBS = {
  "fish-fry":      lambda: scene_fish(),
  "grill-fish":    lambda: scene_fish(),
  "chorum-meenum": lambda: scene_meals(),
  "fish-curry":    lambda: scene_curry((172, 54, 30)),
  "prawns-roast":  lambda: scene_prawns(),
  "squid-roast":   lambda: scene_prawns(),
  "overloaded-mandi": lambda: scene_mandi((150, 80, 36), (196, 120, 58)),
  "beef-mandi":       lambda: scene_mandi((108, 56, 28), (150, 84, 40)),
  "chicken-mandi":    lambda: scene_mandi((168, 100, 42), (214, 146, 68)),
  "af-regular":       lambda: scene_grill((154, 84, 36)),
  "af-green":         lambda: scene_grill((126, 142, 52)),
  "af-pepper":        lambda: scene_grill((96, 70, 48)),
  "af-curry":         lambda: scene_grill((116, 132, 50)),
  "af-masala":        lambda: scene_grill((168, 72, 32)),
  "af-peri":          lambda: scene_grill((190, 58, 30)),
  "af-afghani":       lambda: scene_grill((208, 186, 140)),
  "af-cheesy":        lambda: scene_grill((222, 168, 58)),
  "sh-regular":       lambda: scene_grill((156, 88, 40), flame=False),
  "sh-pepper":        lambda: scene_grill((100, 72, 50), flame=False),
  "sh-green":         lambda: scene_grill((128, 146, 54), flame=False),
  "sh-masala":        lambda: scene_grill((172, 76, 34), flame=False),
  "br-chicken":       lambda: scene_biryani(),
  "br-beef":          lambda: scene_biryani(),
  "br-mutton":        lambda: scene_biryani(),
  "br-fish":          lambda: scene_biryani(),
  "br-chatti":        lambda: scene_biryani(),
  "broast":           lambda: scene_broast(),
  "dragon":           lambda: scene_curry((188, 54, 32)),
  "g1":  lambda: scene_curry((226, 142, 70)),
  "g2":  lambda: scene_curry((196, 92, 40)),
  "g3":  lambda: scene_curry((188, 62, 34)),
  "g4":  lambda: scene_curry((226, 182, 118)),
  "g5":  lambda: scene_curry((200, 66, 38)),
  "g6":  lambda: scene_curry((206, 116, 56)),
  "g7":  lambda: scene_curry((222, 176, 62)),
  "g8":  lambda: scene_curry((132, 162, 62)),
  "b1":  lambda: scene_bread(), "b2": lambda: scene_bread(),
  "b3":  lambda: scene_bread(), "b4": lambda: scene_bread(), "b5": lambda: scene_bread(),
  "w1":  lambda: scene_wrap(),  "w2": lambda: scene_wrap(),  "w3": lambda: scene_wrap(),
  "w4":  lambda: scene_wrap(),  "w5": lambda: scene_wrap(),  "w6": lambda: scene_broast(),
  "s1":  lambda: scene_salad(), "s2": lambda: scene_curry((160, 62, 40)),
  "s3":  lambda: scene_curry((178, 88, 34)), "s4": lambda: scene_mandi((196, 170, 130), (226, 208, 168)),
  "s5":  lambda: scene_curry((196, 132, 56)), "s6": lambda: scene_curry((228, 206, 148)),
  "d1":  lambda: scene_drink((196, 224, 84), True),
  "d2":  lambda: scene_drink((226, 74, 96)),
  "d3":  lambda: scene_drink((240, 142, 34)),
  "d4":  lambda: scene_drink((240, 196, 44)),
  "d5":  lambda: scene_drink((232, 116, 56)),
  "d6":  lambda: scene_drink((184, 46, 74)),
  "d7":  lambda: scene_drink((124, 196, 78), True),
  "d8":  lambda: scene_drink((230, 92, 118), True),
  "d9":  lambda: scene_drink((240, 148, 40), True),
  "d10": lambda: scene_drink((58, 168, 220), True),
  "d11": lambda: scene_drink((238, 200, 48), True),
  "d12": lambda: scene_drink((226, 162, 46), True),
  "d13": lambda: scene_drink((222, 66, 96), True),
  "x1":  lambda: scene_dessert(), "x2": lambda: scene_dessert(),
  "x3":  lambda: scene_dessert(), "x4": lambda: scene_dessert(),
}

if __name__ == "__main__":
    import os, sys
    out = os.path.join(os.path.dirname(__file__), "photos")
    os.makedirs(out, exist_ok=True)
    only = sys.argv[1:] or list(JOBS)
    for name in only:
        random.seed(abs(hash(name)) % 99991)
        img = JOBS[name]()
        img.save(os.path.join(out, name + ".jpg"), quality=82, optimize=True)
        print("wrote photos/%s.jpg" % name)
