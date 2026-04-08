import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import { FileSystemConnector } from "./file-system.connector";
import type { RagService } from "@/lib/services/rag.service";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    syncedFile: {
      findFirst: vi.fn().mockResolvedValue(null), // file not yet synced
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Setup temp directory with test files
// ─────────────────────────────────────────────────────────────────────────────

const TMP_DIR = path.join(__dirname, "__tmp_connector_test__");

function makeRagService(): RagService {
  return {
    ingest: vi.fn().mockResolvedValue({
      fileId: "f1",
      source: "test.md",
      chunkCount: 1,
      skipped: false,
    }),
  } as unknown as RagService;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("FileSystemConnector", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset default: file not yet synced
    const { prisma } = await import("@/lib/db");
    (prisma.syncedFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(path.join(TMP_DIR, "doc1.md"), "# Doc 1\n\nContent one");
    writeFileSync(path.join(TMP_DIR, "doc2.txt"), "Content two");
    writeFileSync(path.join(TMP_DIR, "ignored.pdf"), "Should be ignored");
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("discovers and ingests supported files", async () => {
    const ragService = makeRagService();
    const connector = new FileSystemConnector({ path: TMP_DIR }, ragService);

    const result = await connector.sync();

    expect(result.filesProcessed).toBe(2); // doc1.md + doc2.txt
    expect(result.filesSkipped).toBe(0);
    expect(result.filesError).toBe(0);
    expect(ragService.ingest).toHaveBeenCalledTimes(2);
  });

  it("skips unchanged files (same hash)", async () => {
    const { prisma } = await import("@/lib/db");
    // Return a matching hash so files appear "unchanged"
    const content = "# Doc 1\n\nContent one";
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
    (prisma.syncedFile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      contentHash: hash,
    });

    const ragService = makeRagService();
    const connector = new FileSystemConnector({ path: TMP_DIR, extensions: [".md"] }, ragService);

    const result = await connector.sync();

    expect(result.filesSkipped).toBe(1);
    expect(result.filesProcessed).toBe(0);
    expect(ragService.ingest).not.toHaveBeenCalled();
  });

  it("ignores unsupported file extensions", async () => {
    const ragService = makeRagService();
    const connector = new FileSystemConnector({ path: TMP_DIR, extensions: [".md"] }, ragService);

    const result = await connector.sync();

    // Only doc1.md should be processed
    expect(result.filesProcessed).toBe(1);
    expect(ragService.ingest).toHaveBeenCalledTimes(1);
  });

  it("records errors without stopping other files", async () => {
    const ragService = makeRagService();
    (ragService.ingest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ingest failed"),
    );

    const connector = new FileSystemConnector(
      { path: TMP_DIR, extensions: [".md", ".txt"] },
      ragService,
    );

    const result = await connector.sync();

    expect(result.filesError).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.filesProcessed).toBe(1); // The second file still succeeds
  });
});
