import { execute, query, type RowDataPacket } from "@/lib/db";
import type { Customer, CustomerInput } from "@/types";

interface CustomerRow extends RowDataPacket {
  id: number;
  name: string;
  tax_id: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  quote_count?: number;
  created_at: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    tax_id: row.tax_id ?? null,
    address: row.address ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    quote_count: Number(row.quote_count ?? 0),
    created_at: row.created_at,
  };
}

const SELECT = `
  SELECT c.*,
         (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) AS quote_count
  FROM customers c
`;

export async function listCustomers(
  organizationId: number,
  search?: string,
): Promise<Customer[]> {
  const q = search?.trim();
  const rows = await query<CustomerRow[]>(
    q
      ? `${SELECT}
         WHERE c.organization_id = ?
           AND (c.name LIKE ? OR c.tax_id LIKE ? OR c.email LIKE ?)
         ORDER BY c.name ASC`
      : `${SELECT} WHERE c.organization_id = ? ORDER BY c.name ASC`,
    q
      ? [organizationId, `%${q}%`, `%${q}%`, `%${q}%`]
      : [organizationId],
  );
  return rows.map(mapCustomer);
}

export async function getCustomerById(
  organizationId: number,
  id: number,
): Promise<Customer | null> {
  const rows = await query<CustomerRow[]>(
    `${SELECT} WHERE c.id = ? AND c.organization_id = ?`,
    [id, organizationId],
  );
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function createCustomer(
  organizationId: number,
  input: CustomerInput,
): Promise<Customer> {
  const name = input.name.trim();
  if (!name) throw new Error("Ime kupca je obavezno");
  const result = await execute(
    `INSERT INTO customers (organization_id, name, tax_id, address, email, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      name,
      clean(input.tax_id),
      clean(input.address),
      clean(input.email),
      clean(input.phone),
    ],
  );
  const created = await getCustomerById(organizationId, result.insertId);
  if (!created) throw new Error("Kupac nije sačuvan");
  return created;
}

export async function updateCustomer(
  organizationId: number,
  id: number,
  input: CustomerInput,
): Promise<Customer> {
  const existing = await getCustomerById(organizationId, id);
  if (!existing) throw new Error("Kupac nije pronađen");
  const name = input.name.trim();
  if (!name) throw new Error("Ime kupca je obavezno");
  await execute(
    `UPDATE customers
     SET name = ?, tax_id = ?, address = ?, email = ?, phone = ?
     WHERE id = ? AND organization_id = ?`,
    [
      name,
      clean(input.tax_id),
      clean(input.address),
      clean(input.email),
      clean(input.phone),
      id,
      organizationId,
    ],
  );
  const updated = await getCustomerById(organizationId, id);
  if (!updated) throw new Error("Kupac nije pronađen");
  return updated;
}

export async function deleteCustomer(organizationId: number, id: number): Promise<void> {
  const existing = await getCustomerById(organizationId, id);
  if (!existing) throw new Error("Kupac nije pronađen");
  await execute(
    `UPDATE quotes SET customer_id = NULL WHERE customer_id = ? AND organization_id = ?`,
    [id, organizationId],
  );
  await execute(`DELETE FROM customers WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
}

/** Veže ponudu za postojećeg kupca ili napravi novog po imenu. Ime na ponudi je snapshot. */
export async function resolveCustomerForQuote(
  organizationId: number,
  input: { customer_id?: number | null; customer_name: string },
): Promise<{ id: number; name: string }> {
  if (input.customer_id) {
    const existing = await getCustomerById(organizationId, input.customer_id);
    if (!existing) throw new Error("Kupac nije pronađen");
    return { id: existing.id, name: existing.name };
  }

  const name = input.customer_name.trim();
  if (!name) throw new Error("Ime kupca je obavezno");

  const rows = await query<CustomerRow[]>(
    `SELECT * FROM customers
     WHERE organization_id = ? AND LOWER(name) = LOWER(?)
     ORDER BY id ASC LIMIT 1`,
    [organizationId, name],
  );
  if (rows[0]) return { id: rows[0].id, name: rows[0].name };

  const created = await createCustomer(organizationId, { name });
  return { id: created.id, name: created.name };
}
