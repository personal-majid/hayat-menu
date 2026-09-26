@echo off
cd /d "%~dp0"
set /p SINCE=Send bills since which date? (YYYY-MM-DD, e.g. 2026-07-01): 
.venv\Scripts\python vmenu_sync.py backfill --since %SINCE% -v
pause
