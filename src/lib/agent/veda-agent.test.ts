import { describe, it, expect, vi } from "vitest";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Hoist mocks before any imports (vitest hoists vi.mock() calls)
// We mock @/lib/db here so PrismaClient is never instantiated during tests,
// even if the module graph eventually imports tools.ts → db.ts.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: {
    vectorChunk: { findMany: vi.fn().mockResolvedValue([]) },
    syncedFile: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      messages: [
        { role: "user", content: "test question" },
        { name: "search_knowledge_base", content: '["result"]' },
        { role: "assistant", content: "The answer based on search results is 42." },
      ],
    }),
  }),
}));

import { VedaAgent } from "./veda-agent";

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("VedaAgent", () => {
  const fakeTool = new DynamicStructuredTool({
    name: "fake_tool",
    description: "A fake tool for testing",
    schema: z.object({ input: z.string() }),
    func: async () => "fake result",
  });

  const fakeLlm = {
    invoke: vi.fn().mockResolvedValue({ content: "Answer from LLM" }),
    _llmType: vi.fn().mockReturnValue("fake"),
    _modelType: vi.fn().mockReturnValue("fake"),
    bindTools: vi.fn().mockReturnThis(),
  };

  it("returns output, steps, and traceId", async () => {
    const agent = new VedaAgent({
      llm: fakeLlm as never,
      tools: [fakeTool],
    });

    const result = await agent.invoke("What is the answer?");

    expect(result.output).toBeTruthy();
    expect(result.traceId).toMatch(/^agent-/);
    expect(Array.isArray(result.steps)).toBe(true);
  });

  it("steps contain tool call trace when tool was used", async () => {
    const agent = new VedaAgent({
      llm: fakeLlm as never,
      tools: [fakeTool],
    });

    const result = await agent.invoke("Search for something");

    const toolStep = result.steps.find((s) => s.tool === "search_knowledge_base");
    expect(toolStep).toBeDefined();
  });
});
