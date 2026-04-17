import { Ollama } from "ollama";
import { EmbeddingError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { Embedding } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Ollama embedding service
// ─────────────────────────────────────────────────────────────────────────────

export class OllamaEmbeddingService implements IEmbeddingService {
  private readonly client: Ollama;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? env.ollama.baseUrl;
    this.client = new Ollama({ host: this.baseUrl });
    this.model = model ?? env.ollama.embeddingModel;
  }

  async embedQuery(text: string): Promise<Embedding> {
    if (!text.trim()) {
      throw new EmbeddingError("Cannot embed empty text");
    }

    try {
      logger.debug({ model: this.model, textLength: text.length }, "embedQuery");
      const response = await this.client.embed({ model: this.model, input: text });
      return response.embeddings[0];
    } catch (cause) {
      const errorMessage =
        cause instanceof Error && cause.message.includes("ECONNREFUSED")
          ? `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running and the model "${this.model}" is pulled.`
          : `Failed to embed query: ${String(cause)}`;
      throw new EmbeddingError(errorMessage, cause);
    }
  }

  async embedDocuments(texts: string[]): Promise<Embedding[]> {
    if (texts.length === 0) return [];

    try {
      logger.debug({ model: this.model, count: texts.length }, "embedDocuments");
      const response = await this.client.embed({ model: this.model, input: texts });
      return response.embeddings;
    } catch (cause) {
      const errorMessage =
        cause instanceof Error && cause.message.includes("ECONNREFUSED")
          ? `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running and the model "${this.model}" is pulled.`
          : `Failed to embed ${texts.length} document(s): ${String(cause)}`;
      throw new EmbeddingError(errorMessage, cause);
    }
  }
}
