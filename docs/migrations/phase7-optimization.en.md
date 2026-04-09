# Phase 7 Implementation Plan: Retrieval Optimization & Advanced Features

> **Duration**: 2 weeks | **Branch**: `feature/7-optimization`  
> **Prerequisites**: Phase 5 & 6 (stable gates passed)  
> **Status**: Final phase (production-ready)

## Overview

Phase 7 focuses on retrieval quality, caching efficiency, and advanced LLM capabilities. These are performance/quality optimizations that don't block core functionality.

### Core Epics

| Epic                            | Tasks   | Scope                               |
| ------------------------------- | ------- | ----------------------------------- |
| LLM Router & Hybrid Retrieval   | T18-T19 | Multi-model support, keyword fusion |
| Semantic Cache                  | T20     | Query deduplication, performance    |
| Personal Vocabulary Enhancement | T25     | User-specific term boosting         |

**Total**: 5 tasks | **Target**: Production readiness, >80% test coverage, performance benchmarks met

---

## Tasks

### Epic 8 — LLM Router & Hybrid Retrieval (T18–T19)

**T18: LLM Router (Multi-Model)**

- Implement `LlmRouterService`:

  ```typescript
  // src/lib/services/llm-router.service.ts
  export class LlmRouterService {
    constructor(
      private ollama: OllamaChatService,
      private azure: AzureOpenAIChatService,
      private deepseek?: DeepSeekChatService,
    ) {}

    resolve(mode: "simple" | "advanced"): IChatService {
      if (mode === "advanced" && this.deepseek?.isConfigured) {
        return this.deepseek; // DeepSeek if available
      }
      return this.ollama || this.azure; // Fallback to Simple
    }
  }
  ```

- Environment config:
  ```
  DEEPSEEK_API_KEY=...
  DEEPSEEK_BASE_URL=https://api.deepseek.com
  DEEPSEEK_MODEL=deepseek-chat
  ```
- Update API routes:
  - `POST /api/query/stream` accept `mode?: "simple" | "advanced"`
  - `POST /api/orchestrate/query` accept `mode?: ...`
  - Default: Simple mode
  - If Advanced requested but not configured: graceful fallback (no error)
- Acceptance:
  - DeepSeek endpoint called when configured and mode=advanced
  - Silent fallback if DeepSeek unavailable
  - Simple mode uses existing service

**T19: Hybrid Retrieval with RRF (Reciprocal Rank Fusion)**

- Implement `HybridRetriever`:

  ```typescript
  // src/lib/services/hybrid-retriever.service.ts
  export class HybridRetriever {
    async retrieve(
      query: string,
      embedding: number[],
      topK: number,
      options: { strategy: "rrf" | "weighted" },
    ) {
      // 1. Vector search
      const vectorResults = await this.vectorStore.search(embedding, topK * 4);

      // 2. Keyword search (FTS5)
      const keywordResults = await this.vectorStore.searchByKeywords(query, topK * 4);

      // 3. Fuse
      if (options.strategy === "rrf") {
        return this.fuseByRrf(vectorResults, keywordResults, topK);
      } else {
        return this.fuseByWeightedSum(vectorResults, keywordResults, topK);
      }
    }

    private fuseByRrf(vector, keyword, topK) {
      const k = 60; // Standard RRF constant
      const scores = new Map<string, number>();

      vector.forEach((item, idx) => {
        const score = 1 / (k + idx + 1);
        scores.set(item.id, (scores.get(item.id) || 0) + score);
      });
      keyword.forEach((item, idx) => {
        const score = 1 / (k + idx + 1);
        scores.set(item.id, (scores.get(item.id) || 0) + score);
      });

      return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK);
    }
  }
  ```

- Enable FTS5 in SQLite:
  ```sql
  CREATE VIRTUAL TABLE vector_chunks_fts USING fts5(
    id, documentName, content
  );
  ```
- Update `RagService.query()`:
  - Accept `retrievalMode?: "vector" | "keyword" | "hybrid"`
  - Route to appropriate retriever
  - Default: hybrid
- Acceptance:
  - Hybrid retrieval improves recall on keyword-heavy queries (≥ 10%)
  - RRF scores computed correctly
  - Keyword search works on configured SQLite

### Epic 8 (continued) — Semantic Cache (T20)

**T20: Semantic Cache**

- Implement `SemanticCacheService`:

  ```typescript
  // src/lib/services/semantic-cache.service.ts
  export class SemanticCacheService {
    async getCachedResult(
      question: string,
      embedding: number[],
      threshold: number = 0.95,
    ): Promise<CacheHit | null> {
      // Find embedding similarity > threshold
      const similar = await prisma.semanticCache.findMany({
        where: {
          // Vector similarity query (Postgres pgvector or SQLite approximation)
          embedding: { similarity: { gt: threshold } },
        },
      });

      return similar[0] || null;
    }

    async setCachedResult(
      question: string,
      embedding: number[],
      result: RagQueryResponse,
      ttlHours: number = 24,
    ) {
      const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
      return prisma.semanticCache.create({
        data: {
          question,
          embedding: JSON.stringify(embedding),
          result: JSON.stringify(result),
          createdAt: new Date(),
          expiresAt,
        },
      });
    }
  }
  ```

