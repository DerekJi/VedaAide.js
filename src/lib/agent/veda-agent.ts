import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { VEDA_AGENT_TOOLS } from "@/lib/agent/tools";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { StructuredTool } from "@langchain/core/tools";

// ─────────────────────────────────────────────────────────────────────────────
// VedaAide ReAct Agent
// Uses LangGraph createReactAgent with a configurable LLM and tool set.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 10;

export interface AgentInvokeResult {
  output: string;
  /** Intermediate steps (tool calls + results) for tracing */
  steps: AgentStep[];
  traceId: string;
}

export interface AgentStep {
  tool: string;
  input: unknown;
  output: string;
}

export interface VedaAgentOptions {
  llm?: BaseLanguageModel;
  tools?: StructuredTool[];
  maxIterations?: number;
}

export class VedaAgent {
  private readonly agent: ReturnType<typeof createReactAgent>;
  private readonly maxIterations: number;

  constructor(options?: VedaAgentOptions) {
    const llm =
      (options?.llm as Parameters<typeof createReactAgent>[0]["llm"]) ??
      new ChatOllama({
        baseUrl: env.ollama.baseUrl,
        model: env.ollama.chatModel,
      });

    const tools = options?.tools ?? VEDA_AGENT_TOOLS;
    this.maxIterations = options?.maxIterations ?? MAX_ITERATIONS;

    this.agent = createReactAgent({ llm, tools });
  }

  /**
   * Invoke the agent with a user message.
   * Returns the final answer and the trace of intermediate steps.
   */
  async invoke(userMessage: string): Promise<AgentInvokeResult> {
    const traceId = `agent-${Date.now().toString(36)}`;

    logger.debug({ userMessage, traceId }, "VedaAgent.invoke");

    const result = await this.agent.invoke(
      {
        messages: [new HumanMessage(userMessage)],
      },
      {
        recursionLimit: this.maxIterations,
      },
    );

    const messages = result.messages as { role?: string; content: string; name?: string }[];

    // Extract intermediate tool calls from the message trace
    const steps: AgentStep[] = messages
      .filter((m) => m.name !== undefined) // tool result messages have a name
      .map((m) => ({
        tool: m.name ?? "unknown",
        input: null,
        output: m.content,
      }));

    // The last message is the final AI response
    const lastMessage = messages[messages.length - 1];
    const output =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? "");

    logger.info({ traceId, steps: steps.length }, "VedaAgent: completed");

    return { output, steps, traceId };
  }
}
