@echo off
cd /d "%~dp0"
set /p D=Build day logs since which date? (YYYY-MM-DD): 
.venv\Scripts\python daylog.py backfill --since %D%
pause
