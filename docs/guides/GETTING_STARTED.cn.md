# 快速开始

从零开始在本地设置 VedaAide.js 的完整指南。

---

## 前置要求

| 工具          | 版本 | 用途                |
| ------------- | ---- | ------------------- |
| Node.js       | 22+  | 运行环境            |
| npm           | 10+  | 包管理器            |
| Ollama        | 最新 | 本地 LLM 和嵌入引擎 |
| Git           | 任何 | 源代码控制          |
| Docker (可选) | 最新 | 基于容器的运行      |

---

## 1. 克隆并安装

```bash
git clone https://github.com/DerekJi/VedaAide.js.git
cd VedaAide.js
npm ci           # 安装依赖并通过 postinstall 自动生成 Prisma 客户端
```

> **注意**：`npm ci` 会通过 `postinstall` 钩子自动运行 `prisma generate` — 无需手动执行。

---

## 2. 配置环境变量

复制示例文件并填入您的值：

```bash
cp .env.example .env
```

### 最小必需配置（本地 Ollama 模式）

```dotenv
# SQLite 数据库路径
DATABASE_URL=file:./dev.db

# Ollama (本地)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=bge-m3
OLLAMA_CHAT_MODEL=qwen:7b-chat

# 日志记录
LOG_LEVEL=info
NODE_ENV=development
```

### 可选 — Azure 服务（本地开发不需要）

```dotenv
# Azure OpenAI (用于生产环境替代 Ollama)
AZURE_OPENAI_ENDPOINT=https://<name>.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Azure Cosmos DB (用于生产环境替代 SQLite 向量存储)
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_COSMOS_KEY=<key>
AZURE_COSMOS_DATABASE=vedaaide
AZURE_COSMOS_CONTAINER=vectors

# Azure Blob Storage (文档源连接器 — 见 skipped-tasks.md)
AZURE_BLOB_ACCOUNT_NAME=<account>
AZURE_BLOB_ACCOUNT_KEY=<key>
AZURE_BLOB_CONTAINER_NAME=documents
```

---

## 3. 设置 Ollama（本地 LLM）

### 安装 Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: 从 https://ollama.ai/download 下载
```

### 拉取所需模型

```bash
ollama pull bge-m3   # 嵌入模型 (~274 MB)
ollama pull qwen:7b-chat           # 聊天模型 (~2 GB)
```

### 验证 Ollama 运行中

```bash
curl http://localhost:11434/api/tags
# 应返回包含可用模型的 JSON
```

---

## 4. 初始化数据库

```bash
npm run db:migrate     # 创建 dev.db 并应用迁移
```

或者以可视化方式检查/初始化数据库：

```bash
npm run db:studio      # 在 http://localhost:5555 打开 Prisma Studio
```

---

## 5. 运行开发服务器

```bash
npm run dev
# 应用启动于 http://localhost:3000
```

### 验证 API 健康状态

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

---

## 6. 摄入文档

使用 REST API 摄入文档：

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "readme.md",
    "content": "VedaAide 是一个基于 RAG 的知识助手..."
  }'
```

列出已摄入的文件：

```bash
curl http://localhost:3000/api/ingest
```

---

## 7. 查询知识库

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "VedaAide 是什么？"}'
```

响应格式：

```json
{
  "answer": "VedaAide 是...",
  "sources": [{ "id": "...", "content": "...", "score": 0.91 }],
  "isHallucination": false,
  "traceId": "rag-abc123"
}
```

---

## 8. 使用 Docker 运行（替代方案）

如果要避免本地安装 Ollama，可以使用 Docker Compose，它会同时启动应用和 Ollama：

```bash
docker compose up --build
# 应用: http://localhost:3000
# Ollama: http://localhost:11434
```

在 Ollama 容器内拉取模型：

```bash
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull qwen:7b-chat
```

---

## 9. 探索 API

### OpenAPI 规范（自动生成）

```bash
curl http://localhost:3000/api/openapi
# 返回完整的 OpenAPI 3.0 JSON 规范
```

### Postman 集合

将 `docs/postman/vedaaide.postman_collection.json` 导入 Postman，获取覆盖所有端点的完整预配置集合。

### 负载测试

```bash
# 安装 k6: https://k6.io/docs/get-started/installation/
k6 run tests/load/rag-query.js
```

---

## 故障排除

| 问题                              | 解决方法                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `PrismaClientInitializationError` | 运行 `npm run db:migrate` 或检查 `.env` 中的 `DATABASE_URL` |
| `Prisma client not generated`     | 运行 `npm run db:generate`                                  |
| `ECONNREFUSED 11434`              | 启动 Ollama: `ollama serve`                                 |
| `model not found`                 | 运行 `ollama pull <model-name>`                             |
| TypeScript 错误（拉取后）         | 运行 `npm ci` 重新生成 Prisma 类型                          |

---

## 另见

- [快速开始](QUICK_START.cn.md) — 了解技术栈的开发者快速路径
- [测试指南](../testing/TESTING.cn.md) — 单元测试、集成测试和 E2E 测试
- [部署指南](../reference/DEPLOYMENT.cn.md) — Azure 云部署
