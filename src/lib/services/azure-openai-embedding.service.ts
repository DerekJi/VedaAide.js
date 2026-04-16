import { EmbeddingError, NotConfiguredError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getMsiToken } from "@/lib/utils/msi-token";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { Embedding } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Azure OpenAI embedding service
// Supports both API-key auth and Managed Identity (IMDS token).
// ─────────────────────────────────────────────────────────────────────────────

interface AzureEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

export class AzureOpenAIEmbeddingService implements IEmbeddingService {
  private readonly endpoint: string;
  private readonly deploymentName: string;
  private readonly apiVersion: string;
  private readonly apiKey?: string;

  constructor() {
    if (!env.azure.openai.isConfigured) {
      throw new NotConfiguredError("Azure OpenAI");
    }
    this.endpoint = env.azure.openai.endpoint!;
    this.deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-3-small";
    this.apiVersion = env.azure.openai.apiVersion;
    this.apiKey = env.azure.openai.apiKey;
  }

  async embedQuery(text: string): Promise<Embedding> {
    if (!text.trim()) {
      throw new EmbeddingError("Cannot embed empty text");
    }
    const results = await this.embedDocuments([text]);
    return results[0];
  }

  async embedDocuments(texts: string[]): Promise<Embedding[]> {
    const url = `${this.endpoint}openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`;
    try {
      logger.debug({ deployment: this.deploymentName, count: texts.length }, "AzureOpenAI embed");
      const response = await fetch(url, {
        method: "POST",
        headers: await this.buildHeaders(),
        body: JSON.stringify({ input: texts }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new EmbeddingError(`Azure OpenAI embeddings failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as AzureEmbeddingResponse;
      return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (cause) {
      if (cause instanceof EmbeddingError) throw cause;
      throw new EmbeddingError(`Failed to embed query: ${String(cause)}`, cause);
    }
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // API Key is required when using AzureOpenAIEmbeddingService
    // MSI (Managed Identity) is not supported in containerized environment due to IMDS timeout
    if (!this.apiKey) {
      throw new Error(
        "Azure OpenAI API Key is required but not configured (AZURE_OPENAI_API_KEY not set)",
      );
    }
    headers["api-key"] = this.apiKey;
    return headers;
  }
}
