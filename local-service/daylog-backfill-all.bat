@echo off
cd /d "%~dp0"
echo Building every day since 2026-07-01 and sending it to Firebase. Takes a few minutes.
.venv\Scripts\python daylog.py backfill --since 2026-07-01
echo.
echo --- local vs Firebase ---
.venv\Scripts\python daylog.py check
pause
