@echo off
REM Reddit2Shorts Automated Scheduler
REM This batch file runs reddit2shorts on a schedule via Windows Task Scheduler.
REM Usage: schedule.bat [install|uninstall|run]

setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

set "PATH=C:\Users\hkalr\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin;%PATH%"

if "%1"=="install" goto :install
if "%1"=="uninstall" goto :uninstall
goto :run

:install
echo Installing Reddit2Shorts scheduled task (every 4 hours)...
schtasks /Create /TN "Reddit2Shorts_AutoPost" /TR "\"%~f0\" run" /SC MINUTE /MO 240 /F
if %errorlevel% equ 0 (
    echo SUCCESS: Task scheduled every 4 hours.
    echo Run 'schtasks /Query /TN "Reddit2Shorts_AutoPost"' to verify.
) else (
    echo FAILED: Could not create scheduled task. Try running as Administrator.
)
goto :eof

:uninstall
echo Removing Reddit2Shorts scheduled task...
schtasks /Delete /TN "Reddit2Shorts_AutoPost" /F
echo Done.
goto :eof

:run
echo [%date% %time%] Starting Reddit2Shorts auto-run...
echo ================================================

REM Run with random post, auto-upload to tiktok, generate metadata
bun run src/cli.ts --random --upload tiktok --generate-metadata --trending

if %errorlevel% equ 0 (
    echo [%date% %time%] SUCCESS: Video created and uploaded.
) else (
    echo [%date% %time%] ERROR: Pipeline failed with exit code %errorlevel%.
)

echo ================================================
echo [%date% %time%] Run complete.
