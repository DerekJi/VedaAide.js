import { Ollama } from "ollama";
import { ChatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { IChatService } from "@/lib/services/chat.service";
import type { ChatMessage, ChatOptions } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Ollama chat service
// ─────────────────────────────────────────────────────────────────────────────

export class OllamaChatService implements IChatService {
  private readonly client: Ollama;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? env.ollama.baseUrl;
    this.client = new Ollama({ host: this.baseUrl });
    this.model = model ?? env.ollama.chatModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const fullMessages = this.buildMessages(messages, options?.systemPrompt);

    try {
      logger.debug({ model: this.model, messageCount: fullMessages.length }, "chat");
      const response = await this.client.chat({
        model: this.model,
        messages: fullMessages,
        options: {
          temperature: options?.temperature,
          num_predict: options?.maxTokens,
        },
        stream: false,
      });
      return response.message.content;
    } catch (cause) {
      throw new ChatError(`Chat request failed: ${String(cause)}`, cause);
    }
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string> {
    const fullMessages = this.buildMessages(messages, options?.systemPrompt);

    try {
      logger.debug({ model: this.model, messageCount: fullMessages.length }, "chatStream");
      const stream = await this.client.chat({
        model: this.model,
        messages: fullMessages,
        options: {
          temperature: options?.temperature,
          num_predict: options?.maxTokens,
        },
        stream: true,
      });

      for await (const chunk of stream) {
        yield chunk.message.content;
      }
    } catch (cause) {
      const errorMessage =
        cause instanceof Error && cause.message.includes("ECONNREFUSED")
          ? `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running.`
          : `Streaming chat failed: ${String(cause)}`;
      throw new ChatError(errorMessage, cause);
    }
  }

  private buildMessages(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content });
    }

    return result;
  }
}
