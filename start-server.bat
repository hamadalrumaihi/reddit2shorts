@echo off
title R2S Control Panel Server
setlocal

cd /d "%~dp0"
set "PATH=C:\Users\hkalr\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin;%PATH%"

echo ========================================
echo   R2S Mobile Control Panel
echo   Port: 3579
echo   URL: https://map-reroute-freefall.ngrok-free.dev
echo ========================================
echo.

bun src/server/index.ts
