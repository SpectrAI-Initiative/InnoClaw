/** MySQL duplicate-key error (ER_DUP_ENTRY). */
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;
/** MySQL missing-table error (ER_NO_SUCH_TABLE). */
const MYSQL_NO_SUCH_TABLE_ERRNO = 1146;

function hasDriverError(
  error: unknown,
  code: string,
  errno: number,
): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === code || candidate.errno === errno) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

/**
 * True when the error (or any error in its `cause` chain) is a unique-constraint
 * violation. Drizzle wraps driver errors in DrizzleQueryError, so the original
 * mysql2 error is usually found on `cause`.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return hasDriverError(error, "ER_DUP_ENTRY", MYSQL_DUPLICATE_ENTRY_ERRNO);
}

/** True when a query failed because the table does not exist yet (before migrations). */
export function isMissingTableError(error: unknown): boolean {
  return hasDriverError(error, "ER_NO_SUCH_TABLE", MYSQL_NO_SUCH_TABLE_ERRNO);
}
