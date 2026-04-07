// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for VedaAide
// ─────────────────────────────────────────────────────────────────────────────

// ── Embedding ─────────────────────────────────────────────────────────────────

export type Embedding = number[];

// ── Vector store ──────────────────────────────────────────────────────────────

export interface VectorDocument {
  id?: string;
  content: string;
  embedding: Embedding;
  metadata?: Record<string, unknown>;
  fileId?: string;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number; // cosine similarity [0, 1]
  metadata?: Record<string, unknown>;
  fileId?: string;
}

// ── Document chunking ─────────────────────────────────────────────────────────

export interface ChunkOptions {
  chunkSize?: number; // max characters per chunk (default: 1000)
  chunkOverlap?: number; // overlap between chunks (default: 200)
  separator?: string; // split separator
}

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export interface IngestRequest {
  /** Raw text content to ingest */
  content: string;
  /** Original file name or URL */
  source: string;
  /** Optional metadata attached to every chunk */
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  fileId: string;
  source: string;
  chunkCount: number;
  skipped: boolean; // true if file hash already exists (duplicate)
}

// ── RAG query ─────────────────────────────────────────────────────────────────

export interface RagQueryRequest {
  question: string;
  topK?: number; // default: 5
  metadata?: Record<string, unknown>; // optional metadata filter
}

export interface RagQueryResult {
  answer: string;
  sources: VectorSearchResult[];
  /** Placeholder – hallucination detection implemented in Phase 2 */
  isHallucination: boolean;
  traceId: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

// ── Sync status ───────────────────────────────────────────────────────────────

export type SyncStatus = "pending" | "processing" | "completed" | "failed";
