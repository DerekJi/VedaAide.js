import { create } from "zustand";
import type { VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Chat client-side state (Zustand)
// SRP: only responsible for in-memory chat state; server calls go via TanStack Query.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: VectorSearchResult[];
  isHallucination?: boolean;
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  appendToken: (id: string, token: string) => void;
  finalizeMessage: (
    id: string,
    data: { sources?: VectorSearchResult[]; isHallucination?: boolean },
  ) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content: m.content + token } : m)),
    })),

  finalizeMessage: (id, data) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false, ...data } : m,
      ),
    })),

  clearMessages: () => set({ messages: [] }),
}));
