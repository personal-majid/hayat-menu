@echo off
schtasks /End /TN "Hayat Print Agent" >nul 2>&1
schtasks /Delete /F /TN "Hayat Print Agent" >nul 2>&1
echo Print agent removed.
pause
