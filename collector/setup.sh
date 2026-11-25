#!/data/data/com.termux/files/usr/bin/bash
# Provision this phone as the Busy Board collector. Safe to re-run.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HOME/.busyboard.env"
BIN="$PREFIX/bin"

echo "==> packages"
pkg update -y
pkg install -y nodejs-lts git cronie termux-api termux-services

echo "==> chromium (needs the x11 repo)"
pkg install -y x11-repo
pkg install -y chromium

CHROMIUM="$PREFIX/bin/chromium-browser"
[ -x "$CHROMIUM" ] || CHROMIUM="$PREFIX/bin/chromium"
[ -x "$CHROMIUM" ] || { echo "chromium install failed"; exit 1; }
echo "    chromium: $CHROMIUM"

echo "==> node deps"
cd "$APP_DIR"
npm install --omit=dev

echo "==> env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
WORKER_URL=
API_TOKEN=
TG_TOKEN=
TG_CHAT_ID=
CHROMIUM_PATH=$CHROMIUM
PLAYWRIGHT_BROWSERS_PATH=0
BB_PROFILE=$HOME/.busyboard-profile
EOF
  chmod 600 "$ENV_FILE"
  echo "    created $ENV_FILE — EDIT IT before the first run"
else
  echo "    $ENV_FILE exists, left alone"
fi

echo "==> commands"
cat > "$BIN/bb-login" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -a; . "$ENV_FILE"; set +a
export DISPLAY=\${DISPLAY:-:0}
cd "$APP_DIR" && exec node login.mjs "\$@"
EOF

cat > "$BIN/bb-check" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -a; . "$ENV_FILE"; set +a
cd "$APP_DIR" && exec node login.mjs --check
EOF

cat > "$BIN/bb-run" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -a; . "$ENV_FILE"; set +a
termux-wake-lock
cd "$APP_DIR" && node scrape.mjs >> "\$HOME/busyboard.log" 2>&1
code=\$?
termux-wake-unlock
exit \$code
EOF

cat > "$BIN/bb-cron" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
# bb-cron on | off | status
ENTRY="7 11-23,0 * * * $BIN/bb-run"
case "\${1:-status}" in
  on)
    sv-enable crond 2>/dev/null || true
    sv up crond 2>/dev/null || true
    TMP=\$(mktemp)
    crontab -l 2>/dev/null | grep -v 'bb-run' > "\$TMP" || true
    echo "\$ENTRY" >> "\$TMP"
    crontab "\$TMP"; rm -f "\$TMP"
    termux-wake-lock 2>/dev/null || true
    echo "cron ON - hourly at :07, 11 am to midnight"
    ;;
  off)
    TMP=\$(mktemp)
    crontab -l 2>/dev/null | grep -v 'bb-run' > "\$TMP" || true
    crontab "\$TMP"; rm -f "\$TMP"
    termux-wake-unlock 2>/dev/null || true
    echo "cron OFF"
    ;;
  status|*)
    if crontab -l 2>/dev/null | grep -q 'bb-run'; then
      echo "cron ON"
      crontab -l | grep 'bb-run'
    else
      echo "cron OFF"
    fi
    LAST=\$(tail -n 40 "\$HOME/busyboard.log" 2>/dev/null | grep -E '^\[' | tail -1)
    [ -n "\$LAST" ] && echo "last: \$LAST" || echo "last: never"
    ;;
esac
EOF

chmod +x "$BIN/bb-login" "$BIN/bb-check" "$BIN/bb-run" "$BIN/bb-cron"

echo "==> hourly cron"
if [ "${BB_NO_CRON:-0}" = "1" ]; then
  echo "    skipped (BB_NO_CRON=1) - testing mode, run bb-run by hand"
else
  sv-enable crond 2>/dev/null || true
  TMP=$(mktemp)
  crontab -l 2>/dev/null | grep -v 'bb-run' > "$TMP" || true
  echo "7 11-23,0 * * * $BIN/bb-run" >> "$TMP"
  crontab "$TMP"
  rm -f "$TMP"
  crontab -l
fi

echo "==> home screen buttons (Termux:Widget)"
SC="$HOME/.shortcuts"
mkdir -p "$SC/tasks"

cat > "$SC/1 Check Session" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
bb-check
echo
read -n 1 -s -r -p "press any key"
EOF

cat > "$SC/2 Run Now" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
bb-run
tail -n 20 "\$HOME/busyboard.log"
echo
read -n 1 -s -r -p "press any key"
EOF

cat > "$SC/3 Cron ON" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
bb-cron on
echo
read -n 1 -s -r -p "press any key"
EOF

cat > "$SC/4 Cron OFF" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
bb-cron off
echo
read -n 1 -s -r -p "press any key"
EOF

cat > "$SC/5 Status" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
bb-cron status
echo
tail -n 20 "\$HOME/busyboard.log" 2>/dev/null
echo
read -n 1 -s -r -p "press any key"
EOF

cat > "$SC/6 Login" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
echo "Open the Termux:X11 app first, then press a key"
read -n 1 -s -r
termux-x11 :0 &
sleep 3
export DISPLAY=:0
bb-login
echo
read -n 1 -s -r -p "press any key"
EOF

chmod +x "$SC"/*
echo "    created 6 shortcuts in ~/.shortcuts"

echo "==> keep running after reboot"
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/busyboard" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
sv-enable crond
EOF
chmod +x "$HOME/.termux/boot/busyboard"

cat <<EOF

────────────────────────────────────────────
 Done. Next:

 1. nano $ENV_FILE        # WORKER_URL, API_TOKEN, Telegram
 2. Install these from F-Droid if missing:
      Termux:X11   (to see the browser for login)
      Termux:API   (wake lock)
      Termux:Boot  (survive reboot)
 3. Open Termux:X11, then here:
      termux-x11 :0 &
      bb-login              # sign in to Google on the phone
 4. bb-check                # must print "alive":true
 5. bb-run                  # one manual read
 6. tail -f ~/busyboard.log

 Controls:
   bb-cron on | off | status
   Add the "Termux:Widget" app, then long-press your home
   screen -> Widgets -> Termux -> pick a shortcut. You get
   tap buttons for Check / Run / Cron ON / Cron OFF / Status / Login.

 Phone settings — do these or Android will kill it:
   Battery  -> Termux -> Unrestricted / No restrictions
   Autostart-> Termux -> allow
   Keep the phone plugged in
────────────────────────────────────────────
EOF
