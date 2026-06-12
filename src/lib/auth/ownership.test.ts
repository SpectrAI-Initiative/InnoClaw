import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hfDatasets, workspaces } from "@/lib/db/schema";
import { ANONYMOUS_AUTH_CONTEXT } from "./mode";
import {
  canAccessOwner,
  getOwnerUserIdForWrite,
  ownedDatasetFilter,
  ownedWorkspaceFilter,
} from "./ownership";
import type { AuthContext } from "./server";

const originalAuthMode = process.env.AUTH_MODE;

const localAuth: AuthContext = {
  user: {
    id: "real-user-id",
    email: "user@example.com",
    name: "Real User",
    role: "user",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  session: {
    id: "session-id",
    expiresAt: "2026-02-01T00:00:00.000Z",
  },
  token: "session-token",
};

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("ownership helpers", () => {
  it("uses null owners for writes when auth is disabled", () => {
    process.env.AUTH_MODE = "disabled";

    expect(getOwnerUserIdForWrite(ANONYMOUS_AUTH_CONTEXT)).toBeNull();
  });

  it("uses the authenticated user id for writes in local auth mode", () => {
    delete process.env.AUTH_MODE;

    expect(getOwnerUserIdForWrite(localAuth)).toBe("real-user-id");
  });

  it("allows disabled auth to access records owned by any user", () => {
    process.env.AUTH_MODE = "disabled";

    expect(canAccessOwner(ANONYMOUS_AUTH_CONTEXT, "existing-user-id")).toBe(true);
  });

  it("does not filter workspaces by the anonymous synthetic user in disabled mode", () => {
    process.env.AUTH_MODE = "disabled";

    const query = db
      .select()
      .from(workspaces)
      .where(ownedWorkspaceFilter(ANONYMOUS_AUTH_CONTEXT))
      .toSQL();

    expect(query.sql.toLowerCase()).not.toContain(" where ");
    expect(query.params).not.toContain("anonymous-admin");
  });

  it("does not filter datasets by the anonymous synthetic user in disabled mode", () => {
    process.env.AUTH_MODE = "disabled";

    const query = db
      .select()
      .from(hfDatasets)
      .where(ownedDatasetFilter(ANONYMOUS_AUTH_CONTEXT))
      .toSQL();

    expect(query.sql.toLowerCase()).not.toContain(" where ");
    expect(query.params).not.toContain("anonymous-admin");
  });
});
