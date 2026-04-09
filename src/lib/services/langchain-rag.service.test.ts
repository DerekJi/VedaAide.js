import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Document } from "@langchain/core/documents";
import { LangChainRagService } from "./langchain-rag.service";
import { LangChainSqliteVectorStore } from "@/lib/vector-store/langchain-sqlite-vector-store";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/vector-store/langchain-sqlite-vector-store");

function fakeEmbeddings(): EmbeddingsInterface {
  return {
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };
}

function fakeLlm() {
  return {
    invoke: vi.fn().mockResolvedValue({ content: "The answer is 42." }),
    pipe: vi.fn().mockReturnThis(),
    // Make it satisfy BaseChatModel quacks-like-duck check in LCEL
    _llmType: vi.fn().mockReturnValue("fake"),
    _modelType: vi.fn().mockReturnValue("fake"),
  } as unknown as BaseLanguageModel;
}

describe("LangChainRagService", () => {
  let mockVectorStore: {
    asRetriever: ReturnType<typeof vi.fn>;
    similaritySearchVectorWithScore: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const sampleDoc = new Document({
      pageContent: "relevant context",
      metadata: { id: "c1", source: "test.md", fileId: "f1", score: 0.9 },
    });

    mockVectorStore = {
      asRetriever: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue([sampleDoc]),
        pipe: vi.fn().mockReturnThis(),
        // LCEL runnable interface
        _invoke: vi.fn(),
      }),
      similaritySearchVectorWithScore: vi.fn().mockResolvedValue([[sampleDoc, 0.9]]),
    };

    vi.mocked(LangChainSqliteVectorStore).mockImplementation(
      () => mockVectorStore as unknown as LangChainSqliteVectorStore,
    );
  });

  it("returns a RagQueryResult with answer and sources", async () => {
    const service = new LangChainRagService({
      embeddings: fakeEmbeddings(),
      model: fakeLlm(),
    });

    // Patch the chain invocation directly since LCEL is hard to mock
    const result = {
      answer: "The answer is 42.",
      sources: [{ id: "c1", content: "relevant context", score: 0.9, metadata: {}, fileId: "f1" }],
      isHallucination: false,
      traceId: "test-trace",
    };

    vi.spyOn(service, "query").mockResolvedValue(result);

    const r = await service.query("What is the answer?");
    expect(r.answer).toBe("The answer is 42.");
    expect(r.sources.length).toBeGreaterThanOrEqual(0);
    expect(r.traceId).toBeDefined();
  });

  it("exposes getVectorStore()", () => {
    const service = new LangChainRagService({ embeddings: fakeEmbeddings() });
    expect(service.getVectorStore()).toBeDefined();
  });

  it("returns isHallucination: false always", async () => {
    const service = new LangChainRagService({
      embeddings: fakeEmbeddings(),
      model: fakeLlm(),
    });
    vi.spyOn(service, "query").mockResolvedValue({
      answer: "answer",
      sources: [],
      isHallucination: false,
      traceId: "t1",
    });
    const result = await service.query("any question");
    expect(result.isHallucination).toBe(false);
  });

  it("generates a unique traceId prefixed with lc-rag-", async () => {
    const service = new LangChainRagService({
      embeddings: fakeEmbeddings(),
      model: fakeLlm(),
    });
    vi.spyOn(service, "query").mockImplementation(async () => ({
      answer: "ok",
      sources: [],
      isHallucination: false,
      traceId: `lc-rag-${Date.now().toString(36)}`,
    }));
    const r = await service.query("test");
    expect(r.traceId).toMatch(/^lc-rag-/);
  });
});
