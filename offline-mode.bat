@echo off
REM ===========================================================
REM  offline-mode.bat - Generate shorts without internet
REM  Pre-requisite: Run cache-posts.bat while on wifi first!
REM ===========================================================

echo.
echo ===================================
echo  Reddit2Shorts - OFFLINE MODE
echo ===================================
echo.

REM Set ffmpeg in PATH
set PATH=C:\Users\hkalr\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin;%PATH%

REM Check if cache exists
if not exist "cache\posts" (
    echo ERROR: No cached posts found!
    echo Run 'cache-posts.bat' while connected to wifi first.
    echo.
    pause
    exit /b 1
)

REM Check if background assets exist
if not exist "shorts\bgVideo.mp4" (
    echo WARNING: No background video cached!
    echo Make sure you've run the tool at least once online to download bg assets.
    echo.
)

if not exist "shorts\bgAudio.mp3" (
    echo WARNING: No background audio cached!
    echo Make sure you've run the tool at least once online to download bg assets.
    echo.
)

REM Count cached posts
set count=0
for %%f in (cache\posts\*.json) do set /a count+=1
echo Found %count% cached posts ready for offline use.
echo.

REM Run in offline mode - uses cached posts and skips network calls
echo Generating short from cached post...
echo.

bun src/cli.ts --source offline --random %*

echo.
echo Done!
pause
