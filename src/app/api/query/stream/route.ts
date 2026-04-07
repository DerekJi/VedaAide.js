import { NextRequest } from "next/server";
import { z } from "zod";
import { createTextStreamResponse } from "ai";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { SqliteVectorStore } from "@/lib/vector-store/sqlite-vector-store";
import { logger } from "@/lib/logger";
import { VedaError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// T24: SSE Streaming endpoint
//
// POST /api/query/stream
// Body: { question: string, topK?: number }
// Returns: text/plain; charset=utf-8 (Vercel AI SDK text stream format)
//
// Protocol: each token is written as raw text; the caller uses fetch + ReadableStream
// (e.g. Vercel AI SDK useChat hook) to consume incrementally.
// ─────────────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  question: z.string().min(1, "question is required"),
  topK: z.number().int().min(1).max(20).optional(),
});

// Prompts (mirrored from rag.service.ts — single source of truth kept in RagService for
// non-streaming path; streaming path builds the prompt here to avoid coupling).
const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question using only the provided context.
If the context does not contain enough information, say "I don't have enough information to answer that."
Do not fabricate facts. Be concise and accurate.`;

function buildPrompt(question: string, context: string): string {
  if (!context.trim()) {
    return `No relevant context found.\n\nQuestion: ${question}`;
  }
  return `Context:\n${context}\n\nQuestion: ${question}`;
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

  try {
    // 1. Embed the question
    const embeddingService = new OllamaEmbeddingService();
    const queryEmbedding = await embeddingService.embedQuery(question);

    // 2. Retrieve relevant chunks
    const vectorStore = new SqliteVectorStore();
    const sources = await vectorStore.similaritySearch(queryEmbedding, topK);

    // 3. Build prompt
    const context = sources.map((s, i) => `[${i + 1}] ${s.content}`).join("\n\n");
    const prompt = buildPrompt(question, context);

    logger.info({ traceId, sourcesFound: sources.length }, "stream: starting");

    // 4. Stream the answer using OllamaChatService.chatStream
    const chatService = new OllamaChatService();
    const tokenStream = chatService.chatStream([{ role: "user", content: prompt }], {
      systemPrompt: SYSTEM_PROMPT,
    });

    // 5. Convert AsyncIterable<string> → ReadableStream<string>
    const textStream = asyncIterableToReadableStream(tokenStream);

    return createTextStreamResponse({ textStream });
  } catch (err) {
    if (err instanceof VedaError) {
      logger.error({ code: err.code, traceId, message: err.message }, "stream: error");
      return new Response(JSON.stringify(err.toJSON()), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err, traceId }, "stream: unexpected error");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps an AsyncIterable<string> in a ReadableStream<string> so it can be
 * passed to Vercel AI SDK's createTextStreamResponse.
 */
function asyncIterableToReadableStream(iterable: AsyncIterable<string>): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
