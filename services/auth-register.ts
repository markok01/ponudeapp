import { randomBytes } from "crypto";
import type { ResultSetHeader } from "mysql2";
import { withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { slugifyCompanyName } from "@/services/organizations";
import { getUserByEmail, getUserById, type AppUser } from "@/services/users";

const NAME_MAX = 120;

export function trimPersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

export function trimCompanyName(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

export function resolveCompanyName(companyName: string, personName: string): string {
  return companyName || personName;
}

export async function createOrganizationOwnerAccount(input: {
  companyName: string;
  personName: string;
  email: string;
  passwordHash: string;
  googleSub?: string | null;
}): Promise<AppUser> {
  const personName = trimPersonName(input.personName);
  const companyName = resolveCompanyName(
    trimCompanyName(input.companyName),
    personName,
  );
  const email = input.email.trim().toLowerCase();
  if (!personName) throw new AuthCodedError("person_name_required");
  if (!email || !email.includes("@")) throw new AuthCodedError("invalid_email");

  const baseSlug = slugifyCompanyName(companyName);
  const googleSub = input.googleSub?.trim() || null;

  const userId = await withTransaction(async (conn) => {
    let orgId = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug.slice(0, 40)}-${randomBytes(3).toString("hex")}`;
      try {
        const [orgResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO organizations (name, slug, plan, status, trial_ends_at, onboarding_completed)
           VALUES (?, ?, 'trial', 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY), 0)`,
          [companyName, slug],
        );
        orgId = Number(orgResult.insertId);
        break;
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "ER_DUP_ENTRY") throw error;
      }
    }
    if (!orgId) throw new AuthCodedError("org_create_failed");

    const [userResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users
        (organization_id, email, password_hash, name, role, active, email_verified_at, google_sub)
       VALUES (?, ?, ?, ?, 'owner', 1, UTC_TIMESTAMP(), ?)`,
      [orgId, email, input.passwordHash, personName, googleSub],
    );
    return Number(userResult.insertId);
  });

  const user = await getUserById(userId);
  if (!user) throw new AuthCodedError("register_failed");
  return user;
}

export async function registerOrganizationOwner(input: {
  companyName?: string;
  personName: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  const personName = trimPersonName(input.personName);
  const email = input.email.trim().toLowerCase();

  if (!personName) throw new AuthCodedError("person_name_required");
  if (!email || !email.includes("@")) throw new AuthCodedError("invalid_email");
  if (!input.password || input.password.length < 8) {
    throw new AuthCodedError("password_too_short");
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new AuthCodedError("email_in_use");
  }

  const passwordHash = await hashPassword(input.password);
  return createOrganizationOwnerAccount({
    companyName: input.companyName ?? "",
    personName,
    email,
    passwordHash,
  });
}
