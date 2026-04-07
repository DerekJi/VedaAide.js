import type { Embedding } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IEmbeddingService {
  embedQuery(text: string): Promise<Embedding>;
  embedDocuments(texts: string[]): Promise<Embedding[]>;
}
