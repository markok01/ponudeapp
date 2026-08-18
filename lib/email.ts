export type EmailLocale = "sr" | "en";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  delivered: boolean;
  logged: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailLayout(title: string, bodyHtml: string, buttonLabel: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `<!DOCTYPE html>
<html lang="sr">
<body style="margin:0;padding:24px;background:#f4f5f8;font-family:Arial,sans-serif;color:#1a1d23;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">PonudeApp</p>
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="margin:24px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          ${escapeHtml(buttonLabel)}
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">${safeUrl}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function verificationEmailContent(url: string, locale: EmailLocale = "sr") {
  const sr = locale !== "en";
  const title = sr ? "Potvrdite nalog" : "Confirm your account";
  const html = emailLayout(
    title,
    `<p style="margin:0 0 8px;">Kliknite dugme da potvrdite email i aktivirate nalog.</p>
     <p style="margin:0 0 8px;color:#4b5563;">Click the button to confirm your email and activate the account.</p>
     <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Ako niste vi kreirali nalog, ignorišite ovu poruku. / If this wasn’t you, ignore this email.</p>`,
    "Potvrdi nalog",
    url,
  );
  const text = [
    "PonudeApp",
    "Potvrdite nalog / Confirm your account",
    url,
    "Ako niste vi, ignorišite ovu poruku. / If this wasn’t you, ignore this email.",
  ].join("\n");
  return {
    subject: sr ? "Potvrdite nalog — PonudeApp" : "Confirm your account — PonudeApp",
    html,
    text,
  };
}

export function inviteEmailContent(
  url: string,
  companyName: string,
  locale: EmailLocale = "sr",
) {
  const sr = locale !== "en";
  const title = sr ? "Poziv u PonudeApp" : "Invitation to PonudeApp";
  const html = emailLayout(
    title,
    `<p style="margin:0 0 8px;">Pozvani ste u firmu <strong>${escapeHtml(companyName)}</strong>.</p>
     <p style="margin:0 0 8px;color:#4b5563;">You were invited to join <strong>${escapeHtml(companyName)}</strong>.</p>
     <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Kliknite dugme da postavite lozinku i prihvatite poziv. / Click to set a password and accept.</p>`,
    "Potvrdi nalog",
    url,
  );
  const text = [
    "PonudeApp",
    `Poziv u firmu ${companyName} / Invitation to join ${companyName}`,
    url,
  ].join("\n");
  return {
    subject: sr
      ? `Poziv u ${companyName} — PonudeApp`
      : `Invitation to ${companyName} — PonudeApp`,
    html,
    text,
  };
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "PonudeApp <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(
      "[email] RESEND_API_KEY nije podešen — poruka nije poslata. Sadržaj (dev):\n" +
        `  To: ${input.to}\n` +
        `  Subject: ${input.subject}\n` +
        `  ${input.text}`,
    );
    return { delivered: false, logged: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Slanje emaila nije uspelo (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  return { delivered: true, logged: false };
}
