import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RagService } from "@/lib/services/rag.service";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { AzureOpenAIEmbeddingService } from "@/lib/services/azure-openai-embedding.service";
import { AzureOpenAIChatService } from "@/lib/services/azure-openai-chat.service";
import { logger } from "@/lib/logger";
import { VedaError } from "@/lib/errors";
import { env } from "@/lib/env";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { IChatService } from "@/lib/services/chat.service";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/query
// ─────────────────────────────────────────────────────────────────────────────

const querySchema = z.object({
  question: z.string().min(1, "question is required"),
  topK: z.number().int().min(1).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();
  const parsed = querySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  // Use Azure OpenAI when configured, else Ollama
  const embeddingService: IEmbeddingService = env.azure.openai.isConfigured
    ? new AzureOpenAIEmbeddingService()
    : new OllamaEmbeddingService();

  const chatService: IChatService = env.azure.openai.isConfigured
    ? new AzureOpenAIChatService()
    : new OllamaChatService();

  const ragService = new RagService(embeddingService, chatService);

  try {
    const result = await ragService.query(parsed.data);
    logger.info(
      { traceId: result.traceId, sourcesFound: result.sources.length },
      "POST /api/query",
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VedaError) {
      logger.error({ code: err.code, traceId: err.traceId, message: err.message }, "query failed");
      return NextResponse.json(err.toJSON(), { status: 500 });
    }
    logger.error({ err }, "unexpected query error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
