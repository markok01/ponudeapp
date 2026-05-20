import { NextRequest, NextResponse } from "next/server";
import { getPdfConversionJob, PdfConverterError } from "@/services/pdf-converter-client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await getPdfConversionJob(jobId);
    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Greška pri čitanju statusa" }, { status: 500 });
  }
}
