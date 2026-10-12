import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOwnerOrganization } from "@/lib/org-session";
import { logOrgActivity } from "@/services/org-activity";
import { buildOrganizationExportBuffer } from "@/services/org-export";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireOwnerOrganization(request);
    if (isOrgResponse(ctx)) return ctx;

    const { buffer, fileName } = await buildOrganizationExportBuffer(ctx.organizationId);
    await logOrgActivity({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user?.id,
      actorEmail: ctx.user?.email,
      action: "org.data_exported",
      summary: `Izvoz podataka firme (${fileName})`,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/org/export", error);
    const message = error instanceof Error ? error.message : "Izvoz nije uspeo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
