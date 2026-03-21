@echo off
REM Double-click this file (or run from Windows Explorer) so the browser opens in your
REM desktop session — more reliable than some IDE-integrated terminals.
REM Prerequisite: start the app first with "npm run dev" in a normal terminal.

cd /d "%~dp0..\.."
echo.
echo [open-e2e-auth] Project: %CD%
echo [open-e2e-auth] Ensure "npm run dev" is running, then sign in when the browser opens.
echo.
call npm run e2e:auth
echo.
pause
