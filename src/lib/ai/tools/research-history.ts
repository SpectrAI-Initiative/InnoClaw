import fsp from "fs/promises";
import path from "path";

/**
 * Copy a file into the research history directory, preserving its
 * relative path from the workspace root.
 *
 * This is best-effort: callers should catch errors so that a failed
 * copy never breaks the original tool operation.
 */
export async function copyToResearchHistory(
  filePath: string,
  workspaceCwd: string,
  researchHistoryDir: string
): Promise<void> {
  const relativePath = path.relative(workspaceCwd, filePath);

  // Skip files that are already inside history/ to avoid recursion
  if (relativePath === "history" || relativePath.startsWith(`history${path.sep}`)) return;

  // Skip hidden directories and common non-content paths
  if (relativePath.startsWith(".git") || relativePath.includes("node_modules")) return;

  const destPath = path.join(researchHistoryDir, relativePath);
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await fsp.copyFile(filePath, destPath);
}

/**
 * Format an ISO timestamp string into a filesystem-safe directory name.
 * e.g. "2026-03-12T14:30:00.000Z" → "2026-03-12T14-30-00"
 */
export function formatTimestampForDir(isoTimestamp: string): string {
  // Remove milliseconds and Z, replace colons with dashes
  return isoTimestamp
    .replace(/\.\d{3}Z$/, "")
    .replace(/Z$/, "")
    .replace(/:/g, "-");
}
