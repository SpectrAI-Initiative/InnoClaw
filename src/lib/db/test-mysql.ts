/**
 * Helpers for MySQL integration tests.
 *
 * These tests run only when TEST_DATABASE_URL is set, e.g.
 *   TEST_DATABASE_URL=mysql://user:pw@127.0.0.1:3306/innoscale_test npm test
 * Each test file gets its own database named `<database>_<suffix>`, which is
 * dropped and recreated, so the account needs CREATE/DROP on `<database>_%`.
 * The database name must contain "test" as a guard against wiping real data.
 */
import mysql from "mysql2/promise";
import { describe } from "vitest";

const TEST_URL = process.env.TEST_DATABASE_URL?.trim();

export const describeMysql = TEST_URL ? describe : describe.skip;

/** Creating the database and running migrations can exceed vitest's 10s hook default. */
export const SETUP_TIMEOUT_MS = 60_000;

/**
 * Drop and recreate a per-file test database, point DATABASE_URL at it and run migrations.
 * Call it before anything imports `@/lib/db`, then import modules dynamically.
 */
export async function setUpTestDatabase(suffix: string): Promise<string> {
  if (!TEST_URL) throw new Error("TEST_DATABASE_URL is not set");

  const url = new URL(TEST_URL);
  const baseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/test/i.test(baseName)) {
    throw new Error(`Refusing to use "${baseName}": the test database name must contain "test"`);
  }
  const dbName = `${baseName}_${suffix}`.replace(/[^A-Za-z0-9_]/g, "_");

  const admin = await mysql.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  });
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
  } finally {
    await admin.end();
  }

  url.pathname = `/${dbName}`;
  // Must run before ./index is first imported: the pool reads DATABASE_URL at load.
  process.env.DATABASE_URL = url.toString();
  const globals = globalThis as { __innoscaleMysqlPool?: unknown; __innoscaleMigrationPromise?: unknown };
  delete globals.__innoscaleMysqlPool;
  delete globals.__innoscaleMigrationPromise;

  const { runMigrations } = await import("./migrate");
  await runMigrations();
  return dbName;
}
