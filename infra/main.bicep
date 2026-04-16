// VedaAide Azure Container Apps 基础设施
// 部署方式：az deployment group create --resource-group dev-dj-sbi-customer_group --template-file main.bicep --parameters @main.parameters.json

targetScope = 'resourceGroup'

@description('部署区域')
param location string = 'australiaeast'

@description('应用环境标识（dev / staging / prod）')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Container Apps 镜像地址（如 ghcr.io/org/vedaaide-api:latest）')
param containerImage string

@description('现有 CosmosDB 资源所在的资源组（复用模式）')
param cosmosDbResourceGroup string = 'dev-dj-sbi-customer_group'

@description('现有 CosmosDB 账户名称（复用模式）')
param cosmosDbAccountName string = 'vedaaide'

@description('现有 Azure OpenAI 资源所在的资源组（复用模式）')
param openAiResourceGroup string = 'dev-dj-sbi-customer_group'

@description('现有 Azure OpenAI 账户名称（复用模式）')
param openAiAccountName string = 'dev-dj-open-ai'

@description('VedaAide API Key（留空则禁用认证，仅限开发）')
@secure()
param apiKey string = ''

@description('VedaAide Admin API Key')
@secure()
param adminApiKey string = ''

@description('允许跨域的来源，逗号分隔或 *')
param allowedOrigins string = '*'

// ── Reference existing Azure services ────────────────────────────────────────
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosDbAccountName
  scope: resourceGroup(subscription().subscriptionId, cosmosDbResourceGroup)
}

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: openAiAccountName
  scope: resourceGroup(subscription().subscriptionId, openAiResourceGroup)
}

resource docIntelligence 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: 'vedadoc'
  scope: resourceGroup(subscription().subscriptionId, 'dev-dj-sbi-customer_group')
}

// ── Modules ──────────────────────────────────────────────────────────────────
module infra 'modules/container-apps.bicep' = {
  name: 'vedaaide-infra'
  params: {
    location: location
    environment: environment
    containerImage: containerImage
    azureOpenAiEndpoint: openAiAccount.properties.endpoint
    cosmosDbEndpoint: cosmosDbAccount.properties.documentEndpoint
    docIntelligenceEndpoint: docIntelligence.properties.endpoint
    apiKey: apiKey
    adminApiKey: adminApiKey
    allowedOrigins: allowedOrigins
  }
}

// NOTE: Role assignment for Managed Identity → Document Intelligence is created separately
// after deployment due to cross-resource-group constraints.
// See: deploy-infrastructure.yml for the post-deployment role assignment step

output apiUrl string = infra.outputs.apiUrl
output containerAppName string = infra.outputs.containerAppName
output docIntelligenceEndpoint string = infra.outputs.docIntelligenceEndpoint
