import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import type { FileEntry } from "@/types";

/**
 * Parse workspace roots from environment variable
 */
export function getWorkspaceRoots(): string[] {
  const roots = process.env.WORKSPACE_ROOTS || "";
  return roots
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => path.resolve(r));
}

/**
 * Validate that a path is within one of the allowed workspace roots.
 * Returns the resolved absolute path, or throws if invalid.
 */
export function validatePath(targetPath: string): string {
  const roots = getWorkspaceRoots();
  const resolved = path.resolve(targetPath);

  // Reject null bytes
  if (resolved.includes("\0")) {
    throw new Error("Invalid path: contains null bytes");
  }

  // Check the path is under one of the allowed roots
  const isAllowed = roots.some((root) => {
    const normalizedResolved = resolved.replace(/\\/g, "/").toLowerCase();
    const normalizedRoot = root.replace(/\\/g, "/").toLowerCase();
    return (
      normalizedResolved === normalizedRoot ||
      normalizedResolved.startsWith(normalizedRoot + "/")
    );
  });

  if (!isAllowed) {
    throw new Error(
      `Access denied: path "${resolved}" is not within allowed workspace roots`
    );
  }

  return resolved;
}

/**
 * Check if a path is within a specific workspace folder
 */
export function isWithinWorkspace(
  filePath: string,
  workspacePath: string
): boolean {
  const resolvedFile = path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
  const resolvedWorkspace = path
    .resolve(workspacePath)
    .replace(/\\/g, "/")
    .toLowerCase();
  return (
    resolvedFile === resolvedWorkspace ||
    resolvedFile.startsWith(resolvedWorkspace + "/")
  );
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  const validated = validatePath(dirPath);

  const entries = await fsp.readdir(validated, { withFileTypes: true });
  const results: FileEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files/folders and common non-content directories
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(validated, entry.name);
    try {
      const stat = await fsp.stat(fullPath);
      results.push({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: stat.size,
        modified: stat.mtime.toISOString(),
        path: fullPath.replace(/\\/g, "/"),
      });
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort: directories first, then alphabetical
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Read file content as text
 */
export async function readFile(filePath: string): Promise<string> {
  const validated = validatePath(filePath);
  return fsp.readFile(validated, "utf-8");
}

/**
 * Read file as buffer (for binary files)
 */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  const validated = validatePath(filePath);
  return fsp.readFile(validated);
}

/**
 * Write content to a file (create or overwrite)
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  const validated = validatePath(filePath);
  await fsp.mkdir(path.dirname(validated), { recursive: true });
  await fsp.writeFile(validated, content, "utf-8");
}

/**
 * Save uploaded file buffer
 */
export async function uploadFile(
  filePath: string,
  buffer: Buffer
): Promise<void> {
  const validated = validatePath(filePath);
  await fsp.mkdir(path.dirname(validated), { recursive: true });
  await fsp.writeFile(validated, buffer);
}

/**
 * Delete a file or empty directory
 */
export async function deleteFile(filePath: string): Promise<void> {
  const validated = validatePath(filePath);
  const stat = await fsp.stat(validated);

  if (stat.isDirectory()) {
    await fsp.rmdir(validated);
  } else {
    await fsp.unlink(validated);
  }
}

/**
 * Rename a file or directory
 */
export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  const validatedOld = validatePath(oldPath);
  const validatedNew = validatePath(newPath);
  await fsp.rename(validatedOld, validatedNew);
}

/**
 * Copy a file or directory recursively
 */
export async function copyFileOrDir(
  srcPath: string,
  destPath: string
): Promise<void> {
  const validatedSrc = validatePath(srcPath);
  const validatedDest = validatePath(destPath);

  // Prevent overwriting existing destinations
  if (await pathExists(validatedDest)) {
    throw new Error(`Destination already exists: ${validatedDest}`);
  }

  // Prevent copying a directory into itself or its subdirectories.
  // Use real paths so that symbolic links are resolved before comparison.
  let resolvedSrc: string;
  try {
    resolvedSrc = await fsp.realpath(validatedSrc);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      resolvedSrc = path.resolve(validatedSrc);
    } else {
      throw err;
    }
  }
  let resolvedDest: string;
  try {
    const destParent = await fsp.realpath(path.dirname(validatedDest));
    resolvedDest = path.join(destParent, path.basename(validatedDest));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      resolvedDest = path.resolve(validatedDest);
    } else {
      throw err;
    }
  }
  const normalizedSrc = resolvedSrc.replace(/\\/g, "/").toLowerCase();
  const normalizedDest = resolvedDest.replace(/\\/g, "/").toLowerCase();

  if (
    normalizedDest === normalizedSrc ||
    normalizedDest.startsWith(normalizedSrc + "/")
  ) {
    throw new Error(
      `Cannot copy a directory into itself or one of its subdirectories: ${validatedSrc} -> ${validatedDest}`
    );
  }

  await fsp.cp(validatedSrc, validatedDest, { recursive: true });
}

/**
 * Create a directory
 */
export async function createDirectory(dirPath: string): Promise<void> {
  const validated = validatePath(dirPath);
  await fsp.mkdir(validated, { recursive: true });
}

/**
 * Check if a path exists
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    const validated = validatePath(targetPath);
    await fsp.access(validated);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const validated = validatePath(targetPath);
    const stat = await fsp.stat(validated);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string) {
  const validated = validatePath(filePath);
  return fsp.stat(validated);
}

/**
 * Recursively list all files in a directory (for workspace sync)
 */
export async function listAllFiles(
  dirPath: string,
  basePath?: string
): Promise<
  { relativePath: string; absolutePath: string; size: number; mtime: string }[]
> {
  const validated = validatePath(dirPath);
  const base = basePath || validated;
  const results: {
    relativePath: string;
    absolutePath: string;
    size: number;
    mtime: string;
  }[] = [];

  const entries = await fsp.readdir(validated, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files/folders and common non-content directories
    if (
      entry.name.startsWith(".") ||
      entry.name === "node_modules" ||
      entry.name === "__pycache__" ||
      entry.name === ".git"
    ) {
      continue;
    }

    const fullPath = path.join(validated, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await listAllFiles(fullPath, base);
      results.push(...subFiles);
    } else {
      try {
        const stat = await fsp.stat(fullPath);
        const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");
        results.push({
          relativePath,
          absolutePath: fullPath.replace(/\\/g, "/"),
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        });
      } catch {
        // Skip files we can't stat
      }
    }
  }

  return results;
}
