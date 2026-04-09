#!/bin/bash

# VedaAide 基础设施部署触发脚本
# 通过 GitHub REST API 触发 deploy-infrastructure workflow

set -e

REPO_OWNER="DerekJi"
REPO_NAME="VedaAide.js"
WORKFLOW_FILE="deploy-infrastructure.yml"
ENVIRONMENT="${1:-prod}"
CONTAINER_IMAGE="${2:-ghcr.io/DerekJi/vedaaide-js:latest}"

echo "🚀 触发 GitHub Actions 部署..."
echo "  Repository: $REPO_OWNER/$REPO_NAME"
echo "  Workflow: $WORKFLOW_FILE"
echo "  Environment: $ENVIRONMENT"
echo "  Container Image: $CONTAINER_IMAGE"
echo ""

# 需要 GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 错误: GITHUB_TOKEN 环境变量未设置"
    echo ""
    echo "用法:"
    echo "  1. 创建 GitHub token (https://github.com/settings/tokens)"
    echo "  2. 导出环境变量: export GITHUB_TOKEN=your_token"
    echo "  3. 运行脚本: bash scripts/trigger-deployment.sh prod 'ghcr.io/DerekJi/vedaaide-js:latest'"
    exit 1
fi

# 调用 GitHub API
PAYLOAD=$(cat <<EOF
{
  "ref": "feature/4-testing-devops",
  "inputs": {
    "environment": "$ENVIRONMENT",
    "container_image": "$CONTAINER_IMAGE"
  }
}
EOF
)

echo "📤 发送请求到 GitHub API..."
RESPONSE=$(curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/$WORKFLOW_FILE/dispatches" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | grep -q "api.github.com"; then
    echo "❌ API 错误: $RESPONSE"
    exit 1
fi

echo "✅ 部署已成功触发！"
echo ""
echo "📊 查看部署进度："
echo "  https://github.com/$REPO_OWNER/$REPO_NAME/actions/workflows/$WORKFLOW_FILE"
echo ""
echo "💡 提示："
echo "  - workflow 通常在 30 秒内开始"
echo "  - 完整部署耗时 5-10 分钟"
echo "  - 如需详细日志，点击对应的 workflow run"
