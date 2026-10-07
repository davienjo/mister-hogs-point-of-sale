@echo off
title Mister Hogs SmartPOS
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this computer.
  echo Install it from https://nodejs.org (the LTS version), then run this again.
  pause
  exit /b 1
)

echo Starting Mister Hogs SmartPOS...
echo.
echo Keep THIS window open while the till is in use.
echo Close it, or press Ctrl+C, to stop the server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4173"

node server.js
pause
