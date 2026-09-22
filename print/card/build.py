# -*- coding: utf-8 -*-
"""Hayat Fish & Mandi — printed A4 card.  Edit menu-prices.txt, then run this."""
import base64, os, re, subprocess, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
A    = lambda p: os.path.join(HERE, p)

# ---------------------------------------------------------------- data
def parse(path):
    secs, cur = [], None
    for raw in open(path, encoding='utf-8'):
        ln = raw.rstrip('\n')
        if not ln.strip() or ln.lstrip().startswith('#'): continue
        if ln.startswith('['):
            p = [x.strip() for x in ln.strip('[]').split('|')]
            while len(p) < 5: p.append('')
            cur = dict(key=p[0], en=p[1], ml=p[2],
                       cols=[c.strip() for c in p[3].split(',') if c.strip()],
                       note=p[4], items=[])
            secs.append(cur); continue
        if ln.strip() == '~':
            cur['items'].append(('~',)); continue
        f = [x.strip() for x in ln.split('|')]
        cur['items'].append(tuple(f))
    return {s['key']: s for s in secs}

S = parse(A('menu-prices.txt'))

# ---------------------------------------------------------------- assets
def b64(p, mime):
    return f"data:{mime};base64," + base64.b64encode(open(p,'rb').read()).decode()

LOGO_INK   = b64(A('assets/logo_ink.png'),  'image/png')
LOGO_CREAM = b64(A('assets/logo_cream.png'),'image/png')
QR = {k: b64(A(f'assets/qr-{k}.svg'), 'image/svg+xml') for k in ('menu','order','review')}

def photo(slot, fallback):
    """print/card-images/<slot>.jpg wins; otherwise the enhanced repo crop."""
    for p in (A(f'card-images/{slot}.jpg'), A(f'card-images/{slot}.jpeg'),
              A(f'card-images/{slot}.png')):
        if os.path.exists(p):
            return b64(p, 'image/png' if p.endswith('.png') else 'image/jpeg')
    return b64(A(f'assets/img-{fallback}.jpg'), 'image/jpeg')

# slot name (drop print/card-images/<slot>.jpg to replace)  |  built-in fallback  |  caption
PHOTOS = [("mandi",   "mandi",   "Signature Mandi"),
          ("alfaham", "alfaham", "Charcoal Alfaham"),
          ("beef",    "beef",    "Beef Mandi"),
          ("mojito",  "mojito",  "Fresh Mojito")]

# ---------------------------------------------------------------- html bits
def head(key, sub=None):
    s = S[key]
    note = sub if sub is not None else s['note']
    n = f'<div class="note">{note}</div>' if note else ''
    return (f'<div class="head"><span class="en">{s["en"]}</span>'
            f'<span class="ml">{s["ml"]}</span><span class="ln"></span></div>{n}')

def table(key, wide=False):
    s = S[key]; n = len(s['cols']) if s['cols'] else 1
    cls = f'tbl c{n}' + (' cw' if wide else '')
    out = []
    if s['cols']:
        out.append('<div class="row cols"><span class="nm"></span>' +
                   ''.join(f'<span class="p">{c}</span>' for c in s['cols']) + '</div>')
    for it in s['items']:
        if it[0] == '~':
            out.append('<div class="row write"><span class="nm"></span>'
                       + '<span class="p"></span>'*n + '</div>'); continue
        cells = ''
        for v in it[1:]:
            if v == '-':   cells += '<span class="p"><span class="dash">—</span></span>'
            elif v == 'market': cells += '<span class="p mk">market</span>'
            else:          cells += f'<span class="p">{v}</span>'
        cells += '<span class="p"></span>' * (n - len(it[1:]))
        out.append(f'<div class="row"><span class="nm">{it[0]}</span>{cells}</div>')
    return f'<div class="{cls}">' + ''.join(out) + '</div>'

def sect(key, wide=False, sub=None):
    return f'<section>{head(key, sub)}{table(key, wide)}</section>'

MED = ''.join(
    f'<figure class="med"><span class="ring"><img src="{photo(slot, fb)}"></span>'
    f'<figcaption>{cap}</figcaption></figure>' for slot, fb, cap in PHOTOS)

