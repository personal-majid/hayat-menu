@echo off
rem Hayat sales data for ChatGPT: downloads the day logs (only new days after the first run)
rem and makes Documents\Hayat-data\hayat-data-<date>.zip. Optional: EXPORT-DATA.bat 90  (number of days, default 180)
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (python tools\export_data.py %1) else (py tools\export_data.py %1)
if exist "%USERPROFILE%\Documents\Hayat-data" explorer "%USERPROFILE%\Documents\Hayat-data"
pause
