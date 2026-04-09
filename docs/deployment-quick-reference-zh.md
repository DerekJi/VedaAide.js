# 🚀 VedaAide 部署快速参考卡

**使用场景**: 合并 PR 到 main 前的快速检查  
**预计时间**: 2 分钟阅读

---

## ❓ 快速 Q&A

### 能不能现在部署？

```
当前状态: ⚠️ 不能 (缺少配置)

原因:
  ❌ GitHub Actions Secrets 未配置
  ❌ Azure 资源未创建
  ✅ 代码已就绪
  ✅ CI/CD 已就绪

需要完成:
  1️⃣ 创建 Service Principal
  2️⃣ 配置 4-5 个 GitHub Secrets
  3️⃣ 创建 Azure Resource Group
  4️⃣ 部署 Bicep 模板

预计时间: 30 分钟
```

### 部署后能用吗？

```
当前状态: ⚠️ 部分功能可用

图 Awesome:
  ✅ API 可启动
  ✅ 基础数据库
  ✅ 基础 Q&A（本地 Ollama）

需额外配置:
  ⚠️ Azure OpenAI (LLM 功能)
  ⚠️ Document Intelligence (文档处理)
  ⚠️ Application Insights (监控)

无需配置:
  ✅ 基础 API 端点
  ✅ 健康检查
  ✅ 日志收集
```

---

## 🔑 需要的 4 个 Secret

### VedaAide.NET (后端)

```bash
# 运行这个命令获取值
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

| Secret 名称             | 值来自              | 示例                                   |
| ----------------------- | ------------------- | -------------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | 订阅 ID             | `12345678-1234-1234-1234-123456789012` |
| `AZURE_TENANT_ID`       | tenantId            | `87654321-4321-4321-4321-210987654321` |
| `AZURE_CLIENT_ID`       | clientId            | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |
| `GHCR_PAT`              | GitHub Token (新建) | `ghp_xxxxxxxxxxxxxxxxxxxxxxx`          |

### VedaAide.js (前端)

| Secret 名称         | 值                                                   | 示例 |
| ------------------- | ---------------------------------------------------- | ---- |
| `AZURE_CREDENTIALS` | 上面 clientId/Secret/subscriptionId/tenantId 的 JSON | 见下 |

```json
{
  "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "12345678-1234-1234-1234-123456789012",
  "tenantId": "87654321-4321-4321-4321-210987654321"
}
```

---

## 📋 部署前 10 分钟快速清单

```bash
# 1️⃣ 创建 Service Principal (2 分钟)
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<YOUR_SUB_ID>

# 2️⃣ 创建资源组 (1 分钟)
az group create \
  --name vedaaide-prod-rg \
  --location australiaeast

# 3️⃣ 验证 Bicep 模板 (1 分钟)
az deployment group validate \
  --resource-group vedaaide-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 4️⃣ 部署 Bicep (3 分钟)
az deployment group create \
  --resource-group vedaaide-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 5️⃣ 配置 GitHub Secrets (2 分钟)
# 手动在 GitHub UI 配置 4 个 Secrets
# 详见: docs/deployment-checklist.md 步骤 2-3

# 6️⃣ 合并 PR (1 分钟)
git checkout main && git pull origin main
git merge feature/4-testing-devops
git push origin main

# ✅ 完成！观察 GitHub Actions 自动部署
```

---

## 🔍 部署状态监控

### GitHub Actions 查看位置

```
VedaAide.NET:
  GitHub → Actions → "Build, Test & Deploy" → 最新运行记录

VedaAide.js:
  GitHub → Actions → "CI/CD Pipeline" → 最新运行记录
```

### Azure Container Apps 查看位置

```bash
# 查看部署状态
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.provisioningState"

# 查看实时日志
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow

# 测试 API 健康检查
curl https://vedaaide-prod-api.azurecontainerapps.io/health
```

---

## ⚠️ 常见错误快速排查

| 错误信息                      | 原因           | 解决方案                   |
| ----------------------------- | -------------- | -------------------------- |
| `Invalid credentials`         | Secrets 错误   | 重新创建 Service Principal |
| `Unhealthy`                   | 环境变量缺失   | 检查容器日志               |
| `unauthorized`                | GHCR PAT 过期  | 创建新的 PAT               |
| `Parameter validation failed` | Bicep 参数错误 | 检查 parameters.json 格式  |

---

## 📚 完整文档位置

如需更详细的信息，请查看：

1. **中文完整指南**: `docs/deployment-checklist.md`
2. **英文完整指南**: `docs/deployment-checklist.en.md`
3. **部署就绪度报告**: `docs/deployment-readiness-summary-zh.md`

---

## 🎯 决策树

```
要合并 PR 吗？
  ↓
  [是]
    ↓
    GitHub Secrets 都配好了吗？
      ↓ [否]
      → 按步骤 2-3 配置 Secrets
      ↓ [是]
    Azure 资源都创建了吗？
      ↓ [否]
      → 按步骤 1 创建 Service Principal
      → 按步骤 1 创建 Resource Group
      → 按步骤 1 部署 Bicep
      ↓ [是]
    代码都通过测试了吗？
      ↓ [否]
      → 运行测试修复问题
      ↓ [是]
    ✅ 可以合并 PR
    ↓
    [合并]
      ↓
    GitHub Actions 自动部署
    监控进度: GitHub → Actions → workflow status

  [否]
    → 等待
```

---

**最后更新**: 2026-04-09
