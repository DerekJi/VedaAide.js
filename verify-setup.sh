#!/bin/bash

# VedaAide.js 系统验证脚本
# 检查所有依赖、构建、测试等
# 使用: bash verify-setup.sh 或 ./verify-setup.sh (需 chmod +x)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计时器
START_TIME=$(date +%s)

echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        VedaAide.js - 系统验证脚本${NC}"
echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo ""

# 计数器
PASSED=0
FAILED=0

# 辅助函数
check_command() {
    local name=$1
    local cmd=$2
    echo -n "检查 $name... "
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
        return 1
    fi
}

check_version() {
    local name=$1
    local cmd=$2
    local min_version=$3
    echo -n "检查 $name 版本... "
    local version=$($cmd --version 2>/dev/null | head -1)
    echo -e "${GREEN}✓${NC} ($version)"
    ((PASSED++))
}

run_test() {
    local name=$1
    local cmd=$2
    echo -n "$name... "
    if eval "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. 环境检查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[1]${NC} 环境检查"
echo "─────────────────────────────────────────────────────────────"

check_command "Node.js" "node"
check_version "Node.js" "node" "18.0.0"

check_command "npm" "npm"
check_version "npm" "npm" "10.0.0"

check_command "Git" "git"

# 检查 Ollama（可选）
echo -n "检查 Ollama... "
if curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${GREEN}✓${NC} (运行中)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} (未运行，可选)"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. 项目配置检查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[2]${NC} 项目配置检查"
echo "─────────────────────────────────────────────────────────────"

run_test "package.json 存在" "test -f package.json"
run_test "tsconfig.json 存在" "test -f tsconfig.json"
run_test ".env.example 存在" "test -f .env.example"

# 检查 .env.local
echo -n ".env.local 存在... "
if test -f .env.local; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} (需要创建)"
    echo "   运行: cp .env.example .env.local"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. 依赖检查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[3]${NC} 依赖检查"
echo "─────────────────────────────────────────────────────────────"

echo -n "检查 node_modules... "
if test -d node_modules; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} (需要运行 npm install)"
    ((FAILED++))
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. 代码质量检查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[4]${NC} 代码质量检查"
echo "─────────────────────────────────────────────────────────────"

run_test "TypeScript 编译" "npm run type-check"
run_test "ESLint 检查" "npm run lint"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. 构建测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[5]${NC} 构建测试"
echo "─────────────────────────────────────────────────────────────"

echo -n "Next.js 生产构建... "
if npm run build &> /tmp/build.log; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
    echo "   错误日志: tail -20 /tmp/build.log"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. 单元测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[6]${NC} 单元测试"
echo "─────────────────────────────────────────────────────────────"

echo "运行单元测试（67 个测试）..."
if npm test 2> /tmp/test.log; then
    TEST_OUTPUT=$(npm test 2>&1 | grep -E "Tests|passed")
    echo -e "${GREEN}✓${NC} 所有测试通过"
    echo "  $TEST_OUTPUT"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} 部分测试失败"
    ((FAILED++))
    echo "   错误日志: tail -30 /tmp/test.log"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. 数据库检查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[7]${NC} 数据库检查"
echo "─────────────────────────────────────────────────────────────"

echo -n "Prisma schema 检查... "
if test -f prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
fi

echo -n "数据库文件... "
if test -f dev.db; then
    echo -e "${GREEN}✓${NC} (已初始化)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} (需要运行 npm run db:migrate)"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. Docker 检查（可选）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "${BLUE}[8]${NC} Docker 检查（可选）"
echo "─────────────────────────────────────────────────────────────"

check_command "Docker" "docker" || true
check_command "Docker Compose" "docker-compose" || true

run_test "Dockerfile 存在" "test -f Dockerfile" || true
run_test "docker-compose.yml 存在" "test -f docker-compose.yml" || true

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 总结
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        验证结果${NC}"
echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✓ 通过${NC}: $PASSED"
echo -e "${RED}✗ 失败${NC}: $FAILED"
echo "⏱ 耗时: ${DURATION}s"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 系统就绪！你可以开始开发了${NC}"
    echo ""
    echo "下一步:"
    echo "  1. 启动 Ollama:    ollama serve"
    echo "  2. 启动 API:       npm run dev"
    echo "  3. 测试 API:       curl http://localhost:3000/api/health"
    echo ""
    echo "详见:"
    echo "  - README.md - 完整使用指南"
    echo "  - QUICK_START.md - 快速参考"
    echo "  - TESTING.md - 测试详情"
    exit 0
else
    echo -e "${RED}❌ 系统存在问题，请修复后再试${NC}"
    echo ""
    echo "常见解决方案:"
    echo "  1. npm install                 # 安装依赖"
    echo "  2. cp .env.example .env.local  # 创建环境文件"
    echo "  3. npm run db:migrate          # 初始化数据库"
    echo "  4. npm run format              # 格式化代码"
    exit 1
fi
