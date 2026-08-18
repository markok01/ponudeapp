import { execute, query, type RowDataPacket } from "@/lib/db";
import type { CreateProductInput, Product, UpdateProductInput } from "@/types";
import {
  ensureDefaultPriceList,
  getActivePriceList,
  getPriceListById,
  listPriceLists,
} from "@/services/price-list";

interface ProductRow extends RowDataPacket {
  id: number;
  price_list_id?: number;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  pdv_percent?: number;
  measure_unit?: string | null;
  sort_order?: number;
  active: number;
  created_at: string;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    price_list_id: Number(row.price_list_id ?? 0),
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    pdv_percent: row.pdv_percent != null ? Number(row.pdv_percent) : 20,
    measure_unit: row.measure_unit ?? null,
    sort_order: row.sort_order != null ? Number(row.sort_order) : row.id,
    active: Boolean(row.active),
    created_at: row.created_at,
  };
}

/** Postojeća lista — ne kreira novu. null ako org još nema cenovnik. */
export async function findPriceListId(
  organizationId: number,
  priceListId?: number | null,
): Promise<number | null> {
  if (priceListId && Number.isFinite(priceListId) && priceListId > 0) {
    const list = await getPriceListById(organizationId, priceListId);
    if (!list || list.archived) return null;
    return list.id;
  }
  const active = await getActivePriceList(organizationId);
  if (active) return active.id;
  const any = await listPriceLists(organizationId);
  return any[0]?.id ?? null;
}

/** Za upis: postojeća lista ili podrazumevani cenovnik. */
export async function resolvePriceListId(
  organizationId: number,
  priceListId?: number | null,
): Promise<number> {
  const existing = await findPriceListId(organizationId, priceListId);
  if (existing) return existing;
  if (priceListId && Number.isFinite(priceListId) && priceListId > 0) {
    throw new Error("Cenovnik nije pronađen");
  }
  const list = await ensureDefaultPriceList(organizationId);
  return list.id;
}

export async function getActiveProducts(
  organizationId: number,
  filters?: {
    search?: string;
    category?: string;
    includeInactive?: boolean;
    priceListId?: number;
  },
): Promise<Product[]> {
  const { products } = await getProductsPaginated(organizationId, {
    ...filters,
    page: 1,
    pageSize: 50_000,
  });
  return products;
}

