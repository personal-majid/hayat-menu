@echo off
REM  Tries the security rules against a throwaway Firestore on this PC.
REM  Never touches h-menu. Double-click. Nothing to type.
cd /d "%~dp0"
setlocal

where node >nul 2>&1 || (
  echo.
  echo Node is not installed on this PC.
  echo Get it from https://nodejs.org  -  the big green LTS button.
  echo Then run this again.
  echo.
  pause & exit /b 1
)

if not exist "node_modules\firebase-tools" (
  echo.
  echo === First run: installing the test tools ===
  echo This takes a few minutes and only happens once.
  echo.
  call npm install --no-audit --no-fund --save-dev firebase firebase-tools @firebase/rules-unit-testing || (
    echo.
    echo Install failed - send this window to Claude.
    pause & exit /b 1
  )
)

echo.
echo === Trying firestore.rules ===
echo A throwaway database on this PC. The real one is not touched.
echo.

call npx firebase emulators:exec --only firestore --project hayat-rules-test "node tests/rules.test.js"
set RC=%ERRORLEVEL%

echo.
if "%RC%"=="0" (
  echo ===============================================
  echo   GREEN. The rules are safe to publish.
  echo   Next: double-click RULES-SHIP.bat
  echo ===============================================
) else (
  echo ===============================================
  echo   RED. DO NOT PUBLISH.
  echo   Scroll up - the FAIL lines say what broke.
  echo ===============================================
)
echo.
pause
exit /b %RC%
