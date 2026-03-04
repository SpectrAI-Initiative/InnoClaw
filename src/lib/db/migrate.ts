import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index";
import path from "path";
import crypto from "crypto";
import fs from "fs";

/**
 * Seed the __drizzle_migrations journal for migration files whose
 * SQL has already been applied to the database (e.g. tables created
 * outside the normal migration flow).  This prevents `migrate()` from
 * re-running those statements and failing with "table already exists".
 */
function seedExistingMigrations(migrationsFolder: string) {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return;

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const entries: { tag: string; when: number }[] = journal.entries ?? [];
  if (entries.length === 0) return;

  for (const entry of entries) {
    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) continue;
    const content = fs.readFileSync(sqlFile, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    // Skip if already recorded
    const row = sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM __drizzle_migrations WHERE hash = ?`
      )
      .get(hash) as { cnt: number } | undefined;
    if (row && row.cnt > 0) continue;

    sqlite
      .prepare(
        `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`
      )
      .run(hash, entry.when);
  }
}

export function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    migrate(db, { migrationsFolder });
  } catch (error: unknown) {
    // If migration fails because tables already exist, seed the journal
    // and retry so future migrations still apply correctly.
    const msg = error instanceof Error ? error.message : String(error);
    const causeMsg =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    if (msg.includes("already exists") || causeMsg.includes("already exists")) {
      console.warn(
        "[migrate] Tables already exist — seeding migration journal and retrying…"
      );
      seedExistingMigrations(migrationsFolder);
      migrate(db, { migrationsFolder });
    } else {
      throw error;
    }
  }
}
