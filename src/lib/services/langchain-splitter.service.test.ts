import { describe, it, expect } from "vitest";
import { Document } from "@langchain/core/documents";
import { LangChainSplitterService } from "./langchain-splitter.service";

// ─────────────────────────────────────────────────────────────────────────────
// LangChainSplitterService tests
// ─────────────────────────────────────────────────────────────────────────────

describe("LangChainSplitterService", () => {
  const service = new LangChainSplitterService();

  it("splits a large text document into multiple chunks", async () => {
    const content = "word ".repeat(300); // ~1500 chars
    const doc = new Document({
      pageContent: content,
      metadata: { extension: ".txt", source: "test.txt" },
    });

    const chunks = await service.split([doc], { chunkSize: 100, chunkOverlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.pageContent.length).toBeLessThanOrEqual(110); // some tolerance
    }
  });

  it("splits a markdown document using Markdown splitter", async () => {
    const content = `# Section 1\n\nContent one.\n\n# Section 2\n\nContent two.`;
    const doc = new Document({
      pageContent: content,
      metadata: { extension: ".md", source: "test.md" },
    });

    const chunks = await service.split([doc], { chunkSize: 50, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserves source metadata in chunks", async () => {
    const doc = new Document({
      pageContent: "Some text",
      metadata: { extension: ".txt", source: "myfile.txt" },
    });

    const chunks = await service.split([doc]);
    expect(chunks[0].metadata?.source).toBe("myfile.txt");
  });

  it("handles a short document without splitting", async () => {
    const doc = new Document({
      pageContent: "Short text",
      metadata: { extension: ".txt", source: "short.txt" },
    });

    const chunks = await service.split([doc], { chunkSize: 512, chunkOverlap: 50 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].pageContent).toBe("Short text");
  });
});
