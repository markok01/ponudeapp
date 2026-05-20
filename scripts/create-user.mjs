#!/usr/bin/env node
/**
 * Kreira nalog — SAMO vi (vlasnik servera) pokrećete ovu skriptu.
 * Nema registracije u app-u — niko drugi ne može sam da napravi nalog.
 *
 * Primer:
 *   node scripts/create-user.mjs admin@firma.rs "JakaLozinka123" "Marko" admin
 *   node scripts/create-user.mjs kolega@firma.rs "DrugaLozinka456" "Ana" user
 */
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";

const scryptAsync = promisify(scrypt);

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

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function main() {
  loadEnv();

  const [emailArg, passwordArg, nameArg, roleArg] = process.argv.slice(2);
  if (!emailArg || !passwordArg) {
    console.error(
      "Upotreba: node scripts/create-user.mjs <email> <lozinka> [ime] [admin|user]",
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const password = passwordArg;
  const name = nameArg?.trim() || email.split("@")[0];
  const role = roleArg === "admin" ? "admin" : "user";
  const maxUsers = Number(process.env.MAX_USERS ?? 2);

  if (password.length < 8) {
    console.error("Lozinka mora imati najmanje 8 karaktera.");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl:
      process.env.MYSQL_SSL === "true"
        ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
  });

  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM users`);
    const total = Number(countRows[0]?.cnt ?? 0);
    if (total >= maxUsers) {
      console.error(`Limit naloga (${maxUsers}) je dostignut.`);
      process.exit(1);
    }

    const [existing] = await pool.query(`SELECT id FROM users WHERE email = ?`, [
      email,
    ]);
    if (existing.length > 0) {
      console.error("Email već postoji.");
      process.exit(1);
    }

    const password_hash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, 1)`,
      [email, password_hash, name, role],
    );

    console.log(`✓ Nalog kreiran: ${email} (${role})`);
    console.log(`  Ukupno naloga: ${total + 1} / ${maxUsers}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
