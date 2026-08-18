#!/usr/bin/env node
/**
 * Kreira nalog u default organizaciji (CLI). Javna registracija je /register.
 *
 * Primer:
 *   node scripts/create-user.mjs <email> "<lozinka>" "Ime" owner
 *   node scripts/create-user.mjs <email> "<lozinka>" "Ime" admin
 *   node scripts/create-user.mjs <email> "<lozinka>" "Ime" user
 *   node scripts/create-user.mjs <email> "<lozinka>" "Ime" superadmin
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
      "Upotreba: node scripts/create-user.mjs <email> <lozinka> [ime] [owner|admin|user|superadmin]",
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const password = passwordArg;
  const name = nameArg?.trim() || email.split("@")[0];
  const role =
    roleArg === "owner" || roleArg === "admin" || roleArg === "superadmin"
      ? roleArg
      : "user";
  const maxUsers = Number(process.env.MAX_USERS ?? 3);

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        plan VARCHAR(20) NOT NULL DEFAULT 'trial',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        trial_ends_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_organizations_slug (slug)
      )
    `);
    await pool.query(`
      INSERT INTO organizations (name, slug, plan, status, trial_ends_at)
      SELECT 'Default', 'default', 'business', 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)
      WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')
    `);
    const [orgRows] = await pool.query(
      `SELECT id FROM organizations WHERE slug = 'default' LIMIT 1`,
    );
    const organizationId = Number(orgRows[0]?.id);
    if (!organizationId) {
      console.error("Default organizacija nije kreirana.");
      process.exit(1);
    }

    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER session_version
      `);
    } catch {
      /* already exists */
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE organization_id = ?`,
      [organizationId],
    );
    const total = Number(countRows[0]?.cnt ?? 0);
    if (role !== "superadmin" && total >= maxUsers) {
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
      `INSERT INTO users (organization_id, email, password_hash, name, role, active, email_verified_at)
       VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP())`,
      [organizationId, email, password_hash, name, role],
    );

    console.log(`✓ Nalog kreiran: ${email} (${role}) org=#${organizationId}`);
    console.log(`  Ukupno naloga u firmi: ${total + 1} / ${maxUsers}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
