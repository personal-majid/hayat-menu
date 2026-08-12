# Hayat Fish & Mandi — digital table menu

Static kiosk menu for a Lenovo 11" Android tablet on the customer's table.
Replaces the printed menu. No cart, no ordering.

Live on Cloudflare Pages. Build tag: `hayat-v18`.

## What it does

| Feature | Notes |
|---|---|
| 12 sections / 70 dishes | every dish has a photo and its own page |
| Quarter / Half / Full pricing | stacked rows, prices to the right |
| English ⇄ Malayalam | toggle in the header |
| Kiosk mode | nothing navigates away from the tablet |
| Instagram reels | real embeds; tap shows a QR so the guest watches on their own phone |
| Celebrate with Hayat | party enquiry + phone-number lead capture |
| Star rating | 1–3★ private complaint, 4–5★ Google review QR |
| Works offline | service worker caches the whole site |

## Files

| File | Purpose |
|---|---|
| `index.html` | the whole app (data files inlined as offline defaults) |
| `config.js` | phone numbers, Instagram handle, reels, upsells — **edit this** |
| `menu-data.js` | sections, dishes, prices — **edit this** |
| `lang.js` | English / Malayalam wording |
| `assets/qr.js` | runtime QR encoder (no QR image files needed) |
| `assets/icons.js` | vector dish icons, used when a photo is missing |
| `sw.js` | offline cache — bump `CACHE` on every deploy |
| `build.py` | re-inlines the data files into `index.html` — run after any data edit |
| `make-art.py` | regenerates dish artwork |
| `place-photos.py` | crops real photos to 4:3 and grades them |

## Editing workflow

```bash
# 1. edit config.js / menu-data.js / lang.js
python3 build.py            # re-inline the defaults — REQUIRED
# 2. bump const CACHE = "hayat-vNN" in sw.js
# 3. zip the folder and drag it into the existing Cloudflare Pages project
```

Skipping `build.py` means the offline copy inside `index.html` stays stale.
Skipping the `sw.js` bump means tablets keep showing the old version.

Full instructions: `UPLOAD-ME.txt`, `CLOUDFLARE-UPDATE.txt`.

## Still to fill in

- [ ] Delivery Line 2 and 3 in `config.js` are `+910000000000` placeholders
- [ ] Biryani prices (₹180–590) are unconfirmed
- [ ] Chorum Meenum & Seafood prices (₹150–260) are unconfirmed
- [ ] Malayalam in `lang.js` is transliteration, not verified translation
- [ ] Confirm the mojito photo is ours (it carried another brand's watermark)
- [ ] Replace generated dish artwork with real photos — see `PHOTOS.txt`
