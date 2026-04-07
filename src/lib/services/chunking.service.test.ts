import { describe, it, expect } from "vitest";
import { ChunkingService } from "@/lib/services/chunking.service";

describe("ChunkingService", () => {
  const svc = new ChunkingService();

  // ── chunkBySize ─────────────────────────────────────────────────────────────

  describe("chunkBySize", () => {
    it("returns empty array for empty text", () => {
      expect(svc.chunkBySize("")).toHaveLength(0);
      expect(svc.chunkBySize("   ")).toHaveLength(0);
    });

    it("returns single chunk when text fits", () => {
      const chunks = svc.chunkBySize("Hello world", { chunkSize: 100, chunkOverlap: 0 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("Hello world");
      expect(chunks[0].index).toBe(0);
    });

    it("splits text into multiple chunks", () => {
      const text = "a".repeat(250);
      const chunks = svc.chunkBySize(text, { chunkSize: 100, chunkOverlap: 0 });
      expect(chunks.length).toBe(3); // 100, 100, 50
      expect(chunks[0].startChar).toBe(0);
      expect(chunks[0].endChar).toBe(100);
    });

    it("applies overlap correctly", () => {
      const text = "a".repeat(200);
      const chunks = svc.chunkBySize(text, { chunkSize: 100, chunkOverlap: 20 });
      // chunk 0: 0-100, chunk 1: 80-180, chunk 2: 160-200
      expect(chunks).toHaveLength(3);
      expect(chunks[1].startChar).toBe(80);
    });

    it("throws for invalid chunkSize", () => {
      expect(() => svc.chunkBySize("text", { chunkSize: 0 })).toThrow();
    });

    it("throws when overlap >= chunkSize", () => {
      expect(() => svc.chunkBySize("text", { chunkSize: 10, chunkOverlap: 10 })).toThrow();
    });

    it("throws for negative overlap", () => {
      expect(() => svc.chunkBySize("text", { chunkOverlap: -1 })).toThrow();
    });

    it("assigns sequential indexes", () => {
      const chunks = svc.chunkBySize("a".repeat(300), { chunkSize: 100, chunkOverlap: 0 });
      chunks.forEach((c, i) => expect(c.index).toBe(i));
    });
  });

  // ── chunkByParagraph ─────────────────────────────────────────────────────────

  describe("chunkByParagraph", () => {
    it("returns empty array for empty text", () => {
      expect(svc.chunkByParagraph("")).toHaveLength(0);
    });

    it("splits on double newlines", () => {
      const text = "Para one.\n\nPara two.\n\nPara three.";
      const chunks = svc.chunkByParagraph(text, { chunkSize: 100, chunkOverlap: 0 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("merges small paragraphs into a single chunk", () => {
      const text = "Short.\n\nAlso short.";
      const chunks = svc.chunkByParagraph(text, { chunkSize: 200, chunkOverlap: 0 });
      // Both paragraphs fit in one chunk
      expect(chunks).toHaveLength(1);
    });
  });

  // ── chunkMarkdown ───────────────────────────────────────────────────────────

  describe("chunkMarkdown", () => {
    it("returns empty array for empty text", () => {
      expect(svc.chunkMarkdown("")).toHaveLength(0);
    });

    it("splits on Markdown headings", () => {
      const text = `# Intro\nSome text.\n\n## Section 1\nContent here.\n\n## Section 2\nMore content.`;
      const chunks = svc.chunkMarkdown(text, { chunkSize: 500, chunkOverlap: 0 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("sub-splits large Markdown sections", () => {
      const largeSection = `## Big Section\n${"word ".repeat(300)}`;
      const chunks = svc.chunkMarkdown(largeSection, { chunkSize: 200, chunkOverlap: 0 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("handles text without Markdown headings", () => {
      const text = "Plain paragraph without any heading.";
      const chunks = svc.chunkMarkdown(text, { chunkSize: 100, chunkOverlap: 0 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
