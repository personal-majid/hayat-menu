# Hayat competitor collector (Android phone)

Reads Google Maps "Popular times" for the competitor list with a real Chromium on an Android phone (signed in to Google
once), ONLY when someone opens the owner app's Competitors page (it checks every 2 minutes from 11 am to midnight, reads within
~3 minutes of being asked, at most once an hour), and writes the readings straight to the Hayat database (crowd/, crowd_hist/,
settings/crowd_health). The owner app shows them under Insights > Competitors — on any phone, iPhone included.

Why a phone and not the owner app itself: Google Maps refuses to open inside another website, and a web page may not read
another site's content. Why not our own APK / iPhone app: Google does not show Popular times when signed out, and it blocks
signing in inside an app's built-in browser. Termux runs real Chromium, so the sign-in works.

Note: reading Popular times this way is not allowed by Google's terms; the risk is on the Google account used to sign in
(use a separate Google account if you prefer). A paid licensed source (e.g. BestTime.app) can replace this later.

## Install (once, ~30 min)
1. On the Android phone install from F-Droid: Termux, Termux:X11, Termux:API (Play Store versions are too old).
2. In Termux:  `curl -sL https://personal-majid.github.io/hayat-menu/collector/install.sh | bash`
3. Open Termux:X11, then in Termux:  `termux-x11 :0 &` , `export DISPLAY=:0` , `bb-login` → sign in to Google once.
4. `bb-run` → one reading now; `tail ~/busyboard.log` shows "ok … LIVE".
5. Keep the phone on charge with Wi-Fi; in Android settings set Termux to "no battery restrictions".

Commands: `bb-run` read now · `bb-cron on|off|status` · `bb-check` is the Google session alive · `bb-login` sign in again.
The list of places: the owner app (Insights > Competitors > Places read) — the collector reads it every run.
