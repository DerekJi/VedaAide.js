import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { OllamaEmbeddingService } from "@/lib/services/ollama-embedding.service";
import { LangChainSqliteVectorStore } from "@/lib/vector-store/langchain-sqlite-vector-store";
import { RagService } from "@/lib/services/rag.service";
import { OllamaChatService } from "@/lib/services/ollama-chat.service";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server Route  – GET /api/mcp, POST /api/mcp
// Implements the Model Context Protocol server using WebStandard HTTP transport.
// Exposes VedaAide tools that external clients (VS Code Copilot, etc.) can call.
// ─────────────────────────────────────────────────────────────────────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "vedaaide",
    version: "1.0.0",
  });

  // ── Tool: search_knowledge_base ────────────────────────────────────────────
  server.tool(
    "search_knowledge_base",
    "Search the VedaAide knowledge base for relevant document chunks.",
    {
      query: z.string().min(1).describe("Search query"),
      topK: z.number().int().min(1).max(20).default(5).describe("Number of results"),
    },
    async ({ query, topK }: { query: string; topK: number }) => {
      try {
        const embeddings = new OllamaEmbeddingService();
        const vectorStore = new LangChainSqliteVectorStore(embeddings);
        const results = await vectorStore.similaritySearch(query, topK);

        logger.debug({ query, topK, found: results.length }, "MCP: search_knowledge_base");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                results.map((doc: { pageContent: string; metadata?: Record<string, unknown> }) => ({
                  content: doc.pageContent,
                  metadata: doc.metadata,
                })),
              ),
            },
          ],
        };
      } catch (err) {
        logger.error({ err, query }, "MCP: search_knowledge_base failed");
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
          isError: true,
        };
      }
    },
  );

  // ── Tool: ingest_document ──────────────────────────────────────────────────
  server.tool(
    "ingest_document",
    "Ingest a text document into the VedaAide knowledge base.",
    {
      content: z.string().min(1).describe("Full text content of the document"),
      source: z.string().min(1).describe("Unique identifier (e.g. filename or URL)"),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
    },
    async ({ content, source, metadata }) => {
      try {
        const ragService = new RagService(new OllamaEmbeddingService(), new OllamaChatService());
        const result = await ragService.ingest({ content, source, metadata });

        logger.debug({ source, chunkCount: result.chunkCount }, "MCP: ingest_document");

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        logger.error({ err, source }, "MCP: ingest_document failed");
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
          isError: true,
        };
      }
    },
  );

  return server;
}

// ─────────────────────────────────────────────────────────────────────────────
// Next.js App Router handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function DELETE(request: Request) {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
