import { NextResponse } from "next/server";
import { isAiPdfParsingEnabled } from "@/utils/pdf-ai-parse";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    aiEnabled: isAiPdfParsingEnabled(),
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  });
}
