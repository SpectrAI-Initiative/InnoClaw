import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  addWorkspaceRoot: vi.fn(),
  isDirectory: vi.fn(),
  pathExists: vi.fn(),
  insertValues: vi.fn(),
  requireAuth: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
  selectLimit: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/files/filesystem", () => ({
  addWorkspaceRoot: mocks.addWorkspaceRoot,
  isDirectory: mocks.isDirectory,
  pathExists: mocks.pathExists,
}));

vi.mock("@/lib/auth/ownership", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/ownership")>(),
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: mocks.updateSet,
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
}));

const originalAuthMode = process.env.AUTH_MODE;

function request(body: unknown) {
  return new NextRequest("http://localhost/api/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function authContext(
  role: "admin" | "user" = "admin",
  id = role === "admin" ? "admin-user" : "user-a",
): AuthContext {
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
      id: "session-id",
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    token: "session-token",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AUTH_MODE;
  mocks.pathExists.mockResolvedValue(true);
  mocks.isDirectory.mockResolvedValue(true);
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockResolvedValue(undefined);
  mocks.requireAuth.mockResolvedValue(authContext());
  mocks.requireWorkspaceProvisioningPathsAccess.mockImplementation(
    async (_request: NextRequest, paths: string[]) => ({
      auth: authContext(),
      canonicalPaths: paths,
    }),
  );
});

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("/api/workspaces", () => {
  it("creates an ordinary user's first workspace from provisioning access", async () => {
    const user = authContext("user", "user-a");
    const canonicalPath = "/research/users/user-a/first-workspace";
    const created = {
      id: "workspace-new",
      ownerUserId: "user-a",
      name: "First Workspace",
      folderPath: canonicalPath,
    };
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
      auth: user,
      canonicalPaths: [canonicalPath],
    });
    mocks.selectLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "First Workspace",
      folderPath: "/research/users/user-a/alias/../first-workspace",
    }));

    expect(response.status).toBe(201);
    expect(mocks.pathExists).toHaveBeenCalledWith(canonicalPath);
    expect(mocks.isDirectory).toHaveBeenCalledWith(canonicalPath);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "user-a",
      folderPath: canonicalPath,
    }));
    expect(mocks.addWorkspaceRoot).not.toHaveBeenCalled();
  });

  it("returns provisioning denial before filesystem or database mutation", async () => {
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(
      NextResponse.json({ error: "Path access denied" }, { status: 403 }),
    );

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "Other User Workspace",
      folderPath: "/research/users/user-b/workspace",
    }));

    expect(response.status).toBe(403);
    expect(mocks.pathExists).not.toHaveBeenCalled();
    expect(mocks.isDirectory).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.addWorkspaceRoot).not.toHaveBeenCalled();
  });

  it("maps a concurrent canonical-path uniqueness race to 409", async () => {
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
      auth: authContext("user", "user-a"),
      canonicalPaths: ["/research/users/user-a/workspace"],
    });
    mocks.selectLimit.mockResolvedValueOnce([]);
    mocks.insertValues.mockRejectedValue(
      Object.assign(new Error("UNIQUE constraint failed: workspaces.folder_path"), {
        code: "SQLITE_CONSTRAINT_UNIQUE",
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "Workspace",
      folderPath: "/research/users/user-a/workspace",
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This folder is already registered",
    });
  });

  it("allows an administrator to register a canonical path under an operator root", async () => {
    const canonicalPath = "/research/admin-workspace";
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
      auth: authContext("admin"),
      canonicalPaths: [canonicalPath],
    });
    mocks.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "workspace-admin",
        ownerUserId: "admin-user",
        folderPath: canonicalPath,
      }]);

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "Admin Workspace",
      folderPath: canonicalPath,
    }));

    expect(response.status).toBe(201);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "admin-user",
      folderPath: canonicalPath,
    }));
  });

  it("claims an existing unowned workspace for the current local admin", async () => {
    const workspace = {
      id: "workspace-1",
      ownerUserId: null,
      name: "Existing Workspace",
      folderPath: "D:/Data/research",
      description: null,
      isGitRepo: false,
      gitRemoteUrl: null,
      lastOpenedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.selectLimit.mockResolvedValueOnce([workspace]);

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "Existing Workspace",
      folderPath: "D:/Data/research",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      ownerUserId: "admin-user",
      lastOpenedAt: expect.any(String),
    });
    expect(body.id).toBe("workspace-1");
  });

  it("creates disabled-auth workspaces without a synthetic owner user id", async () => {
    process.env.AUTH_MODE = "disabled";
    mocks.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "workspace-2",
        ownerUserId: null,
        name: "No Auth Workspace",
        folderPath: "D:/Data/no-auth",
        description: null,
        isGitRepo: false,
        gitRemoteUrl: null,
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }]);

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "No Auth Workspace",
      folderPath: "D:/Data/no-auth",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: null,
    }));
    expect(mocks.insertValues.mock.calls[0][0].ownerUserId).not.toBe("anonymous-admin");
    expect(body.id).toBe("workspace-2");
  });

  it("reopens any existing workspace in disabled auth without changing its owner", async () => {
    process.env.AUTH_MODE = "disabled";
    const workspace = {
      id: "workspace-3",
      ownerUserId: "real-user",
      name: "Owned Workspace",
      folderPath: "D:/Data/owned",
      description: null,
      isGitRepo: false,
      gitRemoteUrl: null,
      lastOpenedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.selectLimit.mockResolvedValueOnce([workspace]);

    const { POST } = await import("./route");
    const response = await POST(request({
      name: "Owned Workspace",
      folderPath: "D:/Data/owned",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      lastOpenedAt: expect.any(String),
    });
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(body.ownerUserId).toBe("real-user");
  });
});
