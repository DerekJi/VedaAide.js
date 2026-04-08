import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chat.store";
import type { ChatMessage } from "./chat.store";

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for Zustand ChatStore
// ─────────────────────────────────────────────────────────────────────────────

function makeMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello",
    ...overrides,
  };
}

describe("useChatStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({ messages: [] });
  });

  describe("addMessage", () => {
    it("adds a message to an empty store", () => {
      const msg = makeMessage();
      useChatStore.getState().addMessage(msg);
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0]).toEqual(msg);
    });

    it("appends messages in order", () => {
      const m1 = makeMessage({ id: "1", content: "First" });
      const m2 = makeMessage({ id: "2", content: "Second" });
      useChatStore.getState().addMessage(m1);
      useChatStore.getState().addMessage(m2);
      const { messages } = useChatStore.getState();
      expect(messages[0].id).toBe("1");
      expect(messages[1].id).toBe("2");
    });

    it("preserves all message fields", () => {
      const msg: ChatMessage = {
        id: "a",
        role: "assistant",
        content: "Hi there",
        isHallucination: true,
        isStreaming: false,
        sources: [],
      };
      useChatStore.getState().addMessage(msg);
      expect(useChatStore.getState().messages[0]).toEqual(msg);
    });
  });

  describe("appendToken", () => {
    it("appends a token to the matching message content", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "x", content: "Hello" }));
      useChatStore.getState().appendToken("x", " World");
      expect(useChatStore.getState().messages[0].content).toBe("Hello World");
    });

    it("does not affect other messages", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "a", content: "A" }));
      useChatStore.getState().addMessage(makeMessage({ id: "b", content: "B" }));
      useChatStore.getState().appendToken("a", "1");
      expect(useChatStore.getState().messages[0].content).toBe("A1");
      expect(useChatStore.getState().messages[1].content).toBe("B");
    });

    it("is a no-op when id does not match", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "real", content: "C" }));
      useChatStore.getState().appendToken("nonexistent", "X");
      expect(useChatStore.getState().messages[0].content).toBe("C");
    });
  });

  describe("finalizeMessage", () => {
    it("sets isStreaming to false and merges data", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "f", isStreaming: true }));
      useChatStore.getState().finalizeMessage("f", { isHallucination: true, sources: [] });

      const msg = useChatStore.getState().messages[0];
      expect(msg.isStreaming).toBe(false);
      expect(msg.isHallucination).toBe(true);
      expect(msg.sources).toEqual([]);
    });

    it("does not modify other messages", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "g", content: "G", isStreaming: true }));
      useChatStore.getState().addMessage(makeMessage({ id: "h", content: "H", isStreaming: true }));
      useChatStore.getState().finalizeMessage("g", {});

      expect(useChatStore.getState().messages[0].isStreaming).toBe(false);
      expect(useChatStore.getState().messages[1].isStreaming).toBe(true);
    });
  });

  describe("clearMessages", () => {
    it("empties all messages", () => {
      useChatStore.getState().addMessage(makeMessage({ id: "1" }));
      useChatStore.getState().addMessage(makeMessage({ id: "2" }));
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("is idempotent on empty store", () => {
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });
});
