"use server";

import { z } from "zod";
import { RagService } from "@/lib/services/rag.service";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { VedaError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// T23: Server Actions for RAG operations
// These functions run on the server and are called directly from React
// components with full type safety (no manual fetch boilerplate).
// ─────────────────────────────────────────────────────────────────────────────

// ── Validation schemas ────────────────────────────────────────────────────────

const QuerySchema = z.object({
  question: z.string().min(1, "Question is required"),
  topK: z.number().int().min(1).max(20).optional(),
});

const IngestSchema = z.object({
  content: z.string().min(1, "Content is required"),
  source: z.string().min(1, "Source is required"),
});

// ── Result types ──────────────────────────────────────────────────────────────

export interface ActionResult<T> {
  data?: T;
  error?: string;
}

// ── queryAction ───────────────────────────────────────────────────────────────

/**
 * Server Action: Query the RAG pipeline with a user question.
 * Accepts FormData from a <form> or plain object from JS.
 */
export async function queryAction(
  formData: FormData,
): Promise<ActionResult<{ answer: string; isHallucination: boolean; traceId: string }>> {
  const parsed = QuerySchema.safeParse({
    question: formData.get("question"),
    topK: formData.get("topK") ? Number(formData.get("topK")) : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const ragService = new RagService(new OllamaEmbeddingService(), new OllamaChatService());
    const result = await ragService.query({
      question: parsed.data.question,
      topK: parsed.data.topK,
    });

    return {
      data: {
        answer: result.answer,
        isHallucination: result.isHallucination,
        traceId: result.traceId,
      },
    };
  } catch (err) {
    if (err instanceof VedaError) return { error: err.message };
    return { error: "Query failed. Please try again." };
  }
}

// ── ingestAction ──────────────────────────────────────────────────────────────

/**
 * Server Action: Ingest a text file into the knowledge base.
 * Accepts FormData with a `file` field (File) or `content` + `source` strings.
 */
export async function ingestAction(
  formData: FormData,
): Promise<ActionResult<{ fileId: string; chunkCount: number; skipped: boolean }>> {
  let content: string;
  let source: string;

  const file = formData.get("file");

  if (file instanceof File) {
    content = await file.text();
    source = file.name;
  } else {
    const parsed = IngestSchema.safeParse({
      content: formData.get("content"),
      source: formData.get("source"),
    });
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }
    content = parsed.data.content;
    source = parsed.data.source;
  }

  try {
    const ragService = new RagService(new OllamaEmbeddingService(), new OllamaChatService());
    const result = await ragService.ingest({ content, source });

    return {
      data: {
        fileId: result.fileId,
        chunkCount: result.chunkCount,
        skipped: result.skipped,
      },
    };
  } catch (err) {
    if (err instanceof VedaError) return { error: err.message };
    return { error: "Ingest failed. Please try again." };
  }
}
