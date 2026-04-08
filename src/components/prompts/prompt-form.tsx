"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useCreatePrompt,
  useUpdatePrompt,
  type PromptTemplate,
} from "@/lib/queries/prompts.queries";
import { useToast } from "@/components/ui/toast";

// ─────────────────────────────────────────────────────────────────────────────
// T13: PromptForm — Dialog for creating / editing a prompt template.
// Uses a simple Textarea as the prompt editor (SRP: UI only, no business logic).
// ─────────────────────────────────────────────────────────────────────────────

interface PromptFormProps {
  /** null = create mode; PromptTemplate = edit mode */
  prompt: PromptTemplate | null;
  open: boolean;
  onClose: () => void;
}

export function PromptForm({ prompt, open, onClose }: PromptFormProps) {
  const isEdit = prompt !== null;
  const createMutation = useCreatePrompt();
  const updateMutation = useUpdatePrompt();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  // Sync form state when the prompt changes
  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setContent(prompt.content);
    } else {
      setName("");
      setContent("");
    }
  }, [prompt, open]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    if (isEdit) {
      updateMutation.mutate(
        { id: prompt.id, name: name.trim(), content: content.trim() },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Prompt updated" });
            onClose();
          },
          onError: (err) => {
            toast({ variant: "error", title: "Update failed", description: err.message });
          },
        },
      );
    } else {
      createMutation.mutate(
        { name: name.trim(), content: content.trim() },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Prompt created" });
            onClose();
          },
          onError: (err) => {
            toast({ variant: "error", title: "Create failed", description: err.message });
          },
        },
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit prompt" : "New prompt"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prompt-name">Name</Label>
            <Input
              id="prompt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. rag-system-prompt"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-content">Content</Label>
            <Textarea
              id="prompt-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your prompt template here…"
              required
              disabled={isPending}
              rows={10}
              className="font-mono text-sm resize-y"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !name.trim() || !content.trim()}>
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
