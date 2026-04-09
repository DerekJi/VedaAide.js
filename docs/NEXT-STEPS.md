# 🎯 VedaAide 部署 - 你现在需要做什么

**生成日期**: 2026-04-09  
**状态**: 所有脚本和文档已准备完成  
**下一步**: 按以下清单逐项完成

---

## ✅ 我已经为你完成的工作

### 📚 文档更新

- ✅ `docs/deployment-checklist.md` - 移除 Key Vault、修正Managed Identity说明
- ✅ `docs/deployment-checklist.en.md` - 英文版同步更新
- ✅ `docs/DEPLOYMENT-CORRECTED.md` - 完整的修正指南

### 🔨 脚本生成

- ✅ `scripts/deploy-to-azure.sh` - 一键部署 Bicep 模板
- ✅ `scripts/authorize-managed-identity.sh` - 授权 Managed Identity 访问 Cosmos/OpenAI
- ✅ `scripts/verify-azure-resources.sh` - 验证现有 Azure 资源
- ✅ `scripts/monitor-deployment.sh` - 部署后监控脚本

### 📄 参数文件

- ✅ `infra/main.parameters.json` - 部署参数模板

---

## 📋 你现在需要做的 (按顺序)

### 🔴 **第 1 步: 验证现有资源** (5 分钟)

```bash
# 查看你现有的 Azure 资源（Cosmos DB、Azure OpenAI、Document Intelligence）
bash scripts/verify-azure-resources.sh
```

**你需要记录下来**:

- [ ] Cosmos DB 账户名称和所在资源组
- [ ] Azure OpenAI 账户名称、所在资源组、端点 URL
- [ ] Document Intelligence 账户名称（如有）

**给我看看输出**，或告诉我：

```
例如：
  - Cosmos 账户: my-cosmos-db (资源组: my-rg-cosmosdb)
  - OpenAI 账户: my-openai (资源组: my-rg-openai)
  - 端点: https://my-openai.openai.azure.com/
```

---

### 🟠 **第 2 步: 配置 GitHub Secrets** (10 分钟)

**需要配置的 Secrets**（在 GitHub UI 中）:

#### VedaAide.NET 仓库

| Secret 名称             | 值                       | 说明                                              |
| ----------------------- | ------------------------ | ------------------------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | 你的订阅 ID              | 从 `az account show --query id -o tsv` 获取       |
| `AZURE_TENANT_ID`       | 你的 Tenant ID           | 从 `az account show --query tenantId -o tsv` 获取 |
| `AZURE_CLIENT_ID`       | Service Principal App ID | 需要创建 SP 或从现有 SP 获取                      |
| `GHCR_PAT`              | GitHub Token             | 具有 write:packages 权限                          |

#### VedaAide.js 仓库

| Secret 名称         | 值                        |
| ------------------- | ------------------------- |
| `AZURE_CREDENTIALS` | 上面 4 个字段的 JSON 格式 |

**如果没有 Service Principal，创建一个**:

```bash
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID>
```

**输出会包含你需要的所有值**

---

### 🟡 **第 3 步: 部署到 Azure** (15 分钟)

**设置环境变量**:

```bash
export RESOURCE_GROUP="vedaaide-prod-rg"
export LOCATION="australiaeast"
export CONTAINER_IMAGE="ghcr.io/your-org/vedaaide-api:latest"
export COSMOS_ENDPOINT="https://your-cosmos.documents.azure.com:443"
export OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
```

**运行部署脚本**:

```bash
bash scripts/deploy-to-azure.sh
```

**脚本会自动**:

- ✅ 检查资源组（不存在则创建）
- ✅ 生成部署参数文件
- ✅ 验证 Bicep 模板
- ✅ 部署到 Azure（5-10 分钟）
- ✅ 输出部署信息

**部署完成后你会看到**:

