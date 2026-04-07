import { describe, it, expect } from "vitest";
import {
  VedaError,
  RagError,
  VectorStoreError,
  EmbeddingError,
  ChatError,
  AzureConnectionError,
  ValidationError,
  NotConfiguredError,
  toError,
} from "@/lib/errors";

describe("VedaError hierarchy", () => {
  it("VedaError has traceId and code", () => {
    const err = new VedaError("test", "VALIDATION_ERROR");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.traceId).toBeTruthy();
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("RagError is instance of VedaError", () => {
    const err = new RagError("rag error", "RAG_INGEST_FAILED");
    expect(err).toBeInstanceOf(VedaError);
    expect(err.name).toBe("RagError");
  });

  it("VectorStoreError is instance of VedaError", () => {
    const err = new VectorStoreError("vs error", "VECTOR_STORE_READ_FAILED");
    expect(err).toBeInstanceOf(VedaError);
  });

  it("EmbeddingError sets code to EMBEDDING_FAILED", () => {
    const err = new EmbeddingError("embed failed");
    expect(err.code).toBe("EMBEDDING_FAILED");
    expect(err).toBeInstanceOf(VedaError);
  });

  it("ChatError sets code to CHAT_FAILED", () => {
    const err = new ChatError("chat failed");
    expect(err.code).toBe("CHAT_FAILED");
  });

  it("AzureConnectionError sets correct code", () => {
    const err = new AzureConnectionError("azure failed");
    expect(err.code).toBe("AZURE_CONNECTION_FAILED");
  });

  it("ValidationError sets correct code", () => {
    const err = new ValidationError("invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("NotConfiguredError mentions the service name", () => {
    const err = new NotConfiguredError("Ollama");
    expect(err.message).toContain("Ollama");
    expect(err.code).toBe("NOT_CONFIGURED");
  });

  it("toJSON omits sensitive cause", () => {
    const err = new EmbeddingError("test", new Error("network timeout"));
    const json = err.toJSON();
    expect(json).toHaveProperty("traceId");
    expect(json).not.toHaveProperty("cause");
  });

  it("each error has a unique traceId", () => {
    const a = new ChatError("a");
    const b = new ChatError("b");
    expect(a.traceId).not.toBe(b.traceId);
  });
});

describe("toError", () => {
  it("returns the error unchanged if already an Error", () => {
    const original = new Error("original");
    expect(toError(original)).toBe(original);
  });

  it("wraps a string in an Error", () => {
    const err = toError("something bad");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("something bad");
  });

  it("converts numbers to Error", () => {
    expect(toError(42).message).toBe("42");
  });
});
