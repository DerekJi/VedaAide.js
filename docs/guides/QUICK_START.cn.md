# 快速开始

假设已安装 Ollama 和 Node.js 22+，快速启动本地实例。

```bash
# 1. 克隆并安装
git clone https://github.com/DerekJi/VedaAide.js.git
cd VedaAide.js
npm ci

# 2. 设置环境变量
cp .env.example .env
# 如需修改 .env — 默认配置支持本地 Ollama (localhost:11434)

# 3. 拉取 Ollama 模型 (首次需要)
ollama pull bge-m3
ollama pull qwen:7b-chat

# 4. 初始化数据库
npm run db:migrate

# 5. 启动开发服务器
npm run dev
# → http://localhost:3000
```

### API 冒烟测试

```bash
# 健康检查
curl http://localhost:3000/api/health

# 摄入文档
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"test.md","content":"VedaAide 是一个 RAG 助手。"}'

# 查询
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"VedaAide 是什么？"}'
```

完整安装指南包括 Docker、Azure 和故障排除，见 [GETTING_STARTED.cn.md](GETTING_STARTED.cn.md)。
