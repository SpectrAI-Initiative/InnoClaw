import { AUTH_PUBLIC_API_PREFIXES, AUTH_PUBLIC_PATHS } from "./constants";

export type AuthMiddlewareAction =
  | { type: "next" }
  | { type: "unauthorized-json" }
  | { type: "redirect-login" }
  | { type: "redirect-home" };

export interface AuthMiddlewarePolicyInput {
  pathname: string;
  authDisabled: boolean;
  hasSession: boolean;
}

export function isPublicPath(pathname: string): boolean {
  if (AUTH_PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.includes(".");
}

export function isPublicApi(pathname: string): boolean {
  return AUTH_PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isDisabledAuthAccountPath(pathname: string): boolean {
  return pathname === "/admin/users" || pathname.startsWith("/admin/users/");
}

export function getAuthMiddlewareAction({
  pathname,
  authDisabled,
  hasSession,
}: AuthMiddlewarePolicyInput): AuthMiddlewareAction {
  if (authDisabled && isDisabledAuthAccountPath(pathname)) {
    return { type: "redirect-home" };
  }

  if (authDisabled || isPublicPath(pathname) || isPublicApi(pathname) || hasSession) {
    return { type: "next" };
  }

  if (pathname.startsWith("/api/")) {
    return { type: "unauthorized-json" };
  }

  return { type: "redirect-login" };
}
