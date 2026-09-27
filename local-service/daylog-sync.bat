@echo off
cd /d "%~dp0"
echo Checking every day since 2026-07-01 against Firebase; only missing or different days are rebuilt.
.venv\Scripts\python daylog.py sync
echo.
.venv\Scripts\python daylog.py check
pause
