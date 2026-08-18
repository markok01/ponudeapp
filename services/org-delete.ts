import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { execute, query, withTransaction, type RowDataPacket } from "@/lib/db";
import { getOrganizationById } from "@/services/organizations";

export async function deleteOrganizationAndData(organizationId: number): Promise<void> {
  const org = await getOrganizationById(organizationId);
  if (!org) throw new Error("Organizacija nije pronađena");

  if (org.stripe_subscription_id && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.cancel(org.stripe_subscription_id);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "";
      if (code !== "resource_missing") {
        console.error("Stripe cancel on org delete", error);
      }
    }
  }

  const userRows = await query<RowDataPacket[]>(
    `SELECT id FROM users WHERE organization_id = ?`,
    [organizationId],
  );
  const userIds = userRows.map((r) => Number(r.id)).filter((id) => id > 0);

  await withTransaction(async (conn) => {
    await conn.execute(
      `DELETE qi FROM quote_items qi
       INNER JOIN quotes q ON q.id = qi.quote_id
       WHERE q.organization_id = ?`,
      [organizationId],
    );
    await conn.execute(`DELETE FROM quotes WHERE organization_id = ?`, [organizationId]);
    await conn.execute(`DELETE FROM products WHERE organization_id = ?`, [organizationId]);
    await conn.execute(`DELETE FROM price_lists WHERE organization_id = ?`, [organizationId]);
    await conn.execute(`DELETE FROM organization_invites WHERE organization_id = ?`, [
      organizationId,
    ]);
    await conn.execute(`DELETE FROM org_settings WHERE organization_id = ?`, [organizationId]);
    await conn.execute(`DELETE FROM app_settings WHERE organization_id = ?`, [organizationId]);

    if (userIds.length > 0) {
      const placeholders = userIds.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM email_verification_tokens WHERE user_id IN (${placeholders})`,
        userIds,
      );
      await conn.execute(
        `DELETE FROM user_sessions WHERE user_id IN (${placeholders})`,
        userIds,
      );
      await conn.execute(
        `DELETE FROM user_known_devices WHERE user_id IN (${placeholders})`,
        userIds,
      );
      await conn.execute(
        `UPDATE security_audit_log
         SET actor_user_id = NULL, ip_address = NULL, user_agent = NULL
         WHERE actor_user_id IN (${placeholders})`,
        userIds,
      );
      await conn.execute(
        `UPDATE security_audit_log SET target_user_id = NULL WHERE target_user_id IN (${placeholders})`,
        userIds,
      );
    }

    await conn.execute(`DELETE FROM users WHERE organization_id = ?`, [organizationId]);
    await conn.execute(`DELETE FROM organizations WHERE id = ?`, [organizationId]);
  });
}
