import { describe, it, expect, vi, beforeEach } from "vitest";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { LangChainSqliteVectorStore } from "./langchain-sqlite-vector-store";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  vectorChunk: {
    create: mockCreate,
    findMany: mockFindMany,
    deleteMany: mockDeleteMany,
  },
  $transaction: mockTransaction,
} as unknown as import("@prisma/client").PrismaClient;

function fakeEmbeddings(): EmbeddingsInterface {
  return {
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi
      .fn()
      .mockImplementation((texts: string[]) => Promise.resolve(texts.map(() => [0.1, 0.2, 0.3]))),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("LangChainSqliteVectorStore", () => {
  let store: LangChainSqliteVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new LangChainSqliteVectorStore(fakeEmbeddings(), mockPrisma);

    // Default transaction: return created IDs
    mockTransaction.mockImplementation(async (ops: (() => Promise<unknown>)[]) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    });
    mockCreate.mockResolvedValue({ id: "chunk-1" });
  });

  it("addVectors stores documents with correct data", async () => {
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      return Promise.all(ops.map(() => ({ id: "chunk-abc" })));
    });

    const docs = [new Document({ pageContent: "hello", metadata: { source: "test.txt" } })];
    const ids = await store.addVectors([[0.1, 0.2, 0.3]], docs);

    expect(ids).toHaveLength(1);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("addDocuments embeds then stores", async () => {
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      return Promise.all(ops.map(() => ({ id: "chunk-xyz" })));
    });

    const docs = [new Document({ pageContent: "embed me" })];
    const ids = await store.addDocuments(docs);

    expect(ids).toHaveLength(1);
  });

  it("similaritySearchVectorWithScore returns ranked results", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "c1",
        content: "hello",
        embedding: JSON.stringify([1, 0, 0]),
        metadata: "{}",
        fileId: null,
      },
      {
        id: "c2",
        content: "world",
        embedding: JSON.stringify([0, 1, 0]),
        metadata: "{}",
        fileId: null,
      },
    ]);

    // Query vector aligned with c1
    const results = await store.similaritySearchVectorWithScore([1, 0, 0], 2);

    expect(results).toHaveLength(2);
    const [topDoc, topScore] = results[0];
    expect(topDoc.pageContent).toBe("hello");
    expect(topScore).toBeGreaterThan(results[1][1]); // c1 score > c2 score
  });

  it("addVectors throws if vectors and docs lengths differ", async () => {
    await expect(store.addVectors([[0.1]], [])).rejects.toThrow(
      "vectors and docs arrays must have the same length",
    );
  });
});
