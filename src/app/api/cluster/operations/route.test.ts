import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  canUseHighRiskExecution: vi.fn(),
  listClusterOps: vi.fn(),
  requireAuth: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/auth/ownership", () => ({
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}));

vi.mock("@/lib/auth/privileges", () => ({
  canUseHighRiskExecution: mocks.canUseHighRiskExecution,
}));

vi.mock("@/lib/cluster/operations", () => ({
  listClusterOps: mocks.listClusterOps,
}));

import { GET } from "./route";

function authContext(role: "admin" | "user"): AuthContext {
  const id = role === "admin" ? "admin-id" : "user-a";
  return {
    user: {
      id,
      email: id + "@example.com",
      name: id,
      role,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: "session-" + id,
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    token: "token-" + id,
  };
}

const userAuth = authContext("user");
const adminAuth = authContext("admin");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(userAuth);
  mocks.requireWorkspaceAccess.mockResolvedValue({
    auth: userAuth,
    workspace: { id: "workspace-a" },
  });
  mocks.canUseHighRiskExecution.mockReturnValue(false);
  mocks.listClusterOps.mockResolvedValue([]);
});

describe("GET /api/cluster/operations", () => {
  it("rejects an ordinary user's all-workspace operation query", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cluster/operations"),
    );

    expect(response.status).toBe(403);
    expect(mocks.requireAuth).toHaveBeenCalledOnce();
    expect(mocks.listClusterOps).not.toHaveBeenCalled();
  });

  it("allows a privileged caller to query all operation history", async () => {
    mocks.requireAuth.mockResolvedValue(adminAuth);
    mocks.canUseHighRiskExecution.mockReturnValue(true);

    const response = await GET(
      new NextRequest("http://localhost/api/cluster/operations"),
    );

    expect(response.status).toBe(200);
    expect(mocks.listClusterOps).toHaveBeenCalledWith({
      workspaceId: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it("requires authentication before listing operation history", async () => {
    mocks.requireAuth.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/cluster/operations"),
    );

    expect(response.status).toBe(401);
    expect(mocks.listClusterOps).not.toHaveBeenCalled();
  });

  it("allows a workspace-scoped query only after workspace access", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/cluster/operations?workspaceId=workspace-a",
    ));

    expect(response.status).toBe(200);
    expect(mocks.requireAuth).toHaveBeenCalledOnce();
    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "workspace-a",
    );
    expect(mocks.listClusterOps).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      limit: 50,
      offset: 0,
    });
  });
});
