@echo off
REM VedaAide.js 系统验证脚本（Windows）
REM 检查所有依赖、构建、测试等
REM 使用: verify-setup.bat

setlocal enabledelayedexpansion

REM 颜色定义（使用 ANSI 转义码，Windows 10+）
REM 如果不支持，使用普通输出

title VedaAide.js - 系统验证脚本
cls

echo ===============================================================
echo        VedaAide.js - 系统验证脚本 (Windows)
echo ===============================================================
echo.

set PASSED=0
set FAILED=0

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 1. 环境检查
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [1] 环境检查
echo ───────────────────────────────────────────────────────────────

REM 检查 Node.js
echo. & echo -n "检查 Node.js... "
node --version > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo     版本: !NODE_VERSION!
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

REM 检查 npm
echo. & echo -n "检查 npm... "
npm --version > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo     版本: !NPM_VERSION!
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

REM 检查 Git
echo. & echo -n "检查 Git... "
git --version > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

REM 检查 Ollama（可选）
echo. & echo -n "检查 Ollama... "
powershell -Command "try { $response = (New-Object Net.WebClient).DownloadString('http://localhost:11434/api/tags'); exit 0 } catch { exit 1 }" 2> nul
if !errorlevel! equ 0 (
    echo [OK] (运行中)
    set /a PASSED+=1
) else (
    echo [WARN] (未运行，可选)
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 2. 项目配置检查
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [2] 项目配置检查
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "package.json 存在... "
if exist "package.json" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo. & echo -n "tsconfig.json 存在... "
if exist "tsconfig.json" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo. & echo -n ".env.example 存在... "
if exist ".env.example" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo. & echo -n ".env.local 存在... "
if exist ".env.local" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [WARN] 需要创建
    echo     运行: copy .env.example .env.local
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 3. 依赖检查
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [3] 依赖检查
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "检查 node_modules... "
if exist "node_modules" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL] 需要运行 npm install
    set /a FAILED+=1
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 4. 代码质量检查
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [4] 代码质量检查
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "TypeScript 编译... "
call npm run type-check > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo. & echo -n "ESLint 检查... "
call npm run lint > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 5. 构建测试
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [5] 构建测试
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "Next.js 生产构建... "
call npm run build > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 6. 单元测试
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [6] 单元测试
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "运行单元测试 (67 个测试)... "
call npm test > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    echo     所有测试通过
    set /a PASSED+=1
) else (
    echo [FAIL]
    echo     部分测试失败
    set /a FAILED+=1
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 7. 数据库检查
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [7] 数据库检查
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "Prisma schema 检查... "
if exist "prisma\schema.prisma" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [FAIL]
    set /a FAILED+=1
)

echo. & echo -n "数据库文件... "
if exist "dev.db" (
    echo [OK] (已初始化)
    set /a PASSED+=1
) else (
    echo [WARN] 需要运行 npm run db:migrate
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 8. Docker 检查（可选）
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [8] Docker 检查 (可选)
echo ───────────────────────────────────────────────────────────────

echo. & echo -n "Docker... "
docker --version > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [WARN] (未安装)
)

echo. & echo -n "Docker Compose... "
docker-compose --version > nul 2>&1
if !errorlevel! equ 0 (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [WARN] (未安装)
)

echo. & echo -n "Dockerfile 存在... "
if exist "Dockerfile" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [WARN] (未找到)
)

echo. & echo -n "docker-compose.yml 存在... "
if exist "docker-compose.yml" (
    echo [OK]
    set /a PASSED+=1
) else (
    echo [WARN] (未找到)
)

echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM 总结
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ===============================================================
echo        验证结果
echo ===============================================================

echo.
echo [通过] %PASSED%
echo [失败] %FAILED%
echo.

if %FAILED% equ 0 (
    echo ✅ 系统就绪！你可以开始开发了
    echo.
    echo 下一步:
    echo   1. 启动 Ollama:    ollama serve
    echo   2. 启动 API:       npm run dev
    echo   3. 测试 API:       curl http://localhost:3000/api/health
    echo.
    echo 详见:
    echo   - README.md - 完整使用指南
    echo   - QUICK_START.md - 快速参考
    echo   - TESTING.md - 测试详情
    echo.
    pause
    exit /b 0
) else (
    echo ❌ 系统存在问题，请修复后再试
    echo.
    echo 常见解决方案:
    echo   1. npm install                 (# 安装依赖)
    echo   2. copy .env.example .env.local (# 创建环境文件)
    echo   3. npm run db:migrate          (# 初始化数据库)
    echo   4. npm run format              (# 格式化代码)
    echo.
    pause
    exit /b 1
)
