import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ingestAction } from "@/app/actions/rag.actions";

// ─────────────────────────────────────────────────────────────────────────────
// TanStack Query hooks for RAG ingest and document list
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncedFile {
  id: string;
  name: string;
  source: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

const KEYS = {
  files: ["synced-files"] as const,
};

export function useSyncedFiles() {
  return useQuery({
    queryKey: KEYS.files,
    queryFn: async (): Promise<SyncedFile[]> => {
      const res = await fetch("/api/ingest");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });
}

export function useIngestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await ingestAction(formData);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.files }),
  });
}

export function useSyncMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/datasources/sync", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Sync failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.files }),
  });
}
