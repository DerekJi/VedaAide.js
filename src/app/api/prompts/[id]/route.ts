import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prompts/[id]    – Get a single prompt
// PUT /api/prompts/[id]    – Update prompt content/status
// DELETE /api/prompts/[id] – Delete a prompt version
// ─────────────────────────────────────────────────────────────────────────────

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prompt);
}

const updateSchema = z.object({
  content: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body: unknown = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  try {
    const updated = await prisma.promptTemplate.update({
      where: { id },
      data: parsed.data,
    });
    logger.info({ id }, "PUT /api/prompts/[id]");
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.promptTemplate.delete({ where: { id } });
    logger.info({ id }, "DELETE /api/prompts/[id]");
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
