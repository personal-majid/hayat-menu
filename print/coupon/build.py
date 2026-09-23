# -*- coding: utf-8 -*-
"""Hayat Fish & Mandi — 10% discount coupon, A5 double sided."""
import base64, os, subprocess, glob
HERE=os.path.dirname(os.path.abspath(__file__)); A=lambda p: os.path.join(HERE,p)

# ---------------- the parts you will actually change ----------------
OFFER      = "10"
OFFER_SUB  = "on your total bill"
OFFER_ML   = "\u0d2c\u0d3f\u0d32\u0d4d\u0d32\u0d3f\u0d7d 10% \u0d15\u0d3f\u0d34\u0d3f\u0d35\u0d4d"
EYEBROW    = "Taste Tradition &nbsp;&middot;&nbsp; Taste Hayat"
SIGNATURE  = "Our Signature Speciality"
SIG_DISH   = "Mangalapuram Fish Fry"
SIG_SUB    = "Authentic coastal flavours"
BACK_TITLE = "More to love at Hayat"
BACK_STRAP = "Authentic flavours &nbsp;&middot;&nbsp; Premium ingredients &nbsp;&middot;&nbsp; Always fresh"
DISHES     = ["Biryani","Mandi","Alfaham","Broast Chicken","Shawaya","Shawarma"]
DELIVERY   = "Delivering happiness in under 30 minutes"
DELIVERY_ML= "\u0d07\u0d2a\u0d4d\u0d2a\u0d4b\u0d7e \u0d13\u0d7c\u0d21\u0d7c \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d42"
TERMS = ["Valid on dine-in only.",
         "Not valid on MRP items.",
         "One coupon per bill. Not valid with other offers."]
PHONES  = ["8296 786 116", "9567 074 930", "8138 096 730"]
ADDRESS = "NH 966, near Punarppa UP School, Makkaraparamba"
INSTA   = "@hayat_fish_n_mandi"
TAGLINE = "Good food, better days"
LOVE    = "\u0d2e\u0d32\u0d2a\u0d4d\u0d2a\u0d41\u0d31\u0d24\u0d4d\u0d24\u0d41 \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d38\u0d4d\u0d28\u0d47\u0d39\u0d24\u0d4d\u0d24\u0d4b\u0d1f\u0d46"
URL_ORDER = "https://wa.me/919844326842?text=Hi%20Hayat%2C%20I%20would%20like%20to%20order"
# --------------------------------------------------------------------

def b64(p,m): return f"data:{m};base64,"+base64.b64encode(open(p,'rb').read()).decode()
LOGO_CREAM=b64(A('assets/logo_cream.png'),'image/png')
LOGO_INK  =b64(A('assets/logo_ink.png'),'image/png')

def qr_svg(url):
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    q=qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=3, box_size=10)
    q.add_data(url); q.make(fit=True)
    m=q.get_matrix(); n=len(m); d=[]
    for y,row in enumerate(m):
        x=0
        while x<n:
            if row[x]:
                x0=x
                while x<n and row[x]: x+=1
                d.append(f"M{x0} {y}h{x-x0}v1h{-(x-x0)}z")
            else: x+=1
    svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
         f'shape-rendering="crispEdges"><path fill="#241811" d="{"".join(d)}"/></svg>')
    return "data:image/svg+xml;base64,"+base64.b64encode(svg.encode()).decode()
QR_ORDER=qr_svg(URL_ORDER)

def _wh(p):
    from PIL import Image as I
    return I.open(A(p)).size
def pic(name, width_mm, cls='cpic', extra=''):
    import os
    ext='png' if os.path.exists(A(f'assets/{name}.png')) else 'jpg'
    w,h=_wh(f'assets/{name}.{ext}')
    return (f'<div class="{cls}" style="width:{width_mm}mm;height:{width_mm*h/w:.1f}mm;'
            f'background-image:url(assets/{name}.{ext});{extra}"></div>')

MARKS=''.join(
  f'<span class="cm h" style="{a}:0;{b}:3mm"></span><span class="cm v" style="{a}:3mm;{b}:0"></span>'
  for a in ('left','right') for b in ('top','bottom'))

