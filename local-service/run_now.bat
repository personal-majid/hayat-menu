@echo off
cd /d "%~dp0"
echo One sync run, with details:
.venv\Scripts\python vmenu_sync.py once -v
pause
