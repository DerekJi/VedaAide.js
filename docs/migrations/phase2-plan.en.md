# Phase 2 Implementation Plan: Backend Core Migration

> **Duration**: 3-4 weeks | **Prerequisites**: Phase 1 | **Blocks**: Phase 3
> **Status**: ✅ **COMPLETED** — 2026-04-07 | Branch: `feature/2-migrate-backend` | Latest commit: `518d30b`

## Implementation Notes (Plan Deviations)

> The following items record known deviations from the original design, for reference in Phase 3:
>
> | Task                   | Planned Approach                                             | Actual Implementation                                    | Reason                                                                                     |
> | ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
> | T4 VectorStore         | `PrismaVectorStore` (`@langchain/community`)                 | Custom `LangChainSqliteVectorStore` adapter              | `PrismaVectorStore` requires pgvector (PostgreSQL); SQLite not supported                   |
> | T5 RAG Chain           | `RetrievalQAChain`                                           | LCEL `RunnableSequence`                                  | `RetrievalQAChain` deprecated in LangChain v1                                              |
> | T2 Document Loading    | `TextLoader` (`@langchain/community`)                        | `fs/promises` + `@langchain/core/documents` `Document`   | `TextLoader` subpath removed in v1                                                         |
> | T19 Azure Blob         | Azure Blob Connector (T19)                                   | ⚠️ **Deferred to Phase 3**                               | Requires Azure credentials, out of scope for this phase                                    |
> | T24 Streaming Protocol | `LangChainStream` + `StreamingTextResponse` (old AI SDK API) | `createTextStreamResponse` + custom `useChatStream` hook | AI SDK v6 removed `LangChainStream`; `useChat` moved to `@ai-sdk/react` (API incompatible) |
> | PromptTemplate field   | `template: String`                                           | `content: String`                                        | Field renamed to align with API responses and service layer                                |

---

## Executive Summary

Rewrite RAG, Agent, and MCP core services using LangChain.js, migrating advanced features like dual-layer deduplication and hallucination detection.

### GO/NO-GO Decision Criteria

| Criterion               | Target                         | Verification Method |
| ----------------------- | ------------------------------ | ------------------- |
| LangChain RAG Chain     | Success retrieval + generation | E2E tests           |
| Dual-layer Dedup        | Hash + similarity dedup works  | Unit tests          |
| Hallucination Detection | Identifies wrong answers       | Integration tests   |
| Agent Orchestration     | LLM autonomously calls tools   | Functional tests    |
| MCP Server              | External clients connect       | Postman tests       |
| MCP Client              | Reads external data sources    | Integration tests   |
| Test Coverage           | ≥75%                           | Coverage report     |

---

## Core Task Checklist (22 Tasks)

### LangChain RAG Chain Migration (T1-T5)

**T1: LangChain Core Dependencies**

```bash
npm install @langchain/core @langchain/community \
  @langchain/ollama @langchain/openai \
  langchain
```

- [x] Install LangChain core packages
- [x] Install Ollama/OpenAI connectors
- [x] LangSmith tracing config (optional)
- **Acceptance**: All imports have no type errors

**T2: Document Loaders**

```typescript
import { TextLoader } from "@langchain/community/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export class DocumentLoaderService {
  async load(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath);
    switch (ext) {
      case ".txt":
        return new TextLoader(filePath).load();
      case ".pdf":
        return new PDFLoader(filePath).load();
      // ...
    }
  }
}
```

- [x] Text/Markdown loaders
- [x] PDF loader (optional)
- [x] Unified `Document` object conversion
- **Acceptance**: Load various document types successfully

**T3: Text Splitters**

```typescript
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 50,
});
```

- [x] Recursive splitter integration
- [x] Markdown splitter
- [x] Dynamic strategy selection
- **Acceptance**: Chunking boundary checks

**T4: VectorStore Integration**

