# -*- coding: utf-8 -*-
"""Cut a dish out of its photo and flatten it onto the paper colour."""
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np, cv2

CREAM = (251,246,236)      # page
PANEL = (246,238,223)      # boxed section

def cutout(src, rect, bg=CREAM, iters=8, upscale=None, clip=1.4, sat=1.05,
           sharp=85, bright=1.0, gamma=1.0, feather=5, grow=0, keep_all=False):
    """rect = (x0,y0,x1,y1) generously around the subject, in source pixels."""
    full = src.convert('RGB')
    FW, FH = full.size
    PROXY = 700.0
    f = min(1.0, PROXY/max(FW,FH))
    prox = full.resize((max(int(FW*f),2), max(int(FH*f),2)), Image.LANCZOS)
    img = np.asarray(prox)
    H, W = img.shape[:2]
    m = np.zeros((H,W), np.uint8)
    x0,y0,x1,y1 = [int(v*f) for v in rect]
    cv2.grabCut(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), m, (x0,y0,x1-x0,y1-y0),
                np.zeros((1,65),np.float64), np.zeros((1,65),np.float64),
                iters, cv2.GC_INIT_WITH_RECT)
    m = np.where((m==cv2.GC_FGD)|(m==cv2.GC_PR_FGD),1,0).astype(np.uint8)
    k = max(3, int(min(H,W)*0.006)) | 1
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN,  np.ones((k,k),np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k*3,k*3),np.uint8))
    if not keep_all:
        n,lbl,st,_ = cv2.connectedComponentsWithStats(m)
        if n > 1:
            m = (lbl == 1+int(np.argmax(st[1:,cv2.CC_STAT_AREA]))).astype(np.uint8)
    ff = m.copy(); hh = np.zeros((H+2,W+2),np.uint8)
    cv2.floodFill(ff,hh,(0,0),1); m = (m | (1-ff)).astype(np.uint8)
    if grow: m = cv2.dilate(m, np.ones((grow,grow),np.uint8))

    S = upscale or 1
    big = full.resize((FW*S, FH*S), Image.LANCZOS) if S>1 else full
    a = cv2.resize(m.astype(np.float32), (big.width,big.height), interpolation=cv2.INTER_CUBIC)
    a = cv2.GaussianBlur(a,(0,0), feather); a = np.clip((a-0.45)/0.14, 0, 1)

    p = np.asarray(big).astype(np.float32)/255.0
    if gamma != 1.0: p = np.power(p, gamma)
    p = (p*255).astype(np.uint8)
    lab = cv2.cvtColor(p, cv2.COLOR_RGB2LAB); L,A,B = cv2.split(lab)
    L = cv2.createCLAHE(clipLimit=clip, tileGridSize=(9,9)).apply(L)
    p = cv2.cvtColor(cv2.merge([L,A,B]), cv2.COLOR_LAB2RGB)
    im = Image.fromarray(p).filter(ImageFilter.UnsharpMask(radius=2.0,percent=sharp,threshold=3))
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(bright)

    arr = np.asarray(im).astype(np.float32)
    back = np.full(arr.shape, bg, np.float32)
    out = Image.fromarray(np.clip(arr*a[...,None] + back*(1-a[...,None]), 0, 255).astype(np.uint8))
    ys,xs = np.nonzero(a > 0.02)
    pad = 4
    return out.crop((max(int(xs.min())-pad,0), max(int(ys.min())-pad,0),
                     min(int(xs.max())+pad,out.width), min(int(ys.max())+pad,out.height)))
