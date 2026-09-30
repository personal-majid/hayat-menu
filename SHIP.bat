@echo off
REM  Commits everything on this PC and pushes it to GitHub (the live site).
REM  Pulls first, so it works from any PC. Double-click. Nothing to type.
cd /d "%~dp0"
for /f "tokens=3 delims== " %%v in ('findstr /C:"const CACHE" sw.js') do set VER=%%v
set VER=%VER:"=%
set VER=%VER:;=%
echo.
echo === Hayat: shipping %VER% ===
echo.
if exist rider-app.tgz (
  echo Unpacking the rider app...
  tar -xzf rider-app.tgz
  del rider-app.tgz
)
REM  private data never goes to GitHub (it stays on the PC; .gitignore keeps it out from now on)
git rm -r -q --cached --ignore-unmatch local-service/daylog local-service/logs local-service/probe_report.txt local-service/probe_today.txt local-service/publish_state.json local-service/config.ini local-service/firebase-key.json >nul 2>&1
echo What is about to be committed:
git status --short
echo.
git add -A
git commit -m "%VER%" >nul 2>&1
git pull --rebase origin main || (echo. & echo Pull failed - send this window to Claude. & pause & exit /b 1)
git push origin main || (echo. & echo Push failed - send this window to Claude. & pause & exit /b 1)
echo.
echo === Done. Live in about a minute: Ctrl+F5 on the board. ===
pause
