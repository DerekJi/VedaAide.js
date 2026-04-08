import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RagService } from "@/lib/services/rag.service";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { VedaError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ingest  – List all synced files (most recent first)
// POST /api/ingest – Ingest a document
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const files = await prisma.syncedFile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      source: true,
      status: true,
      chunkCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(files);
}

const ingestSchema = z.object({
  content: z.string().min(1, "content is required"),
  source: z.string().min(1, "source is required"),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const ragService = new RagService(new OllamaEmbeddingService(), new OllamaChatService());

  try {
    const result = await ragService.ingest(parsed.data);
    logger.info({ source: parsed.data.source, fileId: result.fileId }, "POST /api/ingest");
    return NextResponse.json(result, { status: result.skipped ? 200 : 201 });
  } catch (err) {
    if (err instanceof VedaError) {
      logger.error({ code: err.code, traceId: err.traceId, message: err.message }, "ingest failed");
      return NextResponse.json(err.toJSON(), { status: 500 });
    }
    logger.error({ err }, "unexpected ingest error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
