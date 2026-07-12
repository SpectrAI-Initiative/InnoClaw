export function isSqliteUniqueConstraint(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: unknown }).code).startsWith(
        "SQLITE_CONSTRAINT_UNIQUE",
      ),
  );
}
