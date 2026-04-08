import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import path from "path";
import { DocumentLoaderService } from "./document-loader.service";

// ─────────────────────────────────────────────────────────────────────────────
// DocumentLoaderService tests
// ─────────────────────────────────────────────────────────────────────────────

const TMP_DIR = path.join(__dirname, "__tmp_loader_test__");
const TXT_FILE = path.join(TMP_DIR, "sample.txt");
const MD_FILE = path.join(TMP_DIR, "sample.md");

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(TXT_FILE, "Hello from text file");
  writeFileSync(MD_FILE, "# Heading\n\nSome markdown content");
});

afterAll(() => {
  unlinkSync(TXT_FILE);
  unlinkSync(MD_FILE);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require("fs") as typeof import("fs")).rmdirSync(TMP_DIR);
});

describe("DocumentLoaderService", () => {
  const service = new DocumentLoaderService();

  it("loads a .txt file and returns Document[]", async () => {
    const docs = await service.load(TXT_FILE);
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toBe("Hello from text file");
    expect(docs[0].metadata.extension).toBe(".txt");
    expect(docs[0].metadata.fileName).toBe("sample.txt");
  });

  it("loads a .md file and returns Document[]", async () => {
    const docs = await service.load(MD_FILE);
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toContain("Heading");
    expect(docs[0].metadata.extension).toBe(".md");
  });

  it("throws VedaError for unsupported extension", async () => {
    await expect(service.load("/some/file.pdf")).rejects.toThrow("Unsupported file extension");
  });

  it("isSupported returns true for .txt and .md", () => {
    expect(service.isSupported("file.txt")).toBe(true);
    expect(service.isSupported("file.md")).toBe(true);
    expect(service.isSupported("file.mdx")).toBe(true);
  });

  it("isSupported returns false for .pdf and .docx", () => {
    expect(service.isSupported("file.pdf")).toBe(false);
    expect(service.isSupported("file.docx")).toBe(false);
  });
});
