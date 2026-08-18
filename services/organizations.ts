import { randomBytes } from "crypto";
import { execute, query, type RowDataPacket } from "@/lib/db";

export type OrgPlan = "trial" | "starter" | "pro" | "business";
export type OrgStatus = "active" | "suspended" | "canceled" | "past_due";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

const DEFAULT_SLUG = "default";

interface OrgRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  plan: string;
  status: string;
  trial_ends_at: string | Date | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  onboarding_completed?: number;
  created_at: string;
}

function mapOrgStatus(status: string): OrgStatus {
  if (status === "suspended" || status === "canceled" || status === "past_due") {
    return status;
  }
  return "active";
}

function mapOrg(row: OrgRow): Organization {
  const plan = row.plan;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan:
      plan === "starter" || plan === "pro" || plan === "business" || plan === "trial"
        ? plan
        : "trial",
    status: mapOrgStatus(row.status),
    trial_ends_at: row.trial_ends_at
      ? String(row.trial_ends_at).slice(0, 19)
      : null,
    stripe_customer_id: row.stripe_customer_id ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    onboarding_completed: row.onboarding_completed !== 0,
    created_at: String(row.created_at),
  };
}

export async function getOrganizationById(id: number): Promise<Organization | null> {
  const rows = await query<OrgRow[]>(
    `SELECT * FROM organizations WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapOrg(rows[0]) : null;
}

export async function getDefaultOrganizationId(): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM organizations WHERE slug = ? LIMIT 1`,
    [DEFAULT_SLUG],
  );
  const id = Number(rows[0]?.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Default organizacija nije kreirana. Restartujte app da se pokrene migracija.");
  }
  return id;
}

export function slugifyCompanyName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "firma";
}

export async function createOrganization(input: {
  name: string;
  plan?: OrgPlan;
}): Promise<Organization> {
  const name = input.name.trim();
  if (!name) throw new Error("Unesite ime firme");

  const plan = input.plan ?? "trial";
  const baseSlug = slugifyCompanyName(name);

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug.slice(0, 40)}-${randomBytes(3).toString("hex")}`;
    try {
      const result = await execute(
        `INSERT INTO organizations (name, slug, plan, status, trial_ends_at, onboarding_completed)
         VALUES (?, ?, ?, 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY), 0)`,
        [name, slug, plan],
      );
      const org = await getOrganizationById(result.insertId);
      if (!org) throw new Error("Organizacija nije kreirana");
      return org;
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "";
      if (code !== "ER_DUP_ENTRY") throw error;
    }
  }

  throw new Error("Nije moguće kreirati firmu (slug zauzet)");
}

export async function getOrganizationByStripeCustomerId(
  customerId: string,
): Promise<Organization | null> {
  const rows = await query<OrgRow[]>(
    `SELECT * FROM organizations WHERE stripe_customer_id = ? LIMIT 1`,
    [customerId],
  );
  return rows[0] ? mapOrg(rows[0]) : null;
}

export async function getOrganizationByStripeSubscriptionId(
  subscriptionId: string,
): Promise<Organization | null> {
  const rows = await query<OrgRow[]>(
    `SELECT * FROM organizations WHERE stripe_subscription_id = ? LIMIT 1`,
    [subscriptionId],
  );
  return rows[0] ? mapOrg(rows[0]) : null;
}

export async function updateOrganizationBilling(
  organizationId: number,
  patch: {
    plan?: OrgPlan;
    status?: OrgStatus;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.plan !== undefined) {
    sets.push("plan = ?");
    values.push(patch.plan);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.stripe_customer_id !== undefined) {
    sets.push("stripe_customer_id = ?");
    values.push(patch.stripe_customer_id);
  }
  if (patch.stripe_subscription_id !== undefined) {
    sets.push("stripe_subscription_id = ?");
    values.push(patch.stripe_subscription_id);
  }
  if (!sets.length) return;
  values.push(organizationId);
  await execute(
    `UPDATE organizations SET ${sets.join(", ")} WHERE id = ?`,
    values,
  );
}

export async function updateOrganizationName(
  organizationId: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Unesite ime firme");
  await execute(`UPDATE organizations SET name = ? WHERE id = ?`, [
    trimmed.slice(0, 120),
    organizationId,
  ]);
}

export async function setOnboardingCompleted(
  organizationId: number,
  completed: boolean,
): Promise<void> {
  await execute(
    `UPDATE organizations SET onboarding_completed = ? WHERE id = ?`,
    [completed ? 1 : 0, organizationId],
  );
}

export interface OrganizationAdminRow {
  id: number;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  trial_ends_at: string | null;
  user_count: number;
  created_at: string;
}

export async function listOrganizationsForAdmin(): Promise<OrganizationAdminRow[]> {
  const rows = await query<
    (OrgRow & { user_count?: number })[]
  >(
    `SELECT o.id, o.name, o.slug, o.plan, o.status, o.trial_ends_at, o.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count
     FROM organizations o
     ORDER BY o.id DESC`,
  );
  return rows.map((row) => {
    const org = mapOrg(row);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      trial_ends_at: org.trial_ends_at,
      user_count: Number(row.user_count ?? 0),
      created_at: org.created_at,
    };
  });
}
