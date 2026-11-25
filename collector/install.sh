#!/data/data/com.termux/files/usr/bin/bash
# Hayat competitor collector — one-line install on an Android phone (Termux from F-Droid):
#   curl -sL https://personal-majid.github.io/hayat-menu/collector/install.sh | bash
set -e
D="$HOME/hayat-collector"; U="https://personal-majid.github.io/hayat-menu/collector"
mkdir -p "$D"; cd "$D"
for f in lib.mjs scrape.mjs login.mjs places.mjs package.json setup.sh; do curl -sfL "$U/$f?$(date +%s)" -o "$f"; done
bash setup.sh
echo
echo "Next: open the Termux:X11 app, then in Termux:  termux-x11 :0 &   export DISPLAY=:0   bb-login"
echo "Sign in to Google once in the browser that opens. Then:  bb-run   (one read now)   and check the owner app > Insights > Competitors."
