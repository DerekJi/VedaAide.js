#!/bin/bash

#
# VedaAide 部署后监控脚本
# 用途: 实时监控 Container App 的运行状态
# 使用: bash scripts/monitor-deployment.sh
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $@${NC}"; }
log_success() { echo -e "${GREEN}✅ $@${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $@${NC}"; }
log_error() { echo -e "${RED}❌ $@${NC}"; }

# 配置
RESOURCE_GROUP="${RESOURCE_GROUP:-vedaaide-prod-rg}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-vedaaide-prod-api}"

log_info "正在连接到 Container App..."

# 检查 Container App 是否存在
if ! az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    log_error "Container App '$CONTAINER_APP_NAME' 在资源组 '$RESOURCE_GROUP' 中不存在"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}📊 Container App 状态监控${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 获取基本信息
log_info "获取 Container App 信息..."
FQDN=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
PROVISIONING_STATE=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.provisioningState" -o tsv)

echo -e "应用名称: ${CYAN}$CONTAINER_APP_NAME${NC}"
echo -e "资源组: ${CYAN}$RESOURCE_GROUP${NC}"
echo -e "FQDN: ${CYAN}$FQDN${NC}"
echo -e "配置状态: ${CYAN}$PROVISIONING_STATE${NC}"
echo ""

# 检查副本状态
log_info "检查容器副本..."
echo ""
az containerapp revision list \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "[0:3].{Name:name, Status:properties.trafficWeight, Active:properties.active, Created:properties.createdTime, Replicas:properties.replicas[0].status}" \
    -o table

echo ""

# 测试健康检查
log_info "测试健康检查端点..."
echo ""
if curl -s -o /dev/null -w "%{http_code}" "https://$FQDN/health" | grep -q "200\|204"; then
    log_success "健康检查通过 ✓"
else
    log_warning "健康检查未通过（容器可能还在启动，请等待 10 分钟）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}📝 实时日志 (最近 50 行)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

az containerapp logs show \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --tail 50

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 常用命令:"
echo ""
echo "  实时日志监控 (Ctrl+C 退出):"
echo "    az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "  查看环境变量:"
echo "    az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query 'properties.template.containers[0].env' -o table"
echo ""
echo "  测试 API:"
echo "    curl https://$FQDN/health"
echo ""
echo "  重启容器:"
echo "    az containerapp revision restart --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --revision <REVISION_NAME>"
echo ""
