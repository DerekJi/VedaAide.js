import { NextRequest } from "next/server";
import { z } from "zod";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { SqliteVectorStore } from "@/lib/vector-store/sqlite-vector-store";
import { logger } from "@/lib/logger";
import { VedaError } from "@/lib/errors";
import type { VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/query/stream
// Body: { question: string, topK?: number }
//
// Returns: text/event-stream (SSE)
// SSE event protocol:
//   data: {"type":"token","token":"..."}\n\n
//   data: {"type":"done","sources":[...],"isHallucination":false,"traceId":"..."}\n\n
//
// Clients use fetch + ReadableStream.getReader() to parse events line-by-line.
// ─────────────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  question: z.string().min(1, "question is required"),
  topK: z.number().int().min(1).max(20).optional(),
});

const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question using only the provided context.
If the context does not contain enough information, say "I don't have enough information to answer that."
Do not fabricate facts. Be concise and accurate.`;

function buildPrompt(question: string, context: string): string {
  if (!context.trim()) {
    return `No relevant context found.\n\nQuestion: ${question}`;
  }
  return `Context:\n${context}\n\nQuestion: ${question}`;
}

/** Encode one SSE message. */
function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.format() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, topK = 5 } = parsed.data;
  const traceId = `stream-${Date.now().toString(36)}`;

  let sources: VectorSearchResult[] = [];

  try {
    // 1. Embed the question
    const embeddingService = new OllamaEmbeddingService();
    const queryEmbedding = await embeddingService.embedQuery(question);

    // 2. Retrieve relevant chunks
    const vectorStore = new SqliteVectorStore();
    sources = await vectorStore.similaritySearch(queryEmbedding, topK);

    // 3. Build prompt
    const context = sources.map((s, i) => `[${i + 1}] ${s.content}`).join("\n\n");
    const prompt = buildPrompt(question, context);

    logger.info({ traceId, sourcesFound: sources.length }, "stream: starting");

    // 4. Create SSE stream
    const chatService = new OllamaChatService();
    const tokenIterable = chatService.chatStream([{ role: "user", content: prompt }], {
      systemPrompt: SYSTEM_PROMPT,
    });

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const token of tokenIterable) {
            controller.enqueue(encoder.encode(sseEvent({ type: "token", token })));
          }
          // Emit done with metadata
          controller.enqueue(
            encoder.encode(sseEvent({ type: "done", sources, isHallucination: false, traceId })),
          );
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof VedaError) {
      logger.error(
        {
          code: err.code,
          traceId,
          message: err.message,
          cause: err.cause instanceof Error ? err.cause.message : String(err.cause),
        },
        "stream: veda error",
      );
      return new Response(JSON.stringify(err.toJSON()), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle generic errors with better logging
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logger.error(
      {
        traceId,
        errorType: err?.constructor?.name ?? "Unknown",
        message: errorMessage,
        stack: errorStack,
      },
      "stream: unexpected error",
    );

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: errorMessage,
        traceId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
