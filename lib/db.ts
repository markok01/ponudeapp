import mysql, {
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
  type SslOptions,
} from "mysql2/promise";
import { AIVEN_CA_CERT } from "@/lib/aiven-ca";

type SqlParams = (string | number | boolean | null | Date)[];

export type { ResultSetHeader, RowDataPacket };

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
      ];
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

function envBool(key: string): boolean {
  const v = env(key);
  return v === "true" || v === "1";
}

function resolveSsl(host?: string): SslOptions | undefined {
  const sslCa = process.env.MYSQL_SSL_CA;
  const needsSsl =
    sslCa ||
    envBool("SSL") ||
    host?.includes("aivencloud.com");

  if (!needsSsl) return undefined;

  const ca = sslCa?.startsWith("-----BEGIN") ? sslCa : AIVEN_CA_CERT;

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
  const database = env("DATABASE");
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
