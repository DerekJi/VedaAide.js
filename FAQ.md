# ❓ VedaAide.js - 常见问题解答 (FAQ)

快速找到常见问题的答案。

---

## 🚀 快速开始相关

### Q1: 如何快速确认系统是否正确配置？

**A:** 运行验证脚本：

```bash
# Linux / macOS / Git Bash
bash verify-setup.sh

# Windows
verify-setup.bat
```

这会检查所有依赖、配置、构建和测试，并给出逐项通过/失败报告。

### Q2: 第一次运行需要多长时间？

**A:** 大约 5-10 分钟：

- `npm install` - 2-3 分钟（下载 660+ 包）
- 首次 Ollama 模型下载 - 几分钟（可选）
- 数据库初始化 - <1 秒
- API 启动 - <2 秒

### Q3: 我可以在 Windows 上运行吗？

**A:** 是的，完全支持！

**方法1：Git Bash（推荐）**

```bash
# 安装 Git（包含 Git Bash）
# 然后运行
bash verify-setup.sh
npm run dev
```

**方法2：PowerShell / CMD**

```batch
verify-setup.bat
npm run dev
```

**方法3：WSL2（Windows Subsystem for Linux）**

```bash
wsl # 进入 WSL 环境
bash verify-setup.sh
npm run dev
```

### Q4: 我没有 Ollama，可以运行项目吗？

**A:** 不能运行查询功能，但可以：

- ✅ 运行单元测试（67 个，都能通过）
- ✅ 构建应用
- ✅ 检查代码质量

要运行 API，需要 Ollama。可以选择：

**选项1：本地启动 Ollama**

```bash
# 下载 https://ollama.ai
# 或用 Docker
docker run -d -p 11434:11434 ollama/ollama
```

**选项2：Docker Compose 启动**

```bash
docker compose up ollama
```

**选项3：Azure OpenAI（付费）**
需要在 `.env.local` 中配置 Azure 凭证（见 `.env.example`）

---

## 🧪 测试相关

### Q5: 如何运行测试？

**A:** 根据需要选择：

```bash
# 快速：运行所有测试
npm test

# 开发中：监视模式（文件改动时自动测试）
npm run test:watch

# 详细：生成覆盖率报告
npm run test:coverage

# 特定：运行某个测试文件
npm test src/lib/errors.test.ts
```

### Q6: 为什么有些测试运行很慢？

**A:** 可能原因：

1. **Ollama 连接** - 首次连接可能需要 1-2 秒
2. **数据库操作** - SQLite 写入
3. **系统繁忙** - 其他应用占用 CPU

**解决方案：**

```bash
# 查看详细时间打印
npm test -- --reporter=verbose

# 只运行特定测试
npm test -- -t "error"
```

### Q7: 测试覆盖率是多少？

**A:** **67.4%** (目标 ≥60%)

```
Statements:  67.41%
Branches:    74.39%
Functions:   89.13%
Lines:       67.41%
```

**什么文件不计入覆盖率？**

- 接口定义 (`vector-store.ts`, `chat.service.ts` 等) - 0% 是正常的
- 类型定义文件 (`types.ts`) - 无运行时代码
- 配置文件 (`env.ts` 安装时验证，不需要测试覆盖)

### Q8: 如何调试测试失败？

**A:** 三种方法：

**方法1：查看完整输出**

```bash
npm test -- --reporter=verbose src/lib/errors.test.ts
```

**方法2：只运行失败的测试**

```bash
npm run test:watch
# 在 watch 模式按 'f' 键
```

**方法3：Node 调试器**

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run
# 然后用 VS Code / DevTools 调试
```

---

## 🐳 Docker 相关

### Q9: Docker 命令有哪些？

**A:** 最常用的：

```bash
# 启动 (包含 Ollama + API)
docker compose up

# 后台运行
docker compose up -d

# 查看日志
docker compose logs -f api

# 停止
docker compose down

# 完整清理（包括数据库）
docker compose down -v
```

### Q10: 我可以只启动 Ollama 吗？

**A:** 可以：

```bash
# 仅启动 Ollama 服务
docker compose up ollama

