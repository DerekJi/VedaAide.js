# 常见问题

## 问：它在没有 Azure 的情况下可以工作吗？

可以的。应用完全在本地运行，使用 [Ollama](https://ollama.ai/) 进行嵌入和聊天。Azure 服务是可选的，仅在生产部署时需要。

## 问：需要哪些 Ollama 模型？

- **嵌入：** `nomic-embed-text`（使用 `ollama pull nomic-embed-text` 拉取）
- **聊天：** `llama3.2`（使用 `ollama pull llama3.2` 拉取）

任何 Ollama 兼容的嵌入或聊天模型可通过 `OLLAMA_EMBEDDING_MODEL` 和 `OLLAMA_CHAT_MODEL` 环境变量配置。

## 问：我如何向知识库添加新文档？

POST 到 `/api/ingest`：

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"my-doc.md","content":"<文档文本放在这里>"}'
```

或使用 Web UI 在 `http://localhost:3000`。

## 问：测试失败，出现 `DATABASE_URL not found`

这发生在 `SqliteVectorStore` 尝试创建 Prisma 客户端但未设置 `DATABASE_URL` 时。请确保：

1. 您有一个 `.env` 文件，其中 `DATABASE_URL=file:./dev.db`
2. 对于测试，检查是否设置了 `NODE_ENV=test`（测试使用内存模拟，而不是真实数据库）

## 问：Prisma 客户端未生成

运行：

```bash
npm run db:generate
# 或者直接
npm ci  # postinstall 钩子会自动生成
```

## 问：API 文档在哪里？

见 [docs/reference/agent-protocol.md](agent-protocol.md) 了解代理协议。REST API 端点为：

| 端点           | 方法 | 说明           |
| -------------- | ---- | -------------- |
| `/api/health`  | GET  | 健康检查       |
| `/api/prompts` | GET  | 列出提示模板   |
| `/api/prompts` | POST | 创建提示模板   |
| `/api/ingest`  | GET  | 列出吸收的文件 |
| `/api/ingest`  | POST | 吸收文档       |
| `/api/query`   | POST | 查询知识库     |
