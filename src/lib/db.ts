import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Prisma client (avoids exhausting connection pool in dev w/ HMR)
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  var __prisma: PrismaClient | undefined; // required for global augmentation
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
