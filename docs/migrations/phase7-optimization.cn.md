# Phase 7 实施计划：检索优化与高级功能

> **耗时**：2 周 | **分支**：`feature/7-optimization`  
> **前置条件**：第五、六阶段（稳定门控已通过）  
> **状态**：最终阶段（生产就绪）

## 概述

第七阶段专注于检索质量、缓存效率和先进的 LLM 能力。这些是性能/质量优化，不阻塞核心功能。

### 核心 Epic

| Epic               | 任务    | 范围                   |
| ------------------ | ------- | ---------------------- |
| LLM 路由与混合检索 | T18-T19 | 多模型支持、关键词融合 |
| 语义缓存           | T20     | 查询去重、性能优化     |
| 个人词汇增强       | T25     | 用户专属术语权重提升   |

**总计**：5 个任务 | **目标**：生产就绪、>80% 测试覆盖率、性能基准达成

---

## 任务详情

### Epic 8 — LLM 路由与混合检索（T18–T19）

**T18：LLM 路由（多模型）**

- 实现 `LlmRouterService`：

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
        return this.deepseek; // DeepSeek 如果可用
      }
      return this.ollama || this.azure; // 降级到 Simple
    }
  }
  ```

- 环境配置：
  ```
  DEEPSEEK_API_KEY=...
  DEEPSEEK_BASE_URL=https://api.deepseek.com
  DEEPSEEK_MODEL=deepseek-chat
  ```
- 更新 API 路由：
  - `POST /api/query/stream` 接受 `mode?: "simple" | "advanced"`
  - `POST /api/orchestrate/query` 接受 `mode?: ...`
  - 默认：Simple 模式
  - 如果请求 Advanced 但未配置：优雅降级（无错误）
- 验收标准：
  - 配置且 mode=advanced 时调用 DeepSeek 端点
  - DeepSeek 不可用时静默降级
  - Simple 模式使用现有服务

**T19：带 RRF（倒数排名融合）的混合检索**

- 实现 `HybridRetriever`：

  ```typescript
  // src/lib/services/hybrid-retriever.service.ts
  export class HybridRetriever {
    async retrieve(
      query: string,
      embedding: number[],
      topK: number,
      options: { strategy: "rrf" | "weighted" },
    ) {
      // 1. 向量搜索
      const vectorResults = await this.vectorStore.search(embedding, topK * 4);

      // 2. 关键词搜索（FTS5）
      const keywordResults = await this.vectorStore.searchByKeywords(query, topK * 4);

      // 3. 融合
      if (options.strategy === "rrf") {
        return this.fuseByRrf(vectorResults, keywordResults, topK);
      } else {
        return this.fuseByWeightedSum(vectorResults, keywordResults, topK);
      }
    }

    private fuseByRrf(vector, keyword, topK) {
      const k = 60; // 标准 RRF 常数
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

- 在 SQLite 中启用 FTS5：
  ```sql
  CREATE VIRTUAL TABLE vector_chunks_fts USING fts5(
    id, documentName, content
  );
  ```
- 更新 `RagService.query()`：
  - 接受 `retrievalMode?: "vector" | "keyword" | "hybrid"`
  - 路由到合适的检索器
  - 默认：hybrid
- 验收标准：
  - 混合检索在关键词密集型查询上提升召回率（≥ 10%）
  - RRF 评分计算正确
  - 关键词搜索在配置的 SQLite 上可用

### Epic 8（续）— 语义缓存（T20）

**T20：语义缓存**

- 实现 `SemanticCacheService`：

  ```typescript
  // src/lib/services/semantic-cache.service.ts
  export class SemanticCacheService {
    async getCachedResult(
      question: string,
      embedding: number[],
      threshold: number = 0.95,
    ): Promise<CacheHit | null> {
      // 查找 Embedding 相似度 > 阈值
      const similar = await prisma.semanticCache.findMany({
        where: {
          // 向量相似度查询（Postgres pgvector 或 SQLite 近似）
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

- Prisma Schema：
  ```prisma
  model SemanticCache {
    id        String   @id @default(cuid())
    question  String   @db.Text
    embedding String   @db.Text  // JSON 化数组
    result    String   @db.Text  // JSON 化 RagQueryResponse
    createdAt DateTime @default(now())
    expiresAt DateTime
    hits      Int      @default(0)
  }
  ```
- 集成 `RagService.query()`：

  ```typescript
  // RAG 流程前：
  const cached = await semanticCache.getCachedResult(question, embedding);
  if (cached) {
    logger.info("Cache hit");
    return cached.result;
  }

  // RAG 后：
  await semanticCache.setCachedResult(question, embedding, result);
  return result;
  ```

- Admin 缓存管理：
  - `DELETE /api/admin/cache` — 清除所有条目
  - `GET /api/admin/cache/stats` — 命中率、大小等
- 配置：
  ```
  SEMANTIC_CACHE_ENABLED=true
  SEMANTIC_CACHE_TTL_HOURS=24
  SEMANTIC_CACHE_SIMILARITY_THRESHOLD=0.95
  ```
- 验收标准：
  - 相同/极相似问题命中缓存
  - 缓存防止重复 LLM 调用
  - 负载测试中命中率 > 30%
  - Admin 可清除缓存

### Epic 10 — 个人词汇增强（T25）

**T25：个人词汇增强** (低优先级)

- 实现 `PersonalVocabularyService`：

  ```typescript
  // src/lib/services/personal-vocabulary.service.ts
  export class PersonalVocabularyService {
    async extractUserTerms(userId: string): Promise<string[]> {
      // 查找用户所有 Chunk，提取领域专属术语
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
      // 获取用户的顶级术语
      const terms = await this.cachedTerms.get(userId);

      // 如果问题提及用户术语，则稍微增加 Embedding 幅度
      // （简单启发式：如果术语出现则放大）
      const hasTerm = terms.some((t) => question.includes(t));

      return hasTerm
        ? embedding.map((v) => v * 1.1) // 10% 提升
        : embedding;
    }
  }
  ```

- 流程：
  - 用户首次查询时：从已 Ingest 的文档提取其词汇
  - 在上下文中嵌入用户术语
  - 查询时：检查问题是否提及用户术语
  - 如是：将查询 Embedding 提升 10%
  - 使用提升的 Embedding 重新检索
- 验收标准：
  - 用户专属术语提高命中排名
  - 提升在评估中可量化（可选 A/B 测试）
  - 无性能回归

---

## 性能基准（GO/NO-GO）

- **检索速度**：向量 + 混合搜索 < 500ms（P95）
- **LLM 延迟**：流式 Token 首字 < 100ms
- **缓存命中率**：> 30%（典型使用）
- **内存占用**：缓存 DB < 500MB（典型）
- **吞吐量**：100 并发用户，95% < 2.5s RAG 查询（P95）

---

## 测试覆盖率与质量

- **单元测试**：所有服务（Mock LLM、DB）
- **集成测试**：端到端检索（向量 + 关键词 + 混合）
- **性能测试**：k6 负载测试、缓存命中率追踪
- **覆盖率目标**：≥ 80%（自第五、六阶段维持）

---

## 依赖

- **第五、六阶段**：稳定；用户系统、治理、Demo 库活跃
- **SQLite FTS5**：Schema 中已启用
- **向量 DB**：现有 `VectorStore` 接口（PostgreSQL pgvector 或 SQLite 近似）
- **Upstash Redis**：可选优化分布式缓存（非必需）

---

## 说明

- 所有功能优雅降级：
  - DeepSeek 不可用 → 回到 Simple
  - 混合检索不可用 → 仅向量
  - 缓存不可用 → 跳过缓存，运行 RAG
- 第七阶段是**最终优化层**：生产部署在成功 GO 后进行
- 无对第五/六阶段 API 的破坏性更改
- 推荐生产监控仪表板（Datadog 等）

---

## 第七阶段后的路线图

所有阶段完成后：

- **可观测性**：追踪、指标、仪表板
- **A/B 测试基础设施**：评估检索策略
- **分析**：追踪用户查询、反馈模式、词汇趋势
- **微调**：在用户数据上训练的自定义 Embedding 模型（可选）
- **扩展**：多区域部署、分布式缓存（Upstash、Redis Cluster）
