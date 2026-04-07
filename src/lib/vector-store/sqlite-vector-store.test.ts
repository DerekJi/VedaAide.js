import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqliteVectorStore } from "@/lib/vector-store/sqlite-vector-store";
import type { VectorDocument } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mock PrismaClient
// ─────────────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops));

const mockPrisma = {
  vectorChunk: {
    create: mockCreate,
    findMany: mockFindMany,
    deleteMany: mockDeleteMany,
  },
  $transaction: mockTransaction,
} as unknown as import("@prisma/client").PrismaClient;

describe("SqliteVectorStore", () => {
  let store: SqliteVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new SqliteVectorStore(mockPrisma);
    // Default: create returns the doc
    mockCreate.mockImplementation((args: { data: unknown }) => Promise.resolve(args.data));
    // Default: transaction executes all ops
    mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  });

  // ── addDocuments ─────────────────────────────────────────────────────────────

  describe("addDocuments", () => {
    it("does nothing for empty array", async () => {
      await store.addDocuments([]);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("stores documents in a transaction", async () => {
      const docs: VectorDocument[] = [
        { content: "chunk 1", embedding: [0.1, 0.2], metadata: { source: "test" } },
        { content: "chunk 2", embedding: [0.3, 0.4] },
      ];

      await store.addDocuments(docs);

      expect(mockTransaction).toHaveBeenCalledOnce();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("serialises embedding as JSON string", async () => {
      const embedding = [1, 2, 3];
      await store.addDocuments([{ content: "test", embedding }]);
      const callArgs = mockCreate.mock.calls[0][0] as { data: { embedding: string } };
      expect(callArgs.data.embedding).toBe(JSON.stringify(embedding));
    });

    it("throws VectorStoreError on failure", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("db error"));
      const { VectorStoreError } = await import("@/lib/errors");
      await expect(store.addDocuments([{ content: "x", embedding: [1] }])).rejects.toBeInstanceOf(
        VectorStoreError,
      );
    });
  });

  // ── similaritySearch ────────────────────────────────────────────────────────

  describe("similaritySearch", () => {
    it("returns empty array when no chunks stored", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const results = await store.similaritySearch([1, 0], 5);
      expect(results).toHaveLength(0);
    });

    it("returns results sorted by descending score", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "a",
          content: "doc a",
          embedding: JSON.stringify([0, 1]),
          metadata: "{}",
          fileId: null,
        },
        {
          id: "b",
          content: "doc b",
          embedding: JSON.stringify([1, 0]),
          metadata: "{}",
          fileId: null,
        },
      ]);

      const results = await store.similaritySearch([1, 0], 5);
      expect(results[0].id).toBe("b"); // [1,0] · [1,0] = 1
      expect(results[1].id).toBe("a"); // [1,0] · [0,1] = 0
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("limits results to topK", async () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        content: `content ${i}`,
        embedding: JSON.stringify([i / 10, (10 - i) / 10]),
        metadata: "{}",
        fileId: null,
      }));
      mockFindMany.mockResolvedValueOnce(chunks);

      const results = await store.similaritySearch([1, 0], 3);
      expect(results).toHaveLength(3);
    });

    it("throws VectorStoreError on failure", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("db error"));
      const { VectorStoreError } = await import("@/lib/errors");
      await expect(store.similaritySearch([1], 5)).rejects.toBeInstanceOf(VectorStoreError);
    });
  });

  // ── deleteByFileId ───────────────────────────────────────────────────────────

  describe("deleteByFileId", () => {
    it("calls deleteMany with the given fileId", async () => {
      mockDeleteMany.mockResolvedValueOnce({ count: 3 });
      await store.deleteByFileId("file-abc");
      expect(mockDeleteMany).toHaveBeenCalledWith({ where: { fileId: "file-abc" } });
    });

    it("throws VectorStoreError on failure", async () => {
      mockDeleteMany.mockRejectedValueOnce(new Error("db error"));
      const { VectorStoreError } = await import("@/lib/errors");
      await expect(store.deleteByFileId("x")).rejects.toBeInstanceOf(VectorStoreError);
    });
  });
});
