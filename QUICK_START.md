# 🚀 VedaAide.js 快速参考

快速查看所有常用命令。

## 🎯 第一次运行（3分钟快速启动）

```bash
# 1. 进入项目目录
cd d:/source/VedaAide.js

# 2. 安装依赖
npm install

# 3. 配置环境（使用默认配置）
cp .env.example .env.local

# 4. 初始化数据库
npm run db:migrate

# 5. 启动 Ollama（新终端）
ollama serve

# 6. 启动 API（新终端）
npm run dev

# 7. 验证运行（新终端）
curl http://localhost:3000/api/health
```

---

## 📋 开发命令

### 启动服务

```bash
npm run dev              # 热重载开发服务器 (端口 3000)
npm run build           # 生产构建
npm start               # 启动生产服务器
```

### 数据库

```bash
npm run db:migrate      # 运行迁移 (创建表)
npm run db:studio       # 打开 Prisma Studio (Web UI)
npm run db:generate     # 生成 Prisma Client
```

### 代码质量

```bash
npm run type-check      # TypeScript 类型检查
npm run lint            # ESLint 检查
npm run format          # 用 Prettier 格式化代码
```

---

## 🧪 测试命令

```bash
npm test                # 运行所有测试
npm run test:watch      # 监视模式（文件改动时自动测试）
npm run test:coverage   # 生成覆盖率报告 (目标: ≥60%)
```

### 运行特定测试

```bash
npm test src/lib/errors.test.ts                    # 错误处理
npm test src/lib/vector-store/cosine-similarity    # 向量相似度
npm test src/lib/services/chunking.service         # 文档分块
npm test src/lib/services/rag.service              # RAG 管道
```

---

## 🐳 Docker 命令

```bash
# 启动完整栈（Ollama + API）
docker compose up

# 后台运行
docker compose up -d

# 查看日志
docker compose logs -f api

# 停止
docker compose down

# 清理（包含数据库）
docker compose down -v
```

---

## 🧮 API 端点

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 摄入文档

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "测试文档内容",
    "source": "test-doc",
    "metadata": { "author": "test" }
  }'
```

### 查询

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "文档讲的是什么？",
    "topK": 5
  }'
```

---

## 🔧 环境变量

| 变量                     | 默认值                 | 说明                                 |
| ------------------------ | ---------------------- | ------------------------------------ |
| `NODE_ENV`               | development            | 环境模式                             |
| `DEPLOYMENT_MODE`        | false                  | false=API密钥, true=Managed Identity |
| `DATABASE_URL`           | file:./dev.db          | SQLite 数据库路径                    |
| `OLLAMA_BASE_URL`        | http://localhost:11434 | Ollama 服务地址                      |
| `OLLAMA_EMBEDDING_MODEL` | nomic-embed-text       | 嵌入模型                             |
| `OLLAMA_CHAT_MODEL`      | llama3.2               | 聊天模型                             |

更多: 见 `.env.example`

---

## 📊 测试统计

- **单元测试**：67 个 (全部通过 ✅)
- **覆盖率**：67.4% (目标 ≥60%)
- **执行时间**：~1 秒

---

## 🐛 常见问题快速修复

| 问题             | 命令                                   |
| ---------------- | -------------------------------------- |
| Ollama 连接失败  | `curl http://localhost:11434/api/tags` |
| 数据库锁定       | `rm dev.db && npm run db:migrate`      |
| TypeScript 错误  | `npm run type-check && npm run format` |
| 端口 3000 被占用 | `PORT=3001 npm run dev`                |
| 依赖问题         | `rm -rf node_modules && npm install`   |

---

## 📚 详细文档

- **README.md** - 完整使用指南
- **TESTING.md** - 详细测试指南 (67 个测试场景)
- **.env.example** - 所有环境变量说明

---

## 🎯 项目结构速查

```
src/
├── app/
│   └── api/              # REST API 端点
├── lib/
│   ├── services/         # 核心业务逻辑 (RAG, 嵌入, 聊天)
│   ├── vector-store/     # 向量存储实现
│   ├── env.ts            # 环境配置
│   ├── errors.ts         # 错误类
│   ├── logger.ts         # 日志
│   └── types.ts          # 类型定义
└── prisma/
    └── schema.prisma     # 数据库 schema
```

---

## 💡 快捷技巧

### 同时监视代码和测试

```bash
# 终端1
npm run test:watch

# 终端2
npm run dev
```

### 快速格式化代码

```bash
npm run format
```

### 查看详细覆盖率

```bash
npm run test:coverage
# 打开 coverage/index.html (浏览器查看)
```

### 调试错误

```bash
# 查看完整错误堆栈
LOG_LEVEL=debug npm run dev
```

---

## 🚦 检查项清单

运行前检查：

- [ ] Node.js v18+ 已安装 (`node --version`)
- [ ] npm v10+ 已安装 (`npm --version`)
- [ ] Ollama 已运行/已启动 (`curl http://localhost:11434/api/tags`)
- [ ] 依赖已安装 (`npm install`)
- [ ] 数据库已初始化 (`npm run db:migrate`)
- [ ] `.env.local` 已创建 (`cp .env.example .env.local`)

---

## 📞 需要帮助？

1. 查看 **README.md** 获取完整指南
2. 查看 **TESTING.md** 获取测试详情
3. 检查 **GitHub Issues** (D:\source\VedaAide.js/.github/issues)
4. 运行 `npm run type-check && npm run lint` 检查代码

---

## ✅ Phase 1 完成情况

- ✅ Next.js 15 基础设施
- ✅ RAG 管道 (摄入 + 查询)
- ✅ Ollama 集成
- ✅ SQLite 向量存储
- ✅ 67 个单元测试 (67.4% 覆盖率)
- ✅ Docker 支持
- ✅ CI/CD 配置

**下一步**: Phase 2 前端 UI 开发 🎨

---

**最后更新**: 2026-04-07 | **版本**: 0.1.0
