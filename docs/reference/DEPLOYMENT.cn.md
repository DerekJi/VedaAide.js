# 云部署指南

本指南涵盖如何使用 Docker 容器将 VedaAide.js 部署到 Azure。

---

## 架构概览

```
┌─────────────────────────────────────────────┐
│  Azure Container Apps / App Service         │
│  ┌──────────────────┐                       │
│  │  VedaAide.js     │                       │
│  │  (Next.js 应用)  │                       │
│  └────────┬─────────┘                       │
│           │                                 │
│    ┌──────┴──────┐  ┌──────────────────┐   │
│    │ SQLite 卷   │  │ Azure OpenAI     │   │
│    │ (本地开发)  │  │ (生产 LLM)       │   │
│    └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────┘
```

**本地 / 开发：** SQLite + Ollama  
**生产：** SQLite 持久化卷 + Azure OpenAI（或 Ollama 边柜）

---

## 前置要求

- Azure CLI (`az`) 已安装并已认证：`az login`
- Docker 已安装并运行
- Azure 容器注册表 (ACR) 或 Docker Hub 账户
- 拥有创建资源权限的 Azure 订阅

---

## 1. 构建 Docker 镜像

```bash
# 构建生产镜像
docker build -t vedaaide-js:latest .

# 验证其正确启动
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

## 2. 推送到 Azure 容器注册表

```bash
# 创建 ACR（一次性）
az acr create --resource-group <rg> --name <acrName> --sku Basic

# 登录到 ACR
az acr login --name <acrName>

# 标记并推送
docker tag vedaaide-js:latest <acrName>.azurecr.io/vedaaide-js:latest
docker push <acrName>.azurecr.io/vedaaide-js:latest
```

---

## 3. 部署到 Azure Container Apps

```bash
# 创建 Container Apps 环境（一次性）
az containerapp env create \
  --name vedaaide-env \
  --resource-group <rg> \
  --location australiaeast

# 部署应用
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

## 4. 必需的环境变量

在云平台上设置这些为密钥或环境变量：

### 最小化（使用 Ollama 边柜）

| 变量                     | 示例                     | 必需                    |
| ------------------------ | ------------------------ | ----------------------- |
| `NODE_ENV`               | `production`             | 是                      |
| `DATABASE_URL`           | `file:/data/dev.db`      | 是                      |
| `OLLAMA_BASE_URL`        | `http://localhost:11434` | 是（如无 Azure OpenAI） |
| `OLLAMA_EMBEDDING_MODEL` | `bge-m3`                 | 是                      |
| `OLLAMA_CHAT_MODEL`      | `qwen:7b-chat`           | 是                      |

### 生产（Azure OpenAI）

| 变量                           | 示例                             | 必需                   |
| ------------------------------ | -------------------------------- | ---------------------- |
| `AZURE_OPENAI_ENDPOINT`        | `https://name.openai.azure.com/` | 是                     |
| `AZURE_OPENAI_API_KEY`         | `<密钥>`                         | 是（或使用托管标识）   |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4o`                         | 是                     |
| `AZURE_OPENAI_API_VERSION`     | `2024-08-01-preview`             | 否（有默认值）         |
| `DEPLOYMENT_MODE`              | `true`                           | 是（启用托管标识认证） |

### 可选 — Azure Cosmos DB（替代 SQLite）

| 变量                     | 示例                                       |
| ------------------------ | ------------------------------------------ |
| `AZURE_COSMOS_ENDPOINT`  | `https://account.documents.azure.com:443/` |
| `AZURE_COSMOS_KEY`       | `<密钥>` 或使用托管标识                    |
| `AZURE_COSMOS_DATABASE`  | `vedaaide`                                 |
| `AZURE_COSMOS_CONTAINER` | `vectors`                                  |

### 可选 — Azure Blob Storage（文档同步）

| 变量                        | 示例                    |
| --------------------------- | ----------------------- |
| `AZURE_BLOB_ACCOUNT_NAME`   | `mystorageaccount`      |
| `AZURE_BLOB_ACCOUNT_KEY`    | `<密钥>` 或使用托管标识 |
| `AZURE_BLOB_CONTAINER_NAME` | `documents`             |

> **注意:** Azure Blob Storage 连接器尚未实现。见 [skipped-tasks.cn.md](../skipped-tasks.cn.md)。

---

## 5. 数据库持久化

应用默认使用 SQLite。为在云中持久化，挂载一个持久化卷：

**Azure Container Apps with Azure Files：**

```bash
az containerapp env storage set \
  --name vedaaide-env \
  --resource-group <rg> \
  --storage-name vedaaide-db \
  --azure-file-account-name <storageAccount> \
  --azure-file-account-key <key> \
  --azure-file-share-name vedaaide-db \
  --access-mode ReadWrite

# 在容器内挂载到 /data
az containerapp update \
  --name vedaaide-js \
  --resource-group <rg> \
  --storage-mounts "volumeName=vedaaide-db,mountPath=/data,storageName=vedaaide-db"
```

设置 `DATABASE_URL=file:/data/dev.db` 以写入挂载卷。

---

## 6. 托管标识（推荐用于生产）

使用托管标识，您无需存储 Azure 服务密钥：

```bash
# 启用系统分配的标识
az containerapp identity assign \
  --name vedaaide-js \
  --resource-group <rg> \
  --system-assigned

# 授予 Azure OpenAI 访问权限
az role assignment create \
  --assignee <principalId> \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<subId>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<aoaiName>

# 设置 DEPLOYMENT_MODE=true 以使应用使用 DefaultAzureCredential
```

---

## 7. CI/CD — 自动化部署

现有 CI 工作流（`.github/workflows/ci.yml`）在每个 PR 上包含 Docker 构建测试。要在推送到 main 时添加对 Azure 的自动化部署，请添加新的作业：

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
    - name: 构建并推送到 ACR
      run: |
        az acr build --registry <acrName> --image vedaaide-js:${{ github.sha }} .
    - name: 部署到 Container Apps
      run: |
        az containerapp update \
          --name vedaaide-js \
          --resource-group <rg> \
          --image <acrName>.azurecr.io/vedaaide-js:${{ github.sha }}
```

必需的 GitHub 密钥：`AZURE_CREDENTIALS`（服务主体 JSON）。

---

## 8. 健康检查和监控

应用暴露健康端点：

```bash
curl https://<app>.<env>.azurecontainerapps.io/api/health
# {"status":"ok","timestamp":"..."}
```

在 Azure Monitor 中配置对 HTTP 5xx 错误和响应时间的告警。

---

## 9. 部署后烟雾测试

```bash
BASE=https://<app>.<env>.azurecontainerapps.io

# 健康检查
curl $BASE/api/health

# 吸收文档
curl -X POST $BASE/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"deploy-test.md","content":"部署测试内容。"}'

# 查询
curl -X POST $BASE/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"部署测试内容是什么?"}'
```

---

## 另见

- [快速开始（本地）](../guides/GETTING_STARTED.cn.md)
- [测试指南](../testing/TESTING.cn.md)
- [跳过任务报告](../skipped-tasks.cn.md)
