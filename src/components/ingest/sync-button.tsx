"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSyncMutation } from "@/lib/queries/rag.queries";

// ─────────────────────────────────────────────────────────────────────────────
// T11: SyncButton — triggers POST /api/datasources/sync to sync all connectors.
// ─────────────────────────────────────────────────────────────────────────────

export function SyncButton() {
  const { mutate, isPending } = useSyncMutation();
  const { toast } = useToast();

  function handleSync() {
    mutate(undefined, {
      onSuccess: (data) => {
        const synced = (data as { synced?: number }).synced ?? 0;
        toast({
          variant: "success",
          title: "Sync complete",
          description: `${synced} file${synced !== 1 ? "s" : ""} processed.`,
        });
      },
      onError: (err) => {
        toast({ variant: "error", title: "Sync failed", description: err.message });
      },
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Syncing…" : "Sync data sources"}
    </Button>
  );
}
