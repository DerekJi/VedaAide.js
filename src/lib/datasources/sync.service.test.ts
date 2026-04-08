import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataSourceSyncService } from "./sync.service";
import type { IDataSourceConnector, SyncResult } from "./file-system.connector";

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for DataSourceSyncService
// ─────────────────────────────────────────────────────────────────────────────

function makeConnector(name: string, result: SyncResult | Error): IDataSourceConnector {
  return {
    name,
    sync: vi.fn().mockImplementation(() => {
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve(result);
    }),
  };
}

describe("DataSourceSyncService", () => {
  describe("constructor + register", () => {
    it("starts with zero connectors when constructed with no args", async () => {
      const svc = new DataSourceSyncService();
      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(0);
    });

    it("accepts initial connectors via constructor", async () => {
      const c = makeConnector("fs", { processed: 1, skipped: 0, errors: [] });
      const svc = new DataSourceSyncService([c]);
      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(1);
    });

    it("register() adds a connector after construction", async () => {
      const svc = new DataSourceSyncService();
      svc.register(makeConnector("fs", { processed: 2, skipped: 0, errors: [] }));
      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(1);
    });
  });

  describe("syncAll", () => {
    let svc: DataSourceSyncService;

    beforeEach(() => {
      svc = new DataSourceSyncService();
    });

    it("returns empty connectors array when no connectors registered", async () => {
      const result = await svc.syncAll();
      expect(result.connectors).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns success result for a healthy connector", async () => {
      const syncResult: SyncResult = { processed: 5, skipped: 1, errors: [] };
      svc.register(makeConnector("file-system", syncResult));

      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(1);
      expect(result.connectors[0].name).toBe("file-system");
      expect(result.connectors[0].result).toEqual(syncResult);
    });

    it("captures error and continues when one connector throws", async () => {
      const goodResult: SyncResult = { processed: 3, skipped: 0, errors: [] };
      svc.register(makeConnector("good", goodResult));
      svc.register(makeConnector("bad", new Error("network timeout")));

      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(2);

      const good = result.connectors.find((c) => c.name === "good");
      const bad = result.connectors.find((c) => c.name === "bad");

      expect(good?.result).toEqual(goodResult);
      expect((bad?.result as { error: string }).error).toContain("network timeout");
    });

    it("records durationMs for the entire run", async () => {
      svc.register(makeConnector("c1", { processed: 1, skipped: 0, errors: [] }));
      const result = await svc.syncAll();
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("handles multiple connectors and aggregates all results", async () => {
      svc.register(makeConnector("c1", { processed: 1, skipped: 0, errors: [] }));
      svc.register(makeConnector("c2", { processed: 2, skipped: 1, errors: ["e1"] }));
      svc.register(makeConnector("c3", { processed: 0, skipped: 0, errors: [] }));

      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(3);
      const names = result.connectors.map((c) => c.name);
      expect(names).toContain("c1");
      expect(names).toContain("c2");
      expect(names).toContain("c3");
    });
  });
});
