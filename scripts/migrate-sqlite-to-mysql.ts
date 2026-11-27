/**
 * One-off copy of an existing InnoScale SQLite database into MySQL.
 *
 * Usage (from the repository root, with dev dependencies installed):
 *   DATABASE_URL=mysql://user:pw@host:3306/innoscale \
 *     npx tsx scripts/migrate-sqlite-to-mysql.ts --sqlite ./data/innoscale.db [--dry-run]
 *
 * Behaviour:
 * - Applies the MySQL migrations first, then copies every table the two
 *   databases share, column by column (columns missing on either side are skipped).
 * - Refuses to run unless every target table is empty, so it cannot merge into
 *   or duplicate live data.
 * - Copies inside one transaction with foreign-key checks off, then verifies
 *   row counts per table. Embeddings whose chunk no longer exists are skipped.
 * - The SQLite file is opened read-only and is never modified.
 */
import Database from "better-sqlite3";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { closeDb, getPool } from "../src/lib/db/index";
import { runMigrations } from "../src/lib/db/migrate";

/** Parent tables before children (FK checks are off, but this keeps intent clear). */
const TABLE_ORDER = [
  "users",
  "user_sessions",
  "workspaces",
  "sources",
  "source_chunks",
  "chunk_embeddings",
  "chat_messages",
  "notes",
  "app_settings",
  "skills",
  "scheduled_tasks",
  "cluster_operations",
  "hf_datasets",
  "dataset_workspace_links",
  "remote_profiles",
  "experiment_runs",
  "deep_research_sessions",
  "deep_research_messages",
  "deep_research_nodes",
  "deep_research_artifacts",
  "deep_research_events",
  "deep_research_requirements",
  "deep_research_execution_records",
];

const BATCH_ROWS = 200;

interface Args {
  sqlitePath: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let sqlitePath = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--sqlite") sqlitePath = argv[++i] ?? "";
    else if (argv[i] === "--dry-run") dryRun = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!sqlitePath) throw new Error("Pass the SQLite file with --sqlite <path>");
  return { sqlitePath, dryRun };
}

function sqliteColumns(sqlite: Database.Database, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

async function mysqlColumns(conn: PoolConnection, table: string): Promise<string[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT column_name AS name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => String(r.name));
}

async function mysqlCount(conn: PoolConnection, table: string): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return Number(rows[0].n);
}

function sourceQuery(table: string, columns: string[]): string {
  const list = columns.map((c) => `"${c}"`).join(", ");
  if (table === "chunk_embeddings") {
    // The SQLite table had no foreign key; skip embeddings of deleted chunks.
    return `SELECT ${columns.map((c) => `e."${c}"`).join(", ")} FROM chunk_embeddings e
            WHERE EXISTS (SELECT 1 FROM source_chunks c WHERE c.id = e.chunk_id)`;
  }
  return `SELECT ${list} FROM "${table}"`;
}

async function main(): Promise<void> {
  const { sqlitePath, dryRun } = parseArgs(process.argv.slice(2));
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  try {
    const sqliteTables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
        .map((r) => r.name),
    );

    await runMigrations();
    const conn = await getPool().getConnection();

    try {
      type Plan = { table: string; columns: string[]; skipped: string[]; expected: number };
      const plans: Plan[] = [];

      for (const table of TABLE_ORDER) {
        if (!sqliteTables.has(table)) {
          console.log(`- ${table}: not in SQLite, skipped`);
          continue;
        }
        const target = await mysqlColumns(conn, table);
        const source = sqliteColumns(sqlite, table);
        const columns = source.filter((c) => target.includes(c));
        const skipped = source.filter((c) => !target.includes(c));
        const existing = await mysqlCount(conn, table);
        if (existing > 0) {
          throw new Error(`MySQL table ${table} already has ${existing} rows; refusing to copy into a non-empty database`);
        }
        const countSql = `SELECT COUNT(*) AS n FROM (${sourceQuery(table, columns)})`;
        const expected = Number((sqlite.prepare(countSql).get() as { n: number }).n);
        plans.push({ table, columns, skipped, expected });
        console.log(
          `- ${table}: ${expected} rows` + (skipped.length ? ` (columns not in MySQL, skipped: ${skipped.join(", ")})` : ""),
        );
      }

      if (dryRun) {
        console.log("Dry run: nothing copied.");
        return;
      }

      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      await conn.beginTransaction();
      try {
        for (const plan of plans) {
          if (plan.expected === 0) continue;
          const columnList = plan.columns.map((c) => `\`${c}\``).join(", ");
          const statement = sqlite.prepare(sourceQuery(plan.table, plan.columns)).raw(true);
          let batch: unknown[][] = [];
          const flush = async () => {
            if (batch.length === 0) return;
            await conn.query(`INSERT INTO \`${plan.table}\` (${columnList}) VALUES ?`, [batch]);
            batch = [];
          };
          for (const row of statement.iterate() as Iterable<unknown[]>) {
            batch.push(row);
            if (batch.length >= BATCH_ROWS) await flush();
          }
          await flush();
        }
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      }

      let mismatches = 0;
      for (const plan of plans) {
        const actual = await mysqlCount(conn, plan.table);
        const ok = actual === plan.expected;
        if (!ok) mismatches += 1;
        console.log(`${ok ? "ok " : "!! "} ${plan.table}: ${actual}/${plan.expected}`);
      }
      if (mismatches > 0) {
        throw new Error(`${mismatches} table(s) have mismatched row counts`);
      }
      console.log("Copy complete.");
    } finally {
      conn.release();
    }
  } finally {
    sqlite.close();
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
