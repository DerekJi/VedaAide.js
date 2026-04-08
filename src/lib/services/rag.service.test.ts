import { describe, it, expect, vi, beforeEach } from "vitest";
import { RagService } from "@/lib/services/rag.service";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { IChatService } from "@/lib/services/chat.service";
import type { IVectorStore } from "@/lib/vector-store/vector-store";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    syncedFile: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    vectorChunk: {
      findFirst: vi.fn().mockResolvedValue(null), // no hash duplicate by default
      findMany: vi.fn().mockResolvedValue([]), // no similarity duplicate by default
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFakeEmbedding(): IEmbeddingService {
  return {
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi
      .fn()
      .mockImplementation((texts: string[]) => Promise.resolve(texts.map(() => [0.1, 0.2, 0.3]))),
  };
}

function makeFakeChat(): IChatService {
  return {
    chat: vi.fn().mockResolvedValue("The answer is 42."),
    chatStream: vi.fn(),
  };
}

function makeFakeVectorStore(): IVectorStore {
  return {
    addDocuments: vi.fn().mockResolvedValue(undefined),
    similaritySearch: vi
      .fn()
      .mockResolvedValue([
        { id: "chunk-1", content: "relevant context", score: 0.9, metadata: {} },
      ]),
    deleteByFileId: vi.fn().mockResolvedValue(undefined),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RagService", () => {
  let embeddingService: IEmbeddingService;
  let chatService: IChatService;
  let vectorStore: IVectorStore;
  let ragService: RagService;

  beforeEach(async () => {
    vi.clearAllMocks();

    embeddingService = makeFakeEmbedding();
    chatService = makeFakeChat();
    vectorStore = makeFakeVectorStore();
    ragService = new RagService(embeddingService, chatService, vectorStore);

    // Setup default Prisma mock behaviour
    const { prisma } = await import("@/lib/db");
    (prisma.syncedFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.syncedFile.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "file-123",
      status: "processing",
      chunkCount: 0,
    });
    (prisma.syncedFile.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  // ── ingest ──────────────────────────────────────────────────────────────────

  describe("ingest", () => {
    it("ingests new content and returns result", async () => {
      const result = await ragService.ingest({ content: "Hello world", source: "test.md" });
      expect(result.fileId).toBe("file-123");
      expect(result.skipped).toBe(false);
    });

    it("skips duplicate content", async () => {
      const { prisma } = await import("@/lib/db");
      (prisma.syncedFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-file",
        chunkCount: 5,
      });

      const result = await ragService.ingest({ content: "duplicate", source: "dup.md" });
      expect(result.skipped).toBe(true);
      expect(result.fileId).toBe("existing-file");
    });

    it("calls embedDocuments with chunked text", async () => {
      await ragService.ingest({ content: "Some content to chunk.", source: "doc.md" });
      expect(embeddingService.embedDocuments).toHaveBeenCalled();
    });

    it("calls vectorStore.addDocuments", async () => {
      await ragService.ingest({ content: "Content", source: "file.md" });
      expect(vectorStore.addDocuments).toHaveBeenCalled();
    });

    it("throws RagError if embedding fails", async () => {
      (embeddingService.embedDocuments as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("embedding timeout"),
      );
      const { RagError } = await import("@/lib/errors");
      await expect(
        ragService.ingest({ content: "text", source: "file.md" }),
      ).rejects.toBeInstanceOf(RagError);
    });

    it("deletes old chunks and upserts when re-ingesting same source", async () => {
      await ragService.ingest({ content: "Updated content here.", source: "doc.md" });
      expect(vectorStore.deleteByFileId).toHaveBeenCalledWith("file-123");
      expect(vectorStore.addDocuments).toHaveBeenCalled();
    });
  });

  // ── query ───────────────────────────────────────────────────────────────────

  describe("query", () => {
    it("returns an answer with sources and traceId", async () => {
      const result = await ragService.query({ question: "What is 6*7?" });
      expect(result.answer).toBe("The answer is 42.");
      expect(result.sources).toHaveLength(1);
      expect(result.traceId).toBeTruthy();
      expect(result.isHallucination).toBe(false);
    });

    it("uses default topK of 5", async () => {
      await ragService.query({ question: "test question" });
      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(expect.any(Array), 5, undefined);
    });

    it("respects custom topK", async () => {
      await ragService.query({ question: "test", topK: 3 });
      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(expect.any(Array), 3, undefined);
    });

    it("embeds the question before searching", async () => {
      await ragService.query({ question: "What is AI?" });
      expect(embeddingService.embedQuery).toHaveBeenCalledWith("What is AI?");
    });

    it("throws RagError if chat fails", async () => {
      (chatService.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("LLM unavailable"),
      );
      const { RagError } = await import("@/lib/errors");
      await expect(ragService.query({ question: "test" })).rejects.toBeInstanceOf(RagError);
    });
  });
});
