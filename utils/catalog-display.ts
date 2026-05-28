import type { Product } from "@/types";

export const HORECA_BRAND_BG =
  "bg-[var(--horeca-brand)] text-white";
export const HORECA_HEADER_BG =
  "bg-[var(--horeca-header)] text-foreground";

const horecaPriceFormatter = new Intl.NumberFormat("sr-RS", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPriceHorecaAmount(price: number): string {
  return horecaPriceFormatter.format(price);
}

export function formatPriceHoreca(price: number, unit = "din/kom"): string {
  return `${formatPriceHorecaAmount(price)} ${unit}`;
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

export type ProductCategoryGroup = {
  /** Jedinstven React key (isti naziv brenda može se pojaviti u više blokova). */
  groupKey: string;
  groupLabel: string;
  products: Product[];
};

/**
 * Grupiše po brendu/kategoriji u redosledu iz fajla (bez abecednog sortiranja).
 * `products` treba da budu već sortirani po sort_order.
 */
export function groupProductsByCategory(
  products: Product[],
  otherLabel = "Ostalo",
): ProductCategoryGroup[] {
  const groups: ProductCategoryGroup[] = [];

  for (const product of products) {
    const label = product.category?.trim() || otherLabel;
    const last = groups[groups.length - 1];
    if (last && last.groupLabel === label) {
      last.products.push(product);
    } else {
      groups.push({
        groupKey: `${label}::${product.id}`,
        groupLabel: label,
        products: [product],
      });
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
