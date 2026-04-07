"use client";

import { useChatStream } from "@/app/_components/use-chat-stream";

// ─────────────────────────────────────────────────────────────────────────────
// T26: Minimal chat UI — validates the full browser→Server→LangChain→LLM chain.
// Uses a custom useChatStream hook that reads the plain text stream from
// /api/query/stream and renders each token as it arrives.
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, stop } =
    useChatStream({ api: "/api/query/stream" });

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-8">Ask a question to get started.</p>
        )}
        {messages.map((m, idx) => {
          const isLastAssistant =
            m.role === "assistant" && idx === messages.length - 1 && isLoading;
          return (
            <div
              key={m.id}
              className={`max-w-3xl mx-auto rounded-lg p-3 ${
                m.role === "user"
                  ? "bg-blue-50 text-blue-900 ml-auto"
                  : "bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">
                {m.role}
              </span>
              <p className="whitespace-pre-wrap">
                {m.content}
                {isLastAssistant && (
                  <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          );
        })}
        {error && (
          <div className="max-w-3xl mx-auto rounded-lg p-3 bg-red-50 text-red-700 border border-red-200">
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question about your documents…"
          disabled={isLoading}
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
