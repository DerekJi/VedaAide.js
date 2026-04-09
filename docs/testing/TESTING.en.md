# Testing Guide

VedaAide.js uses [Vitest](https://vitest.dev/) for unit and integration tests, and [Playwright](https://playwright.dev/) for end-to-end tests.

---

## Test Suites

| Suite                    | Command                 | Description                                  |
| ------------------------ | ----------------------- | -------------------------------------------- |
| All (unit + integration) | `npm test`              | Runs all Vitest tests                        |
| With coverage            | `npm run test:coverage` | Generates `coverage/lcov.info`               |
| Watch mode               | `npm run test:watch`    | Re-runs on file changes                      |
| E2E (Playwright)         | `npm run test:e2e`      | Full browser tests (requires running server) |
| E2E (interactive)        | `npm run test:e2e:ui`   | Playwright UI mode                           |

---

## Running Unit & Integration Tests

No external services are required — all tests use mocked dependencies.

```bash
# Run all tests
npm test

# Run a single file
npx vitest run src/app/api/integration.test.ts

# Run with verbose output
npx vitest run --reporter verbose
```

### Environment in CI

The CI workflow sets:

```
NODE_ENV=test
DATABASE_URL=file:./test.db
```

These are picked up automatically; no `.env` file needed for tests.

---

## Test File Structure

```
src/
  lib/
    services/
      rag.service.test.ts          # RagService unit tests (ingest + query)
      langchain-rag.service.test.ts
      chunking.service.test.ts
      deduplication.service.test.ts
      hallucination-guard.service.test.ts
      prompt.service.test.ts
      ollama-embedding.service.test.ts
      ollama-chat.service.test.ts
    vector-store/
      sqlite-vector-store.test.ts
    agent/
      veda-agent.test.ts
    datasources/
      file-system.connector.test.ts
  app/
    api/
      integration.test.ts          # Integration tests for all API routes
```

---

## Integration Tests

`src/app/api/integration.test.ts` tests the full API route handlers in-process without a real database or Ollama.

**What is mocked:**

- `@/lib/db` — Prisma client (in-memory mock)
- `@/lib/vector-store/sqlite-vector-store` — SqliteVectorStore class
- `@/lib/services/ollama-embedding.service` — embedding service
- `@/lib/services/ollama-chat.service` — chat service
- `@/lib/services/prompt.service` — prompt service

**Endpoints tested:**
| Endpoint | Test cases |
|----------|-----------|
| `GET /api/health` | 200 with `{ status: "ok" }` |
| `GET /api/prompts` | 200 with array |
| `POST /api/prompts` | 201 created; 400 for invalid body |
| `GET /api/ingest` | 200 with array |
| `POST /api/query` | 200 with answer + sources; 400 for empty/missing question |

---

## Coverage

After running `npm run test:coverage`, open `coverage/index.html` in a browser to view the report.

**Phase 4 coverage thresholds (enforced in CI):**

| Metric     | Threshold |
| ---------- | --------- |
| Statements | ≥ 80%     |
| Functions  | ≥ 80%     |
| Branches   | ≥ 70%     |
| Lines      | ≥ 80%     |

Current status: **91%+ statements** (as of Phase 4).

CI uploads coverage to [Codecov](https://codecov.io/) automatically on every push.

---

## End-to-End Tests (Playwright)

E2E tests require the application to be running:

```bash
# Terminal 1: start the app
npm run dev

# Terminal 2: run E2E tests
npm run test:e2e
```

Or use the Playwright interactive UI:

```bash
npm run test:e2e:ui
```

**E2E test suites (25+ cases):**

| File                           | Coverage                                          |
| ------------------------------ | ------------------------------------------------- |
| `tests/e2e/chat.spec.ts`       | Chat interface, SSE streaming, Stop button        |
| `tests/e2e/ingest.spec.ts`     | File upload, ingest history table, sync           |
| `tests/e2e/navigation.spec.ts` | Sidebar nav, routing, mobile viewport, API health |

> **Note:** E2E tests also require Ollama running locally with models pulled.  
> See [GETTING_STARTED.en.md](../guides/GETTING_STARTED.en.md) for setup.

---

## Load Tests (k6)

Performance benchmarks use [k6](https://k6.io/):

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo apt-get install k6

# Run load test against local server
k6 run tests/load/rag-query.js

# Run against staging
k6 run tests/load/rag-query.js --env BASE_URL=https://vedaaide-staging.azurecontainerapps.io
```

**Thresholds:**

- P95 response time < 2500ms
- Error rate < 5%

---

## Writing New Tests

### Unit tests (service / library code)

- Co-locate test files: `src/lib/services/my.service.test.ts`
- Mock all I/O dependencies with `vi.mock()`
- Mock declarations must come **before** any `import` that triggers module initialization

### Integration tests (API routes)

- Add at `src/app/api/integration.test.ts`
- Use `NextRequest` directly to call route handlers
- Mock at the service boundary (embedding, chat, db)

### Mocking pattern for modules that have side effects at import time

```typescript
// MUST be before any import that transitively loads PrismaClient:
vi.mock("@/lib/db", () => ({
  prisma: {
    vectorChunk: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// Import AFTER mocks:
import { MyService } from "./my.service";
```
