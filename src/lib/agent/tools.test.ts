import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock heavy dependencies before importing tools
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    syncedFile: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/ollama-embedding.service", () => ({
  OllamaEmbeddingService: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  })),
}));

vi.mock("@/lib/services/ollama-chat.service", () => ({
  OllamaChatService: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue("The answer is 42."),
    chatStream: vi.fn(),
  })),
}));

vi.mock("@/lib/services/rag.service", () => ({
  RagService: vi.fn().mockImplementation(() => ({
    chunker: null,
    vectorStore: null,
    dedupService: null,
    hallucinationGuard: null,
    ingest: vi.fn().mockResolvedValue({
      fileId: "file-1",
      source: "test.md",
      chunkCount: 3,
      skipped: false,
    }),
    query: vi.fn().mockResolvedValue({
      answer: "Test answer",
      sources: [],
      isHallucination: false,
    }),
    queryStream: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any,
}));

vi.mock("@/lib/vector-store/langchain-sqlite-vector-store", () => ({
  LangChainSqliteVectorStore: vi.fn().mockImplementation(() => ({
    FilterType: {},
    prisma: null,
    _vectorstoreType: () => "sqlite",
    addVectors: vi.fn().mockResolvedValue([]),
    addDocuments: vi.fn().mockResolvedValue([]),
    similaritySearch: vi
      .fn()
      .mockResolvedValue([{ pageContent: "relevant chunk", metadata: { source: "doc.md" } }]),
    similaritySearchVectorWithScore: vi.fn(),
    deleteByFileId: vi.fn(),
    asRetriever: vi.fn().mockReturnValue({}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import {
  searchKnowledgeBaseTool,
  ingestDocumentTool,
  listDocumentsTool,
  VEDA_AGENT_TOOLS,
} from "./tools";

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("VEDA_AGENT_TOOLS", () => {
  it("exports 3 tools", () => {
    expect(VEDA_AGENT_TOOLS).toHaveLength(3);
  });

  it("includes search_knowledge_base, ingest_document, list_documents", () => {
    const names = VEDA_AGENT_TOOLS.map((t) => t.name);
    expect(names).toContain("search_knowledge_base");
    expect(names).toContain("ingest_document");
    expect(names).toContain("list_documents");
  });
});

describe("searchKnowledgeBaseTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct tool metadata", () => {
    expect(searchKnowledgeBaseTool.name).toBe("search_knowledge_base");
    expect(searchKnowledgeBaseTool.description).toBeTruthy();
  });

  it("returns JSON string result", async () => {
    const raw = await searchKnowledgeBaseTool.invoke({ query: "What is RAG?", topK: 3 });
    // Result should be parseable JSON
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("handles errors gracefully and returns JSON error", async () => {
    const { LangChainSqliteVectorStore } =
      await import("@/lib/vector-store/langchain-sqlite-vector-store");
    vi.mocked(LangChainSqliteVectorStore).mockImplementationOnce(
      () =>
        ({
          FilterType: {},
          prisma: null,
          embeddingsInstance: null,
          embeddings: null,
          _vectorstoreType: () => "sqlite",
          addVectors: vi.fn(),
          addDocuments: vi.fn(),
          similaritySearch: vi.fn().mockRejectedValue(new Error("DB down")),
          similaritySearchVectorWithScore: vi.fn(),
          deleteByFileId: vi.fn(),
          asRetriever: vi.fn(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );

    const raw = await searchKnowledgeBaseTool.invoke({ query: "fail", topK: 1 });
    const result = JSON.parse(raw);
    expect(result).toHaveProperty("error");
  });
});

describe("ingestDocumentTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct tool metadata", () => {
    expect(ingestDocumentTool.name).toBe("ingest_document");
    expect(ingestDocumentTool.description).toBeTruthy();
  });

  it("returns JSON result with fileId", async () => {
    const raw = await ingestDocumentTool.invoke({
      content: "Some test content",
      source: "test.md",
    });
    const result = JSON.parse(raw);
    expect(result).toHaveProperty("fileId");
  });

  it("handles errors gracefully and returns JSON error", async () => {
    const { RagService } = await import("@/lib/services/rag.service");
    vi.mocked(RagService).mockImplementationOnce(
      () =>
        ({
          chunker: null,
          vectorStore: null,
          dedupService: null,
          embeddingService: null,
          chatService: null,
          hallucinationGuard: null,
          ingest: vi.fn().mockRejectedValue(new Error("ingest failed")),
          query: vi.fn(),
          queryStream: vi.fn(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );

    const raw = await ingestDocumentTool.invoke({
      content: "text",
      source: "fail.md",
    });
    const result = JSON.parse(raw);
    expect(result).toHaveProperty("error");
  });
});

describe("listDocumentsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct tool metadata", () => {
    expect(listDocumentsTool.name).toBe("list_documents");
    expect(listDocumentsTool.description).toBeTruthy();
  });

  it("returns JSON array of files", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.syncedFile.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "f1",
        name: "doc.md",
        source: "doc.md",
        status: "completed",
        chunkCount: 5,
        createdAt: new Date(),
      },
    ]);

    const raw = await listDocumentsTool.invoke({ status: "completed" });
    const result = JSON.parse(raw);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("doc.md");
  });

  it("handles errors gracefully and returns JSON error", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.syncedFile.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB error"),
    );

    const raw = await listDocumentsTool.invoke({ status: "all" });
    const result = JSON.parse(raw);
    expect(result).toHaveProperty("error");
  });

  it("filters by status 'all' (no where clause)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.syncedFile.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const raw = await listDocumentsTool.invoke({ status: "all" });
    const result = JSON.parse(raw);
    expect(Array.isArray(result)).toBe(true);
  });
});
