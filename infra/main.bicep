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

@description('现有 CosmosDB 账户名称（复用模式）')
param cosmosDbAccountName string = 'vedaaide'

@description('现有 Azure OpenAI 账户名称（复用模式）')
param openAiAccountName string = 'dev-dj-open-ai'

@description('VedaAide API Key（留空则禁用认证，仅限开发）')
@secure()
param apiKey string = ''

@description('VedaAide Admin API Key')
@secure()
param adminApiKey string = ''

@description('Azure OpenAI API Key（用于生产环境的API密钥认证，如不提供则使用Managed Identity）')
@secure()
param azureOpenAiApiKey string = ''

@description('允许跨域的来源，逗号分隔或 *')
param allowedOrigins string = '*'

// ── Reference existing Azure services ────────────────────────────────────────
// All resources are in the same resource group (dev-dj-sbi-customer_group),
// so no explicit scope needed.
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosDbAccountName
}

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: openAiAccountName
}

resource docIntelligence 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: 'vedadoc'
}

// ── Managed Identity ──────────────────────────────────────────────────────────
var prefix = 'vedaaide-${environment}'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-07-31-preview' = {
  name: '${prefix}-identity'
  location: location
}

// ── Role Assignments ─────────────────────────────────────────────────────────
// Cognitive Services OpenAI User → Azure OpenAI
resource openAiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openAiAccount
  name: guid(openAiAccount.id, identity.id, '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Cognitive Services User → Document Intelligence
resource docIntelligenceRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: docIntelligence
  name: guid(docIntelligence.id, identity.id, 'a97b65f3-24c7-4388-baec-2e87135dc908')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Cosmos DB Built-in Data Contributor
resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosDbAccount
  name: guid(cosmosDbAccount.id, identity.id, '00000000-0000-0000-0000-000000000002')
  properties: {
    roleDefinitionId: '${cosmosDbAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: identity.properties.principalId
    scope: cosmosDbAccount.id
  }
}

// ── Modules ──────────────────────────────────────────────────────────────────
module infra 'modules/container-apps.bicep' = {
  name: 'vedaaide-infra'
  params: {
    location: location
    environment: environment
    containerImage: containerImage
    identityId: identity.id
    identityClientId: identity.properties.clientId
    azureOpenAiEndpoint: openAiAccount.properties.endpoint
    cosmosDbEndpoint: cosmosDbAccount.properties.documentEndpoint
    docIntelligenceEndpoint: docIntelligence.properties.endpoint
    apiKey: apiKey
    adminApiKey: adminApiKey
    azureOpenAiApiKey: azureOpenAiApiKey
    allowedOrigins: allowedOrigins
  }
}}

output apiUrl string = infra.outputs.apiUrl
output containerAppName string = infra.outputs.containerAppName
output identityPrincipalId string = identity.properties.principalId
output identityClientId string = identity.properties.clientId
output docIntelligenceEndpoint string = infra.outputs.docIntelligenceEndpoint
