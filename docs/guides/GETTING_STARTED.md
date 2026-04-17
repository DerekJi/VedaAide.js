# Getting Started

Complete guide for setting up VedaAide.js locally from scratch.

---

## Prerequisites

| Tool              | Version | Purpose                      |
| ----------------- | ------- | ---------------------------- |
| Node.js           | 22+     | Runtime                      |
| npm               | 10+     | Package manager              |
| Ollama            | Latest  | Local LLM & embedding engine |
| Git               | Any     | Source control               |
| Docker (optional) | Latest  | Container-based run          |

---

## 1. Clone & Install

```bash
git clone https://github.com/DerekJi/VedaAide.js.git
cd VedaAide.js
npm ci           # installs deps and auto-generates Prisma client via postinstall
```

> **Note:** `npm ci` automatically runs `prisma generate` via the `postinstall` hook — no manual step needed.

---

## 2. Configure Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

### Minimum required (local Ollama mode)

```dotenv
# SQLite database path
DATABASE_URL=file:./dev.db

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=bge-m3
OLLAMA_CHAT_MODEL=qwen:7b-chat

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Optional — Azure services (not required locally)

```dotenv
# Azure OpenAI (replaces Ollama for production)
AZURE_OPENAI_ENDPOINT=https://<name>.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Azure Cosmos DB (replaces SQLite vector store for production)
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_COSMOS_KEY=<key>
AZURE_COSMOS_DATABASE=vedaaide
AZURE_COSMOS_CONTAINER=vectors

# Azure Blob Storage (document source connector — see skipped-tasks.md)
AZURE_BLOB_ACCOUNT_NAME=<account>
AZURE_BLOB_ACCOUNT_KEY=<key>
AZURE_BLOB_CONTAINER_NAME=documents
```

---

## 3. Set Up Ollama (local LLM)

### Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: download from https://ollama.ai/download
```

### Pull required models

```bash
ollama pull bge-m3   # embedding model (~274 MB)
ollama pull qwen:7b-chat           # chat model (~2 GB)
```

### Verify Ollama is running

```bash
curl http://localhost:11434/api/tags
# Should return JSON with available models
```

---

## 4. Initialize the Database

```bash
npm run db:migrate     # creates dev.db and applies migrations
```

Or to inspect / seed the database visually:

```bash
npm run db:studio      # opens Prisma Studio at http://localhost:5555
```

---

## 5. Run the Development Server

```bash
npm run dev
# App starts at http://localhost:3000
```

### Verify the API is healthy

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

---

## 6. Ingest Documents

Use the REST API to ingest a document:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "readme.md",
    "content": "VedaAide is a RAG-based knowledge assistant..."
  }'
```

List ingested files:

```bash
curl http://localhost:3000/api/ingest
```

---

## 7. Query the Knowledge Base

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is VedaAide?"}'
```

Response shape:

```json
{
  "answer": "VedaAide is ...",
  "sources": [{ "id": "...", "content": "...", "score": 0.91 }],
  "isHallucination": false,
  "traceId": "rag-abc123"
}
```

---

## 8. Run via Docker (alternative)

If you want to avoid installing Ollama locally, you can use Docker Compose which starts both the app and Ollama:

```bash
docker compose up --build
# App: http://localhost:3000
# Ollama: http://localhost:11434
```

Pull models inside the Ollama container:

```bash
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull qwen:7b-chat
```

---

## Troubleshooting

| Symptom                           | Fix                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `PrismaClientInitializationError` | Run `npm run db:migrate` or check `DATABASE_URL` in `.env` |
| `Prisma client not generated`     | Run `npm run db:generate`                                  |
| `ECONNREFUSED 11434`              | Start Ollama: `ollama serve`                               |
| `model not found`                 | Run `ollama pull <model-name>`                             |
| TypeScript errors after pull      | Run `npm ci` to regenerate Prisma types                    |

---

## See Also

- [Quick Start](QUICK_START.md) — fast path for developers who know the stack
- [Testing Guide](../testing/TESTING.md) — unit, integration, and E2E tests
- [Deployment Guide](../reference/DEPLOYMENT.md) — cloud deployment on Azure
