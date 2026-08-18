@echo off
cd /d "%~dp0"

REM ===== 1. Kill old processes =====
taskkill /f /im electron.exe >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Todo-Vite*" >nul 2>&1
netstat -ano | findstr ":1420" | findstr "LISTENING" > "%temp%\_todo_port.txt" 2>nul
for /f "tokens=5" %%a in (%temp%\_todo_port.txt) do (
    taskkill /f /pid %%a >nul 2>&1
)
del "%temp%\_todo_port.txt" >nul 2>&1
ping -n 3 127.0.0.1 >nul 2>&1

REM ===== 2. Start Vite dev server (hidden) =====
start "Todo-Vite" /min cmd /c "node_modules\.bin\vite.cmd"

REM ===== 3. Wait for server ready =====
call node_modules\.bin\wait-on.cmd http://localhost:1420 -t 30000
if %errorlevel% neq 0 (
    echo [ERROR] Vite server startup timeout!
    echo Run "npm install" first if node_modules is missing.
    pause
    exit /b 1
)

REM ===== 4. Start Electron (no console window) =====
start "" node_modules\.bin\electron.cmd .

REM ===== 5. Exit launcher batch =====
exit
