@echo off
cd /d "%~dp0"
echo === Hayat Day Log: is it running? ===
schtasks /Query /TN "Hayat Day Log" /FO LIST /V | findstr /C:"Status" /C:"Last Run Time" /C:"Last Result" /C:"Next Run Time" /C:"Schedule Type" /C:"Repeat: Every"
echo.
echo --- last 12 log lines ---
powershell -NoProfile -Command "Get-Content logs\daylog.log -Tail 12"
echo.
echo --- local vs Firebase ---
.venv\Scripts\python daylog.py check
pause
