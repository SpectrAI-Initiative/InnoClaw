import fs from "fs";
import path from "path";
import {
  PathAccessError,
  canonicalizePath,
  resolvePathWithinRoots,
} from "@/lib/files/canonical-path";
import { getWorkspaceRoots } from "@/lib/files/filesystem";
import { isAuthDisabled } from "./mode";
import type { AuthContext } from "./server";

const SAFE_USER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function normalizedConfiguredRoots(configured: string[]): string[] {
  return configured.map((root) => path.resolve(root));
}

function assertSafeUserId(userId: string): void {
  if (!SAFE_USER_ID.test(userId)) {
    throw new PathAccessError("Invalid workspace user id");
  }
}

export function getEffectiveWorkspaceRoots(
  auth: AuthContext,
  configured = getWorkspaceRoots(),
): string[] {
  const roots = normalizedConfiguredRoots(configured);
  if (isAuthDisabled() || auth.user.role === "admin") {
    return roots;
  }

  assertSafeUserId(auth.user.id);
  return roots.map((root) => path.join(root, "users", auth.user.id));
}

export function ensureEffectiveWorkspaceRoots(
  auth: AuthContext,
  configured = getWorkspaceRoots(),
): string[] {
  const configuredRoots = normalizedConfiguredRoots(configured);
  if (configuredRoots.length === 0) {
    throw new PathAccessError("No workspace roots configured");
  }

  for (const root of configuredRoots) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(root);
    } catch {
      throw new PathAccessError(`Configured workspace root does not exist: ${root}`);
    }
    if (!stat.isDirectory()) {
      throw new PathAccessError(`Configured workspace root is not a directory: ${root}`);
    }
  }

  const canonicalConfiguredRoots = configuredRoots.map(canonicalizePath);
  if (!isAuthDisabled() && auth.user.role !== "admin") {
    const effectiveRoots = getEffectiveWorkspaceRoots(
      auth,
      canonicalConfiguredRoots,
    ).map((root) => resolvePathWithinRoots(root, canonicalConfiguredRoots));
    for (const root of effectiveRoots) {
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      if (process.platform !== "win32") {
        fs.chmodSync(root, 0o700);
      }
    }
    return effectiveRoots.map(canonicalizePath);
  }

  return canonicalConfiguredRoots;
}

export function resolveProvisioningPath(
  auth: AuthContext,
  target: string,
): string {
  return resolvePathWithinRoots(target, ensureEffectiveWorkspaceRoots(auth));
}
