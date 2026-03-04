import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_URL
  ? path.resolve(process.env.DATABASE_URL)
  : path.join(process.cwd(), "data", "notebooklm.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Use global singleton to prevent multiple connections during HMR
const globalForDb = globalThis as unknown as {
  sqlite: Database.Database | undefined;
};

const sqlite = globalForDb.sqlite ?? new Database(DB_PATH);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

// WAL mode is faster but requires mmap support.
// Network/shared filesystems (NFS, CIFS, FUSE) often lack mmap support,
// causing SQLITE_IOERR_SHMMAP. Fall back to DELETE journal mode in that case.
try {
  sqlite.pragma("journal_mode = WAL");
} catch (err) {
  // Only fall back for the specific mmap-related error; surface others.
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "SQLITE_IOERR_SHMMAP"
  ) {
    sqlite.pragma("journal_mode = DELETE");
  } else {
    throw err;
  }
}
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
