@echo off
setlocal
cd /d "%~dp0"
title Hayat VMENU sync - install
echo.
echo === Hayat VMENU sync: install ===
echo.
net session >nul 2>&1 || (echo Right-click install.bat and choose "Run as administrator". & pause & exit /b 1)

set PY=python
where py >nul 2>nul && set PY=py -3
%PY% --version >nul 2>&1 || (echo Python is not installed. Install Python 3.11 or newer from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)

if not exist .venv (
  echo Setting up a private Python for the service...
  %PY% -m venv .venv || (echo Could not create .venv & pause & exit /b 1)
)
echo Installing the parts it needs...
.venv\Scripts\python -m pip install --upgrade pip -q
.venv\Scripts\python -m pip install -r requirements.txt -q || (echo Install failed - check the internet connection. & pause & exit /b 1)

if not exist config.ini (
  copy config.example.ini config.ini >nul
  echo.
  echo config.ini created. Fill in the VMENU password and a PIN, save, close Notepad,
  echo then run install.bat again.
  notepad config.ini
  pause
  exit /b 0
)
if not exist firebase-key.json (
  echo firebase-key.json is missing. See README.txt step 2.
  pause & exit /b 1
)

echo.
echo Checking VMENU and Firebase...
.venv\Scripts\python vmenu_sync.py check || (echo. & echo Fix the problem above, then run install.bat again. & pause & exit /b 1)

echo.
echo Creating the scheduled task: every 2 minutes, even when nobody is logged in...
schtasks /Create /F /TN "Hayat VMENU Sync" /SC MINUTE /MO 2 /RU SYSTEM /RL HIGHEST /TR "\"%~dp0.venv\Scripts\pythonw.exe\" \"%~dp0vmenu_sync.py\" tick" || (echo Could not create the task. & pause & exit /b 1)

echo Letting phones on the shop Wi-Fi open the page (port 8765)...
netsh advfirewall firewall delete rule name="Hayat Live 8765" >nul 2>&1
netsh advfirewall firewall add rule name="Hayat Live 8765" dir=in action=allow protocol=TCP localport=8765 profile=private,domain >nul

schtasks /Run /TN "Hayat VMENU Sync" >nul
echo.
echo === Done ===
echo On this PC:            http://localhost:8765
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo On a phone (shop Wi-Fi): http://%%a:8765   ^(no space after //^)
echo.
echo First time? Run backfill.bat once to send the history since July.
pause
