// VedaAide - Azure Container Apps + 关联服务
// 包含：Log Analytics、Container Apps Environment、Container App（含 Managed Identity）

@description('部署区域')
param location string

@description('环境标识')
param environment string

@description('容器镜像地址')
param containerImage string

@description('User-Assigned Managed Identity 资源 ID')
param identityId string

@description('User-Assigned Managed Identity Client ID')
param identityClientId string

@description('Azure OpenAI 端点')
param azureOpenAiEndpoint string

@description('CosmosDB 端点')
param cosmosDbEndpoint string

@description('Document Intelligence 端点（现有资源）')
param docIntelligenceEndpoint string

@secure()
param apiKey string

@secure()
param adminApiKey string

@secure()
@description('Azure OpenAI API Key')
param azureOpenAiApiKey string = ''

param allowedOrigins string

var prefix = 'vedaaide-${environment}'

// ── Log Analytics Workspace ──────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Container Apps Environment ────────────────────────────────────────────────
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Container App ─────────────────────────────────────────────────────────────
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: !empty(apiKey) || !empty(adminApiKey) || !empty(azureOpenAiApiKey) ? [
        ...(!empty(apiKey)           ? [{ name: 'api-key',              value: apiKey           }] : [])
        ...(!empty(adminApiKey)      ? [{ name: 'admin-api-key',        value: adminApiKey      }] : [])
        ...(!empty(azureOpenAiApiKey) ? [{ name: 'azure-openai-api-key', value: azureOpenAiApiKey }] : [])
      ] : []
    }
    template: {
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
      containers: [
        {
          name: 'vedaaide-api'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            // ── Deployment mode flag (enables Managed Identity auth) ───────────
            { name: 'DEPLOYMENT_MODE', value: 'true' }
            { name: 'NODE_ENV', value: 'production' }

            // ── Storage backend ───────────────────────────────────────────────
            { name: 'DATABASE_URL', value: 'file:./data/prod.db' }
            { name: 'AZURE_COSMOS_ENDPOINT', value: cosmosDbEndpoint }

            // ── AI provider ───────────────────────────────────────────────────
            { name: 'AZURE_OPENAI_ENDPOINT',              value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT_NAME',       value: 'gpt-4o' }
            { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT',  value: 'text-embedding-3-small' }
            { name: 'AZURE_OPENAI_API_VERSION',           value: '2024-08-01-preview' }
            ...(!empty(azureOpenAiApiKey) ? [{ name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }] : [])

            // ── Security ──────────────────────────────────────────────────────
            ...(!empty(apiKey)      ? [{ name: 'Veda__Security__ApiKey',      secretRef: 'api-key'       }] : [])
            ...(!empty(adminApiKey) ? [{ name: 'Veda__Security__AdminApiKey', secretRef: 'admin-api-key' }] : [])
            { name: 'Veda__Security__AllowedOrigins', value: allowedOrigins }

            // ── Document Intelligence ─────────────────────────────────────────
            { name: 'Veda__DocumentIntelligence__Endpoint', value: docIntelligenceEndpoint }
            { name: 'Veda__Vision__Enabled', value: 'true' }

            // ── Managed Identity client ID ────────────────────────────────────
            { name: 'AZURE_CLIENT_ID', value: identityClientId }
          ]
        }
      ]
    }
  }
}

output apiUrl string = 'https://${app.properties.configuration.ingress!.fqdn}'
output containerAppName string = app.name
output docIntelligenceEndpoint string = docIntelligenceEndpoint
