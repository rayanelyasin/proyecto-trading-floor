@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -OpenBrowser
if errorlevel 1 pause
