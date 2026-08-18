import { query, execute, type RowDataPacket } from "@/lib/db";
import { normalizeCurrency, type Currency } from "@/lib/currency";
import type { PriceListRecord, PriceListTemplate, Product } from "@/types";

interface PriceListRow extends RowDataPacket {
  id: number;
  name: string;
  template?: string | null;
  currency?: string | null;
  file_name: string | null;
  active: number;
  archived_at?: Date | string | null;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  removed_count: number;
  snapshot_json: string | null;
  uploaded_at: string;
  product_count?: number;
}

export function parsePriceListTemplate(value: unknown): PriceListTemplate {
  if (value === "simple" || value === "horeca" || value === "empty") return value;
  return "empty";
}

function mapPriceList(row: PriceListRow): PriceListRecord {
  return {
    id: row.id,
    name: row.name,
    template: parsePriceListTemplate(row.template),
    currency: normalizeCurrency(row.currency),
    file_name: row.file_name,
    active: Boolean(row.active),
    archived: Boolean(row.archived_at),
    product_count: Number(row.product_count ?? 0),
    row_count: Number(row.row_count ?? 0),
    inserted_count: Number(row.inserted_count ?? 0),
    updated_count: Number(row.updated_count ?? 0),
    skipped_count: Number(row.skipped_count ?? 0),
    removed_count: Number(row.removed_count ?? 0),
    has_snapshot: Boolean(row.snapshot_json && row.snapshot_json.length > 2),
    uploaded_at: row.uploaded_at,
  };
}

const LIST_SELECT = `
  SELECT pl.*,
         (SELECT COUNT(*) FROM products p
          WHERE p.price_list_id = pl.id AND p.active = 1) AS product_count
  FROM price_lists pl
`;

export async function listPriceLists(
  organizationId: number,
  options?: { includeArchived?: boolean },
): Promise<PriceListRecord[]> {
  const archivedSql = options?.includeArchived ? "" : "AND pl.archived_at IS NULL";
  const rows = await query<PriceListRow[]>(
    `${LIST_SELECT}
     WHERE pl.organization_id = ? ${archivedSql}
     ORDER BY pl.active DESC, pl.uploaded_at DESC, pl.id DESC`,
    [organizationId],
  );
  return rows.map(mapPriceList);
}

