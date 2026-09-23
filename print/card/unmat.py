# -*- coding: utf-8 -*-
"""Recover RGBA cutouts from the dish photos that were flattened onto a flat paper colour.
P = a*F + (1-a)*B  with B known and flat -> solve for a and F, then recomposite anywhere."""
import numpy as np
from PIL import Image

def unmatte(path, bg, t_lo=10.0, t_hi=44.0):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    B = np.array(bg, np.float32)
    d = np.linalg.norm(im - B, axis=2)                 # distance from the paper colour
    a = np.clip((d - t_lo) / (t_hi - t_lo), 0.0, 1.0)  # soft alpha across the edge band
    aa = np.maximum(a, 1e-4)[..., None]
    F = np.clip((im - (1.0 - aa) * B) / aa, 0, 255)    # un-multiply to get true colour
    out = np.dstack([F, a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

if __name__ == '__main__':
    CREAM = (251, 246, 236)
    PANEL = (246, 238, 223)
    jobs = [('cut-fish', PANEL), ('cut-broast', PANEL),
            ('cut-mandi', CREAM), ('cut-alfaham', CREAM), ('cut-mojito', PANEL)]
    for name, bg in jobs:
        im = unmatte(f'assets/{name}.jpg', bg)
        im.save(f'assets/{name}.png')
        a = np.asarray(im)[..., 3]
        print(f'{name:12} solid {(a==255).mean()*100:5.1f}%   edge {((a>0)&(a<255)).mean()*100:4.1f}%')
