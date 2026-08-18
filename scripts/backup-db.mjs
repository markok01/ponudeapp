#!/usr/bin/env node
/**
 * Dump CREATE TABLE za sve tabele (bez podataka).
 * Aiven već radi automated backups — ovo je lokalni schema snapshot.
 *
 *   npm run backup:schema
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();

  const host = process.env.MYSQL_HOST?.trim();
  const database =
    process.env.PONUDEAPP_DATABASE?.trim() ||
    process.env.MYSQL_DATABASE?.trim();
  if (!host || !database) {
    console.error("MYSQL_HOST i MYSQL_DATABASE (ili PONUDEAPP_DATABASE) su obavezni.");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database,
    ssl:
      process.env.MYSQL_SSL === "true"
        ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
  });

  try {
    const [tables] = await pool.query("SHOW TABLES");
    const names = tables.map((row) => Object.values(row)[0]).filter(Boolean);

    const chunks = [
      `-- PonudeApp schema dump (no data)`,
      `-- database: ${database}`,
      `-- generated: ${new Date().toISOString()}`,
      ``,
      `SET FOREIGN_KEY_CHECKS=0;`,
      ``,
    ];

    for (const name of names) {
      const [createRows] = await pool.query(`SHOW CREATE TABLE \`${name}\``);
      const ddl = createRows[0]?.["Create Table"] || createRows[0]?.["Create View"];
      if (!ddl) continue;
      chunks.push(`DROP TABLE IF EXISTS \`${name}\`;`);
      chunks.push(`${ddl};`);
      chunks.push("");
    }

    chunks.push(`SET FOREIGN_KEY_CHECKS=1;`);

    const dir = resolve(process.cwd(), "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = resolve(dir, `schema-${stamp}.sql`);
    writeFileSync(out, chunks.join("\n"), "utf8");
    console.log(`Schema dump: ${out} (${names.length} tables)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
