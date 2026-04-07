import pino from "pino";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive key patterns to redact
// ─────────────────────────────────────────────────────────────────────────────

const REDACTED_PATHS = [
  "apiKey",
  "api_key",
  "AZURE_OPENAI_API_KEY",
  "AZURE_COSMOS_KEY",
  "AZURE_BLOB_ACCOUNT_KEY",
  "password",
  "secret",
  "token",
  "authorization",
];

// ─────────────────────────────────────────────────────────────────────────────
// Logger factory
// ─────────────────────────────────────────────────────────────────────────────

function createLogger() {
  const isDev =
    typeof env.isDevelopment !== "undefined"
      ? env.isDevelopment
      : process.env.NODE_ENV === "development";
  const level =
    typeof env.logging?.level !== "undefined"
      ? env.logging.level
      : (process.env.LOG_LEVEL ?? "info");

  const transport = isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined;

  return pino({
    level,
    redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
    transport,
  });
}

export const logger = createLogger();

// ─────────────────────────────────────────────────────────────────────────────
// Child loggers with trace ID
// ─────────────────────────────────────────────────────────────────────────────

export function createRequestLogger(traceId: string) {
  return logger.child({ traceId });
}
