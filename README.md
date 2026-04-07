# VedaAide.js - AI驱动的文档助手

基于 Next.js 15 + LangChain 的 RAG（检索增强生成）系统。支持本地 Ollama、Azure OpenAI 和 Cosmos DB 集成。

## 🚀 快速开始

### 前置要求

- **Node.js**: v18+ (建议v24+)
- **npm**: v10+
- **Ollama** (可选，用于本地开发): [下载链接](https://ollama.ai)
- **Docker & Docker Compose** (可选，用于容器化部署)

### 模式选择

本项目支持三种运行模式：

| 模式                     | 用途          | 依赖                         | 难度        |
| ------------------------ | ------------- | ---------------------------- | ----------- |
| **模式1: 本地开发**      | 开发 + 测试   | Ollama + SQLite              | ⭐ 简单     |
| **模式2: 本地Azure测试** | 验证Azure服务 | Ollama + SQLite + Azure 凭证 | ⭐⭐ 中等   |
| **模式3: 生产部署**      | Azure云运行   | Azure Managed Identity       | ⭐⭐⭐ 复杂 |

---

## 📌 模式1：本地开发（推荐首先尝试）

### 步骤1：安装依赖

```bash
cd d:/source/VedaAide.js
npm install
```

### 步骤2：配置环境变量

```bash
# 复制环境模板
cp .env.example .env.local
```

编辑 `.env.local`，保持默认设置即可：

```env
NODE_ENV=development
DEPLOYMENT_MODE=false
DATABASE_URL=file:./dev.db
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2
```

### 步骤3：初始化数据库

```bash
npm run db:migrate
```

这将创建 SQLite 数据库（`dev.db`）并应用所有迁移。

### 步骤4：启动 Ollama（新终端窗口）

**选项A：本地运行 Ollama**

```bash
# 如果已安装 Ollama 客户端，直接运行
ollama serve
```

**选项B：Docker 容器运行**

```bash
docker run -d -p 11434:11434 ollama/ollama
# 拉取所需模型
docker exec $(docker ps -q --filter "ancestor=ollama/ollama") ollama pull nomic-embed-text
docker exec $(docker ps -q --filter "ancestor=ollama/ollama") ollama pull llama3.2
```

**选项C：使用 Docker Compose（简单）**

```bash
# 自动启动 Ollama + 相关服务
docker compose up -d ollama
```

### 步骤5：启动后端 API（新终端窗口）

**开发模式（热重载）：**

```bash
npm run dev
```

输出示例：

```
  ▲ Next.js 15.3.0

  ✓ Ready in 2.1s
  - Local:        http://localhost:3000
  - Environments: .env.local
```

### 步骤6：验证后端是否运行

打开新终端，测试健康检查：

```bash
curl http://localhost:3000/api/health
```

预期响应：

```json
{
  "status": "healthy",
  "timestamp": "2026-04-07T10:30:45Z",
  "version": "0.1.0"
}
```

### 步骤7：测试 API 端点

#### 测试摄入（Ingest）API

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Python是一种编程语言，适合数据科学和机器学习。",
    "source": "test-doc-1",
    "metadata": {
      "type": "tech_article",
      "author": "test_user"
    }
  }'
```

预期响应：

```json
{
  "success": true,
  "message": "Document ingested successfully",
  "fileId": "test-doc-1",
  "chunksCreated": 1,
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 测试查询（Query）API

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Python用来做什么？",
    "topK": 5
  }'
