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

  constructor(baseUrl?: string, model?: string) {
    this.client = new Ollama({ host: baseUrl ?? env.ollama.baseUrl });
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
      throw new EmbeddingError(`Failed to embed query: ${String(cause)}`, cause);
    }
  }

  async embedDocuments(texts: string[]): Promise<Embedding[]> {
    if (texts.length === 0) return [];

    try {
      logger.debug({ model: this.model, count: texts.length }, "embedDocuments");
      const response = await this.client.embed({ model: this.model, input: texts });
      return response.embeddings;
    } catch (cause) {
      throw new EmbeddingError(
        `Failed to embed ${texts.length} document(s): ${String(cause)}`,
        cause,
      );
    }
  }
}
