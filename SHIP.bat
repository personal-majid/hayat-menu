@echo off
REM  Unpacks the rider app, commits everything, pushes to GitHub.
REM  Double-click this file. Nothing to type.

cd /d "%~dp0"

echo.
echo === Hayat: shipping v66 - v70 ===
echo.

if exist rider-app.tgz (
  echo Unpacking the rider app...
  tar -xzf rider-app.tgz
  del rider-app.tgz
)

echo.
echo What is about to be committed:
git status --short
echo.

git add -A
git commit -m "v66-v70: rider.html installs as an icon, bike markers on both maps, 5s pings, map closes on delivered, always-location ask, office can edit a rider"
git push

echo.
echo === Done. GitHub Pages rebuilds in about a minute. ===
echo.
echo For the rider APK: GitHub -^> Actions -^> "Build rider APK" -^> Run workflow
echo then download hayat-rider.apk when it turns green.
echo.
pause