# 同一个主机，启动 API（需要新终端）
npm run dev
```

### Q11: Docker 镜像大小是多少？

**A:**

- **Ollama 镜像**：~7.5GB （包含模型）
- **VedaAide 应用**：~300MB （基于 Node.js Alpine）

### Q12: 构建 Docker 镜像出错怎么办？

**A:**

```bash
# 检查 Docker 是否运行
docker ps

# 检查 Dockerfile 是否存在
ls Dockerfile

# 手动构建并查看详细输出
docker build -t vedaaide-js:latest . -v

# 清理旧镜像
docker system prune
```

---

## 🔌 API 相关

### Q13: API 有哪些端点？

**A:** 三个核心端点：

| 端点          | 方法 | 用途     |
| ------------- | ---- | -------- |
| `/api/health` | GET  | 健康检查 |
| `/api/ingest` | POST | 摄入文档 |
| `/api/query`  | POST | 查询 RAG |

**详细请求示例**：见 [README.md](./README.md#-api-端点)

### Q14: 如何测试 API？

**A:** 使用 `curl`：

```bash
# 1. 健康检查
curl http://localhost:3000/api/health

# 2. 摄入文档
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "测试内容",
    "source": "test-doc"
  }'

# 3. 查询
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "这是什么？"}'
```

**或用 Postman/Insomnia 图形工具**

### Q15: API 返回错误怎么办？

**A:** 检查错误类型：

| 错误               | 原因                | 解决方案                      |
| ------------------ | ------------------- | ----------------------------- |
| `EMBEDDING_ERROR`  | Ollama 离线         | 启动 Ollama（`ollama serve`） |
| `DATABASE_ERROR`   | 数据库未初始化      | 运行 `npm run db:migrate`     |
| `VALIDATION_ERROR` | 请求 JSON 无效      | 检查 JSON 格式                |
| `CHAT_ERROR`       | Ollama 聊天模型失败 | 检查模型是否已拉取            |

### Q16: API 响应很慢怎么办？

**A:** 定位性能瓶颈：

```bash
# 1. 检查 Ollama 是否响应缓慢
time curl http://localhost:11434/api/tags

# 2. 检查数据库查询
npm run db:studio  # 查看数据库大小

# 3. 查看日志（启用调试）
LOG_LEVEL=debug npm run dev
```

**常见原因：**

- Ollama 模型首次加载很慢（正常）
- 向量搜索在大数据集中可能慢（考虑添加索引）

---

## 💾 数据库相关

### Q17: 如何查看数据库中的数据？

**A:** 使用 Prisma Studio：

```bash
npm run db:studio
# 打开 http://localhost:5555
```

在 Web UI 中可以：

- 查看表中的所有记录
- 添加/编辑/删除数据
- 查看表大小

### Q18: 数据库被锁定了怎么办？

**A:** SQLite 锁定的解决方案：

```bash
# 1. 停止所有 Node 进程
# Windows: 使用任务管理器或
taskkill /F /IM node.exe

# 2. 删除旧数据库
rm dev.db

# 3. 重新初始化
npm run db:migrate

# 4. 重启 API
npm run dev
```

### Q19: 如何导出数据？

**A:**

```bash
# SQLite 导出为 CSV
# 需要 SQLite CLI
sqlite3 dev.db

# 在 SQLite 提示符中
.mode csv
.output data.csv
SELECT * FROM VectorChunk;
.quit
```

### Q20: 可以使用其他数据库吗？

**A:** 可以，但需要修改代码。当前支持：

- **默认**：SQLite（开发+演示）
- **计划**：Cosmos DB（见 `src/lib/services/cosmos-db.connector.ts`）
- **其他**：需要修改 Prisma schema

---

## 🔑 环境变量相关

### Q21: .env.local 中各个变量是什么意思？

**A:** 完整说明见 `.env.example`，快速参考：

```env
# 基础
NODE_ENV=development              # 环境: development | production
DEPLOYMENT_MODE=false             # Azure: true=Managed Identity

