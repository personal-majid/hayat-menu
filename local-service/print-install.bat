@echo off
setlocal
cd /d "%~dp0"
title Hayat print agent - install
echo.
echo === Hayat print agent: install ===
echo.
net session >nul 2>&1 || (echo Right-click print-install.bat and choose "Run as administrator". & pause & exit /b 1)

set PY=python
where py >nul 2>nul && set PY=py -3
%PY% --version >nul 2>&1 || (echo Python is not installed. Install Python 3.11 or newer from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)

if not exist .venv (
  echo Setting up a private Python...
  %PY% -m venv .venv || (echo Could not create .venv & pause & exit /b 1)
)
echo Installing the parts it needs...
.venv\Scripts\python -m pip install --upgrade pip -q
.venv\Scripts\python -m pip install -r requirements-print.txt -q || (echo Install failed - check the internet connection. & pause & exit /b 1)

if not exist config.ini (
  copy config.example.ini config.ini >nul
  echo config.ini created - only the [firebase] part matters for printing.
)
if not exist firebase-key.json (
  echo firebase-key.json is missing. See README.txt step 2 ^(same key as the VMENU sync^).
  pause & exit /b 1
)

echo.
echo Looking for printers and checking Firebase...
.venv\Scripts\python print_agent.py check

echo.
echo Creating the scheduled task: starts with Windows, restarts if it stops...
schtasks /Create /F /TN "Hayat Print Agent" /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "\"%~dp0.venv\Scripts\pythonw.exe\" \"%~dp0print_agent.py\" run" >nul || (echo Could not create the task. & pause & exit /b 1)
schtasks /Run /TN "Hayat Print Agent" >nul
echo.
echo === Done ===
echo Now open the office -^> Menu -^> Printing, choose "Shop PC printers" and pick the printers.
echo The page shows the agent as online within a minute.
pause
