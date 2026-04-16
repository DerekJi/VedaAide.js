import { env } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(env.logging?.level ?? "info") as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

function formatLog(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  if (data) {
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(data)}`;
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

// Support both formats: logger.info(message, data) and logger.info({data}, message)
function normalizeArgs(arg1: unknown, arg2?: unknown): { message: string; data?: unknown } {
  if (typeof arg1 === "string") {
    return { message: arg1, data: arg2 };
  }
  if (typeof arg2 === "string") {
    return { message: arg2, data: arg1 };
  }
  return { message: String(arg1), data: arg2 };
}

export const logger = {
  debug(arg1: unknown, arg2?: unknown) {
    if (shouldLog("debug")) {
      const { message, data } = normalizeArgs(arg1, arg2);
      console.log(formatLog("debug", message, data));
    }
  },
  info(arg1: unknown, arg2?: unknown) {
    if (shouldLog("info")) {
      const { message, data } = normalizeArgs(arg1, arg2);
      console.log(formatLog("info", message, data));
    }
  },
  warn(arg1: unknown, arg2?: unknown) {
    if (shouldLog("warn")) {
      const { message, data } = normalizeArgs(arg1, arg2);
      console.warn(formatLog("warn", message, data));
    }
  },
  error(arg1: unknown, arg2?: unknown) {
    if (shouldLog("error")) {
      const { message, data } = normalizeArgs(arg1, arg2);
      console.error(formatLog("error", message, data));
    }
  },
  child(context: Record<string, unknown>) {
    return {
      debug(arg1: unknown, arg2?: unknown) {
        if (shouldLog("debug")) {
          const { message, data } = normalizeArgs(arg1, arg2);
          const merged =
            typeof data === "object" && data !== null
              ? { ...context, ...data }
              : { ...context, data };
          console.log(formatLog("debug", message, merged));
        }
      },
      info(arg1: unknown, arg2?: unknown) {
        if (shouldLog("info")) {
          const { message, data } = normalizeArgs(arg1, arg2);
          const merged =
            typeof data === "object" && data !== null
              ? { ...context, ...data }
              : { ...context, data };
          console.log(formatLog("info", message, merged));
        }
      },
      warn(arg1: unknown, arg2?: unknown) {
        if (shouldLog("warn")) {
          const { message, data } = normalizeArgs(arg1, arg2);
          const merged =
            typeof data === "object" && data !== null
              ? { ...context, ...data }
              : { ...context, data };
          console.warn(formatLog("warn", message, merged));
        }
      },
      error(arg1: unknown, arg2?: unknown) {
        if (shouldLog("error")) {
          const { message, data } = normalizeArgs(arg1, arg2);
          const merged =
            typeof data === "object" && data !== null
              ? { ...context, ...data }
              : { ...context, data };
          console.error(formatLog("error", message, merged));
        }
      },
    };
  },
};
