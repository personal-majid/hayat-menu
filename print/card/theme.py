# -*- coding: utf-8 -*-
"""Recolour the built menu. Every colour in build.py maps to a role; a theme
swaps the roles. Run:  python3 theme.py <name>   ->  hayat-menu-<name>-trim.pdf"""
import re, os, sys, glob, base64, subprocess, io
from PIL import Image
import numpy as np

CHROME = (glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome') or ['chromium'])[0]

# role  ->  the hex build.py currently emits
ROLE = {
    'paper':     '#FBF6EC',   # page background
    'panel':     '#F6EEDF',   # boxed section fill
    'hilite':    '#F4EADA',   # King Fish Mandi bar
    'ink':       '#241811',   # body text / QR
    'ink2':      '#3D2C1E',   # strip values
    'gold':      '#C0882C',   # Malayalam + diamonds
    'goldDk':    '#8A5E16',   # small-cap labels
    'goldMd':    '#B08A45',   # captions, love line
    'rule':      '#DECDAE',   # section borders, masthead rules
    'ruleSoft':  '#EADFC8',   # column dividers
    'ruleWarm':  '#DFCFAF',   # extras divider
    'ruleBox':   '#D9C49C',   # boxed head rule
    'ruleTag':   '#DDC08A',   # NON AC pill border
    'dot':       '#D3C0A0',   # write-in dotted line
    'dash':      '#CDBFA7',   # em dashes
    'mute':      '#8A7A63',   # small notes
    'mute2':     '#9A8567',   # footnotes
    'mute3':     '#A2917A',   # address
}

THEMES = {
 # --- 1. Ivory & Antique Gold — the current card, deepened and warmed --------
 'ivory': dict(paper='#FCF8F0', panel='#F5EDDC', hilite='#F2E8D4', ink='#1C1510',
    ink2='#3A2A1C', gold='#B07C22', goldDk='#7C5410', goldMd='#9E7530',
    rule='#D8C4A0', ruleSoft='#E8DCC2', ruleWarm='#DCCBA8', ruleBox='#D2BB91',
    ruleTag='#D5B67C', dot='#CDB894', dash='#C7B69C', mute='#7E6E58',
    mute2='#8E7A5C', mute3='#968472'),

 # --- 2. Midnight & Gold — near-black paper, gold rules, cream type ---------
 'midnight': dict(paper='#12100E', panel='#1C1915', hilite='#272219', ink='#F3EADA',
    ink2='#E6D9C2', gold='#D8A94F', goldDk='#C8994060'.replace('60',''), goldMd='#C8A25E',
    rule='#4A4033', ruleSoft='#332C23', ruleWarm='#453B2E', ruleBox='#5A4C38',
    ruleTag='#8A7344', dot='#4A4033', dash='#6B5F4C', mute='#A2957E',
    mute2='#9A8C74', mute3='#8E8170'),

 # --- 3. Royal Emerald — deep green paper, gold, ivory type ----------------
 'emerald': dict(paper='#0C241E', panel='#123029', hilite='#17392F', ink='#F2EADB',
    ink2='#E3D8C2', gold='#D9B368', goldDk='#C9A155', goldMd='#C6A96F',
    rule='#2E5347', ruleSoft='#1E4137', ruleWarm='#2A4E42', ruleBox='#3A6354',
    ruleTag='#7E9A6F', dot='#2E5347', dash='#5E7A6E', mute='#9DB0A4',
    mute2='#93A69A', mute3='#89998F'),

 # --- 4. Oxblood & Champagne — deep wine paper, champagne gold -------------
 'oxblood': dict(paper='#241012', panel='#31171A', hilite='#3A1C1F', ink='#F5EBDC',
    ink2='#E8DAC6', gold='#D9B87A', goldDk='#CBA660', goldMd='#C9AC80',
    rule='#57312F', ruleSoft='#3E1F21', ruleWarm='#4C2A29', ruleBox='#66403A',
    ruleTag='#9A6F55', dot='#57312F', dash='#7E5A52', mute='#B39C8C',
    mute2='#A8907F', mute3='#9C8776'),
}

def build(name):
    t = THEMES[name]
    subprocess.run([sys.executable, 'build.py'], capture_output=True, check=True)
    for variant, src in (('trim', 'menu_trim.html'), ('bleed', 'menu_bleed.html')):
        html = open(src, encoding='utf-8').read()
        # colours are swapped via a single pass so one role can't eat another's hex
        pat = re.compile('|'.join(re.escape(v) for v in ROLE.values()), re.I)
        back = {v.upper(): t[k] for k, v in ROLE.items()}
        html = pat.sub(lambda m: back[m.group(0).upper()], html)
        # the QR is a base64 SVG: recolour it inside the payload
        def fix_qr(m):
            raw = base64.b64decode(m.group(1)).decode()
            raw = raw.replace(ROLE['ink'], t['ink'])
            return 'data:image/svg+xml;base64,' + base64.b64encode(raw.encode()).decode()
        html = re.sub(r'data:image/svg\+xml;base64,([A-Za-z0-9+/=]+)', fix_qr, html)
        # the logo is ink-on-transparent: tint it to the type colour
        html = html.replace(LOGO_TAG, logo_for(t['ink']))
        out = f'theme_{name}_{variant}.html'
        open(out, 'w', encoding='utf-8').write(html)
        subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
            '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw',
            '--virtual-time-budget=8000', f'--print-to-pdf=hayat-{name}-{variant}.pdf',
            '--no-pdf-header-footer', out], capture_output=True)
    return f'hayat-{name}-trim.pdf'

_logo = np.asarray(Image.open('assets/logo_ink.png').convert('RGBA')).astype(np.float32)
LOGO_TAG = None
def logo_for(hexcol):
    c = np.array([int(hexcol[i:i+2], 16) for i in (1, 3, 5)], np.float32)
    a = _logo[..., 3:4] / 255.0
    rgb = np.broadcast_to(c, _logo[..., :3].shape)
    out = np.dstack([rgb, _logo[..., 3]]).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(out, 'RGBA').save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

if __name__ == '__main__':
    subprocess.run([sys.executable, 'build.py'], capture_output=True)
    h = open('menu_trim.html', encoding='utf-8').read()
    m = re.search(r'data:image/png;base64,[A-Za-z0-9+/=]{400,}', h)
    LOGO_TAG = m.group(0)
    for n in (sys.argv[1:] or list(THEMES)):
        print(n, '->', build(n))
