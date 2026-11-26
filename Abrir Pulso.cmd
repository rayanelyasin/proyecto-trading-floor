@echo off
cd /d "%~dp0"
rem Con Node.js se usa server.mjs (permite abrir el campus desde el teléfono en la misma red y guarda los lugares).
rem Sin Node.js se usa el servidor de PowerShell, solo para esta computadora.
where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:5173
  node server.mjs 5173
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -OpenBrowser
)
if errorlevel 1 pause
