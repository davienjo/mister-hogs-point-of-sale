@echo off
echo Stopping Mister Hogs SmartPOS...
taskkill /F /IM node.exe >nul 2>nul
if errorlevel 1 (
  echo It doesn't look like it was running.
) else (
  echo Stopped.
)
echo.
echo Note: this stops every Node.js program running on this computer, not
echo just SmartPOS. That's fine on a till machine that only runs this, but
echo be aware of it if this computer runs anything else built with Node.
pause
