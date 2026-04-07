import { describe, it, expect, vi } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HallucinationGuardService } from "./hallucination-guard.service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fakeEmbeddings(queryVec = [1, 0, 0]): EmbeddingsInterface {
  return {
    embedQuery: vi.fn().mockResolvedValue(queryVec),
    embedDocuments: vi.fn().mockImplementation(
      (texts: string[]) => Promise.resolve(texts.map(() => [1, 0, 0])), // identical to query → high similarity
    ),
  };
}

function fakeLlm(response: string): BaseChatModel {
  return {
    invoke: vi.fn().mockResolvedValue({ content: response }),
  } as unknown as BaseChatModel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("HallucinationGuardService", () => {
  describe("checkAnswerGrounding (Layer 1)", () => {
    it("returns isHallucination=false when similarity is high", async () => {
      // Answer embedding [1,0,0] vs context [1,0,0] → sim=1.0 ≥ threshold 0.3
      const service = new HallucinationGuardService(fakeEmbeddings());
      const result = await service.checkAnswerGrounding("the answer", ["context text"]);

      expect(result.isHallucination).toBe(false);
      expect(result.confidence).toBeCloseTo(1.0);
    });

    it("returns isHallucination=true when similarity is low", async () => {
      const lowSimilarityEmbeddings: EmbeddingsInterface = {
        embedQuery: vi.fn().mockResolvedValue([1, 0, 0]),
        embedDocuments: vi.fn().mockResolvedValue([[0, 1, 0]]), // orthogonal → sim=0
      };
      const service = new HallucinationGuardService(lowSimilarityEmbeddings, undefined, {
        embeddingThreshold: 0.3,
      });
      const result = await service.checkAnswerGrounding("answer", ["context"]);

      expect(result.isHallucination).toBe(true);
      expect(result.confidence).toBeCloseTo(0);
    });

    it("returns isHallucination=true when context is empty", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings());
      const result = await service.checkAnswerGrounding("answer", []);

      expect(result.isHallucination).toBe(true);
      expect(result.confidence).toBe(0);
    });
  });

  describe("verifySelfCheck (Layer 2)", () => {
    it("returns true when LLM says YES", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings(), fakeLlm("YES"));
      expect(await service.verifySelfCheck("answer", "context")).toBe(true);
    });

    it("returns false when LLM says NO", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings(), fakeLlm("NO"));
      expect(await service.verifySelfCheck("answer", "context")).toBe(false);
    });

    it("throws when LLM is not configured", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings());
      await expect(service.verifySelfCheck("a", "b")).rejects.toThrow("LLM not configured");
    });
  });

  describe("check (combined)", () => {
    it("runs only layer 1 when selfCheck is disabled", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings(), undefined, {
        enableSelfCheck: false,
      });
      const result = await service.check("answer", ["context"]);

      expect(result.selfCheckRan).toBe(false);
      expect(result.selfCheckResult).toBeUndefined();
    });

    it("runs layer 2 when selfCheck is enabled and LLM is provided", async () => {
      const service = new HallucinationGuardService(fakeEmbeddings(), fakeLlm("YES"), {
        enableSelfCheck: true,
      });
      const result = await service.check("answer", ["context"]);

      expect(result.selfCheckRan).toBe(true);
      expect(result.selfCheckResult).toBe(true);
    });

    it("marks as hallucination when layer 2 says NO", async () => {
      // Layer 1 passes (high similarity), but layer 2 says NO
      const service = new HallucinationGuardService(fakeEmbeddings(), fakeLlm("NO"), {
        enableSelfCheck: true,
        embeddingThreshold: 0.3,
      });
      const result = await service.check("answer", ["context"]);

      expect(result.selfCheckResult).toBe(false);
      expect(result.isHallucination).toBe(true);
    });
  });
});
