# 🎯 VedaAide.js - 启动清单

按照这个清单快速启动项目。

---

## ✅ 启动前检查清单

```
□ Node.js v18+ 已安装
□ npm v10+ 已安装
□ Git 已安装
□ 项目代码已克隆/下载
□ Ollama 已安装（可选但推荐）
```

**检查命令：**

```bash
node --version      # 应显示 v18+
npm --version       # 应显示 10+
git --version       # 应显示 git 版本
```

---

## 🚀 首次启动（5分钟）

### 第1步：打开终端

```bash
# 进入项目目录
cd d:/source/VedaAide.js

# 或在 VS Code 中
# Ctrl+` 打开集成终端
```

### 第2步：安装依赖

```bash
npm install
```

**等待完成** (2-3 分钟)

**预期输出：**

```
npm notice it worked if it ends with ok
added 660 packages, and audited 661 packages in 3m12s
```

### 第3步：配置环境

```bash
# 复制环境模板
cp .env.example .env.local

# (保持默认值即可)
```

### 第4步：初始化数据库

```bash
npm run db:migrate
```

**预期输出：**

```
Environment variables loaded from .env.local
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db"

✔ Prisma Migrate to initialize the database...
✔ Database migrated...
```

### 第5步（可选）：启动 Ollama

**选项A：本地安装**

```bash
# 假设已安装 Ollama（https://ollama.ai）
ollama serve
```

**选项B：Docker**

```bash
docker run -d -p 11434:11434 ollama/ollama
```

**选项C：Docker Compose**

```bash
# 在新终端
docker compose up ollama
```

### 第6步：启动 API

```bash
npm run dev
```

**预期输出：**

```
  ▲ Next.js 15.3.0

  ✓ Ready in 2.1s
  - Local:        http://localhost:3000
```

### 第7步：验证运行

```bash
# 新开一个终端
curl http://localhost:3000/api/health | jq
```

**预期响应：**

```json
{
  "status": "healthy",
  "timestamp": "2026-04-07T...",
  "version": "0.1.0"
}
```

---

## 📋 日常工作命令

### 开发工作流

```bash
# 终端1：启动开发服务器（热重载）
npm run dev

# 终端2：监视测试（文件改动时自动测试）
npm run test:watch

# 终端3：查看数据库
npm run db:studio
```

### 代码检查与格式化

```bash
# 类型检查
npm run type-check

# 代码规范
npm run lint

# 自动格式化
npm run format
```

### 测试与构建

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

---

## 🧪 第一次测试 API

### 摄入文档

新开终端，运行：

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境。它允许开发者使用 JavaScript 编写服务器端应用程序。",
    "source": "nodejs-intro",
    "metadata": {
      "language": "zh-CN",
      "category": "technology"
    }
  }'
```

**预期响应（200 OK）：**

```json
{
  "success": true,
  "message": "Document ingested successfully",
  "fileId": "nodejs-intro",
  "chunksCreated": 1,
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 查询文档

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Node.js 是什么？",
    "topK": 5
  }'
```

**预期响应（200 OK）：**

```json
{
  "answer": "Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境。它允许开发者使用 JavaScript 编写服务器端应用程序。",
  "sources": [
    {
      "content": "Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境。它允许开发者使用 JavaScript 编写服务器端应用程序。",
      "source": "nodejs-intro",
      "similarity": 0.98
    }
  ],
  "traceId": "550e8400-e29b-41d4-a716-446655440001"
}
```

---

## 🛠️ 常见启动问题

### 问题1：npm install 失败

```bash
# 清理缓存
npm cache clean --force

# 重新安装
npm install
```

### 问题2：Ollama 连接失败

```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 如未运行，启动
ollama serve
```

### 问题3：数据库锁定

```bash
# 删除旧数据库
rm dev.db

# 重新初始化
npm run db:migrate
```

### 问题4：端口 3000 已占用

```bash
# 改用其他端口
PORT=3001 npm run dev
```

### 问题5：权限错误（WSL/Linux）

```bash
# 赋予脚本执行权限
chmod +x verify-setup.sh verify-setup.bat
```

---

## 📁 核心文件位置

| 文件     | 位置                              | 用途              |
| -------- | --------------------------------- | ----------------- |
| API 代码 | `src/app/api/`                    | 三个 REST 端点    |
| RAG 服务 | `src/lib/services/rag.service.ts` | 核心业务逻辑      |
| 数据库   | `dev.db`                          | SQLite 数据库文件 |
| 配置     | `.env.local`                      | 环境变量          |
| 测试     | `src/**/*.test.ts`                | 67 个单元测试     |

---

## 📊 项目状态速览

| 项目         | 状态      | 说明                    |
| ------------ | --------- | ----------------------- |
| **后端 API** | ✅ 完成   | Ingest + Query 端点     |
| **测试**     | ✅ 完成   | 67 个测试，67.4% 覆盖率 |
| **Docker**   | ✅ 完成   | 可容器化部署            |
| **文档**     | ✅ 完成   | README + 测试指南 + FAQ |
| **前端 UI**  | ⏳ 计划中 | Phase 2 项目            |

---

## 🎓 学习资源

### 快速学习（推荐顺序）

1. **README.md** - 5 分钟了解全貌
2. **QUICK_START.md** - 查看各种命令
3. **运行项目** - 10 分钟动手体验
4. **TESTING.md** - 了解测试用例
5. **FAQ.md** - 查找常见问题答案
6. **代码** - 查看 `src/lib/services/` 理解实现

### 相关概念

- **RAG (检索增强生成)** - 结合搜索和生成的 AI 技术
- **向量嵌入** - 将文本转换为数字向量用于相似度计算
- **Ollama** - 本地运行大型语言模型
- **Prisma** - TypeScript ORM 框架
- **SQLite** - 轻量级数据库

---

## 🚦 下一步

### 立即尝试

- [ ] 按照本清单启动项目
- [ ] 测试 `/api/health` 端点
- [ ] 摄入一个测试文档
- [ ] 查询 RAG 系统

### 深入学习

- [ ] 读完 README.md
- [ ] 运行所有测试 (`npm test`)
- [ ] 查看 TESTING.md 了解测试
- [ ] 阅读 FAQ.md 解答疑问
- [ ] 检查 `src/lib/services/` 理解代码

### 定制开发

- [ ] 修改 Ollama 模型配置
- [ ] 调整分块大小和策略
- [ ] 添加新的 API 端点
- [ ] 集成 Azure 服务（可选）

---

## 💡 快速技巧

### 同时看日志和开发

```bash
# 终端1：启动API带详细日志
LOG_LEVEL=debug npm run dev

# 终端2：在另一个窗口测试
curl -X POST http://localhost:3000/api/query ...
```

### 快速重置数据库

```bash
rm dev.db && npm run db:migrate
```

### 打开数据库管理 UI

```bash
npm run db:studio
# 浏览器自动打开 http://localhost:5555
```

### 检查所有命令

```bash
npm scripts
# 或查看 package.json scripts 部分
```

---

## 📞 遇到问题？

1. **快速检查** → 运行 `bash verify-setup.sh` 或 `verify-setup.bat`
2. **查阅文档** → 阅读 FAQ.md（39 个常见问题）
3. **查看日志** → 启用 `LOG_LEVEL=debug`
4. **搜索错误** → 在代码中查找错误类型
5. **重启一切** → 停止进程，删除 `dev.db`，重新启动

---

## ✨ 现在开始！

```bash
# 三行命令快速启动
npm install
npm run db:migrate
npm run dev

# 然后打开浏览器访问 http://localhost:3000
```

---

**祝你使用愉快！🚀**

最后更新: 2026-04-07
