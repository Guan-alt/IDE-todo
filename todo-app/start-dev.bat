@echo off
cd /d "%~dp0"

echo ================================
echo   Todo - Todo List
echo ================================
echo.

REM ===== 1. Kill old processes =====
echo [1/5] Killing old Electron processes...
taskkill /f /im electron.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo     Done.
) else (
    echo     No Electron process found.
)

echo [2/5] Killing old Vite dev server...
taskkill /f /fi "WINDOWTITLE eq Todo-Vite*" >nul 2>&1
netstat -ano | findstr ":1420" | findstr "LISTENING" > "%temp%\_todo_port.txt" 2>nul
for /f "tokens=5" %%a in (%temp%\_todo_port.txt) do (
    taskkill /f /pid %%a >nul 2>&1
    echo     Killed PID=%%a on port 1420
)
del "%temp%\_todo_port.txt" >nul 2>&1
REM Wait 2 seconds for port to be released
ping -n 3 127.0.0.1 >nul 2>&1
echo     Port 1420 cleaned.

REM ===== 2. Start Vite dev server =====
echo [3/5] Starting Vite dev server...
start "Todo-Vite" /min cmd /c "node_modules\.bin\vite.cmd"

REM ===== 3. Wait for server ready =====
echo      Waiting for Vite server (up to 30s)...
call node_modules\.bin\wait-on.cmd http://localhost:1420 -t 30000
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo [ERROR] Vite server startup timeout!
    echo ========================================
    echo.
    echo Possible causes:
    echo   1. Port 1420 is still occupied
    echo   2. node_modules is not installed
    echo   3. vite.config.js has errors
    echo.
    echo Run "npm install" first if node_modules is missing.
    echo.
    pause
    exit /b 1
)
echo      Vite server ready!

REM ===== 4. Start Electron =====
echo [4/5] Starting Electron app...
call node_modules\.bin\electron.cmd .

REM ===== 5. Cleanup Vite =====
echo [5/5] Shutting down Vite dev server...
taskkill /f /fi "WINDOWTITLE eq Todo-Vite*" >nul 2>&1
netstat -ano | findstr ":1420" | findstr "LISTENING" > "%temp%\_todo_port2.txt" 2>nul
for /f "tokens=5" %%a in (%temp%\_todo_port2.txt) do (
    taskkill /f /pid %%a >nul 2>&1
    echo     Killed Vite PID=%%a
)
del "%temp%\_todo_port2.txt" >nul 2>&1

echo.
echo ================================
echo   App closed
echo ================================
pause
