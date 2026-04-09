import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Hallucination Guard Service
//
// Dual-layer detection:
// Layer 1 – Embedding similarity (fast, no extra LLM call):
//   Embeds the answer and compares against the retrieved context.
//   If max cosine similarity < threshold (0.3), likely hallucination.
//
// Layer 2 – LLM self-verification (optional, costs extra inference):
//   Asks the LLM "Is this answer consistent with the context?"
//   Only runs when `enableSelfCheck` is true.
// ─────────────────────────────────────────────────────────────────────────────

export interface HallucinationCheckResult {
  isHallucination: boolean;
  /** Layer 1 similarity score (0–1) */
  confidence: number;
  /** Whether layer 2 check was run */
  selfCheckRan: boolean;
  /** Result of layer 2 check (true = consistent) */
  selfCheckResult?: boolean;
}

export interface HallucinationGuardOptions {
  /** Embedding similarity threshold below which answer is flagged (default: 0.3) */
  embeddingThreshold?: number;
  /** Enable LLM self-verification (default: false) */
  enableSelfCheck?: boolean;
}

export class HallucinationGuardService {
  private readonly embeddingThreshold: number;
  private readonly enableSelfCheck: boolean;

  constructor(
    private readonly embeddings: EmbeddingsInterface,
    private readonly llm?: BaseChatModel,
    options?: HallucinationGuardOptions,
  ) {
    this.embeddingThreshold = options?.embeddingThreshold ?? 0.3;
    this.enableSelfCheck = options?.enableSelfCheck ?? false;
  }

  // ── Layer 1: Embedding Similarity ─────────────────────────────────────────

  /**
   * Compare the answer's embedding against a set of context embeddings.
   * Returns the maximum cosine similarity as the confidence score.
   */
  async checkAnswerGrounding(
    answer: string,
    contextTexts: string[],
  ): Promise<{ isHallucination: boolean; confidence: number }> {
    if (contextTexts.length === 0) {
      return { isHallucination: true, confidence: 0 };
    }

    const [answerEmbedding, contextEmbeddings] = await Promise.all([
      this.embeddings.embedQuery(answer),
      this.embeddings.embedDocuments(contextTexts),
    ]);

    const maxSimilarity = contextEmbeddings.reduce((max: number, ctxEmb: number[]) => {
      const sim = cosineSimilarity(answerEmbedding, ctxEmb);
      return sim > max ? sim : max;
    }, -Infinity);

    const isHallucination = maxSimilarity < this.embeddingThreshold;

    logger.debug(
      { maxSimilarity, threshold: this.embeddingThreshold, isHallucination },
      "HallucinationGuard: layer 1 check",
    );

    return { isHallucination, confidence: maxSimilarity };
  }

  // ── Layer 2: LLM Self-verification ────────────────────────────────────────

  /**
   * Ask the LLM whether the answer is consistent with the provided context.
   * Returns true if the LLM says the answer is grounded.
   */
  async verifySelfCheck(answer: string, context: string): Promise<boolean> {
    if (!this.llm) {
      throw new Error(
        "HallucinationGuardService: LLM not configured for self-check. Pass a model to the constructor.",
      );
    }

    const prompt = `Context:
${context}

Answer: ${answer}

Is the answer consistent with the context above? Reply with only YES or NO.`;

    const result = await this.llm.invoke([{ role: "user", content: prompt }]);
    const text =
      typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const isConsistent = text.trim().toUpperCase().startsWith("YES");

    logger.debug({ isConsistent }, "HallucinationGuard: layer 2 self-check");
    return isConsistent;
  }

  // ── Combined check ─────────────────────────────────────────────────────────

  /**
   * Run both layers and return a combined result.
   */
  async check(answer: string, contextTexts: string[]): Promise<HallucinationCheckResult> {
    const { isHallucination, confidence } = await this.checkAnswerGrounding(answer, contextTexts);

    let selfCheckRan = false;
    let selfCheckResult: boolean | undefined;

    if (this.enableSelfCheck && this.llm) {
      const context = contextTexts.join("\n\n");
      selfCheckResult = await this.verifySelfCheck(answer, context);
      selfCheckRan = true;
    }

    // If self-check ran and says NOT consistent, override isHallucination
    const finalHallucination = isHallucination || (selfCheckRan && selfCheckResult === false);

    return {
      isHallucination: finalHallucination,
      confidence,
      selfCheckRan,
      selfCheckResult,
    };
  }
}
