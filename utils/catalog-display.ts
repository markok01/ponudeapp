import type { Product } from "@/types";

export const HORECA_BRAND_BG =
  "bg-[var(--horeca-brand)] text-white";
export const HORECA_HEADER_BG =
  "bg-[var(--horeca-header)] text-foreground";

export function formatPriceHoreca(price: number, unit = "din/kom"): string {
  const num = new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `${num} ${unit}`;
}

export function formatPdvDisplay(pdv: number): string {
  if (pdv === 10 || pdv === 20) return `${pdv}%`;
  if (pdv > 0 && pdv <= 1) return `${Math.round(pdv * 100)}%`;
  return `${pdv}%`;
}

function catalogSortKey(a: Product, b: Product): number {
  const orderA = a.sort_order ?? 0;
  const orderB = b.sort_order ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return a.id - b.id;
}

/** Sortira po redosledu iz Excel uvoza. */
export function sortProductsCatalogOrder(products: Product[]): Product[] {
  return [...products].sort(catalogSortKey);
}

/**
 * Grupiše po brendu/kategoriji u redosledu iz fajla (bez abecednog sortiranja).
 * `products` treba da budu već sortirani po sort_order.
 */
export function groupProductsByCategory(products: Product[]): {
  groupLabel: string;
  products: Product[];
}[] {
  const groups: { groupLabel: string; products: Product[] }[] = [];

  for (const product of products) {
    const label = product.category?.trim() || "Ostalo";
    const last = groups[groups.length - 1];
    if (last && last.groupLabel === label) {
      last.products.push(product);
    } else {
      groups.push({ groupLabel: label, products: [product] });
    }
  }

  return groups;
}

export function filterProducts(
  products: Product[],
  search: string,
  category: string,
): Product[] {
  let list = sortProductsCatalogOrder(products);

  if (category && category !== "all") {
    list = list.filter((p) => p.category === category);
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false),
    );
  }

  return list;
}
