import { execute, query, type RowDataPacket } from "@/lib/db";
import { isResendConfigured, sendEmail } from "@/lib/email";
import { checkPdfConverterHealth, isPdfConverterUrlConfigured } from "@/services/pdf-converter-client";

export type HealthCheckName = "database" | "pdf_converter";

interface HealthStateRow extends RowDataPacket {
  check_name: string;
  status: string;
  fail_streak: number;
  last_alert_at: Date | null;
}

export interface ProbeResult {
  name: HealthCheckName;
  ok: boolean;
  message: string;
}

export interface WatchdogResult {
  probes: ProbeResult[];
  alertsSent: string[];
  recoveriesSent: string[];
}

const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const FAIL_STREAK_BEFORE_ALERT = 2;

export async function ensureHealthAlertSchema(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS ops_health_state (
      check_name VARCHAR(40) PRIMARY KEY,
      status VARCHAR(20) NOT NULL DEFAULT 'unknown',
      fail_streak INT NOT NULL DEFAULT 0,
      last_ok_at DATETIME NULL,
      last_fail_at DATETIME NULL,
      last_alert_at DATETIME NULL,
      last_message VARCHAR(500) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function probeDatabase(): Promise<ProbeResult> {
  try {
    await query<RowDataPacket[]>(`SELECT 1 AS ok`);
    return { name: "database", ok: true, message: "dbPing ok" };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "query_failed";
    return { name: "database", ok: false, message: `Baza ne odgovara (${code})` };
  }
}

export async function probePdfConverter(): Promise<ProbeResult | null> {
  if (!isPdfConverterUrlConfigured()) return null;
  try {
    const health = await checkPdfConverterHealth();
    if (health) {
      return {
        name: "pdf_converter",
        ok: true,
        message: `ok v${health.version ?? "?"}`,
      };
    }
    return {
      name: "pdf_converter",
      ok: false,
      message: "PDF converter ne odgovara (unreachable)",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "error";
    return { name: "pdf_converter", ok: false, message: msg.slice(0, 200) };
  }
}

async function getState(name: HealthCheckName): Promise<HealthStateRow | null> {
  const rows = await query<HealthStateRow[]>(
    `SELECT * FROM ops_health_state WHERE check_name = ? LIMIT 1`,
    [name],
  );
  return rows[0] ?? null;
}

function toMysqlUtc(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

async function upsertState(
  name: HealthCheckName,
  status: "ok" | "fail",
  failStreak: number,
  message: string,
  alerted: boolean,
): Promise<void> {
  const prev = await getState(name);
  await execute(
    `INSERT INTO ops_health_state
      (check_name, status, fail_streak, last_ok_at, last_fail_at, last_alert_at, last_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       fail_streak = VALUES(fail_streak),
       last_ok_at = VALUES(last_ok_at),
       last_fail_at = VALUES(last_fail_at),
       last_alert_at = VALUES(last_alert_at),
       last_message = VALUES(last_message)`,
    [
      name,
      status,
      failStreak,
      toMysqlUtc(status === "ok" ? new Date() : prev?.last_ok_at ?? null),
      toMysqlUtc(status === "fail" ? new Date() : prev?.last_fail_at ?? null),
      toMysqlUtc(alerted ? new Date() : prev?.last_alert_at ?? null),
      message.slice(0, 500),
    ],
  );
}

function alertTargets(): { emails: string[]; slack: string | null } {
  const emails = (process.env.HEALTH_ALERT_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const slack = process.env.SLACK_WEBHOOK_URL?.trim() || null;
  return { emails, slack };
}

async function sendSlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}

async function sendAlertChannels(subject: string, body: string): Promise<boolean> {
  const { emails, slack } = alertTargets();
  let sent = false;
  if (slack) {
    try {
      if (await sendSlack(`*${subject}*\n${body}`)) sent = true;
    } catch (error) {
      console.error("Slack health alert failed", error);
    }
  }
  if (emails.length && isResendConfigured()) {
    for (const to of emails) {
      try {
        await sendEmail({
          to,
          subject,
          text: body,
          html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")}</pre>`,
        });
        sent = true;
      } catch (error) {
        console.error("Email health alert failed", error);
      }
    }
  }
  if (!emails.length && !slack) {
    console.info(`[health-alert] ${subject}\n${body}`);
  }
  return sent;
}

function canAlert(lastAlertAt: Date | null | undefined): boolean {
  if (!lastAlertAt) return true;
  return Date.now() - new Date(lastAlertAt).getTime() >= ALERT_COOLDOWN_MS;
}

/** Provera baze + PDF converter; šalje mail/Slack pri padu (sa cooldown) i oporavku. */
export async function runHealthWatchdog(): Promise<WatchdogResult> {
  await ensureHealthAlertSchema();

  const probes: ProbeResult[] = [await probeDatabase()];
  const pdf = await probePdfConverter();
  if (pdf) probes.push(pdf);

  const alertsSent: string[] = [];
  const recoveriesSent: string[] = [];

  for (const probe of probes) {
    const prev = await getState(probe.name);
    if (probe.ok) {
      const wasFail = prev?.status === "fail";
      await upsertState(probe.name, "ok", 0, probe.message, false);
      if (wasFail) {
        const subject = `[PonudeApp] ${probe.name} ponovo radi`;
        const body = `${probe.message}\nProvera: ${probe.name}`;
        await sendAlertChannels(subject, body);
        recoveriesSent.push(probe.name);
      }
      continue;
    }

    const streak = (prev?.status === "fail" ? Number(prev.fail_streak || 0) : 0) + 1;
    const shouldAlert =
      streak >= FAIL_STREAK_BEFORE_ALERT && canAlert(prev?.last_alert_at ?? null);
    await upsertState(probe.name, "fail", streak, probe.message, shouldAlert);
    if (shouldAlert) {
      const subject = `[PonudeApp] ALARM: ${probe.name}`;
      const body = `${probe.message}\nUzastopnih padova: ${streak}\nVreme: ${new Date().toISOString()}`;
      await sendAlertChannels(subject, body);
      alertsSent.push(probe.name);
    }
  }

  return { probes, alertsSent, recoveriesSent };
}

export function healthAlertsConfigured(): boolean {
  const { emails, slack } = alertTargets();
  return Boolean(slack || (emails.length && isResendConfigured()));
}
