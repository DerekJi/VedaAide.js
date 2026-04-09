# VedaAide 一键部署脚本 - PowerShell 版本
# 用途: 部署 Bicep 模板到 Azure，创建 Container Apps 环境  
# 使用: .\scripts\deploy-to-azure.ps1
#

param(
    [string]$ResourceGroup = "vedaaide-prod-rg",
    [string]$Location = "australiaeast",
    [string]$Environment = "prod",
    [string]$ContainerImage = $env:CONTAINER_IMAGE,
    [string]$CosmosEndpoint = $env:COSMOS_ENDPOINT,
    [string]$OpenAiEndpoint = $env:OPENAI_ENDPOINT
)

# 颜色定义
$InfoColor = "Cyan"
$SuccessColor = "Green"
$WarningColor = "Yellow"
$ErrorColor = "Red"

# 日志函数
function Write-InfoLine {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $InfoColor
}

function Write-SuccessLine {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $SuccessColor
}

function Write-WarningLine {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $WarningColor
}

function Write-ErrorLine {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $ErrorColor
}

# 检查前置条件
Write-InfoLine "检查前置条件..."

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-ErrorLine "Azure CLI 未安装"
    Write-InfoLine "请访问 https://learn.microsoft.com/cli/azure/install-azure-cli"
    exit 1
}

Write-SuccessLine "Azure CLI 已安装"

# 检查必需的环境变量
if ([string]::IsNullOrEmpty($ContainerImage)) {
    Write-ErrorLine "CONTAINER_IMAGE 环境变量未设置"
    Write-InfoLine "用法: `$env:CONTAINER_IMAGE='ghcr.io/org/vedaaide-api:sha-xxx' ; .\scripts\deploy-to-azure.ps1"
    exit 1
}

if ([string]::IsNullOrEmpty($CosmosEndpoint)) {
    Write-ErrorLine "COSMOS_ENDPOINT 环境变量未设置"
    exit 1
}

if ([string]::IsNullOrEmpty($OpenAiEndpoint)) {
    Write-ErrorLine "OPENAI_ENDPOINT 环境变量未设置"
    exit 1
}

# 获取 Azure 订阅信息
Write-InfoLine "获取 Azure 信息..."
$SubscriptionInfo = az account show | ConvertFrom-Json
$SubscriptionId = $SubscriptionInfo.id
$AccountName = $SubscriptionInfo.name

Write-SuccessLine "已连接到订阅: $AccountName ($SubscriptionId)"

# 检查资源组
Write-InfoLine "检查资源组 '$ResourceGroup'..."
$RgExists = az group exists --name $ResourceGroup | ConvertFrom-Json

if (-not $RgExists) {
    Write-WarningLine "资源组不存在，正在创建..."
    az group create --name $ResourceGroup --location $Location | Out-Null
    Write-SuccessLine "资源组已创建"
} else {
    Write-SuccessLine "资源组已存在"
}

# 生成部署参数文件
Write-InfoLine "生成部署参数文件..."

$ParametersJson = @{
    "`$schema" = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
    "contentVersion" = "1.0.0.0"
    "parameters" = @{
        "containerImage" = @{ "value" = $ContainerImage }
        "environment" = @{ "value" = $Environment }
        "azureOpenAiEndpoint" = @{ "value" = $OpenAiEndpoint }
        "cosmosDbEndpoint" = @{ "value" = $CosmosEndpoint }
        "apiKey" = @{ "value" = "" }
        "adminApiKey" = @{ "value" = "" }
        "allowedOrigins" = @{ "value" = "*" }
    }
} | ConvertTo-Json -Depth 10

$ParametersJson | Out-File -FilePath "infra/main.parameters.json" -Encoding UTF8
Write-SuccessLine "参数文件已生成: infra/main.parameters.json"

# 验证 Bicep 模板
Write-InfoLine "验证 Bicep 模板..."

try {
    az deployment group validate `
        --resource-group $ResourceGroup `
        --template-file infra/main.bicep `
        --parameters @infra/main.parameters.json | Out-Null
    Write-SuccessLine "Bicep 模板验证通过"
} catch {
    Write-ErrorLine "Bicep 模板验证失败: $_"
    exit 1
}

# 部署 Bicep 模板
Write-InfoLine "部署 Bicep 模板到 Azure..."
Write-WarningLine "这可能需要 5-10 分钟，请耐心等待..."

try {
    az deployment group create `
        --resource-group $ResourceGroup `
        --template-file infra/main.bicep `
        --parameters @infra/main.parameters.json `
        --output table | Out-Host
    
    Write-SuccessLine "部署完成！"
} catch {
    Write-ErrorLine "部署失败: $_"
    exit 1
}

# 获取部署输出
Write-InfoLine "获取部署信息..."

$DeploymentInfo = az deployment group show `
    --resource-group $ResourceGroup `
    --name main `
    --query "properties.outputs" | ConvertFrom-Json

$ApiUrl = $DeploymentInfo.apiUrl.value
$ContainerAppName = $DeploymentInfo.containerAppName.value
$IdentityPrincipalId = $DeploymentInfo.identityPrincipalId.value
$IdentityClientId = $DeploymentInfo.identityClientId.value

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✨ 部署信息" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "API URL: $ApiUrl"
Write-Host "Container App: $ContainerAppName"
Write-Host "Managed Identity Principal ID: $IdentityPrincipalId"
Write-Host "Managed Identity Client ID: $IdentityClientId"
Write-Host ""

# 提示下一步
Write-InfoLine "下一步操作:"
Write-Host "  1. 为 Managed Identity 授予访问权限"
Write-Host "     .\scripts\authorize-managed-identity.ps1"
Write-Host ""
Write-Host "  2. 查看容器日志 (部署 10 分钟后)"
Write-Host "     az containerapp logs show --name $ContainerAppName --resource-group $ResourceGroup --follow"
Write-Host ""
Write-Host "  3. 测试 API 健康检查"
Write-Host "     curl $ApiUrl/health"
Write-Host ""

Write-SuccessLine "部署脚本执行完成！"
