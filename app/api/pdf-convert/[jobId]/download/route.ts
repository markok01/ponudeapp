import { NextRequest, NextResponse } from "next/server";
import { downloadPdfConversionExcel, PdfConverterError } from "@/services/pdf-converter-client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const { buffer, fileName } = await downloadPdfConversionExcel(jobId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof PdfConverterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Preuzimanje nije uspelo" }, { status: 500 });
  }
}
