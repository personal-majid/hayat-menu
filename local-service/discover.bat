@echo off
cd /d "%~dp0"
.venv\Scripts\python vmenu_sync.py discover
echo Send discover_report.txt to Claude so the item and open-order columns can be confirmed.
start notepad discover_report.txt
pause
