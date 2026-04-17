# 故障排除指南

## 常见问题

### 1. "the worker has exited" 或 "Cannot connect to Ollama" 错误

**症状**：

- 前端发送请求后收到 500 错误
- 错误信息：`Cannot connect to Ollama at http://localhost:11434`
- 日志中出现连接被拒绝的错误

**原因**：
Ollama 服务没有运行或无法访问

**解决方案**：

#### 方案 A：使用 Docker Compose（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 检查服务状态
docker-compose ps

# 查看 Ollama 日志
docker-compose logs ollama

# 停止服务
docker-compose down
```

#### 方案 B：本地运行 Ollama

**步骤 1：安装 Ollama**

- Windows/macOS: 访问 https://ollama.ai/download
- Linux:
  ```bash
  curl -fsSL https://ollama.ai/install.sh | sh
  ```

**步骤 2：启动 Ollama 服务**

```bash
ollama serve
```

**步骤 3：拉取所需模型**

在新的终端窗口中：

```bash
# 拉取聊天模型
ollama pull qwen:7b-chat

# 拉取嵌入模型
ollama pull bge-m3
```

**步骤 4：验证 Ollama 正在运行**

```bash
# 在浏览器中访问或使用 curl
curl http://localhost:11434/api/tags

# 预期响应：
# {"models":[{"name":"qwen:7b-chat:latest",...},{"name":"bge-m3:latest",...}]}
```

**步骤 5：启动 Next.js 开发服务器**

```bash
npm run dev
```

### 2. 模型加载缓慢

**症状**：

- 首次请求响应时间很长（可能 30-60 秒）
- 后续请求速度正常

**原因**：
模型第一次从磁盘加载到内存需要时间

**解决方案**：

- 这是正常的，请耐心等待
- 模型会保留在内存中以加快后续请求
- 如果系统内存不足，可能导致交换，请关闭其他应用

### 3. 模型内存不足错误

**症状**：

- 错误：`out of memory`
- 错误：`cannot allocate memory`

**原因**：
系统 RAM 不足以运行选定的模型

**解决方案**：

```bash
# 查看可用的轻量级模型
ollama list

# 推荐的轻量级模型：
ollama pull phi              # ~2GB
ollama pull mistral          # ~4GB
ollama pull neural-chat      # ~4GB

# 更新 .env.local
OLLAMA_CHAT_MODEL=phi
```

### 4. 特定模型无法使用

**症状**：

- 错误：`model not found: qwen:7b-chat`
- 或其他模型相关的错误

**原因**：
模型未被拉取或拼写错误

**解决方案**：

```bash
# 列出所有可用模型
ollama list

# 拉取缺失的模型
ollama pull qwen:7b-chat
ollama pull bge-m3

# 或从 ollama.ai 浏览可用模型
# https://ollama.ai/library
```

### 5. Docker 提示端口已占用

**症状**：

- 错误：`Bind for 0.0.0.0:11434 failed: port is already allocated`
- 或 `Error: listen EADDRINUSE :::3000`

**原因**：
端口被其他应用占用

**解决方案**：

```bash
# 杀死占用端口的进程
# Windows
netstat -ano | findstr :11434
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :11434
kill -9 <PID>

# 或使用不同的端口
# 编辑 docker-compose.yml，更改:
# ports:
#   - "11435:11434"  # 使用 11435 而不是 11434
```

## 诊断步骤

### 1. 验证环境配置

```bash
# 检查 .env.local 文件
cat .env.local

# 预期内容：
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_CHAT_MODEL=qwen:7b-chat
# OLLAMA_EMBEDDING_MODEL=bge-m3
```

### 2. 测试 Ollama 连接

```bash
# 使用 curl 测试连接
curl http://localhost:11434/api/tags

# 预期响应（200 OK）：
# {"models":[...]}

# 如果超时或连接被拒绝，说明 Ollama 没有运行
```

### 3. 检查模型是否加载

```bash
# 列出已拉取的模型
ollama list

# 预期输出包括：
# qwen:7b-chat:latest       ...
# bge-m3:...  ...
```

### 4. 查看应用日志

```bash
# 如果使用 Docker Compose
docker-compose logs -f app
docker-compose logs -f ollama

# 如果本地运行
# Next.js 输出会在控制台显示
# Ollama 输出会在 ollama serve 的终端显示
```

## 性能优化

### 1. 减少模型加载时间

```bash
# 预先将模型加载到内存（在 Ollama 启动后）
curl http://localhost:11434/api/generate \
  -d '{"model":"qwen:7b-chat","prompt":"","stream":false}'

curl http://localhost:11434/api/embed \
  -d '{"model":"bge-m3","input":""}'
```

### 2. 选择更小的模型组合

```env
# 快速但精度较低
OLLAMA_CHAT_MODEL=phi
OLLAMA_EMBEDDING_MODEL=all-minilm

# 平衡
OLLAMA_CHAT_MODEL=neural-chat
OLLAMA_EMBEDDING_MODEL=bge-m3

# 高精度但较慢
OLLAMA_CHAT_MODEL=qwen:7b-chat
OLLAMA_EMBEDDING_MODEL=bge-m3
```

## 获取帮助

- 查看 [快速开始指南](./guides/QUICK_START.cn.md)
- 查看 Ollama 官方文档：https://ollama.ai
- 查看项目 [README.cn.md](../README.cn.md)

---

**最后更新**：2026 年 4 月
