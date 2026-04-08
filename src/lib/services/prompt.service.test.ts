import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptService, DEFAULT_PROMPTS } from "./prompt.service";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    promptTemplate: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("PromptService", () => {
  let service: PromptService;
  let mockFindFirst: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/lib/db");
    mockFindFirst = prisma.promptTemplate.findFirst as ReturnType<typeof vi.fn>;
    mockCreate = prisma.promptTemplate.create as ReturnType<typeof vi.fn>;
    mockUpdate = prisma.promptTemplate.update as ReturnType<typeof vi.fn>;
    service = new PromptService();
  });

  describe("getActivePrompt", () => {
    it("returns DB prompt when found", async () => {
      mockFindFirst.mockResolvedValue({ content: "DB prompt text", version: 2 });
      const result = await service.getActivePrompt("rag_system");
      expect(result).toBe("DB prompt text");
    });

    it("falls back to DEFAULT_PROMPTS when no DB record", async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await service.getActivePrompt("rag_system");
      expect(result).toBe(DEFAULT_PROMPTS["rag_system"]);
    });

    it("returns empty string for unknown prompt name with no DB record", async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await service.getActivePrompt("nonexistent_prompt");
      expect(result).toBe("");
    });
  });

  describe("createPrompt", () => {
    it("creates version 1 when no existing versions", async () => {
      mockFindFirst.mockResolvedValue(null); // no existing versions
      mockCreate.mockResolvedValue({ id: "p1", version: 1 });

      const result = await service.createPrompt("new_prompt", "content here");
      expect(result.version).toBe(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }),
      );
    });

    it("increments version based on latest", async () => {
      mockFindFirst.mockResolvedValue({ version: 3 }); // existing version 3
      mockCreate.mockResolvedValue({ id: "p2", version: 4 });

      const result = await service.createPrompt("rag_system", "updated content");
      expect(result.version).toBe(4);
    });
  });

  describe("deactivatePrompt", () => {
    it("calls update with isActive=false", async () => {
      mockUpdate.mockResolvedValue({});
      await service.deactivatePrompt("prompt-id-123");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "prompt-id-123" },
        data: { isActive: false },
      });
    });
  });
});
