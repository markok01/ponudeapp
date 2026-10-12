import { execute, getPool, query, type RowDataPacket } from "@/lib/db";
import { normalizeCurrency } from "@/lib/currency";
import type {
  CreateQuoteInput,
  Quote,
  QuoteItemWithProduct,
  QuoteWithItems,
  UpdateQuoteInput,
} from "@/types";
import { getAppSettingsFromDb } from "@/services/app-settings";
import { resolveCustomerForQuote } from "@/services/customers";
import { getProductById } from "@/services/products";
import { lineFinalPrice } from "@/utils/quote-calc";
import { formatQuoteNumber } from "@/utils/format-quote-number";
import {
  isQuoteLocked,
  isStoredQuoteStatus,
  parseQuoteStatus,
  type QuoteStatus,
} from "@/lib/quote-status";

interface QuoteRow extends RowDataPacket {
  id: number;
  quote_number?: string | null;
  customer_id?: number | null;
  customer_name: string;
  customer_tax_id?: string | null;
  customer_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  note?: string | null;
  valid_until?: string | null;
  currency?: string | null;
  status?: string | null;
  created_at: string;
  total: number;
}

interface QuoteItemRow extends RowDataPacket {
  id: number;
  quote_id: number;
  product_id: number;
  qty: number;
  discount_percent: number;
  final_price: number;
  snap_sku?: string | null;
  snap_name?: string | null;
  snap_category?: string | null;
  snap_unit_price?: number | null;
  snap_pdv_percent?: number | null;
  snap_measure_unit?: string | null;
  sku: string | null;
  name: string | null;
  category: string | null;
  unit_price: number | null;
  live_unit_price?: number | null;
  pdv_percent: number | null;
  measure_unit?: string | null;
  sort_order: number | null;
}

function mapQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    quote_number:
      row.quote_number?.trim() ||
      formatQuoteNumber(row.id, row.created_at),
    customer_id: row.customer_id == null ? null : Number(row.customer_id),
    customer_name: row.customer_name,
    customer_tax_id: row.customer_tax_id ?? null,
    customer_address: row.customer_address ?? null,
    customer_email: row.customer_email ?? null,
    customer_phone: row.customer_phone ?? null,
    note: row.note ?? null,
    valid_until: row.valid_until
      ? String(row.valid_until).slice(0, 10)
      : null,
    currency: normalizeCurrency(row.currency),
    status: parseQuoteStatus(row.status),
    created_at: row.created_at,
    total: Number(row.total),
  };
}

async function prepareQuoteItems(
  organizationId: number,
  input: CreateQuoteInput,
  fallbackCurrency: string,
) {
  const customerName = input.customer_name?.trim() ?? "";
  if (!customerName && !input.customer_id) {
    throw new Error("Ime kupca je obavezno");
  }
  const customer = await resolveCustomerForQuote(organizationId, {
    customer_id: input.customer_id,
    customer_name: customerName,
  });
  if (!input.items.length) {
    throw new Error("Ponuda mora imati bar jedan proizvod");
  }

  let total = 0;
  const preparedItems: {
    product_id: number;
    qty: number;
    discount_percent: number;
    final_price: number;
    snap_sku: string;
    snap_name: string;
    snap_category: string | null;
    snap_unit_price: number;
    snap_pdv_percent: number;
    snap_measure_unit: string | null;
  }[] = [];

  for (const item of input.items) {
    const product = await getProductById(organizationId, item.product_id);
    if (!product) {
      throw new Error(`Proizvod #${item.product_id} nije pronađen`);
    }
    const qty = Math.max(1, Math.floor(item.qty ?? 1));
    const discount = item.discount_percent;
    if (discount < 0 || discount > 100) {
      throw new Error(`Neispravan rabat za proizvod ${product.sku}`);
    }
    const unitFinal = lineFinalPrice(
      product.price,
      discount,
      product.pdv_percent,
    );
    const final_price = unitFinal * qty;
    total += final_price;
    preparedItems.push({
      product_id: item.product_id,
      qty,
      discount_percent: discount,
      final_price,
      snap_sku: product.sku,
      snap_name: product.name,
      snap_category: product.category,
      snap_unit_price: product.price,
      snap_pdv_percent: product.pdv_percent,
      snap_measure_unit: product.measure_unit,
    });
  }

  return {
    customer_id: customer.id,
    customer_name: customer.name,
    note: input.note?.trim() || null,
    valid_until: input.valid_until?.trim() || null,
    currency:
      input.currency != null
        ? normalizeCurrency(input.currency)
        : normalizeCurrency(fallbackCurrency),
    total,
    preparedItems,
  };
}

