@echo off
cd /d "%~dp0"
.venv\Scripts\python probe_today.py %1
pause
