@echo off
cd /d "%~dp0"
echo This DELETES every day log on Firebase and on this PC, then rebuilds all of it from VMENU (since 2026-07-01).
echo VMENU itself is not touched. Close this window if you did not mean it.
pause
.venv\Scripts\python daylog.py wipe
.venv\Scripts\python daylog.py backfill --since 2026-07-01
echo.
.venv\Scripts\python daylog.py check
pause
