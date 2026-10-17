@echo off
title Kaagaz
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js not found. Install it from https://nodejs.org & pause & exit /b 1)

rem Optional: put your Gemini key in key.txt next to this file for LIVE mode.
if not defined GEMINI_API_KEY if exist key.txt set /p GEMINI_API_KEY=<key.txt

start "" http://localhost:3000
node server.js
pause
