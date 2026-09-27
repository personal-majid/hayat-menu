@echo off
setlocal
cd /d "%~dp0"
net session >/dev/null 2>&1 || (echo Right-click watchdog-install.bat and choose "Run as administrator". & pause & exit /b 1)
if not exist .venv (echo Run install.bat first. & pause & exit /b 1)
echo Creating the scheduled task: Hayat Watchdog, every 5 minutes, from boot, as SYSTEM...
schtasks /Create /F /TN "Hayat Watchdog" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /TR "\"%~dp0.venv\Scripts\pythonw.exe\" \"%~dp0watchdog.py\"" || (echo Could not create the task. & pause & exit /b 1)
echo First round now (creates or restarts every other Hayat task)...
.venv\Scripts\python watchdog.py
echo.
echo Done. From now on the PC heals itself; health shows on the owner board.
pause
