import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

const DEFAULT_POOL_SIZE = 10;

/**
 * Parse and validate DATABASE_URL. Only MySQL connection strings are accepted:
 *   mysql://user:password@host:3306/database
 * A bare file path means an old SQLite configuration, which is no longer supported.
 */
export function resolveDatabaseUrl(
  raw: string | undefined = process.env.DATABASE_URL,
): URL {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      "[db] DATABASE_URL is not set. Set it to a MySQL connection string, e.g. mysql://user:password@host:3306/innoclaw",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    url = new URL("invalid:");
  }

  if (url.protocol !== "mysql:") {
    throw new Error(
      "[db] DATABASE_URL must be a mysql:// connection string. SQLite file paths are no longer supported; " +
        "see docs/database.md for moving existing SQLite data to MySQL.",
    );
  }
  if (!url.hostname || url.pathname.replace(/^\//, "") === "") {
    throw new Error("[db] DATABASE_URL must include a host and a database name.");
  }
  return url;
}

export function createPool(raw?: string): mysql.Pool {
  const url = resolveDatabaseUrl(raw);
  const poolSize = Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "", 10);

  return mysql.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit:
      Number.isFinite(poolSize) && poolSize > 0 ? poolSize : DEFAULT_POOL_SIZE,
    charset: "utf8mb4",
    // Timestamps are stored as strings; keep any DATE/DATETIME values as strings too.
    dateStrings: true,
    timezone: "Z",
    supportBigNumbers: true,
    enableKeepAlive: true,
    waitForConnections: true,
    ...(url.searchParams.get("ssl") === "true"
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
}

/**
 * Stand-in client used when DATABASE_URL is missing or invalid. Building the
 * Drizzle handle never needs a connection (e.g. `next build`, or tests that
 * only render SQL); any real query rejects with the configuration error.
 */
function createUnconfiguredPool(error: Error): mysql.Pool {
  const fail = () => Promise.reject(error);
  return {
    query: fail,
    execute: fail,
    getConnection: fail,
    end: async () => {},
  } as unknown as mysql.Pool;
}

function createPoolOrPlaceholder(): mysql.Pool {
  try {
    return createPool();
  } catch (error) {
    return createUnconfiguredPool(error instanceof Error ? error : new Error(String(error)));
  }
}

// Use a global singleton so dev-mode HMR does not open a new pool per reload.
// mysql2 pools connect lazily, so creating one here opens no connection.
const globalForDb = globalThis as unknown as {
  __innoclawMysqlPool?: mysql.Pool;
};

const pool = globalForDb.__innoclawMysqlPool ?? createPoolOrPlaceholder();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__innoclawMysqlPool = pool;
}

export const db: Database = drizzle(pool, { schema, mode: "default" });

export function getPool(): mysql.Pool {
  return pool;
}

/** Close the pool (scripts and tests). The module cannot be reused afterwards. */
export async function closeDb(): Promise<void> {
  globalForDb.__innoclawMysqlPool = undefined;
  await pool.end();
}
