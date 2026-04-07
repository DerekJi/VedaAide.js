import { NextResponse } from "next/server";
import { DataSourceSyncService } from "@/lib/datasources/sync.service";
import { FileSystemConnector } from "@/lib/datasources/file-system.connector";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/datasources/sync
// Manually trigger sync of all registered data source connectors.
// In production, this endpoint should be protected by authentication.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const syncService = new DataSourceSyncService();

  // Register file system connector if DATA_SYNC_PATH is configured
  if (process.env.DATA_SYNC_PATH) {
    syncService.register(
      new FileSystemConnector({
        path: process.env.DATA_SYNC_PATH,
        name: "default-fs",
      }),
    );
  } else if (env.isDevelopment) {
    logger.warn("POST /api/datasources/sync: DATA_SYNC_PATH not set, no connectors registered");
  }

  try {
    const result = await syncService.syncAll();
    logger.info({ durationMs: result.durationMs }, "POST /api/datasources/sync: complete");
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "POST /api/datasources/sync: failed");
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
