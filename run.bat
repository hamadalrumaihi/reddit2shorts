@echo off
REM One-click runner for reddit2shorts (Windows).
REM Double-click this file, or run it from a terminal.
REM Optional: pass extra CLI args, e.g.  run.bat --preset aita-judgment

setlocal
cd /d "%~dp0"

echo ============================================
echo  reddit2shorts - one-click runner
echo ============================================

echo.
echo [1/4] Updating from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Git pull failed ^(likely local changes^). Fix/commit them, then re-run.
  pause
  exit /b 1
)

echo.
echo [2/4] Installing dependencies...
call bun install
if errorlevel 1 ( echo bun install failed. & pause & exit /b 1 )

echo.
echo [3/4] Checking environment...
call bun src/cli.ts --doctor
if errorlevel 1 (
  echo.
  echo Environment check FAILED above. Fix the red items, then re-run.
  pause
  exit /b 1
)

echo.
echo [4/4] Rendering a short...
call bun src/cli.ts --random %*
if errorlevel 1 (
  echo.
  echo Render failed. If it said "Could not fetch the Reddit post",
  echo re-run with looser filters, e.g.:
  echo   run.bat --minScore 200 --minComments 10 --maxAgeDays 0
  pause
  exit /b 1
)

echo.
echo Done. Your video is in the shorts\ folder.
pause
