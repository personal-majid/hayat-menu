@echo off
REM  Runs every test: the counter page, the staff login, the rules.
REM  Double-click. Nothing is published and nothing is pushed.
cd /d "%~dp0"
setlocal
set FAILED=

where node >nul 2>&1 || (
  echo.
  echo Node is not installed on this PC. Get it from https://nodejs.org
  echo.
  pause & exit /b 1
)

if not exist "node_modules\playwright" (
  echo.
  echo === First run: installing the test tools ===
  echo This takes a few minutes and only happens once.
  echo.
  call npm install --no-audit --no-fund --save-dev playwright firebase firebase-tools @firebase/rules-unit-testing || (
    echo Install failed - send this window to Claude.
    pause & exit /b 1
  )
  call npx playwright install chromium
)

echo.
echo ===== 1/3  the counter page =====
call node tests\counter.test.js || set FAILED=%FAILED% counter

echo.
echo ===== 2/3  the staff login =====
call node tests\login.test.js || set FAILED=%FAILED% login

echo.
echo ===== 3/3  the security rules =====
call npx firebase emulators:exec --only firestore --project hayat-rules-test "node tests/rules.test.js" || set FAILED=%FAILED% rules

echo.
if "%FAILED%"=="" (
  echo ===============================================
  echo   ALL GREEN - counter, login, rules.
  echo ===============================================
) else (
  echo ===============================================
  echo   RED:%FAILED%
  echo   Scroll up - the FAIL lines say what broke.
  echo ===============================================
)
echo.
pause
