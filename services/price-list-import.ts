import { bulkUpsertProductsBySku, replaceProductCatalog } from "@/services/products";
import {
  captureProductSnapshot,
  computeImportDiff,
  createPriceListRecord,
} from "@/services/price-list";
import { getActiveProducts } from "@/services/products";
import type { ImportPreviewDiff } from "@/types";
import type { PriceListRow } from "@/types/price-list";
import { sanitizePriceListRows } from "@/utils/price-list-columns";

export async function importPriceListRows(
  rows: PriceListRow[],
  listName: string,
  options?: { replaceCatalog?: boolean; fileName?: string },
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  removedOld: number;
  priceListId: number;
}> {
  let removedOld = 0;
  const snapshot = await captureProductSnapshot();

  if (options?.replaceCatalog !== false) {
    const cleared = await replaceProductCatalog();
    removedOld = cleared.removed;
  }

  const { valid, skipped: sanitizeSkipped } = sanitizePriceListRows(rows);
  const withOrder = valid.map((row, index) => ({
    ...row,
    sort_order: row.sort_order ?? index,
  }));
  const { inserted, updated } = await bulkUpsertProductsBySku(withOrder);
  const priceListId = await createPriceListRecord(listName, {
    fileName: options?.fileName,
    rowCount: rows.length,
    inserted,
    updated,
    skipped: sanitizeSkipped,
    removed: removedOld,
    snapshot,
  });

  return {
    inserted,
    updated,
    skipped: sanitizeSkipped,
    removedOld,
    priceListId,
  };
}

export async function previewPriceListImport(
  rows: PriceListRow[],
): Promise<ImportPreviewDiff> {
  const { valid } = sanitizePriceListRows(rows);
  const current = await getActiveProducts({ includeInactive: false });
  const incoming = valid.map((r) => ({
    sku: r.sku,
    name: r.name,
    price: r.price,
    category: r.category ?? null,
  }));
  return computeImportDiff(incoming, current);
}
