import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

function loadEnv(file) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
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

loadEnv(".env.local");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

try {
  await pool.query(
    `ALTER TABLE products ADD COLUMN pdv_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00 AFTER price`,
  );
  console.log("Kolona pdv_percent dodata.");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("Kolona pdv_percent već postoji.");
  } else {
    throw e;
  }
} finally {
  await pool.end();
}
