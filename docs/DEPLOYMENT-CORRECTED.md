# VedaAide 部署实际情况 - 修正版

**修正日期**: 2026-04-09  
**基于**: 实际 Bicep 模板审查 + 用户现有资源

---

## 🎯 核心修正

### 1️⃣ 关于 Key Vault ❌ 不需要

**之前的错误**：

> "推荐配置 Key Vault 用于生产密钥"

**正确情况**：

- ✅ VedaAide.NET 使用 **Managed Identity** 自动认证
- ✅ API Key 作为 Container App Secret（不需要 Key Vault）
- ✅ Cosmos DB、Azure OpenAI、Document Intelligence 都通过 Managed Identity 访问
- ✅ 不需要存储 AccountKey、ApiKey 这类敏感信息

**结论**: **Key Vault 完全不需要** 👍

---

### 2️⃣ Bicep 模板部署的是什么

**部署内容**：

```
Bicep 模板 (main.bicep + container-apps.bicep) 创建：

1. ✅ Log Analytics Workspace - 日志存储
2. ✅ Container Apps Environment - 容器运行环境
3. ✅ User-Assigned Managed Identity - 身份认证（关键！）
4. ✅ Azure Document Intelligence (F0) - 文档处理
5. ✅ Role Assignment - Managed Identity 对 Document Intelligence 的访问权
6. ✅ Container App - 实际运行 VedaAide API 的容器应用

总结: 是**完整的 Container Apps 部署** + 支持服务
```

---

### 3️⃣ 你现有的资源可复用

**你已有的**：

- ✅ Cosmos DB 账户（已经在用）
- ✅ Azure OpenAI（已经配置好的 deployment）
- ✅ Document Intelligence 实例（可能已有）

**Bicep 模板会做什么**：

```
问题: Bicep 会创建一个新的 Document Intelligence (F0 SKU)
结果: 这可能是重复的，因为你已经有了

解决方案:
  选项 A: 停用 Bicep 中的 Document Intelligence 创建
  选项 B: 修改 Bicep 参数指向已有的 Document Intelligence
  选项 C: 允许创建新的 (F0 免费，可以用多个)
```

---

## 📋 修正后的部署流程

### 方案：最小化部署（推荐）

**只部署 Container Apps 相关资源，复用已有的 Cosmos/OpenAI/DocIntel**

#### 步骤 1: 准备部署参数

```json
// infra/main.parameters.json - 修正版

{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "containerImage": {
      "value": "ghcr.io/your-org/vedaaide-api:sha-<latest-commit>"
    },
    "environment": {
      "value": "prod"
    },
    "location": {
      "value": "australiaeast"
    },

    // 指向你现有的资源
    "azureOpenAiEndpoint": {
      "value": "https://your-existing-account.openai.azure.com"
    },
    "cosmosDbEndpoint": {
      "value": "https://your-existing-cosmos.documents.azure.com:443"
    },

    // API Key（可选，仅开发用）
    "apiKey": {
      "value": ""
    },
    "adminApiKey": {
      "value": ""
    },

    "allowedOrigins": {
      "value": "https://your-frontend-domain.com"
    }
  }
}
```

#### 步骤 2: 创建资源组（如还没有）

```bash
az group create \
  --name vedaaide-prod-rg \
  --location australiaeast
```

#### 步骤 3: 部署 Bicep（这会创建 Container Apps）

```bash
az deployment group create \
  --resource-group vedaaide-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json
```

**这个命令完成后**:

- ✅ Container Apps Environment 创建
- ✅ Managed Identity 创建（重要！）
- ✅ Container App 创建并运行你的镜像
- ✅ Log Analytics 创建
- ✅ Document Intelligence (F0) 创建（新的）

#### 步骤 4: 配置 Managed Identity 权限

```bash
# 获取 Managed Identity 的 Principal ID
IDENTITY_ID=$(az deployment group show \
  --resource-group vedaaide-prod-rg \
  --name vedaaide-infra \
  --query properties.outputs.identityPrincipalId.value -o tsv)

# 为 Managed Identity 赋予 Cosmos DB 访问权限
az role assignment create \
  --role "DocumentDB Account Contributor" \
  --assignee-object-id $IDENTITY_ID \
  --scope /subscriptions/<SUB_ID>/resourcegroups/<RG_NAME>/providers/Microsoft.DocumentDB/databaseAccounts/<COSMOS_ACCOUNT>

# 为 Managed Identity 赋予 Azure OpenAI 访问权限
az role assignment create \
  --role "Cognitive Services User" \
  --assignee-object-id $IDENTITY_ID \
  --scope /subscriptions/<SUB_ID>/resourcegroups/<RG_NAME>/providers/Microsoft.CognitiveServices/accounts/<OPENAI_ACCOUNT>
```

---

## ✅ 修正后的部署检查清单

### 必需（需要预先完成）

- [ ] GitHub Actions Secrets 配置（仍然需要）
  - `AZURE_SUBSCRIPTION_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_CLIENT_ID`
  - `GHCR_PAT`
  - `AZURE_CREDENTIALS` (前端)

