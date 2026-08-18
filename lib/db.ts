import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
  type SslOptions,
} from "mysql2/promise";
import { AIVEN_CA_CERT } from "@/lib/aiven-ca";

type SqlParams = (string | number | boolean | null | Date)[];

export type { PoolConnection, ResultSetHeader, RowDataPacket };

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

async function ensureSchema(p: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const columnMigrations = [
        `ALTER TABLE products ADD COLUMN pdv_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00 AFTER price`,
        `ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER pdv_percent`,
        `ALTER TABLE products ADD COLUMN measure_unit VARCHAR(50) DEFAULT NULL`,
        `ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1 AFTER active`,
        `ALTER TABLE quotes ADD COLUMN quote_number VARCHAR(32) NULL`,
        `ALTER TABLE quotes ADD COLUMN note TEXT NULL`,
        `ALTER TABLE quotes ADD COLUMN valid_until DATE NULL`,
        `ALTER TABLE quote_items ADD COLUMN qty INT NOT NULL DEFAULT 1`,
        `ALTER TABLE user_sessions ADD COLUMN device_label VARCHAR(120) NULL AFTER expires_at`,
        `ALTER TABLE user_sessions ADD COLUMN user_agent VARCHAR(512) NULL AFTER device_label`,
        `ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45) NULL AFTER user_agent`,
        `ALTER TABLE user_sessions ADD COLUMN geo_city VARCHAR(120) NULL AFTER ip_address`,
        `ALTER TABLE user_sessions ADD COLUMN geo_country VARCHAR(120) NULL AFTER geo_city`,
        `ALTER TABLE user_sessions ADD COLUMN geo_country_code VARCHAR(8) NULL AFTER geo_country`,
        `ALTER TABLE user_sessions ADD COLUMN token_hash CHAR(64) NULL AFTER id`,
        `ALTER TABLE user_sessions ADD COLUMN last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER last_seen_at`,
        `ALTER TABLE user_sessions ADD COLUMN session_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at`,
        `ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(36) NULL AFTER geo_country_code`,
        `ALTER TABLE user_sessions ADD COLUMN trust_score TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER device_id`,
        `ALTER TABLE user_sessions ADD COLUMN trust_level VARCHAR(10) NOT NULL DEFAULT 'low' AFTER trust_score`,
        `ALTER TABLE security_audit_log ADD COLUMN action VARCHAR(64) NULL AFTER event_type`,
        `ALTER TABLE security_audit_log ADD COLUMN prev_hash CHAR(64) NOT NULL DEFAULT 'GENESIS' AFTER metadata`,
        `ALTER TABLE security_audit_log ADD COLUMN entry_hash CHAR(64) NULL AFTER prev_hash`,
        `ALTER TABLE security_audit_log ADD COLUMN suspicious_flag TINYINT(1) NOT NULL DEFAULT 0 AFTER entry_hash`,
      ];
      try {
        await p.query(`DELETE FROM user_sessions WHERE token_hash IS NULL`);
      } catch {
        /* user_sessions možda ne postoji još */
      }

      for (const sql of columnMigrations) {
        try {
          await p.query(sql);
        } catch (error: unknown) {
          const code =
            error && typeof error === "object" && "code" in error
              ? String((error as { code: string }).code)
              : "";
          if (code !== "ER_DUP_FIELDNAME") throw error;
        }
      }

      try {
        await p.query(`
          UPDATE quotes
          SET quote_number = CONCAT('PON-', YEAR(created_at), '-', LPAD(id, 4, '0'))
          WHERE quote_number IS NULL OR quote_number = ''
        `);
        await p.query(
          `ALTER TABLE quotes MODIFY COLUMN quote_number VARCHAR(32) NOT NULL`,
        );
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "ER_BAD_FIELD_ERROR" && code !== "ER_INVALID_USE_OF_NULL") {
          /* quote_number možda već NOT NULL */
        }
      }

      try {
        await p.query(
          `CREATE UNIQUE INDEX idx_quotes_quote_number ON quotes (quote_number)`,
        );
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "ER_DUP_KEYNAME") throw error;
      }

      await p.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL DEFAULT '',
          role VARCHAR(20) NOT NULL DEFAULT 'user',
          active TINYINT(1) NOT NULL DEFAULT 1,
          session_version INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await p.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id VARCHAR(36) PRIMARY KEY,
          user_id INT NOT NULL,
          expires_at DATETIME NOT NULL,
          token_hash CHAR(64) NULL,
          device_label VARCHAR(120) NULL,
          user_agent VARCHAR(512) NULL,
          ip_address VARCHAR(45) NULL,
          geo_city VARCHAR(120) NULL,
          geo_country VARCHAR(120) NULL,
          geo_country_code VARCHAR(8) NULL,
          device_id VARCHAR(36) NULL,
          trust_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
          trust_level VARCHAR(10) NOT NULL DEFAULT 'low',
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          session_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_sessions_user (user_id),
          INDEX idx_user_sessions_expires (expires_at),
          INDEX idx_user_sessions_token_hash (token_hash),
          INDEX idx_user_sessions_user_expires (user_id, expires_at),
          INDEX idx_user_sessions_device (user_id, device_id)
        )
      `);

      await p.query(`
        CREATE TABLE IF NOT EXISTS user_known_devices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          device_id VARCHAR(36) NOT NULL,
          device_label VARCHAR(120) NULL,
          last_ip VARCHAR(45) NULL,
          last_country_code VARCHAR(8) NULL,
          success_login_count INT NOT NULL DEFAULT 0,
          first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_device (user_id, device_id),
          INDEX idx_known_devices_user (user_id)
        )
      `);

      await p.query(`
        CREATE TABLE IF NOT EXISTS auth_rate_limits (
          key_hash CHAR(64) PRIMARY KEY,
          attempt_count INT NOT NULL DEFAULT 0,
          window_started_at DATETIME NOT NULL,
          locked_until DATETIME NULL,
          INDEX idx_rate_locked (locked_until)
        )
      `);

      await p.query(`
        CREATE TABLE IF NOT EXISTS security_audit_log (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          request_id VARCHAR(64) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          action VARCHAR(64) NOT NULL,
          actor_user_id INT NULL,
          target_user_id INT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(512) NULL,
          failure_reason VARCHAR(255) NULL,
          metadata JSON NULL,
          prev_hash CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
          entry_hash CHAR(64) NOT NULL,
          suspicious_flag TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_created (created_at),
          INDEX idx_audit_event_created (event_type, created_at),
          INDEX idx_audit_action_created (action, created_at),
          INDEX idx_audit_actor_created (actor_user_id, created_at),
          INDEX idx_audit_ip_created (ip_address, created_at),
          INDEX idx_audit_suspicious (suspicious_flag, created_at)
        )
      `);

      const indexMigrations = [
        `CREATE INDEX idx_users_role_active ON users (role, active)`,
        `CREATE INDEX idx_users_email_active ON users (email, active)`,
      ];
      for (const sql of indexMigrations) {
        try {
          await p.query(sql);
        } catch (error: unknown) {
          const code =
            error && typeof error === "object" && "code" in error
              ? String((error as { code: string }).code)
              : "";
          if (code !== "ER_DUP_KEYNAME") throw error;
        }
      }

      try {
        await p.query(`ALTER TABLE quotes DROP COLUMN status`);
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "ER_BAD_FIELD_ERROR" && code !== "ER_CANT_DROP_FIELD_OR_KEY") {
          throw error;
        }
      }

      await ensureOrganizationsSchema(p);
    })();
  }
  await schemaReady;
}

function mysqlCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code: string }).code)
    : "";
}

async function runIgnore(
  p: Pool,
  sql: string,
  ignored: string[],
): Promise<void> {
  try {
    await p.query(sql);
  } catch (error: unknown) {
    const code = mysqlCode(error);
    if (!ignored.includes(code)) throw error;
  }
}

/** Multi-tenant: organizations + organization_id + unique po firmi. */
async function ensureOrganizationsSchema(p: Pool): Promise<void> {
  await p.query(`
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

  await runIgnore(
    p,
    `INSERT INTO organizations (name, slug, plan, status, trial_ends_at)
     SELECT 'Default', 'default', 'business', 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)
     WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')`,
    ["ER_DUP_ENTRY"],
  );

  await runIgnore(
    p,
    `ALTER TABLE users ADD COLUMN organization_id INT NULL AFTER id`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE products ADD COLUMN organization_id INT NULL AFTER id`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE quotes ADD COLUMN organization_id INT NULL AFTER id`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE price_lists ADD COLUMN organization_id INT NULL AFTER id`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE app_settings ADD COLUMN organization_id INT NULL AFTER setting_key`,
    ["ER_DUP_FIELDNAME"],
  );

  await p.query(`
    UPDATE users SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    WHERE organization_id IS NULL
  `);
  await p.query(`
    UPDATE products SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    WHERE organization_id IS NULL
  `);
  await p.query(`
    UPDATE quotes SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    WHERE organization_id IS NULL
  `);
  await p.query(`
    UPDATE price_lists SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    WHERE organization_id IS NULL
  `);
  await p.query(`
    UPDATE app_settings SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    WHERE organization_id IS NULL
  `);

  await runIgnore(p, `ALTER TABLE products DROP INDEX sku`, [
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_BAD_FIELD_ERROR",
  ]);
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_products_org_sku ON products (organization_id, sku)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );
  await runIgnore(p, `CREATE INDEX idx_products_org ON products (organization_id)`, [
    "ER_DUP_KEYNAME",
  ]);

  await runIgnore(p, `ALTER TABLE quotes DROP INDEX idx_quotes_quote_number`, [
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_BAD_FIELD_ERROR",
  ]);
  await runIgnore(p, `ALTER TABLE quotes DROP INDEX quote_number`, [
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_BAD_FIELD_ERROR",
  ]);
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_quotes_org_number ON quotes (organization_id, quote_number)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );
  await runIgnore(p, `CREATE INDEX idx_quotes_org ON quotes (organization_id)`, [
    "ER_DUP_KEYNAME",
  ]);

  await runIgnore(p, `CREATE INDEX idx_users_org ON users (organization_id)`, [
    "ER_DUP_KEYNAME",
  ]);
  await runIgnore(
    p,
    `CREATE INDEX idx_price_lists_org ON price_lists (organization_id)`,
    ["ER_DUP_KEYNAME"],
  );

  await p.query(`
    CREATE TABLE IF NOT EXISTS org_settings (
      organization_id INT NOT NULL,
      setting_key VARCHAR(64) NOT NULL,
      setting_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (organization_id, setting_key)
    )
  `);

  await p.query(`
    INSERT IGNORE INTO org_settings (organization_id, setting_key, setting_value)
    SELECT
      COALESCE(s.organization_id, (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)),
      s.setting_key,
      s.setting_value
    FROM app_settings s
  `);

  await ensureSignupSchema(p);
}

