import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import type { ChatMessage } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mock ollama module
// ─────────────────────────────────────────────────────────────────────────────

const mockChat = vi.fn();

vi.mock("ollama", () => ({
  Ollama: vi.fn().mockImplementation(() => ({ chat: mockChat })),
}));

const userMessages: ChatMessage[] = [{ role: "user", content: "Hello" }];

describe("OllamaChatService", () => {
  let service: OllamaChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OllamaChatService("http://localhost:11434", "llama3.2");
  });

  // ── chat ──────────────────────────────────────────────────────────────────────

  describe("chat", () => {
    it("returns the assistant reply", async () => {
      mockChat.mockResolvedValueOnce({ message: { content: "Hi there!" } });
      const result = await service.chat(userMessages);
      expect(result).toBe("Hi there!");
    });

    it("prepends system prompt when provided", async () => {
      mockChat.mockResolvedValueOnce({ message: { content: "response" } });
      await service.chat(userMessages, { systemPrompt: "You are helpful." });

      const callArg = mockChat.mock.calls[0][0] as { messages: { role: string }[] };
      expect(callArg.messages[0].role).toBe("system");
    });

    it("wraps errors as ChatError", async () => {
      mockChat.mockRejectedValueOnce(new Error("timeout"));
      const { ChatError } = await import("@/lib/errors");
      await expect(service.chat(userMessages)).rejects.toBeInstanceOf(ChatError);
    });
  });

  // ── chatStream ────────────────────────────────────────────────────────────────

  describe("chatStream", () => {
    it("yields chunks from streaming response", async () => {
      async function* fakeStream() {
        yield { message: { content: "Hello" } };
        yield { message: { content: " World" } };
      }
      mockChat.mockResolvedValueOnce(fakeStream());

      const chunks: string[] = [];
      for await (const chunk of service.chatStream(userMessages)) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(["Hello", " World"]);
    });

    it("wraps errors as ChatError", async () => {
      mockChat.mockRejectedValueOnce(new Error("connection refused"));
      const { ChatError } = await import("@/lib/errors");

      const stream = service.chatStream(userMessages);
      await expect(stream[Symbol.asyncIterator]().next()).rejects.toBeInstanceOf(ChatError);
    });
  });
});
