# -*- coding: utf-8 -*-
"""Hayat Fish & Mandi — printed A4 card. Edit menu-prices.txt, then run this."""
import base64, os, subprocess, glob
HERE = os.path.dirname(os.path.abspath(__file__)); A = lambda p: os.path.join(HERE, p)

# ---- the three scan targets ------------------------------------------------
FSH_W = 50.0      # width of the fish-fry photo, mm          (calibrated)
BRO_W = 18.7      # width of the broast photo, mm            (+10%)
MAN_W = 55.8      # width of the mandi photo, mm             (calibrated)
SEA_H = 56.5      # height of the From the Sea panel, mm   (calibrated)
ALF_W = 60.0      # width of the alfaham photo, mm         (calibrated)
URL_MENU   = "https://personal-majid.github.io/hayat-menu/"
URL_ORDER  = "https://wa.me/919844326842?text=Hi%20Hayat%2C%20I%20would%20like%20to%20order"
URL_PORTAL = "https://personal-majid.github.io/hayat-menu/"   # the customer portal
URL_REVIEW = "https://personal-majid.github.io/hayat-menu/#/review"
URL_INSTA  = "https://instagram.com/hayat_fish_n_mandi"
VCARD = ("BEGIN:VCARD\nVERSION:3.0\n"
         "N:;Hayat Fish & Mandi;;;\nFN:Hayat Fish & Mandi\n"
         "TEL:+918296786116\nTEL:+919567074930\nTEL:+918138096730\n"
         "END:VCARD")
PHONES  = ["8296 786 116", "9567 074 930", "8138 096 730"]
ADDRESS, INSTA = "NH 966, near Punarppa UP School, Makkaraparamba", "@hayat_fish_n_mandi"
LOVE = "മലപ്പുറത്തു നിന്ന് സ്നേഹത്തോടെ"
SEA_CAPTION = "Mangalapuram fish fry"
SEA_CAPTION_ML = "മംഗലാപുരം മീൻ പൊരിച്ചത്"

# ---- data ------------------------------------------------------------------
def parse(path):
    secs, cur = {}, None
    for raw in open(path, encoding='utf-8'):
        ln = raw.rstrip('\n')
        if not ln.strip() or ln.lstrip().startswith('#'): continue
        if ln.startswith('['):
            p = [x.strip() for x in ln.strip('[]').split('|')]
            while len(p) < 6: p.append('')
            cur = dict(en=p[1], ml=p[2], cols=[c for c in p[3].split(',') if c.strip()],
                       note=p[4], flags={f.strip() for f in p[5].split(',') if f.strip()},
                       items=[])
            secs[p[0]] = cur; continue
        cur['items'].append([x.strip() for x in ln.split('|')])
    return secs
S = parse(A('menu-prices.txt'))

def b64(p, m): return f"data:{m};base64," + base64.b64encode(open(p,'rb').read()).decode()
LOGO_INK = b64(A('assets/logo_ink.png'), 'image/png')
IMG = {k: f'assets/cut-{k}.jpg' for k in ('fish','broast','alfaham','mandi','mojito')}

def _wh(path):
    from PIL import Image as _I
    return _I.open(A(path)).size

def inpic(name, width_mm, top_mm=0.0, anchor='top'):
    """a cut-out tucked against the right edge of a section"""
    w, h = _wh(f'assets/{name}.jpg')
    return (f'<div class="inpic" style="width:{width_mm}mm;height:{width_mm*h/w:.1f}mm;'
            f'{anchor}:{top_mm}mm;background-image:url(assets/{name}.jpg)"></div>')

def growpic(name, min_mm=16):
    return (f'<div class="growpic" style="min-height:{min_mm}mm;'
            f'background-image:url(assets/{name}.jpg)"></div>')

def widepic(name, width_mm):
    w, h = _wh(f'assets/{name}.jpg')
    return (f'<div class="photo" style="width:{width_mm}mm;height:{width_mm*h/w:.1f}mm;'
            f'background-image:url(assets/{name}.jpg)"></div>')

def pic(key, width_mm, scale=1.0):
    """a photo sized to fill the column width at its own aspect ratio"""
    from PIL import Image as _I
    w, h = _I.open(A(IMG[key])).size
    wide = width_mm * scale
    return (f'<div class="photo" style="width:{wide:.1f}mm;height:{wide*h/w:.1f}mm;'
            f'background-image:url({IMG[key]})"></div>')

