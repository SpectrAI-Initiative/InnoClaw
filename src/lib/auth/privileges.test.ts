import { afterEach, describe, expect, it } from "vitest";
import { ANONYMOUS_AUTH_CONTEXT } from "./mode";
import { canUseHighRiskExecution } from "./privileges";
import type { AuthContext } from "./server";

const originalAuthMode = process.env.AUTH_MODE;
const originalSingleAdmin = process.env.AUTH_SINGLE_ADMIN;

function authContext(role: "admin" | "user"): AuthContext {
  const id = role === "admin" ? "admin-id" : "user-a";
  return {
    user: {
      id,
      email: `${id}@example.com`,
      name: id,
      role,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: `session-${id}`,
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    token: `token-${id}`,
  };
}

afterEach(() => {
  if (originalAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = originalAuthMode;
  if (originalSingleAdmin === undefined) delete process.env.AUTH_SINGLE_ADMIN;
  else process.env.AUTH_SINGLE_ADMIN = originalSingleAdmin;
});

describe("high-risk execution privileges", () => {
  it("allows the administrator in strict mode", () => {
    process.env.AUTH_MODE = "local";
    process.env.AUTH_SINGLE_ADMIN = "true";

    expect(canUseHighRiskExecution(authContext("admin"))).toBe(true);
  });

  it("rejects an ordinary user in strict mode", () => {
    process.env.AUTH_MODE = "local";
    process.env.AUTH_SINGLE_ADMIN = "true";

    expect(canUseHighRiskExecution(authContext("user"))).toBe(false);
  });

  it("preserves ordinary-user compatibility outside strict mode", () => {
    process.env.AUTH_MODE = "local";
    process.env.AUTH_SINGLE_ADMIN = "false";

    expect(canUseHighRiskExecution(authContext("user"))).toBe(true);
  });

  it("preserves trusted disabled-auth behavior", () => {
    process.env.AUTH_MODE = "disabled";
    process.env.AUTH_SINGLE_ADMIN = "true";

    expect(canUseHighRiskExecution(ANONYMOUS_AUTH_CONTEXT)).toBe(true);
  });
});
