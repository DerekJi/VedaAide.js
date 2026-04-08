import { logger } from "@/lib/logger";
import type { IDataSourceConnector, SyncResult } from "@/lib/datasources/file-system.connector";

// ─────────────────────────────────────────────────────────────────────────────
// T20: Data Source Sync Service
// Manages registered connectors and triggers sync on demand or via a route.
// Note: Next.js serverless functions do not support true cron jobs.
// Scheduled sync should be triggered externally (e.g. via Vercel Cron or
// a simple HTTP call from a cron job service).
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncAllResult {
  connectors: {
    name: string;
    result: SyncResult | { error: string };
  }[];
  durationMs: number;
}

export class DataSourceSyncService {
  private readonly connectors: IDataSourceConnector[];

  constructor(connectors: IDataSourceConnector[] = []) {
    this.connectors = connectors;
  }

  register(connector: IDataSourceConnector): void {
    this.connectors.push(connector);
    logger.debug({ connector: connector.name }, "DataSourceSyncService: connector registered");
  }

  /**
   * Sync all registered connectors sequentially.
   * Errors in one connector do not stop others.
   */
  async syncAll(): Promise<SyncAllResult> {
    const start = Date.now();
    logger.info({ connectors: this.connectors.length }, "DataSourceSyncService.syncAll: start");

    const results = [];

    for (const connector of this.connectors) {
      try {
        const result = await connector.sync();
        results.push({ name: connector.name, result });
      } catch (err) {
        const error = String(err);
        logger.error({ connector: connector.name, err }, "DataSourceSyncService: connector failed");
        results.push({ name: connector.name, result: { error } });
      }
    }

    const durationMs = Date.now() - start;
    logger.info({ durationMs, connectors: results.length }, "DataSourceSyncService.syncAll: done");

    return { connectors: results, durationMs };
  }
}
