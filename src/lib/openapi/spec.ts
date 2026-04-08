import type { OpenAPIV3 } from "openapi-types";

// ─────────────────────────────────────────────────────────────────────────────
// T6: OpenAPI 3.0 specification for the VedaAide API.
// This module is imported by the /api/openapi route and by documentation tools.
// ─────────────────────────────────────────────────────────────────────────────

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "VedaAide API",
    version: "1.0.0",
    description:
      "REST API for VedaAide — a Retrieval-Augmented Generation (RAG) assistant with document ingestion, semantic search, and hallucination detection.",
    contact: {
      name: "VedaAide Team",
    },
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
    { url: "https://vedaaide-staging.azurecontainerapps.io", description: "Staging" },
    { url: "https://vedaaide.azurecontainerapps.io", description: "Production" },
  ],
  tags: [
    { name: "Health", description: "Service health & readiness" },
    { name: "RAG", description: "Retrieval-Augmented Generation" },
    { name: "Ingest", description: "Document ingestion & management" },
    { name: "Prompts", description: "Prompt template management" },
    { name: "DataSources", description: "External data source sync" },
    { name: "Agent", description: "AI agent orchestration" },
    { name: "MCP", description: "Model Context Protocol server" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns service health status and current timestamp.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: { status: "ok", timestamp: "2026-04-08T12:00:00.000Z", version: "1.0.0" },
              },
            },
          },
        },
      },
    },

    "/api/query": {
      post: {
        tags: ["RAG"],
        summary: "RAG query",
        description:
          "Submit a question; the system retrieves relevant document chunks and generates an answer with hallucination detection.",
        operationId: "ragQuery",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RagQueryRequest" },
              example: { question: "What is Retrieval-Augmented Generation?", topK: 5 },
            },
          },
        },
        responses: {
          "200": {
            description: "Query completed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RagQueryResult" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/query/stream": {
      post: {
        tags: ["RAG"],
        summary: "Streaming RAG query (SSE)",
        description:
          'Same as /api/query but streams the answer token-by-token via Server-Sent Events. Events: `{type:"token",token:string}`, `{type:"done",sources:[...],isHallucination:bool}`.',
        operationId: "ragQueryStream",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RagQueryRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "SSE stream",
            content: {
              "text/event-stream": {
                schema: { type: "string", description: "Server-Sent Events stream" },
              },
            },
          },
          "400": {
            description: "Invalid request",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/ingest": {
      get: {
        tags: ["Ingest"],
        summary: "List ingested files",
        description: "Returns all synced files ordered by creation date (most recent first).",
        operationId: "listIngestedFiles",
        responses: {
          "200": {
            description: "List of synced files",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SyncedFile" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Ingest"],
        summary: "Ingest a document",
        description:
          "Ingest a text document into the knowledge base. Performs dual-layer deduplication before storing chunks.",
        operationId: "ingestDocument",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IngestRequest" },
              example: {
                content: "# My Document\n\nThis document explains...",
                source: "my-doc.md",
                metadata: { author: "Alice" },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Document already existed (deduplicated)",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/IngestResult" } },
            },
          },
          "201": {
            description: "Document ingested successfully",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/IngestResult" } },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/prompts": {
      get: {
        tags: ["Prompts"],
        summary: "List prompt templates",
        description: "Returns all prompt templates ordered by version (descending).",
        operationId: "listPrompts",
        responses: {
          "200": {
            description: "List of prompt templates",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PromptTemplate" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Prompts"],
        summary: "Create prompt template",
        description: "Creates a new prompt template. Version is auto-incremented.",
        operationId: "createPrompt",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePromptRequest" },
              example: { name: "system-prompt", content: "You are a helpful assistant." },
            },
          },
        },
        responses: {
          "201": {
            description: "Prompt template created",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PromptTemplate" } },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/prompts/{id}": {
      put: {
        tags: ["Prompts"],
        summary: "Update prompt template",
        operationId: "updatePrompt",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Prompt template ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePromptRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Prompt template updated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PromptTemplate" } },
            },
          },
          "404": {
            description: "Prompt template not found",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
      delete: {
        tags: ["Prompts"],
        summary: "Delete prompt template",
        operationId: "deletePrompt",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Prompt template ID",
          },
        ],
        responses: {
          "204": { description: "Prompt template deleted" },
          "404": {
            description: "Prompt template not found",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/datasources/sync": {
      post: {
        tags: ["DataSources"],
        summary: "Trigger data source sync",
        description:
          "Manually triggers sync of all registered data source connectors (file system, Azure Blob, etc.).",
        operationId: "syncDataSources",
        responses: {
          "200": {
            description: "Sync completed",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/SyncAllResult" } },
            },
          },
          "500": {
            description: "Sync failed",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },

    "/api/orchestrate": {
      post: {
        tags: ["Agent"],
        summary: "Agent orchestration",
        description:
          "Invokes the VedaAide ReAct agent with a user message. The agent may call tools (search, ingest, list) before returning a final answer.",
        operationId: "orchestrateAgent",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentRequest" },
              example: { message: "Search for documents about RAG and summarize the findings." },
            },
          },
        },
        responses: {
          "200": {
            description: "Agent completed",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AgentResponse" } },
            },
          },
          "400": {
            description: "Invalid request",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        required: ["status", "timestamp"],
        properties: {
          status: { type: "string", enum: ["ok"] },
          timestamp: { type: "string", format: "date-time" },
          version: { type: "string" },
        },
      },

      RagQueryRequest: {
        type: "object",
        required: ["question"],
        properties: {
          question: { type: "string", minLength: 1, description: "The user's question" },
          topK: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            default: 5,
            description: "Number of chunks to retrieve",
          },
          metadata: {
            type: "object",
            additionalProperties: true,
            description: "Optional metadata filter for vector search",
          },
        },
      },

      RagQueryResult: {
        type: "object",
        required: ["answer", "sources", "isHallucination", "traceId"],
        properties: {
          answer: { type: "string", description: "Generated answer" },
          sources: {
            type: "array",
            items: { $ref: "#/components/schemas/VectorSearchResult" },
          },
          isHallucination: {
            type: "boolean",
            description: "Whether the answer may be hallucinated",
          },
          traceId: { type: "string", description: "Unique trace ID for observability" },
        },
      },

      VectorSearchResult: {
        type: "object",
        required: ["id", "content", "score"],
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 1 },
          metadata: { type: "object", additionalProperties: true },
          fileId: { type: "string" },
        },
      },

      IngestRequest: {
        type: "object",
        required: ["content", "source"],
        properties: {
          content: { type: "string", minLength: 1, description: "Document text content" },
          source: {
            type: "string",
            minLength: 1,
            description: "Unique source identifier (e.g. filename or URL)",
          },
          metadata: { type: "object", additionalProperties: true },
        },
      },

      IngestResult: {
        type: "object",
        required: ["fileId", "source", "chunkCount", "skipped"],
        properties: {
          fileId: { type: "string" },
          source: { type: "string" },
          chunkCount: { type: "integer" },
          skipped: { type: "boolean", description: "True if document was a duplicate" },
        },
      },

      SyncedFile: {
        type: "object",
        required: ["id", "name", "source", "status", "chunkCount", "createdAt"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          source: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "processing", "completed", "failed"],
          },
          chunkCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      PromptTemplate: {
        type: "object",
        required: ["id", "name", "content", "version", "isActive", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          content: { type: "string" },
          version: { type: "integer" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      CreatePromptRequest: {
        type: "object",
        required: ["name", "content"],
        properties: {
          name: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 },
          isActive: { type: "boolean", default: true },
        },
      },

      SyncAllResult: {
        type: "object",
        required: ["connectors", "durationMs"],
        properties: {
          connectors: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "result"],
              properties: {
                name: { type: "string" },
                result: {
                  oneOf: [
                    { $ref: "#/components/schemas/SyncResult" },
                    {
                      type: "object",
                      properties: { error: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          durationMs: { type: "number" },
        },
      },

      SyncResult: {
        type: "object",
        required: ["processed", "skipped", "errors"],
        properties: {
          processed: { type: "integer" },
          skipped: { type: "integer" },
          errors: { type: "array", items: { type: "string" } },
        },
      },

      AgentRequest: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", minLength: 1 },
        },
      },

      AgentResponse: {
        type: "object",
        required: ["output", "steps", "traceId"],
        properties: {
          output: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tool: { type: "string" },
                input: {},
                output: { type: "string" },
              },
            },
          },
          traceId: { type: "string" },
        },
      },

      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" },
          traceId: { type: "string" },
        },
      },
    },
  },
};
