@echo off
REM  Publishes firestore.rules to the LIVE h-menu database WITHOUT
REM  running the local test. Use when this PC has no Java.
cd /d "%~dp0"
setlocal

where node >nul 2>&1 || (
  echo.
  echo Node is not installed on this PC. Get it from https://nodejs.org
  echo.
  pause & exit /b 1
)

if not exist "node_modules\firebase-tools" (
  echo.
  echo === First run: installing the tools ===
  echo.
  call npm install --no-audit --no-fund --save-dev firebase-tools || (
    echo Install failed - send rules-run.log to Claude.
    pause & exit /b 1
  )
)

echo.
echo ===============================================
echo   PUBLISHING WITHOUT TESTING
echo.
echo   This replaces the LIVE rules on h-menu.
echo   Everyone is affected in about a minute.
echo.
echo   If it goes wrong: console - Firestore -
echo   Rules - the clock icon - pick the version
echo   before - Publish. Under a minute to undo.
echo ===============================================
echo.
echo Press a key to publish, or close this window to stop.
pause

call npx firebase projects:list >nul 2>&1 || (
  echo.
  echo Signing in to Firebase - a browser window will open.
  call npx firebase login || (
    echo Sign-in failed - send rules-run.log to Claude.
    pause & exit /b 1
  )
)

echo.
call npx firebase deploy --only firestore:rules --project h-menu > rules-run.log 2>&1
set RC=%ERRORLEVEL%
type rules-run.log

echo.
if "%RC%"=="0" (
  echo ===============================================
  echo   Published. Live in about a minute.
  echo.
  echo   Check it: sign in as a waiter, open Counter.
  echo   Counter works, Customers refused = it took.
  echo ===============================================
) else (
  echo ===============================================
  echo   Publish failed. The OLD rules are still live.
  echo   rules-run.log has the reason - send it to Claude.
  echo ===============================================
)
echo.
pause
exit /b %RC%
