import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Dual-layer Deduplication Service
//
// Layer 1 – Hash deduplication (fast, exact match):
//   SHA-256 of chunk content → checked against VectorChunk.contentHash
//
// Layer 2 – Similarity deduplication (semantic, approximate match):
//   Cosine similarity of chunk embedding vs top-1 neighbour in store
//   Default threshold: 0.95 (configurable)
// ─────────────────────────────────────────────────────────────────────────────

export type DuplicateReason = "hash_duplicate" | "similarity_duplicate";

export interface DedupCheckResult {
  isDuplicate: boolean;
  reason?: DuplicateReason;
}

export class DeduplicationService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db ?? prisma;
  }

  // ── Layer 1: Hash deduplication ────────────────────────────────────────────

  /**
   * Compute SHA-256 of the given text.
   */
  computeHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * Returns true if a chunk with the same SHA-256 hash already exists in the
   * `VectorChunk` table.
   */
  async checkHashDuplicate(content: string): Promise<boolean> {
    const hash = this.computeHash(content);
    const existing = await this.db.vectorChunk.findFirst({
      where: { contentHash: hash },
      select: { id: true },
    });
    const isDuplicate = !!existing;
    if (isDuplicate) {
      logger.debug({ hash: hash.slice(0, 12) }, "dedup: hash duplicate detected");
    }
    return isDuplicate;
  }

  // ── Layer 2: Similarity deduplication ─────────────────────────────────────

  /**
   * Returns true if the nearest neighbour in the vector store has cosine
   * similarity ≥ `threshold` (default 0.95).
   */
  async checkSimilarityDuplicate(embedding: number[], threshold = 0.95): Promise<boolean> {
    const chunks = await this.db.vectorChunk.findMany({
      select: { embedding: true },
    });

    if (chunks.length === 0) return false;

    let maxSimilarity = -Infinity;
    for (const chunk of chunks) {
      const stored = JSON.parse(chunk.embedding) as number[];
      const sim = cosineSimilarity(embedding, stored);
      if (sim > maxSimilarity) maxSimilarity = sim;
    }

    const isDuplicate = maxSimilarity >= threshold;
    if (isDuplicate) {
      logger.debug({ maxSimilarity, threshold }, "dedup: similarity duplicate detected");
    }
    return isDuplicate;
  }

  // ── Combined check ─────────────────────────────────────────────────────────

  /**
   * Run both layers. Returns first layer that detects a duplicate.
   * Skips layer 2 if `embedding` is not provided (hash-only check).
   */
  async check(
    content: string,
    embedding?: number[],
    similarityThreshold = 0.95,
  ): Promise<DedupCheckResult> {
    if (await this.checkHashDuplicate(content)) {
      return { isDuplicate: true, reason: "hash_duplicate" };
    }

    if (embedding) {
      if (await this.checkSimilarityDuplicate(embedding, similarityThreshold)) {
        return { isDuplicate: true, reason: "similarity_duplicate" };
      }
    }

    return { isDuplicate: false };
  }
}
