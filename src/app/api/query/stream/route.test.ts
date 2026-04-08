import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/query/stream/route";

// ─────────────────────────────────────────────────────────────────────────────
// T25: SSE Streaming endpoint tests
// ─────────────────────────────────────────────────────────────────────────────

// ── Mocks ─────────────────────────────────────────────────────────────────────

const embedQueryMock = vi.fn().mockResolvedValue(new Array(384).fill(0));
const similaritySearchMock = vi
  .fn()
  .mockResolvedValue([{ id: "c1", content: "Paris is the capital of France.", score: 0.95 }]);

async function* fakeTokenStream() {
  yield "Paris";
  yield " is";
  yield " the";
  yield " capital";
  yield ".";
}

const chatStreamMock = vi.fn().mockReturnValue(fakeTokenStream());

vi.mock("@/lib/services/ollama-embedding.service", () => ({
  OllamaEmbeddingService: vi.fn().mockImplementation(() => ({
    embedQuery: embedQueryMock,
    embedDocuments: vi.fn(),
  })),
}));

vi.mock("@/lib/vector-store/sqlite-vector-store", () => ({
  SqliteVectorStore: vi.fn().mockImplementation(() => ({
    similaritySearch: similaritySearchMock,
    addDocuments: vi.fn(),
    deleteByFileId: vi.fn(),
  })),
}));

vi.mock("@/lib/services/ollama-chat.service", () => ({
  OllamaChatService: vi.fn().mockImplementation(() => ({
    chat: vi.fn(),
    chatStream: chatStreamMock,
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/query/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Reads all SSE data, returns parsed event objects. */
async function readSseEvents(response: Response): Promise<Record<string, unknown>[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: Record<string, unknown>[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.startsWith("data: ") ? chunk.slice(6) : null;
      if (line) events.push(JSON.parse(line) as Record<string, unknown>);
    }
  }

  return events;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/query/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatStreamMock.mockReturnValue(fakeTokenStream());
    embedQueryMock.mockResolvedValue(new Array(384).fill(0));
    similaritySearchMock.mockResolvedValue([
      { id: "c1", content: "Paris is the capital of France.", score: 0.95 },
    ]);
  });

  it("returns 200 with a streaming SSE response", async () => {
    const req = makeRequest({ question: "What is the capital of France?" });
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.body).toBeTruthy();
  });

  it("streams all tokens then emits a done event", async () => {
    const req = makeRequest({ question: "What is the capital of France?" });
    const response = await POST(req);

    const events = await readSseEvents(response);
    const tokenEvents = events.filter((e) => e.type === "token");
    const doneEvent = events.find((e) => e.type === "done");

    const fullText = tokenEvents.map((e) => e.token as string).join("");
    expect(fullText).toContain("Paris");
    expect(fullText).toContain("capital");
    expect(doneEvent).toBeDefined();
    expect(Array.isArray(doneEvent!.sources)).toBe(true);
    expect(doneEvent!.isHallucination).toBe(false);
  });

  it("calls embedding and vector store with the question", async () => {
    const req = makeRequest({ question: "What is the capital?" });
    await POST(req);

    expect(embedQueryMock).toHaveBeenCalledWith("What is the capital?");
    expect(similaritySearchMock).toHaveBeenCalledWith(expect.any(Array), 5);
  });

  it("respects topK parameter", async () => {
    const req = makeRequest({ question: "test", topK: 3 });
    await POST(req);

    expect(similaritySearchMock).toHaveBeenCalledWith(expect.any(Array), 3);
  });

  it("passes context to chatStream", async () => {
    const req = makeRequest({ question: "What is the capital of France?" });
    await POST(req);

    // Drain the stream via SSE helper
    await readSseEvents(await POST(makeRequest({ question: "test" })));

    expect(chatStreamMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.stringContaining("Paris") }),
      ]),
      expect.objectContaining({ systemPrompt: expect.any(String) }),
    );
  });

  it("returns 400 for empty question", async () => {
    const req = makeRequest({ question: "" });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/query/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it("returns 400 when question is missing", async () => {
    const req = makeRequest({});
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it("returns 500 when embedding fails with VedaError", async () => {
    const { VedaError } = await import("@/lib/errors");
    embedQueryMock.mockRejectedValue(new VedaError("embedding failed", "EMBEDDING_FAILED"));

    const req = makeRequest({ question: "test" });
    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("EMBEDDING_FAILED");
  });

  it("returns 500 for unexpected errors", async () => {
    embedQueryMock.mockRejectedValue(new Error("connection refused"));

    const req = makeRequest({ question: "test" });
    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });
});
