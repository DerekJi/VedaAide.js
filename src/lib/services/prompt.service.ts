import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Default prompts used as fallback when no DB template exists
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PROMPTS: Record<string, string> = {
  rag_system: `You are a helpful assistant. Answer the user's question using only the provided context.
If the context does not contain enough information, say "I don't have enough information to answer that."
Do not fabricate facts. Be concise and accurate.`,

  rag_user: `Context:
{context}

Question: {question}`,

  hallucination_check: `Context:
{context}

Answer: {answer}

Is the answer consistent with the context above? Reply with only YES or NO.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// T22: Prompt Service
// Loads the active (highest version) prompt from DB with fallback to defaults.
// ─────────────────────────────────────────────────────────────────────────────

export class PromptService {
  /**
   * Get the active prompt for a given name.
   * Falls back to DEFAULT_PROMPTS if no DB record found.
   */
  async getActivePrompt(name: string): Promise<string> {
    const template = await prisma.promptTemplate.findFirst({
      where: { name, isActive: true },
      orderBy: { version: "desc" },
    });

    if (template) {
      logger.debug({ name, version: template.version }, "PromptService: loaded from DB");
      return template.content;
    }

    const fallback = DEFAULT_PROMPTS[name];
    if (fallback) {
      logger.debug({ name }, "PromptService: using default prompt");
      return fallback;
    }

    logger.warn({ name }, "PromptService: prompt not found, returning empty string");
    return "";
  }

  /**
   * Create a new version of a prompt.
   * Automatically calculates the next version number.
   */
  async createPrompt(
    name: string,
    content: string,
    description?: string,
    isActive = true,
  ): Promise<{ id: string; version: number }> {
    const latest = await prisma.promptTemplate.findFirst({
      where: { name },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await prisma.promptTemplate.create({
      data: { name, content, description, version: nextVersion, isActive },
    });

    logger.info({ name, version: nextVersion }, "PromptService: created prompt");
    return { id: created.id, version: created.version };
  }

  /**
   * Deactivate a single prompt by ID.
   */
  async deactivatePrompt(id: string): Promise<void> {
    await prisma.promptTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    logger.info({ id }, "PromptService: deactivated prompt");
  }
}
