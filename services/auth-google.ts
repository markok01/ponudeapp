import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/password";
import type { GoogleProfile } from "@/lib/google-oauth";
import { isGoogleSignupEnabled } from "@/lib/google-oauth";
import {
  createOrganizationOwnerAccount,
  trimCompanyName,
  trimPersonName,
} from "@/services/auth-register";
import {
  getUserByEmail,
  getUserByGoogleSub,
  getUserById,
  linkGoogleSub,
  type AppUser,
} from "@/services/users";

export class GoogleAuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export type GoogleResolveResult =
  | { kind: "session"; user: AppUser }
  | { kind: "complete_profile"; profile: GoogleProfile };

export async function resolveGoogleUser(
  profile: GoogleProfile,
): Promise<GoogleResolveResult> {
  if (!profile.emailVerified) {
    throw new GoogleAuthError(
      "google_unverified",
      "Google nalog nema potvrđen email.",
    );
  }

  const bySub = await getUserByGoogleSub(profile.sub);
  if (bySub) {
    if (!bySub.active) {
      throw new GoogleAuthError("google_inactive", "Nalog je deaktiviran.");
    }
    return { kind: "session", user: bySub };
  }

  const byEmail = await getUserByEmail(profile.email);
  if (byEmail) {
    if (!byEmail.active) {
      throw new GoogleAuthError("google_inactive", "Nalog je deaktiviran.");
    }
    if (byEmail.google_sub && byEmail.google_sub !== profile.sub) {
      throw new GoogleAuthError(
        "google_mismatch",
        "Ovaj email je već vezan za drugi Google nalog.",
      );
    }
    await linkGoogleSub(byEmail.id, profile.sub);
    const linked = await getUserById(byEmail.id);
    if (!linked) throw new GoogleAuthError("google_failed", "Nalog nije pronađen");
    return { kind: "session", user: linked };
  }

  if (!isGoogleSignupEnabled()) {
    throw new GoogleAuthError(
      "google_no_account",
      "Nalog sa ovim emailom ne postoji. Registrujte se ili se prijavite lozinkom.",
    );
  }

  return { kind: "complete_profile", profile };
}

export async function completeGoogleSignup(input: {
  sub: string;
  email: string;
  personName: string;
  companyName?: string;
}): Promise<AppUser> {
  const personName = trimPersonName(input.personName);
  if (!personName) {
    throw new GoogleAuthError("google_name_required", "Unesite ime");
  }

  const bySub = await getUserByGoogleSub(input.sub);
  if (bySub) {
    if (!bySub.active) {
      throw new GoogleAuthError("google_inactive", "Nalog je deaktiviran.");
    }
    return bySub;
  }

  const email = input.email.trim().toLowerCase();
  const byEmail = await getUserByEmail(email);
  if (byEmail) {
    if (!byEmail.active) {
      throw new GoogleAuthError("google_inactive", "Nalog je deaktiviran.");
    }
    if (byEmail.google_sub && byEmail.google_sub !== input.sub) {
      throw new GoogleAuthError(
        "google_mismatch",
        "Ovaj email je već vezan za drugi Google nalog.",
      );
    }
    await linkGoogleSub(byEmail.id, input.sub);
    const linked = await getUserById(byEmail.id);
    if (!linked) throw new GoogleAuthError("google_failed", "Nalog nije pronađen");
    return linked;
  }

  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  return createOrganizationOwnerAccount({
    companyName: trimCompanyName(input.companyName),
    personName,
    email,
    passwordHash,
    googleSub: input.sub,
  });
}
