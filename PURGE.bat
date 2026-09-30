@echo off
REM  Removes the day logs / probes (customer data) from ALL of GitHub history.
REM  Run SHIP.bat first. Takes about a minute. Afterwards run RESYNC.bat on the other PC.
cd /d "%~dp0"
echo This rewrites GitHub history so the customer data is gone from every old version.
echo Close this window if you did not mean it.
pause
git pull --rebase origin main || (echo Pull failed - send this window to Claude. & pause & exit /b 1)
set FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --index-filter "git rm -r -q --cached --ignore-unmatch local-service/daylog local-service/logs local-service/probe_report.txt local-service/probe_today.txt local-service/publish_state.json" --prune-empty -- --all || (echo Rewrite failed - send this window to Claude. & pause & exit /b 1)
git push --force origin main || (echo Push failed - send this window to Claude. & pause & exit /b 1)
for /f "delims=" %%r in ('git for-each-ref --format="%%(refname)" refs/original/') do git update-ref -d %%r
git reflog expire --expire=now --all
git gc --prune=now --quiet
echo.
echo === Done. GitHub history is clean. Now run RESYNC.bat on the other PC. ===
pause
