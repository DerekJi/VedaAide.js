import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeduplicationService } from "./deduplication.service";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    vectorChunk: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("DeduplicationService", () => {
  let service: DeduplicationService;
  let mockFindFirst: ReturnType<typeof vi.fn>;
  let mockFindMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/lib/db");
    mockFindFirst = prisma.vectorChunk.findFirst as ReturnType<typeof vi.fn>;
    mockFindMany = prisma.vectorChunk.findMany as ReturnType<typeof vi.fn>;
    service = new DeduplicationService(prisma as unknown as import("@prisma/client").PrismaClient);
  });

  // ── computeHash ─────────────────────────────────────────────────────────────

  it("computeHash returns consistent SHA-256 hex", () => {
    const h1 = service.computeHash("hello world");
    const h2 = service.computeHash("hello world");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[a-f0-9]+$/);
  });

  it("computeHash differs for different content", () => {
    expect(service.computeHash("a")).not.toBe(service.computeHash("b"));
  });

  // ── checkHashDuplicate ──────────────────────────────────────────────────────

  it("checkHashDuplicate returns true when hash found in DB", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing-chunk" });
    expect(await service.checkHashDuplicate("some content")).toBe(true);
  });

  it("checkHashDuplicate returns false when no hash match", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await service.checkHashDuplicate("new content")).toBe(false);
  });

  // ── checkSimilarityDuplicate ────────────────────────────────────────────────

  it("checkSimilarityDuplicate returns false when store is empty", async () => {
    mockFindMany.mockResolvedValue([]);
    expect(await service.checkSimilarityDuplicate([1, 0, 0])).toBe(false);
  });

  it("checkSimilarityDuplicate returns true for near-identical embedding", async () => {
    mockFindMany.mockResolvedValue([{ embedding: JSON.stringify([1, 0, 0]) }]);
    // Exact match → similarity = 1.0 ≥ threshold 0.95
    expect(await service.checkSimilarityDuplicate([1, 0, 0], 0.95)).toBe(true);
  });

  it("checkSimilarityDuplicate returns false for orthogonal embedding", async () => {
    mockFindMany.mockResolvedValue([{ embedding: JSON.stringify([1, 0, 0]) }]);
    // Orthogonal → similarity = 0 < 0.95
    expect(await service.checkSimilarityDuplicate([0, 1, 0], 0.95)).toBe(false);
  });

  // ── check (combined) ────────────────────────────────────────────────────────

  it("check returns hash_duplicate when hash matches", async () => {
    mockFindFirst.mockResolvedValue({ id: "chunk-1" });
    const result = await service.check("content");
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("hash_duplicate");
  });

  it("check returns similarity_duplicate when embedding is near-duplicate", async () => {
    mockFindFirst.mockResolvedValue(null); // no hash match
    mockFindMany.mockResolvedValue([{ embedding: JSON.stringify([1, 0, 0]) }]);
    const result = await service.check("unique text", [1, 0, 0]);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("similarity_duplicate");
  });

  it("check returns not duplicate for new unique content", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([{ embedding: JSON.stringify([1, 0, 0]) }]);
    const result = await service.check("new content", [0, 1, 0]);
    expect(result.isDuplicate).toBe(false);
  });
});
