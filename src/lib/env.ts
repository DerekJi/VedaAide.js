import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Environment mode detection
// ─────────────────────────────────────────────────────────────────────────────

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDeployment = process.env.DEPLOYMENT_MODE === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Schema definitions
// ─────────────────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const ollamaSchema = z.object({
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("bge-m3"),
  OLLAMA_CHAT_MODEL: z.string().default("qwen:7b-chat"),
});

const azureOpenAISchema = z.object({
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().default("2024-08-01-preview"),
});

const azureCosmosSchema = z.object({
  AZURE_COSMOS_ENDPOINT: z.string().url().optional(),
  AZURE_COSMOS_KEY: z.string().optional(),
  AZURE_COSMOS_DATABASE: z.string().optional(),
  AZURE_COSMOS_CONTAINER: z.string().optional(),
});

const azureBlobSchema = z.object({
  AZURE_BLOB_ACCOUNT_NAME: z.string().optional(),
  AZURE_BLOB_ACCOUNT_KEY: z.string().optional(),
  AZURE_BLOB_CONTAINER_NAME: z.string().optional(),
});

// Combined schema – Azure fields are always optional at schema level;
// runtime validation via `assertAzureConfigured()` when actually used.
const envSchema = baseSchema
  .merge(ollamaSchema)
  .merge(azureOpenAISchema)
  .merge(azureCosmosSchema)
  .merge(azureBlobSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("[env] Invalid environment variables:", JSON.stringify(formatted, null, 2));
    throw new Error("[env] Invalid environment variables. Check server logs.");
  }
  return result.data;
}

// Parse once at module load time (only on server side)
const rawEnv = typeof window === "undefined" ? validateEnv() : ({} as z.infer<typeof envSchema>);

// ─────────────────────────────────────────────────────────────────────────────
// Typed env accessor
// ─────────────────────────────────────────────────────────────────────────────

export const env = {
  nodeEnv: rawEnv.NODE_ENV ?? nodeEnv,
  isDevelopment: (rawEnv.NODE_ENV ?? nodeEnv) === "development",
  isTest: (rawEnv.NODE_ENV ?? nodeEnv) === "test",
  isProduction: (rawEnv.NODE_ENV ?? nodeEnv) === "production",
  isDeployment,

  db: {
    url: rawEnv.DATABASE_URL ?? "file:./dev.db",
  },

  logging: {
    level: rawEnv.LOG_LEVEL ?? "info",
  },

  ollama: {
    baseUrl: rawEnv.OLLAMA_BASE_URL ?? "http://localhost:11434",
    embeddingModel: rawEnv.OLLAMA_EMBEDDING_MODEL ?? "bge-m3",
    chatModel: rawEnv.OLLAMA_CHAT_MODEL ?? "qwen:7b-chat",
  },

  azure: {
    openai: {
      endpoint: rawEnv.AZURE_OPENAI_ENDPOINT,
      apiKey: rawEnv.AZURE_OPENAI_API_KEY,
      deploymentName: rawEnv.AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: rawEnv.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview",
      // Azure OpenAI is configured ONLY if endpoint AND API Key are both present
      // MSI (Managed Identity) is NOT supported in this environment due to IMDS timeout
      isConfigured: !!rawEnv.AZURE_OPENAI_ENDPOINT && !!rawEnv.AZURE_OPENAI_API_KEY,
    },
    cosmos: {
      endpoint: rawEnv.AZURE_COSMOS_ENDPOINT,
      key: rawEnv.AZURE_COSMOS_KEY,
      database: rawEnv.AZURE_COSMOS_DATABASE,
      container: rawEnv.AZURE_COSMOS_CONTAINER,
      isConfigured: !!rawEnv.AZURE_COSMOS_ENDPOINT && (!!rawEnv.AZURE_COSMOS_KEY || isDeployment),
    },
    blob: {
      accountName: rawEnv.AZURE_BLOB_ACCOUNT_NAME,
      accountKey: rawEnv.AZURE_BLOB_ACCOUNT_KEY,
      containerName: rawEnv.AZURE_BLOB_CONTAINER_NAME,
      isConfigured:
        !!rawEnv.AZURE_BLOB_ACCOUNT_NAME && (!!rawEnv.AZURE_BLOB_ACCOUNT_KEY || isDeployment),
    },
  },
} as const;

export type Env = typeof env;
