import { execute, query, type RowDataPacket } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { inviteEmailContent, sendEmail, type EmailLocale } from "@/lib/email";
import { AuthCodedError } from "@/lib/auth-error-codes";
import { isInviteRole } from "@/lib/roles";
import {
  generateRawSessionToken,
  hashSessionToken,
} from "@/lib/security/token-hash";
import { getOrganizationById } from "@/services/organizations";
import { assertOrgHasSeat, createUser, getUserByEmail, type UserRole } from "@/services/users";
import type { NextRequest } from "next/server";

const INVITE_DAYS = 7;

export interface OrgInvite {
  id: number;
  organization_id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  invited_by: number;
  expires_at: string;
  created_at: string;
}

interface InviteRow extends RowDataPacket {
  id: number;
  organization_id: number;
  email: string;
  name: string;
  role: string;
  invited_by: number;
  token_hash: string;
  expires_at: Date | string;
  accepted_at: Date | string | null;
  created_at: Date | string;
}

function mapInvite(row: InviteRow): OrgInvite {
  const role = row.role === "admin" ? "admin" : "user";
  return {
    id: row.id,
    organization_id: Number(row.organization_id),
    email: row.email,
    name: row.name ?? "",
    role,
    invited_by: Number(row.invited_by),
    expires_at: String(row.expires_at).slice(0, 19),
    created_at: String(row.created_at).slice(0, 19),
  };
}

export async function listPendingInvites(organizationId: number): Promise<OrgInvite[]> {
  const rows = await query<InviteRow[]>(
    `SELECT * FROM organization_invites
     WHERE organization_id = ? AND accepted_at IS NULL AND expires_at > UTC_TIMESTAMP()
     ORDER BY created_at DESC`,
    [organizationId],
  );
  return rows.map(mapInvite);
}

export async function createOrgInvite(input: {
  organizationId: number;
  email: string;
  name?: string;
  role: "admin" | "user";
  invitedBy: number;
  request: NextRequest;
  locale?: EmailLocale;
}): Promise<{ invite: OrgInvite; delivered: boolean; logged: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Unesite ispravan email");
  }
  if (!isInviteRole(input.role)) {
    throw new Error("Uloga mora biti admin ili user");
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    if (existingUser.organization_id === input.organizationId) {
      throw new Error("Ovaj email već ima nalog u firmi");
    }
    throw new Error("Email je već u upotrebi");
  }

  const pending = await query<InviteRow[]>(
    `SELECT id FROM organization_invites
     WHERE organization_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [input.organizationId, email],
  );
  if (pending[0]) {
    throw new Error("Poziv za ovaj email je već poslat");
  }

  await assertOrgHasSeat(input.organizationId);

  const org = await getOrganizationById(input.organizationId);
  if (!org) throw new Error("Organizacija nije pronađena");

  const raw = generateRawSessionToken();
  const tokenHash = hashSessionToken(raw);
  const name = input.name?.trim() || email.split("@")[0];

  const result = await execute(
    `INSERT INTO organization_invites
      (organization_id, email, name, role, invited_by, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [input.organizationId, email, name, input.role, input.invitedBy, tokenHash, INVITE_DAYS],
  );

  const rows = await query<InviteRow[]>(
    `SELECT * FROM organization_invites WHERE id = ? LIMIT 1`,
    [result.insertId],
  );
  if (!rows[0]) throw new Error("Poziv nije sačuvan");

  const acceptUrl = `${getAppUrl(input.request)}/invite/accept?token=${raw}`;
  const content = inviteEmailContent(acceptUrl, org.name, input.locale ?? "sr");
  const sent = await sendEmail({ to: email, ...content });
  if (sent.logged) {
    console.info(`[email] Invite link for ${email}: ${acceptUrl}`);
  }

  return { invite: mapInvite(rows[0]), delivered: sent.delivered, logged: sent.logged };
}

export async function revokeOrgInvite(id: number, organizationId: number): Promise<void> {
  const result = await execute(
    `DELETE FROM organization_invites
     WHERE id = ? AND organization_id = ? AND accepted_at IS NULL`,
    [id, organizationId],
  );
  if (!result.affectedRows) {
    throw new Error("Poziv nije pronađen");
  }
}

export async function getInviteByRawToken(rawToken: string): Promise<{
  invite: OrgInvite;
  companyName: string;
} | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const rows = await query<InviteRow[]>(
    `SELECT * FROM organization_invites
     WHERE token_hash = ? AND accepted_at IS NULL LIMIT 1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const org = await getOrganizationById(row.organization_id);
  return {
    invite: mapInvite(row),
    companyName: org?.name ?? "",
  };
}

export async function acceptOrgInvite(input: {
  rawToken: string;
  password: string;
  name?: string;
}): Promise<{ email: string; organizationId: number; role: UserRole }> {
  const found = await getInviteByRawToken(input.rawToken);
  if (!found) {
    throw new AuthCodedError("invite_invalid");
  }

  const { invite } = found;
  const existing = await getUserByEmail(invite.email);
  if (existing) {
    throw new AuthCodedError("email_in_use");
  }
  if (!input.password || input.password.length < 8) {
    throw new AuthCodedError("password_too_short");
  }

  const user = await createUser({
    email: invite.email,
    password: input.password,
    name: input.name?.trim() || invite.name,
    role: invite.role,
    organizationId: invite.organization_id,
    emailVerified: true,
    skipSeatCheck: true,
  });

  await execute(
    `UPDATE organization_invites SET accepted_at = UTC_TIMESTAMP() WHERE id = ?`,
    [invite.id],
  );

  return {
    email: user.email,
    organizationId: user.organization_id,
    role: user.role,
  };
}
