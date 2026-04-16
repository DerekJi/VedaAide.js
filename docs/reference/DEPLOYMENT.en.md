# Cloud Deployment Guide

This guide covers deploying VedaAide.js to Azure using Docker containers.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Azure Container Apps / App Service         │
│  ┌──────────────────┐                       │
│  │  VedaAide.js     │                       │
│  │  (Next.js app)   │                       │
│  └────────┬─────────┘                       │
│           │                                 │
│    ┌──────┴──────┐  ┌──────────────────┐   │
│    │ SQLite vol  │  │ Azure OpenAI     │   │
│    │ (local dev) │  │ (production LLM) │   │
│    └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────┘
```

**Local / Dev:** SQLite + Ollama  
**Production:** SQLite persistent volume + Azure OpenAI (or Ollama sidecar)

---

## Prerequisites

- Azure CLI (`az`) installed and authenticated: `az login`
- Docker installed and running
- Azure Container Registry (ACR) or Docker Hub account
- Azure subscription with permissions to create resources

---

## 1. Build the Docker Image

```bash
# Build production image
docker build -t vedaaide-js:latest .

# Verify it starts up correctly
docker run -p 3000:3000 \
  -e DATABASE_URL=file:/data/dev.db \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OLLAMA_EMBEDDING_MODEL=bge-m3 \
  -e OLLAMA_CHAT_MODEL=qwen:7b-chat \
  -e NODE_ENV=production \
  vedaaide-js:latest

curl http://localhost:3000/api/health
```

---

## 2. Push to Azure Container Registry

```bash
# Create ACR (one-time)
az acr create --resource-group <rg> --name <acrName> --sku Basic

# Login to ACR
az acr login --name <acrName>

# Tag and push
docker tag vedaaide-js:latest <acrName>.azurecr.io/vedaaide-js:latest
docker push <acrName>.azurecr.io/vedaaide-js:latest
```

---

## 3. Deploy to Azure Container Apps

```bash
# Create Container Apps environment (one-time)
az containerapp env create \
  --name vedaaide-env \
  --resource-group <rg> \
  --location australiaeast

# Deploy the app
az containerapp create \
  --name vedaaide-js \
  --resource-group <rg> \
  --environment vedaaide-env \
  --image <acrName>.azurecr.io/vedaaide-js:latest \
  --registry-server <acrName>.azurecr.io \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars \
    NODE_ENV=production \
    DATABASE_URL=file:/data/dev.db \
    DEPLOYMENT_MODE=true \
    AZURE_OPENAI_ENDPOINT=secretref:azure-openai-endpoint \
    AZURE_OPENAI_API_KEY=secretref:azure-openai-apikey \
    AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o \
    LOG_LEVEL=info
```

---

## 4. Required Environment Variables

Set these as secrets or environment variables in your cloud platform:

### Minimum (with Ollama sidecar)

| Variable                 | Example                  | Required                 |
| ------------------------ | ------------------------ | ------------------------ |
| `NODE_ENV`               | `production`             | Yes                      |
| `DATABASE_URL`           | `file:/data/dev.db`      | Yes                      |
| `OLLAMA_BASE_URL`        | `http://localhost:11434` | Yes (if no Azure OpenAI) |
| `OLLAMA_EMBEDDING_MODEL` | `bge-m3`                 | Yes                      |
| `OLLAMA_CHAT_MODEL`      | `qwen:7b-chat`           | Yes                      |

### Production (Azure OpenAI)

