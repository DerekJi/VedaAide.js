"use client";

import { useState } from "react";
import { PromptList } from "@/components/prompts/prompt-list";
import { PromptForm } from "@/components/prompts/prompt-form";
import { type PromptTemplate } from "@/lib/queries/prompts.queries";

// ─────────────────────────────────────────────────────────────────────────────
// T12: Prompt management page — thin composition of PromptList + PromptForm.
// State: which prompt is being edited (null = create mode, undefined = closed).
// ─────────────────────────────────────────────────────────────────────────────

export default function PromptsPage() {
  const [editing, setEditing] = useState<PromptTemplate | null | undefined>(undefined);

  const isOpen = editing !== undefined;

  function openCreate() {
    setEditing(null);
  }

  function openEdit(prompt: PromptTemplate) {
    setEditing(prompt);
  }

  function close() {
    setEditing(undefined);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Prompt Templates</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage reusable prompt templates for your AI assistant.
          </p>
        </div>

        <PromptList onEdit={openEdit} onNew={openCreate} />

        <PromptForm prompt={editing ?? null} open={isOpen} onClose={close} />
      </div>
    </div>
  );
}
