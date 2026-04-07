import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// T23: Server Actions tests
// ─────────────────────────────────────────────────────────────────────────────

const queryMock = vi.fn();
const ingestMock = vi.fn();

vi.mock("@/lib/services/rag.service", () => ({
  RagService: vi.fn().mockImplementation(() => ({
    query: queryMock,
    ingest: ingestMock,
  })),
}));

vi.mock("@/lib/services/ollama-embedding.service", () => ({
  OllamaEmbeddingService: vi.fn(),
}));

vi.mock("@/lib/services/ollama-chat.service", () => ({
  OllamaChatService: vi.fn(),
}));

// Import after mocks are set up
import { queryAction, ingestAction } from "@/app/actions/rag.actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFormData(entries: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

// ── queryAction tests ─────────────────────────────────────────────────────────

describe("queryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns answer when question is valid", async () => {
    queryMock.mockResolvedValue({
      answer: "42",
      sources: [],
      isHallucination: false,
      traceId: "trace-1",
    });

    const fd = makeFormData({ question: "What is the answer?" });
    const result = await queryAction(fd);

    expect(result.data?.answer).toBe("42");
    expect(result.data?.isHallucination).toBe(false);
    expect(result.data?.traceId).toBe("trace-1");
    expect(result.error).toBeUndefined();
    expect(queryMock).toHaveBeenCalledWith({ question: "What is the answer?", topK: undefined });
  });

  it("returns error when question is empty", async () => {
    const fd = makeFormData({ question: "" });
    const result = await queryAction(fd);

    expect(result.error).toBe("Question is required");
    expect(result.data).toBeUndefined();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns error when question field is missing", async () => {
    const fd = makeFormData({});
    const result = await queryAction(fd);

    expect(result.error).toBeDefined();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("passes topK when provided", async () => {
    queryMock.mockResolvedValue({
      answer: "ok",
      sources: [],
      isHallucination: false,
      traceId: "x",
    });

    const fd = makeFormData({ question: "hello", topK: "3" });
    await queryAction(fd);

    expect(queryMock).toHaveBeenCalledWith({ question: "hello", topK: 3 });
  });

  it("returns sanitized error when RagService throws VedaError", async () => {
    const { VedaError } = await import("@/lib/errors");
    queryMock.mockRejectedValue(new VedaError("something failed", "DOCUMENT_LOADER_FAILED"));

    const fd = makeFormData({ question: "hello" });
    const result = await queryAction(fd);

    expect(result.error).toBe("something failed");
    expect(result.data).toBeUndefined();
  });

  it("returns generic error when RagService throws unknown error", async () => {
    queryMock.mockRejectedValue(new Error("Database connection lost"));

    const fd = makeFormData({ question: "hello" });
    const result = await queryAction(fd);

    expect(result.error).toBe("Query failed. Please try again.");
  });
});

// ── ingestAction tests ────────────────────────────────────────────────────────

describe("ingestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ingests from content + source fields", async () => {
    ingestMock.mockResolvedValue({
      fileId: "f1",
      source: "test.md",
      chunkCount: 3,
      skipped: false,
    });

    const fd = makeFormData({ content: "Hello world", source: "test.md" });
    const result = await ingestAction(fd);

    expect(result.data?.fileId).toBe("f1");
    expect(result.data?.chunkCount).toBe(3);
    expect(result.data?.skipped).toBe(false);
    expect(ingestMock).toHaveBeenCalledWith({ content: "Hello world", source: "test.md" });
  });

  it("ingests from File object", async () => {
    ingestMock.mockResolvedValue({
      fileId: "f2",
      source: "doc.txt",
      chunkCount: 1,
      skipped: false,
    });

    const file = new File(["file content here"], "doc.txt", { type: "text/plain" });
    const fd = new FormData();
    fd.append("file", file);

    const result = await ingestAction(fd);

    expect(result.data?.fileId).toBe("f2");
    expect(ingestMock).toHaveBeenCalledWith({ content: "file content here", source: "doc.txt" });
  });

  it("returns error when content is empty", async () => {
    const fd = makeFormData({ content: "", source: "test.md" });
    const result = await ingestAction(fd);

    expect(result.error).toBe("Content is required");
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it("returns error when source is missing", async () => {
    const fd = makeFormData({ content: "Some content" });
    const result = await ingestAction(fd);

    expect(result.error).toBeDefined();
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it("returns sanitized error when RagService throws VedaError", async () => {
    const { VedaError } = await import("@/lib/errors");
    ingestMock.mockRejectedValue(new VedaError("chunking failed", "CHUNKING_FAILED"));

    const fd = makeFormData({ content: "Some content", source: "test.md" });
    const result = await ingestAction(fd);

    expect(result.error).toBe("chunking failed");
  });

  it("returns generic error when RagService throws unknown error", async () => {
    ingestMock.mockRejectedValue(new Error("Disk full"));

    const fd = makeFormData({ content: "Some content", source: "test.md" });
    const result = await ingestAction(fd);

    expect(result.error).toBe("Ingest failed. Please try again.");
  });
});
