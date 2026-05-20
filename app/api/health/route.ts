import { NextResponse } from "next/server";
import { isAuthEnabled, isAuthRequired } from "@/lib/auth-config";
import { query, resolveMysqlDatabase, type RowDataPacket } from "@/lib/db";
import { checkPdfConverterHealth } from "@/services/pdf-converter-client";

/** Brza dijagnostika deploy-a (bez osetljivih podataka). */
export async function GET() {
  const effectiveDb = resolveMysqlDatabase();
  const sharedDb = process.env.MYSQL_DATABASE?.trim() ?? "";

  const checks: Record<string, string | number | boolean> = {
    authEnabled: isAuthEnabled(),
    authRequired: isAuthRequired(),
    jwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
    mysqlHost: Boolean(process.env.MYSQL_HOST?.trim()),
    mysqlDatabase: effectiveDb,
    mysqlDatabaseShared: sharedDb,
    ponudeappDatabaseOverride: Boolean(process.env.PONUDEAPP_DATABASE?.trim()),
    mysqlUser: Boolean(process.env.MYSQL_USER?.trim()),
    mysqlPassword: Boolean(process.env.MYSQL_PASSWORD?.trim()),
  };

  if (sharedDb && sharedDb !== effectiveDb) {
    checks.databaseNote =
      "Koristi se PONUDEAPP_DATABASE override (Shared MYSQL_DATABASE je za Budget).";
  }

  if (effectiveDb === "defaultdb") {
    checks.databaseWarning =
      "Pogrešna baza! Na Vercel Project dodaj PONUDEAPP_DATABASE=ponudaapp";
  }

  try {
    const rows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM users`);
    checks.db = "ok";
    checks.users = Number(rows[0]?.cnt ?? 0);
  } catch (error) {
    checks.db = "error";
    checks.dbMessage =
      error instanceof Error ? error.message.slice(0, 240) : "unknown";
  }

  const pdfUrl = process.env.PDF_CONVERTER_URL?.trim() ?? "";
  checks.pdfConverterUrl = pdfUrl
    ? pdfUrl.replace(/^https?:\/\//, "").split("/")[0]
    : "(nije podešeno)";
  checks.pdfConverterApiKey = Boolean(process.env.PDF_CONVERTER_API_KEY?.trim());

  try {
    const pdfHealth = await checkPdfConverterHealth();
    checks.pdfConverter = pdfHealth ? "ok" : "unreachable";
    if (pdfHealth) {
      checks.pdfConverterOcr = pdfHealth.ocrEnabled;
      checks.pdfConverterVersion = pdfHealth.version;
    }
  } catch (error) {
    checks.pdfConverter = "error";
    checks.pdfConverterMessage =
      error instanceof Error ? error.message.slice(0, 200) : "unknown";
  }

  const ok =
    checks.db === "ok" &&
    effectiveDb !== "defaultdb" &&
    (!checks.authRequired || (checks.jwtSecret && Number(checks.users) > 0));

  return NextResponse.json(
    { ok, checks },
    { status: ok ? 200 : 503 },
  );
}
