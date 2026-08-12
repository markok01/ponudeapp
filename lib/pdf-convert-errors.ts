/** Poruke kada PDF converter (pdfplumber/Render) nije dostupan. */

export function pdfConverterUnavailableMessage(): string {
  if (process.env.VERCEL) {
    return (
      "PDF converter servis nije dostupan. Na Vercelu postavite PDF_CONVERTER_URL i PDF_CONVERTER_API_KEY " +
      "(Python servis na Renderu — vidi README). Za cenovnik koristite originalni .xlsx."
    );
  }
  return (
    "PDF converter nije dostupan. Pokrenite: npm run pdf-converter:docker " +
    "(ili python3 + pdfplumber za HoReCa lokalno). Za cenovnik koristite originalni .xlsx."
  );
}

export function allowWeakPdfTextParse(): boolean {
  return process.env.ALLOW_WEAK_PDF_PARSE === "1";
}