# 数据库
DATABASE_URL=file:./dev.db        # SQLite 文件路径

# Ollama（本地开发）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2

# Azure（可选）
AZURE_OPENAI_ENDPOINT=...         # Azure OpenAI 端点
AZURE_OPENAI_API_KEY=...          # API 密钥
# ... 等等
```

### Q22: 我可以改变 Ollama 模型吗？

**A:** 可以，需要：

1. **在 `.env.local` 中更改**：

```env
OLLAMA_EMBEDDING_MODEL=nomic-embed-text  # 改为其他模型
OLLAMA_CHAT_MODEL=llama3.2               # 改为其他模型
```

2. **拉取新模型**：

```bash
ollama pull YOUR_MODEL_NAME
```

3. **重启 API**：

```bash
npm run dev
```

**常用模型：**

- 嵌入：`nomic-embed-text`, `bge-large`, `jina-embeddings-v2-base-en`
- 聊天：`llama3.2`, `mistral`, `neural-chat`, `dolphin-mixtral`

### Q23: 环境变量没有被加载怎么办？

**A:**

```bash
# 1. 检查 .env.local 是否存在
test -f .env.local && echo "exists" || echo "missing"

# 2. 检查格式是否正确（无空格）
cat .env.local

# 3. 重新复制
cp .env.example .env.local

# 4. 重启应用
npm run dev
```

---

## 🛠️ 开发工具相关

### Q24: VS Code 有推荐的扩展吗？

**A:** 见 `.vscode/extensions.json`，关键扩展：

- **Prisma** - Database schema 高亮
- **ESLint** - 代码风格检查
- **Prettier** - 代码格式化
- **Thunder Client** / **REST Client** - API 测试

一键安装：

```bash
# VS Code 会提示安装建议的扩展
```

### Q25: 如何格式化代码？

**A:** 三种方式：

```bash
# 1. 自动格式化所有文件
npm run format

# 2. 检查格式是否正确（不修改）
npm run format:check

# 3. VS Code 中：
# 按 Alt+Shift+F（或 Cmd+Shift+P > Format Document）
```

### Q26: ESLint 告诉我有错误怎么办？

**A:**

```bash
# 查看具体错误
npm run lint

# 自动修复（如果可能）
npm run lint -- --fix

# 修复特定文件
npx eslint src/lib/services/rag.service.ts --fix
```

---

## 📝 文档相关

### Q27: 项目文档在哪里？

**A:** 四份文档：

| 文档               | 用途         | 位置   |
| ------------------ | ------------ | ------ |
| **README.md**      | 完整使用指南 | 根目录 |
| **QUICK_START.md** | 快速参考卡   | 根目录 |
| **TESTING.md**     | 详细测试指南 | 根目录 |
| **此 FAQ**         | 常见问题解答 | 根目录 |

### Q28: 如何贡献文档修改？

**A:**

Edit → git add → git commit → git push

```bash
# 编辑文档
nano README.md

# 提交更改
git add README.md
git commit -m "(docs) update README"
git push origin feature/branch-name
```

---

## 🎯 业务逻辑相关

### Q29: RAG 的工作流是什么？

**A:** 两个阶段：

**摄入阶段 (Ingest)**:

```
文档 → 分块 → 向量化 → 存储到数据库
```

**查询阶段 (Query)**:

```
问题 → 向量化 → 相似度搜索 → LLM 生成答案
```

详见 [README.md - RAG 定义](./README.md)

### Q30: 为什么查询返回的答案不准确？

**A:** 常见原因：

1. **文档不完整** - 摄入的源文档内容不足
   - 解决：摄入更多相关文档

2. **分块大小不合适** - 分块太小或太大
   - 查看：`src/lib/services/chunking.service.ts`
   - 调整：块大小、重叠参数

3. **向量相似度阈值** - topK 设置过小
   - 增加：`topK` 从 5 → 10

4. **模型质量** - Ollama 模型太小
   - 尝试：更大的模型（如 `llama3` 而非 `llama3.2`）

```bash
# 调试：查看搜索到的相似向量
npm run db:studio
# 进入 VectorChunk 表，查看 similarity score
```

---

## 🚨 错误排查

### Q31: "Failed to connect to Ollama" 错误

**A:**

```bash
# 1. 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 2. 检查 URL 是否正确
cat .env.local | grep OLLAMA_BASE_URL

