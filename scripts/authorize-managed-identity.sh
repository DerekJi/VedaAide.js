#!/bin/bash

#
# VedaAide Managed Identity 授权脚本
# 用途: 为 Managed Identity 授予 Cosmos DB 和 Azure OpenAI 的访问权限
# 使用: bash scripts/authorize-managed-identity.sh
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $@${NC}"; }
log_success() { echo -e "${GREEN}✅ $@${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $@${NC}"; }
log_error() { echo -e "${RED}❌ $@${NC}"; }

# 配置
RESOURCE_GROUP="${RESOURCE_GROUP:-vedaaide-prod-rg}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-vedaaide-prod-api}"

log_info "获取 Managed Identity 信息..."

# 获取 Managed Identity
IDENTITY_PRINCIPAL_ID=$(az containerapp show \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "identity.principalId" -o tsv 2>/dev/null)

if [ -z "$IDENTITY_PRINCIPAL_ID" ]; then
    log_error "无法获取 Managed Identity，请检查资源是否存在"
    exit 1
fi

log_success "Managed Identity Principal ID: $IDENTITY_PRINCIPAL_ID"

# 获取订阅 ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

log_info "准备授权现有的 Azure 资源..."
echo ""
echo "需要手动完成以下步骤（请在 Azure Portal 或 Azure CLI 中执行）:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Cosmos DB 访问权限"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "请输入你的 Cosmos DB 信息:"
read -p "  Cosmos DB 资源组名称 (RG): " COSMOS_RG
read -p "  Cosmos DB 账户名称: " COSMOS_NAME

if [ ! -z "$COSMOS_RG" ] && [ ! -z "$COSMOS_NAME" ]; then
    log_info "为 Managed Identity 授予 Cosmos DB 访问权限..."
    
    COSMOS_SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$COSMOS_RG/providers/Microsoft.DocumentDB/databaseAccounts/$COSMOS_NAME"
    
    az role assignment create \
        --role "DocumentDB Account Contributor" \
        --assignee-object-id $IDENTITY_PRINCIPAL_ID \
        --scope $COSMOS_SCOPE || \
        log_warning "Cosmos DB 授权可能已存在或遇到错误"
    
    log_success "Cosmos DB 访问权限已授予"
else
    log_warning "跳过 Cosmos DB 授权"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Azure OpenAI 访问权限"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "请输入你的 Azure OpenAI 信息:"
read -p "  Azure OpenAI 资源组名称 (RG): " OPENAI_RG
read -p "  Azure OpenAI 账户名称: " OPENAI_NAME

if [ ! -z "$OPENAI_RG" ] && [ ! -z "$OPENAI_NAME" ]; then
    log_info "为 Managed Identity 授予 Azure OpenAI 访问权限..."
    
    OPENAI_SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$OPENAI_RG/providers/Microsoft.CognitiveServices/accounts/$OPENAI_NAME"
    
    az role assignment create \
        --role "Cognitive Services User" \
        --assignee-object-id $IDENTITY_PRINCIPAL_ID \
        --scope $OPENAI_SCOPE || \
        log_warning "Azure OpenAI 授权可能已存在或遇到错误"
    
    log_success "Azure OpenAI 访问权限已授予"
else
    log_warning "跳过 Azure OpenAI 授权"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Document Intelligence 访问权限"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "是否已有现有的 Document Intelligence 账户? (y/n, 默认 n): " HAS_DOCINTEL
if [ "$HAS_DOCINTEL" = "y" ] || [ "$HAS_DOCINTEL" = "Y" ]; then
    read -p "  Document Intelligence 资源组名称 (RG): " DOCINTEL_RG
    read -p "  Document Intelligence 账户名称: " DOCINTEL_NAME
    
    if [ ! -z "$DOCINTEL_RG" ] && [ ! -z "$DOCINTEL_NAME" ]; then
        log_info "为 Managed Identity 授予 Document Intelligence 访问权限..."
        
        DOCINTEL_SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$DOCINTEL_RG/providers/Microsoft.CognitiveServices/accounts/$DOCINTEL_NAME"
        
        az role assignment create \
            --role "Cognitive Services User" \
            --assignee-object-id $IDENTITY_PRINCIPAL_ID \
            --scope $DOCINTEL_SCOPE || \
            log_warning "Document Intelligence 授权可能已存在或遇到错误"
        
        log_success "Document Intelligence 访问权限已授予"
    fi
else
    log_info "部署时会自动创建一个新的 Document Intelligence (F0 - 每月 500 页免费)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "授权完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "下一步:"
echo "  1. 等待 Container App 健康检查通过（约 10 分钟）"
echo "  2. 查看日志: az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo "  3. 测试 API: curl https://$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)/health"
echo ""
