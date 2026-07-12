import type { PublicUser } from "@/types/auth";
import { resolveSafeRedirectPath } from "./cli-handoff";

type AuthRole = PublicUser["role"];

function isAdministratorPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];

  try {
    const decoded = decodeURIComponent(pathname);
    const normalized = new URL(decoded, "http://innoclaw.local").pathname;
    return normalized === "/admin" || normalized.startsWith("/admin/");
  } catch {
    return false;
  }
}

export function resolveRoleAwareRedirectPath(
  value: string | null | undefined,
  role: AuthRole,
  fallback = "/",
): string {
  const safeFallback = resolveSafeRedirectPath(fallback, "/");
  const allowedFallback = role === "user" && isAdministratorPath(safeFallback)
    ? "/"
    : safeFallback;
  const resolved = resolveSafeRedirectPath(value, allowedFallback);

  return role === "user" && isAdministratorPath(resolved)
    ? allowedFallback
    : resolved;
}