def qr_svg(url, ec=None):
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_L
    q = qrcode.QRCode(error_correction=ec or ERROR_CORRECT_M, border=3, box_size=10)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m); d = []
    for y, row in enumerate(m):
        x = 0
        while x < n:
            if row[x]:
                x0 = x
                while x < n and row[x]: x += 1
                d.append(f"M{x0} {y}h{x-x0}v1h{-(x-x0)}z")
            else: x += 1
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
           f'shape-rendering="crispEdges"><path fill="#1C1510" d="{"".join(d)}"/></svg>')
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()
QR = {k: qr_svg(u) for k, u in (('menu',URL_MENU), ('order',URL_ORDER),
                               ('review',URL_REVIEW), ('insta',URL_INSTA),
                               ('portal',URL_PORTAL))}
# the vCard is a long payload: low error correction keeps the modules big enough
# to scan at the printed size. Do not raise this without also growing the code.
import qrcode.constants as _qc
QR['card'] = qr_svg(VCARD, ec=_qc.ERROR_CORRECT_L)

# ---- html ------------------------------------------------------------------
def rows(key):
    s = S[key]; f = s['flags']; n = len(s['cols']) if s['cols'] else (0 if 'nop' in f else 1)
    out, first, wides, extras, notes = [], True, [], [], []
    if s['cols']:
        out.append('<div class="row cols"><span class="nm"></span>' +
                   ''.join(f'<span class="p">{c}</span>' for c in s['cols']) + '</div>')
    body = []
    for it in s['items']:
        nm = it[0]
        if nm.startswith('--'):
            body.append(f'<div class="sublabel">{nm[2:]}</div>'); continue
        if nm.startswith(';'):
            notes.append(nm[1:].strip()); continue
        if nm.startswith('+'):
            extras.append(f'<div class="row"><span class="nm">{nm[1:].strip()}</span>'
                          f'<span class="p">{it[1] if len(it)>1 else ""}</span></div>'); continue
        if nm.startswith('='):
            wides.append(f'<div class="wideline"><span class="wn">{nm[1:].strip()}</span>'
                         f'<span class="wv">{it[1] if len(it)>1 else ""}</span></div>'); continue
        if nm.startswith('*'):
            body.append(f'<div class="hero-row"><span class="hn">{nm[1:].strip()}</span>'
                        f'<span class="hv">{it[1] if len(it)>1 else ""}</span></div>'); continue
        if nm == '~':
            body.append('<div class="row write"><span class="nm"></span>'
                        + '<span class="p"></span>'*n + '</div>'); continue
        mark = '<span class="star"></span>' if (first and 'star' in f) else ''
        first = False
        cells = ''
        if 'ask' in f:
            cells = '<span class="p askline"></span>'
        else:
            for v in it[1:]:
                if v == '-':   cells += '<span class="p"><span class="dash">—</span></span>'
                elif v == '.': cells += '<span class="p"></span>'
                else:          cells += f'<span class="p">{v}</span>'
            cells += '<span class="p"></span>' * (n - len(it[1:]))
        body.append(f'<div class="row">{mark}<span class="nm">{nm}</span>{cells}</div>')
    if '2up' in f:
        half = (len(body) + 1) // 2
        return ''.join(wides) + ('<div class="tbl c1 duo"><div>' + ''.join(body[:half]) +
                '</div><div>' + ''.join(body[half:]) + '</div></div>'), '', '', ''
    cls = 'tbl ' + ('c0' if n == 0 else f'c{n}') + (' ask' if 'ask' in f else '')
    ex = ('<div class="tbl c1 extras">' + ''.join(extras) + '</div>') if extras else ''
    nt = ''.join(f'<div class="fnote">{t}</div>' for t in notes)
    return (f'<div class="{cls}">' + ''.join(out) + ''.join(body) + '</div>',
            ''.join(wides), ex, nt)

def head(key):
    s = S[key]
    note = f'<div class="note">{s["note"]}</div>' if s['note'] else ''
    return (f'<div class="head"><span class="en">{s["en"]}</span>'
            f'<span class="ml">{s["ml"]}</span><span class="ln"></span></div>{note}')

