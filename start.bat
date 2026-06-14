@echo off
setlocal enabledelayedexpansion
title AI Voice Drawing Tool - Startup

:: Jump to project directory immediately
cd /d "%~dp0"

echo.
echo ================================================
echo   AI Voice Drawing Tool - One-Click Startup
echo ================================================
echo.

:: ---- 1. Node.js ----
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Node.js not found.
    echo        Please install Node.js 18+ from https://nodejs.org
    goto :fail
)
for /f "tokens=1 delims=v" %%v in ('node -v 2^>^&1') do set NODE_VER=%%v
echo [ OK ] Node.js v%NODE_VER%

:: ---- 2. npm ----
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] npm not found (usually comes with Node.js).
    goto :fail
)
for /f "tokens=2 delims= " %%v in ('npm -v 2^>^&1') do set NPM_VER=%%v
echo [ OK ] npm v%NPM_VER%

:: ---- 3. package.json ----
if not exist "package.json" (
    echo [FAIL] package.json not found.
    echo        Please place start.bat in the project root directory.
    goto :fail
)
echo [ OK ] Working directory: %cd%

:: ---- 4. node_modules ----
if not exist "node_modules" (
    echo [FAIL] Dependencies not installed.
    echo        Please run: npm install
    goto :fail
)
echo [ OK ] node_modules ready

:: ---- 5. server\.env ----
if not exist "server\.env" (
    echo [FAIL] server\.env not found.
    echo        Please copy server\.env.example to server\.env:
    echo        copy server\.env.example server\.env
    echo        Then edit server\.env and set DEEPSEEK_API_KEY.
    goto :fail
)
echo [ OK ] server\.env found

:: ---- 6. DEEPSEEK_API_KEY ----
set HAS_KEY=0
for /f "usebackq tokens=1,2 delims==" %%a in ("server\.env") do (
    if "%%a"=="DEEPSEEK_API_KEY" (
        if not "%%b"=="" (
            if not "%%b"=="your_api_key_here" set HAS_KEY=1
        )
    )
)
if !HAS_KEY!==0 (
    echo [FAIL] DEEPSEEK_API_KEY is not set in server\.env.
    echo        Please edit server\.env and add your DeepSeek API key.
    goto :fail
)
echo [ OK ] DEEPSEEK_API_KEY configured

:: ---- 7. DATABASE_URL (optional) ----
set HAS_DB=0
for /f "usebackq tokens=1,2 delims==" %%a in ("server\.env") do (
    if "%%a"=="DATABASE_URL" (
        if not "%%b"=="" set HAS_DB=1
    )
)
if !HAS_DB!==0 (
    echo [WARN] DATABASE_URL not set - diagram storage unavailable
) else (
    echo [ OK ] DATABASE_URL configured
)

:: ---- 8. Port check ----
set PORT_FREE=1
netstat -ano 2>nul | findstr ":3001 " | findstr "LISTENING" >nul
if !errorlevel!==0 (
    echo [WARN] Port 3001 is in use - server may already be running
    set PORT_FREE=0
)
netstat -ano 2>nul | findstr ":5173 " | findstr "LISTENING" >nul
if !errorlevel!==0 (
    echo [WARN] Port 5173 is in use - client may already be running
    set PORT_FREE=0
)
if !PORT_FREE!==1 echo [ OK ] Ports 3001 and 5173 are free

:: ---- Start ----
echo.
echo ================================================
echo   Starting server on http://localhost:3001
echo   Starting client on http://localhost:5173
echo ================================================
echo.

start "VoiceCanvas-Server" cmd /k "cd /d "%~dp0server" && npx tsx src/index.ts"
timeout /t 3 /nobreak >nul
start "VoiceCanvas-Client" cmd /k "cd /d "%~dp0client" && npx vite --host"

echo   All done. Open http://localhost:5173 in your browser.
echo.
echo   Close the Server and Client windows to stop.
echo.

pause
exit /b 0

:fail
echo.
echo ================================================
echo   Environment check FAILED.
echo   Fix the issues above and run start.bat again.
echo ================================================
echo.
pause
exit /b 1
