import { execute, query, type RowDataPacket } from "@/lib/db";
import { getSeatLimit } from "@/lib/plan-limits";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseOrgMemberRole, parseUserRole, type UserRole } from "@/lib/roles";
import {
  PasswordPolicyError,
  validateAdminCreatedPassword,
} from "@/lib/security/password-policy";
import { getOrganizationById } from "@/services/organizations";
import {
  atomicDeactivateUserSessions,
  revokeAllUserSessions,
} from "@/services/user-sessions";
import {
  atomicInvalidateSessionsOnRoleChange,
  atomicRevokeAllUserSessions,
} from "@/lib/security/session-revoke";

export type { UserRole };

export interface AppUser {
  id: number;
  organization_id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  session_version: number;
  email_verified_at: string | null;
  google_sub: string | null;
  created_at: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  organization_id: number | null;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  active: number;
  session_version: number;
  email_verified_at: Date | string | null;
  google_sub: string | null;
  created_at: string;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    organization_id: Number(row.organization_id ?? 0),
    email: row.email,
    name: row.name,
    role: parseUserRole(row.role),
    active: Boolean(row.active),
    session_version: Number(row.session_version ?? 1),
    email_verified_at: row.email_verified_at
      ? String(row.email_verified_at).slice(0, 19)
      : null,
    google_sub: row.google_sub?.trim() || null,
    created_at: row.created_at,
  };
}

/** @deprecated Koristite getOrgSeatLimit — ostavljeno za stare pozive bez org. */
export function getMaxUsers(): number {
  const raw = process.env.MAX_USERS?.trim();
  const n = raw ? Number(raw) : 3;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

export async function getOrgSeatLimit(organizationId: number): Promise<number> {
  const org = await getOrganizationById(organizationId);
  return getSeatLimit(org?.plan ?? "trial");
}

export async function countUsers(organizationId?: number): Promise<number> {
  if (organizationId) {
    const rows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE organization_id = ?`,
      [organizationId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }
  const rows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM users`);
  return Number(rows[0]?.cnt ?? 0);
}

export async function countPendingInvites(organizationId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM organization_invites
     WHERE organization_id = ? AND accepted_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [organizationId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function assertOrgHasSeat(organizationId: number): Promise<void> {
  const used =
    (await countUsers(organizationId)) + (await countPendingInvites(organizationId));
  const max = await getOrgSeatLimit(organizationId);
  if (used >= max) {
    throw new Error(
      `Dostignut limit naloga za plan (${max}). Nadogradite plan ili uklonite nalog.`,
    );
  }
}

export async function getUserByEmail(email: string): Promise<(AppUser & { password_hash: string }) | null> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  if (!rows[0]) return null;
  return { ...mapUser(rows[0]), password_hash: rows[0].password_hash };
}

export async function getUserById(id: number): Promise<AppUser | null> {
  const rows = await query<UserRow[]>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByGoogleSub(sub: string): Promise<AppUser | null> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE google_sub = ? LIMIT 1`,
    [sub],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function linkGoogleSub(userId: number, googleSub: string): Promise<void> {
  await execute(
    `UPDATE users
     SET google_sub = ?,
         email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())
     WHERE id = ?`,
    [googleSub, userId],
  );
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  return getUserById(user.id);
}

/** Povećava session_version i gasi sve sesije (atomski). */
export async function bumpUserSecurityVersion(userId: number): Promise<void> {
  await atomicRevokeAllUserSessions(userId, { bumpSessionVersion: true });
}

export async function changeUserRole(
  userId: number,
  role: UserRole,
): Promise<void> {
  if (role === "superadmin") {
    throw new Error("superadmin se ne dodeljuje iz aplikacije");
  }
  await atomicInvalidateSessionsOnRoleChange(userId, role);
}

export async function markEmailVerified(userId: number): Promise<void> {
  await execute(
    `UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ? AND email_verified_at IS NULL`,
    [userId],
  );
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  organizationId: number;
  /** Jača pravila lozinke (admin kreira nalog u aplikaciji). */
  strictPassword?: boolean;
  emailVerified?: boolean;
  skipSeatCheck?: boolean;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Unesite ispravan email");
  }
  if (input.strictPassword) {
    const policy = validateAdminCreatedPassword(input.password);
    if (!policy.ok) {
      throw new PasswordPolicyError(policy.reasons);
    }
  } else if (!input.password || input.password.length < 8) {
    throw new Error("Lozinka mora imati najmanje 8 karaktera");
  }

  if (!input.skipSeatCheck) {
    await assertOrgHasSeat(input.organizationId);
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("Email je već u upotrebi");
  }

  const password_hash = await hashPassword(input.password);
  const role = parseOrgMemberRole(input.role);
  const verifiedSql = input.emailVerified === false ? "NULL" : "UTC_TIMESTAMP()";

  const result = await execute(
    `INSERT INTO users (organization_id, email, password_hash, name, role, active, email_verified_at)
     VALUES (?, ?, ?, ?, ?, 1, ${verifiedSql})`,
    [
      input.organizationId,
      email,
      password_hash,
      input.name?.trim() || email.split("@")[0],
      role,
    ],
  );

  const created = await getUserById(result.insertId);
  if (!created) throw new Error("Nalog nije kreiran");
  return created;
}

export async function listUsers(organizationId: number): Promise<AppUser[]> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE organization_id = ? ORDER BY created_at ASC`,
    [organizationId],
  );
  return rows.map(mapUser);
}

export async function deactivateUser(id: number, organizationId?: number): Promise<void> {
  const user = await getUserById(id);
  if (!user) throw new Error("Nalog nije pronađen");
  if (organizationId && user.organization_id !== organizationId) {
    throw new Error("Nalog nije pronađen");
  }
  if (user.role === "owner") {
    throw new Error("Vlasnik firme se ne može deaktivirati");
  }
  await atomicDeactivateUserSessions(id);
}

/** Trajno briše nalog i sve njegove sesije (nestaje iz liste). */
export async function deleteUser(id: number, organizationId?: number): Promise<void> {
  const user = await getUserById(id);
  if (!user) throw new Error("Nalog nije pronađen");
  if (organizationId && user.organization_id !== organizationId) {
    throw new Error("Nalog nije pronađen");
  }
  if (user.role === "owner") {
    throw new Error("Vlasnik firme se ne može obrisati");
  }
  await revokeAllUserSessions(id);
  const result = await execute(`DELETE FROM users WHERE id = ?`, [id]);
  if (!result.affectedRows) {
    throw new Error("Nalog nije pronađen");
  }
}
