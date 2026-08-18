/** Operator nalog — nije klijentska uloga. */

export function parseSuperadminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(user: {
  email?: string | null;
  role?: string | null;
}): boolean {
  if (user.role === "superadmin") return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return parseSuperadminEmails().includes(email);
}
