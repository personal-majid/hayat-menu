@echo off
cd /d "%~dp0"
.venv\Scripts\python vmenu_probe.py
notepad probe_report.txt
pause
