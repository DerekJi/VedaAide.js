// ─────────────────────────────────────────────────────────────────────────────
// Custom error classes for VedaAide
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorCode =
  | "RAG_INGEST_FAILED"
  | "RAG_QUERY_FAILED"
  | "VECTOR_STORE_WRITE_FAILED"
  | "VECTOR_STORE_READ_FAILED"
  | "EMBEDDING_FAILED"
  | "CHAT_FAILED"
  | "CHUNKING_FAILED"
  | "AZURE_CONNECTION_FAILED"
  | "DB_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_CONFIGURED"
  | "DOCUMENT_LOADER_UNSUPPORTED_TYPE"
  | "DOCUMENT_LOADER_FAILED"
  | "RERANKING_FAILED"
  | "AGENT_FAILED"
  | "MCP_FAILED"
  | "SYNC_FAILED";

export class VedaError extends Error {
  readonly code: ErrorCode;
  readonly traceId: string;
  readonly cause?: unknown;

  constructor(message: string, code: ErrorCode, cause?: unknown) {
    super(message);
    this.name = "VedaError";
    this.code = code;
    this.cause = cause;
    this.traceId = generateTraceId();
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      traceId: this.traceId,
    };
  }
}

export class RagError extends VedaError {
  constructor(
    message: string,
    code: Extract<ErrorCode, "RAG_INGEST_FAILED" | "RAG_QUERY_FAILED">,
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = "RagError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VectorStoreError extends VedaError {
  constructor(
    message: string,
    code: Extract<ErrorCode, "VECTOR_STORE_WRITE_FAILED" | "VECTOR_STORE_READ_FAILED">,
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = "VectorStoreError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmbeddingError extends VedaError {
  constructor(message: string, cause?: unknown) {
    super(message, "EMBEDDING_FAILED", cause);
    this.name = "EmbeddingError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ChatError extends VedaError {
  constructor(message: string, cause?: unknown) {
    super(message, "CHAT_FAILED", cause);
    this.name = "ChatError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AzureConnectionError extends VedaError {
  constructor(message: string, cause?: unknown) {
    super(message, "AZURE_CONNECTION_FAILED", cause);
    this.name = "AzureConnectionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends VedaError {
  constructor(message: string, cause?: unknown) {
    super(message, "VALIDATION_ERROR", cause);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotConfiguredError extends VedaError {
  constructor(service: string) {
    super(`Service not configured: ${service}`, "NOT_CONFIGURED");
    this.name = "NotConfiguredError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Narrows any thrown value to an Error instance */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(String(value));
}