```
✨ 部署信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API URL: https://vedaaide-prod-api.xyz.azurecontainerapps.io
Container App: vedaaide-prod-api
Managed Identity Principal ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Managed Identity Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**记录下 Managed Identity Principal ID（下一步需要用）**

---

### 🟢 **第 4 步: 授权 Managed Identity** (5 分钟)

```bash
bash scripts/authorize-managed-identity.sh
```

**脚本会提示你输入**:

- Cosmos DB 资源组和账户名称
- Azure OpenAI 资源组和账户名称
- 是否有现有的 Document Intelligence

**脚本会自动**:

- ✅ 为 Managed Identity 授予 Cosmos DB 访问权限
- ✅ 为 Managed Identity 授予 Azure OpenAI 访问权限
- ✅ 为 Managed Identity 授予 Document Intelligence 访问权限（如有）

---

### 🔵 **第 5 步: 配置 GitHub Actions Secrets**（手动，GitHub UI）

进入你的两个仓库的 Settings → Secrets and variables → Actions

**填入你从之前步骤获得的值**:

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `GHCR_PAT`
- `AZURE_CREDENTIALS` (JSON)

---

### 🟣 **第 6 步: 合并 PR 到 main** (1 分钟)

```bash
git checkout main
git pull origin main
git merge feature/4-testing-devops
git push origin main
```

**GitHub Actions 自动触发**:

- ✅ 运行测试
- ✅ 构建 Docker 镜像
- ✅ 推送到 GHCR
- ✅ 部署新镜像到 Container Apps

---

### 🟤 **第 7 步: 监控部署** (2-5 分钟)

**查看 GitHub Actions 进度**:

```
GitHub → Actions → "Build, Test & Deploy" 工作流
```

**等待部署完成**（通常需要 5-15 分钟）

**查看容器状态和日志**:

```bash
bash scripts/monitor-deployment.sh
```

或手动：

```bash
# 查看实时日志
az containerapp logs show --name vedaaide-prod-api --resource-group vedaaide-prod-rg --follow

# 测试 API
curl https://vedaaide-prod-api.xxx.azurecontainerapps.io/health
```

---

## 📊 完整时间线

| 步骤                   | 耗时         | 状态    | 谁来做          |
| ---------------------- | ------------ | ------- | --------------- |
| 验证现有资源           | 5 分钟       | 🔴 待做 | 你              |
| 配置 GitHub Secrets    | 10 分钟      | 🔴 待做 | 你              |
| 创建 Service Principal | 5 分钟       | 🔴 待做 | 你              |
| 部署 Bicep             | 15 分钟      | 🔴 待做 | 脚本自动        |
| 授权 Managed Identity  | 5 分钟       | 🔴 待做 | 脚本自动        |
| 配置 GitHub Secrets    | 5 分钟       | 🔴 待做 | 你（GitHub UI） |
| 合并 PR                | 1 分钟       | 🔴 待做 | 你              |
| GitHub Actions 部署    | 15 分钟      | 🔴 待做 | 自动            |
| 监控和验证             | 5 分钟       | 🔴 待做 | 你              |
| **总计**               | **~60 分钟** |         |                 |

---

## 🚨 常见问题快速排查

### 问题: 部署脚本说 CONTAINER_IMAGE 未设置

**解决**:

```bash
export CONTAINER_IMAGE="ghcr.io/your-org/vedaaide-api:latest"
bash scripts/deploy-to-azure.sh
```

### 问题: 网络监听脚本说找不到 Cosmos DB

**解决**:

```bash
# 用这个查找你的 Cosmos 账户名
az cosmosdb list --query "[].{Name:name, ResourceGroup:resourceGroup}" -o table
```

### 问题: 授权脚本说 Managed Identity 不存在

**解决**:
确保部署脚本已完成，对比 Container App 名称

### 问题: GitHub Actions 部署失败

**检查**:

1. Secrets 是否正确配置
2. Container Image 是否在 GHCR 中
3. 查看 GitHub Actions 日志获取详细错误

---

## ✨ 部署成功的标志

✅ 所有都完成后，你会看到：

```
1. GitHub Actions 工作流显示 ✓ (绿色)
2. Container App 状态: Running (绿色)
3. 健康检查通过:
   curl https://vedaaide-prod-api.xxx.azurecontainerapps.io/health
   → 返回 200 OK
4. 查看日志无错误
```

---

## 📞 需要帮助？

### 如果卡住了：

1. 查看相应的脚本日志（脚本会显示详细的诊断信息）
2. 检查 `docs/deployment-checklist.md` 中的故障排查部分
3. 查看 `docs/DEPLOYMENT-CORRECTED.md` 获取修正后的完整指南

### 如果部署成功但应用无法使用：

- 检查环境变量是否正确
- 验证 Managed Identity 权限是否已授予
- 查看 `monitor-deployment.sh` 输出的日志

---

## 🎉 下一步行动

现在就可以开始了！按照顺序执行：

```bash
# 第 1 步
bash scripts/verify-azure-resources.sh

# 第 2 步 - 获取必要信息

# 第 3 步 - 创建 Service Principal (如需)
# az ad sp create-for-rbac ...

# 第 4 步 - 配置 GitHub Secrets (GitHub UI)

# 第 5 步 - 部署
bash scripts/deploy-to-azure.sh

# 第 6 步 - 授权
bash scripts/authorize-managed-identity.sh

# 第 7 步 - 合并 PR
git push origin main

# 第 8 步 - 监控
bash scripts/monitor-deployment.sh
```

---

**祝你部署顺利！🚀**

有任何问题，直接告诉我。
