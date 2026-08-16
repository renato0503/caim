@echo off
title CAIM - Dev Server
cd /d "%~dp0"

echo ============================================
echo  CAIM - iniciando servidor de desenvolvimento
echo ============================================
echo.

REM Abre o navegador depois que o servidor estiver no ar
start "" http://localhost:5173/

REM Inicia o Vite (mantem esta janela aberta; feche-a para parar)
npm run dev -- --port 5173 --strictPort

pause