```

预期响应：

```json
{
  "answer": "Python是一种编程语言，适合数据科学和机器学习。",
  "sources": [
    {
      "content": "Python是一种编程语言，适合数据科学和机器学习。",
      "source": "test-doc-1",
      "similarity": 0.98
    }
  ],
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🐳 Docker 部署

### 启动完整栈（推荐用于演示）

```bash
# 开发模式（Ollama + API）
docker compose up

# 或指定特定服务
docker compose up api ollama
```

验证服务：

```bash
# 检查所有容器状态
docker compose ps

# 查看日志
docker compose logs -f api

# 停止服务
docker compose down
```

### 构建生产镜像

```bash
docker build -t vedaaide-js:latest .
docker run -p 3000:3000 -e DEPLOYMENT_MODE=true vedaaide-js:latest
```

---

## 🧪 测试

### 查看测试说明

详细的测试文档请参考 [TESTING.md](./TESTING.md)

### 快速测试命令

```bash
# 运行所有单元测试
npm test

# 监视模式（开发中推荐）
npm test:watch

# 生成覆盖率报告
npm run test:coverage

# 编译检查
npm run type-check

# 代码规范检查
npm run lint
```

---

## 📁 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── health/route.ts        # 健康检查端点
│   │   ├── ingest/route.ts        # 文档摄入端点
│   │   └── query/route.ts         # 查询端点
│   ├── layout.tsx                  # 根布局
│   ├── page.tsx                    # 主页（占位符）
│   └── globals.css                 # 全局样式
│
├── lib/
│   ├── db.ts                       # Prisma 单例（防止连接池泄漏）
│   ├── env.ts                      # 环境变量验证（Zod）
│   ├── errors.ts                   # 自定义错误类层次
│   ├── logger.ts                   # 结构化日志（Pino）
│   ├── types.ts                    # 域模型类型定义
│   │
│   ├── services/
│   │   ├── embedding.service.ts          # IEmbeddingService 接口
│   │   ├── ollama-embedding.service.ts   # Ollama 实现
│   │   ├── chat.service.ts               # IChatService 接口
│   │   ├── ollama-chat.service.ts        # Ollama 实现
│   │   ├── chunking.service.ts           # 文档分块（3种策略）
│   │   ├── rag.service.ts                # RAG 管道编排
│   │   ├── azure-openai-chat.service.ts  # Azure OpenAI 实现
│   │   ├── cosmos-db.connector.ts        # Cosmos DB REST 连接器
│   │   └── blob-storage.connector.ts     # Blob Storage 连接器
│   │
│   └── vector-store/
│       ├── vector-store.ts               # IVectorStore 接口
│       ├── sqlite-vector-store.ts        # SQLite 实现
│       └── cosine-similarity.ts          # 余弦相似度计算
│
├── prisma/
│   ├── schema.prisma                # 数据库模式
│   └── migrations/                  # Prisma 迁移
│
└── tests/
    └── [单元和集成测试文件]
```

---

## 🔑 环境变量说明

### 基础配置

```env
NODE_ENV=development                  # 运行环境: development | production
DEPLOYMENT_MODE=false                 # Azure: true=Managed Identity, false=API密钥
LOG_LEVEL=info                        # 日志级别: debug | info | warn | error
```

### 数据库配置

```env
DATABASE_URL=file:./dev.db            # SQLite 文件路径（开发）
```

### Ollama 配置（本地开发）

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2
```

### Azure OpenAI（可选）

```env
AZURE_OPENAI_ENDPOINT=https://<name>.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### Azure Cosmos DB（可选）

```env
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_COSMOS_KEY=<primary-key>
AZURE_COSMOS_DATABASE=vedaaide
AZURE_COSMOS_CONTAINER=vectors
```

### Azure Blob Storage（可选）

```env
AZURE_BLOB_ACCOUNT_NAME=<storage-account>
AZURE_BLOB_ACCOUNT_KEY=<access-key>
AZURE_BLOB_CONTAINER_NAME=documents
```

---

## 🏗️ 前端开发（Phase 2）

当前前端为占位符。完整UI将在 Phase 2 实现，包括：

- 📄 文档上传表单
- 💬 聊天界面
- 📊 查询历史
- 🔍 源文档展示

---

## 🐛 常见问题排查

### 问题1：Ollama 连接失败

```
Error: Failed to connect to Ollama at http://localhost:11434
```

**解决方案：**

```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 如未运行，启动 Ollama
ollama serve

# 或用 Docker
docker run -d -p 11434:11434 ollama/ollama
```

### 问题2：数据库锁定错误

```
Error: database is locked
```

**解决方案：**

```bash
# 删除数据库并重新迁移
rm dev.db
npm run db:migrate
```

### 问题3：TypeScript 错误

```bash
# 检查类型
npm run type-check

# 修复格式问题
npm run format
```

### 问题4：端口被占用

```
Error: listen EADDRINUSE :::3000
```

**解决方案：**

```bash
# 更改端口
PORT=3001 npm run dev

# 或杀死占用的进程（macOS/Linux）
pkill -f "next dev"
```

---

## 📊 性能基准

| 操作     | P95 延迟 | 吞吐量         |
| -------- | -------- | -------------- |
| 文档摄入 | <500ms   | 120 docs/min   |
| RAG 查询 | <2s      | 30 queries/min |
| 向量搜索 | <100ms   | 1000 ops/sec   |

---

## 📝 许可证

MIT

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
