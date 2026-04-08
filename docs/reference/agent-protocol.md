# Agent Protocol: LangChain.js Tool Calling

> **Status**: Implemented in Phase 2 | **Maintainer**: VedaAide Team

This document defines the function calling protocol used by VedaAide agents, with a compatibility mapping from the .NET Semantic Kernel implementation to LangChain.js.

---

## Overview

VedaAide uses **LangChain.js `DynamicStructuredTool`** with **Zod schemas** for type-safe tool definitions. Agents are built with **LangGraph `createReactAgent`** using the ReAct (Reasoning + Acting) loop.

---

## Semantic Kernel (.NET) → LangChain.js Migration Mapping

| Feature               | Semantic Kernel (.NET)       | LangChain.js                    |
| --------------------- | ---------------------------- | ------------------------------- |
| Function registration | `[KernelFunction]` attribute | `DynamicStructuredTool` class   |
| Parameter validation  | C# type system               | `z.object({...})` (Zod)         |
| Function description  | `Description` property       | `description` string field      |
| Return value          | `Task<T>` (strongly typed)   | `Promise<string>` (JSON string) |
| Agent loop            | Planner + Stepwise           | `createReactAgent` (ReAct)      |
| Tool invocation       | Auto by Kernel               | Auto by LangGraph               |

---

## Implemented Tools

### `search_knowledge_base`

Searches the VedaAide vector store for relevant document chunks.

| Parameter | SK equivalent  | Type                              | Default  |
| --------- | -------------- | --------------------------------- | -------- |
| `query`   | `string query` | `z.string()`                      | required |
| `topK`    | `int topK`     | `z.number().int().min(1).max(20)` | `5`      |

**Returns**: JSON array of `{ id, content, score, metadata }` objects.

### `ingest_document`

Ingests a text document into the knowledge base.

| Parameter  | SK equivalent                    | Type                               | Default  |
| ---------- | -------------------------------- | ---------------------------------- | -------- |
| `content`  | `string content`                 | `z.string().min(1)`                | required |
| `source`   | `string source`                  | `z.string().min(1)`                | required |
| `metadata` | `Dictionary<string,object> meta` | `z.record(z.unknown()).optional()` | `{}`     |

**Returns**: JSON `{ fileId, source, chunkCount, skipped }`.

---

## Prompt Placeholder Compatibility

When migrating prompts from Semantic Kernel to LangChain:

| Syntax       | Platform        | Example         |
| ------------ | --------------- | --------------- |
| `{{$input}}` | Semantic Kernel | `{{$question}}` |
| `{input}`    | LangChain LCEL  | `{question}`    |
| `{context}`  | LangChain LCEL  | `{context}`     |

**Migration rule**: Replace `{{$variableName}}` with `{variableName}` in all prompts.

---

## Agent Safeguards

- **Max iterations**: 10 (prevents infinite tool-calling loops)
- **Timeout**: Controlled by LLM client timeout (default: 60s per call)
- **Error handling**: Tool errors return a descriptive string; agent decides to retry or stop

---

## Usage Example

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import { searchKnowledgeBaseTool, ingestDocumentTool } from "@/lib/agent/tools";

const agent = createReactAgent({
  llm: new ChatOllama({ model: "qwen3:8b" }),
  tools: [searchKnowledgeBaseTool, ingestDocumentTool],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Search for documents about RAG" }],
});
```

---

## Self-verification Checklist

- [x] All tool parameter types are validated with Zod
- [x] Tool `description` fields clearly explain when to use the tool
- [x] Return values are JSON strings (compatible with all LLMs)
- [x] Max iterations guard is configured
- [x] Prompt placeholders migrated from `{{$var}}` to `{var}` format
