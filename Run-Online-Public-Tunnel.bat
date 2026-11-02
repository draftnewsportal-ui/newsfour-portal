@echo off
title NEWSFOUR - Online Public Cloudflare Tunnel
echo ======================================================================
echo           🌐 NEWSFOUR (NEWSഫോർ) - ONLINE PUBLIC TUNNEL
echo ======================================================================
echo.
echo Starting secure public Cloudflare Tunnel on port 3000...
echo.
set PATH=C:\Users\kamuh\.gemini\antigravity\scratch;%PATH%
cloudflared.exe tunnel --edge-ip-version 4 --protocol http2 --url http://localhost:3000
pause
