# VedaAide 部署检查清单 & 配置指南

**文档版本**: v1.0  
**最后更新**: 2026-04-09  
**适用项目**: VedaAide.NET + VedaAide.js  
**部署目标**: Azure Container Apps (main分支触发)

---

## 📋 目录

1. [快速答案](#快速答案)
2. [部署前置条件](#部署前置条件)
3. [GitHub Actions 配置](#github-actions-配置)
4. [Azure 资源配置](#azure-资源配置)
5. [部署流程](#部署流程)
6. [故障排查](#故障排查)

---

## ✅ 快速答案

### Q: 如果现在合并PR到main，能部署吗？

**简短答案**: 需要先完成 GitHub Actions secrets 和 Azure 资源配置，否则部署会失败。

**详细情况**:

- ✅ **CI/CD 工作流已配置** (`.github/workflows/deploy.yml` / `ci-cd.yml`)
- ✅ **Docker 镜像构建已配置**
- ✅ **代码通过编译和测试** (需在main分支确认)
- ❌ **GitHub Actions Secrets 未配置** → 需要立即配置
- ❌ **Azure 资源未创建** → 需要部署 Bicep 模板
- ⚠️ **部分环境变量未设置** → 部署后应用可能无法正常工作

### Q: 部署后能用吗？

**简短答案**: 能启动，但某些功能需要 Azure 服务集成才能完全工作。

**功能状态**:

- ✅ 基础 API 服务能启动
- ✅ 数据库初始化（SQLite 本地存储）
- ⚠️ 文档处理需要 **Azure Document Intelligence** 配置
- ⚠️ OpenAI 集成需要 **Azure OpenAI** 或本地 **Ollama** 配置
- ⚠️ 日志收集需要 **Application Insights** 配置

### Q: 需要配置多少个 GitHub Actions Secrets？

**答案**: 共需 **4-5 个** Secrets（后端）+ **2-3 个**（前端）

详见下文 [GitHub Actions 配置](#github-actions-配置)

### Q: 需要在 Azure 上做什么？

**答案**:

1. 创建 Azure 资源组 (Resource Group)
2. 部署 Bicep 基础设施模板（自动创建 Container Apps、Managed Identity、Document Intelligence 等）
3. 配置 Azure Container Apps 环境变量
4. 配置 Key Vault 密钥（用于生产环境）

详见下文 [Azure 资源配置](#azure-资源配置)

---

## 🔐 部署前置条件

### 必需项

- [ ] 有效的 Azure 订阅 (Subscription)
- [ ] Azure CLI 已安装
- [ ] GitHub 账户有权访问仓库设置
- [ ] Docker 账户或 GitHub Container Registry (GHCR) 访问权限

### 可选项

- [ ] Ollama 本地部署（用于本地开发和测试）
- [ ] Azure OpenAI 账户（用于云端 LLM 服务）
- [ ] Azure Cosmos DB（用于大规模生产部署）

---

## 🔧 GitHub Actions 配置

### 步骤 1: 创建 Personal Access Token (PAT)

**用途**: GHCR Docker 镜像仓库访问

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token"
3. 配置权限:
   - ✅ `write:packages` - 推送 Docker 镜像
   - ✅ `read:packages` - 拉取 Docker 镜像
   - ✅ `delete:packages` - 删除镜像（可选）
4. 设置过期时间（建议 90 天）
5. **复制 Token**（仅显示一次）

### 步骤 2: 配置 Secrets - VedaAide.NET 后端

**位置**: VedaAide.NET 仓库 → Settings → Secrets and variables → Actions

| Secret 名称             | 示例值                                 | 说明                                 |
| ----------------------- | -------------------------------------- | ------------------------------------ |
| `AZURE_SUBSCRIPTION_ID` | `12345678-1234-1234-1234-123456789012` | Azure 订阅 ID                        |
| `AZURE_TENANT_ID`       | `87654321-4321-4321-4321-210987654321` | Azure Tenant ID                      |
| `AZURE_CLIENT_ID`       | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` | Service Principal 应用 ID            |
| `GHCR_PAT`              | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | GitHub Container Registry 访问 Token |

**其他 Variables（非敏感，Settings → Variables）**:

| Variable 名称          | 示例值              | 说明                    |
| ---------------------- | ------------------- | ----------------------- |
| `CONTAINER_APP_NAME`   | `vedaaide-prod-api` | Container Apps 应用名称 |
| `AZURE_RESOURCE_GROUP` | `vedaaide-prod-rg`  | 资源组名称              |

### 步骤 3: 配置 Secrets - VedaAide.js 前端

**位置**: VedaAide.js 仓库 → Settings → Secrets and variables → Actions

| Secret 名称         | 示例值                  | 说明                             |
| ------------------- | ----------------------- | -------------------------------- |
| `AZURE_CREDENTIALS` | JSON (见下文)           | Azure 登录凭证                   |
| `CODECOV_TOKEN`     | `xxxxxxxxxxxxxxxxxxxxx` | Codecov 覆盖率上传 Token（可选） |

**AZURE_CREDENTIALS 格式** (JSON):

```json
{
  "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "12345678-1234-1234-1234-123456789012",
  "tenantId": "87654321-4321-4321-4321-210987654321"
}
```

### 步骤 4: 创建 Service Principal

**用途**: GitHub Actions 登录 Azure 进行部署

```bash
# 创建 Service Principal
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>

# 输出示例:
# {
#   "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
#   "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "subscriptionId": "12345678-1234-1234-1234-123456789012",
#   "tenantId": "87654321-4321-4321-4321-210987654321"
# }
```

---

## ☁️ Azure 资源配置

### 步骤 1: 创建资源组

```bash
# 创建资源组
az group create \
  --name vedaaide-prod-rg \
  --location australiaeast

# 验证
az group show --name vedaaide-prod-rg
```

### 步骤 2: 配置部署参数文件

**文件**: `infra/main.parameters.json`

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
      "value": "https://your-existing-account.openai.azure.com/"
    },
    "cosmosDbEndpoint": {
      "value": "https://your-existing-cosmos.documents.azure.com:443/"
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

**重要**: 指向你现有的 Azure 资源（Cosmos DB、Azure OpenAI）, Managed Identity 会自动认证

### 步骤 3: 部署 Bicep 基础设施

```bash
# 部署前端 (VedaAide.js)
LOCATION=australiaeast
RESOURCE_GROUP=vedaaide-prod-rg

# 导出变量备用
export AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# 验证模板
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 执行部署
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --output table

# 获取输出值
az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs
```

**部署输出示例**:

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

### 步骤 4: 配置 Container Apps 环境变量

```bash
# 获取部署后的投出值
API_URL=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.apiUrl.value -o tsv)

CONTAINER_APP_NAME=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.containerAppName.value -o tsv)

# 更新环境变量
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "ASPNETCORE_ENVIRONMENT=Production" \
    "Veda__OllamaEndpoint=http://ollama:11434" \
    "Veda__EmbeddingModel=bge-m3" \
  --output table
```

### 步骤 5: 为 Managed Identity 授予 Azure 服务访问权限

```bash
# VedaAide.NET 使用 Managed Identity 自动认证，无需存储密钥
# 只需为 Managed Identity 授予访问权限

IDENTITY_PRINCIPAL_ID=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name main \
  --query properties.outputs.identityPrincipalId.value -o tsv)

# 授予 Cosmos DB 访问权限
az role assignment create \
  --role "DocumentDB Account Contributor" \
  --assignee-object-id $IDENTITY_PRINCIPAL_ID \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourcegroups/<RG>/providers/Microsoft.DocumentDB/databaseAccounts/<COSMOS_NAME>

# 授予 Azure OpenAI 访问权限
az role assignment create \
  --role "Cognitive Services User" \
  --assignee-object-id $IDENTITY_PRINCIPAL_ID \
  --scope /subscriptions/$AZURE_SUBSCRIPTION_ID/resourcegroups/<RG>/providers/Microsoft.CognitiveServices/accounts/<OPENAI_NAME>

# 注意: Key Vault 不需要 - 使用 Managed Identity 代替
```

---

## 🚀 部署流程

### 方案 A: 通过 GitHub Actions 自动部署

1. **准备工作完成后**，将特性分支合并到 `main`:

```bash
git checkout main
git pull origin main
git merge feature/4-testing-devops
git push origin main
```

2. **GitHub Actions 自动触发**:
   - ✅ 运行单元测试和集成测试
   - ✅ 运行 E2E 测试（Playwright）
   - ✅ 构建 Docker 镜像
   - ✅ 推送镜像到 GHCR
   - ✅ 部署到 Azure Container Apps

3. **监控部署**:
   - GitHub → Actions → workflow 运行记录
   - 查看步骤输出和日志

### 方案 B: 手动部署（用于测试和排查）

```bash
# 本地构建镜像
docker build \
  -f src/Veda.Api/Dockerfile \
  -t ghcr.io/your-org/vedaaide-api:manual-test \
  .

# 登录 GHCR
echo $GHCR_PAT | docker login ghcr.io -u <USERNAME> --password-stdin

# 推送镜像
docker push ghcr.io/your-org/vedaaide-api:manual-test

# 更新 Container App
az containerapp update \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --image ghcr.io/your-org/vedaaide-api:manual-test
```

---

## 📦 部署后验证

### 健康检查

```bash
# 检查 Container App 状态
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.provisioningState" -o tsv

# 检查副本状态
az containerapp revision list \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --output table

# 手动健康检查
curl https://vedaaide-prod-api.azurecontainerapps.io/health
```

### 查看日志

```bash
# 使用 Log Analytics
az monitor log-analytics query \
  --workspace vedaaide-prod-logs \
  --analytics-query 'ContainerAppConsoleLogs_CL | tail 20'

# 实时日志流
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow
```

---

## 🆘 故障排查

### 常见问题

#### 1. GitHub Actions 部署失败: "Invalid credentials"

**原因**: Service Principal 权限不足或 Secrets 配置错误

**解决**:

```bash
# 验证 Service Principal 权限
az role assignment list \
  --assignee <CLIENT_ID> \
  --output table

# 重新创建 Service Principal 如果需要
az ad sp delete --id <CLIENT_ID>
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

#### 2. 容器无法启动: "Application Health is Unhealthy"

**原因**: 环境变量缺失或健康检查失败

**解决**:

```bash
# 检查健康检查端点
curl http://localhost:8080/health
# 或
curl http://localhost:3000/api/health

# 查看容器日志
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow --tail 50

# 检查环境变量
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.template.containers[0].env" -o table
```

#### 3. GHCR 认证失败: "unauthorized"

**原因**: PAT 已过期或权限不足

**解决**:

```bash
# 创建新的 PAT（见前文步骤 1）
# 更新 GitHub Secret
gh secret set GHCR_PAT --body <NEW_PAT>
```

#### 4. Bicep 部署失败: "Parameter validation failed"

**原因**: 参数文件格式错误或值不合法

**解决**:

```bash
# 验证模板和参数
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --debug

# 查看详细错误
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --debug 2>&1 | head -100
```

#### 5. Azure OpenAI 集成不工作

**症状**: API 返回 LLM 调用错误

**解决**:

```bash
# 检查 Azure OpenAI 端点和 API Key 是否正确
# 测试连接
curl -X GET "https://<YOUR_ACCOUNT>.openai.azure.com/openai/models?api-version=2024-08-01-preview" \
  -H "api-key: <YOUR_KEY>"

# 更新环境变量
az containerapp update \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --set-env-vars \
    "Veda__AzureOpenAI__Endpoint=https://<YOUR_ACCOUNT>.openai.azure.com/" \
    "Veda__AzureOpenAI__ApiKey=<YOUR_KEY>"
```

---

## 📚 参考资源

- [Azure Container Apps 文档](https://learn.microsoft.com/en-us/azure/container-apps)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Bicep 语言参考](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/file)
- [Azure CLI 参考](https://learn.microsoft.com/en-us/cli/azure)

---

## 📋 部署检查表

合并 PR 前最后确认:

- [ ] 代码通过所有测试 (`npm run test`, `dotnet test`)
- [ ] 类型检查通过 (`npm run type-check`)
- [ ] Lint 检查通过 (`npm run lint`)
- [ ] Docker 镜像能本地构建
- [ ] Azure 资源组已创建
- [ ] Service Principal 已创建
- [ ] GitHub Actions Secrets 已配置:
  - [ ] `AZURE_SUBSCRIPTION_ID`
  - [ ] `AZURE_TENANT_ID`
  - [ ] `AZURE_CLIENT_ID`
  - [ ] `GHCR_PAT` (for VedaAide.NET)
  - [ ] `AZURE_CREDENTIALS` (for VedaAide.js)
- [ ] 部署参数文件已更新 (`infra/main.parameters.json`)
- [ ] Bicep 模板已验证 (`az deployment group validate`)
- [ ] 环境变量已确认 (健康检查端点、日志等级等)
- [ ] Key Vault 已创建（生产环境推荐）
- [ ] 监控和告警已配置（推荐）

---

**问题或反馈？** 提交 GitHub Issue 或 PR。
