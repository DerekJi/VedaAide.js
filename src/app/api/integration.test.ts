import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for core API routes.
// These run entirely in-process (no real HTTP, no Ollama, no real DB).
// Mocks sit at the service boundary so the full routing + validation + response
// shaping code is exercised.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock: Prisma ─────────────────────────────────────────────────────────────
const mockPrismaPromptTemplate = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  prisma: {
    promptTemplate: mockPrismaPromptTemplate,
    syncedFile: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: "file-1",
        name: "doc.md",
        status: "completed",
        chunkCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    vectorChunk: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// ── Mock: Vector store (instantiated directly in query routes) ───────────────
vi.mock("@/lib/vector-store/sqlite-vector-store", () => ({
  SqliteVectorStore: vi.fn().mockImplementation(() => ({
    addDocuments: vi.fn().mockResolvedValue(undefined),
    similaritySearch: vi.fn().mockResolvedValue([
      {
        id: "c1",
        content: "RAG stands for Retrieval-Augmented Generation.",
        score: 0.9,
        metadata: {},
      },
    ]),
    deleteByFileId: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ── Mock: Embedding + Chat services ──────────────────────────────────────────
vi.mock("@/lib/services/ollama-embedding.service", () => ({
  OllamaEmbeddingService: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    embedDocuments: vi
      .fn()
      .mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => new Array(384).fill(0.1))),
      ),
  })),
}));

vi.mock("@/lib/services/ollama-chat.service", () => ({
  OllamaChatService: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue("The answer is 42."),
    chatStream: vi.fn().mockReturnValue(
      (async function* () {
        yield "The ";
        yield "answer ";
        yield "is 42.";
      })(),
    ),
  })),
}));

// ── Mock: PromptService ───────────────────────────────────────────────────────
vi.mock("@/lib/services/prompt.service", () => ({
  PromptService: vi.fn().mockImplementation(() => ({
    createPrompt: vi.fn().mockResolvedValue({
      id: "prompt-1",
      name: "test-prompt",
      content: "Answer briefly.",
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    getActivePrompt: vi.fn().mockResolvedValue("Answer briefly."),
  })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/prompts
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/prompts", () => {
  beforeEach(() => {
    mockPrismaPromptTemplate.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "system-prompt",
        content: "Be helpful.",
        version: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it("returns 200 with prompt list", async () => {
    const { GET } = await import("@/app/api/prompts/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe("system-prompt");
  });
});

describe("POST /api/prompts", () => {
  it("returns 201 with created prompt", async () => {
    const { POST } = await import("@/app/api/prompts/route");
    const req = makeReq("/api/prompts", "POST", {
      name: "test-prompt",
      content: "Answer briefly.",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("test-prompt");
  });

  it("returns 400 for missing content", async () => {
    const { POST } = await import("@/app/api/prompts/route");
    const req = makeReq("/api/prompts", "POST", { name: "incomplete" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ingest (list synced files)
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/ingest", () => {
  it("returns 200 with synced file list", async () => {
    const { GET } = await import("@/app/api/ingest/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/query
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/query", () => {
  it("returns 200 with answer and sources", async () => {
    const { POST } = await import("@/app/api/query/route");
    const req = makeReq("/api/query", "POST", { question: "What is RAG?" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.answer).toBe("string");
    expect(typeof body.isHallucination).toBe("boolean");
    expect(Array.isArray(body.sources)).toBe(true);
  });

  it("returns 400 for empty question", async () => {
    const { POST } = await import("@/app/api/query/route");
    const req = makeReq("/api/query", "POST", { question: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing question", async () => {
    const { POST } = await import("@/app/api/query/route");
    const req = makeReq("/api/query", "POST", {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("respects optional topK parameter", async () => {
    const { POST } = await import("@/app/api/query/route");
    const req = makeReq("/api/query", "POST", { question: "Test", topK: 3 });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
