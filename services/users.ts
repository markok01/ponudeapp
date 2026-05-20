import { execute, query, type RowDataPacket } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export type UserRole = "admin" | "user";

export interface AppUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  session_version: number;
  created_at: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  active: number;
  session_version: number;
  created_at: string;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
    active: Boolean(row.active),
    session_version: Number(row.session_version ?? 1),
    created_at: row.created_at,
  };
}

export function getMaxUsers(): number {
  const raw = process.env.MAX_USERS?.trim();
  const n = raw ? Number(raw) : 2;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export async function countUsers(): Promise<number> {
  const rows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM users`);
  return Number(rows[0]?.cnt ?? 0);
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

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  const { password_hash: _, ...safe } = user;
  return safe;
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Unesite ispravan email");
  }
  if (!input.password || input.password.length < 8) {
    throw new Error("Lozinka mora imati najmanje 8 karaktera");
  }

  const total = await countUsers();
  const max = getMaxUsers();
  if (total >= max) {
    throw new Error(
      `Dostignut limit naloga (${max}). Niko novi se ne može registrovati.`,
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("Email je već u upotrebi");
  }

  const password_hash = await hashPassword(input.password);
  const role = input.role === "admin" ? "admin" : "user";

  const result = await execute(
    `INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, 1)`,
    [email, password_hash, input.name?.trim() || email.split("@")[0], role],
  );

  const created = await getUserById(result.insertId);
  if (!created) throw new Error("Nalog nije kreiran");
  return created;
}

export async function listUsers(): Promise<AppUser[]> {
  const rows = await query<UserRow[]>(
    `SELECT * FROM users ORDER BY created_at ASC`,
  );
  return rows.map(mapUser);
}

export async function deactivateUser(id: number): Promise<void> {
  await execute(
    `UPDATE users SET active = 0, session_version = session_version + 1 WHERE id = ?`,
    [id],
  );
}
