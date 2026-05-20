/** Merna jedinica za prikaz na ponudi/PDF (kg, l, kom). */
export function inferMeasureUnit(
  name: string,
  category?: string | null,
): string {
  const text = `${name} ${category ?? ""}`.toLowerCase();

  if (/din\s*\/\s*kg|\/\s*kg\b|\bkg\b|kilogram/.test(text)) return "kg";
  if (/din\s*\/\s*l\b|\/\s*l\b|\blitar\b|\blit\b/.test(text)) return "l";
  if (/din\s*\/\s*kom|\/\s*kom\b/.test(text)) return "kom";

  return "kom";
}
