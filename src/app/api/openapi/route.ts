import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi/spec";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/openapi
// Returns the OpenAPI 3.0 specification as JSON.
// This endpoint is consumed by Swagger UI (see /api/docs) and Postman.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
