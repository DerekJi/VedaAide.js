# Troubleshooting Guide

## Common Issues

### 1. "the worker has exited" or "Cannot connect to Ollama" Error

**Symptoms**:

- Frontend request returns a 500 error
- Error message: `Cannot connect to Ollama at http://localhost:11434`
- Logs show connection refused errors

**Cause**:
Ollama service is not running or not accessible

**Solutions**:

#### Option A: Use Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View Ollama logs
docker-compose logs ollama

# Stop services
docker-compose down
```

#### Option B: Run Ollama Locally

**Step 1: Install Ollama**

- Windows/macOS: Visit https://ollama.ai/download
- Linux:
  ```bash
  curl -fsSL https://ollama.ai/install.sh | sh
  ```

**Step 2: Start Ollama Service**

```bash
ollama serve
```

**Step 3: Pull Required Models**

In a new terminal window:

```bash
# Pull chat model
ollama pull qwen:7b-chat

# Pull embedding model
ollama pull bge-m3
```

**Step 4: Verify Ollama is Running**

```bash
# Access in browser or use curl
curl http://localhost:11434/api/tags

# Expected response:
# {"models":[{"name":"qwen:7b-chat:latest",...},{"name":"bge-m3:latest",...}]}
```

**Step 5: Start Next.js Development Server**

```bash
npm run dev
```

### 2. Slow Model Loading

**Symptoms**:

- First request takes a long time (30-60 seconds)
- Subsequent requests are faster

**Cause**:
Models take time to load from disk to memory on first use

**Solution**:

- This is normal, please wait
- Models stay in memory to speed up subsequent requests
- If you run low on system memory, it may swap, close other applications

### 3. Out of Memory Errors

**Symptoms**:

- Error: `out of memory`
- Error: `cannot allocate memory`

**Cause**:
System RAM is insufficient to run the selected model

**Solution**:

```bash
# View available lightweight models
ollama list

# Recommended lightweight models:
ollama pull phi              # ~2GB
ollama pull mistral          # ~4GB
ollama pull neural-chat      # ~4GB

# Update .env.local
OLLAMA_CHAT_MODEL=phi
```

### 4. Specific Model Not Found

**Symptoms**:

- Error: `model not found: qwen:7b-chat`
- Or other model-related errors

**Cause**:
Model is not pulled or name is misspelled

**Solution**:

```bash
# List all available models
ollama list

# Pull missing models
ollama pull qwen:7b-chat
ollama pull bge-m3

# Or browse available models at ollama.ai
# https://ollama.ai/library
```

### 5. Docker Reports Port Already in Use

**Symptoms**:

- Error: `Bind for 0.0.0.0:11434 failed: port is already allocated`
- Or `Error: listen EADDRINUSE :::3000`

**Cause**:
Port is occupied by another application

**Solution**:

```bash
# Kill process using the port
# Windows
netstat -ano | findstr :11434
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :11434
kill -9 <PID>

# Or use a different port
# Edit docker-compose.yml, change:
# ports:
#   - "11435:11434"  # Use 11435 instead of 11434
```

## Diagnostic Steps

### 1. Verify Environment Configuration

```bash
# Check .env.local file
cat .env.local

# Expected content:
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_CHAT_MODEL=qwen:7b-chat
# OLLAMA_EMBEDDING_MODEL=bge-m3
```

### 2. Test Ollama Connection

```bash
# Test connection with curl
curl http://localhost:11434/api/tags

# Expected response (200 OK):
# {"models":[...]}

# If timeout or connection refused, Ollama is not running
```

### 3. Check if Models Are Loaded

```bash
# List pulled models
ollama list

# Expected output includes:
# qwen:7b-chat:latest       ...
# bge-m3:...  ...
```

### 4. Check Application Logs

```bash
# If using Docker Compose
docker-compose logs -f app
docker-compose logs -f ollama

# If running locally
# Next.js output will show in console
# Ollama output will show in ollama serve terminal
```

## Performance Optimization

### 1. Reduce Model Loading Time

```bash
# Pre-load models into memory (after Ollama starts)
curl http://localhost:11434/api/generate \
  -d '{"model":"qwen:7b-chat","prompt":"","stream":false}'

curl http://localhost:11434/api/embed \
  -d '{"model":"bge-m3","input":""}'
```

### 2. Choose Smaller Model Combinations

```env
# Fast but lower accuracy
OLLAMA_CHAT_MODEL=phi
OLLAMA_EMBEDDING_MODEL=all-minilm

# Balanced
OLLAMA_CHAT_MODEL=neural-chat
OLLAMA_EMBEDDING_MODEL=bge-m3

# High accuracy but slower
OLLAMA_CHAT_MODEL=qwen:7b-chat
OLLAMA_EMBEDDING_MODEL=bge-m3
```

## Get Help

- Check the [Quick Start Guide](./guides/QUICK_START.md)
- Visit Ollama official documentation: https://ollama.ai
- See project [README.md](../README.md)

---

**Last Updated**: April 2026
