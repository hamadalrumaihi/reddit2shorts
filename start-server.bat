@echo off
REM Start the reddit2shorts remote trigger server + ngrok tunnel
setlocal

cd /d "%~dp0"
set "PATH=C:\Users\hkalr\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin;%PATH%"

echo Starting reddit2shorts server on port 3579...
echo.
echo After the server starts, your ngrok URL is:
echo   https://map-reroute-freefall.ngrok-free.dev
echo.
echo Phone endpoints:
echo   /run              - Make a new video
echo   /run?account=X    - Use specific account
echo   /status           - Check progress
echo   /stop             - Cancel current job
echo.

bun run src/server.ts
