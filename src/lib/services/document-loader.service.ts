import path from "path";
import { readFile } from "fs/promises";
import { Document } from "@langchain/core/documents";
import { VedaError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Document Loader Service
// Loads files from disk into LangChain Document objects.
// Supports: .txt, .md, .mdx (text-based). PDF is optional / not implemented.
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".mdx"]);

export class DocumentLoaderService {
  /**
   * Load a file from disk and return an array of LangChain Document objects.
   * Metadata includes the source file path and extension.
   */
  async load(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      throw new VedaError(
        `Unsupported file extension: ${ext}. Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
        "DOCUMENT_LOADER_UNSUPPORTED_TYPE",
      );
    }

    try {
      const content = await readFile(filePath, "utf-8");

      return [
        new Document({
          pageContent: content,
          metadata: {
            source: filePath,
            extension: ext,
            fileName: path.basename(filePath),
            loadedAt: new Date().toISOString(),
          },
        }),
      ];
    } catch (cause) {
      throw new VedaError(
        `Failed to load file "${filePath}": ${String(cause)}`,
        "DOCUMENT_LOADER_FAILED",
        cause,
      );
    }
  }

  /**
   * Returns whether the given file extension is supported.
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }
}