export async function listQuotes(organizationId: number): Promise<Quote[]> {
  const rows = await query<QuoteRow[]>(
    `SELECT * FROM quotes WHERE organization_id = ? ORDER BY created_at DESC`,
    [organizationId],
  );
  return rows.map(mapQuote);
}

export async function listCustomerNames(
  organizationId: number,
  limit = 50,
): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT customer_name FROM quotes WHERE organization_id = ? ORDER BY customer_name ASC LIMIT ?`,
    [organizationId, limit],
  );
  return rows.map((r) => r.customer_name as string);
}

export async function getQuoteById(
  organizationId: number,
  id: number,
): Promise<QuoteWithItems | null> {
  const quotes = await query<QuoteRow[]>(
    `SELECT q.*,
            c.tax_id AS customer_tax_id,
            c.address AS customer_address,
            c.email AS customer_email,
            c.phone AS customer_phone
     FROM quotes q
     LEFT JOIN customers c ON c.id = q.customer_id AND c.organization_id = q.organization_id
     WHERE q.id = ? AND q.organization_id = ?`,
    [id, organizationId],
  );
  if (!quotes[0]) return null;

  const items = await query<QuoteItemRow[]>(
    `SELECT qi.*,
            COALESCE(qi.snap_sku, p.sku) AS sku,
            COALESCE(qi.snap_name, p.name) AS name,
            COALESCE(qi.snap_category, p.category) AS category,
            COALESCE(qi.snap_unit_price, p.price) AS unit_price,
            p.price AS live_unit_price,
            COALESCE(qi.snap_pdv_percent, p.pdv_percent) AS pdv_percent,
            COALESCE(qi.snap_measure_unit, p.measure_unit) AS measure_unit,
            COALESCE(p.sort_order, 0) AS sort_order
     FROM quote_items qi
     LEFT JOIN products p ON p.id = qi.product_id AND p.organization_id = ?
     WHERE qi.quote_id = ?
     ORDER BY COALESCE(p.sort_order, 0) ASC, qi.id ASC`,
    [organizationId, id],
  );

  const mappedItems = items.map((row) => ({
    id: row.id,
    quote_id: row.quote_id,
    product_id: row.product_id,
    qty: row.qty,
    discount_percent: Number(row.discount_percent),
    final_price: Number(row.final_price),
    sku: row.sku ?? "",
    name: row.name ?? "",
    category: row.category,
    unit_price: Number(row.unit_price ?? 0),
    pdv_percent: Number(row.pdv_percent ?? 20),
    measure_unit: row.measure_unit ?? null,
    sort_order: Number(row.sort_order ?? 0),
    live_unit_price:
      row.live_unit_price == null ? null : Number(row.live_unit_price),
  }));

  const quote = mapQuote(quotes[0]);
  const pricesStale =
    quote.status === "draft" &&
    mappedItems.some(
      (item) =>
        item.live_unit_price != null &&
        Math.abs(item.live_unit_price - item.unit_price) > 0.009,
    );

  return {
    ...quote,
    prices_stale: pricesStale,
    items: mappedItems.map(({ live_unit_price: _live, ...item }) => item),
  };
}

export async function createQuote(
  organizationId: number,
  input: CreateQuoteInput,
): Promise<QuoteWithItems> {
  const settings = await getAppSettingsFromDb(organizationId);
  const prepared = await prepareQuoteItems(
    organizationId,
    input,
    settings.currency,
  );

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const tempNumber = `PON-TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [quoteResult] = await connection.execute(
      `INSERT INTO quotes (organization_id, quote_number, customer_id, customer_name, note, valid_until, currency, status, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        organizationId,
        tempNumber,
        prepared.customer_id,
        prepared.customer_name,
        prepared.note,
        prepared.valid_until,
        prepared.currency,
        prepared.total,
      ],
    );
    const quoteId = (quoteResult as { insertId: number }).insertId;
    const year = new Date().getFullYear();
    const [seqRows] = await connection.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(quote_number, '-', -1) AS UNSIGNED)), 0) AS maxn
       FROM quotes
       WHERE organization_id = ?
         AND quote_number LIKE ?
         AND quote_number NOT LIKE 'PON-TMP-%'`,
      [organizationId, `PON-${year}-%`],
    );
    const seq = Number((seqRows as { maxn: number }[])[0]?.maxn ?? 0) + 1;
    const quoteNumber = formatQuoteNumber(seq, new Date());

    await connection.execute(
      `UPDATE quotes SET quote_number = ? WHERE id = ?`,
      [quoteNumber, quoteId],
    );

    for (const item of prepared.preparedItems) {
      await connection.execute(
        `INSERT INTO quote_items (
           quote_id, product_id, qty, discount_percent, final_price,
           snap_sku, snap_name, snap_category, snap_unit_price, snap_pdv_percent, snap_measure_unit
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          item.product_id,
          item.qty,
          item.discount_percent,
          item.final_price,
          item.snap_sku,
          item.snap_name,
          item.snap_category,
          item.snap_unit_price,
          item.snap_pdv_percent,
          item.snap_measure_unit,
        ],
      );
    }

    await connection.commit();
    const quote = await getQuoteById(organizationId, quoteId);
    if (!quote) throw new Error("Ponuda nije sačuvana");
    return quote;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateQuote(
  organizationId: number,
  id: number,
  input: UpdateQuoteInput,
): Promise<QuoteWithItems> {
  const existing = await getQuoteById(organizationId, id);
  if (!existing) {
    throw new Error("Ponuda nije pronađena");
  }
  if (isQuoteLocked(existing.status)) {
    throw new Error("Zaključana ponuda se ne može menjati. Vrati je u nacrt.");
  }

  const prepared = await prepareQuoteItems(
    organizationId,
    input,
    existing.currency,
  );

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE quotes SET customer_id = ?, customer_name = ?, note = ?, valid_until = ?, currency = ?, total = ? WHERE id = ? AND organization_id = ?`,
      [
        prepared.customer_id,
        prepared.customer_name,
        prepared.note,
        prepared.valid_until,
        prepared.currency,
        prepared.total,
        id,
        organizationId,
      ],
    );

    await connection.execute(`DELETE FROM quote_items WHERE quote_id = ?`, [id]);

    for (const item of prepared.preparedItems) {
      await connection.execute(
        `INSERT INTO quote_items (
           quote_id, product_id, qty, discount_percent, final_price,
           snap_sku, snap_name, snap_category, snap_unit_price, snap_pdv_percent, snap_measure_unit
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.product_id,
          item.qty,
          item.discount_percent,
          item.final_price,
          item.snap_sku,
          item.snap_name,
          item.snap_category,
          item.snap_unit_price,
          item.snap_pdv_percent,
          item.snap_measure_unit,
        ],
      );
    }

    await connection.commit();
    const quote = await getQuoteById(organizationId, id);
    if (!quote) throw new Error("Ponuda nije sačuvana");
    return quote;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setQuoteStatus(
  organizationId: number,
  id: number,
  status: QuoteStatus,
): Promise<QuoteWithItems> {
  if (!isStoredQuoteStatus(status)) {
    throw new Error("Neispravan status ponude");
  }
  const existing = await getQuoteById(organizationId, id);
  if (!existing) throw new Error("Ponuda nije pronađena");
  await execute(
    `UPDATE quotes SET status = ? WHERE id = ? AND organization_id = ?`,
    [status, id, organizationId],
  );
  const updated = await getQuoteById(organizationId, id);
  if (!updated) throw new Error("Ponuda nije pronađena");
  return updated;
}

export async function refreshQuotePrices(
  organizationId: number,
  id: number,
): Promise<QuoteWithItems> {
  const existing = await getQuoteById(organizationId, id);
  if (!existing) throw new Error("Ponuda nije pronađena");
  if (isQuoteLocked(existing.status)) {
    throw new Error("Zaključana ponuda se ne može menjati. Vrati je u nacrt.");
  }
  return updateQuote(organizationId, id, {
    customer_id: existing.customer_id,
    customer_name: existing.customer_name,
    note: existing.note,
    valid_until: existing.valid_until,
    currency: existing.currency,
    items: existing.items.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      discount_percent: item.discount_percent,
    })),
  });
}

export async function deleteQuote(organizationId: number, id: number): Promise<void> {
  const existing = await getQuoteById(organizationId, id);
  if (!existing) {
    throw new Error("Ponuda nije pronađena");
  }

  await execute(`DELETE FROM quotes WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
}
