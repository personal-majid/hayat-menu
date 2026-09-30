@echo off
REM  Brings this PC up to date with GitHub. Double-click. Nothing to type.
cd /d "%~dp0"
echo === Hayat: pulling the latest from GitHub ===
git stash list | findstr "before pull" >nul && (echo Restoring files from an earlier attempt... & git stash pop)
echo.
echo remote:
git remote -v
echo.
echo branch:
git branch --show-current
echo.
git stash push -m "before pull" >nul 2>&1
git pull --rebase origin main
if errorlevel 1 (
  git stash pop >nul 2>&1
  echo.
  echo Pull failed - copy this whole window to Claude.
  pause
  exit /b 1
)
git stash pop >nul 2>&1
for /f "tokens=3 delims== " %%v in ('findstr /C:"const CACHE" sw.js') do set VER=%%v
echo.
echo Now at %VER%
echo.
pause
