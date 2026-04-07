import { AzureConnectionError, NotConfiguredError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Cosmos DB connector (compatibility / CRUD verification)
// ─────────────────────────────────────────────────────────────────────────────

export interface CosmosItem {
  id: string;
  [key: string]: unknown;
}

export class CosmosDbConnector {
  private readonly endpoint: string;
  private readonly database: string;
  private readonly container: string;
  private readonly key?: string;

  constructor() {
    if (!env.azure.cosmos.isConfigured) {
      throw new NotConfiguredError("Azure Cosmos DB");
    }
    this.endpoint = env.azure.cosmos.endpoint!;
    this.database = env.azure.cosmos.database!;
    this.container = env.azure.cosmos.container!;
    this.key = env.azure.cosmos.key;
  }

  private get baseUrl(): string {
    return `${this.endpoint}dbs/${this.database}/colls/${this.container}`;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const date = new Date().toUTCString();
    return {
      "Content-Type": "application/json",
      "x-ms-date": date,
      "x-ms-version": "2018-12-31",
      ...(this.key ? { Authorization: `type=master&ver=1.0&sig=${this.key}` } : {}),
      ...extra,
    };
  }

  async upsert(item: CosmosItem): Promise<CosmosItem> {
    const url = `${this.baseUrl}/docs`;
    try {
      logger.debug({ id: item.id }, "CosmosDB upsert");
      const response = await fetch(url, {
        method: "POST",
        headers: { ...this.buildHeaders(), "x-ms-documentdb-is-upsert": "true" },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AzureConnectionError(`Cosmos upsert failed (${response.status}): ${text}`);
      }

      return (await response.json()) as CosmosItem;
    } catch (cause) {
      if (cause instanceof AzureConnectionError) throw cause;
      throw new AzureConnectionError(`Cosmos upsert error: ${String(cause)}`, cause);
    }
  }

  async get(id: string): Promise<CosmosItem | null> {
    const url = `${this.baseUrl}/docs/${id}`;
    try {
      const response = await fetch(url, { headers: this.buildHeaders() });
      if (response.status === 404) return null;

      if (!response.ok) {
        const text = await response.text();
        throw new AzureConnectionError(`Cosmos get failed (${response.status}): ${text}`);
      }

      return (await response.json()) as CosmosItem;
    } catch (cause) {
      if (cause instanceof AzureConnectionError) throw cause;
      throw new AzureConnectionError(`Cosmos get error: ${String(cause)}`, cause);
    }
  }

  async delete(id: string): Promise<void> {
    const url = `${this.baseUrl}/docs/${id}`;
    try {
      const response = await fetch(url, { method: "DELETE", headers: this.buildHeaders() });
      if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new AzureConnectionError(`Cosmos delete failed (${response.status}): ${text}`);
      }
    } catch (cause) {
      if (cause instanceof AzureConnectionError) throw cause;
      throw new AzureConnectionError(`Cosmos delete error: ${String(cause)}`, cause);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const url = `${this.endpoint}dbs/${this.database}`;
      const response = await fetch(url, { headers: this.buildHeaders() });
      return response.ok;
    } catch {
      return false;
    }
  }
}
