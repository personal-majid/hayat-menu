@echo off
cd /d "%~dp0"
net session >nul 2>&1 || (echo Right-click uninstall.bat and choose "Run as administrator". & pause & exit /b 1)
schtasks /Delete /F /TN "Hayat VMENU Sync"
netsh advfirewall firewall delete rule name="Hayat Live 8765" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*vmenu_sync.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Stopped. Your data in Firebase and cache.db is untouched.
pause
