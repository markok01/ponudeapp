import { execute, query, type RowDataPacket } from "@/lib/db";

export type OrgActivityAction =
  | "price_list.imported"
  | "quote.emailed"
  | "quote.status_changed"
  | "org.data_exported";

export interface OrgActivityEntry {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  summary: string;
  created_at: string;
}

export async function logOrgActivity(input: {
  organizationId: number;
  actorUserId?: number | null;
  actorEmail?: string | null;
  action: OrgActivityAction;
  entityType?: string | null;
  entityId?: number | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await execute(
      `INSERT INTO org_activity_log
        (organization_id, actor_user_id, actor_email, action, entity_type, entity_id, summary, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.organizationId,
        input.actorUserId ?? null,
        input.actorEmail ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.summary.slice(0, 500),
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch (error) {
    console.error("org_activity_log write failed", error);
  }
}

export async function listOrgActivity(
  organizationId: number,
  limit = 50,
): Promise<OrgActivityEntry[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, actor_email, action, entity_type, entity_id, summary, created_at
     FROM org_activity_log
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, Math.min(200, Math.max(1, limit))],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    actor_email: (r.actor_email as string | null) ?? null,
    action: String(r.action),
    entity_type: (r.entity_type as string | null) ?? null,
    entity_id: r.entity_id == null ? null : Number(r.entity_id),
    summary: String(r.summary),
    created_at: String(r.created_at),
  }));
}