MARKS = ('<span class="cm h" style="left:0;top:3mm"></span><span class="cm v" style="left:3mm;top:0"></span>'
 '<span class="cm h" style="right:0;top:3mm"></span><span class="cm v" style="right:3mm;top:0"></span>'
 '<span class="cm h" style="left:0;bottom:3mm"></span><span class="cm v" style="left:3mm;bottom:0"></span>'
 '<span class="cm h" style="right:0;bottom:3mm"></span><span class="cm v" style="right:3mm;bottom:0"></span>')

PHONE_DEL = "+91 79071 33238"
PHONE_WA  = "+91 98443 26842"
ADDRESS   = "NH 966, near Punarppa UP School, Makkaraparamba"
HOURS     = ""   # deliberately not printed on the card
INSTA     = "@hayat_fish_n_mandi"

CSS = """
@page { size: 303mm 216mm; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Hayat Sans";color:#241811}
.sheet{position:relative;width:303mm;height:216mm;background:#FBF6EC;
       page-break-after:always;overflow:hidden}
.sheet:last-child{page-break-after:auto}
.cm{position:absolute;background:#241811;z-index:9}
.cm.h{width:2.4mm;height:.12mm}
.cm.v{width:.12mm;height:2.4mm}
.pad{position:absolute;inset:0 16mm 11mm;display:flex;flex-direction:column;height:100%}

/* ---------- masthead band (full bleed) ---------- */
.band{position:relative;left:-16mm;width:303mm;background:#241811;color:#FBF6EC;
      flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:9mm}
.band::before,.band::after{content:"";position:absolute;left:16mm;right:16mm;
      border-top:.25mm solid #6E5334}
.band::before{top:4.6mm}.band::after{bottom:4.6mm}
.band.front{height:40mm;padding-top:3mm}
.band.back {height:20mm;padding-top:3mm}
.band .logo{height:19mm;display:block}
.med{width:23mm;text-align:center}
.med .ring{display:block;width:23mm;height:23mm;border-radius:50%;overflow:hidden;
      border:.4mm solid #C0882C;box-shadow:0 0 0 .9mm #241811,0 0 0 1.1mm #6E5334}
.med img{width:100%;height:100%;object-fit:cover;display:block}
.med figcaption{margin-top:1.6mm;font-size:4.9pt;letter-spacing:.24em;
      text-transform:uppercase;color:#D7B478;white-space:nowrap}
.bword{font-family:"Hayat Serif";font-weight:600;font-size:10pt;letter-spacing:.42em;
      text-transform:uppercase}
.bml{font-family:"Hayat Malayalam";font-size:9pt;color:#C0882C}
.band .rule{width:34mm;height:0;border-top:.25mm solid #6E5334}

/* ---------- columns ---------- */
.body{flex:1;display:flex;gap:6.5mm;min-height:0;padding-top:6.5mm}
.col{display:flex;flex-direction:column}
.col+.col{border-left:.25mm solid #E8DCC4;padding-left:6.5mm}
section{margin-bottom:4mm}
section:last-child{margin-bottom:0}

/* ---------- section head ---------- */
.head{display:flex;align-items:baseline;gap:2.2mm;margin-bottom:1.4mm}
.head .en{font-family:"Hayat Serif";font-weight:600;font-size:12.8pt;
      letter-spacing:.17em;text-transform:uppercase;white-space:nowrap}
.head .ml{font-family:"Hayat Malayalam";font-size:8.6pt;color:#C0882C;white-space:nowrap;
      position:relative;top:-.2mm}
.note{font-size:5.6pt;letter-spacing:.17em;color:#8A7A63;text-transform:uppercase;
      margin:-.4mm 0 1.4mm}
.head .ln{flex:1;height:0;border-top:.25mm solid #DECDAE;position:relative;top:-1.1mm}
.head .ln::after{content:"";position:absolute;right:0;top:-.7mm;width:1.4mm;height:1.4mm;
      background:#C0882C;transform:rotate(45deg)}

/* ---------- rows ---------- */
.tbl .row{display:grid;align-items:baseline;column-gap:2mm}
.c1 .row{grid-template-columns:1fr 14mm}
.cw .row{grid-template-columns:1fr 26mm}
.cw .p{white-space:nowrap}
.c2 .row{grid-template-columns:1fr 10mm 10mm}
.c3 .row{grid-template-columns:1fr 9mm 9mm 9mm}
.c4 .row{grid-template-columns:1fr 10mm 10mm 10mm 10mm}
.row{font-size:8.9pt;line-height:3.92mm}
.nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm i{font-style:normal;font-size:5.6pt;letter-spacing:.06em;color:#8A7A63}
.p{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.p.mk{font-size:5.6pt;letter-spacing:.14em;text-transform:uppercase;color:#8A5E16;font-weight:500}
.dash{color:#CDBFA7;font-weight:400}
.cols{margin-bottom:.5mm}
.cols .p{font-size:5.4pt;letter-spacing:.2em;text-transform:uppercase;color:#8A5E16}
.write .nm{border-bottom:.2mm dotted #D7C6A8;height:3.1mm}
.grp{display:grid;column-gap:2mm;grid-template-columns:1fr 22mm 22mm;margin-bottom:.2mm}
.grp span{text-align:center;font-size:5.4pt;letter-spacing:.28em;color:#C0882C}

/* ---------- strip ---------- */
.strip{display:flex;align-items:center;gap:3mm;padding:2.2mm 0;
      border-top:.25mm solid #DECDAE;border-bottom:.25mm solid #DECDAE;margin:.6mm 0 4mm}
.strip .t{font-family:"Hayat Serif";font-weight:600;font-size:9.5pt;letter-spacing:.12em;
      text-transform:uppercase;white-space:nowrap}
.strip .v{font-size:8pt;color:#3D2C1E;white-space:nowrap}
.strip .v b{font-weight:500}
.strip .d{color:#C0882C}
.strip .ml{font-family:"Hayat Malayalam";font-size:8pt;color:#C0882C;white-space:nowrap}

/* ---------- foot ---------- */
.foot{flex:0 0 auto;display:flex;align-items:center;gap:4mm;padding-top:3.4mm;
      border-top:.25mm solid #DECDAE}
.foot .l{flex:1;font-size:6.2pt;letter-spacing:.26em;text-transform:uppercase;color:#7A6753}
.foot .r{font-size:7.6pt;font-weight:500;letter-spacing:.02em}
.foot .ml{font-family:"Hayat Malayalam";font-size:7.6pt;color:#8A5E16}
.foot .dm{width:1.4mm;height:1.4mm;background:#C0882C;transform:rotate(45deg)}

/* ---------- qr band ---------- */
.qband{position:relative;left:-16mm;width:303mm;background:#241811;color:#FBF6EC;
      flex:0 0 auto;height:36mm;margin-top:5mm;display:flex;align-items:center;
      padding:0 16mm 3mm;gap:9mm}
.qband .lbl{font-size:4.9pt;letter-spacing:.3em;color:#C0882C;margin-bottom:1.4mm}
.qband .a{font-size:7.4pt;line-height:3.7mm}
.qband .ph{font-size:8.6pt;font-weight:500;margin-top:1.2mm;font-variant-numeric:tabular-nums}
.qband .ml{font-family:"Hayat Malayalam";font-size:7.6pt;color:#D7B478}
.qband .sep{width:.25mm;height:20mm;background:#5A483A}
.qr{text-align:center;width:24mm}
.qr img{width:19mm;height:19mm;display:block;margin:0 auto;background:#FBF6EC;
      padding:1.1mm;border-radius:1mm}
.qr .c{margin-top:1.4mm;font-size:4.9pt;letter-spacing:.2em;text-transform:uppercase;color:#D7B478}
.qr .m{font-family:"Hayat Malayalam";font-size:6pt;color:#EADFCB;margin-top:.4mm}
"""

