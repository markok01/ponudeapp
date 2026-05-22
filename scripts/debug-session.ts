/**
 * Lokalna dijagnostika: kreira sesiju i proverava resolve (bez lozinke).
 * Pokreni: npx tsx --env-file=.env.local scripts/debug-session.ts
 */
import { createUserSession, getValidUserSession } from "../services/user-sessions";
import { createSessionToken, parseSessionToken } from "../lib/auth";
import { hashSessionToken } from "../lib/security/token-hash";
import { query } from "../lib/db";
import { getUserByEmail } from "../services/users";

async function main() {
  const email = process.argv[2] ?? "klincovmarko01@gmail.com";
  const user = await getUserByEmail(email);
  if (!user) {
    console.error("Korisnik nije pronađen:", email);
    process.exit(1);
  }

  console.log("user", user.id, user.email, "sv", user.session_version);

  const sid = await createUserSession(user.id, 3600, undefined, {
    deviceId: "debug-device",
    trustScore: 50,
    trustLevel: "medium",
  });
  console.log("created sid prefix", sid.slice(0, 12), "len", sid.length);

  const ok = await getValidUserSession(sid, user.id);
  console.log("getValidUserSession", ok);

  const hash = hashSessionToken(sid);
  const rows = await query<{ id: string; token_hash: string | null }[]>(
    `SELECT id, token_hash FROM user_sessions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 3`,
    [user.id],
  );
  console.log("db rows", rows);

  const token = createSessionToken(
    {
      id: user.id,
      email: user.email,
      sessionVersion: user.session_version,
      sessionId: sid,
    },
    3600,
  );
  const payload = parseSessionToken(token);
  console.log("jwt payload", payload);

  await query(`DELETE FROM user_sessions WHERE token_hash = ?`, [hash]);
  console.log("cleaned up test session");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
