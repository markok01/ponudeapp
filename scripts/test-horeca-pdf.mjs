#!/usr/bin/env node
/**
 * Test HoReCa PDF → Excel (pdfplumber put).
 *
 * Usage:
 *   node scripts/test-horeca-pdf.mjs "path/to/HoReCa cenovnik.pdf"
 *   PDF_SAMPLE=./samples/horeca.pdf node scripts/test-horeca-pdf.mjs
 *
 * Zahteva: python3, pip install pdfplumber
 */
import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pdfPath = process.argv[2] || process.env.PDF_SAMPLE;

if (!pdfPath) {
  console.error(
    "Usage: node scripts/test-horeca-pdf.mjs <pdf-path>\n" +
      "  ili PDF_SAMPLE=./file.pdf node scripts/test-horeca-pdf.mjs",
  );
  process.exit(1);
}

function runPython(script, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script, ...args], { cwd: root });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `exit ${code}`));
      else resolve(stdout);
    });
  });
}

async function main() {
  console.log("PDF:", pdfPath);

  const script = join(root, "scripts", "horeca-from-pdf.py");
  const stdout = await runPython(script, [pdfPath]);
  const data = JSON.parse(stdout.trim());

  if (data.error) {
    console.error("Parser error:", data.error);
    process.exit(1);
  }

  const productCount = data.productCount ?? 0;
  const sheets = data.sheets ?? [];
  console.log("Sheets:", sheets.length, "Products:", productCount);

  let headerOk = false;
  let mashed = false;
  for (const sheet of sheets) {
    for (const row of sheet.rows ?? []) {
      if (row.kind !== "header") continue;
      const cells = row.cells ?? [];
      const nonEmpty = cells.filter((c) => c?.trim());
      const joined = nonEmpty.join("").replace(/\s+/g, "");
      if (/šifra.*artikal/i.test(joined) && nonEmpty.length < 4) mashed = true;
      if (nonEmpty.length >= 4) headerOk = true;
      console.log("Header cells:", nonEmpty);
    }
  }

  if (mashed) {
    console.error("FAIL: spojeno zaglavlje (pdf-parse put?) — očekuj odvojene kolone.");
    process.exit(1);
  }
  if (productCount < 100) {
    console.error(`FAIL: samo ${productCount} proizvoda (očekivano ≥100 za cenovnik).`);
    process.exit(1);
  }
  if (!headerOk) {
    console.error("FAIL: header red nije prepoznat sa ≥4 kolonama.");
    process.exit(1);
  }

  await writeFile(join(root, "tmp-horeca-parse.json"), JSON.stringify(data, null, 2));
  console.log("Wrote tmp-horeca-parse.json");

  console.log("PASS: HoReCa PDF parse validacija OK.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
