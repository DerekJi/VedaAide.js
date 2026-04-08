import crypto from "crypto";
import { prisma } from "@/lib/db";
import { RagError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ChunkingService } from "@/lib/services/chunking.service";
import { DeduplicationService } from "@/lib/services/deduplication.service";
import { HallucinationGuardService } from "@/lib/services/hallucination-guard.service";
import { SqliteVectorStore } from "@/lib/vector-store/sqlite-vector-store";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { IChatService } from "@/lib/services/chat.service";
import type { IVectorStore } from "@/lib/vector-store/vector-store";
import type {
  IngestRequest,
  IngestResult,
  RagQueryRequest,
  RagQueryResult,
  VectorDocument,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// RAG service – orchestrates ingest and query pipelines
// ─────────────────────────────────────────────────────────────────────────────

export class RagService {
  private readonly chunker: ChunkingService;
  private readonly vectorStore: IVectorStore;
  private readonly dedupService: DeduplicationService;
  private readonly hallucinationGuard?: HallucinationGuardService;

  constructor(
    private readonly embeddingService: IEmbeddingService,
    private readonly chatService: IChatService,
    vectorStore?: IVectorStore,
    dedupService?: DeduplicationService,
    hallucinationGuard?: HallucinationGuardService,
  ) {
    this.chunker = new ChunkingService();
    this.vectorStore = vectorStore ?? new SqliteVectorStore();
    this.dedupService = dedupService ?? new DeduplicationService();
    this.hallucinationGuard = hallucinationGuard;
  }

  // ── Ingest pipeline ─────────────────────────────────────────────────────────
  // Text → Chunk → Embed → Dedupe → Store

  async ingest(request: IngestRequest): Promise<IngestResult> {
    const contentHash = sha256(request.content);

    // Deduplication: skip if content hash already exists
    const existing = await prisma.syncedFile.findFirst({
      where: { contentHash },
    });

    if (existing) {
      logger.info({ source: request.source, fileId: existing.id }, "ingest: duplicate skipped");
      return {
        fileId: existing.id,
        source: request.source,
        chunkCount: existing.chunkCount,
        skipped: true,
      };
    }

    // Create or reset SyncedFile record (source may already exist with old content)
    let syncedFile: { id: string };
    try {
      syncedFile = await prisma.syncedFile.upsert({
        where: { source: request.source },
        create: {
          name: request.source.split("/").pop() ?? request.source,
          source: request.source,
          contentHash,
          status: "processing",
        },
        update: {
          contentHash,
          status: "processing",
          chunkCount: 0,
          errorMessage: null,
        },
      });
    } catch (cause) {
      throw new RagError(
        `Failed to create/update file record for "${request.source}": ${String(cause)}`,
        "RAG_INGEST_FAILED",
        cause,
      );
    }

    // Delete old chunks if re-ingesting
    const vectorStore = this.vectorStore;
    await vectorStore.deleteByFileId(syncedFile.id);

    try {
      // Chunk the document
      const chunks = this.chunker.chunkMarkdown(request.content, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      if (chunks.length === 0) {
        await this.updateFileStatus(syncedFile.id, "completed", 0);
        return { fileId: syncedFile.id, source: request.source, chunkCount: 0, skipped: false };
      }

      // Embed all chunks
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embedDocuments(texts);

      // Build VectorDocument list, performing dual-layer dedup per chunk
      const docs: VectorDocument[] = [];
      let skippedChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const contentHash = this.dedupService.computeHash(chunk.content);

        const dedupResult = await this.dedupService.check(chunk.content, embedding);
        if (dedupResult.isDuplicate) {
          skippedChunks++;
          logger.debug(
            { reason: dedupResult.reason, chunkIndex: chunk.index },
            "ingest: chunk dedup skip",
          );
          continue;
        }

        docs.push({
          content: chunk.content,
          contentHash,
          embedding,
          metadata: { ...request.metadata, chunkIndex: chunk.index, source: request.source },
          fileId: syncedFile.id,
        });
      }

      if (skippedChunks > 0) {
        logger.info(
          { skippedChunks, totalChunks: chunks.length },
          "ingest: chunks skipped by dedup",
        );
      }

      // Store in vector store
      await this.vectorStore.addDocuments(docs);

      // Update SyncedFile status
      await this.updateFileStatus(syncedFile.id, "completed", chunks.length);

      logger.info(
        { source: request.source, fileId: syncedFile.id, chunkCount: chunks.length },
        "ingest: completed",
      );
      return {
        fileId: syncedFile.id,
        source: request.source,
        chunkCount: chunks.length,
        skipped: false,
      };
    } catch (cause) {
      await this.updateFileStatus(syncedFile.id, "failed", 0, String(cause));
      throw new RagError(
        `Ingest failed for "${request.source}": ${String(cause)}`,
        "RAG_INGEST_FAILED",
        cause,
      );
    }
  }

  // ── Query pipeline ───────────────────────────────────────────────────────────
  // Question → Embed → Retrieve topK → Build prompt → LLM → Return

  async query(request: RagQueryRequest): Promise<RagQueryResult> {
    const traceId = `rag-${Date.now().toString(36)}`;
    const topK = request.topK ?? 5;

    try {
      // 1. Embed the question
      const queryEmbedding = await this.embeddingService.embedQuery(request.question);

      // 2. Retrieve topK relevant chunks
      const sources = await this.vectorStore.similaritySearch(
        queryEmbedding,
        topK,
        request.metadata,
      );

      // 3. Build prompt
      const context = sources.map((s, i) => `[${i + 1}] ${s.content}`).join("\n\n");
      const prompt = buildRagPrompt(request.question, context);

      // 4. Generate answer via LLM
      const answer = await this.chatService.chat([{ role: "user", content: prompt }], {
        systemPrompt: RAG_SYSTEM_PROMPT,
      });

      // 5. Hallucination detection (dual-layer, optional)
      let isHallucination = false;
      if (this.hallucinationGuard) {
        const contextTexts = sources.map((s) => s.content);
        const guardResult = await this.hallucinationGuard.check(answer, contextTexts);
        isHallucination = guardResult.isHallucination;
        logger.debug(
          { isHallucination, confidence: guardResult.confidence, traceId },
          "query: hallucination check",
        );
      }

      logger.info(
        { traceId, topK, sourcesFound: sources.length, isHallucination },
        "query: completed",
      );

      return {
        answer,
        sources,
        isHallucination,
        traceId,
      };
    } catch (cause) {
      if (cause instanceof RagError) throw cause;
      throw new RagError(`Query failed: ${String(cause)}`, "RAG_QUERY_FAILED", cause);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async updateFileStatus(
    id: string,
    status: string,
    chunkCount: number,
    errorMessage?: string,
  ): Promise<void> {
    await prisma.syncedFile.update({
      where: { id },
      data: { status, chunkCount, errorMessage: errorMessage ?? null },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

const RAG_SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question using only the provided context.
If the context does not contain enough information, say "I don't have enough information to answer that."
Do not fabricate facts. Be concise and accurate.`;

function buildRagPrompt(question: string, context: string): string {
  return `Context:\n${context}\n\nQuestion: ${question}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