/** Self-service: verifikacija emaila, invite tokeni, owner uloga. */
async function ensureSignupSchema(p: Pool): Promise<void> {
  let addedVerifiedCol = false;
  try {
    await p.query(
      `ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER session_version`,
    );
    addedVerifiedCol = true;
  } catch (error: unknown) {
    if (mysqlCode(error) !== "ER_DUP_FIELDNAME") throw error;
  }

  if (addedVerifiedCol) {
    await p.query(
      `UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE email_verified_at IS NULL`,
    );
  }

  await p.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_verify_token_hash (token_hash),
      INDEX idx_verify_user (user_id),
      INDEX idx_verify_expires (expires_at)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS organization_invites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organization_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      invited_by INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      accepted_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_invite_token_hash (token_hash),
      INDEX idx_invite_org (organization_id),
      INDEX idx_invite_email (email),
      INDEX idx_invite_expires (expires_at)
    )
  `);

  await p.query(`
    UPDATE users u
    INNER JOIN (
      SELECT u2.organization_id, MIN(u2.id) AS fid
      FROM users u2
      WHERE u2.organization_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users o
          WHERE o.organization_id = u2.organization_id AND o.role = 'owner'
        )
      GROUP BY u2.organization_id
    ) x ON u.id = x.fid
    SET u.role = 'owner'
  `);

  await runIgnore(
    p,
    `ALTER TABLE users ADD COLUMN google_sub VARCHAR(64) NULL AFTER email_verified_at`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_users_google_sub ON users (google_sub)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );

  await ensureBillingSchema(p);
  await ensureOnboardingSchema(p);
  await ensureCatalogListsSchema(p);
  await ensureCurrencySchema(p);
}

async function ensureBillingSchema(p: Pool): Promise<void> {
  await runIgnore(
    p,
    `ALTER TABLE organizations ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER trial_ends_at`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE organizations ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_org_stripe_customer ON organizations (stripe_customer_id)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_org_stripe_subscription ON organizations (stripe_subscription_id)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );
  await p.query(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(80) NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureOnboardingSchema(p: Pool): Promise<void> {
  await runIgnore(
    p,
    `ALTER TABLE organizations ADD COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 1 AFTER stripe_subscription_id`,
    ["ER_DUP_FIELDNAME"],
  );
}

async function ensureCurrencySchema(p: Pool): Promise<void> {
  await runIgnore(
    p,
    `ALTER TABLE price_lists ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'RSD' AFTER template`,
    ["ER_DUP_FIELDNAME"],
  );
  await runIgnore(
    p,
    `ALTER TABLE quotes ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'RSD' AFTER valid_until`,
    ["ER_DUP_FIELDNAME"],
  );
}

/** Više cenovnika: products.price_list_id + arhiva/template na price_lists. */
async function ensureCatalogListsSchema(p: Pool): Promise<void> {
  await runIgnore(
    p,
    `ALTER TABLE price_lists ADD COLUMN template VARCHAR(20) NOT NULL DEFAULT 'empty' AFTER name`,
    ["ER_DUP_FIELDNAME"],
  );

  let addedArchivedCol = false;
  try {
    await p.query(
      `ALTER TABLE price_lists ADD COLUMN archived_at DATETIME NULL AFTER uploaded_at`,
    );
    addedArchivedCol = true;
  } catch (error: unknown) {
    if (mysqlCode(error) !== "ER_DUP_FIELDNAME") throw error;
  }

  await runIgnore(
    p,
    `ALTER TABLE products ADD COLUMN price_list_id INT NULL AFTER organization_id`,
    ["ER_DUP_FIELDNAME"],
  );

  const [orgRows] = await p.query<RowDataPacket[]>(`SELECT id FROM organizations`);

  for (const org of orgRows) {
    const orgId = Number(org.id);
    if (!Number.isFinite(orgId) || orgId <= 0) continue;

    const [activeRows] = await p.query<RowDataPacket[]>(
      `SELECT id FROM price_lists
       WHERE organization_id = ? AND active = 1 AND archived_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [orgId],
    );
    let keepId = Number(activeRows[0]?.id ?? 0);

    if (!keepId) {
      const [anyList] = await p.query<RowDataPacket[]>(
        `SELECT id FROM price_lists
         WHERE organization_id = ?
         ORDER BY (archived_at IS NULL) DESC, uploaded_at DESC, id DESC
         LIMIT 1`,
        [orgId],
      );
      keepId = Number(anyList[0]?.id ?? 0);
    }

    if (!keepId) {
      const [orphanRows] = await p.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM products
         WHERE organization_id = ? AND (price_list_id IS NULL OR price_list_id = 0)`,
        [orgId],
      );
      if (Number(orphanRows[0]?.cnt ?? 0) === 0) continue;

      const [ins] = await p.query<ResultSetHeader>(
        `INSERT INTO price_lists (organization_id, name, template, active)
         VALUES (?, 'Cenovnik', 'empty', 1)`,
        [orgId],
      );
      keepId = Number(ins.insertId);
    }

    if (addedArchivedCol) {
      await p.query(
        `UPDATE price_lists
         SET archived_at = UTC_TIMESTAMP(), active = 0
         WHERE organization_id = ? AND id != ? AND archived_at IS NULL`,
        [orgId, keepId],
      );
      await p.query(
        `UPDATE price_lists SET active = 1, archived_at = NULL WHERE id = ?`,
        [keepId],
      );
    } else {
      await p.query(
        `UPDATE price_lists SET active = 1, archived_at = NULL WHERE id = ? AND active = 0`,
        [keepId],
      );
    }

    await p.query(
      `UPDATE products
       SET price_list_id = ?
       WHERE organization_id = ? AND (price_list_id IS NULL OR price_list_id = 0)`,
      [keepId, orgId],
    );
  }

  await runIgnore(p, `ALTER TABLE products DROP INDEX uk_products_org_sku`, [
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_BAD_FIELD_ERROR",
  ]);
  await runIgnore(
    p,
    `CREATE UNIQUE INDEX uk_products_org_list_sku ON products (organization_id, price_list_id, sku)`,
    ["ER_DUP_KEYNAME", "ER_DUP_ENTRY"],
  );
  await runIgnore(
    p,
    `CREATE INDEX idx_products_list ON products (price_list_id)`,
    ["ER_DUP_KEYNAME"],
  );
}

function env(key: string): string | undefined {
  return process.env[`MYSQL_${key}`];
}

/** Override kad Shared MYSQL_DATABASE=defaultdb (Budget) — dodaj na Vercel Project. */
export function resolveMysqlDatabase(): string {
  return (
    process.env.PONUDEAPP_DATABASE?.trim() ||
    env("DATABASE")?.trim() ||
    "ponudaapp"
  );
}

function envBool(key: string): boolean {
  const v = env(key);
  return v === "true" || v === "1";
}

function resolveSsl(host?: string): SslOptions | undefined {
  const sslCaRaw = process.env.MYSQL_SSL_CA?.trim();
  const needsSsl =
    sslCaRaw ||
    envBool("SSL") ||
    host?.includes("aivencloud.com");

  if (!needsSsl) return undefined;

  // Na Vercelu multiline MYSQL_SSL_CA često bude pokvaren — koristimo ugrađeni CA.
  const ca =
    sslCaRaw?.includes("-----BEGIN CERTIFICATE-----") &&
    sslCaRaw.includes("-----END CERTIFICATE-----")
      ? sslCaRaw
      : AIVEN_CA_CERT;

  return {
    ca,
    rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

function buildPoolOptions(): PoolOptions {
  const connectionLimit = env("CONNECTION_LIMIT")
    ? Number(env("CONNECTION_LIMIT"))
    : 10;

  const host = env("HOST");
  const user = env("USER");
  const database = resolveMysqlDatabase();
  const password = env("PASSWORD") ?? "";

  if (!host || !user || !database) {
    throw new Error(
      "Postavi MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (i MYSQL_PASSWORD za Aiven) u .env.local",
    );
  }

  if (!password && host.includes("aivencloud.com")) {
    throw new Error(
      "MYSQL_PASSWORD je prazan. U .env.local nalepi Aiven lozinku (Password → Reveal).",
    );
  }

  const needsSsl = envBool("SSL") || host.includes("aivencloud.com");
  const port = env("PORT") ? Number(env("PORT")) : 3306;
  const maxIdle = env("MAX_IDLE") ? Number(env("MAX_IDLE")) : undefined;
  const idleTimeout = env("IDLE_TIMEOUT_MS")
    ? Number(env("IDLE_TIMEOUT_MS"))
    : undefined;

  return {
    host,
    port,
    user,
    password,
    database,
    /** Aiven/MySQL su u UTC — bez ovoga mysql2 čita DATETIME kao lokalno i admin idle odmah gasi sesiju. */
    timezone: "Z",
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    ...(maxIdle != null ? { maxIdle } : {}),
    ...(idleTimeout != null ? { idleTimeout } : {}),
    ...(needsSsl ? { ssl: resolveSsl(host) } : {}),
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(buildPoolOptions());
  }
  return pool;
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: SqlParams,
): Promise<T> {
  const p = getPool();
  await ensureSchema(p);
  const [rows] = await p.query<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params?: SqlParams,
): Promise<ResultSetHeader> {
  const p = getPool();
  await ensureSchema(p);
  const [result] = await p.execute<ResultSetHeader>(sql, params);
  return result;
}

/** Atomska transakcija — revokacija sesija, audit chain, role change. */
export async function withTransaction<T>(
  fn: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const p = getPool();
  await ensureSchema(p);
  const connection = await p.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
