@echo off
REM ===========================================================
REM  cache-posts.bat - Pre-download Reddit posts for offline use
REM  Run this while connected to wifi!
REM ===========================================================

echo.
echo ===================================
echo  Reddit2Shorts - Post Cacher
echo  Run this while you have internet!
echo ===================================
echo.

REM Set ffmpeg in PATH
set PATH=C:\Users\hkalr\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin;%PATH%

REM Create cache directory if it doesn't exist
if not exist "cache\posts" mkdir "cache\posts"

REM Cache 25 posts by default, pass --count N for more
echo Fetching posts from Reddit...
echo.

bun src/utils/cachePosts.ts %*

echo.
echo Done! Your posts are cached in cache\posts\
echo You can now use 'offline-mode.bat' without internet.
echo.
pause
