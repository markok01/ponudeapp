import { NextResponse } from "next/server";
import { isAuthEnabled, isAuthRequired } from "@/lib/auth-config";
import { query, type RowDataPacket } from "@/lib/db";

/** Brza dijagnostika deploy-a (bez osetljivih podataka). */
export async function GET() {
  const checks: Record<string, string | number | boolean> = {
    authEnabled: isAuthEnabled(),
    authRequired: isAuthRequired(),
    jwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
    mysqlHost: Boolean(process.env.MYSQL_HOST?.trim()),
    mysqlDatabase: process.env.MYSQL_DATABASE?.trim() ?? "",
    mysqlUser: Boolean(process.env.MYSQL_USER?.trim()),
    mysqlPassword: Boolean(process.env.MYSQL_PASSWORD?.trim()),
  };

  try {
    const rows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM users`);
    checks.db = "ok";
    checks.users = Number(rows[0]?.cnt ?? 0);
  } catch (error) {
    checks.db = "error";
    checks.dbMessage =
      error instanceof Error ? error.message.slice(0, 200) : "unknown";
  }

  const ok =
    checks.db === "ok" &&
    (!checks.authRequired || (checks.jwtSecret && Number(checks.users) > 0));

  return NextResponse.json(
    { ok, checks },
    { status: ok ? 200 : 503 },
  );
}
