import { bulkUpsertProductsBySku, getActiveProducts, replaceProductCatalog } from "@/services/products";
import {
  assertPriceListOwned,
  captureProductSnapshot,
  computeImportDiff,
  touchPriceListImport,
} from "@/services/price-list";
import type { ImportPreviewDiff } from "@/types";
import type { PriceListRow } from "@/types/price-list";
import { sanitizePriceListRows } from "@/utils/price-list-columns";

export async function importPriceListRows(
  organizationId: number,
  priceListId: number,
  rows: PriceListRow[],
  options?: { replaceCatalog?: boolean; fileName?: string },
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  removedOld: number;
  priceListId: number;
}> {
  await assertPriceListOwned(organizationId, priceListId);

  let removedOld = 0;
  const snapshot = await captureProductSnapshot(organizationId, priceListId);

  if (options?.replaceCatalog) {
    const cleared = await replaceProductCatalog(organizationId, priceListId);
    removedOld = cleared.removed;
  }

  const { valid, skipped: sanitizeSkipped } = sanitizePriceListRows(rows);
  const withOrder = valid.map((row, index) => ({
    ...row,
    sort_order: row.sort_order ?? index,
  }));
  const { inserted, updated } = await bulkUpsertProductsBySku(
    organizationId,
    priceListId,
    withOrder,
  );
  await touchPriceListImport(organizationId, priceListId, {
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
  organizationId: number,
  priceListId: number,
  rows: PriceListRow[],
): Promise<ImportPreviewDiff> {
  await assertPriceListOwned(organizationId, priceListId);
  const { valid } = sanitizePriceListRows(rows);
  const current = await getActiveProducts(organizationId, {
    includeInactive: false,
    priceListId,
  });
  const incoming = valid.map((r) => ({
    sku: r.sku,
    name: r.name,
    price: r.price,
    category: r.category ?? null,
  }));
  return computeImportDiff(incoming, current);
}
