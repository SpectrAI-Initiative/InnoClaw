import type Database from "better-sqlite3";
import { canonicalizePath } from "@/lib/files/canonical-path";

const WORKSPACES_TABLE = "workspaces";
const UNIQUE_INDEX = "workspaces_folder_path_unique_idx";

function sqliteObjectExists(
  sqlite: Database.Database,
  type: "table" | "index",
  name: string,
): boolean {
  return Boolean(
    sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1",
      )
      .get(type, name),
  );
}

export function preflightWorkspacePaths(
  sqlite: Database.Database,
): { rewritten: number } {
  if (!sqliteObjectExists(sqlite, "table", WORKSPACES_TABLE)) {
    return { rewritten: 0 };
  }
  if (sqliteObjectExists(sqlite, "index", UNIQUE_INDEX)) {
    return { rewritten: 0 };
  }

  const rows = sqlite
    .prepare("SELECT id, folder_path AS folderPath FROM workspaces")
    .all() as Array<{ id: string; folderPath: string }>;
  const resolvedRows = rows.map((row) => ({
    ...row,
    canonicalPath: canonicalizePath(row.folderPath),
  }));
  const idsByCanonicalPath = new Map<string, string[]>();

  for (const row of resolvedRows) {
    const collisionKey =
      process.platform === "win32"
        ? row.canonicalPath.toLowerCase()
        : row.canonicalPath;
    const ids = idsByCanonicalPath.get(collisionKey) ?? [];
    ids.push(row.id);
    idsByCanonicalPath.set(collisionKey, ids);
  }

  const collisions = [...idsByCanonicalPath.entries()].filter(
    ([, ids]) => ids.length > 1,
  );
  if (collisions.length > 0) {
    const details = collisions
      .map(([canonicalPath, ids]) => `${canonicalPath}: ${ids.join(", ")}`)
      .join("; ");
    throw new Error(`Canonical workspace path collisions: ${details}`);
  }

  const changedRows = resolvedRows.filter(
    (row) => row.folderPath !== row.canonicalPath,
  );
  if (changedRows.length === 0) {
    return { rewritten: 0 };
  }

  const update = sqlite.prepare(
    "UPDATE workspaces SET folder_path = ? WHERE id = ?",
  );
  sqlite.transaction(() => {
    for (const row of changedRows) {
      update.run(row.canonicalPath, row.id);
    }
  })();

  return { rewritten: changedRows.length };
}
