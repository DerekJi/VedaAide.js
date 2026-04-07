import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VedaAgent } from "@/lib/agent/veda-agent";
import { logger } from "@/lib/logger";
import { VedaError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orchestrate/query
// Invoke the ReAct agent with a user message.
// ─────────────────────────────────────────────────────────────────────────────

const querySchema = z.object({
  message: z.string().min(1, "message is required"),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();
  const parsed = querySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const agent = new VedaAgent();

  try {
    const result = await agent.invoke(parsed.data.message);
    logger.info(
      { traceId: result.traceId, steps: result.steps.length },
      "POST /api/orchestrate/query",
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VedaError) {
      logger.error({ code: err.code, traceId: err.traceId }, "agent query failed");
      return NextResponse.json(err.toJSON(), { status: 500 });
    }
    logger.error({ err }, "unexpected agent error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
