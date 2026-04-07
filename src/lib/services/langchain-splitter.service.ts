import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";
import type { ChunkOptions } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// LangChain-based text splitter service
// Splits LangChain Document objects into smaller chunks.
// Strategy is auto-selected based on file extension in document metadata.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 512;

export class LangChainSplitterService {
  /**
   * Split a list of LangChain Documents using a strategy selected by
   * the document's `extension` metadata field.
   * - `.md` / `.mdx` → MarkdownTextSplitter
   * - anything else  → RecursiveCharacterTextSplitter
   */
  async split(docs: Document[], options?: ChunkOptions): Promise<Document[]> {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_SIZE / 10;

    const results: Document[] = [];

    for (const doc of docs) {
      const ext = (doc.metadata?.extension as string | undefined)?.toLowerCase() ?? "";
      const splitter = this.buildSplitter(ext, chunkSize, chunkOverlap);
      const chunks = await splitter.splitDocuments([doc]);
      results.push(...chunks);
    }

    return results;
  }

  private buildSplitter(
    ext: string,
    chunkSize: number,
    chunkOverlap: number,
  ): RecursiveCharacterTextSplitter {
    const opts = { chunkSize, chunkOverlap };

    if (ext === ".md" || ext === ".mdx") {
      return new MarkdownTextSplitter(opts);
    }

    return new RecursiveCharacterTextSplitter(opts);
  }
}