def sect(key, tuck=None, tuckw=30, tucktop=0.0, padr=0, tail='', anchor='top',
         minh=0, grow=False):
    fl  = S[key]['flags']
    box = ' boxed' if 'box' in fl else ''
    cap = f'<div class="caption">{SEA_CAPTION}</div>' if 'caption' in fl else ''
    grp = ('<div class="grp"><span></span><span>DRY</span><span>GRAVY</span></div>'
           if key == 'INDOCH' else '')
    body, wide, extras, notes = rows(key)
    if padr:
        body   = f'<div style="padding-right:{padr}mm">{body}</div>'
        extras = f'<div style="padding-right:{padr}mm">{extras}</div>' if extras else ''
    ph = inpic(tuck, tuckw, tucktop, anchor) if tuck else ''
    if padr and wide:
        wide = f'<div style="padding-right:{padr}mm">{wide}</div>'
    mh = f' style="min-height:{minh}mm"' if minh else ''
    gc = ' grow' if grow else ''
    return (f'<section class="{box} rel{gc}"{mh}>{ph}{head(key)}{cap}{grp}{wide}{body}'
            f'{extras}{notes}{tail}</section>')

MARKS = ''.join(
  f'<span class="cm h" style="{a}:0;{b}:3mm"></span><span class="cm v" style="{a}:3mm;{b}:0"></span>'
  for a in ('left','right') for b in ('top','bottom'))

