import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";

// ─────────────────────────────────────────────────────────────────────────────
// Mock ollama module
// ─────────────────────────────────────────────────────────────────────────────

const mockEmbed = vi.fn();

vi.mock("ollama", () => ({
  Ollama: vi.fn().mockImplementation(() => ({ embed: mockEmbed })),
}));

describe("OllamaEmbeddingService", () => {
  let service: OllamaEmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OllamaEmbeddingService("http://localhost:11434", "nomic-embed-text");
  });

  // ── embedQuery ────────────────────────────────────────────────────────────────

  describe("embedQuery", () => {
    it("returns an embedding for valid text", async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockEmbed.mockResolvedValueOnce({ embeddings: [embedding] });

      const result = await service.embedQuery("hello world");
      expect(result).toEqual(embedding);
      expect(mockEmbed).toHaveBeenCalledWith({
        model: "nomic-embed-text",
        input: "hello world",
      });
    });

    it("throws EmbeddingError for empty text", async () => {
      const { EmbeddingError } = await import("@/lib/errors");
      await expect(service.embedQuery("")).rejects.toBeInstanceOf(EmbeddingError);
      await expect(service.embedQuery("   ")).rejects.toBeInstanceOf(EmbeddingError);
    });

    it("wraps Ollama errors as EmbeddingError", async () => {
      mockEmbed.mockRejectedValueOnce(new Error("connection refused"));
      const { EmbeddingError } = await import("@/lib/errors");
      await expect(service.embedQuery("text")).rejects.toBeInstanceOf(EmbeddingError);
    });
  });

  // ── embedDocuments ────────────────────────────────────────────────────────────

  describe("embedDocuments", () => {
    it("returns empty array for empty input", async () => {
      const result = await service.embedDocuments([]);
      expect(result).toHaveLength(0);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("returns embeddings for multiple texts", async () => {
      const embeddings = [
        [0.1, 0.2],
        [0.3, 0.4],
      ];
      mockEmbed.mockResolvedValueOnce({ embeddings });

      const result = await service.embedDocuments(["text 1", "text 2"]);
      expect(result).toEqual(embeddings);
    });

    it("wraps errors as EmbeddingError", async () => {
      mockEmbed.mockRejectedValueOnce(new Error("timeout"));
      const { EmbeddingError } = await import("@/lib/errors");
      await expect(service.embedDocuments(["text"])).rejects.toBeInstanceOf(EmbeddingError);
    });
  });
});