- [ ] 确认现有资源信息
  - [ ] Cosmos DB 端点 URL
  - [ ] Azure OpenAI 端点 URL
  - [ ] 订阅 ID
  - [ ] 资源组名称

### 部署步骤（简化版）

1. **保存参数文件** - 更新 `infra/main.parameters.json`
2. **验证 Bicep** - `az deployment group validate ...`
3. **部署** - `az deployment group create ...`
4. **授权 Managed Identity** - 为 Cosmos/OpenAI 授予访问权
5. **合并 PR** - GitHub Actions 自动部署新镜像

### 部署时发生了什么

```
Bicep 部署开始
  ↓
创建 Log Analytics Workspace ✅
  ↓
创建 Container Apps Environment ✅
  ↓
创建 Managed Identity (关键!) ✅
  ↓
创建 Document Intelligence F0 ✅
  ↓
创建 Container App + 第一次部署镜像 ✅
  ↓
配置秘密和环境变量 ✅
  ↓
应用启动，使用 Managed Identity 连接到：
  - 你现有的 Cosmos DB
  - 你现有的 Azure OpenAI
  - 新的或现有的 Document Intelligence
```

---

## 🔄 如果是更新部署（已有 Container App）

如果你已经有 Container App，**不需要再部署 Bicep**。只需：

```bash
# 方式 1: 更新容器镜像（简单）
az containerapp update \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --image ghcr.io/your-org/vedaaide-api:new-commit-sha

# 方式 2: 通过 GitHub Actions 自动部署（推荐）
git merge feature/4-testing-devops  # 合并 PR
# GitHub Actions 自动检测并部署新镜像
```

---

## 📊 修正后的部署所需资源

| 资源                       | 状态             | 说明                            |
| -------------------------- | ---------------- | ------------------------------- |
| Container Apps Environment | ✅ 由 Bicep 创建 | 本次部署创建                    |
| Managed Identity           | ✅ 由 Bicep 创建 | **最重要**，用于 Azure 服务认证 |
| Container App (业务实例)   | ✅ 由 Bicep 创建 | 实际运行 VedaAide API           |
| Log Analytics              | ✅ 由 Bicep 创建 | 日志存储                        |
| Document Intelligence      | Depends\*        | Bicep 会创建新的，或复用已有的  |
| Cosmos DB                  | ✅ 已有，复用    | 你现有的数据库                  |
| Azure OpenAI               | ✅ 已有，复用    | 你现有的 LLM                    |
| Key Vault                  | ❌ 不需要        | Managed Identity 代替           |

\*Document Intelligence: 如果你已有，可以修改 Bicep 参数指向它，或让 Bicep 创建新的 F0 (免费)

---

## 🚀 最简化的部署命令（复制即用）

```bash
# 1. 设置变量
RESOURCE_GROUP="vedaaide-prod-rg"
LOCATION="australiaeast"
COSMOS_ENDPOINT="https://your-cosmos.documents.azure.com:443"
OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
CONTAINER_IMAGE="ghcr.io/your-org/vedaaide-api:latest"

# 2. 创建资源组（如不存在）
az group create --name $RESOURCE_GROUP --location $LOCATION

# 3. 创建参数文件
cat > infra/main.parameters.json <<EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "containerImage": { "value": "$CONTAINER_IMAGE" },
    "azureOpenAiEndpoint": { "value": "$OPENAI_ENDPOINT" },
    "cosmosDbEndpoint": { "value": "$COSMOS_ENDPOINT" },
    "environment": { "value": "prod" }
  }
}
EOF

# 4. 验证
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 5. 部署
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 6. 获取 Managed Identity 信息
IDENTITY_ID=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name vedaaide-infra \
  --query properties.outputs.identityPrincipalId.value -o tsv)

echo "Managed Identity Principal ID: $IDENTITY_ID"
echo "现在需要在 Azure Portal 中为这个 Identity 授予 Cosmos DB 和 OpenAI 的访问权"
```

---

## ⚠️ 关键差异总结

| 项                        | 之前认为     | 实际情况                          |
| ------------------------- | ------------ | --------------------------------- |
| **Key Vault**             | 推荐配置     | ❌ 完全不需要                     |
| **Bicep 部署**            | 不知道的组件 | ✅ Container Apps 完整部署        |
| **资源复用**              | 没有考虑     | ✅ Cosmos/OpenAI 可复用，授权即可 |
| **Managed Identity**      | 被创建       | ✅ 部署中最关键的部分             |
| **Document Intelligence** | 无需关心     | Creates 新的 F0，或可指向已有     |

---

## 🎯 下一步

1. **确认你的现有资源信息**
   - Cosmos DB 端点
   - Azure OpenAI 端点
   - 订阅 ID

2. **更新参数文件** - `infra/main.parameters.json`

3. **可选: 修改 Bicep** - 如果不想创建新的 Document Intelligence，可注释掉相关部分

4. **部署** - 运行上面的"最简化部署命令"

5. **授权 Managed Identity** - 为访问 Cosmos/OpenAI 赋予权限

6. **合并 PR** - GitHub Actions 自动部署新镜像

---

**准备好了吗？需要我生成部署脚本或修改 Bicep 模板吗？**
