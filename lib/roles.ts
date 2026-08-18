export type UserRole = "owner" | "admin" | "user" | "superadmin";

export function parseUserRole(value: string | null | undefined): UserRole {
  if (value === "owner" || value === "admin" || value === "superadmin") {
    return value;
  }
  return "user";
}

/** Uloge koje klijent može da dodeli u firmi — nikad superadmin. */
export function parseOrgMemberRole(
  value: string | null | undefined,
): Exclude<UserRole, "superadmin"> {
  if (value === "owner" || value === "admin") return value;
  return "user";
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner";
}

/** Owner i admin — podešavanja, korisnici, upload. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteMembers(role: string | null | undefined): boolean {
  return isStaffRole(role);
}

export function hasUnlimitedDevices(role: string | null | undefined): boolean {
  return isStaffRole(role);
}

export function isInviteRole(value: unknown): value is "admin" | "user" {
  return value === "admin" || value === "user";
}
