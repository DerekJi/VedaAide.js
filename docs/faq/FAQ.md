# Frequently Asked Questions

## Q: Does it work without Azure?

Yes. The app runs entirely locally with [Ollama](https://ollama.ai/) for embeddings and chat. Azure services are optional and only needed for production deployments.

## Q: Which Ollama models are required?

- **Embedding:** `nomic-embed-text` (pull with `ollama pull nomic-embed-text`)
- **Chat:** `llama3.2` (pull with `ollama pull llama3.2`)

Any Ollama-compatible embedding or chat model can be configured via `OLLAMA_EMBEDDING_MODEL` and `OLLAMA_CHAT_MODEL` environment variables.

## Q: How do I add new documents to the knowledge base?

POST to `/api/ingest`:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"my-doc.md","content":"<document text here>"}'
```

Or use the web UI at `http://localhost:3000`.

## Q: The tests fail with `DATABASE_URL not found`

This happens when `SqliteVectorStore` tries to create a Prisma client without `DATABASE_URL` set. Make sure:

1. You have a `.env` file with `DATABASE_URL=file:./dev.db`
2. For tests, check that `NODE_ENV=test` is set (tests use in-memory mocks, not a real DB)

## Q: Prisma client is not generated

Run:

```bash
npm run db:generate
# or just
npm ci  # postinstall hook generates it automatically
```

## Q: Where are the API docs?

See [docs/reference/agent-protocol.md](agent-protocol.md) for the agent protocol. The REST API endpoints are:

| Endpoint       | Method | Description              |
| -------------- | ------ | ------------------------ |
| `/api/health`  | GET    | Health check             |
| `/api/prompts` | GET    | List prompt templates    |
| `/api/prompts` | POST   | Create prompt template   |
| `/api/ingest`  | GET    | List ingested files      |
| `/api/ingest`  | POST   | Ingest a document        |
| `/api/query`   | POST   | Query the knowledge base |
