import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { AzureOpenAIEmbeddingService } from "@/lib/services/azure-openai-embedding.service";
import { LangChainSqliteVectorStore } from "@/lib/vector-store/langchain-sqlite-vector-store";
import { RagService } from "@/lib/services/rag.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { AzureOpenAIChatService } from "@/lib/services/azure-openai-chat.service";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { IEmbeddingService } from "@/lib/services/embedding.service";
import type { IChatService } from "@/lib/services/chat.service";

// ─────────────────────────────────────────────────────────────────────────────
// Agent Tools
// Each tool wraps a VedaAide service and exposes it to a LangGraph ReAct agent.
// Tools return JSON strings so they are compatible with all LLMs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tool: Search the VedaAide knowledge base for relevant document chunks.
 */
export const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description:
    "Search the VedaAide knowledge base for documents relevant to the query. Use this to retrieve context before answering questions.",
  schema: z.object({
    query: z.string().min(1).describe("The search query"),
    topK: z.number().int().min(1).max(20).default(5).describe("Number of results to return"),
  }),
  func: async ({ query, topK }: { query: string; topK: number }) => {
    try {
      // Use Azure OpenAI embedding when configured, else Ollama
      const embeddings: IEmbeddingService = env.azure.openai.isConfigured
        ? new AzureOpenAIEmbeddingService()
        : new OllamaEmbeddingService();
      const vectorStore = new LangChainSqliteVectorStore(embeddings);
      const results = await vectorStore.similaritySearch(query, topK);

      logger.debug({ query, topK, found: results.length }, "agent: search_knowledge_base");

      return JSON.stringify(
        results.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      );
    } catch (err) {
      logger.error({ err, query }, "agent: search_knowledge_base failed");
      return JSON.stringify({ error: String(err) });
    }
  },
});

/**
 * Tool: Ingest a document into the VedaAide knowledge base.
 */
export const ingestDocumentTool = new DynamicStructuredTool({
  name: "ingest_document",
  description:
    "Ingest a text document into the VedaAide knowledge base. Use this to add new information that can later be retrieved.",
  schema: z.object({
    content: z.string().min(1).describe("The full text content of the document"),
    source: z
      .string()
      .min(1)
      .describe("A unique identifier for the document (e.g. filename or URL)"),
    metadata: z.record(z.unknown()).optional().describe("Optional metadata key-value pairs"),
  }),
  func: async ({
    content,
    source,
    metadata,
  }: {
    content: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      // Use Azure OpenAI when configured, else Ollama
      const embeddingService: IEmbeddingService = env.azure.openai.isConfigured
        ? new AzureOpenAIEmbeddingService()
        : new OllamaEmbeddingService();

      const chatService: IChatService = env.azure.openai.isConfigured
        ? new AzureOpenAIChatService()
        : new OllamaChatService();

      const ragService = new RagService(embeddingService, chatService);
      const result = await ragService.ingest({ content, source, metadata });

      logger.debug({ source, chunkCount: result.chunkCount }, "agent: ingest_document");

      return JSON.stringify(result);
    } catch (err) {
      logger.error({ err, source }, "agent: ingest_document failed");
      return JSON.stringify({ error: String(err) });
    }
  },
});

/**
 * Tool: List all ingested documents (SyncedFile records).
 */
export const listDocumentsTool = new DynamicStructuredTool({
  name: "list_documents",
  description:
    "List all documents currently stored in the VedaAide knowledge base with their status and chunk counts.",
  schema: z.object({
    status: z
      .enum(["pending", "processing", "completed", "failed", "all"])
      .default("completed")
      .describe("Filter by sync status"),
  }),
  func: async ({
    status,
  }: {
    status: "pending" | "processing" | "completed" | "failed" | "all";
  }) => {
    try {
      const where = status === "all" ? {} : { status };
      const files = await prisma.syncedFile.findMany({
        where,
        select: {
          id: true,
          name: true,
          source: true,
          status: true,
          chunkCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      logger.debug({ status, found: files.length }, "agent: list_documents");

      return JSON.stringify(files);
    } catch (err) {
      logger.error({ err }, "agent: list_documents failed");
      return JSON.stringify({ error: String(err) });
    }
  },
});

/** All tools available to the VedaAide agent */
export const VEDA_AGENT_TOOLS = [searchKnowledgeBaseTool, ingestDocumentTool, listDocumentsTool];