CSS = """
@page{size:303mm 216mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Hayat Sans";color:#1C1510}
.sheet{position:relative;width:303mm;height:216mm;background:#FCF8F0;
       page-break-after:always;overflow:hidden}
.sheet:last-child{page-break-after:auto}
.cm{position:absolute;background:#1C1510;z-index:9}
.cm.h{width:2.4mm;height:.12mm}.cm.v{width:.12mm;height:2.4mm}
.pad{position:absolute;inset:8mm 15mm 2mm;display:flex;flex-direction:column}

/* masthead */
.mast{display:flex;align-items:center;gap:7mm;margin-bottom:3mm;flex:0 0 auto}
.mast .ln{flex:1;height:0;border-top:.3mm solid #D8C4A0}
.mast img{height:13mm;display:block}
.tag{font-size:5.2pt;letter-spacing:.32em;color:#7C5410;border:.25mm solid #D5B67C;
     border-radius:999px;padding:1.1mm 2.8mm 1mm;white-space:nowrap}
.bmast{display:flex;align-items:center;gap:6mm;margin-bottom:3mm;flex:0 0 auto}
.bmast .ln{flex:1;height:0;border-top:.3mm solid #D8C4A0}
.bmast .w{font-family:"Hayat Serif";font-weight:600;font-size:9.6pt;letter-spacing:.4em;
     text-transform:uppercase;white-space:nowrap}
.bmast .m{font-family:"Hayat Malayalam";font-size:8.6pt;color:#B07C22}

/* columns */
.body{flex:1;display:flex;gap:7mm;min-height:0;position:relative;overflow:hidden}
.col{display:flex;flex-direction:column;position:relative}
.col>*{flex:0 0 auto}
.col>.grow{flex:1 1 auto}
.col+.col{border-left:.25mm solid #E8DCC2;padding-left:7mm}
section{margin-bottom:1.4mm}
section:last-child{margin-bottom:0}
section.boxed{border:.25mm solid #D8C4A0;background:#F5EDDC;padding:2.4mm 3mm 2.8mm;
     margin-bottom:4.4mm}
section.boxed .head .ln{border-color:#D2BB91}

/* head */
.head{display:flex;align-items:baseline;gap:2.2mm;margin-bottom:1.3mm;flex-wrap:wrap}
.head .en{font-family:"Hayat Serif";font-weight:600;font-size:12.2pt;letter-spacing:.16em;
     text-transform:uppercase;white-space:nowrap}
.head .ml{font-family:"Hayat Malayalam";font-size:8.4pt;color:#B07C22;white-space:nowrap}
.head .ln{flex:1 1 6mm;min-width:5mm;height:0;border-top:.25mm solid #D8C4A0;position:relative;top:-1.1mm}
.head .ln::after{content:"";position:absolute;right:0;top:-.7mm;width:1.4mm;height:1.4mm;
     background:#B07C22;transform:rotate(45deg)}
.note{font-size:5.6pt;letter-spacing:.15em;color:#7E6E58;text-transform:uppercase;
     margin:-.2mm 0 1.5mm}

/* rows */
.tbl .row{display:grid;align-items:baseline;column-gap:2mm;position:relative}
.c0 .row{grid-template-columns:1fr}
.c1 .row{grid-template-columns:1fr 11mm}
.c2 .row{grid-template-columns:1fr 10mm 10mm}
.c3 .row{grid-template-columns:1fr 9mm 9mm 9mm}
section.boxed .c3 .row{grid-template-columns:1fr 8mm 8mm 8.4mm;column-gap:1.6mm}
.c4 .row{grid-template-columns:1fr 10mm 10mm 10mm 10mm}
.ask .row{grid-template-columns:1fr 16mm}
.row{font-size:8.6pt;line-height:3.62mm}
.back .row{font-size:7.7pt;line-height:3.08mm}
.back .c1 .row{grid-template-columns:1fr 10mm}
.back .c2 .row{grid-template-columns:1fr 9mm 9mm}
.back .c4 .row{grid-template-columns:1fr 9mm 9mm 9mm 9mm}
.back .head .en{font-size:11.4pt}
.back section{margin-bottom:2.9mm}
.back .note{margin:-.2mm 0 1.1mm}
.back .head{margin-bottom:1.1mm}
.back .duo{column-gap:4mm}
.nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm i{font-style:normal;font-size:6pt;letter-spacing:.05em;color:#7E6E58}
.p{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.dash{color:#C7B69C;font-weight:400}
.cols{margin-bottom:.4mm}
.cols .p{font-size:5.3pt;letter-spacing:.2em;text-transform:uppercase;color:#7C5410}
.write .nm,.askline{border-bottom:.2mm dotted #CDB894;height:3mm}
.grp{display:grid;column-gap:2mm;grid-template-columns:1fr 20mm 20mm;margin-bottom:.3mm}
.grp span{text-align:center;font-size:5.3pt;letter-spacing:.28em;color:#B07C22}
.caption{font-family:"Hayat Serif";font-style:italic;font-weight:600;font-size:10pt;
     color:#7C5410;margin:-.4mm 0 1.6mm;line-height:4.2mm}
.caption .m{font-family:"Hayat Malayalam";font-style:normal;font-size:7.4pt;color:#9E7530;
     margin-left:2.6mm}
.extras{border-top:.25mm solid #DCCBA8;margin-top:1.2mm;padding-top:1mm}
.fnote{font-size:5.2pt;letter-spacing:.13em;text-transform:uppercase;color:#8E7A5C;
     margin-top:1.1mm;white-space:nowrap}
.sublabel{font-size:5.4pt;letter-spacing:.26em;text-transform:uppercase;color:#9E7530;
     margin:1.6mm 0 .7mm}
.star{position:absolute;left:-3.2mm;top:1.5mm;width:1.3mm;height:1.3mm;background:#B07C22;
     transform:rotate(45deg)}
.duo{display:grid;grid-template-columns:1fr 1fr;column-gap:5mm}

/* signature line */
.sig{border-top:.25mm solid #D8C4A0;border-bottom:.25mm solid #D8C4A0;padding:2.4mm 0;margin:0 0 4mm}
.sig .t{font-family:"Hayat Serif";font-weight:600;font-size:10.4pt;letter-spacing:.12em;
     text-transform:uppercase}
.sig .m{font-family:"Hayat Malayalam";font-size:8.4pt;color:#B07C22;margin-left:2.2mm}
.sig .d{font-size:6pt;letter-spacing:.15em;text-transform:uppercase;color:#7E6E58;margin-top:1mm}

/* strip */
.strip{display:flex;align-items:center;gap:3mm;padding:1.5mm 0;
     border-top:.25mm solid #D8C4A0;border-bottom:.25mm solid #D8C4A0;margin:.4mm 0 4mm}
.strip .t{font-family:"Hayat Serif";font-weight:600;font-size:9.4pt;letter-spacing:.12em;
     text-transform:uppercase;white-space:nowrap}
.strip .v{font-size:8pt;color:#3A2A1C;white-space:nowrap}
.strip .v b{font-weight:500}.strip .d{color:#B07C22}
.strip .m{font-family:"Hayat Malayalam";font-size:8pt;color:#B07C22;white-space:nowrap}

/* photos */
.photo{background-size:100% 100%;background-repeat:no-repeat;margin:1.2mm auto 2.0mm}
.rel{position:relative}
.inpic{position:absolute;right:0;background-size:100% 100%;background-repeat:no-repeat}
.grow{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.grow .inpic{height:auto!important;bottom:3mm;background-size:contain;
     background-position:right bottom}
.growpic{flex:1 1 auto;min-height:0;background-size:contain;background-repeat:no-repeat;
     background-position:center;margin:2mm 0 2.6mm}
section.boxed .inpic{right:3mm}


/* foot strips */
.foot{position:relative;flex:0 0 auto;height:26mm;display:flex;align-items:center;gap:6mm;padding-top:1.6mm;
     border-top:.3mm solid #D8C4A0;margin-top:0.8mm}
.fq{display:flex;align-items:center;gap:3mm;flex:1}
.fq.right{justify-content:flex-end}
.fq img{width:19.5mm;height:19.5mm;display:block}
.fq .t{font-size:5.4pt;letter-spacing:.3em;text-transform:uppercase;color:#7C5410}
.fq .big{font-family:"Hayat Serif";font-weight:600;font-size:11.4pt;letter-spacing:.06em;
     margin-top:.6mm;white-space:nowrap}
.fq .ml{font-family:"Hayat Malayalam";font-size:8pt;color:#B07C22;margin-left:2.2mm}
.fq .nums{font-size:8.6pt;font-weight:500;font-variant-numeric:tabular-nums;margin-top:.7mm;
     white-space:nowrap}
.fq .nums .d{color:#B07C22}
.fq.right{text-align:right}
.mini{text-align:center}
.mini img{width:19.5mm;height:19.5mm}
.mini .mt{font-size:4.4pt;letter-spacing:.22em;color:#7E6E58;margin-top:.4mm;line-height:1.6mm}
.foot .mid{display:contents}
.foot .mid .mini{position:absolute;left:50%;transform:translateX(-50%);top:3.6mm}
.foot .mid .mt{white-space:nowrap}
.foot .love{position:absolute;left:calc(50% + 14mm);top:11.5mm;font-family:"Hayat Malayalam";font-size:7pt;color:#9E7530;white-space:nowrap}
.addr{font-size:5.2pt;letter-spacing:.24em;text-transform:uppercase;color:#968472;margin-top:.8mm}

/* highlighted rows */
.hero-row{display:flex;align-items:baseline;gap:3mm;margin:.6mm 0 1.4mm;padding:1.6mm 2.4mm;
     background:#F2E8D4;border-left:.9mm solid #B07C22}
.hero-row .hn{font-family:"Hayat Serif";font-weight:600;font-size:10.6pt;letter-spacing:.06em;
     white-space:nowrap}
.hero-row .hv{flex:1;text-align:right;font-size:5.6pt;letter-spacing:.13em;
     text-transform:uppercase;color:#7C5410;white-space:nowrap}
.wideline{display:flex;align-items:baseline;gap:3mm;font-size:8.6pt;line-height:4mm;
     margin-bottom:.8mm}
.wideline .wn{font-weight:500}
.wideline .wv{flex:1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
"""