- Prisma schema:
  ```prisma
  model SemanticCache {
    id        String   @id @default(cuid())
    question  String   @db.Text
    embedding String   @db.Text  // JSON-stringified array
    result    String   @db.Text  // JSON-stringified RagQueryResponse
    createdAt DateTime @default(now())
    expiresAt DateTime
    hits      Int      @default(0)
  }
  ```
- Integrate into `RagService.query()`:

  ```typescript
  // Before RAG pipeline:
  const cached = await semanticCache.getCachedResult(question, embedding);
  if (cached) {
    logger.info("Cache hit");
    return cached.result;
  }

  // After RAG:
  await semanticCache.setCachedResult(question, embedding, result);
  return result;
  ```

- Admin cache management:
  - `DELETE /api/admin/cache` — clears all entries
  - `GET /api/admin/cache/stats` — hit rate, size, etc.
- Config:
  ```
  SEMANTIC_CACHE_ENABLED=true
  SEMANTIC_CACHE_TTL_HOURS=24
  SEMANTIC_CACHE_SIMILARITY_THRESHOLD=0.95
  ```
- Acceptance:
  - Identical/very similar questions hit cache
  - Cache prevents duplicate LLM calls
  - Hit rate > 30% in load testing
  - Admin can clear cache

### Epic 10 — Personal Vocabulary Enhancement (T25)

**T25: Personal Vocabulary Booster** (Low Priority)

- Implement `PersonalVocabularyService`:

  ```typescript
  // src/lib/services/personal-vocabulary.service.ts
  export class PersonalVocabularyService {
    async extractUserTerms(userId: string): Promise<string[]> {
      // Find all user's chunks, extract domain-specific terms
      const chunks = await prisma.vectorChunk.findMany({
        where: { ownerId: userId },
        select: { content: true },
      });

      const allText = chunks.map((c) => c.content).join(" ");
      return await this.nlp.extractNounPhrases(allText);
    }

    async boostQueryEmbedding(
      userId: string,
      question: string,
      embedding: number[],
    ): Promise<number[]> {
      // Get user's top terms
      const terms = await this.cachedTerms.get(userId);

      // If question mentions user terms, slightly increase embedding magnitude
      // (simple heuristic: scale up if term present)
      const hasTerm = terms.some((t) => question.includes(t));

      return hasTerm
        ? embedding.map((v) => v * 1.1) // 10% boost
        : embedding;
    }
  }
  ```

- Flow:
  - On first query from user: extract their vocabulary from ingested docs
  - Embed user terms in context
  - On query: check if question mentions user terms
  - If yes: boost query embedding by 10%
  - Re-retrieve with boosted embedding
- Acceptance:
  - User-specific jargon improves hit ranking
  - Boost is measurable in eval (A/B test optional)
  - No performance regression

---

## Performance Benchmarks (GO/NO-GO)

- **Retrieval speed**: Vector + hybrid search < 500ms (P95)
- **LLM latency**: Token streaming within 100ms (first token)
- **Cache hit rate**: > 30% in typical usage
- **Memory footprint**: Cache DB < 500MB (typical)
- **Throughput**: 100 concurrent users, 95% < 2.5s RAG query (P95)

---

## Test Coverage & Quality

- **Unit tests**: All services (mock LLM, DB)
- **Integration tests**: End-to-end retrieval (vector + keyword + hybrid)
- **Performance tests**: k6 load testing, cache hit rate tracking
- **Coverage target**: ≥ 80% overall (maintained from Phase 5/6)

---

## Dependencies

- **Phase 5 & 6**: Stable; user system, governance, demo library active
- **SQLite FTS5**: Already enabled in schema
- **Vector DB**: Existing `VectorStore` interface (PostgreSQL pgvector or SQLite approximation)
- **Upstash Redis**: Optional optimization for distributed cache (not required)

---

## Notes

- All features degrade gracefully:
  - DeepSeek unavailable → revert to simple
  - Hybrid retrieval unavailable → use vector-only
  - Cache unavailable → skip cache, run RAG
- Phase 7 is **final optimization layer**: production deployment follows successful GO
- No breaking changes to Phase 5/6 APIs
- Performance monitoring dashboard recommended for production (Datadog, etc.)

---

## Post-Phase-7 Roadmap

Once all phases complete:

- **Observability**: Tracing, metrics, dashboards
- **A/B testing infrastructure**: Evaluate retrieval strategies
- **Analytics**: Track user queries, feedback patterns, vocabulary trends
- **Fine-tuning**: Custom embeddings model trained on user data (optional)
- **Scaling**: Multi-region deployment, distributed caching (Upstash, Redis Cluster)