```typescript
import { PrismaVectorStore } from "@langchain/community/vectorstores/prisma";

const vectorStore = new PrismaVectorStore(embeddings, {
  prisma: prismaClient,
  tableName: "VectorChunk",
  vectorColumnName: "embedding",
  columns: { id: PrismaVectorStore.IdColumn, content: PrismaVectorStore.ContentColumn },
});
```

- [x] Prisma VectorStore adapter
- [x] Add documents method
- [x] Similarity search method
- **Acceptance**: Store and retrieve vectors

**T5: RAG Chain Construction (RetrievalQAChain)**

```typescript
import { RetrievalQAChain } from "langchain/chains";
import { ChatOllama } from "@langchain/ollama";

const chain = RetrievalQAChain.fromLLM(
  new ChatOllama({ model: "qwen3:8b" }),
  vectorStore.asRetriever(5),
);

const result = await chain.invoke({ query: question });
```

- [x] Build `RetrievalQAChain`
- [x] Custom prompt template
- [x] Return source documents
- **Acceptance**: E2E RAG query test

---

### Dual-layer Deduplication Service (T6-T8)

**T6: Hash Deduplication (Layer 1)**

```typescript
import { createHash } from "crypto";

export class DeduplicationService {
  async checkHashDuplicate(content: string): Promise<boolean> {
    const hash = createHash("sha256").update(content).digest("hex");
    const existing = await prisma.vectorChunk.findUnique({ where: { contentHash: hash } });
    return !!existing;
  }
}
```

- [x] SHA-256 hash calculation
- [x] Database hash query
- [x] Unit test coverage
- **Acceptance**: Duplicate content identified

**T7: Vector Similarity Deduplication (Layer 2)**

```typescript
async checkSimilarityDuplicate(
  embedding: number[],
  threshold: number = 0.95
): Promise<boolean> {
  const results = await vectorStore.similaritySearchVectorWithScore(embedding, 1);
  return results[0]?.[1] >= threshold;
}
```

- [x] Cosine similarity calculation
- [x] Configurable threshold (0.95)
- [x] Performance optimization (indexing)
- **Acceptance**: Semantic duplicates identified

**T8: Integration into Ingestion Pipeline**

```typescript
async ingestWithDedup(content: string, metadata: DocumentMetadata): Promise<IngestResult> {
  // Layer 1: Hash check
  if (await this.dedupService.checkHashDuplicate(content)) {
    return { skipped: true, reason: 'hash_duplicate' };
  }

  // Layer 2: Similarity check
  const embedding = await this.embeddings.embedQuery(content);
  if (await this.dedupService.checkSimilarityDuplicate(embedding)) {
    return { skipped: true, reason: 'similarity_duplicate' };
  }

  // Store
  await this.vectorStore.addDocuments([{ content, embedding, metadata }]);
  return { skipped: false, id: '...' };
}
```

- [x] Dual-layer check logic
- [x] Skip statistics recording
- [x] E2E test verification
- **Acceptance**: Duplicate documents not stored repeatedly

---

### Dual-layer Hallucination Detection (T9-T11)

**T9: Embedding Similarity Check (Layer 1)**

```typescript
export class HallucinationGuardService {
  async checkAnswerGrounding(
    answer: string,
    threshold: number = 0.3,
  ): Promise<{ isHallucination: boolean; confidence: number }> {
    const answerEmbedding = await this.embeddings.embedQuery(answer);
    const results = await this.vectorStore.similaritySearchVectorWithScore(answerEmbedding, 1);
    const maxSimilarity = results[0]?.[1] ?? 0;

    return {
      isHallucination: maxSimilarity < threshold,
      confidence: maxSimilarity,
    };
  }
}
```

- [x] Answer vectorization
- [x] Compare with knowledge base
- [x] Threshold configuration (0.3)
- **Acceptance**: Wrong answers flagged

**T10: LLM Self-verification (Layer 2)**

