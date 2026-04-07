# Phase 1 Implementation Plan: Infrastructure & Proof of Concept

> **Duration**: 1-2 weeks | **Prerequisites**: None | **Blocks**: Phase 2

## Executive Summary

Establish Next.js 15 + LangChain infrastructure and validate compatibility with all external dependencies (Ollama, Azure OpenAI, Cosmos DB, SQLite, Blob Storage).

**Scope Clarification**:
- ✅ Backend infrastructure + Minimal RAG workflow
- ✅ Three environment configurations (local dev, local test, production)
- ✅ CI/CD automation framework
- ❌ **No frontend development** (frontend dev in Phase 2 minimal UI + Phase 3)
- ❌ **No complete Agent orchestration** (only validate LangChain basics, Phase 2 completes it)

### GO/NO-GO Decision Criteria

| Criterion | Target | Verification Method |
|-----------|--------|---------------------|
| Project Build | Zero TypeScript errors | `npm run build` |
| Ollama Integration | Embedding + chat success | Unit tests |
| Database CRUD | Prisma operations work | Integration tests |
| Vector Search | Cosine similarity ≥80% | Manual testing |
| Azure Services | 3 services connected | Integration tests |
| Docker | Container starts | `docker compose up` |
| Test Coverage | ≥60% | Coverage report |

---

## Core Task Checklist (18 Tasks)

### Infrastructure Setup (T1-T5)

**T1: Next.js 15 Project Initialization**
- [ ] Create project with App Router
- [ ] TypeScript strict mode configuration
- [ ] ESLint + Prettier setup
- [ ] Directory structure: `src/app`, `src/lib`, `src/components`
- **Acceptance**: `npm run build` with zero errors

**T2: Prisma ORM Configuration**
- [ ] Install and initialize Prisma
- [ ] Design schema: `VectorChunk`, `PromptTemplate`, `SyncedFile`
- [ ] SQLite configuration (dev/prod both use SQLite)
- [ ] Generate initial migration
- **Acceptance**: `prisma migrate dev` succeeds

**T3: Environment Variable Management**
- [ ] Create `.env.example` template
- [ ] Define Zod validation schema
- [ ] Auto-validate on startup
- [ ] Type-safe env access
- **Acceptance**: Startup fails when required vars missing

**T4: Project Structure & Code Standards**
- [ ] Configure Git hooks (Husky + lint-staged)
- [ ] `.gitignore` includes `.env.local`
- [ ] VS Code recommended extensions
- **Acceptance**: Auto-format and lint on commit

**T5: Docker Compose Configuration**
- [ ] Define `app`, `ollama` services (SQLite in container)
- [ ] Volume mounts configuration for persistent SQLite
- [ ] Health check setup
- **Acceptance**: `docker compose up` one-command startup

---

### Ollama Integration (T6-T8)

**T6: Embedding Service Implementation**
```typescript
// src/lib/services/embedding.service.ts
export interface IEmbeddingService {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}
```
- [ ] `OllamaEmbeddingService` class implementation
- [ ] Batch embedding support
- [ ] Error handling (connection failure, timeout)
- [ ] Unit tests >80% coverage
- **Acceptance**: Integration test connects real Ollama

**T7: Chat Service Implementation**
- [ ] `OllamaChatService` sync response
- [ ] Streaming response (AsyncIterator)
- [ ] System prompt configuration
- [ ] Unit + integration tests
- **Acceptance**: Streaming outputs word-by-word

**T8: Vector Store Abstraction**
```typescript
export interface IVectorStore {
  addDocuments(docs: VectorDocument[]): Promise<void>;
  similaritySearch(query: number[], topK: number): Promise<VectorSearchResult[]>;
}
```
- [ ] Interface definition
- [ ] SQLite implementation (app-level cosine similarity)
- [ ] Metadata filtering support
- **Acceptance**: Similarity search returns correct ordering

---

### Minimal RAG Workflow (T9-T12)

**T9: Document Chunking Service**
- [ ] Fixed-size chunking (with overlap)
- [ ] Recursive splitting (paragraph/sentence)
- [ ] Token counting (tiktoken)
- [ ] Markdown-aware chunking
- **Acceptance**: Unit tests cover edge cases

