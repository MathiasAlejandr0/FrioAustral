@echo off
title Demo Frio Austral
cd /d "%~dp0"
py -3 -c "import http.server" >nul 2>nul && (py -3 servidor_demo.py 8765 & goto :eof)
python -c "import http.server" >nul 2>nul && (python servidor_demo.py 8765 & goto :eof)
echo Python no esta disponible: uso el servidor de PowerShell.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_demo.ps1" 8765
pause
