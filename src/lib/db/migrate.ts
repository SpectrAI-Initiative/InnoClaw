import path from "path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, getPool } from "./index";

/** Name of the MySQL advisory lock that serialises migrations across app instances. */
export const MIGRATION_LOCK_NAME = "innoscale_schema_migrations";
const MIGRATION_LOCK_TIMEOUT_SECONDS = 120;

const globalForMigrations = globalThis as typeof globalThis & {
  __innoscaleMigrationPromise?: Promise<void>;
};

/**
 * Apply pending Drizzle migrations from ./drizzle.
 *
 * Several app instances may start at once against the same database, so the
 * run is guarded by GET_LOCK(): one instance migrates while the others wait,
 * then find nothing left to apply.
 */
async function runMigrationsOnce(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const lockConnection = await getPool().getConnection();

  try {
    const [rows] = await lockConnection.query(
      "SELECT GET_LOCK(?, ?) AS acquired",
      [MIGRATION_LOCK_NAME, MIGRATION_LOCK_TIMEOUT_SECONDS],
    );
    const acquired = (rows as Array<{ acquired: number | null }>)[0]?.acquired;
    if (acquired !== 1) {
      throw new Error(
        `[migrate] Timed out after ${MIGRATION_LOCK_TIMEOUT_SECONDS}s waiting for another instance to finish migrations.`,
      );
    }

    try {
      await migrate(db, { migrationsFolder });
    } finally {
      await lockConnection.query("SELECT RELEASE_LOCK(?)", [MIGRATION_LOCK_NAME]);
    }
  } finally {
    lockConnection.release();
  }
}

export function runMigrations(): Promise<void> {
  if (!globalForMigrations.__innoscaleMigrationPromise) {
    globalForMigrations.__innoscaleMigrationPromise = runMigrationsOnce();
    globalForMigrations.__innoscaleMigrationPromise.catch(() => {
      globalForMigrations.__innoscaleMigrationPromise = undefined;
    });
  }

  return globalForMigrations.__innoscaleMigrationPromise;
}