CSS="""
@page{size:111mm 154mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Hayat Sans";color:#241811}
.sheet{position:relative;width:111mm;height:154mm;overflow:hidden;page-break-after:always}
.sheet:last-child{page-break-after:auto}
.cm{position:absolute;background:#C9B48A;z-index:9}
.cm.h{width:2.4mm;height:.12mm}.cm.v{width:.12mm;height:2.4mm}

/* ---------- FRONT ---------- */
.front{background:#241811;color:#FBF6EC}
.front::after{content:"";position:absolute;inset:6.5mm;border:.28mm solid #7A5C2E;
  pointer-events:none}
.fin{position:absolute;inset:11mm 10mm 9mm;display:flex;flex-direction:column;
  align-items:center;text-align:center}
.logo{height:13mm;display:block}
.eyebrow{margin-top:4.6mm;font-size:5.2pt;letter-spacing:.46em;color:#D7B478;
  text-transform:uppercase}
.rulepair{display:flex;align-items:center;gap:2.2mm;margin-top:1.8mm}
.rulepair i{display:block;width:11mm;height:0;border-top:.25mm solid #7A5C2E}
.rulepair b{width:1.5mm;height:1.5mm;background:#C0882C;transform:rotate(45deg)}
.big{display:flex;align-items:flex-start;justify-content:center;margin-top:2mm}
.big .n{font-family:"Hayat Serif";font-weight:600;font-size:78pt;line-height:.82;
  letter-spacing:-.02em;color:#FBF6EC;font-variant-numeric:lining-nums;
  font-feature-settings:"lnum" 1,"onum" 0}
.big .p{font-family:"Hayat Serif";font-weight:600;font-size:30pt;line-height:1;
  color:#C0882C;margin-top:3.4mm}
.off{font-family:"Hayat Serif";font-weight:600;font-size:15pt;letter-spacing:.42em;
  color:#C0882C;margin-top:.6mm;text-transform:uppercase}
.sub{font-size:6.4pt;letter-spacing:.24em;text-transform:uppercase;color:#E6D9C2;
  margin-top:2.4mm}
.subml{font-family:"Hayat Malayalam";font-size:7.6pt;color:#D7B478;margin-top:1.2mm}
.fishpic{background-size:100% 100%;background-repeat:no-repeat;margin:0 auto}
.sigline{margin-top:2.4mm;font-size:4.8pt;letter-spacing:.34em;text-transform:uppercase;
  color:#A88A55}
.sigdish{font-family:"Hayat Serif";font-weight:600;font-size:11.4pt;letter-spacing:.08em;
  color:#E8D5B4;margin-top:1mm}
.ticket{position:absolute;left:10mm;right:10mm;bottom:9mm}
.dash{border-top:.3mm dashed #7A5C2E;margin-bottom:2.4mm}
.fields{display:flex;gap:4mm}
.field{flex:1}
.field .k{font-size:4.2pt;letter-spacing:.26em;color:#A88A55;text-transform:uppercase}
.field .v{border-bottom:.25mm solid #6B5333;height:4.4mm}
.field .v.code{font-family:"Hayat Serif";font-size:12pt;color:#FBF6EC;letter-spacing:.2em;
  padding-top:1mm}

/* ---------- BACK ---------- */
.back{background:#FBF6EC}
.bhead{position:relative;height:22mm;background:#241811;display:flex;align-items:center;
  justify-content:center;gap:4mm;text-align:left}
.bhead img{height:9mm;display:block}
.bhead .t{font-family:"Hayat Serif";font-weight:600;font-size:10.4pt;letter-spacing:.14em;
  color:#FBF6EC;text-transform:uppercase}
.bhead .s{font-size:4.4pt;letter-spacing:.24em;text-transform:uppercase;color:#C0882C;
  margin-top:1.2mm}
.bin{position:absolute;inset:22mm 9mm 0;display:flex;flex-direction:column}
.sect{font-family:"Hayat Serif";font-weight:600;font-size:10pt;letter-spacing:.15em;
  text-transform:uppercase;display:flex;align-items:baseline;gap:2.4mm;white-space:nowrap}
.sect i{flex:1;height:0;border-top:.25mm solid #DECDAE;position:relative;top:-1.2mm}
.sect i::after{content:"";position:absolute;right:0;top:-.7mm;width:1.4mm;height:1.4mm;
  background:#C0882C;transform:rotate(45deg)}
.steps{margin:2.6mm 0 0}
.step{display:flex;gap:2.6mm;margin-bottom:1.7mm;align-items:baseline}
.step .num{font-family:"Hayat Serif";font-weight:600;font-size:12pt;color:#C0882C;
  width:5mm;text-align:right;line-height:1;font-feature-settings:"lnum" 1,"onum" 0}
.step .h{font-family:"Hayat Serif";font-weight:600;font-size:8.8pt;letter-spacing:.04em;
  font-feature-settings:"lnum" 1,"onum" 0}
.step .d{font-size:6.6pt;line-height:3.2mm;color:#5C4A39;margin-top:.2mm}
.cpic{background-repeat:no-repeat;background-size:100% 100%;flex:0 0 auto;margin:1mm auto 0}
.dishes{display:grid;grid-template-columns:1fr 1fr;gap:1.4mm 4mm;margin-top:3.4mm}
.dishes span{font-family:"Hayat Serif";font-weight:600;font-size:10.2pt;letter-spacing:.05em;
  padding-left:3.4mm;position:relative}
.dishes span::before{content:"";position:absolute;left:0;top:1.7mm;width:1.3mm;height:1.3mm;
  background:#C0882C;transform:rotate(45deg)}
.delivery{margin-top:auto;text-align:center;border-top:.25mm solid #DECDAE;
  border-bottom:.25mm solid #DECDAE;padding:2.4mm 0}
.delivery .dv{font-family:"Hayat Serif";font-weight:600;font-size:9.6pt;letter-spacing:.04em;
  font-feature-settings:"lnum" 1,"onum" 0}
.delivery .dml{font-family:"Hayat Malayalam";font-size:7.2pt;color:#B08A45;margin-top:.8mm}
.corner{position:absolute;right:9mm;top:45mm;z-index:2}
.tryband{margin-top:auto;text-align:center;border-top:.25mm solid #DECDAE;
  border-bottom:.25mm solid #DECDAE;padding:2mm 0;margin-bottom:2.8mm}
.tryband .tl{font-size:4.4pt;letter-spacing:.3em;text-transform:uppercase;color:#A18A6A}
.tryband .tv{font-family:"Hayat Serif";font-weight:600;font-size:9.4pt;
  letter-spacing:.03em;margin-top:1.2mm;color:#241811}
.tryband .d{color:#C0882C}
.restate{text-align:center;margin-top:3.4mm}
.restate .r1{font-family:"Hayat Serif";font-weight:600;font-size:21pt;color:#C0882C;
  letter-spacing:.01em;font-feature-settings:"lnum" 1,"onum" 0}
.restate .r2{font-family:"Hayat Serif";font-weight:600;font-size:12.6pt;color:#241811;
  letter-spacing:.06em;margin-left:2.4mm}
.restate .r3{font-family:"Hayat Malayalam";font-size:7.4pt;color:#A2885C;margin:1mm 0 2.4mm}
.terms{margin-top:0}
.terms{margin-top:3mm}
.terms ul{list-style:none;font-family:"Hayat Sans";font-weight:400}
.terms li{font-size:6.8pt;line-height:3.4mm;color:#6B5A48;padding-left:3.2mm;
  position:relative;margin-bottom:.5mm}
.terms li::before{content:"";position:absolute;left:0;top:1.2mm;width:1mm;height:1mm;
  background:#C0882C;transform:rotate(45deg)}
.footer{margin-top:2.2mm;background:#241811;color:#FBF6EC;display:flex;
  align-items:center;gap:4mm;position:relative;left:-9mm;width:111mm;
  padding:3mm 9mm 3.4mm}
.footer .lbl{font-size:4.2pt;letter-spacing:.26em;color:#C0882C}
.footer .ph{font-size:7pt;white-space:nowrap;font-weight:500;font-variant-numeric:tabular-nums;
  margin-top:1mm;line-height:3.4mm}
.footer .ph .d{color:#C0882C}
.footer .a{font-size:5.2pt;color:#BFAE97;margin-top:1.1mm;line-height:2.7mm}
.footer img{width:14mm;height:14mm;background:#fff;border-radius:1mm;display:block}
.footer .qt{font-size:4pt;letter-spacing:.2em;color:#D7B478;text-align:center;
  margin-top:.8mm}
.love{font-family:"Hayat Malayalam";font-size:6.2pt;color:#B08A45;text-align:center;
  margin:2mm 0 0}
"""

