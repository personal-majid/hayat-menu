@echo off
REM  Unpacks the rider app, commits everything, pushes.
REM  Double-click this file. Nothing to type.

cd /d "%~dp0"

echo.
echo === Hayat: shipping v65 + the rider app ===
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
git commit -m "v65: edit orders, discounts, cancel, call the restaurant + rider Android app"
git push

echo.
echo === Done. ===
echo.
echo Now open GitHub -^> Actions -^> "Build rider APK" -^> Run workflow
echo and download hayat-rider.apk when it turns green.
echo.
pause
