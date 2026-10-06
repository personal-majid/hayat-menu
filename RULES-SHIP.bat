@echo off
REM  Publishes firestore.rules to the live h-menu database.
REM  Refuses to publish if the tests are red. Double-click.
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
  call npm install --no-audit --no-fund --save-dev firebase firebase-tools @firebase/rules-unit-testing || (
    echo Install failed - send this window to Claude.
    pause & exit /b 1
  )
)

echo.
echo === Step 1 of 2: trying the rules first ===
echo.
call npx firebase emulators:exec --only firestore --project hayat-rules-test "node tests/rules.test.js"
if not "%ERRORLEVEL%"=="0" (
  echo.
  echo ===============================================
  echo   RED. Nothing was published.
  echo   Scroll up - the FAIL lines say what broke.
  echo ===============================================
  echo.
  pause & exit /b 1
)

echo.
echo === Step 2 of 2: publishing to h-menu ===
echo.
echo This replaces the LIVE rules. Everyone is affected in about a minute.
echo Close this window now if you did not mean to.
echo.
pause

call npx firebase projects:list >nul 2>&1 || (
  echo Signing in to Firebase - a browser window will open.
  call npx firebase login || (
    echo Sign-in failed - send this window to Claude.
    pause & exit /b 1
  )
)

call npx firebase deploy --only firestore:rules --project h-menu
set RC=%ERRORLEVEL%

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
  echo   Send this window to Claude.
  echo ===============================================
)
echo.
pause
exit /b %RC%
