import { MessageBubble } from "./message-bubble";
import type { ChatMessage } from "@/lib/stores/chat.store";

// ─────────────────────────────────────────────────────────────────────────────
// T5: MessageList — renders the full conversation history.
// ─────────────────────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Ask a question to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}