# 3. 启动 Ollama（如未运行）
ollama serve

# 4. 用 Docker 启动
docker run -d -p 11434:11434 ollama/ollama
```

### Q32: "EADDRINUSE: address already in use :::3000"

**A:**

```bash
# Windows: 查看占用 3000 端口的进程
netstat -ano | findstr :3000

# 改用其他端口
PORT=3001 npm run dev

# 或者杀死占用进程
# Windows: taskkill /PID <PID> /F
# macOS/Linux: kill -9 <PID>
```

### Q33: TypeScript 报错 "Object is of type 'unknown'"

**A:**

```bash
# 1. 项目使用 strict 模式（这是好的！）

# 2. 修复：使用类型守卫或转换
// 错误
const value: any;

// 正确
const value: unknown;
if (typeof value === 'string') {
  console.log(value.toUpperCase());
}

# 3. 运行类型检查
npm run type-check
```

---

## 💡 性能优化

### Q34: 如何加快向量搜索？

**A:**

```typescript
// 1. 减少 topK（搜索范围更小）
query({ question, topK: 3 }); // 不是 5 或 10

// 2. 添加元数据过滤
// 目前不支持，计划在 Phase 2

// 3. 增加分块大小（减少向量总数）
CHUNK_SIZE: 500; // 从 300 增加
```

### Q35: 如何减少摄入时间？

**A:**

```typescript
// 批量摄入而不是单个？
// 需要编写自定义脚本

// 或者：并行摄入（小心，可能导致竞争条件）
Promise.all([ingest(doc1), ingest(doc2), ingest(doc3)]);
```

---

## 🎓 学习资源

### Q36: 我想学习 RAG 概念

**A:** 推荐资源：

- [LangChain 官方文档](https://python.langchain.com/docs/modules/data_connection/)
- [向量数据库介绍](https://weaviate.io/blog/what-is-a-vector-database)
- [本项目设计文档](./docs/designs/)

### Q37: 如何从这个项目学习代码？

**A:** 建议路径：

1. **理解结构** → 读 `README.md`
2. **快速尝试** → 按 `QUICK_START.md` 运行
3. **深入测试** → 读 `TESTING.md` 了解工作方式
4. **学习代码** → 查看 `src/lib/services/`
5. **修改代码** → 在监视模式测试 (`npm run test:watch`)

---

## 🤔 其他问题

### Q38: 我可以在生产环境部署吗？

**A:** Phase 1 是 PoC，但可以用作基础：

**需要的部分：**

- ✅ 后端 API 代码
- ✅ 错误处理
- ✅ 日志记录
- ✅ Docker 配置

**需要增加的部分：**

- ❌ 前端 UI（Phase 2）
- ❌ 认证/授权（计划）
- ❌ API 限流（计划）
- ❌ 监控/告警（计划）
- ❌ 完整测试套件（进行中）

详见 [Phase Plan](./docs/migrations/).

### Q39: 能否修改 RAG 流程？

**A:** 完全可以，修改 `src/lib/services/rag.service.ts`：

```typescript
// 例如：改变提示词
const prompt = `你是一个专业翻译官...`

// 或改变搜索策略
const results = await vectorStore.similaritySearch(embedded, topK: 10)

// 或使用不同的模型
const answer = await azureOpenAIChat.chat(...)
```

---

## 📞 没找到答案？

1. 检查 **README.md** 的故障排查部分
2. 查看 **TESTING.md** 了解测试细节
3. 运行验证脚本：`bash verify-setup.sh`
4. 查看代码注释
5. 查看 GitHub Issues（如有）

---

**最后更新**: 2026-04-07
**FAQ 版本**: 1.0
