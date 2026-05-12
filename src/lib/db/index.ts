import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

import { assessPathLocking } from "../dev/project-filesystem";

// DATABASE_URL accepts plain filesystem paths only (not SQLite URI strings).
// Strip a leading "file:" prefix if present so that path.resolve() works correctly.
const rawDbUrl = process.env.DATABASE_URL?.replace(/^file:/, "");
const DB_PATH = rawDbUrl
  ? path.resolve(rawDbUrl)
  : path.join(process.cwd(), "data", "innoclaw.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Use global singleton to prevent multiple connections during HMR
const globalForDb = globalThis as unknown as {
  sqlite: Database.Database | undefined;
};

const sqlite = globalForDb.sqlite ?? new Database(DB_PATH);
const dbLocking = assessPathLocking(DB_PATH);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

function getSqliteErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code?: unknown }).code ?? "");
  }

  return undefined;
}

function trySetDeleteJournalMode(): void {
  try {
    sqlite.pragma("journal_mode = DELETE");
  } catch (err) {
    if (getSqliteErrorCode(err) === "SQLITE_BUSY") {
      console.warn(
        "[db] SQLite journal mode stayed unchanged because the database was busy during startup. Use a local DATABASE_URL for reliable locking on network filesystems."
      );
      return;
    }

    throw err;
  }
}

sqlite.pragma("busy_timeout = 5000");

// WAL mode is faster but requires mmap support.
// Network/shared filesystems (NFS, CIFS, FUSE) often lack mmap support,
// or reliable locking, causing SQLITE_IOERR_SHMMAP / SQLITE_BUSY.
if (dbLocking.disableLock) {
  const mountPoint = dbLocking.mount?.mountPoint ?? path.dirname(DB_PATH);
  console.warn(
    `[db] Detected ${dbLocking.reason} at ${mountPoint}; using SQLite DELETE journal mode. Set DATABASE_URL to a local filesystem path for reliable locking.`
  );
  trySetDeleteJournalMode();
} else {
  try {
    sqlite.pragma("journal_mode = WAL");
  } catch (err) {
    const code = getSqliteErrorCode(err);

    if (code === "SQLITE_IOERR_SHMMAP" || code === "SQLITE_BUSY") {
      trySetDeleteJournalMode();
    } else {
      throw err;
    }
  }
}
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
