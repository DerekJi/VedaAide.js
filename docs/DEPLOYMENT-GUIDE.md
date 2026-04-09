# 🚀 快速部署指南

部署 VedaAide.js 到 Azure Container Apps 的三种方式。

## 方式 1️⃣：通过 GitHub 网页界面（最简单）✨

1. 打开 GitHub：https://github.com/DerekJi/VedaAide.js/actions

2. 左侧点击 **"Deploy Infrastructure"**

3. 点击黄色按钮 **"Run workflow"**

4. 输入参数（或使用默认值）：
   - **environment**: `prod`
   - **container_image**: `ghcr.io/DerekJi/vedaaide-js:latest`

5. 点击 **"Run workflow"** 开始部署

6. 等待完成（约 5-10 分钟）

---

## 方式 2️⃣：使用脚本（需要 GitHub Token）

### 准备：

```bash
# 1. 创建 GitHub Personal Access Token
#    https://github.com/settings/tokens
#    权限: workflow, repo

# 2. 设置环境变量
export GITHUB_TOKEN="your_token_here"

# 3. 运行脚本
cd d:/source/VedaAide.js
bash scripts/trigger-deployment.sh prod "ghcr.io/DerekJi/vedaaide-js:latest"
```

---

## 方式 3️⃣：使用 Azure CLI（仅当本地网络正常时）

```bash
cd d:/source/VedaAide.js
export CONTAINER_IMAGE="ghcr.io/DerekJi/vedaaide-js:latest"
export COSMOS_ENDPOINT="https://vedaaide.documents.azure.com:443/"
export OPENAI_ENDPOINT="https://dev-dj-open-ai.openai.azure.com/"
bash scripts/deploy-to-azure.sh
```

⚠️ **注意**: 目前 Azure CLI 有 bug，不建议使用

---

## 📊 监控部署进度

部署开始后，可以在以下位置查看进度：

1. **GitHub Actions 页面** (推荐)
   - https://github.com/DerekJi/VedaAide.js/actions
   - 点击最新的 workflow run
   - 查看详细日志和错误

2. **Azure 门户**
   - https://portal.azure.com
   - 找到资源组 `vedaaide-prod-rg`
   - 查看 Container Apps 状态

3. **命令行**
   ```bash
   az containerapp list --resource-group vedaaide-prod-rg -o table
   ```

---

## 🧪 验证部署

部署完成后，测试健康检查端点：

```bash
# 查找 Container App 的 FQDN
az containerapp list --resource-group vedaaide-prod-rg \
  --query "[].properties.configuration.ingress.fqdn" -o tsv

# 测试健康检查
curl https://<your-fqdn>/api/health
```

预期响应：

```json
{
  "status": "ok",
  "timestamp": "2026-04-09T15:45:30.123Z",
  "version": "0.1.0"
}
```

---

## ⚙️ 后续步骤

部署完成后：

1. **授予 Managed Identity 权限**（如果使用 Cosmos DB）

   ```bash
   bash scripts/authorize-managed-identity.sh
   ```

2. **查看容器日志**

   ```bash
   az containerapp logs show \
     --name vedaaide-prod \
     --resource-group vedaaide-prod-rg \
     --follow
   ```

3. **监控应用**
   - Azure Portal: Container Apps 详情页
   - 应用性能：https://<your-fqdn>/api/health

---

## 🚨 故障排除

### 部署失败

查看 Actions 标签页的日志：

- GitHub Actions: https://github.com/DerekJi/VedaAide.js/actions
- 点击失败的 workflow，展开步骤查看错误

### 镜像不存在

检查镜像是否已推送到 GitHub Packages：

- https://github.com/DerekJi/VedaAide.js/pkgs/container/vedaaide-js

### 端点无响应

等待 2-3 分钟后重试（容器启动需要时间）

---

## 📝 笔记

- 默认环境：`prod`
- 默认镜像：`ghcr.io/DerekJi/vedaaide-js:latest`
- 资源组：`vedaaide-prod-rg`
- 容器应用名称：`vedaaide-prod`
- 区域：`australiaeast`
