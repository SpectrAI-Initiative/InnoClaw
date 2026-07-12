import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  deleteWhere: vi.fn(),
  getSingleAdminState: vi.fn(),
  hashPassword: vi.fn(() => "hashed-password"),
  insertValues: vi.fn(),
  requireAdmin: vi.fn(),
  selectRows: [] as unknown[],
  selectLimit: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

function thenableRows<T extends object>(value: T, rows: () => unknown[]) {
  return Object.assign(value, {
    then<TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(rows()).then(onfulfilled, onrejected);
    },
  });
}

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/auth/admin-policy", () => ({
  getSingleAdminState: mocks.getSingleAdminState,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => thenableRows({
        where: vi.fn(() => thenableRows({
          limit: mocks.selectLimit,
        }, () => mocks.selectRows)),
      }, () => mocks.selectRows)),
    })),
    insert: vi.fn(() => ({ values: mocks.insertValues })),
    update: vi.fn(() => ({ set: mocks.updateSet })),
    delete: vi.fn(() => ({ where: mocks.deleteWhere })),
  },
}));

import { DELETE, GET, PATCH, POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;
const originalSingleAdmin = process.env.AUTH_SINGLE_ADMIN;

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function adminAuth(): AuthContext {
  return {
    user: {
      id: "admin-id",
      email: "admin@innoclaw.local",
      name: "Administrator",
      role: "admin",
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: "session-id",
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
    token: "session-token",
  };
}

function userRow(id: string, role: "admin" | "user" = "user") {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    passwordHash: "hash",
    role,
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AUTH_MODE;
  process.env.AUTH_SINGLE_ADMIN = "true";
  mocks.selectRows = [userRow("admin-id", "admin"), userRow("user-id")];
  mocks.selectLimit.mockResolvedValue([]);
  mocks.requireAdmin.mockResolvedValue(adminAuth());
  mocks.getSingleAdminState.mockResolvedValue({
    status: "ready",
    adminId: "admin-id",
  });
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockResolvedValue(undefined);
  mocks.deleteWhere.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
  if (originalSingleAdmin === undefined) {
    delete process.env.AUTH_SINGLE_ADMIN;
  } else {
    process.env.AUTH_SINGLE_ADMIN = originalSingleAdmin;
  }
});

describe("/api/admin/users disabled auth", () => {
  it.each([
    ["GET", GET, undefined],
    ["POST", POST, { email: "user@example.com", password: "password123" }],
    ["PATCH", PATCH, { userId: "user-id", role: "admin" }],
    ["DELETE", DELETE, { userId: "user-id" }],
  ] as const)("rejects %s when auth is disabled", async (method, handler, body) => {
    process.env.AUTH_MODE = "disabled";

    const response = await handler(request(method, body));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "User management is disabled when authentication is disabled",
    });
  });
});

describe("/api/admin/users single-admin policy", () => {
  it("returns users with an immutable single-admin marker", async () => {
    const response = await GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.singleAdmin).toBe(true);
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).not.toHaveProperty("passwordHash");
  });

  it("fails closed when the administrator state is invalid", async () => {
    mocks.getSingleAdminState.mockResolvedValue({
      status: "invalid",
      reason: "multiple",
    });

    const response = await GET(request("GET"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Single-administrator policy is not ready",
    });
  });

  it("creates ordinary users when role is omitted", async () => {
    const response = await POST(request("POST", {
      email: "new@example.com",
      name: "New User",
      password: "password123",
    }));

    expect(response.status).toBe(201);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      email: "new@example.com",
      role: "user",
    }));
  });

  it("rejects creating a second administrator", async () => {
    const response = await POST(request("POST", {
      email: "other-admin@example.com",
      password: "password123",
      role: "admin",
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("rejects every role mutation", async () => {
    const response = await PATCH(request("PATCH", {
      userId: "user-id",
      role: "admin",
    }));

    expect(response.status).toBe(400);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("rejects disabling the sole administrator", async () => {
    const response = await PATCH(request("PATCH", {
      userId: "admin-id",
      isActive: false,
    }));

    expect(response.status).toBe(400);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("allows disabling an ordinary user and revokes sessions", async () => {
    const response = await PATCH(request("PATCH", {
      userId: "user-id",
      isActive: false,
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
    }));
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      revokedAt: expect.any(String),
    }));
  });

  it("allows resetting an ordinary user's password and revokes sessions", async () => {
    const response = await PATCH(request("PATCH", {
      userId: "user-id",
      password: "new-password-123",
    }));

    expect(response.status).toBe(200);
    expect(mocks.hashPassword).toHaveBeenCalledWith("new-password-123");
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      revokedAt: expect.any(String),
    }));
  });

  it("rejects deleting the sole administrator", async () => {
    const response = await DELETE(request("DELETE", {
      userId: "admin-id",
    }));

    expect(response.status).toBe(400);
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });

  it("deletes an ordinary user after transferring ownership", async () => {
    const response = await DELETE(request("DELETE", {
      userId: "user-id",
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith({ ownerUserId: "admin-id" });
    expect(mocks.deleteWhere).toHaveBeenCalled();
  });
});
