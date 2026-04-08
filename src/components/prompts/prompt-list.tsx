"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePrompts, useDeletePrompt, type PromptTemplate } from "@/lib/queries/prompts.queries";
import { useToast } from "@/components/ui/toast";

// ─────────────────────────────────────────────────────────────────────────────
// T12: PromptList — table of all prompt templates with edit / delete actions.
// SRP: only renders the list and delegates CRUD to parent via callbacks.
// ─────────────────────────────────────────────────────────────────────────────

interface PromptListProps {
  onEdit: (prompt: PromptTemplate) => void;
  onNew: () => void;
}

export function PromptList({ onEdit, onNew }: PromptListProps) {
  const { data: prompts = [], isLoading, isError } = usePrompts();
  const deleteMutation = useDeletePrompt();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(prompt: PromptTemplate) {
    if (!confirm(`Delete "${prompt.name} v${prompt.version}"? This cannot be undone.`)) return;
    setDeletingId(prompt.id);
    deleteMutation.mutate(prompt.id, {
      onSuccess: () => {
        toast({ variant: "success", title: "Prompt deleted" });
        setDeletingId(null);
      },
      onError: (err) => {
        toast({ variant: "error", title: "Delete failed", description: err.message });
        setDeletingId(null);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Prompt templates
        </h2>
        <Button size="sm" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New prompt
        </Button>
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400 text-sm">Loading prompts…</div>}

      {isError && (
        <div className="text-center py-8 text-red-500 text-sm">Failed to load prompts.</div>
      )}

      {!isLoading && !isError && prompts.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm border rounded-lg border-dashed">
          No prompts yet. Click &ldquo;New prompt&rdquo; to create one.
        </div>
      )}

      {prompts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Version</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prompts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-500">v{p.version}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? "default" : "secondary"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit prompt"
                        onClick={() => onEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete prompt"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
