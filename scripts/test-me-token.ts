/**
 * Login preko HTTP pa getSessionUser(token) u istom procesu kao API.
 * LOGIN_PASSWORD=... npx tsx --env-file=.env.local scripts/test-me-token.ts
 */
import { getSessionUser, parseSessionToken } from "../lib/auth";
import { getUserById } from "../services/users";
import { resolveUserSession } from "../services/user-sessions";
import { isAdminIdleExpired } from "../lib/security/admin-idle";

async function main() {
const password = process.env.LOGIN_PASSWORD;
if (!password) {
  console.error("LOGIN_PASSWORD required");
  process.exit(1);
}

const loginRes = await fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "klincovmarko01@gmail.com",
    password,
    remember: true,
  }),
});

const body = await loginRes.json();
console.log("login", loginRes.status, body);

const setCookies = loginRes.headers.getSetCookie?.() ?? [];
const line = setCookies.find((c) => c.startsWith("ponudeapp_session=")) ?? "";
const token = decodeURIComponent(line.split("=")[1]?.split(";")[0] ?? "");

console.log("token len", token.length);
console.log("parse", parseSessionToken(token));

const payload = parseSessionToken(token)!;
const dbUser = await getUserById(payload.userId);
console.log("dbUser", dbUser?.active, "sv", dbUser?.session_version, "payload.sv", payload.sv);
const resolved = await resolveUserSession(payload.sid, payload.userId);
console.log("resolved", resolved);
if (resolved && dbUser?.role === "admin") {
  console.log("adminIdle", isAdminIdleExpired(resolved.lastActivityAt));
}
const user = await getSessionUser(token);
console.log("getSessionUser", user);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