| Variable                       | Example                          | Required                            |
| ------------------------------ | -------------------------------- | ----------------------------------- |
| `AZURE_OPENAI_ENDPOINT`        | `https://name.openai.azure.com/` | Yes                                 |
| `AZURE_OPENAI_API_KEY`         | `<key>`                          | Yes (or use Managed Identity)       |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4o`                         | Yes                                 |
| `AZURE_OPENAI_API_VERSION`     | `2024-08-01-preview`             | No (has default)                    |
| `DEPLOYMENT_MODE`              | `true`                           | Yes (enables Managed Identity auth) |

### Optional — Azure Cosmos DB (replaces SQLite)

| Variable                 | Example                                    |
| ------------------------ | ------------------------------------------ |
| `AZURE_COSMOS_ENDPOINT`  | `https://account.documents.azure.com:443/` |
| `AZURE_COSMOS_KEY`       | `<key>` or use Managed Identity            |
| `AZURE_COSMOS_DATABASE`  | `vedaaide`                                 |
| `AZURE_COSMOS_CONTAINER` | `vectors`                                  |

### Optional — Azure Blob Storage (document sync)

| Variable                    | Example                         |
| --------------------------- | ------------------------------- |
| `AZURE_BLOB_ACCOUNT_NAME`   | `mystorageaccount`              |
| `AZURE_BLOB_ACCOUNT_KEY`    | `<key>` or use Managed Identity |
| `AZURE_BLOB_CONTAINER_NAME` | `documents`                     |

> **Note:** Azure Blob Storage connector is not yet implemented. See [skipped-tasks.en.md](../skipped-tasks.en.md).

---

## 5. Database Persistence

The app uses SQLite by default. For persistence in the cloud, mount a persistent volume:

**Azure Container Apps with Azure Files:**

```bash
az containerapp env storage set \
  --name vedaaide-env \
  --resource-group <rg> \
  --storage-name vedaaide-db \
  --azure-file-account-name <storageAccount> \
  --azure-file-account-key <key> \
  --azure-file-share-name vedaaide-db \
  --access-mode ReadWrite

# Mount in the container at /data
az containerapp update \
  --name vedaaide-js \
  --resource-group <rg> \
  --storage-mounts "volumeName=vedaaide-db,mountPath=/data,storageName=vedaaide-db"
```

Set `DATABASE_URL=file:/data/dev.db` to write to the mounted volume.

---

## 6. Managed Identity (recommended for production)

With Managed Identity, you don't need to store Azure service keys:

```bash
# Enable system-assigned identity
az containerapp identity assign \
  --name vedaaide-js \
  --resource-group <rg> \
  --system-assigned

# Grant access to Azure OpenAI
az role assignment create \
  --assignee <principalId> \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<subId>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<aoaiName>

# Set DEPLOYMENT_MODE=true so the app uses DefaultAzureCredential
```

---

## 7. CI/CD — Automated Deployment

The existing CI workflow (`.github/workflows/ci.yml`) includes a Docker build test on every PR. To add automated deployment to Azure on push to main, add a new job:

```yaml
deploy:
  needs: ci
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    - name: Build and push to ACR
      run: |
        az acr build --registry <acrName> --image vedaaide-js:${{ github.sha }} .
    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name vedaaide-js \
          --resource-group <rg> \
          --image <acrName>.azurecr.io/vedaaide-js:${{ github.sha }}
```

Required GitHub secrets: `AZURE_CREDENTIALS` (service principal JSON).

---

## 8. Health Check & Monitoring

The app exposes a health endpoint:

```bash
curl https://<app>.<env>.azurecontainerapps.io/api/health
# {"status":"ok","timestamp":"..."}
```

Configure alerts in Azure Monitor on HTTP 5xx errors and response time.

---

## 9. Smoke Tests After Deployment

```bash
BASE=https://<app>.<env>.azurecontainerapps.io

# Health
curl $BASE/api/health

# Ingest a document
curl -X POST $BASE/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"deploy-test.md","content":"Deployment test content."}'

# Query
curl -X POST $BASE/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the deployment test content?"}'
```

---

## See Also

- [Getting Started (local)](../guides/GETTING_STARTED.en.md)
- [Testing Guide](../testing/TESTING.en.md)
- [Skipped Tasks Report](../skipped-tasks.en.md)
