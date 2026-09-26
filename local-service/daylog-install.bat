@echo off
setlocal
cd /d "%~dp0"
net session >nul 2>&1 || (echo Right-click daylog-install.bat and choose "Run as administrator". & pause & exit /b 1)
if not exist .venv (echo Run install.bat first. & pause & exit /b 1)
echo Creating the scheduled task: Hayat Day Log, every 2 minutes...
schtasks /Create /F /TN "Hayat Day Log" /SC MINUTE /MO 2 /RU SYSTEM /RL HIGHEST /TR "\"%~dp0.venv\Scripts\pythonw.exe\" \"%~dp0daylog.py\" tick" || (echo Could not create the task. & pause & exit /b 1)
schtasks /Run /TN "Hayat Day Log" >nul
echo Done. Day files: %~dp0daylog\   Firebase: vm_daylog\{date}
pause
