import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// TanStack Query hooks for Prompt Template CRUD
// SRP: only query/mutation logic here; UI lives in components/prompts/
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptInput {
  name: string;
  content: string;
}

const KEYS = {
  all: ["prompts"] as const,
  byId: (id: string) => ["prompts", id] as const,
};

export function usePrompts() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: async (): Promise<PromptTemplate[]> => {
      const res = await fetch("/api/prompts");
      if (!res.ok) throw new Error("Failed to fetch prompts");
      return res.json();
    },
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePromptInput): Promise<PromptTemplate> => {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create prompt");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreatePromptInput> & { id: string }): Promise<PromptTemplate> => {
      const res = await fetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update prompt");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.byId(vars.id) });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete prompt");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
