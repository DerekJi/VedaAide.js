import { describe, it, expect, vi } from "vitest";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  EmbeddingRerankingService,
  NoopRerankingService,
  createRerankingService,
} from "./reranking.service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fakeEmbeddings(): EmbeddingsInterface {
  return {
    embedQuery: vi.fn().mockResolvedValue([1, 0, 0]),
    embedDocuments: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(
        texts.map((_, i) => {
          // doc 0 aligns with query [1,0,0], doc 1 is orthogonal [0,1,0]
          return i === 0 ? [1, 0, 0] : [0, 1, 0];
        }),
      ),
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("EmbeddingRerankingService", () => {
  const docs = [
    new Document({ pageContent: "orthogonal document", metadata: {} }),
    new Document({ pageContent: "aligned document", metadata: {} }),
  ];

  it("re-ranks and puts most relevant first", async () => {
    // query [1,0,0]; doc[0] returns [1,0,0] → score 1, doc[1] returns [0,1,0] → score 0
    const service = new EmbeddingRerankingService(fakeEmbeddings());
    const results = await service.rerank("query", docs);

    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[0].document.pageContent).toBe("orthogonal document"); // first doc aligns
  });

  it("respects topK", async () => {
    const service = new EmbeddingRerankingService(fakeEmbeddings());
    const results = await service.rerank("query", docs, 1);
    expect(results).toHaveLength(1);
  });

  it("records original rank", async () => {
    const service = new EmbeddingRerankingService(fakeEmbeddings());
    const results = await service.rerank("query", docs);
    const originalRanks = results.map((r) => r.originalRank);
    expect(originalRanks).toContain(0);
    expect(originalRanks).toContain(1);
  });

  it("returns empty array for empty documents", async () => {
    const service = new EmbeddingRerankingService(fakeEmbeddings());
    const results = await service.rerank("query", []);
    expect(results).toHaveLength(0);
  });
});

describe("NoopRerankingService", () => {
  it("returns documents in original order", async () => {
    const service = new NoopRerankingService();
    const docs = [
      new Document({ pageContent: "first", metadata: { score: 0.8 } }),
      new Document({ pageContent: "second", metadata: { score: 0.5 } }),
    ];
    const results = await service.rerank("query", docs);
    expect(results[0].document.pageContent).toBe("first");
    expect(results[0].score).toBe(0.8);
  });
});

describe("createRerankingService", () => {
  it("returns NoopRerankingService when disabled", () => {
    const svc = createRerankingService(fakeEmbeddings(), false);
    expect(svc).toBeInstanceOf(NoopRerankingService);
  });

  it("returns EmbeddingRerankingService when enabled", () => {
    const svc = createRerankingService(fakeEmbeddings(), true);
    expect(svc).toBeInstanceOf(EmbeddingRerankingService);
  });
});