def front():
    c1 = [sect('SEA', tuck='cut-fish', tuckw=FSH_W, tucktop=1.6, padr=52, minh=SEA_H, anchor='bottom'),
          sect('MANGALORE'), sect('MEALS'),
          '<div class="strip"><span class="t">Mandi Rice</span>'
          '<span class="v"><b>Qtr</b>&nbsp;100 &nbsp;<span class="d">·</span>&nbsp; <b>Half</b>&nbsp;200</span>'
          '<span style="flex:1"></span><span class="m">മന്ദി റൈസ്</span></div>',
          sect('BROAST', tuck='cut-broast', tuckw=BRO_W, tucktop=1.5, padr=20, anchor='bottom')]
    c2 = [sect('MANDI'), widepic('cut-mandi', MAN_W)]
    c3 = [sect('ALFAHAM'), widepic('cut-alfaham', ALF_W), sect('STARTERS')]
    foot = (
      '<div class="foot">'
        '<div class="fq">'
          f'<img src="{QR["order"]}">'
          '<div><div class="t">HOME DELIVERY</div>'
          '<div class="big">Order Now<span class="ml">ഓർഡർ ചെയ്യൂ</span></div>'
          '<div class="nums">+91 ' + ' <span class="d">·</span> '.join(PHONES) + '</div></div>'
        '</div>'
        '<div class="mid">'
          f'<div class="mini"><img src="{QR["card"]}" style="width:19.5mm;height:19.5mm">'
          '<div class="mt">SAVE OUR NUMBER</div></div>'
          f'<div class="love">{LOVE}</div>'
        '</div>'
        '<div class="fq right">'
          '<div><div class="t">FOLLOW US</div>'
          f'<div class="big">{INSTA}</div>'
          f'<div class="addr">{ADDRESS}</div></div>'
          f'<div class="mini"><img src="{QR["insta"]}">'
          '<div class="mt">INSTAGRAM</div></div>'
        '</div>'
      '</div>')
    return f'''<div class="sheet">{MARKS}<div class="pad">
 <div class="mast"><span class="ln"></span><img src="{LOGO_INK}"><span class="ln"></span>
   <span class="tag">NON AC</span></div>
 <div class="body">
   <div class="col" style="width:88mm">{''.join(c1)}</div>
   <div class="col" style="width:80mm">{''.join(c2)}</div>
   <div class="col" style="flex:1">{''.join(c3)}</div>
 </div>
 {foot}
</div></div>'''

