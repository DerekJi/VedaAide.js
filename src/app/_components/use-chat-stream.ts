"use client";

import { useState, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useChatStream — minimal streaming chat hook.
//
// Sends POST /api/query/stream and reads the response body incrementally,
// appending tokens to the last assistant message as they arrive.
// Compatible with the createTextStreamResponse (text/plain) format.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseChatStreamOptions {
  api?: string;
}

export function useChatStream({ api = "/api/query/stream" }: UseChatStreamOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const question = input.trim();
      if (!question || isLoading) return;

      setInput("");
      setError(null);

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "" };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error((err as { error?: string }).error ?? "Request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const token = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // user stopped
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        // Remove the empty assistant placeholder on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, input, isLoading],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, input, handleInputChange, handleSubmit, isLoading, error, stop };
}
