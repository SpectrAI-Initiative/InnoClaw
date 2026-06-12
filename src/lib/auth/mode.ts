import type { AuthContext } from "./server";

export type AuthMode = "local" | "disabled";

export const ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT = "9999-12-31T23:59:59.999Z";

export const ANONYMOUS_AUTH_CONTEXT: AuthContext = {
  user: {
    id: "anonymous-admin",
    email: "anonymous@local",
    name: "Anonymous Admin",
    role: "admin",
    isActive: true,
    lastLoginAt: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
  session: {
    id: "anonymous-disabled-auth",
    expiresAt: ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT,
  },
  token: "anonymous-disabled-auth",
};

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE?.trim().toLowerCase() === "disabled" ? "disabled" : "local";
}

export function isAuthDisabled(): boolean {
  return getAuthMode() === "disabled";
}
