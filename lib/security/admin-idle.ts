/** Admin sesija — kraći idle timeout (minuti). Podrazumevano 120 min. */
export function getAdminIdleTimeoutMs(): number {
  const raw = process.env.ADMIN_SESSION_IDLE_MINUTES?.trim();
  const minutes = raw ? Number(raw) : 120;
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
  return safe * 60 * 1000;
}

export function isAdminIdleExpired(lastActivityAt: Date | string): boolean {
  const at =
    typeof lastActivityAt === "string"
      ? new Date(lastActivityAt).getTime()
      : lastActivityAt.getTime();
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > getAdminIdleTimeoutMs();
}
