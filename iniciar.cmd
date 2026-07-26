@echo off
setlocal
title Gestor de gastos compartidos
rem Lanzador para uso local: compila si hace falta, levanta el servidor
rem (API + frontend en un solo proceso) y abre el navegador.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

if not exist "client\dist\index.html" goto :build
if not exist "server\dist\index.js" goto :build
goto :run

:build
echo Compilando la aplicacion (solo la primera vez o tras cambios)...
call npm run build
if errorlevel 1 (
  echo.
  echo Fallo la compilacion. Revisa los errores de arriba.
  pause
  exit /b 1
)

:run
set "CLIENT_DIST=../client/dist"
echo.
echo   La app queda disponible en http://localhost:3001
echo   Esta ventana debe permanecer abierta; cerrala para apagar la app.
echo.
rem Abre el navegador apenas el servidor este arriba (2 segundos de margen).
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:3001"
cd server
node dist\index.js
