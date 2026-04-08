import { VectorStore } from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { PrismaClient } from "@prisma/client";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";
import { VectorStoreError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// LangChain VectorStore adapter backed by SQLite via Prisma
// Implements the @langchain/core VectorStore abstract class so that all
// LangChain chains and agents can use it as a retriever.
// ─────────────────────────────────────────────────────────────────────────────

export class LangChainSqliteVectorStore extends VectorStore {
  // Required by LangChain to identify the store type
  declare FilterType: Record<string, unknown>;

  private readonly prisma: PrismaClient;

  constructor(embeddings: EmbeddingsInterface, prisma?: PrismaClient) {
    super(embeddings, {});
    this.prisma = prisma ?? new PrismaClient();
  }

  _vectorstoreType(): string {
    return "sqlite";
  }

  /** Add pre-computed vectors alongside their source documents */
  async addVectors(vectors: number[][], docs: Document[]): Promise<string[]> {
    if (vectors.length !== docs.length) {
      throw new VectorStoreError(
        "vectors and docs arrays must have the same length",
        "VECTOR_STORE_WRITE_FAILED",
      );
    }

    try {
      const created = await this.prisma.$transaction(
        docs.map((doc, i) =>
          this.prisma.vectorChunk.create({
            data: {
              content: doc.pageContent,
              embedding: JSON.stringify(vectors[i]),
              metadata: JSON.stringify(doc.metadata ?? {}),
              fileId: (doc.metadata?.fileId as string | undefined) ?? null,
            },
          }),
        ),
      );

      logger.debug({ count: created.length }, "LangChainSqliteVectorStore.addVectors");
      return created.map((c) => c.id);
    } catch (cause) {
      throw new VectorStoreError(
        `Failed to store ${docs.length} document(s): ${String(cause)}`,
        "VECTOR_STORE_WRITE_FAILED",
        cause,
      );
    }
  }

  /** Embed then add documents */
  async addDocuments(docs: Document[]): Promise<string[]> {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, docs);
  }

  /** Core similarity search returning (Document, score) pairs */
  async similaritySearchVectorWithScore(
    queryVector: number[],
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    try {
      const where = this.buildWhereClause(filter);
      const chunks = await this.prisma.vectorChunk.findMany({ where });

      const scored = chunks.map((chunk) => {
        const embedding = JSON.parse(chunk.embedding) as number[];
        const score = cosineSimilarity(queryVector, embedding);
        return { chunk, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topK = scored.slice(0, k);

      logger.debug({ k, returned: topK.length }, "LangChainSqliteVectorStore.similaritySearch");

      return topK.map(({ chunk, score }) => [
        new Document({
          pageContent: chunk.content,
          metadata: {
            ...(JSON.parse(chunk.metadata) as Record<string, unknown>),
            id: chunk.id,
            fileId: chunk.fileId,
          },
        }),
        score,
      ]);
    } catch (cause) {
      if (cause instanceof VectorStoreError) throw cause;
      throw new VectorStoreError(
        `Similarity search failed: ${String(cause)}`,
        "VECTOR_STORE_READ_FAILED",
        cause,
      );
    }
  }

  /** Delete all chunks associated with a given fileId */
  async deleteByFileId(fileId: string): Promise<void> {
    const { count } = await this.prisma.vectorChunk.deleteMany({ where: { fileId } });
    logger.debug({ fileId, count }, "LangChainSqliteVectorStore.deleteByFileId");
  }

  /** Build Prisma where clause from a flat metadata filter */
  private buildWhereClause(filter?: Record<string, unknown>) {
    if (!filter || Object.keys(filter).length === 0) return {};

    const conditions = Object.entries(filter).map(([key, value]) => ({
      metadata: { contains: `"${key}":"${String(value)}"` },
    }));

    return conditions.length === 1 ? conditions[0] : { AND: conditions };
  }
}
