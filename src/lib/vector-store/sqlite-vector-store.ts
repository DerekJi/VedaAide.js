import { PrismaClient } from "@prisma/client";
import { VectorStoreError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";
import type { IVectorStore } from "@/lib/vector-store/vector-store";
import type { VectorDocument, VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// SQLite-backed vector store (cosine similarity computed in-process)
// ─────────────────────────────────────────────────────────────────────────────

export class SqliteVectorStore implements IVectorStore {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    if (docs.length === 0) return;

    try {
      await this.prisma.$transaction(
        docs.map((doc) =>
          this.prisma.vectorChunk.create({
            data: {
              id: doc.id,
              content: doc.content,
              contentHash: doc.contentHash ?? null,
              embedding: JSON.stringify(doc.embedding),
              metadata: doc.metadata ? JSON.stringify(doc.metadata) : "{}",
              fileId: doc.fileId ?? null,
            },
          }),
        ),
      );
      logger.debug({ count: docs.length }, "addDocuments: stored chunks");
    } catch (cause) {
      throw new VectorStoreError(
        `Failed to store ${docs.length} document(s): ${String(cause)}`,
        "VECTOR_STORE_WRITE_FAILED",
        cause,
      );
    }
  }

  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    try {
      // Build Prisma where clause from metadata filter
      const where = this.buildWhereClause(filter);

      const chunks = await this.prisma.vectorChunk.findMany({ where });

      const scored = chunks.map(
        (chunk: {
          embedding: string;
          content: string;
          id: string;
          metadata: string;
          fileId: string | null;
        }) => {
          const embedding = JSON.parse(chunk.embedding) as number[];
          const score = cosineSimilarity(queryEmbedding, embedding);
          return {
            id: chunk.id,
            content: chunk.content,
            score,
            metadata: JSON.parse(chunk.metadata) as Record<string, unknown>,
            fileId: chunk.fileId ?? undefined,
          };
        },
      );

      scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
      const results = scored.slice(0, topK);

      logger.debug({ topK, returned: results.length }, "similaritySearch");
      return results;
    } catch (cause) {
      if (cause instanceof VectorStoreError) throw cause;
      throw new VectorStoreError(
        `Similarity search failed: ${String(cause)}`,
        "VECTOR_STORE_READ_FAILED",
        cause,
      );
    }
  }

  async deleteByFileId(fileId: string): Promise<void> {
    try {
      const { count } = await this.prisma.vectorChunk.deleteMany({
        where: { fileId },
      });
      logger.debug({ fileId, count }, "deleteByFileId");
    } catch (cause) {
      throw new VectorStoreError(
        `Failed to delete chunks for file ${fileId}: ${String(cause)}`,
        "VECTOR_STORE_WRITE_FAILED",
        cause,
      );
    }
  }

  /** Build Prisma `where` from a flat metadata filter object */
  private buildWhereClause(filter?: Record<string, unknown>) {
    if (!filter || Object.keys(filter).length === 0) return {};

    // For SQLite we do basic JSON string matching on the metadata column.
    // A more robust implementation would use JSON_EXTRACT in raw queries.
    // Kept simple to satisfy SRP – optimise in Phase 2 if needed.
    const conditions = Object.entries(filter).map(([key, value]) => ({
      metadata: { contains: `"${key}":"${String(value)}"` },
    }));

    return conditions.length === 1 ? conditions[0] : { AND: conditions };
  }
}
