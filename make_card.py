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
INK   = (0.063, 0.043, 0.024)
GOLD  = (0.788, 0.635, 0.294)
CREAM = (0.953, 0.937, 0.886)
MUTED = (0.612, 0.541, 0.424)

def qr_image(url):
    buf = io.BytesIO()
    segno.make(url, error="h").save(buf, kind="png", scale=18, border=2,
                                    dark="#1a1006", light="#ffffff")
    buf.seek(0)
    return ImageReader(Image.open(buf))

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
c = canvas.Canvas(OUT, pagesize=A5)
c.setTitle("Hayat - review card")

c.setFillColorRGB(*INK); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setStrokeColorRGB(*GOLD); c.setLineWidth(0.7)
c.rect(6*mm, 6*mm, W-12*mm, H-12*mm, fill=0, stroke=1)

logo = ImageReader(LOGO); lw, lh = logo.getSize()
logo_w = 34*mm; logo_h = logo_w*lh/lw
c.drawImage(logo, (W-logo_w)/2, H-13*mm-logo_h, width=logo_w, height=logo_h, mask="auto")

c.setFillColorRGB(*CREAM); c.setFont("Helvetica-Bold", 20)
c.drawCentredString(W/2, H-62*mm, "How was it?")
c.setFillColorRGB(*MUTED); c.setFont("Helvetica", 10)
c.drawCentredString(W/2, H-70*mm, "Scan the code and tell us in twenty seconds.")

ml = malayalam("കോഡ് സ്കാൻ ചെയ്യൂ "
               "— ഇരുപത് സെക്കൻഡ് മതി")
if ml:
    mw = 82*mm
    c.drawImage(ml, (W-mw)/2, H-80*mm, width=mw,
                height=mw*ml.getSize()[1]/ml.getSize()[0], mask="auto")

qr_side = 60*mm; plate = qr_side + 9*mm
px, py = (W-plate)/2, H-87*mm-plate
c.setFillColorRGB(1, 1, 1)
c.roundRect(px, py, plate, plate, 4*mm, fill=1, stroke=0)
c.drawImage(qr_image(URL), px+4.5*mm, py+4.5*mm, width=qr_side, height=qr_side, mask="auto")

c.setFillColorRGB(*GOLD); c.setFont("Helvetica-Bold", 12)
c.drawCentredString(W/2, py-11*mm, "★ ★ ★ ★ ★")
c.setFillColorRGB(*CREAM); c.setFont("Helvetica", 10)
c.drawCentredString(W/2, py-18*mm, "Rate us, then post it on Google")
c.setFillColorRGB(*MUTED); c.setFont("Helvetica", 8)
c.drawCentredString(W/2, py-24*mm, "Or tell us privately on the same screen. Both doors, always.")

c.setFillColorRGB(*GOLD); c.setFont("Helvetica-Bold", 9)
c.drawCentredString(W/2, 15*mm, "@zaman_yemenmandi")
c.setFillColorRGB(*MUTED); c.setFont("Helvetica", 7.5)
c.drawCentredString(W/2, 10.5*mm, "Hayat Fish & Mandi Restaurant  ·  NH966, Makkaraparamba")

c.showPage(); c.save()
print("wrote", OUT, "->", URL)
