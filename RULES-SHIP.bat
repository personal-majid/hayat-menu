@echo off
REM  Tests the rules, then publishes them to the live h-menu database.
REM  Will not publish on a red test. Double-click.
cd /d "%~dp0"
setlocal

where node >nul 2>&1 || (
  echo.
  echo Node is not installed on this PC. Get it from https://nodejs.org
  echo.
  pause & exit /b 1
)

where java >nul 2>&1
if errorlevel 1 (
  echo.
  echo ===============================================
  echo   This PC has no Java, so the offline test
  echo   cannot run. The Firestore emulator is a
  echo   Java program; Firebase itself is not.
  echo.
  echo   Two ways on:
  echo.
  echo     1. Install Java once, then run this again
  echo        https://adoptium.net  (Temurin JRE)
  echo.
  echo     2. Publish without the test
  echo        double-click RULES-PUBLISH.bat
  echo ===============================================
  echo.
  pause & exit /b 2
)

if not exist "node_modules\firebase-tools" (
  echo.
  echo === First run: installing the tools ===
  echo.
  call npm install --no-audit --no-fund --save-dev firebase firebase-tools @firebase/rules-unit-testing || (
    echo Install failed - send rules-run.log to Claude.
    pause & exit /b 1
  )
)

echo.
echo === Step 1 of 2: trying the rules first ===
echo The first run downloads the emulator; that needs internet.
echo.
call npx firebase emulators:exec --only firestore --project hayat-rules-test "node tests/rules.test.js" > rules-run.log 2>&1
set RC=%ERRORLEVEL%
type rules-run.log

if not "%RC%"=="0" (
  echo.
  echo ===============================================
  echo   The test did not pass. Nothing was published.
  echo.
  echo   If the FAIL lines name a rule, fix the rule.
  echo   If it never got that far - no download, no
  echo   emulator - the test could not run, and
  echo   RULES-PUBLISH.bat will publish without it.
  echo.
  echo   The whole output is in rules-run.log next to
  echo   this file. Send that to Claude.
  echo ===============================================
  echo.
  pause & exit /b 1
)

echo.
echo === Step 2 of 2: publishing to h-menu ===
echo.
echo This replaces the LIVE rules. Everyone is affected in about a minute.
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
  echo.
  echo   To undo: console - Rules - the clock icon,
  echo   pick the version before, Publish.
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
