import ExcelJS from "exceljs";
import { query, type RowDataPacket } from "@/lib/db";
import { getAppSettingsFromDb } from "@/services/app-settings";
import { listOrgActivity } from "@/services/org-activity";
import { getOrganizationById } from "@/services/organizations";

function sheetFromRows(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: unknown[][],
) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
}

export async function buildOrganizationExportBuffer(
  organizationId: number,
): Promise<{ buffer: Buffer; fileName: string }> {
  const org = await getOrganizationById(organizationId);
  if (!org) throw new Error("Organizacija nije pronađena");

  const settings = await getAppSettingsFromDb(organizationId);
  const [products, quotes, quoteItems, customers, users] = await Promise.all([
    query<RowDataPacket[]>(
      `SELECT sku, name, category, price, pdv_percent, measure_unit, active, price_list_id
       FROM products WHERE organization_id = ? ORDER BY id`,
      [organizationId],
    ),
    query<RowDataPacket[]>(
      `SELECT id, quote_number, customer_name, status, currency, total, valid_until, created_at, note
       FROM quotes WHERE organization_id = ? ORDER BY id`,
      [organizationId],
    ),
    query<RowDataPacket[]>(
      `SELECT qi.quote_id, qi.product_id, qi.qty, qi.discount_percent, qi.final_price,
              qi.snap_sku, qi.snap_name, qi.snap_unit_price
       FROM quote_items qi
       INNER JOIN quotes q ON q.id = qi.quote_id
       WHERE q.organization_id = ?
       ORDER BY qi.quote_id, qi.id`,
      [organizationId],
    ),
    query<RowDataPacket[]>(
      `SELECT name, tax_id, address, email, phone, created_at
       FROM customers WHERE organization_id = ? ORDER BY name`,
      [organizationId],
    ),
    query<RowDataPacket[]>(
      `SELECT email, name, role, active, created_at
       FROM users WHERE organization_id = ? ORDER BY id`,
      [organizationId],
    ),
  ]);
  const activity = await listOrgActivity(organizationId, 200);

  const wb = new ExcelJS.Workbook();
  wb.creator = "PonudeApp";
  wb.created = new Date();

  sheetFromRows(
    wb,
    "Firma",
    ["Polje", "Vrednost"],
    [
      ["Naziv organizacije", org.name],
      ["Plan", org.plan],
      ["Status", org.status],
      ["Naziv na PDF", settings.companyName],
      ["PIB", settings.taxId],
      ["Adresa", settings.address],
      ["Telefon", settings.phone],
      ["Žiro", settings.bankAccount],
      ["Valuta", settings.currency],
      ["Jezik", settings.locale],
      ["Izvoz", new Date().toISOString()],
    ],
  );

  sheetFromRows(
    wb,
    "Proizvodi",
    ["SKU", "Naziv", "Kategorija", "Cena", "PDV%", "JM", "Aktivan", "Cenovnik ID"],
    products.map((p) => [
      p.sku,
      p.name,
      p.category,
      Number(p.price),
      Number(p.pdv_percent),
      p.measure_unit,
      p.active ? 1 : 0,
      p.price_list_id,
    ]),
  );

  sheetFromRows(
    wb,
    "Kupci",
    ["Naziv", "PIB", "Adresa", "Email", "Telefon", "Kreiran"],
    customers.map((c) => [
      c.name,
      c.tax_id,
      c.address,
      c.email,
      c.phone,
      String(c.created_at),
    ]),
  );

  sheetFromRows(
    wb,
    "Ponude",
    ["ID", "Broj", "Kupac", "Status", "Valuta", "Ukupno", "Važi do", "Kreirana", "Napomena"],
    quotes.map((q) => [
      q.id,
      q.quote_number,
      q.customer_name,
      q.status,
      q.currency,
      Number(q.total),
      q.valid_until ? String(q.valid_until).slice(0, 10) : "",
      String(q.created_at),
      q.note,
    ]),
  );

  sheetFromRows(
    wb,
    "Stavke ponuda",
    ["Ponuda ID", "Proizvod ID", "Količina", "Rabat%", "Final", "SKU", "Naziv", "Cena"],
    quoteItems.map((i) => [
      i.quote_id,
      i.product_id,
      i.qty,
      Number(i.discount_percent),
      Number(i.final_price),
      i.snap_sku,
      i.snap_name,
      i.snap_unit_price == null ? "" : Number(i.snap_unit_price),
    ]),
  );

  sheetFromRows(
    wb,
    "Korisnici",
    ["Email", "Ime", "Uloga", "Aktivan", "Kreiran"],
    users.map((u) => [u.email, u.name, u.role, u.active ? 1 : 0, String(u.created_at)]),
  );

  sheetFromRows(
    wb,
    "Aktivnost",
    ["Vreme", "Ko", "Akcija", "Opis"],
    activity.map((a) => [a.created_at, a.actor_email ?? "", a.action, a.summary]),
  );

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = org.slug.replace(/[^\w-]+/g, "-") || "firma";
  return {
    buffer,
    fileName: `ponudeapp-export-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
