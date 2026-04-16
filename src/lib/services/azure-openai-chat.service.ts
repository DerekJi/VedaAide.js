import { ChatError, NotConfiguredError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getMsiToken } from "@/lib/utils/msi-token";
import type { IChatService } from "@/lib/services/chat.service";
import type { ChatMessage, ChatOptions } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Azure OpenAI chat service
// Falls back to a configured Ollama service if Azure is not available.
// ─────────────────────────────────────────────────────────────────────────────

interface AzureOpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AzureOpenAIResponse {
  choices: { message: { content: string } }[];
}

export class AzureOpenAIChatService implements IChatService {
  private readonly endpoint: string;
  private readonly deploymentName: string;
  private readonly apiVersion: string;
  private readonly apiKey?: string;

  constructor() {
    if (!env.azure.openai.isConfigured) {
      throw new NotConfiguredError("Azure OpenAI");
    }
    this.endpoint = env.azure.openai.endpoint!;
    this.deploymentName = env.azure.openai.deploymentName ?? "gpt-4o";
    this.apiVersion = env.azure.openai.apiVersion;
    this.apiKey = env.azure.openai.apiKey;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const body = this.buildRequestBody(messages, options);
    const url = `${this.endpoint}openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

    try {
      logger.debug({ deployment: this.deploymentName }, "AzureOpenAI chat");
      const response = await fetch(url, {
        method: "POST",
        headers: await this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ChatError(`Azure OpenAI request failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as AzureOpenAIResponse;
      return data.choices[0]?.message?.content ?? "";
    } catch (cause) {
      if (cause instanceof ChatError) throw cause;
      throw new ChatError(`Azure OpenAI chat failed: ${String(cause)}`, cause);
    }
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string> {
    const body = { ...this.buildRequestBody(messages, options), stream: true };
    const url = `${this.endpoint}openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

    try {
      logger.debug({ deployment: this.deploymentName }, "AzureOpenAI chatStream");
      const response = await fetch(url, {
        method: "POST",
        headers: await this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new ChatError(`Azure OpenAI stream failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder
          .decode(value)
          .split("\n")
          .filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data) as { choices: { delta: { content?: string } }[] };
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (cause) {
      if (cause instanceof ChatError) throw cause;
      throw new ChatError(`Azure OpenAI stream failed: ${String(cause)}`, cause);
    }
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
    } else {
      const token = await getMsiToken("https://cognitiveservices.azure.com/");
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private buildRequestBody(messages: ChatMessage[], options?: ChatOptions) {
    return {
      messages: [
        ...(options?.systemPrompt
          ? [{ role: "system" as const, content: options.systemPrompt }]
          : []),
        ...messages.map((m) => ({ role: m.role, content: m.content }) as AzureOpenAIMessage),
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    };
  }
}
