import { NextRequest, NextResponse } from "next/server";
import {
  healthAlertsConfigured,
  runHealthWatchdog,
} from "@/services/health-watchdog";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-cron-secret") ?? "";
  return header === secret;
}

/** Vercel Cron / ručni watchdog — baza + PDF converter, alarm mail/Slack. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 401 });
  }

  try {
    const result = await runHealthWatchdog();
    const failing = result.probes.filter((p) => !p.ok);
    return NextResponse.json({
      ok: failing.length === 0,
      alertsConfigured: healthAlertsConfigured(),
      ...result,
    }, { status: failing.length === 0 ? 200 : 503 });
  } catch (error) {
    console.error("GET /api/cron/health", error);
    return NextResponse.json(
      { error: "Watchdog nije uspeo", ok: false },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
