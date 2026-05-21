import { execute, query, type RowDataPacket } from "@/lib/db";
import type { CreateProductInput, Product, UpdateProductInput } from "@/types";

interface ProductRow extends RowDataPacket {
  id: number;
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

export async function getActiveProducts(filters?: {
  search?: string;
  category?: string;
  includeInactive?: boolean;
}): Promise<Product[]> {
  const { products } = await getProductsPaginated({
    ...filters,
    page: 1,
    pageSize: 50_000,
  });
  return products;
}

function buildProductWhere(filters?: {
  search?: string;
  category?: string;
  includeInactive?: boolean;
}): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function getProductsPaginated(filters?: {
  search?: string;
  category?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters?.page ?? 1);
  const maxPageSize = 50_000;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, filters?.pageSize ?? 100),
  );
  const offset = (page - 1) * pageSize;
  const { where, params } = buildProductWhere(filters);

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
  };
}

export async function getProductCategories(): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT category, MIN(sort_order) AS first_sort
     FROM products
     WHERE category IS NOT NULL AND category != '' AND active = 1
     GROUP BY category
     ORDER BY first_sort ASC`,
  );
  return rows.map((r) => r.category as string);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const maxRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM products`,
  );
  const nextSort = Number(maxRows[0]?.max_sort ?? -1) + 1;

  const result = await execute(
    `INSERT INTO products (sku, name, category, price, pdv_percent, measure_unit, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sku.trim(),
      input.name.trim(),
      input.category?.trim() || null,
      input.price,
      input.pdv_percent ?? 20,
      input.measure_unit?.trim() || null,
      nextSort,
      input.active !== false ? 1 : 0,
    ],
  );

  const rows = await query<ProductRow[]>(`SELECT * FROM products WHERE id = ?`, [
    result.insertId,
  ]);
  return mapProduct(rows[0]);
}

const BULK_BATCH_SIZE = 200;

export async function bulkUpsertProductsBySku(
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
      `SELECT sku FROM products WHERE sku IN (${placeholders})`,
      batch,
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
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?)").join(",");
    const values: (string | number | null)[] = [];
    for (const row of batch) {
      values.push(
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
      `INSERT INTO products (sku, name, category, price, pdv_percent, measure_unit, sort_order, active) VALUES ${placeholders}
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

export async function upsertProductBySku(data: {
  sku: string;
  name: string;
  category?: string | null;
  price: number;
  pdv_percent?: number;
}): Promise<"inserted" | "updated"> {
  const existing = await query<ProductRow[]>(
    `SELECT id FROM products WHERE sku = ? LIMIT 1`,
    [data.sku.trim()],
  );

  if (existing.length > 0) {
    await execute(
      `UPDATE products SET name = ?, category = ?, price = ?, pdv_percent = ?, active = 1 WHERE sku = ?`,
      [
        data.name.trim(),
        data.category?.trim() || null,
        data.price,
        data.pdv_percent ?? 20,
        data.sku.trim(),
      ],
    );
    return "updated";
  }

  await execute(
    `INSERT INTO products (sku, name, category, price, pdv_percent, active) VALUES (?, ?, ?, ?, ?, 1)`,
    [
      data.sku.trim(),
      data.name.trim(),
      data.category?.trim() || null,
      data.price,
      data.pdv_percent ?? 20,
    ],
  );
  return "inserted";
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product> {
  const existing = await getProductById(id);
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
    `UPDATE products SET sku = ?, name = ?, category = ?, price = ?, pdv_percent = ?, measure_unit = ?, active = ? WHERE id = ?`,
    [sku, name, category, price, pdv_percent, measure_unit, active ? 1 : 0, id],
  );

  const updated = await getProductById(id);
  if (!updated) throw new Error("Proizvod nije pronađen");
  return updated;
}

export async function getProductById(id: number): Promise<Product | null> {
  const rows = await query<ProductRow[]>(`SELECT * FROM products WHERE id = ?`, [id]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

/** Broj ponuda u kojima se proizvod koristi. */
export async function getProductQuoteUsageCount(id: number): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT quote_id) AS cnt FROM quote_items WHERE product_id = ?`,
    [id],
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** Briše proizvod ili ga deaktivira ako je u ponudi. */
export async function deleteProduct(
  id: number,
): Promise<{ action: "deleted" | "deactivated" }> {
  const existing = await getProductById(id);
  if (!existing) {
    throw new Error("Proizvod nije pronađen");
  }

  const inQuote = await query<RowDataPacket[]>(
    `SELECT 1 FROM quote_items WHERE product_id = ? LIMIT 1`,
    [id],
  );

  if (inQuote.length > 0) {
    await execute(`UPDATE products SET active = 0 WHERE id = ?`, [id]);
    return { action: "deactivated" };
  }

  await execute(`DELETE FROM products WHERE id = ?`, [id]);
  return { action: "deleted" };
}

/** Uklanja stari katalog pre novog uvoza (čuva proizvode koji su u ponudama). */
export async function replaceProductCatalog(): Promise<{
  deactivated: number;
  removed: number;
}> {
  const deactivate = await execute(`UPDATE products SET active = 0`);
  const removed = await execute(
    `DELETE p FROM products p
     LEFT JOIN quote_items qi ON qi.product_id = p.id
     WHERE p.active = 0 AND qi.id IS NULL`,
  );
  return {
    deactivated: deactivate.affectedRows ?? 0,
    removed: removed.affectedRows ?? 0,
  };
}
