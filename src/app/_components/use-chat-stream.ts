"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/lib/stores/chat.store";

// ─────────────────────────────────────────────────────────────────────────────
// useChatStream — streaming chat hook backed by Zustand store.
//
// Sends POST /api/query/stream and reads the SSE response:
//   data: {"type":"token","token":"..."}
//   data: {"type":"done","sources":[...],"isHallucination":false,"traceId":"..."}
// ─────────────────────────────────────────────────────────────────────────────

export type { ChatMessage } from "@/lib/stores/chat.store";

interface UseChatStreamOptions {
  api?: string;
}

export function useChatStream({ api = "/api/query/stream" }: UseChatStreamOptions = {}) {
  const { messages, addMessage, appendToken, finalizeMessage } = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim()) return;

      const userMsg = { id: `u-${Date.now()}`, role: "user" as const, content: question };
      const assistantId = `a-${Date.now()}`;
      addMessage(userMsg);
      addMessage({ id: assistantId, role: "assistant", content: "", isStreaming: true });

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
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const dataLine = line.startsWith("data: ") ? line.slice(6) : null;
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine) as Record<string, unknown>;
              if (event.type === "token") {
                appendToken(assistantId, event.token as string);
              } else if (event.type === "done") {
                finalizeMessage(assistantId, {
                  sources: (event.sources as never[]) ?? [],
                  isHallucination: (event.isHallucination as boolean) ?? false,
                });
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        finalizeMessage(assistantId, {});
      } finally {
        abortRef.current = null;
      }
    },
    [api, addMessage, appendToken, finalizeMessage],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const isLoading = messages.some((m) => m.role === "assistant" && m.isStreaming);

  return { messages, sendMessage, isLoading, stop };
}
