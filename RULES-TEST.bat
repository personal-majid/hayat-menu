@echo off
REM  Tries the security rules against a throwaway Firestore on this PC.
REM  Never touches h-menu. Double-click. Nothing to type.
cd /d "%~dp0"
setlocal

where node >nul 2>&1 || (
  echo.
  echo Node is not installed on this PC.
  echo Get it from https://nodejs.org  -  the big green LTS button.
  echo.
  pause & exit /b 1
)

where java >nul 2>&1
if errorlevel 1 (
  echo.
  echo ===============================================
  echo   The local test needs Java, and this PC
  echo   does not have it.
  echo.
  echo   The Firestore emulator is a Java program.
  echo   Firebase itself does not need Java - only
  echo   this offline test does.
  echo.
  echo   Either install it once:
  echo     https://adoptium.net   (Temurin JRE, next-next-finish)
  echo.
  echo   Or skip the test and publish:
  echo     double-click RULES-PUBLISH.bat
  echo ===============================================
  echo.
  pause & exit /b 2
)

if not exist "node_modules\firebase-tools" (
  echo.
  echo === First run: installing the test tools ===
  echo.
  call npm install --no-audit --no-fund --save-dev firebase firebase-tools @firebase/rules-unit-testing || (
    echo Install failed - send rules-run.log to Claude.
    pause & exit /b 1
  )
)

echo.
echo === Trying firestore.rules ===
echo A throwaway database on this PC. The real one is not touched.
echo The first run downloads the emulator; that needs internet.
echo.

call npx firebase emulators:exec --only firestore --project hayat-rules-test "node tests/rules.test.js" > rules-run.log 2>&1
set RC=%ERRORLEVEL%
type rules-run.log

echo.
if "%RC%"=="0" (
  echo ===============================================
  echo   GREEN. Safe to publish.
  echo   Next: double-click RULES-SHIP.bat
  echo ===============================================
) else (
  echo ===============================================
  echo   RED or could not run. Nothing was published.
  echo   The whole output is saved in rules-run.log
  echo   next to this file - send that to Claude.
  echo ===============================================
)
echo.
pause
exit /b %RC%
