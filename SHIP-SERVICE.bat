@echo off
REM  Ships the VMENU sync service + simulator. Commits ONLY these files,
REM  so work in progress elsewhere (shop.js etc.) is left alone.
cd /d "%~dp0"
echo.
echo === Hayat: shipping the VMENU sync service + simulator ===
git add sim.html local-service firestore.rules .gitignore SHIP-SERVICE.bat
git status --short sim.html local-service firestore.rules .gitignore
git commit -m "Local VMENU sync service (Hayat Live page, staff roles, day summaries) + service simulator page + vm_ Firestore rules" -- sim.html local-service firestore.rules .gitignore SHIP-SERVICE.bat
git push
echo.
echo Done. Remember: publish firestore.rules in the Firebase console BEFORE running install.bat.
pause