export async function countPriceLists(organizationId: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM price_lists
     WHERE organization_id = ? AND archived_at IS NULL`,
    [organizationId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function getPriceListById(
  organizationId: number,
  id: number,
): Promise<(PriceListRecord & { snapshot: ProductSnapshot[] | null }) | null> {
  const rows = await query<PriceListRow[]>(
    `${LIST_SELECT} WHERE pl.id = ? AND pl.organization_id = ?`,
    [id, organizationId],
  );
  if (!rows[0]) return null;

  let snapshot: ProductSnapshot[] | null = null;
  if (rows[0].snapshot_json) {
    try {
      snapshot = JSON.parse(rows[0].snapshot_json) as ProductSnapshot[];
    } catch {
      snapshot = null;
    }
  }

  return {
    ...mapPriceList(rows[0]),
    snapshot,
  };
}

export async function getActivePriceList(
  organizationId: number,
): Promise<PriceListRecord | null> {
  const rows = await query<PriceListRow[]>(
    `${LIST_SELECT}
     WHERE pl.organization_id = ? AND pl.active = 1 AND pl.archived_at IS NULL
     ORDER BY pl.id DESC LIMIT 1`,
    [organizationId],
  );
  if (rows[0]) return mapPriceList(rows[0]);
  return null;
}

export async function ensureDefaultPriceList(
  organizationId: number,
): Promise<PriceListRecord> {
  const existing = await getActivePriceList(organizationId);
  if (existing) return existing;

  const any = await listPriceLists(organizationId);
  if (any[0]) {
    await setActivePriceList(organizationId, any[0].id);
    const activated = await getPriceListById(organizationId, any[0].id);
    if (activated) return activated;
  }

  const result = await execute(
    `INSERT INTO price_lists (organization_id, name, template, currency, active)
     VALUES (?, 'Cenovnik', 'empty', 'RSD', 1)`,
    [organizationId],
  );
  const created = await getPriceListById(organizationId, result.insertId);
  if (!created) throw new Error("Cenovnik nije kreiran");
  return created;
}

export async function createPriceList(
  organizationId: number,
  input: {
    name: string;
    template?: PriceListTemplate;
    activate?: boolean;
    currency?: Currency | string;
  },
): Promise<PriceListRecord> {
  const name = input.name.trim() || "Cenovnik";
  const template = parsePriceListTemplate(input.template);
  const currency = normalizeCurrency(input.currency);
  const result = await execute(
    `INSERT INTO price_lists (organization_id, name, template, currency, active)
     VALUES (?, ?, ?, ?, 0)`,
    [organizationId, name, template, currency],
  );
  const hasActive = await getActivePriceList(organizationId);
  if (input.activate !== false || !hasActive) {
    await setActivePriceList(organizationId, result.insertId);
  }
  const created = await getPriceListById(organizationId, result.insertId);
  if (!created) throw new Error("Cenovnik nije kreiran");
  return created;
}

export async function updatePriceList(
  organizationId: number,
  id: number,
  patch: { name?: string; currency?: Currency | string },
): Promise<PriceListRecord> {
  const existing = await getPriceListById(organizationId, id);
  if (!existing || existing.archived) throw new Error("Cenovnik nije pronađen");

  const name =
    patch.name !== undefined ? patch.name.trim() : existing.name;
  if (!name) throw new Error("Unesite ime cenovnika");
  const currency =
    patch.currency !== undefined
      ? normalizeCurrency(patch.currency)
      : existing.currency;

  await execute(
    `UPDATE price_lists SET name = ?, currency = ? WHERE id = ? AND organization_id = ?`,
    [name, currency, id, organizationId],
  );
  const updated = await getPriceListById(organizationId, id);
  if (!updated) throw new Error("Cenovnik nije pronađen");
  return updated;
}

export async function renamePriceList(
  organizationId: number,
  id: number,
  name: string,
): Promise<PriceListRecord> {
  return updatePriceList(organizationId, id, { name });
}

export async function archivePriceList(
  organizationId: number,
  id: number,
): Promise<void> {
  const existing = await getPriceListById(organizationId, id);
  if (!existing || existing.archived) throw new Error("Cenovnik nije pronađen");

  const count = await countPriceLists(organizationId);
  if (count <= 1) {
    throw new Error("Ne možete arhivirati poslednji cenovnik");
  }

  await execute(
    `UPDATE price_lists
     SET archived_at = UTC_TIMESTAMP(), active = 0
     WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
  );

  if (existing.active) {
    const rest = await listPriceLists(organizationId);
    if (rest[0]) await setActivePriceList(organizationId, rest[0].id);
  }
}

