import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PromptService } from "@/lib/services/prompt.service";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prompts   – List all prompt templates
// POST /api/prompts  – Create a new prompt version
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const prompts = await prisma.promptTemplate.findMany({
    orderBy: [{ name: "asc" }, { version: "desc" }],
  });
  return NextResponse.json(prompts);
}

const createSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const service = new PromptService();
  const result = await service.createPrompt(
    parsed.data.name,
    parsed.data.content,
    parsed.data.description,
    parsed.data.isActive,
  );

  logger.info({ name: parsed.data.name, ...result }, "POST /api/prompts");
  return NextResponse.json(result, { status: 201 });
}
