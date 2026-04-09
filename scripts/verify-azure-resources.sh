#!/bin/bash

#
# VedaAide Azure 资源验证脚本
# 用途: 检查和列出现有的 Azure 资源（Cosmos DB、Azure OpenAI、Document Intelligence）
# 使用: bash scripts/verify-azure-resources.sh
#

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $@${NC}"; }
log_success() { echo -e "${GREEN}✅ $@${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $@${NC}"; }
log_error() { echo -e "${RED}❌ $@${NC}"; }

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
ACCOUNT_NAME=$(az account show --query name -o tsv)

log_success "已连接到订阅: $ACCOUNT_NAME ($SUBSCRIPTION_ID)"
echo ""

# 检查 Cosmos DB
log_info "🔍 正在搜索 Cosmos DB 账户..."
COSMOS_ACCOUNTS=$(az cosmosdb list --query "[].{Name:name, ResourceGroup:resourceGroup, Endpoint:documentEndpoint}" -o table)
if [ ! -z "$COSMOS_ACCOUNTS" ]; then
    log_success "找到 Cosmos DB 账户:"
    echo "$COSMOS_ACCOUNTS"
    echo ""
else
    log_warning "未找到 Cosmos DB 账户"
fi

# 检查 Azure OpenAI
log_info "🔍 正在搜索 Azure OpenAI 账户..."
OPENAI_ACCOUNTS=$(az cognitiveservices account list --query "[?kind=='OpenAI'].{Name:name, ResourceGroup:resourceGroup, Endpoint:properties.endpoint}" -o table)
if [ ! -z "$OPENAI_ACCOUNTS" ]; then
    log_success "找到 Azure OpenAI 账户:"
    echo "$OPENAI_ACCOUNTS"
    echo ""
else
    log_warning "未找到 Azure OpenAI 账户"
fi

# 检查 Document Intelligence
log_info "🔍 正在搜索 Document Intelligence 账户..."
DOCINTEL_ACCOUNTS=$(az cognitiveservices account list --query "[?kind=='FormRecognizer'].{Name:name, ResourceGroup:resourceGroup, SKU:sku.name}" -o table)
if [ ! -z "$DOCINTEL_ACCOUNTS" ]; then
    log_success "找到 Document Intelligence 账户:"
    echo "$DOCINTEL_ACCOUNTS"
    echo ""
else
    log_warning "未找到 Document Intelligence 账户"
fi

# 检查 Container Apps Environment
log_info "🔍 正在搜索 Container Apps..."
CONTAINER_APPS=$(az containerapp list --query "[].{Name:name, ResourceGroup:resourceGroup, Status:properties.provisioningState}" -o table)
if [ ! -z "$CONTAINER_APPS" ]; then
    log_success "找到 Container Apps:"
    echo "$CONTAINER_APPS"
    echo ""
else
    log_info "未找到 Container Apps（正常，待部署）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "检查完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 建议:"
echo "  1. 如果没有现有的资源，Bicep 部署会自动创建"
echo "  2. 如果已有现有的资源，在部署参数中指向它们"
echo "  3. 记下资源组名称和账户名称,待会授权时需要用到"
echo ""