def front():
    c1 = [sect('SEAFOOD'), sect('MEALS'), sect('MANDI'), sect('SHAWARMA')]
    c2 = [sect('ALFAHAM'),
          '<div class="strip"><span class="t">Mandi Rice</span>'
          '<span class="v"><b>Qtr</b>&nbsp;100 &nbsp;<span class="d">·</span>&nbsp; <b>Half</b>&nbsp;200</span>'
          '<span style="flex:1"></span><span class="ml">മന്ദി റൈസ്</span></div>',
          sect('SHAWAYA'), sect('NOODLES')]
    ch = ('<section>' + head('CHINESE') +
          '<div class="grp"><span></span><span>DRY</span><span>GRAVY</span></div>' +
          table('CHINESE') + '</section>')
    c3 = [ch, sect('CRICE')]
    return f'''<div class="sheet">{MARKS}<div class="pad">
 <div class="band front">
   <figure class="med">{MED.split('<figure class="med">')[1]}
   <figure class="med">{MED.split('<figure class="med">')[2]}
   <img class="logo" src="{LOGO_CREAM}">
   <figure class="med">{MED.split('<figure class="med">')[3]}
   <figure class="med">{MED.split('<figure class="med">')[4]}
 </div>
 <div class="body">
   <div class="col" style="width:80mm">{''.join(c1)}</div>
   <div class="col" style="width:75mm">{''.join(c2)}</div>
   <div class="col" style="flex:1">{''.join(c3)}</div>
 </div>
 <div class="foot"><span class="l">{INSTA}</span>
   <span class="dm"></span>
   <span class="r">Home Delivery <span class="ml">ഹോം ഡെലിവറി</span> &nbsp;{PHONE_DEL}</span></div>
</div></div>'''