def front():
    return f'''<div class="sheet front">{MARKS}
 <div class="fin">
   <img class="logo" src="{LOGO_CREAM}">
   <div class="eyebrow">{EYEBROW}</div>
   <div class="rulepair"><i></i><b></b><i></i></div>
   <div class="big"><span class="n">{OFFER}</span><span class="p">%</span></div>
   <div class="off">Off</div>
   <div class="sub">{OFFER_SUB}</div>
   <div class="subml">{OFFER_ML}</div>
   {pic('fish-ink', 58, 'fishpic')}
   <div class="sigline">{SIGNATURE}</div>
   <div class="sigdish">{SIG_DISH}</div>
 </div>
 <div class="ticket">
   <div class="dash"></div>
   <div class="fields">
     <div class="field"><div class="k">Valid till</div><div class="v"></div></div>
     <div class="field"><div class="k">Coupon no.</div><div class="v code"></div></div>
   </div>
 </div>
</div>'''

def back():
    terms  = ''.join(f'<li>{t}</li>' for t in TERMS)
    dishes = ''.join(f'<span>{d}</span>' for d in DISHES)
    phones = ' <span class="d">&middot;</span> '.join(PHONES)
    return f'''<div class="sheet back">{MARKS}
 <div class="bhead"><img src="{LOGO_CREAM}">
   <div><div class="t">{BACK_TITLE}</div><div class="s">{BACK_STRAP}</div></div></div>
 <div class="bin">
   <div class="dishes">{dishes}</div>
   {pic('chicken-cream', 52, 'cpic')}
   <div class="delivery">
     <div class="dv">{DELIVERY}</div>
     <div class="dml">{DELIVERY_ML}</div>
   </div>
   <div class="terms"><ul>{terms}</ul></div>
   <div class="love">{LOVE}</div>
   <div class="footer">
     <div><div class="lbl">ORDER &amp; HOME DELIVERY</div>
       <div class="ph">+91 {phones}</div>
       <div class="a">{ADDRESS}<br>{INSTA} &nbsp;&middot;&nbsp; {TAGLINE}</div></div>
     <span style="flex:1"></span>
     <div><img src="{QR_ORDER}"><div class="qt">ORDER NOW</div></div>
   </div>
 </div>
</div>'''

DOC=('<!doctype html><html><head><meta charset="utf-8"><style>'+CSS+'</style>{EXTRA}</head>'
     '<body>'+front()+back()+'</body></html>')
TRIM=('<style>@page{size:105mm 148mm;margin:0}.sheet{width:105mm;height:148mm}'
      '.cm{display:none}.footer{left:-9mm;width:105mm}</style>')
open(A('coupon_bleed.html'),'w',encoding='utf-8').write(DOC.replace('{EXTRA}',''))
open(A('coupon_trim.html'),'w',encoding='utf-8').write(DOC.replace('{EXTRA}',TRIM))
CHROME=(glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome') or ['chromium'])[0]
for v in ('bleed','trim'):
    subprocess.run([CHROME,'--headless','--disable-gpu','--no-sandbox',
        f'--print-to-pdf={A("hayat-coupon-"+v+".pdf")}','--no-pdf-header-footer',
        '--allow-file-access-from-files','--virtual-time-budget=12000',
        A(f'coupon_{v}.html')], capture_output=True)
print('built')
