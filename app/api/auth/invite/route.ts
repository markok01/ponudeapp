import { NextRequest, NextResponse } from "next/server";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { authError } from "@/lib/authI18n";
import { PasswordPolicyError } from "@/lib/security/password-policy";
import { acceptOrgInvite, getInviteByRawToken } from "@/services/org-invites";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const found = await getInviteByRawToken(token);
  if (!found) {
    return authError(request, "invite_invalid", 400);
  }
  return NextResponse.json({
    ok: true,
    email: found.invite.email,
    name: found.invite.name,
    companyName: found.companyName,
    role: found.invite.role,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = String(body.password ?? "");
    const passwordConfirm = String(body.passwordConfirm ?? body.confirmPassword ?? "");
    if (password !== passwordConfirm) {
      return authError(request, "password_mismatch", 400);
    }

    const result = await acceptOrgInvite({
      rawToken: String(body.token ?? ""),
      password,
      name: body.name ? String(body.name) : undefined,
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      organizationId: result.organizationId,
    });
  } catch (error) {
    if (error instanceof PasswordPolicyError) {
      return authError(request, "password_policy", 400, { reasons: error.reasons });
    }
    if (error instanceof AuthCodedError) {
      return authError(request, error.code, 400);
    }
    return authError(request, "invite_accept_failed", 400);
  }
}
