import type { VectorDocument, VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IVectorStore {
  addDocuments(docs: VectorDocument[]): Promise<void>;
  similaritySearch(
    queryEmbedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]>;
  deleteByFileId(fileId: string): Promise<void>;
}
