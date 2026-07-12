import fs from "fs";
import path from "path";

export class PathAccessError extends Error {
  override name = "PathAccessError";
}

export function isPathWithinRoot(
  target: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const normalize = (value: string) =>
    platform === "win32" ? value.toLowerCase() : value;
  const relative = pathApi.relative(normalize(root), normalize(target));

  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${pathApi.sep}`) &&
      !pathApi.isAbsolute(relative))
  );
}

export function canonicalizePath(target: string): string {
  if (!path.isAbsolute(target)) {
    throw new PathAccessError("Path must be absolute");
  }
  if (target.includes("\0")) {
    throw new PathAccessError("Path contains a null byte");
  }

  let cursor = path.resolve(target);
  const missingSegments: string[] = [];

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      throw new PathAccessError("Path has no existing ancestor");
    }
    missingSegments.unshift(path.basename(cursor));
    cursor = parent;
  }

  return path.resolve(fs.realpathSync(cursor), ...missingSegments);
}

export function resolvePathWithinRoots(target: string, roots: string[]): string {
  if (roots.length === 0) {
    throw new PathAccessError("No workspace roots configured");
  }

  const canonicalTarget = canonicalizePath(target);
  const isAllowed = roots.some((root) =>
    isPathWithinRoot(canonicalTarget, canonicalizePath(root)),
  );

  if (!isAllowed) {
    throw new PathAccessError("Path is outside the allowed roots");
  }

  return canonicalTarget;
}
