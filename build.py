#!/usr/bin/env python3
"""Refresh the built-in default copies inside index.html.

Run this after editing config.js, menu-data.js, lang.js or assets/icons.js:

    python3 build.py

It rewrites the four <script>/* defaults from ... */</script> blocks at the
top of index.html so the offline fallback matches your edited files.
"""
import re, sys, pathlib

FILES = ['assets/qr.js', 'assets/icons.js', 'lang.js', 'config.js', 'menu-data.js']
here = pathlib.Path(__file__).parent
html = (here / 'index.html').read_text(encoding='utf-8')

count = 0
for f in FILES:
    body = (here / f).read_text(encoding='utf-8')
    pat = re.compile(r'<script>/\* defaults from ' + re.escape(f) + r' \*/\n.*?\n</script>', re.S)
    new = '<script>/* defaults from ' + f + ' */\n' + body + '\n</script>'
    html, n = pat.subn(lambda m: new, html, count=1)
    if not n:
        print('!! could not find the defaults block for', f)
        sys.exit(1)
    count += 1

(here / 'index.html').write_text(html, encoding='utf-8')
print('refreshed', count, 'default blocks in index.html')
