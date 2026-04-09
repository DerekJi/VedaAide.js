#!/bin/bash

#
# VedaAide 一键部署脚本
# 用途: 部署 Bicep 模板到 Azure，创建 Container Apps 环境
# 使用: bash scripts/deploy-to-azure.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}ℹ️  $@${NC}"; }
log_success() { echo -e "${GREEN}✅ $@${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $@${NC}"; }
log_error() { echo -e "${RED}❌ $@${NC}"; }

# 检查前置条件
log_info "检查前置条件..."

if ! command -v az &> /dev/null; then
    log_error "Azure CLI 未安装。请访问 https://learn.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_warning "jq 未安装，某些功能受限。建议安装: apt-get install jq 或 brew install jq"
fi

# 配置变量
RESOURCE_GROUP="${RESOURCE_GROUP:-vedaaide-prod-rg}"
LOCATION="${LOCATION:-australiaeast}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
CONTAINER_IMAGE="${CONTAINER_IMAGE:-}"
COSMOS_ENDPOINT="${COSMOS_ENDPOINT:-}"
OPENAI_ENDPOINT="${OPENAI_ENDPOINT:-}"

# 检查必需的环境变量
if [ -z "$CONTAINER_IMAGE" ]; then
    log_error "CONTAINER_IMAGE 环境变量未设置"
    log_info "用法: CONTAINER_IMAGE=ghcr.io/org/vedaaide-api:sha-xxx bash scripts/deploy-to-azure.sh"
    exit 1
fi

if [ -z "$COSMOS_ENDPOINT" ]; then
    log_error "COSMOS_ENDPOINT 环境变量未设置"
    log_info "用法: COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443 bash scripts/deploy-to-azure.sh"
    exit 1
fi

if [ -z "$OPENAI_ENDPOINT" ]; then
    log_error "OPENAI_ENDPOINT 环境变量未设置"
    log_info "用法: OPENAI_ENDPOINT=https://your-openai.openai.azure.com bash scripts/deploy-to-azure.sh"
    exit 1
fi

# 获取当前 Azure 订阅信息
log_info "获取 Azure 信息..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
ACCOUNT_NAME=$(az account show --query name -o tsv)

log_success "已连接到订阅: $ACCOUNT_NAME ($SUBSCRIPTION_ID)"

# 检查资源组
log_info "检查资源组 '$RESOURCE_GROUP'..."
if az group exists --name $RESOURCE_GROUP | grep -q false; then
    log_warning "资源组不存在，正在创建..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    log_success "资源组已创建"
else
    log_success "资源组已存在"
fi

# 生成部署参数文件
log_info "生成部署参数文件..."
cat > infra/main.parameters.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "containerImage": { "value": "$CONTAINER_IMAGE" },
    "environment": { "value": "$ENVIRONMENT" },
    "azureOpenAiEndpoint": { "value": "$OPENAI_ENDPOINT" },
    "cosmosDbEndpoint": { "value": "$COSMOS_ENDPOINT" },
    "apiKey": { "value": "" },
    "adminApiKey": { "value": "" },
    "allowedOrigins": { "value": "*" }
  }
}
EOF

log_success "参数文件已生成: infra/main.parameters.json"

# 验证 Bicep 模板（跳过 - 直接部署会自动验证）
log_info "跳过详细验证，在部署时自动验证..."

# 部署 Bicep 模板
log_info "部署 Bicep 模板到 Azure..."
log_warning "这可能需要 5-10 分钟，请耐心等待..."

if ! az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file infra/main.bicep \
    --parameters @infra/main.parameters.json \
    --output table; then
    log_error "部署失败"
    exit 1
fi

log_success "部署完成！"

# 获取部署输出（简化版）
log_info "检查部署的容器应用..."
sleep 10
CONTAINER_APP=$(az containerapp list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ 部署信息${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Container App: $CONTAINER_APP"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

if [ -n "$CONTAINER_APP" ]; then
    CONTAINER_URL=$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "N/A")
    echo "URL: https://$CONTAINER_URL"
    echo ""
fi

# 提示下一步
log_info "下一步操作:"
echo "  1. 为 Managed Identity 授予访问权限（如果需要）"
echo "     bash scripts/authorize-managed-identity.sh"
echo ""
echo "  2. 查看容器日志 (部署后)"
if [ -n "$CONTAINER_APP" ]; then
    echo "     az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --follow"
else
    echo "     az containerapp logs show --name <app-name> --resource-group $RESOURCE_GROUP --follow"
fi
echo ""
echo "  3. 测试 API 健康检查"
if [ -n "$CONTAINER_URL" ]; then
    echo "     curl https://$CONTAINER_URL/api/health"
else
    echo "     curl https://<your-url>/api/health"
fi
echo ""

log_success "部署脚本执行完成！"