def back():
    c1 = [sect('BEEF'), sect('INDOCH'), sect('SHAWAYA'), sect('SHAWARMA'), sect('SALADS')]
    c2 = [sect('CURRIES'), sect('BREADS'), sect('SOUP'), sect('RICENOODLES')]
    c3 = [sect('MOJITO', tuck='cut-mojito', tuckw=16, tucktop=2, padr=19, anchor='bottom'),
          sect('JUICE'), sect('SHAKE'), sect('FALOODA'), sect('BEV')]
    foot = (
      '<div class="foot">'
        '<div class="fq">'
          f'<img src="{QR["portal"]}" style="width:21mm;height:21mm">'
          '<div><div class="t">HOME DELIVERY &nbsp;·&nbsp; TAKEAWAY</div>'
          '<div class="big" style="font-size:14pt">Order Online<span class="ml">ഓർഡർ ചെയ്യൂ</span></div>'
          '<div class="nums">+91 ' + ' <span class="d">·</span> '.join(PHONES) + '</div></div>'
        '</div>'
        '<div class="mid"></div>'
        '<div class="fq right">'
          '<div><div class="t">FOLLOW US</div>'
          f'<div class="big" style="font-size:11pt">{INSTA}</div>'
          f'<div class="addr">{ADDRESS}</div></div>'
          f'<div class="mini"><img src="{QR["insta"]}" style="width:19.5mm;height:19.5mm">'
          '<div class="mt">INSTAGRAM</div></div>'
        '</div>'
      '</div>')
    return f'''<div class="sheet back">{MARKS}<div class="pad">
 <div class="bmast"><span class="ln"></span><span class="w">Hayat Fish &amp; Mandi</span>
   <span class="m">മെനു</span><span class="ln"></span></div>
 <div class="body">
   <div class="col" style="width:86mm">{''.join(c1)}</div>
   <div class="col" style="width:80mm">{''.join(c2)}</div>
   <div class="col" style="flex:1">{''.join(c3)}</div>
 </div>
 {foot}
</div></div>'''

DOC = ('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style>{EXTRA}</head>'
       '<body>' + front() + back() + '</body></html>')
TRIM = ('<style>@page{size:297mm 210mm;margin:0}.sheet{width:297mm;height:210mm}'
        '.cm{display:none}.pad{inset:8mm 13mm 5mm}'
        '.qband{left:-13mm;width:297mm;padding:0 13mm 3mm}</style>')
open(A('menu_bleed.html'),'w',encoding='utf-8').write(DOC.replace('{EXTRA}',''))
open(A('menu_trim.html'),'w',encoding='utf-8').write(DOC.replace('{EXTRA}',TRIM))
CHROME = (glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome') or ['chromium'])[0]
for v in ('bleed','trim'):
    subprocess.run([CHROME,'--headless','--disable-gpu','--no-sandbox',
        f'--print-to-pdf={A("hayat-menu-"+v+".pdf")}','--no-pdf-header-footer',
        '--allow-file-access-from-files','--virtual-time-budget=12000', A(f'menu_{v}.html')], capture_output=True)
print("built")
