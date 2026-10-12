import { NextRequest, NextResponse } from "next/server";
import { isOrgResponse, requireOrganizationId } from "@/lib/org-session";
import { memberMayLockQuotes } from "@/lib/roles";
import { isResendConfigured, quoteEmailContent, sendEmail } from "@/lib/email";
import { getRequestLocale } from "@/lib/authI18n";
import { getAppSettingsFromDb } from "@/services/app-settings";
import { getQuoteById, setQuoteStatus } from "@/services/quotes";
import { getQuoteLabel } from "@/utils/format-quote-number";
import { logOrgActivity } from "@/services/org-activity";

type RouteContext = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PDF_CHARS = 8_000_000;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireOrganizationId(request);
    if (isOrgResponse(ctx)) return ctx;

    const { id } = await context.params;
    const quoteId = Number(id);
    if (!Number.isFinite(quoteId)) {
      return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
    }

    const quote = await getQuoteById(ctx.organizationId, quoteId);
    if (!quote) {
      return NextResponse.json({ error: "Ponuda nije pronađena" }, { status: 404 });
    }

    const settings = await getAppSettingsFromDb(ctx.organizationId);
    if (!memberMayLockQuotes(ctx.user?.role, settings.membersCanLockQuotes)) {
      return NextResponse.json(
        { error: "Samo administrator može da pošalje ponudu" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const to = String(body.to ?? quote.customer_email ?? "").trim();
    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "Unesite ispravnu email adresu" }, { status: 400 });
    }

    const pdfBase64 = String(body.pdfBase64 ?? "");
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_CHARS) {
      return NextResponse.json({ error: "PDF prilog nije ispravan" }, { status: 400 });
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: "Slanje emaila nije podešeno (RESEND_API_KEY)", delivered: false },
        { status: 503 },
      );
    }

    const label = getQuoteLabel(quote);
    const content = quoteEmailContent({
      companyName: settings.companyName,
      customerName: quote.customer_name,
      quoteLabel: label,
      locale: getRequestLocale(request),
    });
    const filename = `${label.replace(/[^\w.-]+/g, "-")}.pdf`;

    const result = await sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: [{ filename, content: pdfBase64 }],
    });

    let status = quote.status;
    if (quote.status === "draft") {
      const updated = await setQuoteStatus(ctx.organizationId, quoteId, "sent");
      status = updated.status;
    }

    await logOrgActivity({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user?.id,
      actorEmail: ctx.user?.email,
      action: "quote.emailed",
      entityType: "quote",
      entityId: quoteId,
      summary: `Poslata ponuda ${label} na ${to}`,
      metadata: { to, status },
    });

    return NextResponse.json({ delivered: result.delivered, to, status });
  } catch (error) {
    console.error("POST /api/quotes/[id]/email", error);
    const message = error instanceof Error ? error.message : "Slanje nije uspelo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
