@echo off
cd /d "%~dp0"
.venv\Scripts\python watchdog.py status
echo.
.venv\Scripts\python publish.py status
pause
