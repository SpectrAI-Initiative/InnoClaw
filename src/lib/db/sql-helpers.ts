import { sql, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

/**
 * Case-insensitive LIKE.
 *
 * Tables use the binary utf8mb4_bin collation so equality and unique indexes
 * stay exact (as they were in SQLite), which makes plain LIKE case-sensitive.
 * SQLite's LIKE ignored ASCII case, so callers that relied on that use this.
 * Backslash escapes `%` and `_` in the pattern (MySQL's default LIKE escape).
 */
export function likeIgnoreCase(column: MySqlColumn, pattern: string): SQL {
  return sql`lower(${column}) like lower(${pattern})`;
}
