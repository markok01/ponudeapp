/**
 * Test HTTP login + /api/auth/me (lozinka iz LOGIN_PASSWORD env).
 * LOGIN_PASSWORD=xxx node --env-file=.env.local scripts/test-login-flow.mjs
 */
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const email = process.env.TEST_EMAIL ?? "klincovmarko01@gmail.com";
const password = process.env.LOGIN_PASSWORD;

if (!password) {
  console.error("Postavi LOGIN_PASSWORD=... (ne commituj lozinku)");
  process.exit(1);
}

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ email, password, remember: true }),
});

const loginBody = await loginRes.json();
const setCookie = loginRes.headers.get("set-cookie") ?? "";
console.log("login status", loginRes.status, loginBody);
console.log("set-cookie present", setCookie.includes("ponudeapp_session"));

const cookieHeader = setCookie
  .split(",")
  .map((p) => p.split(";")[0].trim())
  .filter((p) => p.startsWith("ponudeapp_session="))
  .join("; ");

const meRes = await fetch(`${base}/api/auth/me`, {
  headers: cookieHeader ? { cookie: cookieHeader } : {},
  cache: "no-store",
});
const meBody = await meRes.json();
console.log("me status", meRes.status, meBody);
