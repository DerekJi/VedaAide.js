import { VedaError } from "@/lib/errors";
import type { ChunkOptions, TextChunk } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Document chunking service
// Supports: fixed-size (with overlap), paragraph-aware, Markdown-aware
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

export class ChunkingService {
  /**
   * Fixed-size character chunking with overlap.
   */
  chunkBySize(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap ?? DEFAULT_OVERLAP;

    this.validateOptions(chunkSize, overlap);

    if (!text.trim()) return [];

    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        content: text.slice(start, end),
        index,
        startChar: start,
        endChar: end,
      });
      index++;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Splits on paragraph boundaries (double newline), then merges small
   * paragraphs into chunks not exceeding `chunkSize`.
   */
  chunkByParagraph(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap ?? DEFAULT_OVERLAP;

    this.validateOptions(chunkSize, overlap);

    if (!text.trim()) return [];

    const paragraphs = text.split(/\n{2,}/);
    return this.mergeParagraphsIntoChunks(paragraphs, chunkSize, overlap, text);
  }

  /**
   * Markdown-aware chunk: respects heading boundaries (H1/H2/H3).
   * Each top-level section becomes at most one chunk; large sections are
   * further split by `chunkBySize`.
   */
  chunkMarkdown(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap ?? DEFAULT_OVERLAP;

    this.validateOptions(chunkSize, overlap);

    if (!text.trim()) return [];

    // Split on Markdown headings (## or ###), keeping the heading line
    const sectionPattern = /(?=^#{1,3} )/m;
    const sections = text.split(sectionPattern).filter((s) => s.trim());

    const chunks: TextChunk[] = [];
    let charPosition = 0;

    for (const section of sections) {
      if (section.length <= chunkSize) {
        chunks.push({
          content: section.trim(),
          index: chunks.length,
          startChar: charPosition,
          endChar: charPosition + section.length,
        });
      } else {
        // Section too large – further split by size
        const subChunks = this.chunkBySize(section, { chunkSize, chunkOverlap: overlap });
        for (const sub of subChunks) {
          chunks.push({
            ...sub,
            index: chunks.length,
            startChar: charPosition + sub.startChar,
            endChar: charPosition + sub.endChar,
          });
        }
      }
      charPosition += section.length;
    }

    return chunks;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private validateOptions(chunkSize: number, overlap: number): void {
    if (chunkSize <= 0) {
      throw new VedaError("chunkSize must be greater than 0", "CHUNKING_FAILED");
    }
    if (overlap < 0) {
      throw new VedaError("chunkOverlap must be ≥ 0", "CHUNKING_FAILED");
    }
    if (overlap >= chunkSize) {
      throw new VedaError("chunkOverlap must be less than chunkSize", "CHUNKING_FAILED");
    }
  }

  private mergeParagraphsIntoChunks(
    paragraphs: string[],
    chunkSize: number,
    overlap: number,
    originalText: string,
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let current = "";
    let startChar = 0;
    let charPosition = 0;

    for (const para of paragraphs) {
      const separator = current ? "\n\n" : "";
      const candidate = current + separator + para;

      if (candidate.length > chunkSize && current) {
        // Flush current chunk
        const endChar = startChar + current.length;
        chunks.push({ content: current, index: chunks.length, startChar, endChar });

        // Start new chunk with overlap from previous
        const overlapText = current.slice(-overlap);
        startChar = endChar - overlapText.length;
        current = overlapText + "\n\n" + para;
      } else {
        current = candidate;
      }

      charPosition = originalText.indexOf(para, charPosition) + para.length;
    }

    if (current.trim()) {
      chunks.push({
        content: current,
        index: chunks.length,
        startChar,
        endChar: startChar + current.length,
      });
    }

    return chunks;
  }
}
