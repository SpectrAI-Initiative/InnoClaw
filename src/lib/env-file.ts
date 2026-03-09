import fs from "fs";
import path from "path";

/**
 * Resolve the project-root `.env.local` path.
 * Works in both dev (cwd = project root) and production.
 */
function envLocalPath(): string {
  return path.resolve(process.cwd(), ".env.local");
}

function envExamplePath(): string {
  return path.resolve(process.cwd(), ".env.example");
}

/**
 * Ensure `.env.local` exists.
 * If it does not, copy `.env.example` as a starting point.
 * If `.env.example` does not exist either, create a minimal file.
 */
export function ensureEnvLocal(): void {
  const target = envLocalPath();
  if (fs.existsSync(target)) return;

  const example = envExamplePath();
  if (fs.existsSync(example)) {
    fs.copyFileSync(example, target);
  } else {
    fs.writeFileSync(
      target,
      "# VibeLab configuration – edit values as needed\n",
      "utf-8",
    );
  }
}

/**
 * Update (or append) key=value pairs in `.env.local`.
 *
 * - Preserves comments and unrelated lines.
 * - If a key already exists (even commented-out with `# KEY=...`), the
 *   **first uncommented occurrence** is updated; otherwise a new line is
 *   appended at the end.
 * - Creates the file if it does not exist.
 */
export function updateEnvLocal(updates: Record<string, string>): void {
  ensureEnvLocal();
  const filePath = envLocalPath();
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const remaining = { ...updates };

  // Update existing entries in-place
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (key in remaining) {
      const val = remaining[key];
      delete remaining[key];
      return `${key}=${val}`;
    }
    return line;
  });

  // Append any keys that were not found
  for (const [key, val] of Object.entries(remaining)) {
    updated.push(`${key}=${val}`);
  }

  fs.writeFileSync(filePath, updated.join("\n"), "utf-8");
}