```typescript
async verifySelfCheck(answer: string, context: string): Promise<boolean> {
  const prompt = `Context: ${context}\n\nAnswer: ${answer}\n\nIs the answer consistent with the context? Reply YES or NO only.`;

  const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
  return result.toLowerCase().includes('yes');
}
```

- [x] Context consistency Q&A
- [x] Configurable enable/disable
- [x] Prompt template management
- **Acceptance**: LLM correctly identifies inconsistencies

**T11: Integration into Query Pipeline**

```typescript
async queryWithGuard(question: string): Promise<RagQueryResult> {
  const answer = await this.ragChain.invoke({ query: question });

  // Layer 1 check
  const { isHallucination, confidence } = await this.guardService.checkAnswerGrounding(answer);

  // Layer 2 check (optional)
  if (config.enableSelfCheck) {
    const consistent = await this.guardService.verifySelfCheck(answer, context);
    // ...
  }

  return { answer, isHallucination, confidence };
}
```

- [x] Dual-layer check logic
- [x] Warning flag return
- [x] E2E tests
- **Acceptance**: Hallucinations detected

---

### Agent Orchestration (T12-T14)

**T12: Agent Tool Definitions**

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description: "Search the VedaAide knowledge base",
  schema: z.object({
    query: z.string().describe("Search query"),
    topK: z.number().default(5),
  }),
  func: async ({ query, topK }) => {
    const results = await vectorStore.similaritySearch(query, topK);
    return JSON.stringify(results);
  },
});
```

- [x] Define `search_knowledge_base` tool
- [x] Define `ingest_document` tool
- [x] Zod schema validation
- **Acceptance**: Tools independently callable

**T13: ReAct Agent Construction**

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const agent = createReactAgent({
  llm: new ChatOllama({ model: "qwen3:8b" }),
  tools: [searchKnowledgeBaseTool, ingestDocumentTool],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Search for documents about RAG" }],
});
```

- [x] Build ReAct Agent using LangGraph
- [x] Tool calling loop
- [x] Intermediate step tracing
- **Acceptance**: Agent autonomously decides to call tools

**T14: Agent API Endpoints**

- [x] `POST /api/orchestrate/query`
- [x] `POST /api/orchestrate/ingest`
- [x] Return intermediate step trace
- **Acceptance**: Postman tests agent calls

---

### MCP Server Implementation (T15-T17)

**T15: MCP SDK Integration**

```bash
npm install @modelcontextprotocol/sdk
```

```typescript
// src/app/api/mcp/route.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamable.js";

const server = new McpServer({ name: "vedaaide", version: "1.0.0" });
```

- [x] Install MCP SDK
- [x] Create MCP Server instance
- [x] HTTP transport configuration
- **Acceptance**: MCP server starts

**T16: MCP Tool Registration**

```typescript
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "search_knowledge_base",
      description: "Search VedaAide knowledge base",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          topK: { type: "number", default: 5 },
        },
      },
    },
    // ...
  ],
}));

server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "search_knowledge_base") {
    const results = await ragService.search(request.params.arguments.query);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
});
```

- [x] Register `tools/list` handler
- [x] Register `tools/call` handler
- [x] Implement all tool logic
- **Acceptance**: MCP client calls succeed

**T17: VS Code MCP Integration Test**

```json
// .vscode/mcp.json
{
  "servers": {
    "vedaaide": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

- [x] `.vscode/mcp.json` configuration
- [x] VS Code Copilot call tests
- [x] Log verification of tool calls
- **Acceptance**: Copilot successfully calls VedaAide tools

---

### MCP Client Implementation (T18-T20)

**T18: File System Connector**

```typescript
import { DirectoryLoader } from "@langchain/community/document_loaders/fs/directory";

