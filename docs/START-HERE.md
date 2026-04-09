# 🎯 你现在需要做什么 - 精简版

**阅读时间**: 3 分钟  
**执行时间**: ~50 分钟

---

## 📋 你的任务清单（按顺序）

### 1️⃣ **了解现有资源** (5 分钟)

```bash
bash scripts/verify-azure-resources.sh
```

**记录下输出中的**:

- Cosmos DB 账户名和资源组
- Azure OpenAI 账户名、资源组、URL
- Document Intelligence 账户（如有）

---

### 2️⃣ **创建 Service Principal** (如果还没有)

```bash
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<YOUR_SUB_ID>
```

**保存输出中的**:

- `clientId` → 这是 `AZURE_CLIENT_ID`
- `clientSecret` → 这是部分
- `subscriptionId` → 这是 `AZURE_SUBSCRIPTION_ID`
- `tenantId` → 这是 `AZURE_TENANT_ID`

---

### 3️⃣ **在 GitHub 配置 Secrets**

**VedaAide.NET 仓库** → Settings → Secrets → Actions → 新建：

```
AZURE_SUBSCRIPTION_ID = 从上面的 subscriptionId 复制
AZURE_TENANT_ID = 从上面的 tenantId 复制
AZURE_CLIENT_ID = 从上面的 clientId 复制
GHCR_PAT = 创建 GitHub Token (Settings → Developer settings → Personal access tokens)
```

**VedaAide.js 仓库** → Settings → Secrets → Actions → 新建：

```json
AZURE_CREDENTIALS = {
  "clientId": "从上面的 clientId 复制",
  "clientSecret": "从上面的 clientSecret 复制",
  "subscriptionId": "从上面的 subscriptionId 复制",
  "tenantId": "从上面的 tenantId 复制"
}
```

---

### 4️⃣ **部署到 Azure** (15 分钟等待)

```bash
# 设置环境变量
export RESOURCE_GROUP="vedaaide-prod-rg"
export CONTAINER_IMAGE="ghcr.io/your-org/vedaaide-api:latest"
export COSMOS_ENDPOINT="https://your-cosmos.documents.azure.com:443"
export OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"

# 运行部署脚本
bash scripts/deploy-to-azure.sh
```

**脚本会自动**:
✅ 检查资源组（不存在则创建）
✅ 验证 Bicep 模板
✅ 部署到 Azure
✅ 输出 Managed Identity 信息

**记录下输出中的**:

- `Managed Identity Principal ID` ← 下一步需要

---

### 5️⃣ **授权 Managed Identity** (5 分钟)

```bash
bash scripts/authorize-managed-identity.sh
```

**脚本会提示你输入**:

- Cosmos DB 资源组和账户名
- Azure OpenAI 资源组和账户名

**脚本会自动**:
✅ 为 Managed Identity 授予 Cosmos DB 访问权
✅ 为 Managed Identity 授予 Azure OpenAI 访问权
✅ 为 Managed Identity 授予 Document Intelligence 访问权

---

### 6️⃣ **合并 PR** (1 分钟)

```bash
git checkout main
git pull origin main
git merge feature/4-testing-devops
git push origin main
```

**GitHub Actions 自动触发**:
✅ 构建镜像
✅ 推送到 GHCR  
✅ 部署到 Azure Container Apps

---

### 7️⃣ **验证部署** (5 分钟)

```bash
# 查看状态和日志
bash scripts/monitor-deployment.sh
```

**检查**:
✅ Container App 状态是 "Running"
✅ 健康检查 200 OK
✅ 日志无 ERROR

---

## ⏱️ 总耗时: ~50 分钟

| 步骤           | 耗时    | 谁做 |
| -------------- | ------- | ---- |
| 了解资源       | 5 分钟  | 你   |
| 创建 SP        | 5 分钟  | 你   |
| 配置 Secrets   | 5 分钟  | 你   |
| 部署 Bicep     | 15 分钟 | 脚本 |
| 授权身份       | 5 分钟  | 脚本 |
| 合并 PR        | 1 分钟  | 你   |
| GitHub Actions | 15 分钟 | 自动 |

---

## 🆘 出错了？

### 脚本报错

→ 脚本有详细的彩色输出，仔细看提示

### 部署失败

→ 查看 `docs/NEXT-STEPS.md` 中的"常见问题快速排查"

### 不确定某个步骤

→ 打开 `docs/NEXT-STEPS.md` 查看详细说明

### 概念不清楚

→ 阅读 `docs/DEPLOYMENT-CORRECTED.md`

---

## ✨ 完成后

你会有：

- ✅ Azure Container Apps 正在运行你的 VedaAide API
- ✅ Managed Identity 自动认证所有 Azure 服务
- ✅ GitHub Actions 自动化部署
- ✅ 可访问的 API: `https://vedaaide-prod-api.xxx.azurecontainerapps.io`

---

## 🚀 现在就开始

```bash
# 第一步：看看你有什么资源
bash scripts/verify-azure-resources.sh
```

**然后按上面的 7 个步骤依次操作！**

---

**如有问题，查看 `docs/NEXT-STEPS.md`**
