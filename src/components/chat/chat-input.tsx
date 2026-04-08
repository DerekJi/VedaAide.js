"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// T5: ChatInput — textarea with Send/Stop button.
// Ctrl+Enter or Cmd+Enter submits the message.
// ─────────────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, onStop, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const msg = value.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setValue("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t bg-white p-3 flex gap-2 items-end">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question… (Ctrl+Enter to send)"
        disabled={isLoading}
        rows={2}
        className="flex-1 min-h-0 resize-none"
      />
      {isLoading ? (
        <Button variant="secondary" size="icon" onClick={onStop} aria-label="Stop">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="icon" onClick={submit} disabled={!value.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