export class FileSystemConnector implements IDataSourceConnector {
  async sync(): Promise<SyncResult> {
    const loader = new DirectoryLoader(this.config.path, {
      ".txt": (path) => new TextLoader(path),
      ".md": (path) => new TextLoader(path),
    });

    const docs = await loader.load();

    for (const doc of docs) {
      // Check sync state (contentHash)
      const hash = this.computeHash(doc.pageContent);
      const synced = await this.syncStateStore.get(this.name, doc.metadata.source);

      if (synced?.contentHash === hash) continue; // Skip unchanged

      await this.ragService.ingest(doc.pageContent, doc.metadata);
      await this.syncStateStore.set(this.name, doc.metadata.source, hash);
    }

    return { filesProcessed: docs.length };
  }
}
```

- [x] Recursive directory scanning
- [x] Hash comparison to skip unchanged files
- [x] Prisma `SyncedFile` table updates
- **Acceptance**: Only ingest new/modified files

**T19: Blob Storage Connector**

- [~] List container blobs (deferred to Phase 3)
- [~] Download and ingest (deferred to Phase 3)
- [~] Sync state tracking (deferred to Phase 3)
- **Acceptance**: Azure Blob files ingested

**T20: Scheduled Sync Service**

```typescript
// Background service, runs hourly
export class DataSourceSyncService {
  @Cron("0 * * * *") // Every hour
  async syncAll() {
    const connectors = this.getEnabledConnectors();
    for (const connector of connectors) {
      await connector.sync();
    }
  }
}
```

- [x] Scheduled task configuration
- [x] Manual trigger API: `POST /api/datasources/sync`
- [x] Logging
- **Acceptance**: Scheduled tasks execute successfully

---

### Prompt Version Management (T21-T22)

**T21: Prompt Template CRUD API**

- [x] `GET /api/prompts` - List
- [x] `POST /api/prompts` - Create
- [x] `PUT /api/prompts/:id` - Update
- [x] `DELETE /api/prompts/:id` - Delete
- **Acceptance**: Postman CRUD tests pass

**T22: Dynamic Prompt Loading**

```typescript
export class PromptService {
  async getActivePrompt(name: string): Promise<string> {
    const template = await prisma.promptTemplate.findFirst({
      where: { name, isActive: true },
      orderBy: { version: "desc" },
    });
    return template?.content ?? DEFAULT_PROMPTS[name];
  }
}
```

- [x] Load prompts from database
- [x] Version selection logic
- [x] Fallback to default prompts
- **Acceptance**: Query results change after modifying prompt

---

## Risk Assessment

| Risk                         | Impact | Probability | Mitigation                      |
| ---------------------------- | ------ | ----------- | ------------------------------- |
| LangChain API changes        | High   | Medium      | Lock version 0.3.x              |
| MCP protocol incompatibility | Medium | Medium      | Early PoC validation in Phase 1 |
| Agent calling infinite loop  | Medium | Low         | Set max iteration limit         |

---

## Timeline

```
Week 1: T1-T5 (LangChain RAG chain)
Week 2: T6-T11 (Dedup + Hallucination detection)
Week 3: T12-T17 (Agent + MCP Server)
Week 4: T18-T22 (MCP Client + Prompt management)
```

---

## GitHub Issue Template

```markdown
# [Phase 2] Backend Core Migration

## 🎯 Goal

Rewrite RAG/Agent/MCP core services with LangChain

## ✅ Task Checklist

- [x] T1-T5: LangChain RAG chain
- [x] T6-T8: Dual-layer dedup
- [x] T9-T11: Dual-layer hallucination detection
- [x] T12-T14: Agent orchestration
- [x] T15-T17: MCP Server
- [x] T18-T20: MCP Client
- [x] T21-T22: Prompt management

## 📊 Definition of Done

- [x] All GO/NO-GO tests pass
- [x] Test coverage ≥ 75%
- [x] Agent autonomously decides
- [x] MCP server connectable

## 🔗 Related: [Phase 1](./phase1-plan.en.md) | [Phase 3](./phase3-plan.en.md)

## 👥 Assigned: @ai-developer @backend-engineer
```

---

**Document Maintainer**: VedaAide Migration Team | **Next Step**: [Phase 3 Plan](./phase3-plan.en.md)
