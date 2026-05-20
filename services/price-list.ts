import { query, execute, type RowDataPacket } from "@/lib/db";
import type { PriceListRecord } from "@/types";
import type { Product } from "@/types";

interface PriceListRow extends RowDataPacket {
  id: number;
  name: string;
  file_name: string | null;
  active: number;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  removed_count: number;
  snapshot_json: string | null;
  uploaded_at: string;
}

function mapPriceList(row: PriceListRow): PriceListRecord {
  return {
    id: row.id,
    name: row.name,
    file_name: row.file_name,
    active: Boolean(row.active),
    row_count: Number(row.row_count ?? 0),
    inserted_count: Number(row.inserted_count ?? 0),
    updated_count: Number(row.updated_count ?? 0),
    skipped_count: Number(row.skipped_count ?? 0),
    removed_count: Number(row.removed_count ?? 0),
    has_snapshot: Boolean(row.snapshot_json && row.snapshot_json.length > 2),
    uploaded_at: row.uploaded_at,
  };
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

export async function captureProductSnapshot(): Promise<ProductSnapshot[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT sku, name, category, price, pdv_percent, measure_unit, sort_order, active
     FROM products ORDER BY sort_order ASC, id ASC`,
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

export async function createPriceListRecord(
  name: string,
  stats: {
    fileName?: string;
    rowCount?: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    removed?: number;
    snapshot?: ProductSnapshot[];
  },
): Promise<number> {
  const result = await execute(
    `INSERT INTO price_lists
      (name, file_name, active, row_count, inserted_count, updated_count, skipped_count, removed_count, snapshot_json)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      stats.fileName ?? null,
      stats.rowCount ?? 0,
      stats.inserted ?? 0,
      stats.updated ?? 0,
      stats.skipped ?? 0,
      stats.removed ?? 0,
      stats.snapshot ? JSON.stringify(stats.snapshot) : null,
    ],
  );
  return result.insertId;
}

export async function listPriceListRecords(limit = 10): Promise<PriceListRecord[]> {
  const rows = await query<PriceListRow[]>(
    `SELECT id, name, file_name, active, row_count, inserted_count, updated_count,
            skipped_count, removed_count, snapshot_json, uploaded_at
     FROM price_lists
     ORDER BY uploaded_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(mapPriceList);
}

export async function getPriceListById(id: number): Promise<(PriceListRecord & { snapshot: ProductSnapshot[] | null }) | null> {
  const rows = await query<PriceListRow[]>(`SELECT * FROM price_lists WHERE id = ?`, [id]);
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

export async function rollbackPriceListSnapshot(id: number): Promise<{ restored: number }> {
  const record = await getPriceListById(id);
  if (!record?.snapshot?.length) {
    throw new Error("Snapshot nije dostupan za ovaj uvoz");
  }

  const { bulkUpsertProductsBySku, replaceProductCatalog } = await import("@/services/products");

  await replaceProductCatalog();

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

  await bulkUpsertProductsBySku(rows);

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
  const sampleAdded: ImportPreviewDiff["sampleAdded"] = [];
  const sampleUpdated: ImportPreviewDiff["sampleUpdated"] = [];

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
  const sampleRemoved: ImportPreviewDiff["sampleRemoved"] = [];
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

type ImportPreviewDiff = import("@/types").ImportPreviewDiff;