function buildProductWhere(
  organizationId: number,
  priceListId: number,
  filters?: {
    search?: string;
    category?: string;
    includeInactive?: boolean;
  },
): { where: string; params: (string | number)[] } {
  const conditions: string[] = ["organization_id = ?", "price_list_id = ?"];
  const params: (string | number)[] = [organizationId, priceListId];

  if (!filters?.includeInactive) {
    conditions.push("active = 1");
  }

  if (filters?.search) {
    conditions.push("(name LIKE ? OR sku LIKE ? OR category LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters?.category && filters.category !== "all") {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  return { where, params };
}

export async function getProductsPaginated(
  organizationId: number,
  filters?: {
    search?: string;
    category?: string;
    includeInactive?: boolean;
    page?: number;
    pageSize?: number;
    priceListId?: number;
  },
): Promise<{
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  priceListId: number;
}> {
  const priceListId = await findPriceListId(organizationId, filters?.priceListId);
  if (!priceListId) {
    const page = Math.max(1, filters?.page ?? 1);
    const maxPageSize = 50_000;
    const pageSize = Math.min(maxPageSize, Math.max(1, filters?.pageSize ?? 100));
    return { products: [], total: 0, page, pageSize, priceListId: 0 };
  }
  const page = Math.max(1, filters?.page ?? 1);
  const maxPageSize = 50_000;
  const pageSize = Math.min(maxPageSize, Math.max(1, filters?.pageSize ?? 100));
  const offset = (page - 1) * pageSize;
  const { where, params } = buildProductWhere(organizationId, priceListId, filters);

  const countRows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM products ${where}`,
    params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  const rows = await query<ProductRow[]>(
    `SELECT * FROM products ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    products: rows.map(mapProduct),
    total,
    page,
    pageSize,
    priceListId,
  };
}

export async function getProductCategories(
  organizationId: number,
  priceListId?: number,
): Promise<string[]> {
  const listId = await findPriceListId(organizationId, priceListId);
  if (!listId) return [];
  const rows = await query<RowDataPacket[]>(
    `SELECT category, MIN(sort_order) AS first_sort
     FROM products
     WHERE organization_id = ? AND price_list_id = ?
       AND category IS NOT NULL AND category != '' AND active = 1
     GROUP BY category
     ORDER BY first_sort ASC`,
    [organizationId, listId],
  );
  return rows.map((r) => r.category as string);
}

export async function nextGeneratedSku(
  organizationId: number,
  priceListId: number,
): Promise<string> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM products WHERE organization_id = ? AND price_list_id = ?`,
    [organizationId, priceListId],
  );
  let n = Number(rows[0]?.cnt ?? 0) + 1;
  for (let i = 0; i < 50; i++) {
    const sku = `P-${String(n).padStart(4, "0")}`;
    const found = await query<RowDataPacket[]>(
      `SELECT id FROM products WHERE organization_id = ? AND price_list_id = ? AND sku = ? LIMIT 1`,
      [organizationId, priceListId, sku],
    );
    if (!found[0]) return sku;
    n++;
  }
  return `P-${Date.now().toString(36).slice(-6)}`;
}

export async function createProduct(
  organizationId: number,
  input: CreateProductInput,
): Promise<Product> {
  const priceListId = await resolvePriceListId(organizationId, input.price_list_id);
  let sku = input.sku.trim();
  if (!sku) sku = await nextGeneratedSku(organizationId, priceListId);

  const maxRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_sort
     FROM products WHERE organization_id = ? AND price_list_id = ?`,
    [organizationId, priceListId],
  );
  const nextSort = Number(maxRows[0]?.max_sort ?? -1) + 1;

  const result = await execute(
    `INSERT INTO products
      (organization_id, price_list_id, sku, name, category, price, pdv_percent, measure_unit, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      priceListId,
      sku,
      input.name.trim(),
      input.category?.trim() || null,
      input.price,
      input.pdv_percent ?? 20,
      input.measure_unit?.trim() || null,
      nextSort,
      input.active !== false ? 1 : 0,
    ],
  );

  const rows = await query<ProductRow[]>(
    `SELECT * FROM products WHERE id = ? AND organization_id = ?`,
    [result.insertId, organizationId],
  );
  return mapProduct(rows[0]);
}

const BULK_BATCH_SIZE = 200;

export async function bulkUpsertProductsBySku(
  organizationId: number,
  priceListId: number,
  rows: {
    sku: string;
    name: string;
    category?: string | null;
    price: number;
    pdv_percent?: number;
    measure_unit?: string | null;
    sort_order?: number;
    active?: boolean;
  }[],
): Promise<{ inserted: number; updated: number }> {
  if (!rows.length) return { inserted: 0, updated: 0 };

  const normalized = rows.map((r, index) => ({
    sku: r.sku.trim(),
    name: r.name.trim(),
    category: r.category?.trim() || null,
    price: r.price,
    pdv_percent: r.pdv_percent ?? 20,
    measure_unit: r.measure_unit?.trim() || null,
    sort_order: r.sort_order ?? index,
    active: r.active !== false,
  }));

  const uniqueSkus = [...new Set(normalized.map((r) => r.sku))];
  const existingSkus = new Set<string>();

  for (let i = 0; i < uniqueSkus.length; i += 500) {
    const batch = uniqueSkus.slice(i, i + 500);
    const placeholders = batch.map(() => "?").join(",");
    const found = await query<RowDataPacket[]>(
      `SELECT sku FROM products
       WHERE organization_id = ? AND price_list_id = ? AND sku IN (${placeholders})`,
      [organizationId, priceListId, ...batch],
    );
    for (const row of found) {
      existingSkus.add(row.sku as string);
    }
  }

  let inserted = 0;
  let updated = 0;
  for (const row of normalized) {
    if (existingSkus.has(row.sku)) updated++;
    else inserted++;
  }

  for (let i = 0; i < normalized.length; i += BULK_BATCH_SIZE) {
    const batch = normalized.slice(i, i + BULK_BATCH_SIZE);
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
    const values: (string | number | null)[] = [];
    for (const row of batch) {
      values.push(
        organizationId,
        priceListId,
        row.sku,
        row.name,
        row.category,
        row.price,
        row.pdv_percent,
        row.measure_unit,
        row.sort_order,
        row.active ? 1 : 0,
      );
    }

    await execute(
      `INSERT INTO products
        (organization_id, price_list_id, sku, name, category, price, pdv_percent, measure_unit, sort_order, active)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         category = VALUES(category),
         price = VALUES(price),
         pdv_percent = VALUES(pdv_percent),
         measure_unit = COALESCE(VALUES(measure_unit), measure_unit),
         sort_order = VALUES(sort_order),
         active = VALUES(active)`,
      values,
    );
  }

  return { inserted, updated };
}

export async function updateProduct(
  organizationId: number,
  id: number,
  input: UpdateProductInput,
): Promise<Product> {
  const existing = await getProductById(organizationId, id);
  if (!existing) {
    throw new Error("Proizvod nije pronađen");
  }

  const sku = input.sku !== undefined ? input.sku.trim() : existing.sku;
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const category =
    input.category !== undefined
      ? input.category?.trim() || null
      : existing.category;
  const price = input.price !== undefined ? input.price : existing.price;
  const pdv_percent =
    input.pdv_percent !== undefined ? input.pdv_percent : existing.pdv_percent;
  const active = input.active !== undefined ? input.active : existing.active;

  if (!sku || !name) {
    throw new Error("Šifra i naziv su obavezni");
  }
  if (price < 0) {
    throw new Error("Cena mora biti pozitivna");
  }

  const measure_unit =
    input.measure_unit !== undefined
      ? input.measure_unit?.trim() || null
      : existing.measure_unit;

  await execute(
    `UPDATE products
     SET sku = ?, name = ?, category = ?, price = ?, pdv_percent = ?, measure_unit = ?, active = ?
     WHERE id = ? AND organization_id = ?`,
    [sku, name, category, price, pdv_percent, measure_unit, active ? 1 : 0, id, organizationId],
  );

  const updated = await getProductById(organizationId, id);
  if (!updated) throw new Error("Proizvod nije pronađen");
  return updated;
}

export async function getProductById(
  organizationId: number,
  id: number,
): Promise<Product | null> {
  const rows = await query<ProductRow[]>(
    `SELECT * FROM products WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
  );
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function getProductQuoteUsageCount(
  organizationId: number,
  id: number,
): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT qi.quote_id) AS cnt
     FROM quote_items qi
     INNER JOIN quotes q ON q.id = qi.quote_id
     INNER JOIN products p ON p.id = qi.product_id
     WHERE qi.product_id = ? AND q.organization_id = ? AND p.organization_id = ?`,
    [id, organizationId, organizationId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function deleteProduct(
  organizationId: number,
  id: number,
): Promise<{ action: "deleted" | "deactivated" }> {
  const existing = await getProductById(organizationId, id);
  if (!existing) {
    throw new Error("Proizvod nije pronađen");
  }

  const inQuote = await query<RowDataPacket[]>(
    `SELECT 1 FROM quote_items WHERE product_id = ? LIMIT 1`,
    [id],
  );

  if (inQuote.length > 0) {
    await execute(
      `UPDATE products SET active = 0 WHERE id = ? AND organization_id = ?`,
      [id, organizationId],
    );
    return { action: "deactivated" };
  }

  await execute(`DELETE FROM products WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
  return { action: "deleted" };
}

export async function replaceProductCatalog(
  organizationId: number,
  priceListId: number,
): Promise<{
  deactivated: number;
  removed: number;
}> {
  const deactivate = await execute(
    `UPDATE products SET active = 0 WHERE organization_id = ? AND price_list_id = ?`,
    [organizationId, priceListId],
  );
  const removed = await execute(
    `DELETE p FROM products p
     LEFT JOIN quote_items qi ON qi.product_id = p.id
     WHERE p.organization_id = ? AND p.price_list_id = ? AND p.active = 0 AND qi.id IS NULL`,
    [organizationId, priceListId],
  );
  return {
    deactivated: deactivate.affectedRows ?? 0,
    removed: removed.affectedRows ?? 0,
  };
}
