# VedaAide Deployment Checklist & Configuration Guide

**Document Version**: v1.0  
**Last Updated**: 2026-04-09  
**Applicable Projects**: VedaAide.NET + VedaAide.js  
**Deployment Target**: Azure Container Apps (triggered by main branch)

---

## 📋 Table of Contents

1. [Quick Answers](#quick-answers)
2. [Prerequisites](#prerequisites)
3. [GitHub Actions Configuration](#github-actions-configuration)
4. [Azure Resources Configuration](#azure-resources-configuration)
5. [Deployment Process](#deployment-process)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Quick Answers

### Q: Can I deploy if I merge the PR to main right now?

**Short Answer**: You need to complete GitHub Actions secrets and Azure resource configuration first, otherwise deployment will fail.

**Details**:

- ✅ **CI/CD workflows already configured** (`.github/workflows/deploy.yml` / `ci-cd.yml`)
- ✅ **Docker image build configured**
- ✅ **Code passes compilation and tests** (confirm on main branch)
- ❌ **GitHub Actions Secrets NOT configured** → Must be configured immediately
- ❌ **Azure resources NOT created** → Need to deploy Bicep template
- ⚠️ **Some environment variables NOT set** → App may not work fully after deployment

### Q: Will the app work after deployment?

**Short Answer**: It will start, but some features need Azure service integration to fully work.

**Feature Status**:

- ✅ Basic API service can start
- ✅ Database initialization (SQLite local storage)
- ⚠️ Document processing requires **Azure Document Intelligence** configuration
- ⚠️ OpenAI integration requires **Azure OpenAI** or local **Ollama** configuration
- ⚠️ Logging requires **Application Insights** configuration

### Q: How many GitHub Actions Secrets do I need to configure?

**Answer**: Total **4-5** Secrets (backend) + **2-3** (frontend)

See [GitHub Actions Configuration](#github-actions-configuration) section below.

### Q: What do I need to set up on Azure?

**Answer**:

1. Create an Azure Resource Group
2. Deploy Bicep infrastructure template (automatically creates Container Apps, Managed Identity, Document Intelligence, etc.)
3. Configure Azure Container Apps environment variables
4. Configure Key Vault secrets (for production)

See [Azure Resources Configuration](#azure-resources-configuration) section below.

---

## 🔐 Prerequisites

### Required

- [ ] Valid Azure Subscription
- [ ] Azure CLI installed
- [ ] GitHub account with repository settings access
- [ ] Docker account or GitHub Container Registry (GHCR) access

### Optional

- [ ] Local Ollama deployment (for local development and testing)
- [ ] Azure OpenAI account (for cloud LLM services)
- [ ] Azure Cosmos DB (for large-scale production deployments)

---

## 🔧 GitHub Actions Configuration

### Step 1: Create Personal Access Token (PAT)

**Purpose**: Access GHCR Docker image registry

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Configure permissions:
   - ✅ `write:packages` - Push Docker images
   - ✅ `read:packages` - Pull Docker images
   - ✅ `delete:packages` - Delete images (optional)
4. Set expiration time (recommended 90 days)
5. **Copy the Token** (displayed only once)

### Step 2: Configure Secrets - VedaAide.NET Backend

**Location**: VedaAide.NET Repository → Settings → Secrets and variables → Actions

| Secret Name             | Example Value                          | Description                            |
| ----------------------- | -------------------------------------- | -------------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | `12345678-1234-1234-1234-123456789012` | Azure Subscription ID                  |
| `AZURE_TENANT_ID`       | `87654321-4321-4321-4321-210987654321` | Azure Tenant ID                        |
| `AZURE_CLIENT_ID`       | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` | Service Principal App ID               |
| `GHCR_PAT`              | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | GitHub Container Registry Access Token |

**Other Variables (non-sensitive, Settings → Variables)**:

| Variable Name          | Example Value       | Description                     |
| ---------------------- | ------------------- | ------------------------------- |
| `CONTAINER_APP_NAME`   | `vedaaide-prod-api` | Container Apps application name |
| `AZURE_RESOURCE_GROUP` | `vedaaide-prod-rg`  | Resource group name             |

### Step 3: Configure Secrets - VedaAide.js Frontend

**Location**: VedaAide.js Repository → Settings → Secrets and variables → Actions

| Secret Name         | Example Value           | Description                              |
| ------------------- | ----------------------- | ---------------------------------------- |
| `AZURE_CREDENTIALS` | JSON (see below)        | Azure login credentials                  |
| `CODECOV_TOKEN`     | `xxxxxxxxxxxxxxxxxxxxx` | Codecov coverage upload token (optional) |

**AZURE_CREDENTIALS Format** (JSON):

```json
{
  "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "12345678-1234-1234-1234-123456789012",
  "tenantId": "87654321-4321-4321-4321-210987654321"
}
```

### Step 4: Create Service Principal

**Purpose**: Enable GitHub Actions to authenticate with Azure for deployment

```bash
# Create Service Principal
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>

# Output example:
# {
#   "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
#   "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "subscriptionId": "12345678-1234-1234-1234-123456789012",
#   "tenantId": "87654321-4321-4321-4321-210987654321"
# }
```

---

## ☁️ Azure Resources Configuration

### Step 1: Create Resource Group

```bash
# Create resource group
az group create \
  --name vedaaide-prod-rg \
  --location australiaeast

# Verify
az group show --name vedaaide-prod-rg
```

### Step 2: Configure Deployment Parameters File

**File**: `infra/main.parameters.json`

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "containerImage": {
      "value": "ghcr.io/YOUR_ORG/vedaaide-api:sha-<latest-commit-sha>"
    },
    "environment": {
      "value": "prod"
    },
    "azureOpenAiEndpoint": {
      "value": "https://YOUR_ACCOUNT.openai.azure.com/"
    },
    "azureOpenAiApiKey": {
      "value": "your-azure-openai-key"
    },
    "cosmosDbEndpoint": {
      "value": "https://YOUR_COSMOS.documents.azure.com:443/"
    },
    "apiKey": {
      "value": ""
    },
    "adminApiKey": {
      "value": ""
    },
    "allowedOrigins": {
      "value": "https://vedaaide.azurecontainerapps.io,https://your-frontend-domain.com"
    }
  }
}
```

### Step 3: Deploy Bicep Infrastructure

```bash
# Set variables
LOCATION=australiaeast
RESOURCE_GROUP=vedaaide-prod-rg

# Export for later use
export AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Validate template
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# Execute deployment
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --output table

# Get output values
az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs
```

**Deployment Output Example**:

```json
{
  "apiUrl": {
    "value": "https://vedaaide-prod-api.azurecontainerapps.io"
  },
  "containerAppName": {
    "value": "vedaaide-prod-api"
  },
  "docIntelligenceEndpoint": {
    "value": "https://vedaaide-prod-docintel.cognitiveservices.azure.com/"
  }
}
```

### Step 4: Configure Container Apps Environment Variables

```bash
# Get deployment outputs
API_URL=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.apiUrl.value -o tsv)

CONTAINER_APP_NAME=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.containerAppName.value -o tsv)

# Update environment variables
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "ASPNETCORE_ENVIRONMENT=Production" \
    "Veda__OllamaEndpoint=http://ollama:11434" \
    "Veda__EmbeddingModel=bge-m3" \
  --output table
```

### Step 5: Grant Azure Service Access to Managed Identity

```bash
# VedaAide.NET uses Managed Identity for automatic authentication
# No need to store keys - just grant permissions

IDENTITY_PRINCIPAL_ID=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.identityPrincipalId.value -o tsv)

# Grant Cosmos DB access
az role assignment create \
  --role "DocumentDB Account Contributor" \
  --assignee-object-id $IDENTITY_PRINCIPAL_ID \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourcegroups/<RG>/providers/Microsoft.DocumentDB/databaseAccounts/<COSMOS_NAME>

# Grant Azure OpenAI access
az role assignment create \
  --role "Cognitive Services User" \
  --assignee-object-id $IDENTITY_PRINCIPAL_ID \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourcegroups/<RG>/providers/Microsoft.CognitiveServices/accounts/<OPENAI_NAME>

# Note: Key Vault not needed - Managed Identity handles all authentication
```

---

## 🚀 Deployment Process

### Option A: Automatic Deployment via GitHub Actions

1. **After preparation is complete**, merge the feature branch to `main`:

```bash
git checkout main
git pull origin main
git merge feature/4-testing-devops
git push origin main
```

2. **GitHub Actions automatically triggers**:
   - ✅ Runs unit tests and integration tests
   - ✅ Runs E2E tests (Playwright)
   - ✅ Builds Docker image
   - ✅ Pushes image to GHCR
   - ✅ Deploys to Azure Container Apps

3. **Monitor deployment**:
   - GitHub → Actions → workflow run history
   - View step outputs and logs

### Option B: Manual Deployment (for testing and troubleshooting)

```bash
# Build image locally
docker build \
  -f src/Veda.Api/Dockerfile \
  -t ghcr.io/your-org/vedaaide-api:manual-test \
  .

# Login to GHCR
echo $GHCR_PAT | docker login ghcr.io -u <USERNAME> --password-stdin

# Push image
docker push ghcr.io/your-org/vedaaide-api:manual-test

# Update Container App
az containerapp update \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --image ghcr.io/your-org/vedaaide-api:manual-test
```

---

## 📦 Post-Deployment Verification

### Health Checks

```bash
# Check Container App status
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.provisioningState" -o tsv

# Check revision status
az containerapp revision list \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --output table

# Manual health check
curl https://vedaaide-prod-api.azurecontainerapps.io/health
```

### View Logs

```bash
# Query Log Analytics
az monitor log-analytics query \
  --workspace vedaaide-prod-logs \
  --analytics-query 'ContainerAppConsoleLogs_CL | tail 20'

# Real-time log stream
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow
```

---

## 🆘 Troubleshooting

### Common Issues

#### 1. GitHub Actions deployment fails: "Invalid credentials"

**Root Cause**: Service Principal insufficient permissions or Secrets misconfigured

**Solution**:

```bash
# Verify Service Principal permissions
az role assignment list \
  --assignee <CLIENT_ID> \
  --output table

# Recreate Service Principal if needed
az ad sp delete --id <CLIENT_ID>
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

#### 2. Container fails to start: "Application Health is Unhealthy"

**Root Cause**: Missing environment variables or health check endpoint failing

**Solution**:

```bash
# Test health check endpoint
curl http://localhost:8080/health
# or
curl http://localhost:3000/api/health

# View container logs
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow --tail 50

# Check environment variables
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.template.containers[0].env" -o table
```

#### 3. GHCR authentication fails: "unauthorized"

**Root Cause**: PAT expired or insufficient permissions

**Solution**:

```bash
# Create new PAT (see Step 1 above)
# Update GitHub Secret
gh secret set GHCR_PAT --body <NEW_PAT>
```

#### 4. Bicep deployment fails: "Parameter validation failed"

**Root Cause**: Parameter file format error or invalid values

**Solution**:

```bash
# Validate template and parameters
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --debug

# View detailed errors
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --debug 2>&1 | head -100
```

#### 5. Azure OpenAI integration not working

**Symptom**: API returns LLM call errors

**Solution**:

```bash
# Verify Azure OpenAI endpoint and API Key
# Test connectivity
curl -X GET "https://<YOUR_ACCOUNT>.openai.azure.com/openai/models?api-version=2024-08-01-preview" \
  -H "api-key: <YOUR_KEY>"

# Update environment variables
az containerapp update \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --set-env-vars \
    "Veda__AzureOpenAI__Endpoint=https://<YOUR_ACCOUNT>.openai.azure.com/" \
    "Veda__AzureOpenAI__ApiKey=<YOUR_KEY>"
```

---

## 📚 Reference Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Bicep Language Reference](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/file)
- [Azure CLI Reference](https://learn.microsoft.com/en-us/cli/azure)

---

## 📋 Pre-Merge Checklist

Final confirmation before merging PR:

- [ ] Code passes all tests (`npm run test`, `dotnet test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Lint checks pass (`npm run lint`)
- [ ] Docker image builds locally
- [ ] Azure Resource Group created
- [ ] Service Principal created
- [ ] GitHub Actions Secrets configured:
  - [ ] `AZURE_SUBSCRIPTION_ID`
  - [ ] `AZURE_TENANT_ID`
  - [ ] `AZURE_CLIENT_ID`
  - [ ] `GHCR_PAT` (for VedaAide.NET)
  - [ ] `AZURE_CREDENTIALS` (for VedaAide.js)
- [ ] Deployment parameters file updated (`infra/main.parameters.json`)
- [ ] Bicep template validated (`az deployment group validate`)
- [ ] Environment variables confirmed (health check endpoints, log levels, etc.)
- [ ] Key Vault created (recommended for production)
- [ ] Monitoring and alerting configured (recommended)

---

**Questions or feedback?** Submit a GitHub Issue or PR.
