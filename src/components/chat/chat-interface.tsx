"use client";

import { useChatStream } from "@/app/_components/use-chat-stream";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

// ─────────────────────────────────────────────────────────────────────────────
// T5: ChatInterface — orchestrates useChat hook + MessageList + ChatInput.
// SRP: this component only wires state to UI; business logic is in the hook.
// ─────────────────────────────────────────────────────────────────────────────

export function ChatInterface() {
  const { messages, sendMessage, isLoading, stop } = useChatStream();

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} onStop={stop} isLoading={isLoading} />
    </div>
  );
}
