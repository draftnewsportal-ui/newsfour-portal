@echo off
title NEWSFOUR - THE PEOPLE'S NEWSROOM
echo ======================================================================
echo           📰 NEWSFOUR (NEWSഫോർ) - THE PEOPLE'S NEWSROOM
echo ======================================================================
echo.
echo Starting newsroom server...
echo.
cd /d "%~dp0"
set PATH=C:\Users\kamuh\.gemini\antigravity\scratch\nodejs;%PATH%

echo Opening Reader Website in your browser...
timeout /t 2 >nul
start http://localhost:3000

node server.js
pause