**T10: Ingestion Pipeline**
```
Text → Chunk → Embed → Dedupe(simplified) → Store
```
- [ ] `RagService.ingest()` method
- [ ] REST API: `POST /api/ingest`
- [ ] Request/response type definitions
- **Acceptance**: E2E test ingests document successfully

**T11: Query Pipeline**
```
Question → Embed → Retrieve topK → Build prompt → LLM generate → Return
```
- [ ] `RagService.query()` method
- [ ] REST API: `POST /api/query`
- [ ] Return answer + sources
- **Acceptance**: E2E test returns relevant answer

**T12: Type Definitions**
```typescript
export interface RagQueryRequest {
  question: string;
  topK?: number;
}

export interface RagQueryResult {
  answer: string;
  sources: VectorSearchResult[];
  isHallucination: boolean;  // Implemented in Phase 2
}
```
- [ ] Core domain model types
- [ ] API request/response types
- [ ] Disable `any` type
- **Acceptance**: `npm run type-check` passes

---

### Azure Services Integration (T13-T15, Optional)

**T13: Azure OpenAI Integration**
- [ ] `AzureOpenAIChatService` implementation
- [ ] Implements `IChatService` interface
- [ ] Auto-fallback to Ollama
- **Acceptance**: Integration test verifies Azure connection

**T14: Cosmos DB Compatibility Test**
- [ ] `@azure/cosmos` SDK installation
- [ ] CRUD operations verification
- [ ] Performance benchmarking
- **Acceptance**: Document migration path

**T15: Blob Storage Connector**
- [ ] List container files
- [ ] Download file content
- [ ] Error handling
- **Acceptance**: Integration test reads Blob file

---

### Quality Assurance (T16-T18)

**T16: Test Framework (Vitest)**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      lines: 60,
      functions: 60,
    },
  },
});
```
- [ ] Vitest configuration
- [ ] Mock tooling setup
- [ ] Coverage reporting
- **Acceptance**: `npm run test:coverage` ≥60%

**T17: Error Handling & Logging**
- [ ] Custom error classes (`RagError`, `VectorStoreError`)
- [ ] Structured logging (pino)
- [ ] Sensitive info filtering
- **Acceptance**: Logs include trace ID

**T18: CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    - TypeScript type check
    - ESLint
    - Vitest (coverage ≥60%)
    - Docker build test
```
- [ ] GitHub Actions configuration
- [ ] Run tests on every push
- [ ] Upload coverage to Codecov
- **Acceptance**: All PR checks pass

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ollama local connection failure (dev-only) | Medium | Low | Azure OpenAI fallback or use Mode 2 (local Azure testing) |
| sqlite-vec performance issues | Medium | Low | Monitor vector search performance |
| Type safety coverage gaps | Medium | Medium | Strict tsconfig + CI checks |

**Note**: Ollama is used only in local development (Mode 1) and not deployed, therefore no production risk.

---

## Timeline

```
Week 1:
  Day 1-2: T1-T5 (Infrastructure)
  Day 3-4: T6-T8 (Ollama integration)
  Day 5:   T9-T11 (RAG workflow)

Week 2:
  Day 1:   T12 (Type definitions)
  Day 2:   T13-T15 (Azure services, optional)
  Day 3-4: T16-T18 (Quality assurance)
  Day 5:   Acceptance testing & documentation
```

---

## GitHub Issue Template

```markdown
# [Phase 1] Infrastructure & PoC

## 🎯 Goal
Validate Next.js + LangChain + all external dependency compatibility

## ✅ Task Checklist
- [ ] T1-T5: Infrastructure setup
- [ ] T6-T8: Ollama integration
- [ ] T9-T12: Minimal RAG workflow
- [ ] T13-T15: Azure services (optional)
- [ ] T16-T18: Quality assurance

## 📊 Definition of Done
- [x] All GO/NO-GO tests pass (7/7)
- [x] Test coverage ≥ 60%
- [x] Docker Compose one-command startup
- [x] E2E RAG demo functional

## 🔗 Related Docs
- [Feasibility Analysis](./feasibility-analysis.en.md)
- [Phase 2 Plan](./phase2-plan.en.md)

## 👥 Assigned: @ai-developer @fullstack-engineer
```

---

**Document Maintainer**: VedaAide Migration Team | **Next Step**: [Phase 2 Plan](./phase2-plan.en.md)
