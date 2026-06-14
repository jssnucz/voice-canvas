@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   AI 语音绘图工具 — 一键启动       ║
echo  ╚══════════════════════════════════════╝
echo.

:: ============================================================
:: 1. Node.js
:: ============================================================
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] 未检测到 Node.js
    echo        请安装 Node.js 18+ : https://nodejs.org
    goto :end
)
for /f "tokens=1 delims=v" %%v in ('node -v 2^>^&1') do set NODE_VER=%%v
echo [ OK ] Node.js v%NODE_VER%

:: ============================================================
:: 2. npm
:: ============================================================
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] 未检测到 npm（通常随 Node.js 一起安装）
    goto :end
)
for /f "tokens=2 delims= " %%v in ('npm -v 2^>^&1') do set NPM_VER=%%v
echo [ OK ] npm v%NPM_VER%

:: ============================================================
:: 3. 项目根目录
:: ============================================================
cd /d "%~dp0"
if not exist "package.json" (
    echo [FAIL] 未找到 package.json，请从项目根目录运行 start.bat
    goto :end
)
echo [ OK ] 项目根目录: %~dp0

:: ============================================================
:: 4. node_modules
:: ============================================================
if not exist "node_modules" (
    echo [FAIL] 依赖未安装，请先运行: npm install
    goto :end
)
echo [ OK ] node_modules 已就绪

:: ============================================================
:: 5. server/.env + DEEPSEEK_API_KEY
:: ============================================================
if not exist "server\.env" (
    echo [FAIL] server\.env 不存在
    echo        请复制 server\.env.example 为 server\.env 并填入 API Key
    goto :end
)

set HAS_KEY=0
for /f "usebackq tokens=1,2 delims==" %%a in ("server\.env") do (
    set "key=%%a"
    set "val=%%b"
    if "!key!"=="DEEPSEEK_API_KEY" if not "!val!"=="" if not "!val!"=="your_api_key_here" set HAS_KEY=1
)
if !HAS_KEY!==0 (
    echo [FAIL] server\.env 中 DEEPSEEK_API_KEY 未配置
    echo        请编辑 server\.env 填入你的 DeepSeek API Key
    goto :end
)
echo [ OK ] DEEPSEEK_API_KEY 已配置

:: ============================================================
:: 6. DATABASE_URL（可选，仅提示）
:: ============================================================
set HAS_DB=0
for /f "usebackq tokens=1,2 delims==" %%a in ("server\.env") do (
    set "key=%%a"
    set "val=%%b"
    if "!key!"=="DATABASE_URL" if not "!val!"=="" set HAS_DB=1
)
if !HAS_DB!==0 (
    echo [WARN] DATABASE_URL 未配置 — 画布存储功能不可用
) else (
    echo [ OK ] DATABASE_URL 已配置
)

:: ============================================================
:: 7. 端口检查
:: ============================================================
set PORT_FREE=1

netstat -ano 2>nul | findstr ":3001 " | findstr "LISTENING" >nul
if !errorlevel!==0 (
    echo [WARN] 端口 3001 已被占用 — 后端可能已在运行
    set PORT_FREE=0
)

netstat -ano 2>nul | findstr ":5173 " | findstr "LISTENING" >nul
if !errorlevel!==0 (
    echo [WARN] 端口 5173 已被占用 — 前端可能已在运行
    set PORT_FREE=0
)

if !PORT_FREE!==1 (
    echo [ OK ] 端口 3001、5173 空闲
)

:: ============================================================
:: 启动
:: ============================================================
echo.
echo  ═══════════════════════════════════════
echo   启动后端 http://localhost:3001
echo   启动前端 http://localhost:5173
echo  ═══════════════════════════════════════
echo.

:: 启动后端
start "VoiceCanvas Server" cmd /c "cd /d "%~dp0server" && npx tsx src/index.ts"

:: 等后端就绪
echo   等待后端就绪...
timeout /t 3 /nobreak >nul

:: 启动前端
start "VoiceCanvas Client" cmd /c "cd /d "%~dp0client" && npx vite --host"

echo.
echo   ✅ 启动完成，浏览器打开 http://localhost:5173
echo.
echo   关闭此窗口不会停止服务，请关闭后端/前端窗口。
echo.

goto :eof

:end
echo.
echo   ❌ 环境检查未通过，请修复上述问题后重试。
echo.
pause
exit /b 1
