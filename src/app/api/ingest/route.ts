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
  const contentType = req.headers.get("content-type") || "";
  let ingestData: z.infer<typeof ingestSchema>;

  // Handle multipart form-data (file upload)
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "file field is required and must be a file" },
          { status: 400 },
        );
      }

      const content = await file.text();
      ingestData = {
        content,
        source: file.name,
        metadata: undefined,
      };
    } catch (err) {
      logger.error({ err }, "failed to parse multipart form-data");
      return NextResponse.json({ error: "Invalid multipart form-data" }, { status: 400 });
    }
  } else {
    // Handle JSON
    const body: unknown = await req.json();
    const parsed = ingestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    ingestData = parsed.data;
  }

  const ragService = new RagService(new OllamaEmbeddingService(), new OllamaChatService());

  try {
    const result = await ragService.ingest(ingestData);
    logger.info({ source: ingestData.source, fileId: result.fileId }, "POST /api/ingest");
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