def back():
    c1 = [sect('GRAVY'), sect('SOUP'), sect('BREADS'), sect('BROAST', wide=True)]
    c2 = [sect('JUICE'), sect('FALOODA'), sect('SALADS')]
    c3 = [sect('MOJITO'), sect('SHAKE'), sect('BEV')]
    qr = ''.join(
        f'<div class="qr"><img src="{QR[k]}"><div class="c">{c}</div><div class="m">{m}</div></div>'
        for k, c, m in (('menu','Online Menu','ഓൺലൈൻ മെനു'),
                        ('order','Order Online','ഓർഡർ ചെയ്യൂ'),
                        ('review','Rate Us','റിവ്യൂ ചെയ്യൂ')))
    return f'''<div class="sheet">{MARKS}<div class="pad">
 <div class="band back"><span class="rule"></span>
   <span class="bword">Hayat Fish &amp; Mandi</span>
   <span class="bml">മെനു</span><span class="rule"></span></div>
 <div class="body">
   <div class="col" style="width:80mm">{''.join(c1)}</div>
   <div class="col" style="width:78mm">{''.join(c2)}</div>
   <div class="col" style="flex:1">{''.join(c3)}</div>
 </div>
 <div class="qband">
   <div><div class="lbl">HOME DELIVERY &nbsp;·&nbsp; <span class="ml">ഹോം ഡെലിവറി</span></div>
     <div class="ph">{PHONE_DEL} &nbsp;<span style="color:#C0882C">·</span>&nbsp; {PHONE_WA}</div>
     <div class="a" style="margin-top:1.4mm">{ADDRESS}<br>{INSTA}</div></div>
   <span style="flex:1"></span><span class="sep"></span>{qr}
 </div>
</div></div>'''

DOC = ('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style>{EXTRA}</head>'
       '<body>' + front() + back() + '</body></html>')
TRIM = ('<style>@page{size:297mm 210mm;margin:0}.sheet{width:297mm;height:210mm}'
        '.cm{display:none}.pad{inset:0 13mm 11mm}'
        '.band,.qband{left:-13mm;width:297mm}'
        '.band::before,.band::after{left:13mm;right:13mm}'
        '.qband{padding:0 13mm 3mm}</style>')
open(A('menu_bleed.html'),'w',encoding='utf-8').write(DOC.replace('{EXTRA}',''))
open(A('menu_trim.html'), 'w',encoding='utf-8').write(DOC.replace('{EXTRA}',TRIM))

CHROME = (glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome') or ['chromium'])[0]
for v in ('bleed','trim'):
    subprocess.run([CHROME,'--headless','--disable-gpu','--no-sandbox',
                    f'--print-to-pdf={A("hayat-menu-"+v+".pdf")}','--no-pdf-header-footer',
                    '--virtual-time-budget=8000', A(f'menu_{v}.html')],
                   capture_output=True)
print("built:", ", ".join(os.path.basename(p) for p in
      (A('hayat-menu-bleed.pdf'), A('hayat-menu-trim.pdf'))))
