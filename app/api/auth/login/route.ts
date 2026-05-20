import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  countUsers,
} from "@/services/users";
import {
  createUserSession,
  DeviceLimitError,
  revokeUserSession,
} from "@/services/user-sessions";
import {
  createSessionToken,
  getSessionMaxAgeSec,
  isAuthEnabled,
  isAuthRequired,
  isLegacyPasswordAuth,
  parseSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyAppPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    if (!isAuthEnabled()) {
      return NextResponse.json({ ok: true, authEnabled: false });
    }

    const body = await request.json();
    const remember = body.remember !== false;
    const maxAgeSec = getSessionMaxAgeSec(remember);

    if (isLegacyPasswordAuth()) {
      const password = String(body.password ?? "");
      if (!verifyAppPassword(password)) {
        return NextResponse.json({ error: "Pogrešna lozinka" }, { status: 401 });
      }
      const token = createSessionToken({ id: 0, email: "legacy@app" }, maxAgeSec);
      const response = NextResponse.json({ ok: true, authEnabled: true, legacy: true });
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
      return response;
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i lozinka su obavezni" },
        { status: 400 },
      );
    }

    if (isAuthRequired()) {
      const total = await countUsers();
      if (total === 0) {
        return NextResponse.json(
          {
            error:
              "Nema kreiranih naloga. Pokrenite: node scripts/create-user.mjs",
          },
          { status: 503 },
        );
      }
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Pogrešan email ili lozinka" },
        { status: 401 },
      );
    }

    const existingToken = request.cookies.get(SESSION_COOKIE)?.value;
    const existing = parseSessionToken(existingToken);
    if (existing?.userId === user.id && existing.sid) {
      await revokeUserSession(existing.sid);
    }

    let sessionId: string;
    try {
      sessionId = await createUserSession(user.id, maxAgeSec);
    } catch (err) {
      if (err instanceof DeviceLimitError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 403 },
        );
      }
      throw err;
    }
    const token = createSessionToken(
      {
        id: user.id,
        email: user.email,
        sessionVersion: user.session_version,
        sessionId,
      },
      maxAgeSec,
    );
    const response = NextResponse.json({
      ok: true,
      authEnabled: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    const message = error instanceof Error ? error.message : "";

    if (message.includes("JWT_SECRET")) {
      return NextResponse.json(
        { error: "JWT_SECRET nije podešen na serveru (Vercel env)." },
        { status: 500 },
      );
    }
    if (
      message.includes("MYSQL_HOST") ||
      message.includes("MYSQL_PASSWORD") ||
      message.includes("MYSQL_DATABASE") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("Access denied")
    ) {
      return NextResponse.json(
        {
          error:
            "Greška konekcije na bazu. Proverite MYSQL_* env na Vercelu (Project, ne Shared).",
        },
        { status: 500 },
      );
    }
    if (message.includes("users") || message.includes("ER_NO_SUCH_TABLE")) {
      return NextResponse.json(
        {
          error:
            "Pogrešna baza (verovatno defaultdb umesto ponudaapp). Na Vercel dodaj PONUDEAPP_DATABASE=ponudaapp u Project env.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Prijava nije uspela" },
      { status: 500 },
    );
  }
}
