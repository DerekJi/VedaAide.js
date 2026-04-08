import { cn } from "@/lib/utils";
import { HallucinationBadge } from "./hallucination-badge";
import { SourcesPanel } from "./sources-panel";
import type { ChatMessage } from "@/lib/stores/chat.store";

// ─────────────────────────────────────────────────────────────────────────────
// T5: MessageBubble — renders a single chat message with optional sources
// and hallucination badge.
// ─────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("max-w-3xl mx-auto", isUser && "ml-auto")}>
      <div
        className={cn(
          "rounded-xl p-3.5",
          isUser ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60 block mb-1">
          {message.role}
        </span>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
          )}
        </p>
      </div>

      {/* Sources and hallucination badge (assistant only, after streaming finishes) */}
      {!isUser && !message.isStreaming && (
        <div className="mt-1 px-1">
          {message.isHallucination && <HallucinationBadge />}
          {message.sources && message.sources.length > 0 && (
            <SourcesPanel sources={message.sources} />
          )}
        </div>
      )}
    </div>
  );
}
