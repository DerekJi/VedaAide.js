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
      const c = makeConnector("fs", {
        filesProcessed: 1,
        filesSkipped: 0,
        filesError: 0,
        errors: [],
      });
      const svc = new DataSourceSyncService([c]);
      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(1);
    });

    it("register() adds a connector after construction", async () => {
      const svc = new DataSourceSyncService();
      svc.register(
        makeConnector("fs", { filesProcessed: 2, filesSkipped: 0, filesError: 0, errors: [] }),
      );
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
      const syncResult: SyncResult = {
        filesProcessed: 5,
        filesSkipped: 1,
        filesError: 0,
        errors: [],
      };
      svc.register(makeConnector("file-system", syncResult));

      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(1);
      expect(result.connectors[0].name).toBe("file-system");
      expect(result.connectors[0].result).toEqual(syncResult);
    });

    it("captures error and continues when one connector throws", async () => {
      const goodResult: SyncResult = {
        filesProcessed: 3,
        filesSkipped: 0,
        filesError: 0,
        errors: [],
      };
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
      svc.register(
        makeConnector("c1", { filesProcessed: 1, filesSkipped: 0, filesError: 0, errors: [] }),
      );
      const result = await svc.syncAll();
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("handles multiple connectors and aggregates all results", async () => {
      svc.register(
        makeConnector("c1", { filesProcessed: 1, filesSkipped: 0, filesError: 0, errors: [] }),
      );
      svc.register(
        makeConnector("c2", { filesProcessed: 2, filesSkipped: 1, filesError: 0, errors: ["e1"] }),
      );
      svc.register(
        makeConnector("c3", { filesProcessed: 0, filesSkipped: 0, filesError: 0, errors: [] }),
      );

      const result = await svc.syncAll();
      expect(result.connectors).toHaveLength(3);
      const names = result.connectors.map((c) => c.name);
      expect(names).toContain("c1");
      expect(names).toContain("c2");
      expect(names).toContain("c3");
    });
  });
});