export async function setActivePriceList(
  organizationId: number,
  id: number,
): Promise<PriceListRecord> {
  const existing = await getPriceListById(organizationId, id);
  if (!existing || existing.archived) throw new Error("Cenovnik nije pronađen");

  await execute(
    `UPDATE price_lists SET active = 0 WHERE organization_id = ? AND archived_at IS NULL`,
    [organizationId],
  );
  await execute(
    `UPDATE price_lists SET active = 1 WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
  );
  const updated = await getPriceListById(organizationId, id);
  if (!updated) throw new Error("Cenovnik nije pronađen");
  return updated;
}

export async function assertPriceListOwned(
  organizationId: number,
  id: number,
): Promise<PriceListRecord> {
  const list = await getPriceListById(organizationId, id);
  if (!list || list.archived) throw new Error("Cenovnik nije pronađen");
  return list;
}

export type ProductSnapshot = {
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent: number;
  measure_unit: string | null;
  sort_order: number;
  active: boolean;
};

export async function captureProductSnapshot(
  organizationId: number,
  priceListId: number,
): Promise<ProductSnapshot[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT sku, name, category, price, pdv_percent, measure_unit, sort_order, active
     FROM products
     WHERE organization_id = ? AND price_list_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [organizationId, priceListId],
  );
  return rows.map((r) => ({
    sku: r.sku as string,
    name: r.name as string,
    category: r.category as string | null,
    price: Number(r.price),
    pdv_percent: Number(r.pdv_percent ?? 20),
    measure_unit: (r.measure_unit as string | null) ?? null,
    sort_order: Number(r.sort_order ?? 0),
    active: Boolean(r.active),
  }));
}

export async function touchPriceListImport(
  organizationId: number,
  priceListId: number,
  stats: {
    fileName?: string;
    rowCount?: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    removed?: number;
    snapshot?: ProductSnapshot[];
  },
): Promise<void> {
  await execute(
    `UPDATE price_lists
     SET file_name = ?, row_count = ?, inserted_count = ?, updated_count = ?,
         skipped_count = ?, removed_count = ?, snapshot_json = ?, uploaded_at = UTC_TIMESTAMP()
     WHERE id = ? AND organization_id = ?`,
    [
      stats.fileName ?? null,
      stats.rowCount ?? 0,
      stats.inserted ?? 0,
      stats.updated ?? 0,
      stats.skipped ?? 0,
      stats.removed ?? 0,
      stats.snapshot ? JSON.stringify(stats.snapshot) : null,
      priceListId,
      organizationId,
    ],
  );
}

export async function rollbackPriceListSnapshot(
  organizationId: number,
  id: number,
): Promise<{ restored: number }> {
  const record = await getPriceListById(organizationId, id);
  if (!record?.snapshot?.length) {
    throw new Error("Snapshot nije dostupan za ovaj uvoz");
  }

  const { bulkUpsertProductsBySku, replaceProductCatalog } = await import(
    "@/services/products"
  );

  await replaceProductCatalog(organizationId, id);

  const rows = record.snapshot.map((p, index) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.price,
    pdv_percent: p.pdv_percent,
    measure_unit: p.measure_unit,
    sort_order: p.sort_order ?? index,
    active: p.active,
  }));

  await bulkUpsertProductsBySku(organizationId, id, rows);

  return { restored: rows.length };
}

export async function computeImportDiff(
  incoming: { sku: string; name: string; price: number; category?: string | null }[],
  currentProducts: Product[],
): Promise<import("@/types").ImportPreviewDiff> {
  const currentBySku = new Map(currentProducts.map((p) => [p.sku, p]));
  const incomingSkus = new Set(incoming.map((r) => r.sku.trim()));

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const sampleAdded: import("@/types").ImportPreviewDiff["sampleAdded"] = [];
  const sampleUpdated: import("@/types").ImportPreviewDiff["sampleUpdated"] = [];

  for (const row of incoming) {
    const sku = row.sku.trim();
    const existing = currentBySku.get(sku);
    if (!existing) {
      added++;
      if (sampleAdded.length < 5) {
        sampleAdded.push({ sku, name: row.name, price: row.price });
      }
    } else if (
      existing.name !== row.name.trim() ||
      Math.abs(existing.price - row.price) > 0.001 ||
      (existing.category ?? "") !== (row.category?.trim() ?? "")
    ) {
      updated++;
      if (sampleUpdated.length < 5) {
        sampleUpdated.push({
          sku,
          name: row.name,
          oldPrice: existing.price,
          newPrice: row.price,
        });
      }
    } else {
      unchanged++;
    }
  }

  let removed = 0;
  const sampleRemoved: import("@/types").ImportPreviewDiff["sampleRemoved"] = [];
  for (const product of currentProducts) {
    if (!product.active) continue;
    if (!incomingSkus.has(product.sku)) {
      removed++;
      if (sampleRemoved.length < 5) {
        sampleRemoved.push({
          sku: product.sku,
          name: product.name,
          price: product.price,
        });
      }
    }
  }

  return {
    added,
    updated,
    removed,
    unchanged,
    sampleAdded,
    sampleUpdated,
    sampleRemoved,
  };
}

/** @deprecated Istorija uvoza — koristiti listPriceLists. */
export async function listPriceListRecords(
  organizationId: number,
  _limit = 10,
): Promise<PriceListRecord[]> {
  return listPriceLists(organizationId);
}

export async function pruneOldestPriceLists(
  organizationId: number,
  keep: number,
): Promise<void> {
  if (keep <= 0) {
    await execute(
      `UPDATE price_lists SET archived_at = UTC_TIMESTAMP(), active = 0
       WHERE organization_id = ? AND archived_at IS NULL`,
      [organizationId],
    );
    return;
  }
  await execute(
    `UPDATE price_lists
     SET archived_at = UTC_TIMESTAMP(), active = 0
     WHERE organization_id = ?
       AND archived_at IS NULL
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM price_lists
           WHERE organization_id = ? AND archived_at IS NULL
           ORDER BY uploaded_at DESC, id DESC
           LIMIT ?
         ) latest
       )`,
    [organizationId, organizationId, keep],
  );
}

export async function createPriceListRecord(
  organizationId: number,
  name: string,
  _stats?: unknown,
): Promise<number> {
  const created = await createPriceList(organizationId, { name });
  return created.id;
}
