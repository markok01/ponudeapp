import type { jsPDF } from "jspdf";

export const PDF_FONT = "NotoSans";
export const PDF_FONT_BOLD = "NotoSansBold";

const fontCache: { regular?: string; bold?: string } = {};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontFile(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Font nije učitan: ${path}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function ensureFontData(): Promise<void> {
  if (fontCache.regular && fontCache.bold) return;
  const [regular, bold] = await Promise.all([
    loadFontFile("/fonts/NotoSans-Regular.ttf"),
    loadFontFile("/fonts/NotoSans-Bold.ttf"),
  ]);
  fontCache.regular = regular;
  fontCache.bold = bold;
}

/** Noto Sans — č, ć, đ, š, ž; kešira se, registruje na svaki novi PDF. */
export async function registerPdfFonts(doc: jsPDF): Promise<void> {
  await ensureFontData();

  doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular!);
  doc.addFont("NotoSans-Regular.ttf", PDF_FONT, "normal");

  doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold!);
  doc.addFont("NotoSans-Bold.ttf", PDF_FONT_BOLD, "normal");

  doc.setFont(PDF_FONT, "normal");
}

export function setPdfFont(
  doc: jsPDF,
  style: "normal" | "bold",
  size: number,
): void {
  doc.setFont(style === "bold" ? PDF_FONT_BOLD : PDF_FONT, "normal");
  doc.setFontSize(size);
}
