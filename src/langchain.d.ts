/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type declarations for @langchain/core modules to suppress TS7016 errors.
 * These are necessary because @langchain/core doesn't provide complete type declarations.
 */

declare module "@langchain/core/tools" {
  export const DynamicStructuredTool: any;
  export const StructuredTool: any;
  export type StructuredTool = any;
}

declare module "@langchain/core/messages" {
  export const HumanMessage: any;
  export const AIMessage: any;
  export const ToolMessage: any;
  export const BaseMessage: any;
  export type BaseMessage = any;
}

declare module "@langchain/core/documents" {
  export class Document {
    pageContent: string;
    metadata?: Record<string, unknown>;
    constructor(input: { pageContent: string; metadata?: Record<string, unknown> });
  }
}

declare module "@langchain/core/embeddings" {
  export interface EmbeddingsInterface {
    embedQuery(text: string): Promise<number[]>;
    embedDocuments(texts: string[]): Promise<number[][]>;
  }
  export abstract class Embeddings implements EmbeddingsInterface {
    abstract embedQuery(text: string): Promise<number[]>;
    abstract embedDocuments(texts: string[]): Promise<number[][]>;
  }
}

declare module "@langchain/core/language_models/base" {
  export class BaseLanguageModel {
    [key: string]: any;
  }
}

declare module "@langchain/core/language_models/chat_models" {
  export class BaseChatModel {
    [key: string]: any;
  }
}

declare module "@langchain/core/vectorstores" {
  export abstract class VectorStore {
    constructor(embeddings: any, config?: any);
    abstract addVectors(vectors: number[][], docs: any[]): Promise<string[]>;
    abstract addDocuments(docs: any[]): Promise<string[]>;
    abstract similaritySearchVectorWithScore(
      queryVector: number[],
      k: number,
      filter?: Record<string, unknown>,
    ): Promise<Array<[any, number]>>;
    abstract _vectorstoreType(): string;
  }
}

declare module "@langchain/core/prompts" {
  export const PromptTemplate: any;
  export class ChatPromptTemplate {
    static fromMessages(messages: any[]): ChatPromptTemplate;
    formatMessages(values: Record<string, any>): Promise<any[]>;
    [key: string]: any;
  }
}

declare module "@langchain/core/output_parsers" {
  export const StringOutputParser: any;
}

declare module "@langchain/core/runnables" {
  export const RunnableSequence: any;
  export const RunnablePassthrough: any;
}
