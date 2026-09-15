#!/usr/bin/env python3
"""Print-ready A5 review card for the tables.

    python3 make_card.py

Writes print/review-card-a5.pdf. The QR points at the menu's review page,
which asks for a star and then offers Google and a private word side by side.
"""
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
import segno, io, os

URL   = "https://personal-majid.github.io/hayat-menu/#/review"
OUT   = "print/review-card-a5.pdf"
LOGO  = "assets/logo.png"
MLFONT = "/usr/share/fonts/truetype/malayalam/Meera-Regular.ttf"

W, H  = A5

# The two themes the menu itself switches between. One card each, so the
# print matches whatever the tablet is showing.
THEMES = {
  "night": dict(
    out   = "print/review-card-a5-night.pdf",
    bg    = (0.063, 0.043, 0.024),   # deep brown
    gold  = (0.788, 0.635, 0.294),
    cream = (0.953, 0.937, 0.886),
    muted = (0.612, 0.541, 0.424),
    qr_dark = "#1a1006",
    ml_rgb  = (156, 138, 108),
  ),
  "garden": dict(
    out   = "print/review-card-a5-garden.pdf",
    bg    = (0.929, 0.949, 0.867),   # flyer cream-green
    gold  = (0.247, 0.420, 0.094),   # deep olive
    cream = (0.106, 0.141, 0.063),   # near-black green, for text on cream
    muted = (0.373, 0.431, 0.294),
    qr_dark = "#24350F",
    ml_rgb  = (95, 110, 75),
    logo_tint = (47, 74, 18),
  ),
}

def qr_image(url, dark="#1a1006"):
    buf = io.BytesIO()
    segno.make(url, error="h").save(buf, kind="png", scale=18, border=2,
                                    dark=dark, light="#ffffff")
    buf.seek(0)
    return ImageReader(Image.open(buf))

def logo_for(T):
    """The mark is cream and gold, which disappears on the light garden card.
       There it is redrawn as one deep-olive silhouette instead."""
    img = Image.open(LOGO).convert("RGBA")
    tint = T.get("logo_tint")
    if tint:
        px = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = tint + (a,)
    return ImageReader(img)

def malayalam(text, px=90, colour=(156, 138, 108)):
    """ReportLab cannot shape Indic scripts. PIL (with raqm) can, so the
       Malayalam line is drawn there and dropped in as an image."""
    if not os.path.exists(MLFONT):
        return None
    f = ImageFont.truetype(MLFONT, px)
    box = ImageDraw.Draw(Image.new("RGBA", (8, 8))).textbbox((0, 0), text, font=f)
    pad = px // 5
    img = Image.new("RGBA", (box[2]-box[0]+2*pad, box[3]-box[1]+2*pad), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((pad-box[0], pad-box[1]), text, font=f, fill=colour+(255,))
    return ImageReader(img)

os.makedirs("print", exist_ok=True)

def draw_card(name, T):
    INK, GOLD, CREAM, MUTED = T["bg"], T["gold"], T["cream"], T["muted"]
    c = canvas.Canvas(T["out"], pagesize=A5)
    c.setTitle("Hayat Fish and Mandi Restaurant - review card")

    c.setFillColorRGB(*INK); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColorRGB(*GOLD); c.setLineWidth(0.7)
    c.rect(6*mm, 6*mm, W-12*mm, H-12*mm, fill=0, stroke=1)

    logo = logo_for(T); lw, lh = logo.getSize()
    logo_w = 34*mm; logo_h = logo_w*lh/lw
    c.drawImage(logo, (W-logo_w)/2, H-13*mm-logo_h, width=logo_w, height=logo_h, mask="auto")

    c.setFillColorRGB(*CREAM); c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(W/2, H-62*mm, "Thank you for coming.")
    c.setFillColorRGB(*GOLD); c.setFont("Helvetica-Bold", 11.5)
    c.drawCentredString(W/2, H-70*mm, "Now help us serve you better.")

    ml = malayalam("ഇനി കൂടുതൽ മികവാകാൻ സഹായിക്കൂ", colour=T["ml_rgb"])
    if ml:
        mw = 82*mm
        c.drawImage(ml, (W-mw)/2, H-80*mm, width=mw,
                    height=mw*ml.getSize()[1]/ml.getSize()[0], mask="auto")

    qr_side = 60*mm; plate = qr_side + 9*mm
    px, py = (W-plate)/2, H-87*mm-plate
    c.setFillColorRGB(1, 1, 1)
    c.roundRect(px, py, plate, plate, 4*mm, fill=1, stroke=0)
    c.drawImage(qr_image(URL, T["qr_dark"]), px+4.5*mm, py+4.5*mm,
                width=qr_side, height=qr_side, mask="auto")

    c.setFillColorRGB(*GOLD); c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(W/2, py-11*mm, "\u2605 \u2605 \u2605 \u2605 \u2605")
    c.setFillColorRGB(*CREAM); c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(W/2, py-19*mm, "If you have a moment, we would love to hear from you.")
    c.setFillColorRGB(*MUTED); c.setFont("Helvetica", 8.5)
    c.drawCentredString(W/2, py-26*mm, "We read every word ourselves.")

    c.setFillColorRGB(*MUTED); c.setFont("Helvetica", 7.5)
    c.drawCentredString(W/2, 12*mm, "Hayat Fish and Mandi Restaurant  \u00b7  NH966, Makkaraparamba")

    c.showPage(); c.save()
    print("wrote", T["out"])

for name, T in THEMES.items():
    draw_card(name, T)
print("->", URL)
