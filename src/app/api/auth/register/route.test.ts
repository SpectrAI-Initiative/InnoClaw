import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  attachAuthCookies: vi.fn((response: unknown) => response),
  claimExistingDataForFirstUser: vi.fn(),
  createAuthSession: vi.fn(),
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  getSingleAdminState: vi.fn(),
  getUserCount: vi.fn(),
  hashPassword: vi.fn(() => "hashed-password"),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  attachAuthCookies: mocks.attachAuthCookies,
  claimExistingDataForFirstUser: mocks.claimExistingDataForFirstUser,
  createAuthSession: mocks.createAuthSession,
  createUser: mocks.createUser,
  findUserByEmail: mocks.findUserByEmail,
  getUserCount: mocks.getUserCount,
}));

vi.mock("@/lib/auth/admin-policy", () => ({
  getSingleAdminState: mocks.getSingleAdminState,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: mocks.updateSet,
    })),
  },
}));

import { POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;
const originalSingleAdmin = process.env.AUTH_SINGLE_ADMIN;

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function createdUser(role: "admin" | "user") {
  return {
    id: `${role}-id`,
    email: `${role}@example.com`,
    name: role === "admin" ? "Admin" : "User",
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
  delete process.env.AUTH_SINGLE_ADMIN;
  mocks.findUserByEmail.mockResolvedValue(null);
  mocks.getUserCount.mockResolvedValue(1);
  mocks.getSingleAdminState.mockResolvedValue({
    status: "ready",
    adminId: "admin-id",
  });
  mocks.createUser.mockResolvedValue(createdUser("user"));
  mocks.createAuthSession.mockResolvedValue({
    token: "session-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockResolvedValue(undefined);
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

describe("POST /api/auth/register", () => {
  it("rejects registration when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    const response = await POST(request({
      email: "user@example.com",
      password: "password123",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Authentication is disabled");
  });

  it("returns 503 before the administrator is bootstrapped", async () => {
    process.env.AUTH_SINGLE_ADMIN = "true";
    mocks.getSingleAdminState.mockResolvedValue({
      status: "invalid",
      reason: "missing",
    });

    const response = await POST(request({
      email: "user@example.com",
      password: "password123",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Administrator setup is incomplete",
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied role in single-admin mode", async () => {
    process.env.AUTH_SINGLE_ADMIN = "true";

    const response = await POST(request({
      email: "user@example.com",
      password: "password123",
      role: "admin",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Role cannot be selected during registration",
    });
    expect(mocks.getSingleAdminState).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("creates an ordinary user when single-admin mode is ready", async () => {
    process.env.AUTH_SINGLE_ADMIN = "true";

    const response = await POST(request({
      email: "user@example.com",
      name: "User",
      password: "password123",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "user@example.com",
      role: "user",
    }));
    expect(mocks.claimExistingDataForFirstUser).not.toHaveBeenCalled();
  });

  it("preserves first-user administrator bootstrap when policy is disabled", async () => {
    process.env.AUTH_SINGLE_ADMIN = "false";
    mocks.getUserCount.mockResolvedValue(0);
    mocks.createUser.mockResolvedValue(createdUser("admin"));

    const response = await POST(request({
      email: "admin@example.com",
      password: "password123",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: "admin",
    }));
    expect(mocks.claimExistingDataForFirstUser).toHaveBeenCalledWith("admin-id");
  });
});
