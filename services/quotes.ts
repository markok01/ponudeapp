import { execute, getPool, query, type RowDataPacket } from "@/lib/db";
import type {
  CreateQuoteInput,
  Quote,
  QuoteItemWithProduct,
  QuoteWithItems,
  UpdateQuoteInput,
} from "@/types";
import { getProductById } from "@/services/products";
import { lineFinalPrice } from "@/utils/quote-calc";
import { formatQuoteNumber } from "@/utils/format-quote-number";

interface QuoteRow extends RowDataPacket {
  id: number;
  quote_number?: string | null;
  customer_name: string;
  note?: string | null;
  valid_until?: string | null;
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
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
  pdv_percent: number;
  measure_unit?: string | null;
  sort_order: number;
}

function mapQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    quote_number:
      row.quote_number?.trim() ||
      formatQuoteNumber(row.id, row.created_at),
    customer_name: row.customer_name,
    note: row.note ?? null,
    valid_until: row.valid_until
      ? String(row.valid_until).slice(0, 10)
      : null,
    created_at: row.created_at,
    total: Number(row.total),
  };
}

async function prepareQuoteItems(input: CreateQuoteInput) {
  if (!input.customer_name.trim()) {
    throw new Error("Ime kupca je obavezno");
  }
  if (!input.items.length) {
    throw new Error("Ponuda mora imati bar jedan proizvod");
  }

  let total = 0;
  const preparedItems: {
    product_id: number;
    qty: number;
    discount_percent: number;
    final_price: number;
  }[] = [];

  for (const item of input.items) {
    const product = await getProductById(item.product_id);
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
    });
  }

  return {
    customer_name: input.customer_name.trim(),
    note: input.note?.trim() || null,
    valid_until: input.valid_until?.trim() || null,
    total,
    preparedItems,
  };
}

export async function listQuotes(): Promise<Quote[]> {
  const rows = await query<QuoteRow[]>(
    `SELECT * FROM quotes ORDER BY created_at DESC`,
  );
  return rows.map(mapQuote);
}

export async function listCustomerNames(limit = 50): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT customer_name FROM quotes ORDER BY customer_name ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.customer_name as string);
}

export async function getQuoteById(id: number): Promise<QuoteWithItems | null> {
  const quotes = await query<QuoteRow[]>(`SELECT * FROM quotes WHERE id = ?`, [id]);
  if (!quotes[0]) return null;

  const items = await query<QuoteItemRow[]>(
    `SELECT qi.*, p.sku, p.name, p.category, p.price AS unit_price, p.pdv_percent,
            p.measure_unit, p.sort_order
     FROM quote_items qi
     JOIN products p ON p.id = qi.product_id
     WHERE qi.quote_id = ?
     ORDER BY p.sort_order ASC, qi.id ASC`,
    [id],
  );

  return {
    ...mapQuote(quotes[0]),
    items: items.map((row) => ({
      id: row.id,
      quote_id: row.quote_id,
      product_id: row.product_id,
      qty: row.qty,
      discount_percent: Number(row.discount_percent),
      final_price: Number(row.final_price),
      sku: row.sku,
      name: row.name,
      category: row.category,
      unit_price: Number(row.unit_price),
      pdv_percent: Number(row.pdv_percent ?? 20),
      measure_unit: row.measure_unit ?? null,
      sort_order: Number(row.sort_order ?? 0),
    })),
  };
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteWithItems> {
  const prepared = await prepareQuoteItems(input);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const tempNumber = `PON-TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [quoteResult] = await connection.execute(
      `INSERT INTO quotes (quote_number, customer_name, note, valid_until, total)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tempNumber,
        prepared.customer_name,
        prepared.note,
        prepared.valid_until,
        prepared.total,
      ],
    );
    const quoteId = (quoteResult as { insertId: number }).insertId;
    const quoteNumber = formatQuoteNumber(quoteId, new Date());

    await connection.execute(
      `UPDATE quotes SET quote_number = ? WHERE id = ?`,
      [quoteNumber, quoteId],
    );

    for (const item of prepared.preparedItems) {
      await connection.execute(
        `INSERT INTO quote_items (quote_id, product_id, qty, discount_percent, final_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          quoteId,
          item.product_id,
          item.qty,
          item.discount_percent,
          item.final_price,
        ],
      );
    }

    await connection.commit();
    const quote = await getQuoteById(quoteId);
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
  id: number,
  input: UpdateQuoteInput,
): Promise<QuoteWithItems> {
  const existing = await getQuoteById(id);
  if (!existing) {
    throw new Error("Ponuda nije pronađena");
  }

  const prepared = await prepareQuoteItems(input);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE quotes SET customer_name = ?, note = ?, valid_until = ?, total = ? WHERE id = ?`,
      [
        prepared.customer_name,
        prepared.note,
        prepared.valid_until,
        prepared.total,
        id,
      ],
    );

    await connection.execute(`DELETE FROM quote_items WHERE quote_id = ?`, [id]);

    for (const item of prepared.preparedItems) {
      await connection.execute(
        `INSERT INTO quote_items (quote_id, product_id, qty, discount_percent, final_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          item.product_id,
          item.qty,
          item.discount_percent,
          item.final_price,
        ],
      );
    }

    await connection.commit();
    const quote = await getQuoteById(id);
    if (!quote) throw new Error("Ponuda nije sačuvana");
    return quote;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteQuote(id: number): Promise<void> {
  const existing = await getQuoteById(id);
  if (!existing) {
    throw new Error("Ponuda nije pronađena");
  }

  await execute(`DELETE FROM quotes WHERE id = ?`, [id]);
}
