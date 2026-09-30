@echo off
REM  After PURGE.bat ran on another PC: make this PC match GitHub again.
REM  Your local files that are not in git (config.ini, firebase-key.json, daylog\, logs\) are untouched.
cd /d "%~dp0"
git fetch origin && git reset --hard origin/main || (echo Failed - send this window to Claude. & pause & exit /b 1)
for /f "tokens=3 delims== " %%v in ('findstr /C:"const CACHE" sw.js') do set VER=%%v
echo.
echo Now at %VER%
pause
