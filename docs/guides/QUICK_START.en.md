# Quick Start

Fastest path to a running local instance (assumes Ollama and Node.js 22+ installed).

```bash
# 1. Clone and install
git clone https://github.com/DerekJi/VedaAide.js.git
cd VedaAide.js
npm ci

# 2. Set environment variables
cp .env.example .env
# Edit .env if needed — defaults work with Ollama running at localhost:11434

# 3. Pull Ollama models (first time only)
ollama pull nomic-embed-text
ollama pull llama3.2

# 4. Initialize database
npm run db:migrate

# 5. Start the dev server
npm run dev
# → http://localhost:3000
```

### Smoke-test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Ingest a document
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"test.md","content":"VedaAide is a RAG assistant."}'

# Query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is VedaAide?"}'
```

For the full setup guide including Docker, Azure, and troubleshooting, see [GETTING_STARTED.en.md](GETTING_STARTED.en.md).
