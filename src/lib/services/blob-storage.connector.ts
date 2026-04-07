import { AzureConnectionError, NotConfiguredError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Azure Blob Storage connector
// ─────────────────────────────────────────────────────────────────────────────

export interface BlobItem {
  name: string;
  contentType?: string;
  contentLength?: number;
  lastModified?: string;
}

export class BlobStorageConnector {
  private readonly accountName: string;
  private readonly containerName: string;
  private readonly accountKey?: string;

  constructor() {
    if (!env.azure.blob.isConfigured) {
      throw new NotConfiguredError("Azure Blob Storage");
    }
    this.accountName = env.azure.blob.accountName!;
    this.containerName = env.azure.blob.containerName!;
    this.accountKey = env.azure.blob.accountKey;
  }

  private get baseUrl(): string {
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      "x-ms-version": "2020-04-08",
      "x-ms-date": new Date().toUTCString(),
      ...(this.accountKey
        ? { Authorization: `SharedKey ${this.accountName}:${this.accountKey}` }
        : {}),
    };
  }

  /** List blobs in the container */
  async listBlobs(): Promise<BlobItem[]> {
    const url = `${this.baseUrl}?restype=container&comp=list`;
    try {
      logger.debug({ container: this.containerName }, "listBlobs");
      const response = await fetch(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        const text = await response.text();
        throw new AzureConnectionError(`Blob list failed (${response.status}): ${text}`);
      }

      const xml = await response.text();
      return parseBlobListXml(xml);
    } catch (cause) {
      if (cause instanceof AzureConnectionError) throw cause;
      throw new AzureConnectionError(`Blob list error: ${String(cause)}`, cause);
    }
  }

  /** Download a blob as text */
  async downloadText(blobName: string): Promise<string> {
    const url = `${this.baseUrl}/${encodeURIComponent(blobName)}`;
    try {
      logger.debug({ blobName }, "downloadText");
      const response = await fetch(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        const text = await response.text();
        throw new AzureConnectionError(`Blob download failed (${response.status}): ${text}`);
      }

      return response.text();
    } catch (cause) {
      if (cause instanceof AzureConnectionError) throw cause;
      throw new AzureConnectionError(`Blob download error: ${String(cause)}`, cause);
    }
  }

  /** Test connectivity */
  async ping(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}?restype=container`;
      const response = await fetch(url, { headers: this.buildHeaders() });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML parser (minimal – avoids external dependency)
// ─────────────────────────────────────────────────────────────────────────────

function parseBlobListXml(xml: string): BlobItem[] {
  const blobs: BlobItem[] = [];
  const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/g;

  let match: RegExpExecArray | null;
  while ((match = blobRegex.exec(xml)) !== null) {
    const blobXml = match[1];
    const name = extractTag(blobXml, "Name") ?? "";
    const contentType = extractTag(blobXml, "Content-Type");
    const contentLength = extractTag(blobXml, "Content-Length");
    const lastModified = extractTag(blobXml, "Last-Modified");

    blobs.push({
      name,
      contentType: contentType ?? undefined,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      lastModified: lastModified ?? undefined,
    });
  }
  return blobs;
}

function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? match[1] : null;
}
