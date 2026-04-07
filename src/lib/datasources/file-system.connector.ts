import { readdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { RagService } from "@/lib/services/rag.service";
import { DocumentLoaderService } from "@/lib/services/document-loader.service";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { VedaError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Data Source Connector Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  filesProcessed: number;
  filesSkipped: number;
  filesError: number;
  errors: string[];
}

export interface IDataSourceConnector {
  readonly name: string;
  sync(): Promise<SyncResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// T18: File System Connector
// Recursively scans a directory, ingests new/changed files, skips unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface FileSystemConnectorConfig {
  path: string;
  /** File extensions to include (e.g. ['.txt', '.md']) */
  extensions?: string[];
  /** Optional name for this connector */
  name?: string;
}

export class FileSystemConnector implements IDataSourceConnector {
  readonly name: string;
  private readonly loaderService: DocumentLoaderService;
  private readonly ragService: RagService;
  private readonly extensions: Set<string>;

  constructor(
    private readonly config: FileSystemConnectorConfig,
    ragService?: RagService,
  ) {
    this.name = config.name ?? `fs:${config.path}`;
    this.loaderService = new DocumentLoaderService();
    this.ragService =
      ragService ?? new RagService(new OllamaEmbeddingService(), new OllamaChatService());
    this.extensions = new Set(config.extensions ?? [".txt", ".md", ".mdx"]);
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = { filesProcessed: 0, filesSkipped: 0, filesError: 0, errors: [] };

    const files = await this.discoverFiles(this.config.path);
    logger.info(
      { connector: this.name, fileCount: files.length },
      "FileSystemConnector.sync: start",
    );

    for (const filePath of files) {
      try {
        const skipped = await this.syncFile(filePath);
        if (skipped) {
          result.filesSkipped++;
        } else {
          result.filesProcessed++;
        }
      } catch (err) {
        result.filesError++;
        const msg = `Failed to sync ${filePath}: ${String(err)}`;
        result.errors.push(msg);
        logger.error({ filePath, err }, "FileSystemConnector: file sync error");
      }
    }

    logger.info({ connector: this.name, ...result }, "FileSystemConnector.sync: complete");

    return result;
  }

  /**
   * Sync a single file.
   * Returns true if skipped (unchanged), false if ingested.
   */
  private async syncFile(filePath: string): Promise<boolean> {
    if (!this.loaderService.isSupported(filePath)) return true;

    // Load file content to compute hash
    const docs = await this.loaderService.load(filePath);
    if (docs.length === 0) return true;

    const content = docs[0].pageContent;
    const contentHash = crypto.createHash("sha256").update(content, "utf8").digest("hex");

    // Check sync state
    const existingSync = await prisma.syncedFile.findFirst({
      where: { source: filePath },
      select: { contentHash: true },
    });

    if (existingSync?.contentHash === contentHash) {
      logger.debug({ filePath }, "FileSystemConnector: unchanged, skipping");
      return true; // unchanged
    }

    // Ingest (will handle dedup internally)
    await this.ragService.ingest({
      content,
      source: filePath,
      metadata: { connector: this.name, ...docs[0].metadata },
    });

    return false;
  }

  /** Recursively discover all supported files in the configured path */
  private async discoverFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.discoverFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.extensions.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (cause) {
      throw new VedaError(
        `Failed to scan directory "${dirPath}": ${String(cause)}`,
        "SYNC_FAILED",
        cause,
      );
    }

    return files;
  }
}
