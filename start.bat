@echo off
cd /d "%~dp0"

REM === Check Node.js ===
where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not installed.
    echo        Download: https://nodejs.org
    pause
    exit /b 1
)
echo [ OK ] Node.js

REM === Check npm ===
where npm >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm not found.
    pause
    exit /b 1
)
echo [ OK ] npm

REM === Check package.json ===
if not exist "package.json" (
    echo [FAIL] package.json not found.
    echo        Run this script from the project root.
    pause
    exit /b 1
)
echo [ OK ] package.json

REM === Check node_modules ===
if not exist "node_modules" (
    echo [FAIL] node_modules not found.
    echo        Run: npm install
    pause
    exit /b 1
)
echo [ OK ] node_modules

REM === Check server\.env ===
if not exist "server\.env" (
    echo [FAIL] server\.env not found.
    echo        Run: copy server\.env.example server\.env
    echo        Then edit server\.env and set DEEPSEEK_API_KEY.
    pause
    exit /b 1
)
echo [ OK ] server\.env

REM === Check DEEPSEEK_API_KEY ===
findstr /b "DEEPSEEK_API_KEY=" "server\.env" >nul 2>&1
if errorlevel 1 (
    echo [FAIL] DEEPSEEK_API_KEY not found in server\.env.
    pause
    exit /b 1
)
echo [ OK ] DEEPSEEK_API_KEY

REM === Start ===
echo.
echo ========================================
echo   Starting backend on http://localhost:3001
echo   Keep the new window open!
echo ========================================
cd /d "%~dp0server"
start "VoiceCanvas-Server" cmd /k "echo Backend: http://localhost:3001 && echo. && npx tsx src/index.ts"
cd /d "%~dp0"

echo Waiting for backend...
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo   Starting frontend on http://localhost:5173
echo   Keep the new window open!
echo ========================================
cd /d "%~dp0client"
start "VoiceCanvas-Client" cmd /k "echo Frontend: http://localhost:5173 && echo. && npx vite --host"
cd /d "%~dp0"

echo.
echo ========================================
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo   Keep both windows open!
echo ========================================
echo.
pause
