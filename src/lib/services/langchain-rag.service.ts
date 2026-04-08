import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import type { Document } from "@langchain/core/documents";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { LangChainSqliteVectorStore } from "@/lib/vector-store/langchain-sqlite-vector-store";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { RagQueryResult, VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// LangChain RAG Chain
// Implements a Retrieval-Augmented Generation pipeline using LCEL.
// Pipeline: Question → Embed → Retrieve → Prompt → LLM → Parse
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_RAG_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful assistant. Answer the user's question based ONLY on the provided context.
If the context does not contain enough information, say "I don't have enough information to answer that."
Do not make up facts.

Context:
{context}`,
  ],
  ["human", "{question}"],
]);

function formatDocs(docs: Document[]): string {
  return docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n");
}

export interface LangChainRagOptions {
  topK?: number;
  promptTemplate?: ChatPromptTemplate;
  model?: BaseLanguageModel;
  embeddings?: EmbeddingsInterface;
}

export class LangChainRagService {
  private readonly vectorStore: LangChainSqliteVectorStore;
  private readonly llm: BaseLanguageModel;
  private readonly topK: number;
  private readonly promptTemplate: ChatPromptTemplate;

  constructor(options?: LangChainRagOptions) {
    const embeddings =
      options?.embeddings ??
      new OllamaEmbeddings({
        baseUrl: env.ollama.baseUrl,
        model: env.ollama.embeddingModel,
      });

    this.vectorStore = new LangChainSqliteVectorStore(embeddings);
    this.llm =
      options?.model ??
      new ChatOllama({
        baseUrl: env.ollama.baseUrl,
        model: env.ollama.chatModel,
      });
    this.topK = options?.topK ?? 5;
    this.promptTemplate = options?.promptTemplate ?? DEFAULT_RAG_PROMPT;
  }

  /**
   * Run an E2E RAG query and return the answer with source documents.
   */
  async query(question: string): Promise<RagQueryResult> {
    const traceId = `lc-rag-${Date.now().toString(36)}`;
    const retriever = this.vectorStore.asRetriever(this.topK);

    // Build LCEL chain
    const chain = RunnableSequence.from([
      {
        context: retriever.pipe((docs: Document[]) => formatDocs(docs)),
        question: new RunnablePassthrough(),
        docs: retriever,
      },
      {
        answer: this.promptTemplate.pipe(this.llm).pipe(new StringOutputParser()),
        docs: (input: { docs: Document[] }) => input.docs,
      },
    ]);

    logger.debug({ question, traceId }, "LangChainRagService.query");

    const result = await chain.invoke(question);

    const sources: VectorSearchResult[] = result.docs.map((doc: Document, i: number) => ({
      id: (doc.metadata?.id as string | undefined) ?? `src-${i}`,
      content: doc.pageContent,
      score: (doc.metadata?.score as number | undefined) ?? 0,
      metadata: doc.metadata,
      fileId: doc.metadata?.fileId as string | undefined,
    }));

    return {
      answer: result.answer,
      sources,
      isHallucination: false, // updated in T9-T11
      traceId,
    };
  }

  /**
   * Expose the underlying vector store for direct operations.
   */
  getVectorStore(): LangChainSqliteVectorStore {
    return this.vectorStore;
  }
}
