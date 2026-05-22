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
    })();
  }
  await schemaReady;
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
