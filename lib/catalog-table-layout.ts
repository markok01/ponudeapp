/** Zajednička logika za cenovnik tabele (proizvodi + ponude). */

export const CATALOG_FLUID_BREAKPOINT_PX = 1040;

export type CellFontKind = "compact" | "name" | "header";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 0.72–1: proporcionalno suženju panela; 1 = desktop pun izgled. */
export function catalogPanelScale(containerWidthPx: number): number {
  if (containerWidthPx <= 0) return 1;
  if (containerWidthPx >= CATALOG_FLUID_BREAKPOINT_PX) return 1;
  const t =
    (containerWidthPx - 360) / (CATALOG_FLUID_BREAKPOINT_PX - 360);
  return clamp(t, 0.72, 1);
}

export function isFluidCatalogPanel(containerWidthPx: number): boolean {
  return containerWidthPx > 0 && containerWidthPx < CATALOG_FLUID_BREAKPOINT_PX;
}

/** clamp(11px, 1vw ekvivalent, 16px) skalirano širinom panela. */
export function responsiveFontPx(
  containerWidthPx: number,
  kind: CellFontKind = "compact",
): number {
  const scale = catalogPanelScale(containerWidthPx);
  const bases = { compact: 11, name: 12, header: 10 } as const;
  const maxes = { compact: 14, name: 14, header: 12 } as const;
  const base = bases[kind];
  const max = maxes[kind];
  return Math.round(clamp(base + (max - base) * scale, 9, max));
}

export function cellPaddingYPx(rowHeightPx: number, fontPx: number): number {
  return Math.max(2, Math.floor((rowHeightPx - fontPx) / 2) - 1);
}

/** Font u ćeliji skalira se sa širinom kolone i visinom reda (resize). */
export function cellFontSizePx(
  colWidthPx: number,
  rowHeightPx: number,
  kind: CellFontKind = "compact",
  refColWidth = 88,
  refRowHeight = 32,
): number {
  const rowScale = rowHeightPx / refRowHeight;
  const colScale = colWidthPx / refColWidth;
  const base = kind === "name" ? 12 : kind === "header" ? 10 : 11;
  const scaled = base * Math.min(rowScale, colScale);
  return Math.round(clamp(scaled, 9, 14));
}

export function sumColumnWidths<T extends string>(
  cols: Record<T, number>,
): number {
  return (Object.values(cols) as number[]).reduce((a, b) => a + b, 0);
}

export type ColumnWidthOptions<T extends string> = {
  /** Kolone koje nisu vidljive — ne ulaze u % raspodelu (width: 0). */
  exclude?: T[];
};

/** Procenti koji tačno zbiraju 100. */
function normalizePercentKeys<T extends string>(
  keys: T[],
  cols: Record<T, number>,
): Record<T, number> {
  const total = sumColumnWidths(
    Object.fromEntries(keys.map((k) => [k, cols[k]])) as Record<T, number>,
  );
  if (total <= 0) return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;

  const raw = keys.map((key) => {
    const exact = (cols[key] / total) * 100;
    const floored = Math.floor(exact * 10) / 10;
    return { key, pct: floored, rem: exact - floored };
  });

  let sum = raw.reduce((a, r) => a + r.pct, 0);
  const sorted = [...raw].sort((a, b) => b.rem - a.rem);
  let i = 0;
  while (sum < 100 - 0.05 && i < sorted.length) {
    sorted[i].pct = Math.round((sorted[i].pct + 0.1) * 10) / 10;
    sum += 0.1;
    i += 1;
  }

  return Object.fromEntries(sorted.map((r) => [r.key, r.pct])) as Record<T, number>;
}

/** Desktop: px; sužen panel: % koji popunjavaju celu širinu tabele. */
export function columnWidthsToStyles<T extends string>(
  cols: Record<T, number>,
  containerWidthPx: number,
  options?: ColumnWidthOptions<T>,
): Record<T, string> {
  const exclude = new Set(options?.exclude ?? []);
  const fluid = isFluidCatalogPanel(containerWidthPx);
  const activeKeys = (Object.keys(cols) as T[]).filter((k) => !exclude.has(k));

  const out = {} as Record<T, string>;

  if (!fluid) {
    for (const key of Object.keys(cols) as T[]) {
      out[key] = exclude.has(key) ? "0" : `${cols[key]}px`;
    }
    return out;
  }

  const pcts = normalizePercentKeys(activeKeys, cols);
  for (const key of Object.keys(cols) as T[]) {
    if (exclude.has(key)) {
      out[key] = "0";
    } else {
      out[key] = `${pcts[key]}%`;
    }
  }
  return out;
}

export type CellMetrics = {
  fontPx: number;
  paddingYPx: number;
  rowHeightPx: number;
};

export function buildCellMetrics(
  colWidthPx: number,
  rowHeightPx: number,
  containerWidthPx: number,
  kind: CellFontKind = "compact",
): CellMetrics {
  const panelScale = catalogPanelScale(containerWidthPx);
  const resizeFont = cellFontSizePx(colWidthPx, rowHeightPx, kind);
  const responsiveFont = responsiveFontPx(containerWidthPx, kind);
  const fontPx = Math.round(
    clamp(
      resizeFont * panelScale + responsiveFont * (1 - panelScale * 0.35),
      9,
      14,
    ),
  );
  return {
    fontPx,
    paddingYPx: cellPaddingYPx(rowHeightPx, fontPx),
    rowHeightPx,
  };
}
